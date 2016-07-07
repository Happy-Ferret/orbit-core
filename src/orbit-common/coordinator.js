import Orbit from 'orbit';
import { assert } from 'orbit/lib/assert';
import { isArray } from 'orbit/lib/objects';
import ActionQueue from 'orbit/action-queue';

class Node {
  constructor(coordinator, name, options = {}) {
    this.coordinator = coordinator;
    this.name = name;
    this.sources = [];

    let sources = options.sources;
    if (sources) {
      let sourceOptions = options.sourceOptions || {};

      sources.forEach(source => {
        this.addSource(source, sourceOptions[source.name]);
      });
    }
  }

  addSource(source, options = {}) {
    let needsRequestQueue = false;
    let needsSyncQueue = false;

    if (source._pushable && options.pushable !== false) {
      assert(`A 'pushable' source has already been defined for node '${this.name}'`, !this.pushableSource);
      this.pushableSource = source;
      needsRequestQueue = true;
    }

    if (source._pullable && options.pullable !== false) {
      assert(`A 'pullable' source has already been defined for node '${this.name}'`, !this.pullableSource);
      this.pullableSource = source;
      needsRequestQueue = true;
    }

    if (source._updatable && options.updatable !== false) {
      assert(`An 'updatable' source has already been defined for node '${this.name}'`, !this.updatableSource);
      this.updatableSource = source;
      needsRequestQueue = true;
    }

    if (source._queryable && options.queryable !== false) {
      assert(`A 'queryable' source has already been defined for node '${this.name}'`, !this.queryableSource);
      this.queryableSource = source;
      needsRequestQueue = true;
    }

    if (source._pickable && options.pickable !== false) {
      assert(`A 'pickable' source has already been defined for node '${this.name}'`, !this.pickableSource);
      this.pickableSource = source;
      needsSyncQueue = true;
    }

    if (needsRequestQueue) {
      this.requestQueue = new ActionQueue();
    }

    if (needsSyncQueue) {
      this.syncQueue = new ActionQueue();
    }

    this.sources.push(source);
  }

  on(eventName, callback, binding) {
    this._sourcesForEvent(eventName).forEach(source => {
      source.on(eventName, callback, binding);
    });
  }

  off(eventName, callback, binding) {
    this._sourcesForEvent(eventName).forEach(source => {
      source.off(eventName, callback, binding);
    });
  }

  request(method, data) {
    const source = this._sourceForRequest(method);

    const action = this.requestQueue.push({
      data: { method, data },
      process: () => {
        return source[method](data);
      }
    });

    return action.settle();
  }

  sync(transformOrTransforms) {
    if (isArray(transformOrTransforms)) {
      return transformOrTransforms.reduce((chain, t) => {
        return chain.then(() => this._enqueueTransform(t));
      }, Orbit.Promise.resolve());
    } else {
      return this._enqueueTransform(transformOrTransforms);
    }
  }

  _sourceForRequestEvent(eventName) {
    switch (eventName) {
      case 'beforeUpdate':
      case 'update':
        return this.updatableSource;

      case 'beforeQuery':
      case 'query':
        return this.queryableSource;

      case 'beforePush':
      case 'push':
        return this.pushableSource;

      case 'beforePull':
      case 'pull':
        return this.pullableSource;
    }
  }

  _sourceForRequest(requestName) {
    switch (requestName) {
      case 'push':
        return this.pushableSource;

      case 'pull':
        return this.pullableSource;
    }
  }

  _sourcesForEvent(eventName) {
    if (eventName === 'transform') {
      return this.sources;
    } else {
      return [this._sourceForRequestEvent(eventName)];
    }
  }

  _enqueueTransform(transform) {
    const source = this.pickableSource;

    const action = this.syncQueue.push({
      data: transform,
      process: () => {
        return source.pick(transform);
      }
    });

    return action.settle();
  }
}

///////////////////////////////////////////////////////////

export default class Coordinator {
  constructor() {
    this._nodes = {};
  }

  addNode(name, options = {}) {
    assert(`Node '${name}' already exists.`, !this._nodes[name]);

    const node = new Node(this, name, options);

    this._nodes[name] = node;

    return node;
  }

  getNode(name) {
    return this._nodes[name];
  }

  get nodes() {
    return Object.keys(this._nodes).map(k => this._nodes[k]);
  }
}
