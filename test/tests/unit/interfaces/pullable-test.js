import Source from 'orbit/source';
import Pullable from 'orbit/interfaces/pullable';
import Transform from 'orbit/transform';
import Query from 'orbit/query';
import { Promise } from 'rsvp';
import { successfulOperation, failedOperation } from 'tests/test-helper';

let source;

module('Orbit - Source Interfaces - Pullable', {
  setup: function() {
    source = new Source({ name: 'src1' });
    Pullable.extend(source);
  },

  teardown: function() {
    source = null;
  }
});

test('it exists', function(assert) {
  assert.ok(source);
});

test('it should be applied to a Source', function(assert) {
  assert.throws(function() {
    let pojo = {};
    Pullable.extend(pojo);
  },
  Error('Assertion failed: Pullable interface can only be applied to a Source'),
  'assertion raised');
});

test('it should resolve as a failure when _pull fails', function(assert) {
  assert.expect(2);

  source._pull = function() {
    return failedOperation();
  };

  return source.pull(Query.from({ query: ['abc', 'def'] }))
    .catch((error) => {
      assert.ok(true, 'pull promise resolved as a failure');
      assert.equal(error, ':(', 'failure');
    });
});

test('it should trigger `pull` event after a successful action in which `_pull` returns an array of transforms', function(assert) {
  assert.expect(9);

  let order = 0;

  const resultingTransforms = [
    Transform.from({ op: 'addRecord' }, { op: 'addRecord' }),
    Transform.from({ op: 'replaceRecordAttribute' })
  ];

  source._pull = function(query) {
    assert.equal(++order, 1, 'action performed after willPull');
    assert.deepEqual(query.expression, { query: ['abc', 'def'] }, 'query object matches');
    return Promise.resolve(resultingTransforms);
  };

  let transformCount = 0;
  source.on('transform', (transform) => {
    assert.strictEqual(transform, resultingTransforms[transformCount++], 'transform matches');
    return Promise.resolve();
  });

  source.on('pull', (query, result) => {
    assert.equal(++order, 2, 'pull triggered after action performed successfully');
    assert.deepEqual(query.expression, { query: ['abc', 'def'] }, 'query matches');
    assert.strictEqual(result, resultingTransforms, 'result matches');
  });

  return source.pull(Query.from({ query: ['abc', 'def'] }))
    .then((result) => {
      assert.equal(++order, 3, 'promise resolved last');
      assert.strictEqual(result, resultingTransforms, 'success!');
    });
});

test('it should resolve all promises returned from `beforePull` before calling `_transform`', function(assert) {
  assert.expect(12);

  let order = 0;

  const resultingTransforms = [
    Transform.from({ op: 'addRecord' }, { op: 'addRecord' }),
    Transform.from({ op: 'replaceRecordAttribute' })
  ];

  source.on('beforePull', () => {
    assert.equal(++order, 1, 'beforePull triggered first');
    return successfulOperation();
  });

  source.on('beforePull', () => {
    assert.equal(++order, 2, 'beforePull triggered second');
    return undefined;
  });

  source.on('beforePull', () => {
    assert.equal(++order, 3, 'beforePull triggered third');
    return successfulOperation();
  });

  source._pull = function(query) {
    assert.equal(++order, 4, 'action performed after willPull');
    assert.deepEqual(query.expression, { query: ['abc', 'def'] }, 'query object matches');
    return Promise.resolve(resultingTransforms);
  };

  let transformCount = 0;
  source.on('transform', (transform) => {
    assert.strictEqual(transform, resultingTransforms[transformCount++], 'transform matches');
    return Promise.resolve();
  });

  source.on('pull', (query, result) => {
    assert.equal(++order, 5, 'pull triggered after action performed successfully');
    assert.deepEqual(query.expression, { query: ['abc', 'def'] }, 'query matches');
    assert.strictEqual(result, resultingTransforms, 'result matches');
  });

  return source.pull(Query.from({ query: ['abc', 'def'] }))
    .then((result) => {
      assert.equal(++order, 6, 'promise resolved last');
      assert.strictEqual(result, resultingTransforms, 'success!');
    });
});

test('it should resolve all promises returned from `beforePull` and fail if any fail', function(assert) {
  assert.expect(7);

  let order = 0;

  source.on('beforePull', () => {
    assert.equal(++order, 1, 'beforePull triggered third');
    return successfulOperation();
  });

  source.on('beforePull', () => {
    assert.equal(++order, 2, 'beforePull triggered third');
    return failedOperation();
  });

  source._pull = function() {
    assert.ok(false, '_pull should not be invoked');
  };

  source.on('pull', () => {
    assert.ok(false, 'pull should not be triggered');
  });

  source.on('pullFail', (query, error) => {
    assert.equal(++order, 3, 'pullFail triggered after an unsuccessful beforePull');
    assert.deepEqual(query.expression, { query: ['abc', 'def'] }, 'query matches');
    assert.equal(error, ':(', 'error matches');
  });

  return source.pull(Query.from({ query: ['abc', 'def'] }))
    .catch((error) => {
      assert.equal(++order, 4, 'promise resolved last');
      assert.equal(error, ':(', 'failure');
    });
});

test('it should trigger `pullFail` event after an unsuccessful pull', function(assert) {
  assert.expect(7);

  let order = 0;

  source._pull = function(query) {
    assert.equal(++order, 1, 'action performed after willPull');
    assert.deepEqual(query.expression, { query: ['abc', 'def'] }, 'query object matches');
    return failedOperation();
  };

  source.on('pull', () => {
    assert.ok(false, 'pull should not be triggered');
  });

  source.on('pullFail', (query, error) => {
    assert.equal(++order, 2, 'pullFail triggered after an unsuccessful pull');
    assert.deepEqual(query.expression, { query: ['abc', 'def'] }, 'query matches');
    assert.equal(error, ':(', 'error matches');
  });

  return source.pull(Query.from({ query: ['abc', 'def'] }))
    .catch((error) => {
      assert.equal(++order, 3, 'promise resolved last');
      assert.equal(error, ':(', 'failure');
    });
});
