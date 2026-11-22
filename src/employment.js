export const workplaces = {
  bakery: { x: 14.9, z: 8.6, width: 5.4, depth: 4.6, price: 3 },
  florist: { x: 21.1, z: 11.8, width: 5.6, depth: 4.8, price: 9 },
};

export const occupations = Object.keys(workplaces);
const stages = ['idle', 'working', 'returning', 'finished'];
export const shiftLength = 8 * 60;
const workdayEnd = 18 * 60;
export const payInterval = 5;
export const shopCapacity = 4;
const orders = [
  { offset: 2, guest: 'eva', units: 1 },
  { offset: 96, guest: 'tomas', units: 2 },
  { offset: 218, guest: 'eva', units: 2 },
  { offset: 367, guest: 'tomas', units: 1 },
];
const entryMinutes = 12;
const patienceMinutes = 48;
const crossing = 4.8;

export function customerRoute(occupation, guest) {
  const { x, z, depth } = workplaces[occupation];
  const door = z - depth / 2;
  return [
    { x: guest === 'eva' ? 13.1 : 22.1, z: crossing },
    { x, z: crossing },
    { x, z: door },
    { x, z: door + 0.65 },
    { x: x - 0.39, z: z - 0.22 },
  ];
}

export function createEmployment(occupation, earned = 0, day = 1) {
  const nextPayday = day - (day - 1) % payInterval + payInterval;
  return { occupation, earned, pendingPay: earned, nextPayday, homeDay: 0, shiftDay: 0, stage: 'idle', shift: null };
}

export function restoreEmployment(saved, fallback, income, day) {
  if (!saved || !occupations.includes(saved.occupation) || !Number.isSafeInteger(saved.earned) || saved.earned < 0) {
    return createEmployment(fallback, income, day);
  }
  const base = createEmployment(saved.occupation, saved.earned, day);
  const validCounts = ['pendingPay', 'nextPayday', 'homeDay', 'shiftDay']
    .every((key) => Number.isSafeInteger(saved[key]) && saved[key] >= 0);
  if (!validCounts || saved.nextPayday <= 1 || !stages.includes(saved.stage)) {
    return {
      ...base,
      homeDay: Number.isSafeInteger(saved.homeDay) ? Math.max(0, saved.homeDay) : 0,
      shiftDay: Number.isSafeInteger(saved.shiftDay) && ['returning', 'finished'].includes(saved.stage) ? saved.shiftDay : 0,
      stage: ['returning', 'finished'].includes(saved.stage) ? saved.stage : 'idle',
    };
  }
  const { shift } = saved;
  const validShift = shift && Number.isFinite(shift.start) && shift.start >= 360 && shift.start <= workdayEnd - shiftLength
    && Number.isFinite(shift.minutes) && shift.minutes >= 0 && shift.minutes <= shiftLength
    && ['stock', 'sold', 'revenue'].every((key) => Number.isSafeInteger(shift[key]) && shift[key] >= 0)
    && shift.stock <= shopCapacity
    && Number.isInteger(shift.lastOrder) && shift.lastOrder >= -1 && shift.lastOrder < orders.length
    && Number.isFinite(shift.saleMinute);
  return { ...saved, shift: validShift ? shift : null, stage: saved.stage === 'working' && !validShift ? 'idle' : saved.stage };
}

export function workplaceAt({ x, z }) {
  return occupations.find((name) => {
    const place = workplaces[name];
    return Math.abs(x - place.x) < place.width / 2 - 0.08
      && z > place.z - place.depth / 2 + 0.04 && z < place.z + place.depth / 2 - 0.08;
  });
}

export function atWorkCounter(occupation, position) {
  const { x, z } = workplaces[occupation];
  return Boolean(position && workplaceAt(position) === occupation
    && Math.abs(position.x - x) <= 1.45 && Math.abs(position.z - z) <= 1.6);
}

export function commuteRoute(occupation) {
  const { x, z } = workplaces[occupation];
  return [
    { x: 0, z: 1.45 }, { x: 5.31, z: 1.45 }, { x: 9, z: 1.45 },
    { x: 9, z: crossing }, { x, z: crossing }, { x, z },
  ];
}

export function nextCommutePoint(occupation, position, home) {
  const points = commuteRoute(occupation);
  if (home) points.reverse();
  let bestDistance = Infinity;
  let nearest;
  let nextIndex = 1;
  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((position.x - start.x) * dx + (position.z - start.z) * dz) / length ** 2));
    const projection = { x: start.x + t * dx, z: start.z + t * dz };
    const distance = Math.hypot(position.x - projection.x, position.z - projection.z);
    if (distance > bestDistance) continue;
    bestDistance = distance;
    nearest = projection;
    nextIndex = (1 - t) * length < 0.72 ? index + 1 : index;
  }
  return bestDistance > 2.25 ? nearest : points[Math.min(nextIndex, points.length - 1)];
}

export function visitHome(employment, day) {
  if (employment.homeDay === day && employment.stage !== 'returning') return employment;
  return { ...employment, homeDay: day, stage: employment.stage === 'returning' ? 'finished' : employment.stage };
}

export function employmentStatus(employment, day, time) {
  if (employment.stage === 'returning') return 'returning';
  if (employment.shiftDay === day) return employment.stage;
  if (time.night || time.minute >= workdayEnd - shiftLength) return 'closed';
  return employment.homeDay === day ? 'commute' : 'startHome';
}

export function clockIn(employment, day, time, atCounter) {
  if (!atCounter || employmentStatus(employment, day, time) !== 'commute') return employment;
  return {
    ...employment, shiftDay: day, stage: 'working',
    shift: { start: time.minute, minutes: 0, stock: 0, sold: 0, revenue: 0, lastOrder: -1, saleMinute: 0 },
  };
}

export function trackShift(employment, day, minute, elapsed, atWork, wage) {
  if (employment.stage !== 'working') return employment;
  const shift = employment.shift;
  const withinHours = Math.max(0, Math.min(workdayEnd, minute) - Math.max(shift.start, minute - elapsed));
  const minutes = Math.min(shiftLength, shift.minutes + (atWork && day === employment.shiftDay ? withinHours : 0));
  const complete = minutes >= shiftLength - 0.000001;
  if (!complete && day === employment.shiftDay && minute < workdayEnd) {
    return minutes === shift.minutes ? employment : { ...employment, shift: { ...shift, minutes } };
  }
  const pay = complete ? wage : Math.floor(wage * minutes / shiftLength);
  return {
    ...employment, stage: 'returning', earned: employment.earned + pay, pendingPay: employment.pendingPay + pay,
    shift: { ...shift, minutes: complete ? shiftLength : minutes },
  };
}

export function shopCustomer(employment, day, time) {
  if (employment.stage !== 'working' || day !== employment.shiftDay || time.night) return null;
  for (let index = orders.length - 1; index >= 0; index--) {
    const order = orders[index];
    const age = time.minute - employment.shift.start - order.offset;
    if (age < 0) continue;
    const bought = employment.shift.lastOrder === index;
    const leaving = bought ? time.minute - employment.shift.saleMinute : age - entryMinutes - patienceMinutes;
    if (leaving >= entryMinutes) return null;
    if (leaving >= 0) return { ...order, index, bought, progress: Math.max(0, 1 - leaving / entryMinutes), phase: 'leaving' };
    const progress = Math.min(1, age / entryMinutes);
    return { ...order, index, bought, progress, phase: progress === 1 ? 'waiting' : 'entering' };
  }
  return null;
}

export function stockShop(employment, day, time, atCounter) {
  if (!atCounter || employment.stage !== 'working' || employment.shiftDay !== day || time.night
    || employment.shift.stock === shopCapacity) return employment;
  return { ...employment, shift: { ...employment.shift, stock: shopCapacity } };
}

export function sellToCustomer(employment, day, time, atCounter, unitPrice) {
  if (!atCounter) return employment;
  const customer = shopCustomer(employment, day, time);
  const { shift } = employment;
  if (customer?.phase !== 'waiting' || shift.stock < customer.units) return employment;
  return {
    ...employment,
    shift: {
      ...shift, stock: shift.stock - customer.units, sold: shift.sold + customer.units,
      revenue: shift.revenue + customer.units * unitPrice, lastOrder: customer.index, saleMinute: time.minute,
    },
  };
}
