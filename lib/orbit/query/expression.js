import { Class, isObject } from 'orbit/lib/objects';

const QueryExpression = Class.extend({
  __oqe__: true,
  op: null,
  args: null,
  init(op, args) {
    this.op = op;
    this.args = args;
  },

  toString() {
    const formattedArgs = this.args.map(arg => '' + arg).join(', ');
    return `${this.op}(${formattedArgs})`;
  }
});

export function queryExpression(op) {
  return new QueryExpression(op, Array.prototype.slice.call(arguments, 1));
}

export function isQueryExpression(obj) {
  return isObject(obj) && obj.__oqe__;
}

export default QueryExpression;