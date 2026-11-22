import test from 'node:test';
import assert from 'node:assert/strict';
import { cityBlocks, cityBlockAt, cityLimits, blockSize, blocksPerSide, destinations } from './city-layout.js';
import { createWalk } from './walk.js';

test('the whole city has connected blocks with reserved streets, a home block and varied districts', () => {
  assert.equal(cityBlocks.length, blocksPerSide ** 2);
  assert.equal(cityLimits[1] - cityLimits[0], 3_040);
  assert.equal(cityLimits[3] - cityLimits[2], 3_040);
  assert.equal(cityBlockAt(0, 0).zone, 'street');
  assert.equal(cityBlockAt(...[cityLimits[1], cityLimits[3]]), undefined);
  assert.deepEqual(Object.fromEntries(Object.entries(destinations).map(([id, point]) =>
    [id, cityBlockAt(point.x, point.z).zone])), {
    downtown: 'downtown', market: 'market', centralPark: 'centralPark',
  });
  assert.ok(cityBlocks.filter((block) => block.zone === 'park').length > 50);
  assert.ok(cityBlocks.some((block) => block.buildings.some((building) => building.floors === 14)));
  for (const block of cityBlocks) {
    for (const building of block.buildings) {
      assert.ok(Math.abs(building.x - block.x) + building.width / 2 < blockSize / 2 - 6);
      assert.ok(Math.abs(building.z - block.z) + building.depth / 2 < blockSize / 2 - 6);
    }
  }
});

test('the city collision grid detects walls across cell edges and keeps the avenue walkable', () => {
  const building = [71.9, 84, -57, -48];
  const walk = createWalk([building], cityLimits);
  assert.equal(walk.canStand(71.85, -51), false);
  assert.equal(walk.canStand(72.1, -51), false);
  assert.equal(walk.canStand(40, -51), true);
  assert.equal(walk.canStand(NaN, -51), false);
});
