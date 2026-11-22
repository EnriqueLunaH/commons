const speed = 2;
const radius = 0.14;

function canStand(x, z, obstacles, [minX, maxX, minZ, maxZ]) {
  return x >= minX + radius && x <= maxX - radius
    && z >= minZ + radius && z <= maxZ - radius
    && !obstacles.some(([left, right, back, front]) =>
      x > left - radius && x < right + radius && z > back - radius && z < front + radius);
}

export function createWalk(obstacles, limits) {
  let vx = 0;
  let vz = 0;

  return {
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
      if (canStand(nextX, position.z, obstacles, limits)) position.x = nextX;
      else vx = 0;
      const nextZ = position.z + vz * elapsed;
      if (canStand(position.x, nextZ, obstacles, limits)) position.z = nextZ;
      else vz = 0;

      if (!magnitude && Math.hypot(vx, vz) < 0.015) this.stop();
    },
  };
}
