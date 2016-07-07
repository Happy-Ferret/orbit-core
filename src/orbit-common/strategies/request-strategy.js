export default class RequestStrategy {
  constructor({ sourceNode, targetNode, sourceEvent, targetRequest, syncResults, blocking, autoActivate }) {
    this.sourceNode = sourceNode;
    this.targetNode = targetNode;
    this.sourceEvent = sourceEvent;
    this.targetRequest = targetRequest;
    this.syncResults = syncResults;
    this.blocking = blocking;

    if (autoActivate || autoActivate === undefined) {
      this.activate();
    }
  }

  activate() {
    const { sourceNode, targetNode, sourceEvent, targetRequest, syncResults, blocking } = this;

    this.eventListener = (request) => {
      const promise = targetNode.request(targetRequest, request)
        .then(result => {
          if (syncResults) {
            return sourceNode.sync(result);
          }
        });

      if (blocking) {
        return promise;
      }
    };

    sourceNode.on(sourceEvent, this.eventListener);
  }

  deactivate() {
    if (this.eventListener) {
      this.sourceNode.off(this.sourceEvent, this.eventListener);
      delete this.eventListener;
    }
  }
}
