import Orbit from 'orbit';
import { planetsSchema } from 'tests/test-helper';
import Coordinator from 'orbit-common/coordinator';
// import OptimisticSyncStrategy from 'orbit-common/strategies/optimistic-sync-strategy';
import Store from 'orbit-common/store';
import JsonApiSource from 'orbit-common/jsonapi-source';
// import { eq } from 'orbit/lib/eq';
// import qb from 'orbit-common/query/builder';
import KeyMap from 'orbit-common/key-map';
import { all } from 'rsvp';
import {
  addRecord
  // replaceRecord,
  // removeRecord,
  // replaceKey,
  // replaceAttribute,
  // addToHasMany,
  // removeFromHasMany,
  // replaceHasMany,
  // replaceHasOne
} from 'orbit-common/transform/operators';
import {
  jsonapiResponse
} from 'tests/test-helper';

let fetchStub;

module('Integration - Coordinator - Optimistic Sync Strategy', function(hooks) {
  let store;
  let jsonApiSource;
  let coordinator;
  // let optimisticSyncStrategy;
  let master;
  let upstream;

  hooks.beforeEach(function() {
    fetchStub = sinon.stub(Orbit, 'fetch');

    let keyMap = new KeyMap();
    coordinator = new Coordinator();
    jsonApiSource = new JsonApiSource({ schema: planetsSchema, keyMap: new KeyMap() });
    store = new Store({ schema: planetsSchema, keyMap });

    master = coordinator.addNode('master', {
      sources: [store]
    });

    upstream = coordinator.addNode('upstream', {
      sources: [jsonApiSource]
    });

    master.on('update',
      transform => {
        upstream.request('push', transform)
          .catch(e => {
            if (e.response && e.response.status >= 400 && e.response.status < 500) {
              upstream.requestQueue.clear();
              store.rollback(transform.id, -1);
            }
          });
      });

    upstream.on('transform',
      transform => {
        master.sync(transform);
      });

    // optimisticSyncStrategy = new OptimisticSyncStrategy({
    //   localNode: master,
    //   remoteNode: upstream
    // });
  });

  hooks.afterEach(function() {
    // optimisticSyncStrategy.deactivate();

    fetchStub.restore();
  });

  test('#update - add a single record successfully', function(assert) {
    const done = assert.async();

    assert.expect(4);

    const pluto = { type: 'planet', id: 'pluto', attributes: { name: 'Pluto' } };

    assert.equal(upstream.requestQueue.length, 0, 'request queue is empty');

    upstream.requestQueue.one('complete', () => {
      assert.equal(upstream.requestQueue.length, 0, 'request has been processed by jsonapi source');
      done();
    });

    fetchStub
      .withArgs('/planets')
      .returns(jsonapiResponse(201, {
        data: { type: 'planets', id: '12345', attributes: { name: 'Pluto', classification: 'ice' } }
      }));

    store.update(addRecord(pluto))
      .then(() => {
        assert.equal(upstream.requestQueue.length, 1, 'request is queued for jsonapi source');

        assert.equal(store.cache.get(['planet', pluto.id, 'attributes', 'name']), 'Pluto', 'planet exists in store');
      });
  });

  test('#update - add a single record unsuccessfully - abort', function(assert) {
    const done = assert.async();

    assert.expect(4);

    const pluto = { type: 'planet', id: 'pluto', attributes: { name: 'Pluto' } };

    assert.equal(upstream.requestQueue.length, 0, 'request queue is empty');

    upstream.requestQueue.one('complete', () => {
      ok(false, 'queue should not complete');
    });

    upstream.requestQueue.one('fail', (/* action, e */) => {
      assert.equal(store.cache.get(['planet', pluto.id]), undefined, 'planet has been removed from the store');

      done();
    });

    fetchStub
      .withArgs('/planets')
      .returns(jsonapiResponse(422, {
        errors: [
          {
            status: 422,
            source: {
              pointer: 'data/attributes/name'
            },
            title: 'Invalid Attribute',
            detail: 'Pluto isn\'t really a planet!'
          }
        ]
      }));

    store.update(addRecord(pluto))
      .then(() => {
        assert.equal(store.cache.get(['planet', pluto.id, 'attributes', 'name']), 'Pluto', 'planet exists in store');

        assert.equal(upstream.requestQueue.length, 1, 'request is queued for jsonapi source');
      });
  });

  test('#update - add multiple records successfully', function(assert) {
    const done = assert.async();

    assert.expect(4);

    const pluto = { type: 'planet', id: 'pluto', attributes: { name: 'Pluto' } };
    const saturn = { type: 'planet', id: 'saturn', attributes: { name: 'Saturn' } };
    const jupiter = { type: 'planet', id: 'jupiter', attributes: { name: 'Jupiter' } };
    const planets = [pluto, saturn, jupiter];

    assert.equal(upstream.requestQueue.length, 0, 'request queue is empty');

    for (let i = 0; i < 3; i++) {
      let data = planets[i];
      fetchStub
        .withArgs('/planets')
        .onCall(i)
        .returns(jsonapiResponse(201, { data }));
    }

    upstream.requestQueue.one('complete', () => {
      assert.equal(upstream.requestQueue.length, 0, 'request queue is empty');
      done();
    });

    all([
      store.update(addRecord(pluto)),
      store.update(addRecord(saturn)),
      store.update(addRecord(jupiter))
    ])
      .then(() => {
        assert.equal(store.cache.length(['planet']), 3, 'planets exist in store');
        assert.equal(upstream.requestQueue.length, 3, 'request is queued for jsonapi source');
      });
  });

  // test('#update - addRecord - multiple records added to store and successfully processed on the server', function(assert) {
  //   assert.expect(6);
  //
  //   const pluto = { type: 'planet', id: 'pluto', attributes: { name: 'Pluto' } };
  //   const saturn = { type: 'planet', id: 'saturn', attributes: { name: 'Saturn' } };
  //   const earth = { type: 'planet', id: 'earth', attributes: { name: 'Earth' } };
  //   const jupiter = { type: 'planet', id: 'jupiter', attributes: { name: 'Jupiter' } };
  //
  //   // onAddPlutoRequest(stubbedResponses.plutoAdded);
  //
  //   return all([
  //     store.update(addRecord(pluto)),
  //     store.update(addRecord(saturn)),
  //     store.update(addRecord(earth)),
  //     store.update(addRecord(jupiter))
  //   ])
  //     .then(() => {
  //       assert.equal(store.cache.length(['planet']), 4, '4 records are in the cache');
  //
  //       // verify that the same 4 records are in local storage
  //       verifyLocalStorageContainsRecord(localStorage, pluto);
  //       verifyLocalStorageContainsRecord(localStorage, saturn);
  //       verifyLocalStorageContainsRecord(localStorage, earth);
  //       verifyLocalStorageContainsRecord(localStorage, jupiter);
  //
  //       assert.equal(coordinator.requestQueues['jsonapi'].length, 4, '4 requests are queued for jsonapi source');
  //     });
  // });
  //
  // test('#update - addRecord - multiple records added to store and then an error occurs processing on the server', function(assert) {
  //   assert.expect(6);
  //
  //   const pluto = { type: 'planet', id: 'pluto', attributes: { name: 'Pluto' } };
  //   const saturn = { type: 'planet', id: 'saturn', attributes: { name: 'Saturn' } };
  //   const earth = { type: 'planet', id: 'earth', attributes: { name: 'Earth' } };
  //   const jupiter = { type: 'planet', id: 'jupiter', attributes: { name: 'Jupiter' } };
  //
  //   // onAddPlutoRequest(stubbedResponses.plutoAdded);
  //
  //   return all([
  //     store.update(addRecord(pluto)),
  //     store.update(addRecord(saturn)),
  //     store.update(addRecord(earth)),
  //     store.update(addRecord(jupiter))
  //   ])
  //     .then(() => {
  //       assert.equal(store.cache.length(['planet']), 4, '4 records are in the cache');
  //
  //       // verify that the same 4 records are in local storage
  //       verifyLocalStorageContainsRecord(localStorage, pluto);
  //       verifyLocalStorageContainsRecord(localStorage, saturn);
  //       verifyLocalStorageContainsRecord(localStorage, earth);
  //       verifyLocalStorageContainsRecord(localStorage, jupiter);
  //
  //       assert.equal(coordinator.requestQueues['jsonapi'].length, 4, '4 requests are queued for jsonapi source');
  //     });
  // });
  //
  // // test('#update - addRecord - error', function(assert) {
  // //   assert.expect(2);
  // //
  // //   let record = { type: 'planet', attributes: { name: 'Pluto' } };
  // //
  // //   onAddPlutoRequest(stubbedResponses.plutoAddFailed);
  // //
  // //   return store.update(addRecord(record))
  // //     .catch(error => {
  // //       assert.equal(error.responseJSON.errors[0].detail, 'Pluto isn\'t really a planet!');
  // //       verifyLocalStorageDoesNotContainRecord(localStorage, record);
  // //     });
  // // });
  //
  // test('#update - replaceRecord', function(assert) {
  //   assert.expect(2);
  //
  //   const pluto = { type: 'planet', id: 'pluto', attributes: { name: 'Pluto', classification: 'superior' } };
  //   const pluto2 = { type: 'planet', id: 'pluto', keys: { remoteId: 'pluto2' }, attributes: { name: 'Pluto2', classification: 'gas giant' } };
  //
  //   store.cache.patch(
  //     addRecord(pluto)
  //   );
  //
  //   server.respondWith('PATCH', '/planets/pluto', jsonResponse(200, {}));
  //
  //   return store.update(replaceRecord(pluto2))
  //     .then(() => {
  //       assert.equal(store.cache.get(['planet', 'pluto', 'attributes', 'name']), 'Pluto2', 'record matches');
  //       verifyLocalStorageContainsRecord(localStorage, pluto2);
  //     });
  // });
  //
  // test('#update - removeRecord', function(assert) {
  //   assert.expect(3);
  //
  //   const pluto = { type: 'planet', id: 'pluto' };
  //
  //   server.respondWith('DELETE', '/planets/pluto', stubbedResponses.deletePlanet);
  //
  //   store.cache.patch(addRecord(pluto));
  //
  //   return store.update(removeRecord(pluto))
  //     .then(() => {
  //       assert.notOk(store.cache.has(['planet', 'pluto']), 'cache updated');
  //       assert.ok(wasRequested('DELETE', '/planets/pluto'), 'server updated');
  //       verifyLocalStorageDoesNotContainRecord(localStorage, pluto);
  //     });
  // });
  //
  // test('#update - addToHasMany', function(assert) {
  //   assert.expect(2);
  //
  //   const jupiter = { type: 'planet', id: 'jupiter' };
  //   const io = { type: 'moon', id: 'io' };
  //
  //   store.cache.patch([
  //     addRecord(jupiter),
  //     addRecord(io)
  //   ]);
  //
  //   server.respondWith('POST', '/planets/jupiter/relationships/moons', jsonResponse(200, {}));
  //
  //   return store.update(addToHasMany(jupiter, 'moons', io))
  //     .then(() => {
  //       const cacheJupiter = store.cache.get(['planet', 'jupiter']);
  //       assert.deepEqual(cacheJupiter.relationships.moons.data, { 'moon:io': true }, 'cache updated');
  //       assert.ok(wasRequested('POST', '/planets/jupiter/relationships/moons'), 'server updated');
  //     });
  // });
  //
  // test('#update - removeFromHasMany', function(assert) {
  //   assert.expect(2);
  //
  //   const jupiter = { type: 'planet', id: 'jupiter' };
  //   const io = { type: 'moon', id: 'io' };
  //
  //   store.cache.patch([
  //     addRecord(jupiter),
  //     addRecord(io),
  //     addToHasMany(jupiter, 'moons', io)
  //   ]);
  //
  //   server.respondWith('DELETE', '/planets/jupiter/relationships/moons', jsonResponse(200, {}));
  //
  //   return store.update(removeFromHasMany(jupiter, 'moons', io))
  //     .then(() => {
  //       const cacheJupiter = store.cache.get(['planet', 'jupiter']);
  //       assert.deepEqual(cacheJupiter.relationships.moons.data, {}, 'cache updated');
  //       assert.ok(wasRequested('DELETE', '/planets/jupiter/relationships/moons', { data: [{ type: 'moons', id: 'io' }] }), 'server updated');
  //     });
  // });
  //
  // test('#update - replaceHasOne', function(assert) {
  //   assert.expect(2);
  //
  //   const earth = { type: 'planet', id: 'earth' };
  //   const jupiter = { type: 'planet', id: 'jupiter' };
  //   const io = { type: 'moon', id: 'io' };
  //   const requestBody = { data: { id: 'io', type: 'moons', relationships: { planet: { data: { type: 'planets', id: 'earth' } } } } };
  //
  //   store.cache.patch([
  //     addRecord(earth),
  //     addRecord(jupiter),
  //     addRecord(io),
  //     replaceHasOne(io, 'planet', jupiter)
  //   ]);
  //
  //   server.respondWith('PATCH', '/moons/io', jsonResponse(200, {}));
  //
  //   return store.update(replaceHasOne(io, 'planet', earth))
  //     .then(() => {
  //       const cacheIo = store.cache.get(['moon', 'io']);
  //       assert.deepEqual(cacheIo.relationships.planet.data, 'planet:earth', 'updated cache');
  //       assert.ok(wasRequested('PATCH', '/moons/io', requestBody), 'server updated');
  //     });
  // });
  //
  // test('#update - replaceHasMany', function(assert) {
  //   assert.expect(2);
  //
  //   const jupiter = { type: 'planet', id: 'jupiter' };
  //   const io = { type: 'moon', id: 'io' };
  //   const europa = { type: 'moon', id: 'europa' };
  //   const expectedRequestBody = { data: { id: 'jupiter', type: 'planets', relationships: { moons: { data: [{ type: 'moons', id: 'io' }, { type: 'moons', id: 'europa' }] } } } };
  //
  //   store.cache.patch([
  //     addRecord(jupiter),
  //     addRecord(io),
  //     addRecord(europa)
  //   ]);
  //
  //   server.respondWith('PATCH', '/planets/jupiter', jsonResponse(200, {}));
  //
  //   return store.update(replaceHasMany(jupiter, 'moons', [io, europa]))
  //     .then(() => {
  //       const cacheJupiter = store.cache.get(['planet', 'jupiter']);
  //       assert.deepEqual(cacheJupiter.relationships.moons.data, { 'moon:io': true, 'moon:europa': true });
  //       assert.ok(wasRequested('PATCH', '/planets/jupiter', expectedRequestBody), 'server updated');
  //     });
  // });
  //
  // QUnit.skip('replaceKey', function(assert) {
  //   return store.replaceKey({ type: 'planet', id: 'pluto' }, 'remoteId', 'abc1234')
  //     .then(() => {
  //       const record = store.cache.get(['planet', 'pluto']);
  //       assert.equal(record.remoteId, 'abc1234', 'key updated on record');
  //       assert.ok(wasRequested(''));
  //     });
  // });
  //
  // test('find records of a particular type', function(assert) {
  //   assert.expect(1);
  //
  //   const data = [
  //     { type: 'planets', attributes: { name: 'Jupiter', classification: 'gas giant' } }
  //   ];
  //
  //   server.respondWith('GET', '/planets', jsonResponse(200, { data }));
  //
  //   return store.query(qb.records('planet'))
  //     .then(planets => {
  //       assert.deepEqual(Object.keys(planets).map(k => planets[k].attributes.name), ['Jupiter']);
  //     });
  // });
  //
  // test('find an individual record', function(assert) {
  //   assert.expect(3);
  //
  //   const data = { type: 'planets', id: '12345', attributes: { name: 'Jupiter', classification: 'gas giant' } };
  //
  //   server.respondWith('GET', '/planets/12345', jsonResponse(200, { data }));
  //
  //   return store
  //     .query(qb.record({ type: 'planet', id: '12345' }))
  //     .then(record => {
  //       assert.equal(record.type, 'planet');
  //       assert.equal(record.id, '12345');
  //       assert.equal(record.attributes.name, 'Jupiter');
  //     });
  // });
  //
  // test('find records of a particular type using a filter', function(assert) {
  //   assert.expect(1);
  //
  //   const data = [
  //     { type: 'planets', attributes: { name: 'Jupiter', classification: 'gas giant' } }
  //   ];
  //
  //   server.respondWith('GET', `/planets?${encodeURIComponent('filter[name]')}=Jupiter`, jsonResponse(200, { data }));
  //
  //   return store
  //     .query(qb.records('planet')
  //              .filterAttributes({ name: 'Jupiter' }))
  //     .then(planets => {
  //       assert.deepEqual(Object.keys(planets).map(k => planets[k].attributes.name), ['Jupiter']);
  //     });
  // });
});
