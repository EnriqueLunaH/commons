import * as THREE from 'three';
import { blocksPerSide, blockSize, cityBlocks, cityLimits, mainStreets } from './city-layout.js';

const pavement = 0xc7b49a;
const grass = 0x8d916e;
const gravel = 0xd9c29d;
const brick = 0xa78672;
const trunk = 0x735443;
const foliage = [0x71865a, 0x849260, 0x79916b, 0x8b8d56];
const tileSize = blockSize * 4;

function windowMaterial(floors) {
  const paint = document.createElement('canvas');
  const glow = document.createElement('canvas');
  paint.width = glow.width = 128;
  paint.height = glow.height = 256;
  const ink = paint.getContext('2d');
  const light = glow.getContext('2d');
  light.fillStyle = '#000';
  light.fillRect(0, 0, 128, 256);
  const bays = floors >= 7 ? 5 : 4;
  const rowHeight = 256 / floors;

  for (let row = 0; row < floors; row++) {
    for (let bay = 0; bay < bays; bay++) {
      const step = 128 / bays;
      const x = (bay + 0.19) * step;
      const y = (row + 0.20) * rowHeight;
      const w = step * 0.62;
      const h = rowHeight * 0.54;
      const lit = (bay * 11 + row * 7 + floors) % 8 < 2;
      ink.fillStyle = '#ded3bb';
      ink.fillRect(x - 1, y - 1, w + 2, h + 2);
      ink.fillStyle = lit ? '#8a8b7b' : '#58696a';
      ink.fillRect(x, y, w, h);
      ink.fillStyle = '#b6b09e';
      ink.fillRect(x + w * 0.49, y, 1, h);
      ink.fillRect(x - 1.4, y + h, w + 2.8, 1.2);
      if (lit) {
        light.fillStyle = '#ffd48d';
        light.fillRect(x, y, w, h);
      }
    }
  }

  const map = new THREE.CanvasTexture(paint);
  const emissiveMap = new THREE.CanvasTexture(glow);
  map.colorSpace = emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map, emissiveMap, emissive: 0xffbc78, emissiveIntensity: 0,
    alphaTest: 0.43, roughness: 0.92,
  });
}

export function buildCity(scene, paper) {
  const obstacles = [];
  const [west, east, north, south] = cityLimits;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const oval = new THREE.SphereGeometry(0.5, 10, 7);
  const plane = new THREE.PlaneGeometry(1, 1);
  const gable = new THREE.Shape();
  gable.moveTo(-0.5, 0);
  gable.lineTo(0.5, 0);
  gable.lineTo(0, 1);
  gable.closePath();
  const roof = new THREE.ExtrudeGeometry(gable, { depth: 1, bevelEnabled: false });
  roof.translate(0, 0, -0.5);
  const solid = new THREE.MeshStandardMaterial({ map: paper, roughness: 0.96 });
  const streetGlass = new THREE.MeshStandardMaterial({ color: 0xd6c5a8, emissive: 0xffc376, emissiveIntensity: 0 });
  const glazing = new Map();
  const proxy = new THREE.Object3D();
  const tone = new THREE.Color();

  function batch(entries, shape, material = solid, receives = false) {
    if (!entries.length) return null;
    const mesh = new THREE.InstancedMesh(shape, material, entries.length);
    for (const [index, entry] of entries.entries()) {
      const [x, y, z, w, h, d, color, angle = 0] = entry;
      proxy.position.set(x, y, z);
      proxy.rotation.set(0, angle, 0);
      proxy.scale.set(w, h, d);
      proxy.updateMatrix();
      mesh.setMatrixAt(index, proxy.matrix);
      if (color !== undefined) mesh.setColorAt(index, tone.set(color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = receives;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    return mesh;
  }

  const ground = new THREE.Mesh(box, solid);
  ground.position.set((west + east) / 2, -0.188, (north + south) / 2);
  ground.scale.set(east - west + 360, 0.14, south - north + 360);
  ground.material = solid.clone();
  ground.material.color.set(grass);
  ground.receiveShadow = true;
  scene.add(ground);

  const roads = [];
  const origin = cityBlocks[0];
  const first = -blocksPerSide / 2;
  for (let index = 0; index <= blocksPerSide; index++) {
    const major = mainStreets(first + index);
    const width = major ? 11.6 : 7.6;
    const surface = major ? 0x8c8a82 : 0x9a9489;
    roads.push([origin.x - blockSize / 2 + index * blockSize, -0.102, (north + south) / 2,
      width, 0.045, south - north + 10, surface]);
    roads.push([(west + east) / 2, -0.101, origin.z - blockSize / 2 + index * blockSize,
      east - west + 10, 0.045, width, surface]);
  }
  batch(roads, box, solid, true);

  const tiles = new Map();
  function getTile(block) {
    const tx = Math.floor(block.i / 4);
    const tz = Math.floor(block.j / 4);
    const id = tx + ':' + tz;
    if (!tiles.has(id)) {
      tiles.set(id, {
        x: block.x - (block.i % 4 + 4) % 4 * blockSize + 1.5 * blockSize,
        z: block.z - (block.j % 4 + 4) % 4 * blockSize + 1.5 * blockSize,
        ground: [], masses: [], roof: [], details: [], crowns: [], lamps: [], faces: new Map(),
      });
    }
    return tiles.get(id);
  }

  function footprint(x, z, w, d) {
    obstacles.push([x - w / 2, x + w / 2, z - d / 2, z + d / 2]);
  }

  function addBuilding(tile, building) {
    const { x, z, width: w, depth: d, floors, floorHeight, walls, roof: tint, storefront, front } = building;
    const h = floors * floorHeight;
    tile.masses.push([x, h / 2 - 0.055, z, w, h, d, walls]);
    tile.masses.push([x, 0.11, z, w + 0.26, 0.38, d + 0.26, brick]);
    if (floors === 2) {
      tile.roof.push([x, h - 0.04, z, w + 0.65, 1.38, d + 0.55, tint]);
    } else {
      tile.masses.push([x, h + 0.05, z, w + 0.36, 0.32, d + 0.36, tint]);
      if (floors >= 7) tile.masses.push([x, h + 0.78, z, w * 0.39, 1.15, d * 0.47, walls]);
    }
    if (!tile.faces.has(floors)) tile.faces.set(floors, []);
    const faces = tile.faces.get(floors);
    faces.push([x, h / 2, z + d / 2 + 0.015, w * 0.91, h * 0.95, 1, undefined]);
    faces.push([x, h / 2, z - d / 2 - 0.015, w * 0.91, h * 0.95, 1, undefined, Math.PI]);
    faces.push([x + w / 2 + 0.015, h / 2, z, d * 0.91, h * 0.95, 1, undefined, Math.PI / 2]);
    faces.push([x - w / 2 - 0.015, h / 2, z, d * 0.91, h * 0.95, 1, undefined, -Math.PI / 2]);
    const edge = z + front * d / 2;
    tile.details.push([x, 1.13, edge + front * 0.09, storefront ? w * 0.68 : 1.92, 2.23, 0.22, 0x596c69]);
    tile.details.push([x, 2.62, edge + front * 0.4, storefront ? w * 0.78 : 2.56, 0.18, 1.22, tint]);
    tile.details.push([x, 0.035, edge + front * 0.5, w * 0.74, 0.11, 1.55, gravel]);
    footprint(x, z, w + 0.19, d + 0.19);
  }

  function addPark(tile, block) {
    const { x, z, zone } = block;
    tile.ground.push([x, -0.058, z, 62, 0.072, 62, zone === 'centralPark' ? 0x879564 : 0x939d72]);
    tile.ground.push([x, -0.015, z, 63, 0.055, 2.75, gravel], [x, -0.014, z, 2.75, 0.055, 63, gravel]);
    for (const side of [-1, 1]) {
      tile.ground.push([x + side * 26, -0.014, z, 1.65, 0.055, 52, gravel]);
      tile.ground.push([x, -0.013, z + side * 26, 52, 0.055, 1.65, gravel]);
      for (const across of [-1, 1]) {
        const bX = x + side * 7.5;
        const bZ = z + across * 3.65;
        tile.details.push([bX, 0.40, bZ, 2.0, 0.12, 0.57, 0xb18b5b]);
        tile.details.push([bX, 0.66, bZ + across * 0.24, 2.0, 0.34, 0.075, 0x957351]);
        for (const leg of [-0.76, 0.76]) tile.details.push([bX + leg, 0.19, bZ, 0.095, 0.41, 0.41, 0x4e5246]);
        footprint(bX, bZ, 2.02, 0.63);
      }
    }
    if (zone === 'centralPark') {
      tile.ground.push([x, -0.004, z, 15, 0.08, 14, 0xd8c5a7]);
      tile.masses.push([x, 0.31, z, 7.15, 0.49, 5.6, 0xaaa28a]);
      tile.ground.push([x, 0.59, z, 6.6, 0.1, 5.05, 0x759795]);
      for (const side of [-1, 1]) {
        tile.ground.push([x + side * 3.43, 0.61, z, 0.28, 0.22, 5.6, 0xc6bba5]);
        tile.ground.push([x, 0.61, z + side * 2.66, 7.15, 0.22, 0.28, 0xc6bba5]);
      }
      footprint(x, z, 7.15, 5.6);
    }
  }

  function addStreetlights(tile, x, z, alongX) {
    for (const offset of [-22, 9]) {
      const lx = x + (alongX ? offset : 0);
      const lz = z + (alongX ? 0 : offset);
      tile.details.push([lx, 1.55, lz, 0.09, 3.25, 0.09, 0x56574d]);
      tile.details.push([lx, 3.31, lz, 0.31, 0.10, 0.31, 0x56574d]);
      tile.lamps.push([lx, 3.20, lz, 0.23, 0.14, 0.23]);
      footprint(lx, lz, 0.12, 0.12);
    }
  }

  for (const block of cityBlocks) {
    if (block.zone === 'street') continue;
    const tile = getTile(block);
    const edge = blockSize - 10.6;
    tile.ground.push([block.x, -0.072, block.z, edge, 0.085, edge, pavement]);
    if (block.zone === 'park' || block.zone === 'centralPark') addPark(tile, block);
    for (const building of block.buildings) addBuilding(tile, building);
    for (const [index, { x, z, size }] of block.trees.entries()) {
      tile.masses.push([x, size * 0.74, z, size * 0.20, size * 1.60, size * 0.21, trunk]);
      tile.crowns.push([x, size * 1.91, z, size * 1.6, size * 2.22, size * 1.48,
        foliage[(index + (block.i + block.j + 48)) % foliage.length]]);
      footprint(x, z, size * 0.21, size * 0.21);
    }
    const mainX = mainStreets(block.i);
    const mainZ = mainStreets(block.j);
    if (mainX) addStreetlights(tile, block.x - 31.3, block.z, false);
    if (mainZ) addStreetlights(tile, block.x, block.z - 31.3, true);
    for (let stripe = -27; stripe <= 28; stripe += 8) {
      if (mainX) tile.ground.push([block.x - blockSize / 2, -0.075, block.z + stripe, 0.13, 0.019, 3.4, 0xd2bb8a]);
      if (mainZ) tile.ground.push([block.x + stripe, -0.074, block.z - blockSize / 2, 3.4, 0.019, 0.13, 0xd2bb8a]);
    }
  }

  const chunks = [];
  for (const tile of tiles.values()) {
    const bodies = [batch(tile.ground, box), batch(tile.masses, box), batch(tile.roof, roof), batch(tile.crowns, oval)];
    const detail = [batch(tile.details, box), batch(tile.lamps, box, streetGlass)];
    for (const [floors, faces] of tile.faces) {
      if (!glazing.has(floors)) glazing.set(floors, windowMaterial(floors));
      detail.push(batch(faces, plane, glazing.get(floors)));
    }
    chunks.push({ x: tile.x, z: tile.z, bodies: bodies.filter(Boolean), detail: detail.filter(Boolean) });
  }

  let previousX;
  let previousZ;
  return {
    obstacles,
    update({ x, z }) {
      const nextX = Math.floor(x / 18);
      const nextZ = Math.floor(z / 18);
      if (nextX === previousX && nextZ === previousZ) return;
      previousX = nextX;
      previousZ = nextZ;
      for (const { x: cx, z: cz, bodies, detail } of chunks) {
        const distance = Math.hypot(Math.max(0, Math.abs(cx - x) - tileSize / 2),
          Math.max(0, Math.abs(cz - z) - tileSize / 2));
        for (const mesh of bodies) mesh.visible = distance < 820;
        for (const mesh of detail) mesh.visible = distance < 185;
      }
    },
    light(minute) {
      const darkness = Math.max(1 - minute / 435, (minute - 1_060) / 135, 0);
      for (const material of glazing.values()) material.emissiveIntensity = Math.min(1, darkness) * 0.9;
      streetGlass.emissiveIntensity = Math.min(1, darkness) * 1.6;
    },
  };
}
