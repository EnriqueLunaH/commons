import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createWalk } from './walk.js';
import { buildNeighborhood, neighborhoodZone } from './neighborhood.js';
import { buildCity } from './city.js';
import { cityLimits } from './city-layout.js';
import { atWorkCounter } from './employment.js';
import { buildWorkplaces } from './workplaces.js';
import { buildBus } from './bus.js';
import { buildCharacters } from './characters.js';
import { advanceBus, boardBus, createTransit, leaveBus, nearbyStop, readTransit, stops } from './transit.js';

const colors = {
  cream: 0xe5d4b6, wall: 0xc8ae8d, trim: 0x907756, wood: 0xb1845d,
  floor: 0xa78263, darkWood: 0x683f2c, green: 0x6c7c64, paleGreen: 0xa1a485,
  clay: 0xac6953, oatmeal: 0xe5cb9d, brass: 0xa98150, paper: 0xf4e3bf,
  white: 0xeedbc3, charcoal: 0x343931, gold: 0xde9b48, blue: 0x587276,
};

const lighting = [
  [0, 0x29394e, 0xacbce8, 0x90a8d8, 0.40, 0.73, 27, 0.22],
  [300, 0x29394e, 0xacbce8, 0x90a8d8, 0.40, 0.73, 27, 0.22],
  [360, 0xb4a39a, 0xf0caab, 0xf3c09c, 1.48, 1.31, 20, 0.52],
  [468, 0xc5c9ac, 0xffedcd, 0xffe5ac, 2.40, 1.70, 11, 0.68],
  [978, 0xc5c9ac, 0xffedcd, 0xffe5ac, 2.40, 1.70, 11, 0.68],
  [1_080, 0xbe947e, 0xf2bdab, 0xffb788, 1.68, 1.43, 22, 0.48],
  [1_170, 0x29394e, 0xacbce8, 0x90a8d8, 0.40, 0.73, 27, 0.22],
  [1_440, 0x29394e, 0xacbce8, 0x90a8d8, 0.40, 0.73, 27, 0.22],
].map(([minute, sky, bounce, sun, key, ambient, lamp, fill]) => ({
  minute, sky: new THREE.Color(sky), bounce: new THREE.Color(bounce), sun: new THREE.Color(sun),
  key, ambient, lamp, fill,
}));

const landmarks = {
  budget: [-1.5, 1.13, 0.0],
  savings: [4.60, 1.64, -1.82],
  debt: [2.29, 1.20, -3.09],
  work: [-3.05, 2.18, -4.44],
  diary: [-0.7, 1.13, -0.60],
  sleep: [-3.65, 0.91, 2.87],
};
const doorway = [5.31, 1.59, 1.45];

function makePaper() {
  const sheet = document.createElement('canvas');
  sheet.width = sheet.height = 128;
  const context = sheet.getContext('2d');
  const pixels = context.createImageData(128, 128);
  let seed = 37;
  for (let index = 0; index < pixels.data.length; index += 4) {
    seed = (seed * 16807) % 2147483647;
    const tone = 235 + (seed % 21);
    pixels.data.set([tone, tone, tone, 255], index);
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(sheet);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRoom(canvas, onAnchors) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0x000000, 90, 810);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.08, 1_000);
  camera.rotation.order = 'YXZ';
  const paper = makePaper();
  const materials = new Map();
  const material = (color) => {
    if (!materials.has(color)) {
      materials.set(color, new THREE.MeshStandardMaterial({ color, map: paper, roughness: 0.93 }));
    }
    return materials.get(color);
  };

  function object(geometry, color, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(geometry, material(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function box(w, h, d, x, y, z, color, radius = 0.03, parent = scene) {
    const geometry = radius > 0
      ? new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 2, h / 2, d / 2))
      : new THREE.BoxGeometry(w, h, d);
    return object(geometry, color, x, y, z, parent);
  }

  function cylinder(top, bottom, height, x, y, z, color, parent = scene) {
    return object(new THREE.CylinderGeometry(top, bottom, height, 28), color, x, y, z, parent);
  }

  function oval(x, y, z, width, height, depth, color, parent = scene) {
    const mesh = object(new THREE.SphereGeometry(1, 18, 12), color, x, y, z, parent);
    mesh.scale.set(width, height, depth);
    return mesh;
  }

  const C = colors;
  box(10.8, 0.14, 10.2, 0, -0.10, 0.06, C.floor, 0);
  for (let row = 0; row < 27; row++) {
    for (let segment = 0; segment < 3; segment++) {
      const shade = [0xaf8a69, 0xad8865, 0xb79471, 0xa98463][(row * 7 + segment * 5) % 4];
      box(3.588, 0.04, 0.365, (segment - 1) * 3.6, -0.02, row * 0.375 - 4.8, shade, 0.006);
    }
  }
  box(0.23, 3.7, 10.2, -5.31, 1.8, 0.04, C.cream, 0);
  box(0.23, 3.7, 5.80, 5.31, 1.8, -2.16, C.cream, 0);
  box(0.23, 3.7, 2.98, 5.31, 1.8, 3.65, C.cream, 0);
  box(0.23, 1.23, 1.42, 5.31, 3.045, 1.45, C.cream, 0);
  for (const z of [0.72, 2.18]) box(0.35, 2.45, 0.085, 5.31, 1.20, z, C.trim);
  box(0.35, 0.10, 1.54, 5.31, 2.43, 1.45, C.trim);
  box(0.48, 0.055, 1.46, 5.31, -0.018, 1.45, C.wood, 0.016);
  box(0.09, 2.25, 1.29, 5.54, 1.136, 0.13, C.green).rotation.y = 0.14;
  box(10.8, 3.7, 0.23, 0, 1.8, 5.04, C.wall, 0);
  box(10.8, 0.19, 10.2, 0, 3.64, 0.04, C.cream, 0);
  box(5.31, 3.7, 0.24, -2.67, 1.78, -4.82, C.cream, 0);
  box(1.44, 3.7, 0.24, 4.62, 1.78, -4.82, C.cream, 0);
  box(3.92, 0.80, 0.24, 1.95, 0.39, -4.82, C.cream, 0);
  box(3.92, 0.87, 0.24, 1.95, 3.28, -4.82, C.cream, 0);
  box(10.6, 0.16, 0.10, 0, 0.08, -4.65, C.trim);
  box(10.6, 0.16, 0.10, 0, 0.08, 4.9, C.trim);
  box(0.10, 0.16, 9.7, -5.16, 0.08, 0.1, C.trim);
  box(0.10, 0.16, 5.45, 5.16, 0.08, -2.06, C.trim);
  box(0.10, 0.16, 2.66, 5.16, 0.08, 3.52, C.trim);
  for (const z of [-3.45, -0.25, 3.0]) box(10.6, 0.14, 0.20, 0, 3.47, z, C.trim);

  for (const x of [0.0, 1.95, 3.90]) box(0.093, 2.13, 0.16, x, 1.824, -4.65, C.white);
  for (const y of [0.78, 1.83, 2.87]) box(4.02, 0.088, 0.16, 1.95, y, -4.65, C.white);
  box(4.18, 0.09, 0.42, 1.95, 0.765, -4.63, C.wood);
  box(4.45, 0.055, 0.06, 1.95, 3.04, -4.41, C.brass);

  const curtains = [];
  for (const x of [0.08, 3.81]) {
    const curtain = new THREE.Group();
    curtain.position.set(x, 2.99, -4.48);
    for (let fold = 0; fold < 8; fold++) {
      const offset = (fold - 3.5) * 0.078;
      box(0.092, 2.02, 0.065, offset, -1.02, fold % 2 ? 0.04 : 0, fold % 2 ? 0xe0c89d : 0xd5ba8d, 0.028, curtain);
    }
    scene.add(curtain);
    curtains.push(curtain);
  }

  const city = buildCity(scene, paper);
  const { obstacles, lantern, streetLight, ripples } =
    buildNeighborhood({ scene, box, cylinder, oval, object, colors: C });
  const workplaces = buildWorkplaces({ scene, box, cylinder, oval, object, colors: C });
  const bus = buildBus({ scene, box, cylinder, oval, object, colors: C });
  const characters = buildCharacters({ scene, box, oval, colors: C });

  const rug = box(3.53, 0.033, 2.78, -1.34, 0.028, 0.02, 0xa97558, 0.045);
  rug.castShadow = false;
  for (const z of [-1.27, -1.16, 1.19, 1.3]) {
    box(3.39, 0.012, 0.034, -1.34, 0.049, z, C.oatmeal, 0);
  }
  for (let x = -2.84; x <= 0.25; x += 0.30) {
    for (const z of [-1.39, 1.42]) box(0.044, 0.014, 0.15, x, 0.027, z, C.oatmeal, 0);
  }
  box(2.65, 0.115, 1.55, -1.40, 0.96, -0.45, C.wood, 0.07);
  box(2.39, 0.17, 1.33, -1.40, 0.84, -0.45, C.darkWood, 0.048);
  for (const x of [-2.46, -0.35]) {
    for (const z of [-1.0, 0.1]) box(0.14, 0.84, 0.14, x, 0.42, z, C.darkWood);
  }
  for (const [x, z, reverse] of [[-1.75, 0.89, false], [-1.83, -1.79, true]]) {
    const chair = new THREE.Group();
    chair.position.set(x, 0, z);
    chair.rotation.y = reverse ? Math.PI : 0;
    scene.add(chair);
    box(0.60, 0.092, 0.58, 0, 0.49, 0, C.green, 0.06, chair);
    for (const legX of [-0.23, 0.23]) {
      box(0.062, 0.54, 0.064, legX, 0.27, -0.21, C.darkWood, 0.012, chair);
      box(0.067, 0.90, 0.064, legX, 0.45, 0.22, C.darkWood, 0.012, chair);
    }
    box(0.60, 0.16, 0.095, 0, 0.92, 0.22, C.green, 0.04, chair);
  }

  const meal = new THREE.Group();
  meal.position.x = 0.40;
  const bread = new THREE.Group();
  const stew = new THREE.Group();
  scene.add(meal);
  meal.add(bread, stew);
  box(0.64, 0.015, 0.53, -2.23, 1.028, -0.64, C.paleGreen, 0.024, meal);
  cylinder(0.235, 0.17, 0.043, -2.22, 1.062, -0.61, C.white, meal);
  oval(-2.22, 1.095, -0.63, 0.141, 0.042, 0.109, 0xb77c41, bread);
  oval(-2.16, 1.110, -0.56, 0.082, 0.012, 0.062, C.cream, bread);
  oval(-2.24, 1.10, -0.62, 0.15, 0.025, 0.132, C.clay, stew);
  for (const [x, z] of [[-2.29, -0.65], [-2.16, -0.63], [-2.25, -0.57]]) {
    oval(x, 1.125, z, 0.027, 0.012, 0.025, C.paleGreen, stew);
  }
  cylinder(0.08, 0.058, 0.15, -2.46, 1.105, -1.0, C.blue, meal);
  cylinder(0.069, 0.067, 0.011, -2.46, 1.18, -1.0, C.darkWood, meal);
  const handle = object(new THREE.TorusGeometry(0.044, 0.011, 8, 18), C.blue, -2.365, 1.105, -1.0, meal);
  handle.rotation.y = 0.22;

  box(0.52, 0.056, 0.36, -1.46, 1.024, -0.04, C.clay);
  box(0.25, 0.042, 0.328, -1.59, 1.058, -0.04, C.paper, 0.015).rotation.z = -0.04;
  box(0.25, 0.042, 0.328, -1.33, 1.058, -0.04, C.paper, 0.015).rotation.z = 0.04;
  for (const x of [-1.59, -1.33]) {
    for (let line = 0; line < 5; line++) box(0.175, 0.003, 0.004, x, 1.081, -0.147 + line * 0.044, 0xb09c7d, 0);
  }
  box(0.027, 0.028, 0.34, -1.08, 1.038, -0.15, C.green).rotation.y = 0.45;
  box(0.36, 0.067, 0.30, -0.64, 1.043, -0.64, C.blue).rotation.y = -0.21;
  box(0.30, 0.031, 0.25, -0.64, 1.021, -0.64, C.paper).rotation.y = -0.21;

  box(2.28, 0.98, 0.64, 2.89, 0.53, -3.39, C.green, 0.06);
  box(2.39, 0.097, 0.75, 2.89, 1.047, -3.39, C.wood, 0.055);
  for (let x = 2.12; x < 3.9; x += 0.77) {
    box(0.67, 0.64, 0.042, x, 0.53, -3.042, C.paleGreen, 0.037);
    box(0.17, 0.037, 0.046, x, 0.76, -3.0, C.brass);
  }
  for (const [x, y, z, angle] of [[2.26, 1.103, -3.18, 0.12], [2.37, 1.116, -3.11, -0.2], [2.39, 1.129, -3.15, -0.3]]) {
    box(0.33, 0.012, 0.22, x, y, z, C.paper, 0.006).rotation.y = angle;
  }
  cylinder(0.18, 0.13, 0.24, 3.58, 1.20, -3.43, C.clay);
  for (let i = 0; i < 8; i++) {
    const angle = i * 2.4;
    oval(3.58 + Math.sin(angle) * 0.17, 1.47 + (i % 3) * 0.07, -3.43 + Math.cos(angle) * 0.17,
      0.074, 0.23, 0.056, i % 3 ? C.green : C.paleGreen).rotation.z = Math.sin(angle) * 0.66;
  }

  box(0.53, 1.12, 1.38, 4.75, 0.58, -1.74, C.darkWood, 0.05);
  box(0.67, 0.10, 1.47, 4.71, 1.16, -1.74, C.wood, 0.04);
  cylinder(0.15, 0.135, 0.29, 4.65, 1.36, -1.86, C.blue);
  cylinder(0.164, 0.164, 0.038, 4.65, 1.52, -1.86, C.brass);
  box(0.105, 0.007, 0.022, 4.65, 1.544, -1.86, C.charcoal, 0.003);

  box(2.65, 1.03, 0.80, -3.17, 0.55, -4.18, C.green, 0.045);
  box(2.75, 0.09, 0.89, -3.17, 1.09, -4.16, C.wood);
  for (const x of [-4, -3.17, -2.34]) {
    box(0.71, 0.67, 0.042, x, 0.55, -3.759, C.paleGreen, 0.035);
    box(0.20, 0.032, 0.063, x, 0.78, -3.723, C.brass, 0.012);
  }
  cylinder(0.17, 0.11, 0.28, -3.98, 1.29, -4.25, C.clay);
  for (const x of [-4.07, -3.98, -3.89]) cylinder(0.012, 0.012, 0.36, x, 1.49, -4.25, C.darkWood).rotation.z = (x + 3.98) * 3;
  box(1.79, 1.05, 0.09, -3.14, 2.11, -4.65, C.trim, 0.041);
  box(1.65, 0.91, 0.06, -3.14, 2.11, -4.581, C.oatmeal, 0.022);
  for (const [x, y, angle, color] of [[-3.64, 2.23, 0.09, C.paper], [-3.05, 2.17, -0.06, C.white], [-2.62, 2.04, 0.12, C.clay]]) {
    box(0.29, 0.37, 0.012, x, y, -4.534, color, 0.007).rotation.z = angle;
    oval(x, y + 0.14, -4.51, 0.023, 0.023, 0.022, C.green);
  }
  box(1.45, 0.07, 0.35, -3.64, 2.95, -4.61, C.wood);
  for (let i = 0; i < 6; i++) {
    box(0.10, 0.25 + (i % 3) * 0.04, 0.23, -4.13 + i * 0.116, 3.11, -4.58,
      [C.blue, C.clay, C.paleGreen, C.paper, C.wood, C.green][i], 0.014).rotation.z = i === 5 ? 0.15 : 0;
  }

  box(1.57, 0.30, 2.23, -3.63, 0.24, 2.94, C.darkWood, 0.06);
  box(1.60, 0.88, 0.12, -3.63, 0.43, 4.04, C.wood, 0.078);
  box(1.48, 0.21, 2.10, -3.63, 0.48, 2.92, C.white, 0.098);
  box(0.99, 0.16, 0.52, -3.63, 0.61, 3.68, C.paper, 0.075);
  box(1.53, 0.12, 1.44, -3.63, 0.60, 2.59, C.green, 0.058);
  box(1.54, 0.066, 0.24, -3.63, 0.67, 3.19, C.paleGreen, 0.030);
  for (const z of [2.12, 2.20, 2.29]) box(1.43, 0.011, 0.018, -3.63, 0.665, z, C.paleGreen, 0.004);

  cylinder(0.022, 0.022, 0.57, -1.34, 3.29, -0.44, C.charcoal);
  const shade = cylinder(0.14, 0.39, 0.24, -1.34, 2.90, -0.44, C.clay);
  shade.material = shade.material.clone();
  const bulb = oval(-1.34, 2.775, -0.44, 0.10, 0.055, 0.10, C.paper);
  bulb.material = bulb.material.clone();
  bulb.material.emissive.set(0xffbc70);
  bulb.material.emissiveIntensity = 1.4;

  const skyLight = new THREE.HemisphereLight(0xfff1d3, 0x927659, 1.4);
  scene.add(skyLight);
  const sun = new THREE.DirectionalLight(0xffe2af, 2.4);
  sun.position.set(3.1, 4.1, -9);
  sun.target.position.set(0.8, 0.7, 0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 28 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  const lamp = new THREE.PointLight(0xffb97c, 17, 9, 2);
  lamp.position.set(-1.34, 2.70, -0.44);
  scene.add(lamp);
  const fill = new THREE.DirectionalLight(0xffe2cd, 0.68);
  fill.position.set(-3, 2, 5);
  scene.add(fill);

  shade.material.emissive.set(0x9b4f28);

  function setTime(minute) {
    const index = lighting.findIndex((style) => style.minute > minute);
    const before = lighting[index - 1];
    const after = lighting[index];
    const ratio = THREE.MathUtils.smoothstep(minute, before.minute, after.minute);
    const intensity = (key) => THREE.MathUtils.lerp(before[key], after[key], ratio);
    scene.background.lerpColors(before.sky, after.sky, ratio);
    scene.fog.color.copy(scene.background);
    skyLight.color.lerpColors(before.bounce, after.bounce, ratio);
    skyLight.intensity = intensity('ambient');
    sun.color.lerpColors(before.sun, after.sun, ratio);
    sun.intensity = intensity('key');
    lamp.intensity = intensity('lamp');
    fill.intensity = intensity('fill');
    shade.material.emissiveIntensity = lamp.intensity / 75;
    city.light(minute);
  }

  const projection = new THREE.Vector3();
  const holder = canvas.parentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const keys = new Set();
  let drag = null;
  let playing = false;
  let yaw = 0;
  let pitch = 0;
  let lookYaw = 0;
  let lookPitch = 0;
  let target = null;
  let eyeHeight = 1.65;
  let dimensions = { width: 1, height: 1 };
  let previous = performance.now();
  let transit = createTransit();
  let busHeading = 0;
  const walk = createWalk([
    [-5.43, -5.19, -5.06, 5.15], [-5.42, 5.42, 4.92, 5.16],
    [-5.42, 5.42, -4.94, -4.70],
    [5.19, 5.43, -5.06, 0.74], [5.19, 5.43, 2.16, 5.15],
    [-2.725, -0.075, -1.225, 0.325], // Dining table
    [-2.05, -1.45, 0.60, 1.18], [-2.13, -1.53, -2.08, -1.50], // Chairs
    [1.695, 4.085, -3.765, -3.015], // Sideboard
    [4.375, 5.045, -2.475, -1.005], // Savings cabinet
    [-4.545, -1.795, -4.605, -3.715], // Work cabinet
    [-4.43, -2.83, 1.80, 4.10], // Bed
    ...obstacles,
    ...city.obstacles,
    ...workplaces.obstacles,
    ...bus.obstacles,
  ], cityLimits);

  function goalAt(point) {
    const dx = point[0] - camera.position.x;
    const dy = point[1] - camera.position.y;
    const dz = point[2] - camera.position.z;
    lookYaw = yaw + Math.atan2(Math.sin(Math.atan2(-dx, -dz) - yaw), Math.cos(Math.atan2(-dx, -dz) - yaw));
    lookPitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  function spawn(moment, active = true, savedPosition, savedTransit) {
    playing = active;
    target = null;
    keys.clear();
    walk.stop();
    transit = createTransit(savedTransit);
    meal.visible = moment !== 'dawn';
    bread.visible = moment === 'breakfast';
    stew.visible = moment === 'dinner';
    renderer.shadowMap.needsUpdate = true;
    if (!active) {
      camera.position.set(-0.86, 1.65, 3.42);
      goalAt([0.28, 1.25, -2.65]);
    } else if (moment === 'dawn') {
      camera.position.set(2.88, 1.65, 1.84);
      goalAt([1.72, 1.52, -3.72]);
    } else {
      camera.position.set(moment === 'breakfast' ? -1.28 : -0.72, 1.31, 0.86);
      goalAt([-1.66, 1.07, -0.75]);
    }
    if (active && savedPosition && walk.canStand(savedPosition.x, savedPosition.z)
      && Number.isFinite(savedPosition.yaw) && Number.isFinite(savedPosition.pitch)) {
      const y = Number.isFinite(savedPosition.y) ? THREE.MathUtils.clamp(savedPosition.y, 1.31, 1.65) : 1.65;
      camera.position.set(savedPosition.x, y, savedPosition.z);
      lookYaw = Math.atan2(Math.sin(savedPosition.yaw), Math.cos(savedPosition.yaw));
      lookPitch = THREE.MathUtils.clamp(savedPosition.pitch, -0.75, 0.62);
    }
    eyeHeight = camera.position.y;
    yaw = lookYaw;
    pitch = lookPitch;
    const service = readTransit(transit);
    busHeading = service.heading;
    bus.place(service.x, service.z, busHeading);
    if (transit.aboard) {
      bus.sit(camera.position);
      yaw = lookYaw = busHeading;
      pitch = lookPitch = -0.04;
      eyeHeight = camera.position.y;
    }
  }

  function resize() {
    const width = Math.max(1, holder.clientWidth);
    const height = Math.max(1, holder.clientHeight);
    dimensions = { width, height };
    camera.aspect = width / height;
    camera.fov = width < height ? 68 : 58;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function disembark(stop) {
    const { x, z } = stops[stop].platform;
    camera.position.set(x, 1.65, z);
    yaw = lookYaw = stop === 'shops' ? Math.PI : Math.PI / 2;
    pitch = lookPitch = 0;
    eyeHeight = 1.65;
    target = null;
    keys.clear();
    walk.stop();
  }

  function frame(now) {
    const wallTime = Math.max(0, now - previous);
    const elapsed = Math.min(0.045, wallTime / 1000);
    previous = now;
    if (playing) {
      if (!document.hidden) {
        const ride = advanceBus(transit, wallTime);
        transit = ride.transit;
        if (ride.dropoff) disembark(ride.dropoff);
      }
      const service = readTransit(transit);
      const turn = Math.atan2(Math.sin(service.heading - busHeading), Math.cos(service.heading - busHeading));
      const rotation = turn * (1 - Math.exp(-elapsed * 8));
      busHeading += rotation;
      bus.place(service.x, service.z, busHeading);
      if (transit.aboard) {
        bus.sit(camera.position);
        eyeHeight = camera.position.y;
        yaw += rotation;
        lookYaw += rotation;
      }

      const forward = Number(keys.has('w')) - Number(keys.has('s'));
      const right = Number(keys.has('d')) - Number(keys.has('a'));
      const rotate = Number(keys.has('arrowleft')) - Number(keys.has('arrowright'));
      const tilt = Number(keys.has('arrowup')) - Number(keys.has('arrowdown'));
      if (rotate || tilt) {
        target = null;
        lookYaw += rotate * elapsed * 1.1;
        lookPitch = THREE.MathUtils.clamp(lookPitch + tilt * elapsed, -0.75, 0.62);
      }
      if (!transit.aboard && (forward || right)) {
        eyeHeight = 1.65;
        target = null;
      }
      if (!transit.aboard) walk.step(camera.position, yaw, elapsed, forward, right);
    }
    if (target) goalAt(target);
    camera.position.y = reducedMotion.matches ? eyeHeight : THREE.MathUtils.damp(camera.position.y, eyeHeight, 7, elapsed);
    yaw = reducedMotion.matches ? lookYaw : THREE.MathUtils.damp(yaw, lookYaw, 14, elapsed);
    pitch = reducedMotion.matches ? lookPitch : THREE.MathUtils.damp(pitch, lookPitch, 14, elapsed);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    if (!reducedMotion.matches) {
      curtains.forEach((curtain, i) => { curtain.rotation.x = Math.sin(now / 1800 + i) * 0.014; });
      ripples.forEach((ripple, i) => {
        ripple.scale.setScalar(1 + Math.sin(now / 730 - i * 1.2) * 0.065);
      });
    }
    city.update(camera.position);
    characters.update(now, reducedMotion.matches, camera.position);
    renderer.render(scene, camera);
    if (playing) {
      const zone = transit.aboard ? 'bus' : neighborhoodZone(camera.position);
      function project(point, areaVisible) {
        projection.set(...point).project(camera);
        const x = (projection.x + 1) * dimensions.width / 2;
        const y = (1 - projection.y) * dimensions.height / 2;
        const visible = areaVisible && projection.z < 1 && projection.z > -1
          && x > 35 && x < dimensions.width - 35
          && y > (dimensions.width <= 680 ? 148 : 114) && y < dimensions.height - 128;
        return { x, y, visible };
      }
      const locations = Object.fromEntries(Object.entries(landmarks)
        .map(([id, point]) => [id, project(point, zone === 'home')]));
      const station = workplaces.anchors[zone];
      const atCounter = station && atWorkCounter(zone, camera.position);
      const customer = atCounter ? characters.waitingCustomer(zone) : null;
      locations.job = atCounter && !customer ? project(station, true) : { visible: false };
      locations.customer = customer ? { ...project(customer.point, true), guest: customer.guest } : { visible: false };
      const stop = transit.aboard ? null : nearbyStop(camera.position);
      locations.transport = stop ? project(bus.stopPositions[stop], true) : { visible: false };
      for (const [id, position, close] of characters.nearby(camera.position, zone)) locations[id] = project(position, close);
      onAnchors(locations, dimensions, zone);
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!playing || event.button !== 0) return;
    target = null;
    drag = [event.clientX, event.clientY];
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    lookYaw -= (event.clientX - drag[0]) * 0.0045;
    lookPitch = THREE.MathUtils.clamp(lookPitch - (event.clientY - drag[1]) * 0.0045, -0.75, 0.62);
    drag = [event.clientX, event.clientY];
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(event, () => { drag = null; });
  }
  new ResizeObserver(resize).observe(holder);
  document.addEventListener('visibilitychange', () => { previous = performance.now(); });
  resize();
  spawn('breakfast', false);
  setTime(438);
  renderer.setAnimationLoop(frame);
  return {
    spawn,
    setTime,
    position() {
      return { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw, pitch };
    },
    zone() { return transit.aboard ? 'bus' : neighborhoodZone(camera.position); },
    transit() { return transit; },
    localizeTransit(labels) { bus.localize(labels); },
    talk(id) { characters.talk(id); },
    board() {
      const ride = boardBus(transit, camera.position);
      if (ride === transit) return false;
      transit = ride;
      keys.clear();
      walk.stop();
      target = null;
      bus.sit(camera.position);
      yaw = lookYaw = busHeading;
      pitch = lookPitch = -0.045;
      return true;
    },
    leaveBus() {
      const ride = leaveBus(transit);
      transit = ride.transit;
      if (ride.dropoff) disembark(ride.dropoff);
    },
    localizeWorkplaces(labels) { workplaces.localize(labels); },
    showShop(occupation, units, visit) {
      workplaces.stock(occupation, units);
      characters.shopVisit(occupation, visit);
    },
    focus(id) {
      target = id === 'door' ? doorway : landmarks[id] ?? null;
    },
    lookToward({ x, z }) { target = [x, 1.6, z]; },
    key(key, active) { if (active) keys.add(key); else keys.delete(key); },
    stop() {
      keys.clear();
      walk.stop();
    },
    funded(active) {
      lantern.material.emissive.set(active ? 0xffb351 : 0x000000);
      lantern.material.emissiveIntensity = active ? 1.75 : 0;
      streetLight.intensity = active ? 13 : 0;
    },
  };
}
