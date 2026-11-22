export const dayDuration = 15 * 60_000;
export const nightDuration = 20 * 60_000;
export const sleepDuration = 5_000;

const cycleDuration = dayDuration + nightDuration;
const dawnMinute = 360;
const duskMinute = 1_080;
const halfDay = duskMinute - dawnMinute;
const startingMinutes = { breakfast: 438, dinner: 1_182, dawn: 266 };

export function createClock(moment, saved) {
  if (saved && Number.isFinite(saved.elapsed) && saved.elapsed >= 0 && saved.elapsed < cycleDuration) {
    const rest = saved.elapsed >= dayDuration && Number.isFinite(saved.rest)
      && saved.rest > 0 && saved.rest <= sleepDuration ? saved.rest : 0;
    return { elapsed: saved.elapsed, rest };
  }

  const minute = startingMinutes[moment];
  if (minute >= dawnMinute && minute < duskMinute) {
    return { elapsed: (minute - dawnMinute) / halfDay * dayDuration, rest: 0 };
  }
  const nightMinutes = (minute - duskMinute + 1_440) % 1_440;
  return { elapsed: dayDuration + nightMinutes / halfDay * nightDuration, rest: 0 };
}

export function readClock(clock) {
  const night = clock.elapsed >= dayDuration;
  const minute = night
    ? duskMinute + (clock.elapsed - dayDuration) / nightDuration * halfDay
    : dawnMinute + clock.elapsed / dayDuration * halfDay;
  return { night, minute: minute % 1_440 };
}

export function startSleep(clock) {
  if (!readClock(clock).night || clock.rest) return clock;
  return { ...clock, rest: sleepDuration };
}

export function advanceClock(clock, elapsed) {
  if (elapsed <= 0) return clock;
  if (clock.rest) {
    if (elapsed < clock.rest) return { ...clock, rest: clock.rest - elapsed };
    return { elapsed: (elapsed - clock.rest) % cycleDuration, rest: 0 };
  }
  return { elapsed: (clock.elapsed + elapsed) % cycleDuration, rest: 0 };
}
