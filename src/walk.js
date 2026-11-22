const speed = 2;
const radius = 0.14;
const cellWidth = 24;

export function createWalk(obstacles, limits) {
  const [minX, maxX, minZ, maxZ] = limits;
  const cells = new Map();
  for (const [left, right, back, front] of obstacles) {
    const expanded = [left - radius, right + radius, back - radius, front + radius];
    for (let x = Math.floor(expanded[0] / cellWidth); x <= Math.floor(expanded[1] / cellWidth); x++) {
      for (let z = Math.floor(expanded[2] / cellWidth); z <= Math.floor(expanded[3] / cellWidth); z++) {
        const cell = x + ':' + z;
        if (!cells.has(cell)) cells.set(cell, []);
        cells.get(cell).push(expanded);
      }
    }
  }

  function canStand(x, z) {
    if (x < minX + radius || x > maxX - radius || z < minZ + radius || z > maxZ - radius
      || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    const cell = Math.floor(x / cellWidth) + ':' + Math.floor(z / cellWidth);
    return !cells.get(cell)?.some(([left, right, back, front]) => x > left && x < right && z > back && z < front);
  }

  let vx = 0;
  let vz = 0;

  return {
    canStand,
    stop() {
      vx = 0;
      vz = 0;
    },

    step(position, yaw, elapsed, forward, right) {
      const magnitude = Math.hypot(forward, right);
      if (!magnitude && !vx && !vz) return;

      const pace = speed / Math.max(magnitude, 1);
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const targetX = (cos * right - sin * forward) * pace;
      const targetZ = (-cos * forward - sin * right) * pace;
      const response = 1 - Math.exp(-(magnitude ? 15 : 25) * elapsed);
      vx += (targetX - vx) * response;
      vz += (targetZ - vz) * response;

      // Resolve each axis so a wall stops forward progress without blocking sideways motion.
      const nextX = position.x + vx * elapsed;
      if (canStand(nextX, position.z)) position.x = nextX;
      else vx = 0;
      const nextZ = position.z + vz * elapsed;
      if (canStand(position.x, nextZ)) position.z = nextZ;
      else vz = 0;

      if (!magnitude && Math.hypot(vx, vz) < 0.015) this.stop();
    },
  };
}
