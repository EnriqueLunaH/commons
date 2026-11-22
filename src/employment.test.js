import test from 'node:test';
import assert from 'node:assert/strict';
import { createLife, closeMonth, dailyWage, monthlyStatement, restoreLife } from './economy.js';
import {
  advanceShift, atWorkCounter, employmentStatus, nextCommutePoint, visitHome, workplaces,
} from './employment.js';

const morning = { night: false, minute: 480 };
const noon = { night: false, minute: 720 };

test('one morning shift requires home and the assigned counter, then pays once and requires returning home', () => {
  const life = createLife('en-US', () => 0);
  const job = life.employment;
  assert.equal(job.occupation, 'bakery');
  assert.equal(createLife('es-MX', () => 0.999).employment.occupation, 'florist');
  assert.equal(atWorkCounter('bakery', workplaces.florist), false);
  assert.equal(atWorkCounter('bakery', workplaces.bakery), true);
  const wage = dailyWage(life);
  assert.equal(advanceShift(job, 1, morning, true, wage), job);
  const leftHome = visitHome(job, 1);
  assert.equal(advanceShift(leftHome, 1, noon, true, wage), leftHome);
  assert.equal(advanceShift(leftHome, 1, morning, false, wage), leftHome);

  const arrived = advanceShift(leftHome, 1, morning, true, wage);
  assert.equal(arrived.stage, 'working');
  const prepared = advanceShift(arrived, 1, morning, true, wage);
  assert.equal(prepared.stage, 'prepared');
  const returning = advanceShift(prepared, 1, morning, true, wage);
  assert.equal(returning.earned - job.earned, wage);
  assert.equal(advanceShift(returning, 1, morning, true, wage), returning);
  assert.equal(advanceShift(returning, 2, morning, true, wage), returning);
  const finished = visitHome(returning, 1);
  assert.equal(employmentStatus(finished, 1, morning), 'finished');
  assert.equal(employmentStatus(finished, 2, morning), 'startHome');
  assert.equal(employmentStatus(visitHome(finished, 2), 2, morning), 'commute');

  const afterPayday = closeMonth({ ...life, employment: finished });
  assert.equal(afterPayday.lastReceipt.income, job.earned + wage);
  assert.equal(monthlyStatement(afterPayday).income, 0);
  assert.equal(afterPayday.employment.stage, 'finished');
});

test('old saves receive a stable occupation and keep their accrued income', () => {
  const { employment, ...oldSave } = createLife('es-MX', () => 0.2);
  const restored = restoreLife(JSON.stringify(oldSave));
  assert.equal(restored.employment.earned, oldSave.income);
  assert.deepEqual(restoreLife(JSON.stringify(restored)), restored);
});

test('a florist clocks in at the flower shop and can finish the assigned shift', () => {
  const life = createLife('es-MX', () => 0.99);
  const wage = dailyWage(life);
  let job = visitHome(life.employment, 2);
  const atWork = atWorkCounter(job.occupation, workplaces.florist);
  for (let action = 0; action < 3; action++) job = advanceShift(job, 2, morning, atWork, wage);
  assert.equal(job.stage, 'returning');
  assert.equal(job.earned, life.employment.earned + wage);
  assert.equal(visitHome(job, 2).stage, 'finished');
});

test('the commute follows the corners from the original house to either shop in both directions', () => {
  for (const [occupation, { x, z }] of Object.entries(workplaces)) {
    assert.deepEqual(nextCommutePoint(occupation, { x: 0, z: 1.45 }, false), { x: 5.31, z: 1.45 });
    assert.deepEqual(nextCommutePoint(occupation, { x: 9, z: 4.8 }, false), { x, z: 4.8 });
    assert.deepEqual(nextCommutePoint(occupation, { x, z: 4.8 }, false), { x, z });
    assert.deepEqual(nextCommutePoint(occupation, { x, z }, true), { x, z: 4.8 });
    assert.deepEqual(nextCommutePoint(occupation, { x: 9, z: 4.8 }, true), { x: 9, z: 1.45 });
  }
});
