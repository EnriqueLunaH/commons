export const stops = {
  neighborhood: { platform: { x: 9.22, z: -0.35 }, road: { x: 11.45, z: -0.35 } },
  shops: { platform: { x: 18.3, z: 4.22 }, road: { x: 18.3, z: 2.65 } },
};

export const stopIds = Object.keys(stops);
const dwell = 7_000;
const outward = 4_800;
const inward = 18_000;
const shopsArrival = dwell + outward;
const cycle = dwell * 2 + outward + inward;

const point = (x, z) => ({ x, z });
const outwardPath = [
  stops.neighborhood.road, point(11.45, 1.75), point(11.72, 2.35),
  point(12.37, 2.65), stops.shops.road,
];
const inwardPath = [
  stops.shops.road, point(38.7, 2.65), point(39.6, 2.30), point(40, 1.5),
  point(40, -24.65), point(39.6, -25.55), point(38.7, -26),
  point(12.65, -26), point(11.85, -25.60), point(11.45, -24.65), stops.neighborhood.road,
];
export const busRoute = [...outwardPath, ...inwardPath.slice(1)];

function pathSegments(path) {
  return path.slice(1).map((to, i) => {
    const from = path[i];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    return { from, dx, dz, length: Math.hypot(dx, dz), heading: Math.atan2(-dx, -dz) };
  });
}

const outwardSegments = pathSegments(outwardPath);
const inwardSegments = pathSegments(inwardPath);

function samplePath(segments, progress) {
  let remaining = progress * segments.reduce((length, segment) => length + segment.length, 0);
  for (const segment of segments) {
    if (remaining <= segment.length || segment === segments.at(-1)) {
      const step = Math.min(remaining / segment.length, 1);
      return {
        x: segment.from.x + segment.dx * step,
        z: segment.from.z + segment.dz * step,
        heading: segment.heading,
      };
    }
    remaining -= segment.length;
  }
}

export function createTransit(saved) {
  const elapsed = Number.isFinite(saved?.elapsed) && saved.elapsed >= 0 && saved.elapsed < cycle ? saved.elapsed : 0;
  const aboard = saved?.aboard === true;
  return { elapsed, aboard, requested: aboard && saved?.requested === true };
}

export function readTransit({ elapsed }) {
  if (elapsed < dwell) {
    return { ...stops.neighborhood.road, heading: -Math.PI, stop: 'neighborhood', next: 'shops', untilNext: shopsArrival - elapsed };
  }
  if (elapsed < shopsArrival) {
    return {
      ...samplePath(outwardSegments, (elapsed - dwell) / outward),
      stop: null, next: 'shops', untilNext: shopsArrival - elapsed,
    };
  }
  if (elapsed < shopsArrival + dwell) {
    return { ...stops.shops.road, heading: -Math.PI / 2, stop: 'shops', next: 'neighborhood', untilNext: cycle - elapsed };
  }
  return {
    ...samplePath(inwardSegments, (elapsed - shopsArrival - dwell) / inward),
    stop: null, next: 'neighborhood', untilNext: cycle - elapsed,
  };
}

export function nearbyStop(position) {
  if (!position) return undefined;
  return stopIds.find((id) => {
    const { x, z } = stops[id].platform;
    return Math.hypot(x - position.x, z - position.z) <= 2.1;
  });
}

export function waitForStop(transit, stop) {
  const current = readTransit(transit);
  if (current.stop === stop) return 0;
  const begins = stop === 'shops' ? shopsArrival : 0;
  return (begins - transit.elapsed + cycle) % cycle;
}

export function boardBus(transit, position) {
  const stop = nearbyStop(position);
  if (!stop || readTransit(transit).stop !== stop || transit.aboard) return transit;
  return { ...transit, aboard: true };
}

export function leaveBus(transit) {
  if (!transit.aboard) return { transit };
  const { stop } = readTransit(transit);
  if (stop) return { transit: { ...transit, aboard: false, requested: false }, dropoff: stop };
  return { transit: { ...transit, requested: true } };
}

export function advanceBus(transit, elapsed) {
  const before = transit.requested ? readTransit(transit) : null;
  const advanced = { ...transit, elapsed: (transit.elapsed + elapsed) % cycle };
  if (before && elapsed >= before.untilNext) {
    return { transit: { ...advanced, aboard: false, requested: false }, dropoff: before.next };
  }
  return { transit: advanced };
}
