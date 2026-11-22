import { createEmployment, occupations, payInterval, restoreEmployment } from './employment.js';

export const regions = {
  'es-MX': { currency: 'MXN', scale: 16, fare: 12 },
  'en-US': { currency: 'USD', scale: 1, fare: 2 },
};

const households = [
  { cash: 105, savings: 25, debt: 390, income: 910, housing: 485, food: 225, utilities: 105 },
  { cash: 360, savings: 190, debt: 280, income: 1480, housing: 730, food: 265, utilities: 145 },
  { cash: 740, savings: 620, debt: 120, income: 2200, housing: 980, food: 320, utilities: 185 },
];

export const moments = ['breakfast', 'dinner', 'dawn'];
export const lotSizes = [3, 6];
export const basePrices = [10, 14, 18];
export const interestRate = 2;

export function createLife(locale, random = Math.random) {
  const draw = (length) => Math.floor(random() * length);
  const age = 20 + draw(51);
  const gender = ['woman', 'man'][draw(2)];
  const household = draw(households.length);
  const moment = moments[draw(moments.length)];
  const yearsTrying = 1 + draw(age - 19);
  const { scale } = regions[locale];
  const resources = Object.fromEntries(
    Object.entries(households[household]).map(([key, amount]) => [key, amount * scale]),
  );
  const career = age < 30 ? 'shift' : age < 60 ? 'contract' : 'mentoring';
  const occupation = occupations[draw(occupations.length)];

  return {
    version: 1, locale, age, gender, household, moment, yearsTrying, career,
    ...resources,
    employment: createEmployment(occupation),
    month: 1,
    contributed: 0,
    transitSpent: 0,
    activity: null,
    lastReceipt: null,
  };
}

export function shiftPay(life) {
  const { scale } = regions[life.locale];
  return { shift: 120, contract: 175, mentoring: 150 }[life.career] * scale;
}

export function dailyWage(life) {
  const { scale } = regions[life.locale];
  return Math.max(1, Math.round(life.income / scale / 20)) * scale;
}

export function marketOffer(life, units, basePrice) {
  const { scale } = regions[life.locale];
  const demand = { 10: 6, 14: 4, 18: 2 }[basePrice];
  const sold = Math.min(units, demand);
  const cost = units * 8 * scale;
  const revenue = sold * basePrice * scale;
  return { kind: 'sale', units, sold, cost, revenue, price: basePrice * scale };
}

export function scheduleSale(life, units, basePrice) {
  if (life.activity || !lotSizes.includes(units) || !basePrices.includes(basePrice)) return life;
  const offer = marketOffer(life, units, basePrice);
  if (offer.cost > life.cash) return life;
  return { ...life, activity: offer, cash: life.cash - offer.cost };
}

export function scheduleWork(life) {
  if (life.activity) return life;
  return { ...life, activity: { kind: 'work', pay: shiftPay(life) } };
}

export function transfer(life, action) {
  const step = 50 * regions[life.locale].scale;
  if (action === 'deposit') {
    const amount = Math.min(life.cash, step);
    return { ...life, cash: life.cash - amount, savings: life.savings + amount };
  }
  if (action === 'withdraw') {
    const amount = Math.min(life.savings, step);
    return { ...life, cash: life.cash + amount, savings: life.savings - amount };
  }
  if (action === 'payDebt') {
    const amount = Math.min(life.cash, life.debt, step);
    return { ...life, cash: life.cash - amount, debt: life.debt - amount };
  }
  return life;
}

export function projectGoal(life) {
  return 355 * regions[life.locale].scale;
}

export function projectFunding(life) {
  return 95 * regions[life.locale].scale + life.contributed;
}

export function payBusFare(life) {
  const { fare } = regions[life.locale];
  if (life.cash < fare) return life;
  return { ...life, cash: life.cash - fare, transitSpent: life.transitSpent + fare };
}

export function settlePayroll(life, day) {
  const { nextPayday, pendingPay } = life.employment;
  if (day < nextPayday) return life;
  const payday = day - (day - 1) % payInterval;
  return {
    ...life,
    cash: life.cash + pendingPay,
    employment: { ...life.employment, pendingPay: 0, nextPayday: payday + payInterval },
    lastPayroll: pendingPay ? { day: payday, amount: pendingPay } : life.lastPayroll ?? null,
  };
}

export function monthlyStatement(life) {
  const income = life.employment.earned;
  const workPay = life.activity?.kind === 'work' ? life.activity.pay : 0;
  const sale = life.activity?.kind === 'sale' ? life.activity : null;
  const sales = sale?.revenue ?? 0;
  const cost = sale?.cost ?? 0;
  const taxable = income + workPay + Math.max(0, sales - cost);
  const tax = Math.floor(taxable / 10);
  const interest = Math.round(life.debt * interestRate / 100);
  const incident = life.month % 3 === 2 ? 145 * regions[life.locale].scale : 0;
  const electricity = Math.floor(life.utilities * 0.38);
  const water = Math.floor(life.utilities * 0.24);
  const internet = life.utilities - electricity - water;
  const essentials = life.housing + life.food + life.utilities;
  const transitSpent = life.transitSpent;
  const pendingIncome = income + workPay + sales;
  const expenses = essentials + incident + tax + interest + cost + transitSpent;
  // The paycheck uses its own schedule. Supplies and fares already reduced cash.
  const afterBills = life.cash + workPay + sales - essentials - incident - tax;

  return {
    month: life.month, income, workPay, sales, cost, sold: sale?.sold ?? 0, prepared: sale?.units ?? 0,
    housing: life.housing, food: life.food, utilities: life.utilities, electricity, water, internet,
    incident, tax, interest, transitSpent, essentials, expenses, pendingIncome,
    shortfall: Math.max(0, -afterBills), balance: Math.max(0, afterBills),
    margin: pendingIncome - expenses,
  };
}

export function closeMonth(life) {
  const receipt = monthlyStatement(life);
  return {
    ...life,
    cash: receipt.balance,
    debt: life.debt + receipt.interest + receipt.shortfall,
    contributed: life.contributed + receipt.tax,
    month: life.month + 1,
    transitSpent: 0,
    activity: null,
    employment: { ...life.employment, earned: 0 },
    lastReceipt: receipt,
  };
}

export function restoreLife(raw) {
  try {
    const life = JSON.parse(raw);
    if (life?.version === 1 && Object.hasOwn(regions, life.locale)
      && moments.includes(life.moment)
      && Number.isInteger(life.age) && life.age >= 20 && life.age <= 70
      && Number.isInteger(life.yearsTrying) && life.yearsTrying > 0 && life.yearsTrying <= life.age - 19
      && ['woman', 'man'].includes(life.gender)
      && [0, 1, 2].includes(life.household)
      && ['shift', 'contract', 'mentoring'].includes(life.career)
      && Number.isInteger(life.month) && life.month > 0
      && ['cash', 'savings', 'debt', 'income', 'housing', 'food', 'utilities', 'contributed']
        .every((key) => Number.isSafeInteger(life[key]) && life[key] >= 0)) {
      const index = (life.age + life.household + Number(life.gender === 'woman')) % occupations.length;
      return {
        ...life,
        transitSpent: Number.isSafeInteger(life.transitSpent) && life.transitSpent >= 0 ? life.transitSpent : 0,
        employment: restoreEmployment(
          life.employment, occupations[index], life.income,
          Number.isSafeInteger(life.clock?.day) && life.clock.day >= 1 ? life.clock.day : 1,
        ),
      };
    }
  } catch {
    // A browser can restore a previously interrupted or invalid save.
  }
  return null;
}
