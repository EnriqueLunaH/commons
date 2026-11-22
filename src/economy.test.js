import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLife, closeMonth, monthlyStatement, projectFunding, restoreLife, scheduleSale, scheduleWork, transfer,
} from './economy.js';

const newLife = () => createLife('en-US', () => 0);

test('a life starts at an inclusive age from 20 to 70 with a consistent history', () => {
  const youngest = newLife();
  const oldest = createLife('es-MX', () => 0.99999);
  assert.equal(youngest.age, 20);
  assert.equal(youngest.moment, 'breakfast');
  assert.equal(youngest.career, 'shift');
  assert.equal(oldest.age, 70);
  assert.equal(oldest.moment, 'dawn');
  assert.equal(oldest.career, 'mentoring');
  assert.equal(oldest.age - oldest.yearsTrying, 19);
});

test('supplies are paid once and a negative margin on a batch is not taxed', () => {
  const initial = newLife();
  const sale = scheduleSale(initial, 6, 18);
  assert.equal(sale.cash, 57);
  assert.equal(scheduleWork(sale), sale);
  assert.equal(scheduleSale(sale, 3, 10), sale);
  const settled = closeMonth(sale);
  assert.equal(settled.cash, 97);
  assert.equal(settled.lastReceipt.cost, 48);
  assert.equal(settled.lastReceipt.sold, 2);
  assert.equal(settled.lastReceipt.tax, monthlyStatement(initial).tax);
  assert.equal(projectFunding(settled) - projectFunding(initial), settled.lastReceipt.tax);
  assert.equal(settled.moment, 'dinner');
  assert.deepEqual(restoreLife(JSON.stringify(settled)), settled);
});

test('transfers preserve liquid funds and paying debt reduces the next interest charge', () => {
  const initial = newLife();
  const deposited = transfer(initial, 'deposit');
  assert.equal(deposited.cash, 55);
  assert.equal(deposited.savings, 75);
  assert.deepEqual(transfer(deposited, 'withdraw'), initial);
  const paid = transfer(initial, 'payDebt');
  assert.equal(paid.debt, 340);
  assert.equal(monthlyStatement(paid).interest, 7);
  assert.equal(monthlyStatement(initial).interest, 8);
});

test('a repair can create a shortfall, which is covered by debt with cash at zero', () => {
  const life = { ...newLife(), cash: 0, month: 2 };
  const settled = closeMonth(life);
  assert.equal(settled.lastReceipt.incident, 145);
  assert.equal(settled.lastReceipt.shortfall, 141);
  assert.equal(settled.cash, 0);
  assert.equal(settled.debt, 539);
});
