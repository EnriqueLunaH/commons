export const workplaces = {
  bakery: { x: 14.9, z: 8.6, width: 5.4, depth: 4.6 },
  florist: { x: 21.1, z: 11.8, width: 5.6, depth: 4.8 },
};

export const occupations = Object.keys(workplaces);
const stages = ['idle', 'working', 'prepared', 'returning', 'finished'];
const workdayEnd = 12 * 60;
const crossing = 4.8;

export function createEmployment(occupation, earned = 0) {
  return { occupation, earned, homeDay: 0, shiftDay: 0, stage: 'idle' };
}

export function restoreEmployment(saved, fallback, income) {
  if (saved && occupations.includes(saved.occupation) && stages.includes(saved.stage)
    && ['earned', 'homeDay', 'shiftDay'].every((key) => Number.isSafeInteger(saved[key]) && saved[key] >= 0)) return saved;
  return createEmployment(fallback, income);
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
  if (time.night || time.minute >= workdayEnd) return 'closed';
  return employment.homeDay === day ? 'commute' : 'startHome';
}

export function advanceShift(employment, day, time, atWork, wage) {
  if (!atWork) return employment;
  switch (employmentStatus(employment, day, time)) {
    case 'commute': return { ...employment, shiftDay: day, stage: 'working' };
    case 'working': return { ...employment, stage: 'prepared' };
    case 'prepared': return { ...employment, stage: 'returning', earned: employment.earned + wage };
    default: return employment;
  }
}
