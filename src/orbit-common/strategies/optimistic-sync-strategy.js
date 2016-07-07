import RequestStrategy from './request-strategy';
import SyncStrategy from './sync-strategy';

/**
  Optimistic strategy notes

  RequestStrategy failure modes:

  A) retry task
     Options:
     1) in x seconds
     2) in fn seconds
  B) fail and remove task from queue
    * Options:
      1) proceed to next task in queue
      2) remove all subsequent tasks from queue
 */
export default class OptimisticSyncStrategy {
  constructor({ localNode, remoteNode, autoActivate }) {
    this.localNode = localNode;
    this.remoteNode = remoteNode;

    this.updateRequestStrategy = new RequestStrategy({
      sourceNode: localNode,
      targetNode: remoteNode,
      sourceEvent: 'update',
      targetRequest: 'push',
      blocking: false,
      syncResults: false,
      autoActivate: false
    });

    this.syncStrategy = new SyncStrategy({
      sourceNode: remoteNode,
      targetNode: localNode,
      blocking: false,
      autoActivate: false
    });

    if (autoActivate || autoActivate === undefined) {
      this.activate();
    }
  }

  activate() {
    this.updateRequestStrategy.activate();
    this.syncStrategy.activate();
  }

  deactivate() {
    this.updateRequestStrategy.deactivate();
    this.syncStrategy.deactivate();
  }
}
