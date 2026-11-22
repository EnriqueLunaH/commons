import * as THREE from 'three';
import { stops } from './transit.js';

export function buildBus({ scene, box, cylinder, oval, object, colors: C }) {
  box(28.7, 0.027, 2.60, 25.72, -0.075, 2.65, 0x918b80, 0.016);
  const signs = {};
  const stopPositions = {};
  const obstacles = [];

  for (const [name, { platform }] of Object.entries(stops)) {
    const { x, z } = platform;
    const curbX = name === 'neighborhood' ? x - 0.43 : x + 0.82;
    const curbZ = name === 'neighborhood' ? z - 0.78 : z + 0.31;
    box(1.24, 0.040, 1.76, x, -0.057, z, 0xbda991, 0.025);
    box(0.09, 1.90, 0.09, curbX, 0.89, curbZ, C.green, 0.015);
    box(0.52, 0.44, 0.11, curbX, 1.68, curbZ, C.green, 0.045);
    const badge = document.createElement('canvas');
    badge.width = 192;
    badge.height = 106;
    const texture = new THREE.CanvasTexture(badge);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = object(new THREE.PlaneGeometry(0.49, 0.39), C.paper, curbX, 1.68, curbZ + 0.060);
    sign.material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 0.92 });
    signs[name] = (label) => {
      const ctx = badge.getContext('2d');
      ctx.fillStyle = '#647456';
      ctx.fillRect(0, 0, 192, 106);
      ctx.fillStyle = '#ffedc2';
      ctx.textAlign = 'center';
      ctx.font = '700 47px Georgia';
      ctx.fillText('1', 96, 51);
      ctx.font = '650 25px system-ui';
      ctx.fillText(label, 96, 88, 174);
      texture.needsUpdate = true;
    };
    stopPositions[name] = [curbX, 1.79, curbZ];
    obstacles.push([curbX - 0.06, curbX + 0.06, curbZ - 0.06, curbZ + 0.06]);
  }

  const shuttle = new THREE.Group();
  scene.add(shuttle);
  const sage = 0x778571;
  const roof = 0xe0ccb0;
  const chrome = 0x9b9e91;
  const shopBox = (w, h, d, x, y, z, color, radius) => box(w, h, d, x, y, z, color, radius, shuttle);
  shopBox(1.77, 0.32, 4.08, 0, 0.44, 0, sage, 0.11);
  shopBox(1.64, 0.09, 3.88, 0, 0.616, 0, C.darkWood, 0.052);
  shopBox(1.81, 0.19, 4.15, 0, 2.08, 0, roof, 0.085);
  shopBox(1.66, 0.18, 0.23, 0, 0.48, -2.03, chrome, 0.055);
  shopBox(1.62, 0.22, 0.19, 0, 0.53, 2.04, chrome, 0.055);
  shopBox(1.71, 0.56, 0.14, 0, 0.94, -1.99, sage, 0.053);
  shopBox(1.72, 0.99, 0.13, 0, 1.10, 1.96, sage, 0.058);
  shopBox(1.70, 0.23, 0.14, 0, 1.91, -1.97, roof, 0.057);
  shopBox(0.083, 0.68, 0.077, 0, 1.54, -1.97, chrome, 0.019);
  shopBox(1.50, 0.075, 0.24, 0, 1.11, -1.83, C.charcoal, 0.028);
  shopBox(1.63, 0.10, 0.11, 0, 1.62, 1.96, roof, 0.025);
  shopBox(0.10, 0.47, 0.10, 0, 1.83, 1.98, chrome, 0.014);

  const display = document.createElement('canvas');
  display.width = 112;
  display.height = 60;
  const ctx = display.getContext('2d');
  ctx.fillStyle = '#4b5945';
  ctx.fillRect(0, 0, 112, 60);
  ctx.font = '700 46px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0d7a5';
  ctx.fillText('1', 56, 48);
  const destination = new THREE.CanvasTexture(display);
  destination.colorSpace = THREE.SRGBColorSpace;
  const plate = object(new THREE.PlaneGeometry(0.38, 0.20), C.white, 0, 1.93, -2.058, shuttle);
  plate.rotation.y = Math.PI;
  plate.material = new THREE.MeshStandardMaterial({ map: destination, emissiveMap: destination,
    emissive: 0xd6b47f, emissiveIntensity: 0.38, roughness: 0.96 });

  for (const side of [-1, 1]) {
    const x = side * 0.84;
    shopBox(0.12, 0.57, 3.90, x, 0.90, 0, sage, 0.035);
    shopBox(0.13, 0.09, 3.97, x, 1.19, 0, roof, 0.022);
    for (const z of [-1.93, -0.68, 0.62, 1.94]) shopBox(0.12, 0.85, 0.095, x, 1.59, z, roof, 0.022);
    for (const z of [-1.24, 1.30]) {
      const tire = cylinder(0.30, 0.30, 0.18, x, 0.31, z, C.charcoal, shuttle);
      tire.rotation.z = Math.PI / 2;
      const cap = cylinder(0.126, 0.126, 0.031, x + side * 0.095, 0.31, z, chrome, shuttle);
      cap.rotation.z = Math.PI / 2;
    }
    shopBox(0.25, 0.22, 0.066, side * 0.60, 0.86, -2.081, C.oatmeal, 0.043);
    shopBox(0.16, 0.15, 0.064, side * 0.61, 0.88, 2.039, C.clay, 0.028);
    shopBox(0.44, 0.115, 0.38, side * 0.48, 0.93, -0.24, sage, 0.057);
    shopBox(0.45, 0.39, 0.095, side * 0.48, 1.13, -0.04, sage, 0.048);
    shopBox(0.44, 0.115, 0.38, side * 0.48, 0.93, 1.38, sage, 0.057);
    shopBox(0.45, 0.39, 0.095, side * 0.48, 1.13, 1.56, sage, 0.048);
    shopBox(0.043, 0.89, 0.04, side * 0.13, 1.55, -0.02, C.brass, 0.012);
  }
  shopBox(0.40, 0.14, 0.38, -0.47, 1.03, -1.35, C.charcoal, 0.052);
  shopBox(0.39, 0.40, 0.055, -0.47, 1.25, -1.13, C.charcoal, 0.045);
  const wheel = object(new THREE.TorusGeometry(0.12, 0.022, 8, 20), C.charcoal, -0.44, 1.22, -1.67, shuttle);
  wheel.rotation.x = -0.53;
  shopBox(0.31, 0.32, 0.20, -0.47, 1.35, -1.41, 0x65786f, 0.065);
  oval(-0.47, 1.60, -1.44, 0.114, 0.139, 0.106, 0xaa7b63, shuttle);
  oval(-0.47, 1.669, -1.42, 0.118, 0.076, 0.107, 0x544134, shuttle);
  for (const x of [-0.56, -0.37]) {
    const sleeve = shopBox(0.077, 0.26, 0.088, x, 1.312, -1.57, 0x65786f, 0.032);
    sleeve.rotation.x = 0.58;
    oval(x, 1.24, -1.65, 0.039, 0.040, 0.036, 0xaa7b63, shuttle);
  }
  shuttle.traverse((child) => { child.castShadow = false; });

  return {
    obstacles, stopPositions,
    localize(labels) { for (const [id, sign] of Object.entries(signs)) sign(labels[id]); },
    place(x, z, yaw) {
      shuttle.position.set(x, 0, z);
      shuttle.rotation.y = yaw;
      shuttle.updateMatrixWorld(true);
    },
    sit(position) {
      position.set(0.36, 1.67, 0.72);
      shuttle.localToWorld(position);
    },
  };
}
