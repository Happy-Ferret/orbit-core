export default class SyncStrategy {
  constructor({ sourceNode, targetNode, blocking, autoActivate }) {
    this.sourceNode = sourceNode;
    this.targetNode = targetNode;
    this.blocking = blocking;

    if (autoActivate || autoActivate === undefined) {
      this.activate();
    }
  }

  activate() {
    const { sourceNode, targetNode } = this;

    this.eventListener = (transform) => {
      const promise = targetNode.sync([transform]);

      if (this.blocking) {
        return promise;
      }
    };

    sourceNode.on('transform', this.eventListener);
  }

  deactivate() {
    if (this.eventListener) {
      this.sourceNode.off('transform', this.eventListener);
      delete this.eventListener;
    }
  }
}
