import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBus, boardBus, createTransit, leaveBus, readTransit, stops, waitForStop } from './transit.js';

test('board only while near the active stop, then request the next stop while riding', () => {
  const initial = createTransit();
  const { platform: home } = stops.neighborhood;
  assert.equal(boardBus(initial, { x: 0, z: 0 }), initial);
  assert.equal(boardBus(initial, stops.shops.platform), initial);
  const boarded = boardBus(initial, home);
  assert.equal(boarded.aboard, true);
  const trip = advanceBus(boarded, 9_000).transit;
  assert.equal(readTransit(trip).stop, null);
  const requested = leaveBus(trip);
  assert.equal(requested.transit.requested, true);
  assert.deepEqual(createTransit(JSON.parse(JSON.stringify(requested.transit))), requested.transit);
  const almost = advanceBus(requested.transit, 2_799);
  assert.equal(almost.transit.aboard, true);
  assert.equal(almost.dropoff, undefined);
  const arrived = advanceBus(almost.transit, 1);
  assert.equal(arrived.dropoff, 'shops');
  assert.equal(arrived.transit.aboard, false);
});

test('the same line returns to the neighborhood, and riders can leave at a parked stop', () => {
  const initial = createTransit();
  const time = waitForStop(initial, 'shops');
  assert.ok(time > 7_000);
  const parkedAtWork = advanceBus(initial, time).transit;
  assert.equal(readTransit(parkedAtWork).stop, 'shops');
  const ride = boardBus(parkedAtWork, stops.shops.platform);
  assert.equal(leaveBus(ride).dropoff, 'shops');
  const beforeHome = advanceBus(ride, waitForStop(ride, 'neighborhood') - 1).transit;
  assert.equal(readTransit(beforeHome).stop, null);
  const requested = leaveBus(beforeHome).transit;
  assert.equal(advanceBus(requested, 80_000).dropoff, 'neighborhood');
});
