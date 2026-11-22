import * as THREE from 'three';
import { residents } from './residents.js';

const walkingPeriod = 7_800;

export function buildCharacters({ scene, box, oval, colors: C }) {
  let talking = null;
  const figures = Object.entries(residents).map(([id, person], index) => {
    const group = new THREE.Group();
    scene.add(group);
    const { skin, hair, coat, pants } = person;
    const arms = [];
    const feet = [];

    box(0.34, 0.44, 0.235, 0, 1.07, 0, coat, 0.082, group);
    box(0.27, 0.13, 0.218, 0, 0.81, 0, pants, 0.039, group);
    oval(0, 1.40, -0.006, 0.123, 0.155, 0.115, skin, group);
    oval(0, 1.49, 0.012, 0.127, 0.081, 0.111, hair, group);
    if (id === 'ines' || id === 'mara') oval(0, 1.365, 0.076, 0.116, 0.147, 0.063, hair, group);
    if (id === 'luz') {
      box(0.25, 0.115, 0.221, 0, 1.58, 0.01, C.white, 0.048, group);
      oval(0, 1.64, 0.012, 0.131, 0.078, 0.12, C.white, group);
    }
    if (person.place !== 'outdoors') box(0.25, 0.26, 0.036, 0, 0.96, -0.124, C.paper, 0.016, group);
    for (const side of [-1, 1]) {
      oval(side * 0.041, 1.401, -0.113, 0.012, 0.014, 0.010, C.charcoal, group);
      const arm = new THREE.Group();
      arm.position.set(side * 0.193, 1.23, 0.005);
      group.add(arm);
      box(0.098, 0.282, 0.105, side * 0.025, -0.11, 0, coat, 0.042, arm);
      oval(side * 0.04, -0.277, -0.004, 0.048, 0.065, 0.045, skin, arm);
      arms.push(arm);
      const leg = new THREE.Group();
      leg.position.set(side * 0.087, 0.813, 0);
      group.add(leg);
      box(0.126, 0.69, 0.145, 0, -0.353, 0.004, pants, 0.035, leg);
      box(0.151, 0.115, 0.255, 0, -0.766, -0.065, C.darkWood, 0.041, leg);
      feet.push(leg);
    }
    group.traverse((child) => { child.castShadow = false; });
    const [start, end] = person.trail;
    return { id, place: person.place, group, arms, feet, start, end, offset: index * 1_700 };
  });

  return {
    update(now, reduceMotion, viewer) {
      for (const { id, group, arms, feet, start, end, offset } of figures) {
        if (id === talking) {
          group.rotation.y = Math.atan2(group.position.x - viewer.x, group.position.z - viewer.z);
          for (const limb of [...arms, ...feet]) limb.rotation.x = 0;
          continue;
        }
        const time = (now + offset) % walkingPeriod;
        const progress = time < 3_900 ? time / 3_900 : (walkingPeriod - time) / 3_900;
        const step = THREE.MathUtils.smoothstep(progress, 0.09, 0.91);
        const direction = time < 3_900 ? 1 : -1;
        const dx = end[0] - start[0];
        const dz = end[1] - start[1];
        group.position.set(start[0] + dx * step, 0, start[1] + dz * step);
        group.rotation.y = Math.atan2(-dx * direction, -dz * direction);
        const gait = reduceMotion ? 0 : Math.sin(time / 250) * Math.sin(Math.PI * step) * 0.18;
        for (let i = 0; i < 2; i++) {
          arms[i].rotation.x = gait * (i ? 1 : -1);
          feet[i].rotation.x = gait * (i ? -1 : 1);
        }
      }
    },
    talk(id) { talking = id; },
    nearby(position, zone) {
      return figures.map(({ id, group, place }) => {
        const { x, z } = group.position;
        const inArea = place === 'outdoors'
          ? !['home', 'bus', 'bakery', 'florist'].includes(zone) : zone === place;
        return [id, [x, 1.56, z], inArea && Math.hypot(x - position.x, z - position.z) <= 2.65];
      });
    },
  };
}
