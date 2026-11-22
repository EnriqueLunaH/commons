import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLife, closeMonth, monthlyStatement, payBusFare, projectFunding, restoreLife, scheduleSale, scheduleWork, transfer,
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
  assert.equal(settled.moment, initial.moment);
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

test('the rent and split utility bills add up to the essentials and monthly expenses', () => {
  for (const locale of ['es-MX', 'en-US']) {
    for (const draw of [0, 0.5, 0.99]) {
      const life = createLife(locale, () => draw);
      const bill = monthlyStatement(life);
      assert.equal(bill.housing, life.housing);
      assert.equal(bill.electricity + bill.water + bill.internet, life.utilities);
      assert.equal(bill.essentials, bill.housing + bill.food + life.utilities);
      assert.equal(bill.pendingIncome - bill.expenses, bill.margin);
    }
  }
});

test('each paid ride reduces cash and monthly margin once, and survives a reload', () => {
  const initial = createLife('es-MX', () => 0);
  const baseline = monthlyStatement(initial);
  const rode = payBusFare(payBusFare(initial));
  assert.equal(rode.cash, initial.cash - 24);
  assert.equal(monthlyStatement(rode).margin, baseline.margin - 24);
  assert.equal(monthlyStatement(rode).expenses, baseline.expenses + 24);
  assert.deepEqual(restoreLife(JSON.stringify(rode)), rode);
  const settled = closeMonth(rode);
  assert.equal(settled.cash, baseline.balance - 24);
  assert.equal(settled.lastReceipt.transitSpent, 24);
  assert.equal(monthlyStatement(settled).transitSpent, 0);
});

test('a fare needs enough available cash and old saves begin with zero fares', () => {
  const { transitSpent, ...oldSave } = newLife();
  const rider = restoreLife(JSON.stringify({ ...oldSave, cash: 2 }));
  assert.equal(rider.transitSpent, 0);
  const paid = payBusFare(rider);
  assert.equal(paid.cash, 0);
  assert.equal(paid.transitSpent, 2);
  assert.equal(payBusFare(paid), paid);
});
