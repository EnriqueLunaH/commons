export const blockSize = 76;
export const blocksPerSide = 40;
const halfCity = blocksPerSide / 2;
const originX = -36;
const originZ = -26;
const span = halfCity * blockSize;
export const cityLimits = [originX - span, originX + span, originZ - span, originZ + span];

export const destinations = {
  downtown: { x: 42, z: -106 },
  market: { x: 42, z: -64 },
  centralPark: { x: 45.5, z: -3.8 },
};

export const mainStreets = (index) => index === 1 || index % 5 === 0;

const coloredPlaster = [0xd4ba97, 0xd2ab88, 0xb9b399, 0xc29079, 0xc6bdad, 0xacae9e];
const roofTiles = [0x986455, 0xa36d54, 0x777865, 0x8d7d69, 0x88715f];
const cityColors = [0xc3ad94, 0xadb1a0, 0xcfae93, 0xc3b9a9, 0x9dada9, 0xb38c78];
const cores = [[2, -2], [-10, -9], [11, 8], [-9, 12]];

function randomFor(i, j) {
  let state = (Math.imul(i + 131, 374761393) ^ Math.imul(j + 257, 668265263)) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4_294_967_296;
  };
}

function blockZone(i, j, random) {
  if (i === 0 && j === 0) return 'street';
  if (i === 1 && j === 0) return 'centralPark';
  if (i === 1 && j === -1) return 'market';
  if ((i === 2 && j === -1) || (i === -2 && j === -2)) return 'park';
  if (random() < 0.078) return 'park';

  const density = Math.min(...cores.map(([x, z]) => Math.max(Math.abs(i - x), Math.abs(j - z))));
  if (density <= 1 || (density <= 3 && random() < 0.42)) return 'downtown';
  if ((mainStreets(i) || mainStreets(j)) && random() < 0.38) return 'market';
  return 'residential';
}

function architecture(zone, random) {
  if (zone === 'downtown') return random() < 0.40 ? 14 : random() < 0.60 ? 10 : 7;
  if (zone === 'market') return random() < 0.50 ? 3 : 5;
  return random() < 0.53 ? 2 : random() < 0.70 ? 4 : 7;
}

function makeBlock(i, j) {
  const random = randomFor(i, j);
  const pick = (items) => items[Math.floor(random() * items.length)];
  const x = originX + i * blockSize + blockSize / 2;
  const z = originZ + j * blockSize + blockSize / 2;
  const zone = blockZone(i, j, random);
  const block = { i, j, x, z, zone, buildings: [], trees: [] };
  if (zone === 'street') return block;

  if (zone === 'park' || zone === 'centralPark') {
    for (const side of [-1, 1]) {
      for (const across of [-1, 1]) {
        for (let index = 0; index < 4; index++) {
          const sx = 9.5 + random() * 17;
          const sz = 9.5 + random() * 17;
          block.trees.push({ x: x + side * sx, z: z + across * sz, size: 1.22 + random() * 1.08 });
        }
      }
    }
    return block;
  }

  const columns = zone === 'downtown' || random() < 0.22 ? 2 : 3;
  const parcel = 58 / columns;
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < columns; column++) {
      const floors = architecture(zone, random);
      const width = parcel * (0.53 + random() * 0.22);
      const depth = 13 + random() * 8;
      block.buildings.push({
        x: x - 29 + (column + 0.5) * parcel + random() * 2 - 1,
        z: z + (row ? 14.25 : -14.25),
        width, depth, floorHeight: floors > 5 ? 3.05 : 2.85, floors,
        walls: pick(floors > 5 ? cityColors : coloredPlaster),
        roof: pick(roofTiles),
        storefront: zone === 'market',
        front: row ? 1 : -1,
      });
    }
  }
  for (const side of [-1, 1]) {
    block.trees.push({ x: x + side * 25.5, z, size: 1.18 + random() * 0.8 });
  }
  return block;
}

export const cityBlocks = Array.from({ length: blocksPerSide ** 2 }, (_, index) => {
  const i = index % blocksPerSide - halfCity;
  const j = Math.floor(index / blocksPerSide) - halfCity;
  return makeBlock(i, j);
});

export function cityBlockAt(x, z) {
  const i = Math.floor((x - cityLimits[0]) / blockSize);
  const j = Math.floor((z - cityLimits[2]) / blockSize);
  if (i < 0 || i >= blocksPerSide || j < 0 || j >= blocksPerSide) return undefined;
  return cityBlocks[j * blocksPerSide + i];
}
