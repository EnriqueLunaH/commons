import * as THREE from 'three';
import { commuteRoute, workplaces } from './employment.js';

export function buildWorkplaces({ scene, box, cylinder, oval, object, colors: C }) {
  const obstacles = [];
  const signs = {};
  const goods = {};
  const anchors = {};
  const styles = {
    bakery: { walls: 0xd3b695, trim: 0xa76b53, paint: '#794d3c', accent: C.oatmeal },
    florist: { walls: 0xb9b99a, trim: 0x737f65, paint: '#4e624f', accent: C.paleGreen },
  };

  function footprint(x, z, width, depth) {
    obstacles.push([x - width / 2, x + width / 2, z - depth / 2, z + depth / 2]);
  }

  const crossing = commuteRoute('florist')[3].z;
  box(12.8, 0.027, 1.46, 15.15, -0.073, crossing, 0xc2af93, 0.01);
  for (let i = 0; i < 8; i++) {
    box(0.27, 0.014, 0.96, 10 + i * 0.39, -0.048, crossing, 0xe0d5bc, 0);
  }

  function flowers(x, y, z, color, group, size = 1) {
    cylinder(0.124 * size, 0.073 * size, 0.18 * size, x, y + 0.087 * size, z, C.clay, group);
    for (const [dx, dz, h] of [[-0.07, 0.01, 0.26], [0.055, -0.025, 0.33], [0.015, 0.052, 0.23]]) {
      cylinder(0.012 * size, 0.016 * size, h * size, x + dx * size, y + (0.16 + h / 2) * size, z + dz * size, C.green, group);
      const top = y + (0.16 + h) * size;
      oval(x + dx * size, top, z + dz * size, 0.064 * size, 0.039 * size, 0.063 * size, color, group);
      oval(x + dx * size, top + 0.019 * size, z + dz * size, 0.025 * size, 0.020 * size, 0.025 * size, C.oatmeal, group);
    }
  }

  function storefront(name, { x, z, width, depth }) {
    const style = styles[name];
    const front = z - depth / 2;
    const back = z + depth / 2;
    const halfDoor = 0.79;
    const sideWall = width / 2 - halfDoor;
    const height = 3.18;
    const entry = front - crossing;
    box(1.6, 0.029, entry + 0.46, x, -0.070, crossing + entry / 2, 0xcbb699, 0.016);
    box(width + 0.20, 0.15, depth + 0.26, x, -0.063, z, C.wood, 0.028);
    box(width + 0.28, 0.23, depth + 0.30, x, height + 0.03, z, style.trim, 0.058);
    box(width + 0.46, 0.085, depth + 0.46, x, height + 0.177, z, C.trim, 0.028);
    box(width, height, 0.16, x, height / 2, back, style.walls, 0.026);
    footprint(x, back, width, 0.16);
    for (const side of [-1, 1]) {
      const wallX = x + side * width / 2;
      box(0.16, height, depth, wallX, height / 2, z, style.walls, 0.026);
      footprint(wallX, z, 0.16, depth);
      const frontX = x + side * (halfDoor + sideWall / 2);
      box(sideWall, height, 0.16, frontX, height / 2, front, style.walls, 0.025);
      footprint(frontX, front, sideWall, 0.16);
      box(1.22, 1.23, 0.09, frontX, 1.37, front - 0.104, C.white, 0.026);
      box(1.08, 1.08, 0.045, frontX, 1.37, front - 0.158, C.blue, 0.019);
      box(0.048, 1.07, 0.047, frontX, 1.37, front - 0.187, C.white, 0.006);
      box(1.07, 0.047, 0.047, frontX, 1.34, front - 0.187, C.white, 0.006);
      box(0.11, 2.46, 0.24, x + side * halfDoor, 1.22, front, C.wood, 0.024);
    }
    box(width, 0.69, 0.16, x, 2.825, front, style.walls, 0.018);
    box(1.72, 0.10, 0.24, x, 2.46, front, C.wood, 0.016);
    box(1.58, 0.09, 0.50, x, -0.018, front, C.wood, 0.016);
    for (let index = 0; index < 9; index++) {
      const stripe = (width + 0.22) / 9;
      const awning = box(stripe + 0.012, 0.09, 0.81, x + (index - 4) * stripe,
        2.29, front - 0.37, index % 2 ? style.accent : style.trim, 0.028);
      awning.rotation.x = -0.13;
      box(stripe + 0.012, 0.19, 0.081, x + (index - 4) * stripe, 2.18, front - 0.76,
        index % 2 ? style.accent : style.trim, 0.043);
    }

    const panel = document.createElement('canvas');
    panel.width = 384;
    panel.height = 74;
    const texture = new THREE.CanvasTexture(panel);
    texture.colorSpace = THREE.SRGBColorSpace;
    const board = object(new THREE.PlaneGeometry(3.75, 0.64), C.white, x, 2.76, front - 0.112);
    board.rotation.y = Math.PI;
    board.material = new THREE.MeshStandardMaterial({
      map: texture, roughness: 0.9, emissive: 0xffecd3, emissiveMap: texture, emissiveIntensity: 0.12,
    });
    board.castShadow = false;
    signs[name] = (label) => {
      const ctx = panel.getContext('2d');
      ctx.fillStyle = style.paint;
      ctx.fillRect(0, 0, panel.width, panel.height);
      ctx.strokeStyle = '#dec8a2';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(8, 7, 368, 60);
      ctx.fillStyle = '#f3e4c8';
      ctx.font = '600 36px Georgia';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, panel.width / 2, 38, 323);
      texture.needsUpdate = true;
    };

    const counterZ = z + 1.06;
    box(width - 1.46, 0.83, 0.63, x, 0.425, counterZ, style.trim, 0.058);
    box(width - 1.38, 0.105, 0.77, x, 0.85, counterZ, C.wood, 0.04);
    footprint(x, counterZ, width - 1.38, 0.77);
    box(2.75, 0.105, 0.43, x, 1.48, back - 0.34, C.wood, 0.031);
    box(2.75, 0.105, 0.43, x, 2.06, back - 0.34, C.wood, 0.031);
    box(0.32, 0.16, 0.26, x + 1.22, 0.973, counterZ - 0.035, C.charcoal, 0.027);

    const finishedGoods = new THREE.Group();
    scene.add(finishedGoods);
    goods[name] = finishedGoods;
    finishedGoods.visible = false;
    if (name === 'bakery') {
      box(1.08, 0.83, 0.50, x - 1.78, 0.46, back - 0.29, C.darkWood, 0.075);
      box(0.78, 0.36, 0.059, x - 1.78, 0.53, back - 0.57, C.charcoal, 0.049);
      box(0.48, 0.034, 0.051, x - 1.78, 0.61, back - 0.61, C.brass, 0.012);
      for (const offset of [-0.81, -0.30, 0.22, 0.70]) {
        oval(x + offset, 1.60, back - 0.52, 0.22, 0.088, 0.12, 0xc79053);
        oval(x + offset, 0.962, counterZ + 0.01, 0.20, 0.066, 0.099, 0xc9995d, finishedGoods);
      }
    } else {
      for (const [offset, tone] of [[-0.72, C.clay], [0, 0xdfac7b], [0.75, 0xc78b9f]]) {
        flowers(x + offset, 1.54, back - 0.51, tone, scene, 0.82);
      }
      for (const side of [-1, 1]) {
        flowers(x + side * 1.82, 0, front - 0.32, side > 0 ? 0xd6a676 : 0xb7859c, scene, 1.38);
      }
      for (const [offset, tone] of [[-0.79, 0xd2909c], [-0.31, 0xd9a46d], [0.24, 0xe2afb3], [0.70, 0xce8b80]]) {
        const bouquet = new THREE.Group();
        finishedGoods.add(bouquet);
        flowers(x + offset, 0.907, counterZ + 0.02, tone, bouquet, 0.91);
      }
    }

    anchors[name] = [x, 1.10, counterZ - 0.42];
  }

  Object.entries(workplaces).forEach(([name, place]) => storefront(name, place));
  return {
    obstacles, anchors,
    localize(labels) {
      for (const [name, sign] of Object.entries(signs)) sign(labels[name]);
    },
    stock(occupation, units) {
      for (const [name, group] of Object.entries(goods)) {
        group.visible = occupation === name && units > 0;
        group.children.forEach((item, index) => { item.visible = index < units; });
      }
    },
  };
}
