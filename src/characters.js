import * as THREE from 'three';
import { workplaces } from './employment.js';
import { customers, residents } from './residents.js';

const walkingPeriod = 7_800;

export function buildCharacters({ scene, box, oval, colors: C }) {
  let talking = null;
  let visit = null;
  const figures = Object.entries({ ...residents, ...customers }).map(([id, person], index) => {
    const group = new THREE.Group();
    scene.add(group);
    const customer = Object.hasOwn(customers, id);
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
    if (person.place && person.place !== 'outdoors') box(0.25, 0.26, 0.036, 0, 0.96, -0.124, C.paper, 0.016, group);
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
    const bag = customer ? box(0.15, 0.24, 0.13, -0.08, -0.38, -0.06, 0xc3a47d, 0.023, arms[0]) : null;
    const bouquet = customer ? new THREE.Group() : null;
    if (bouquet) {
      arms[0].add(bouquet);
      box(0.08, 0.19, 0.07, -0.08, -0.35, -0.06, C.green, 0.024, bouquet);
      oval(-0.08, -0.20, -0.06, 0.09, 0.085, 0.085, 0xd591a4, bouquet);
    }
    group.traverse((child) => { child.castShadow = false; });
    if (customer) group.visible = false;
    return { id, place: person.place, group, arms, feet, trail: person.trail, offset: index * 1_700, bag, bouquet };
  });

  function animateGait(figure, gait) {
    for (let index = 0; index < 2; index++) {
      const direction = index ? 1 : -1;
      figure.arms[index].rotation.x = gait * direction;
      figure.feet[index].rotation.x = -gait * direction;
    }
  }

  return {
    shopVisit(occupation, customer) { visit = customer ? { ...customer, occupation } : null; },
    update(now, reduceMotion, viewer) {
      for (const figure of figures) {
        const { id, group, trail, offset, bag, bouquet } = figure;
        if (!trail) {
          group.visible = visit?.guest === id;
          if (!group.visible) continue;
          const { x, z, depth } = workplaces[visit.occupation];
          const entry = z - depth / 2;
          const path = [[x + 1.45, entry - 1.3], [x, entry - 0.4], [x - 0.39, z - 0.22]];
          const stage = Math.min(path.length - 2, Math.floor(visit.progress * (path.length - 1)));
          const [start, end] = path.slice(stage, stage + 2);
          const fraction = visit.progress * (path.length - 1) - stage;
          group.position.set(THREE.MathUtils.lerp(start[0], end[0], fraction), 0,
            THREE.MathUtils.lerp(start[1], end[1], fraction));
          const direction = visit.phase === 'leaving' ? -1 : 1;
          group.rotation.y = visit.phase === 'waiting' ? Math.PI
            : Math.atan2((start[0] - end[0]) * direction, (start[1] - end[1]) * direction);
          bag.visible = visit.bought && visit.occupation === 'bakery';
          bouquet.visible = visit.bought && visit.occupation === 'florist';
          animateGait(figure, reduceMotion || visit.phase === 'waiting' ? 0 : Math.sin(now / 185) * 0.24);
          continue;
        }
        const [start, end] = trail;
        if (id === talking) {
          group.rotation.y = Math.atan2(group.position.x - viewer.x, group.position.z - viewer.z);
          animateGait(figure, 0);
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
        animateGait(figure, gait);
      }
    },
    talk(id) { talking = id; },
    nearby(position, zone) {
      return figures.filter(({ place }) => place).map(({ id, group, place }) => {
        const { x, z } = group.position;
        const inArea = place === 'outdoors'
          ? !['home', 'bus', 'bakery', 'florist'].includes(zone) : zone === place;
        return [id, [x, 1.56, z], inArea && Math.hypot(x - position.x, z - position.z) <= 2.65];
      });
    },
  };
}
