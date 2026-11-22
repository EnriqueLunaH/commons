import * as THREE from 'three';
import { cityBlockAt } from './city-layout.js';
import { workplaceAt } from './employment.js';

export function neighborhoodZone({ x, z }) {
  if (Math.abs(x) < 5.31 && z > -4.82 && z < 5.04) return 'home';
  const workplace = workplaceAt({ x, z });
  if (workplace) return workplace;
  if (x > 12.8 && x < 24 && z > -11.6 && z < 1.75) return 'park';
  return cityBlockAt(x, z)?.zone ?? 'residential';
}

export function buildNeighborhood({ scene, box, cylinder, oval, object, colors: C }) {
  const obstacles = [];
  const path = 0xc2af93;
  const gravel = 0xcdb794;
  box(4.0, 0.028, 1.54, 7.14, -0.076, 1.45, path, 0);
  box(1.6, 0.028, 76, 9.0, -0.077, 12, path, 0);
  box(3.3, 0.025, 76, 11.45, -0.079, 12, 0x93918a, 0);
  box(20.5, 0.028, 1.65, -0.39, -0.078, -7.4, path, 0);
  box(9.1, 0.029, 1.8, 13.5, -0.073, -5.8, path, 0);
  box(11, 0.025, 1.6, 19, -0.078, -12.6, path, 0);
  box(14.2, 0.026, 1.56, 27.2, -0.073, -3.8, path, 0);
  box(7.6, 0.025, 1.56, 49.5, -0.027, -3.8, gravel, 0);
  for (let i = 0; i < 11; i++) {
    box(0.56, 0.019, 1.02, 34.69 + i * 1.01, -0.069, -3.8, 0xe5d6b6, 0);
  }
  for (let i = 0; i < 8; i++) {
    box(0.27, 0.014, 0.95, 10 + i * 0.39, -0.053, -5.8, 0xddd0b9, 0);
  }

  function footprint(x, z, w, d) {
    obstacles.push([x - w / 2, x + w / 2, z - d / 2, z + d / 2]);
  }

  function roof(x, z, width, depth, height, color, walls) {
    const half = width / 2 + 0.17;
    const angle = 0.34;
    const base = height + 0.06;
    for (const side of [-1, 1]) {
      const slope = box(half / Math.cos(angle), 0.15, depth + 0.47,
        x + side * half / 2, base + Math.tan(angle) * half / 2, z, color, 0.055);
      slope.rotation.z = -side * angle;
    }
    box(0.115, 0.14, depth + 0.50, x, base + Math.tan(angle) * half, z, color, 0.052);
    const gable = new THREE.Shape();
    gable.moveTo(-width / 2, -0.15);
    gable.lineTo(width / 2, -0.15);
    gable.lineTo(0, Math.tan(angle) * width / 2 + 0.02);
    gable.closePath();
    object(new THREE.ExtrudeGeometry(gable, { depth: depth - 0.012, bevelEnabled: false }),
      walls, x, height, z - depth / 2 + 0.006);
  }

  roof(0, 0, 10.81, 10.2, 3.67, 0x835847, C.cream);
  box(0.62, 1.34, 0.84, -3.48, 4.61, -2.23, C.clay, 0.054);
  box(0.78, 0.13, 1.0, -3.48, 5.26, -2.23, 0x825847, 0.048);

  function house({ x, z, walls, tile, door, width = 3.65, depth = 3.3 }) {
    const height = 2.85;
    const front = z + depth / 2;
    box(width, height, depth, x, height / 2 - 0.086, z, walls, 0.07);
    box(width + 0.12, 0.20, depth + 0.12, x, 0.025, z, C.trim);
    roof(x, z, width, depth, height, tile, walls);
    box(0.42, 0.96, 0.50, x + width * 0.24, 3.21, z - 0.55, C.clay);
    box(0.52, 0.12, 0.62, x + width * 0.24, 3.66, z - 0.55, tile);
    const doorX = x - width * 0.22;
    box(0.85, 1.79, 0.13, doorX, 0.83, front + 0.03, C.trim, 0.06);
    box(0.70, 1.68, 0.13, doorX, 0.78, front + 0.09, door, 0.04);
    oval(doorX + 0.21, 0.82, front + 0.165, 0.04, 0.04, 0.037, C.brass);
    box(1.01, 0.12, 0.50, doorX, 0.0, front + 0.24, C.trim);
    box(0.95, 0.97, 0.078, x + width * 0.23, 1.54, front + 0.02, C.white);
    box(0.78, 0.80, 0.045, x + width * 0.23, 1.54, front + 0.068, C.blue);
    box(0.045, 0.82, 0.055, x + width * 0.23, 1.54, front + 0.094, C.white, 0);
    box(0.82, 0.045, 0.055, x + width * 0.23, 1.54, front + 0.094, C.white, 0);
    box(1.02, 0.095, 0.22, x + width * 0.23, 1.04, front + 0.087, C.wood);
    const side = x - width / 2;
    box(0.10, 0.82, 0.87, side, 1.55, z, C.white);
    box(0.06, 0.67, 0.72, side - 0.053, 1.55, z, C.blue);
    box(0.07, 0.69, 0.046, side - 0.086, 1.55, z, C.white, 0);
    box(0.22, 0.09, 0.95, side - 0.07, 1.115, z, C.wood);
    footprint(x, z, width, depth);
  }

  [
    { x: -7.15, z: -12.8, walls: 0xd2b58d, tile: 0x965c4c, door: C.green },
    { x: -2.45, z: -14.9, walls: 0xdcc4a4, tile: 0x756f58, door: C.clay },
    { x: 2.95, z: -13.7, walls: 0xcbb390, tile: 0xa36d54, door: C.blue, width: 4.05 },
    { x: 7.2, z: -17.5, walls: 0xc5b995, tile: 0x896153, door: C.green },
    { x: 15.2, z: -16.1, walls: 0xd2be9f, tile: 0x956756, door: C.blue },
    { x: 20.7, z: -16.8, walls: 0xd4b28f, tile: 0x737962, door: C.clay, width: 4.15 },
    { x: 26.6, z: -6.72, walls: 0xd6ba99, tile: 0xa16d56, door: C.green },
    { x: 27, z: -0.62, walls: 0xe0c3a2, tile: 0x7e8369, door: C.blue },
    { x: 25.5, z: 5.6, walls: 0xdac3a9, tile: 0xa06b50, door: C.green },
  ].forEach(house);

  function tree(x, z, size, shade) {
    cylinder(0.084 * size, 0.172 * size, 2.19 * size, x, 1.01 * size, z, C.darkWood);
    oval(x, 2.63 * size, z, 0.97 * size, 1.43 * size, 0.81 * size, shade);
    oval(x + 0.53 * size, 2.3 * size, z - 0.27 * size, 0.74 * size, 0.81 * size, 0.65 * size, shade);
    oval(x - 0.38 * size, 2.02 * size, z + 0.37 * size, 0.59 * size, 0.64 * size, 0.60 * size, shade);
    footprint(x, z, 0.34 * size, 0.34 * size);
  }

  for (const [x, z, size, shade] of [
    [-6.8, -6.5, 0.95, 0x727e55], [-4.2, -9.9, 1.15, 0x7c8462], [0.5, -10.6, 1.0, 0x738862],
    [5.69, -9.75, 1.25, 0x85814f], [6.92, 4.3, 0.8, 0x6f845d],
    [14.6, -9.9, 1.16, 0x6f865f], [21.9, -8.5, 1.29, 0x8b8a56],
    [14.8, -1.16, 0.88, 0x8e8d5d], [21.65, -1.9, 1.07, 0x707f5d],
    [25.3, -10.5, 1.15, 0x788762], [24.85, -2.55, 1.13, 0x7e875d],
    [-8.9, -17.7, 1.45, 0x8b9067], [19.23, -20.72, 1.55, 0x818a65],
  ]) tree(x, z, size, shade);

  for (const [x, z, tone] of [[13.8, -8.65, 0x7f885e], [22.6, -9.55, 0x85865c], [22.5, -4.95, 0x798461],
    [24.5, 0.4, 0x7b8861], [24.1, -8.9, 0x8b8b5b], [25.2, -2.5, 0x7d8867]]) {
    oval(x, 0.23, z, 0.58, 0.44, 0.46, tone);
    oval(x + 0.38, 0.18, z - 0.16, 0.43, 0.36, 0.35, tone);
    footprint(x + 0.15, z, 0.85, 0.69);
  }

  // The crossing leads to the park's loop and central fountain.
  const fx = 18.26;
  const fz = -5.8;
  cylinder(3.75, 3.75, 0.022, fx, -0.075, fz, gravel);
  box(1.25, 0.026, 12.5, fx, -0.072, -5.2, gravel, 0);
  box(7.25, 0.026, 1.70, 16.27, -0.070, fz, gravel, 0);
  cylinder(1.19, 1.29, 0.20, fx, 0.033, fz, 0xa2a08a);
  const basin = object(new THREE.TorusGeometry(1.07, 0.15, 12, 48), 0xb7b098, fx, 0.21, fz);
  basin.rotation.x = -Math.PI / 2;
  const water = cylinder(0.99, 0.99, 0.036, fx, 0.169, fz, 0x719096);
  water.material = water.material.clone();
  water.material.roughness = 0.37;
  cylinder(0.12, 0.29, 0.75, fx, 0.53, fz, 0xaeaa92);
  cylinder(0.34, 0.15, 0.08, fx, 0.88, fz, 0xbbbaa4);
  oval(fx, 0.999, fz, 0.066, 0.16, 0.066, 0xadc0bd);
  const ripples = [-1, 0, 1].map((direction, index) => {
    const ring = object(new THREE.TorusGeometry(0.27 + index * 0.23, 0.008, 6, 32),
      0xc5d0bd, fx + direction * 0.015, 0.192, fz);
    ring.rotation.x = -Math.PI / 2;
    ring.castShadow = false;
    return ring;
  });
  footprint(fx, fz, 2.46, 2.46);

  function bench(x, z, angle) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = angle;
    scene.add(group);
    for (const leg of [-0.52, 0.52]) {
      box(0.075, 0.40, 0.42, leg, 0.14, 0, C.charcoal, 0.024, group);
      box(0.069, 0.50, 0.081, leg, 0.54, -0.2, C.charcoal, 0.014, group);
    }
    for (const plank of [-0.12, 0.02, 0.16]) box(1.44, 0.07, 0.12, 0, 0.36, plank, C.wood, 0.032, group);
    for (const y of [0.64, 0.79]) box(1.44, 0.13, 0.061, 0, y, -0.20, C.wood, 0.02, group);
    footprint(x, z, 1.5, 0.53);
  }

  bench(16.18, -8.4, 0);
  bench(20.38, -3.43, Math.PI);

  for (const [x, z, tone] of [[15.1, -3.16, C.clay], [20.98, -5.38, 0xdcb06e], [19.77, -9.4, 0xc7897b]]) {
    cylinder(0.65, 0.63, 0.04, x, -0.062, z, 0x75835f);
    for (let i = 0; i < 7; i++) {
      const dx = Math.sin(i * 2.39) * (0.12 + 0.058 * i);
      const dz = Math.cos(i * 2.39) * (0.12 + 0.058 * i);
      const stem = 0.12 + i % 3 * 0.054;
      cylinder(0.012, 0.016, stem, x + dx, stem / 2 - 0.02, z + dz, C.green);
      oval(x + dx, stem - 0.02, z + dz, 0.067, 0.045, 0.067, tone);
    }
  }

  cylinder(0.047, 0.076, 2.55, 2.98, 1.15, -7.85, C.charcoal);
  box(0.36, 0.39, 0.34, 2.98, 2.43, -7.85, C.charcoal);
  const lantern = box(0.27, 0.21, 0.35, 2.98, 2.41, -7.85, C.brass);
  lantern.material = lantern.material.clone();
  const streetLight = new THREE.PointLight(0xffc36b, 0, 7, 2);
  streetLight.position.set(2.98, 2.35, -7.85);
  scene.add(streetLight);
  footprint(2.98, -7.85, 0.20, 0.20);

  return { obstacles, lantern, streetLight, ripples };
}
