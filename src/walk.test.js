import test from 'node:test';
import assert from 'node:assert/strict';
import { createWalk } from './walk.js';

const limits = [-12, 28, -23, 10];
const frame = 1 / 60;

function hold(walk, position, yaw, forward, right, frames = 60) {
  for (let i = 0; i < frames; i++) walk.step(position, yaw, frame, forward, right);
}

test('WASD moves relative to the current view without a diagonal speed boost', () => {
  const forward = { x: 0, z: 0 };
  const diagonal = { x: 0, z: 0 };
  const turned = { x: 0, z: 0 };
  hold(createWalk([], limits), forward, 0, 1, 0);
  hold(createWalk([], limits), diagonal, 0, 1, 1);
  hold(createWalk([], limits), turned, -Math.PI / 2, 1, 0);
  assert.ok(forward.z < -1.8);
  assert.ok(diagonal.x > 0 && diagonal.z < 0);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) + forward.z) < 1e-9);
  assert.ok(Math.abs(turned.x + forward.z) < 1e-9);
});

test('the door is walkable and its adjoining wall blocks the player', () => {
  const obstacles = [[5.19, 5.43, -5.06, 0.74], [5.19, 5.43, 2.16, 5.15]];
  const door = { x: 4, z: 1.45 };
  const wall = { x: 4, z: 0 };
  hold(createWalk(obstacles, limits), door, -Math.PI / 2, 1, 0, 110);
  hold(createWalk(obstacles, limits), wall, -Math.PI / 2, 1, 0, 110);
  assert.ok(door.x > 7);
  assert.ok(wall.x <= 5.05);
});

test('stopping on pause clears momentum, and walls allow motion along their faces', () => {
  const wall = [[0.2, 0.4, -5, 5]];
  const position = { x: 0, z: 0 };
  const walk = createWalk(wall, limits);
  hold(walk, position, 0, 1, 1);
  assert.ok(position.x <= 0.061);
  assert.ok(position.z < -1.2);
  const before = { ...position };
  walk.stop();
  hold(walk, position, 0, 0, 0);
  assert.deepEqual(position, before);
});
