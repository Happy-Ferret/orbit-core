import { TransformNotLoggedException } from 'orbit/lib/exceptions';

export default class TransformLog {
  constructor() {
    this._log = [];
  }

  append(transformId) {
    this._log.push(transformId);
  }

  head() {
    return this._log[this._log.length - 1];
  }

  entries() {
    return this._log;
  }

  length() {
    return this._log.length;
  }

  before(transformId, relativePosition = 0) {
    const index = this._indexOf(transformId);
    return this._log.slice(0, index + relativePosition);
  }

  after(transformId, relativePosition = 0) {
    const index = this._indexOf(transformId);
    return this._log.slice(index + 1 + relativePosition);
  }

  truncate(transformId, relativePosition = 0) {
    const index = this._indexOf(transformId);
    this._log = this._log.slice(index + relativePosition);
  }

  rollback(transformId, relativePosition = 0) {
    const index = this._indexOf(transformId);
    this._log.length = index + 1 + relativePosition;
  }

  clear() {
    this._log = [];
  }

  isEmpty() {
    return this._log.length === 0;
  }

  contains(transformId) {
    return this._log.indexOf(transformId) !== -1;
  }

  _indexOf(transformId) {
    const index = this._log.indexOf(transformId);
    return index !== -1 ? index : this._throwTransformNotLogged(transformId);
  }

  _throwTransformNotLogged(transformId) {
    throw new TransformNotLoggedException(transformId);
  }
}
