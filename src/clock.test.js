import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceClock, createClock, dayDuration, nightDuration, readClock, sleepDuration, startSleep } from './clock.js';

const dawn = { elapsed: 0, rest: 0, day: 1 };

test('day lasts 15 minutes and the full natural night lasts 20 minutes', () => {
  assert.equal(dayDuration, 900_000);
  assert.equal(nightDuration, 1_200_000);
  assert.equal(readClock(advanceClock(dawn, dayDuration - 1)).night, false);
  const dusk = advanceClock(dawn, dayDuration);
  assert.deepEqual(readClock(dusk), { night: true, minute: 1080 });
  assert.equal(readClock(advanceClock(dusk, nightDuration - 1)).night, true);
  assert.deepEqual(advanceClock(dusk, nightDuration), { ...dawn, day: 2 });
});

test('sleep is available at night and reaches dawn after five real seconds', () => {
  assert.equal(startSleep(dawn), dawn);
  const resting = startSleep(createClock('dinner'));
  assert.equal(resting.rest, 5_000);
  const almost = advanceClock(resting, sleepDuration - 1);
  assert.equal(almost.rest, 1);
  assert.equal(readClock(almost).night, true);
  assert.deepEqual(advanceClock(almost, 1), { ...dawn, day: 2 });
  assert.deepEqual(advanceClock(resting, sleepDuration + 10), { elapsed: 10, rest: 0, day: 2 });
});

test('legacy saves start at the original meal time and new saves restore the clock', () => {
  for (const [moment, minute, night] of [
    ['breakfast', 438, false], ['dinner', 1182, true], ['dawn', 266, true],
  ]) {
    const start = createClock(moment);
    assert.equal(readClock(start).night, night);
    assert.ok(Math.abs(readClock(start).minute - minute) < 0.00001);
  }
  const saved = advanceClock(startSleep(createClock('dinner')), 2_300);
  assert.deepEqual(createClock('breakfast', saved), saved);
  assert.deepEqual(createClock('breakfast', { elapsed: -10 }), createClock('breakfast'));
});
