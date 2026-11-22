import test from 'node:test';
import assert from 'node:assert/strict';
import { createLife, closeMonth, dailyWage, monthlyStatement, restoreLife, settlePayroll } from './economy.js';
import { rememberedShift } from './residents.js';
import {
  atWorkCounter, clockIn, customerRoute, employmentStatus, nextCommutePoint, sellToCustomer, shopCustomer,
  stockShop, trackShift, visitHome, workplaceAt, workplaces,
} from './employment.js';

const morning = { night: false, minute: 480 };
const noon = { night: false, minute: 720 };

test('clocking in requires home and the assigned counter, then eight hours of attendance', () => {
  const life = createLife('en-US', () => 0);
  const job = life.employment;
  assert.equal(job.occupation, 'bakery');
  assert.equal(createLife('es-MX', () => 0.999).employment.occupation, 'florist');
  assert.equal(atWorkCounter('bakery', workplaces.florist), false);
  assert.equal(atWorkCounter('bakery', workplaces.bakery), true);
  const wage = dailyWage(life);
  assert.equal(clockIn(job, 1, morning, true), job);
  const leftHome = visitHome(job, 1);
  assert.equal(clockIn(leftHome, 1, noon, true), leftHome);
  assert.equal(clockIn(leftHome, 1, morning, false), leftHome);

  const arrived = clockIn(leftHome, 1, morning, true);
  assert.equal(arrived.stage, 'working');
  assert.equal(trackShift(arrived, 1, 510, 30, false, wage), arrived);
  const almost = trackShift(arrived, 1, 989, 479, true, wage);
  assert.equal(almost.stage, 'working');
  const returning = trackShift(almost, 1, 990, 1, true, wage);
  assert.equal(returning.earned - job.earned, wage);
  assert.equal(returning.pendingPay, wage);
  assert.equal(trackShift(returning, 1, 991, 1, true, wage), returning);
  assert.equal(clockIn(returning, 2, morning, true), returning);
  const finished = visitHome(returning, 1);
  assert.equal(employmentStatus(finished, 1, morning), 'finished');
  assert.equal(employmentStatus(finished, 2, morning), 'startHome');
  assert.equal(employmentStatus(visitHome(finished, 2), 2, morning), 'commute');

  const afterPayday = closeMonth({ ...life, employment: finished });
  assert.equal(afterPayday.lastReceipt.income, job.earned + wage);
  assert.equal(afterPayday.employment.pendingPay, wage);
  assert.equal(monthlyStatement(afterPayday).income, 0);
  assert.equal(afterPayday.employment.stage, 'finished');
});

test('old saves receive a stable occupation and keep their accrued income', () => {
  const { employment, ...oldSave } = createLife('es-MX', () => 0.2);
  const restored = restoreLife(JSON.stringify(oldSave));
  assert.equal(restored.employment.earned, oldSave.income);
  assert.deepEqual(restoreLife(JSON.stringify(restored)), restored);
});

test('a customer walks in, buys prepared stock exactly once, then leaves with the purchase', () => {
  const life = createLife('es-MX', () => 0.99);
  const local = (minute) => ({ minute, night: false });
  const price = 144;
  let job = clockIn(visitHome(life.employment, 2), 2, morning, true);
  const atWork = atWorkCounter(job.occupation, workplaces.florist);
  assert.equal(shopCustomer(job, 2, local(483)).phase, 'entering');
  assert.equal(sellToCustomer(job, 2, local(483), atWork, price), job);
  assert.equal(shopCustomer(job, 2, local(493)).phase, 'entering');
  assert.equal(sellToCustomer(job, 2, local(494), atWork, price), job);
  job = stockShop(job, 2, local(494), atWork);
  assert.equal(sellToCustomer(job, 2, local(495), false, price), job);
  job = sellToCustomer(job, 2, local(495), atWork, price);
  assert.equal(job.shift.stock, 3);
  assert.equal(job.shift.sold, 1);
  assert.equal(job.shift.revenue, price);
  assert.equal(shopCustomer(job, 2, local(496)).bought, true);
  assert.equal(shopCustomer(job, 2, local(496)).phase, 'leaving');
  assert.equal(sellToCustomer(job, 2, local(496), atWork, price), job);
  assert.equal(shopCustomer(job, 2, local(507)), null);
  assert.deepEqual(restoreLife(JSON.stringify({ ...life, employment: job })).employment, job);
});

test('both customers start outdoors and enter either shop through the door before reaching the counter', () => {
  for (const [occupation, { x, z, depth }] of Object.entries(workplaces)) {
    const eva = customerRoute(occupation, 'eva');
    const tomas = customerRoute(occupation, 'tomas');
    assert.notDeepEqual(eva[0], tomas[0]);
    for (const route of [eva, tomas]) {
      assert.equal(workplaceAt(route[0]), undefined);
      assert.deepEqual(route[2], { x, z: z - depth / 2 });
      assert.equal(workplaceAt(route[3]), occupation);
      assert.equal(atWorkCounter(occupation, route.at(-1)), true);
    }
  }
});

test('closing accrues only time worked and payroll pays once after five days', () => {
  const life = createLife('en-US', () => 0);
  const wage = dailyWage(life);
  const started = clockIn(visitHome(life.employment, 5), 5, morning, true);
  const part = trackShift(started, 5, 720, 240, true, wage);
  const finished = trackShift(part, 5, 1080, 360, false, wage);
  const worked = { ...life, employment: finished };
  assert.equal(finished.stage, 'returning');
  assert.equal(finished.pendingPay, Math.floor(wage / 2));
  assert.equal(settlePayroll(worked, 5), worked);
  const deposited = settlePayroll(worked, 6);
  assert.equal(deposited.cash - worked.cash, Math.floor(wage / 2));
  assert.equal(deposited.employment.nextPayday, 11);
  assert.equal(deposited.employment.pendingPay, 0);
  assert.equal(monthlyStatement(deposited).income, Math.floor(wage / 2));
  assert.equal(settlePayroll(restoreLife(JSON.stringify(deposited)), 6).cash, deposited.cash);
  assert.equal(closeMonth(deposited).cash, closeMonth(worked).cash);
  assert.equal(closeMonth(deposited).lastReceipt.shortfall, closeMonth(worked).lastReceipt.shortfall - Math.floor(wage / 2));
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

test('Inés can remember a completed shift after the saved conversation is reloaded', () => {
  const life = createLife('en-US', () => 0);
  assert.equal(rememberedShift(life.employment), null);
  const completed = { ...life.employment, shiftDay: 2, stage: 'finished' };
  const rememberedWork = rememberedShift(completed);
  const saved = { ...life, employment: completed, rememberedWork };
  assert.deepEqual(restoreLife(JSON.stringify(saved)).rememberedWork, { day: 2, occupation: 'bakery' });
});
