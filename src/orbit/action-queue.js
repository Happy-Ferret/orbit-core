/* eslint-disable valid-jsdoc */
import Orbit from './main';
import Action from './action';
import Evented from './evented';
import { assert } from './lib/assert';

/**
 `ActionQueue` is a FIFO queue of actions that should be performed sequentially.

 Actions are added to the queue with `push`. Each action will be processed by
 calling its `process` method.

 If action calls return a promise, then that promise will be settled before the
 next action is de-queued and called. If action calls don't return anything,
 then the next action will be de-queued and called immediately.

 By default, ActionQueues will be processed automatically, as soon as actions
 are pushed to them. This can be overridden by setting the `autoProcess` option
 to `false` and then by calling `process` when you'd like to start processing.

 @example

 ``` javascript
 var transform = function(operation) {
   // perform operation here
 };

 var queue = new ActionQueue();

 // push operations into queue synchronously so that they'll be performed
 // sequentially
 queue.push({
   process: function() { transform(this.data); },
   data: {op: 'add', path: ['planets', '123'], value: 'Mercury'}
 });
 queue.push({
   process: function() { transform(this.data); },
   data: {op: 'add', path: ['planets', '234'], value: 'Venus'}
 });
 ```

 @class ActionQueue
 @namespace Orbit
 @param {Object}   [options]
 @param {Boolean}  [options.autoProcess=true] Are actions automatically
                   processed as soon as they are pushed?
 @constructor
 */
export default class ActionQueue {
  constructor(options) {
    assert('ActionQueue requires Orbit.Promise to be defined', Orbit.Promise);

    options = options || {};
    this.autoProcess = options.autoProcess !== undefined ? options.autoProcess : true;

    this._resolution = null;
    this._actions = [];
  }

  get length() {
    return this._actions.length;
  }

  get current() {
    return this._actions[0];
  }

  get processing() {
    const current = this.current;
    return current && current.started && !current.settled;
  }

  push(_action) {
    let action = Action.from(_action);

    this._actions.push(action);

    if (this.autoProcess) { this.process(); }

    return action;
  }

  retry() {
    assert('ActionQueue#retry can only be called when the queue is not processing', !this.processing);

    this.current.reset();

    return this.process();
  }

  skip() {
    assert('ActionQueue#skip can only be called when the queue is not processing', !this.processing);

    this._actions.shift();

    return this.process();
  }

  clear() {
    console.log('clear', this.processing);
    assert('ActionQueue#clear can only be called when the queue is not processing', !this.processing);

    this._actions = [];
  }

  shift() {
    assert('ActionQueue#shift can only be called when the queue is not processing', !this.processing);

    return this._actions.shift();
  }

  unshift(_action) {
    assert('ActionQueue#unshift can only be called when the queue is not processing', !this.processing);

    let action = Action.from(_action);

    this._actions.unshift(action);

    return action;
  }

  process() {
    let resolution = this._resolution;

    if (!resolution) {
      if (this._actions.length === 0) {
        resolution = Orbit.Promise.resolve();
      } else {
        this._resolution = resolution = new Orbit.Promise((resolve, reject) => {
          this.one('complete', () => resolve());
          this.one('fail', (action, e) => reject(e));
        });

        this._processing = true;
        this._settleEach();
      }
    }

    return resolution;
  }

  _settleEach() {
    if (this._actions.length === 0) {
      this._resolution = null;
      this.emit('complete');
    } else {
      let action = this._actions[0];

      this.emit('beforeAction', action);

      action.process()
        .then(() => {
          this.emit('action', action);
          this._actions.shift();
          this._settleEach();
        })
        .catch((e) => {
          this._resolution = null;
          this.emit('fail', action, e);
        });
    }
  }
}

Evented.extend(ActionQueue.prototype);
