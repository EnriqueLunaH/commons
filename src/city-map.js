import { blockSize, cityBlocks, cityLimits, destinations } from './city-layout.js';
import { commuteRoute, workplaces } from './employment.js';
import { busRoute, stops } from './transit.js';

const districtTones = {
  street: '#dfceb1',
  residential: '#c9ae95',
  market: '#be8970',
  downtown: '#9ba9a8',
  park: '#aab28a',
  centralPark: '#8f9b71',
};

export function drawCityMap(canvas, position, language, wholeCity, occupation) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const inset = 20;
  const length = wholeCity ? cityLimits[1] - cityLimits[0] : blockSize * 4;
  const scale = (size - inset * 2) / length;
  const left = Math.min(Math.max(position.x - length / 2, cityLimits[0]), cityLimits[1] - length);
  const top = Math.min(Math.max(position.z - length / 2, cityLimits[2]), cityLimits[3] - length);
  const mapX = (x) => inset + (x - left) * scale;
  const mapY = (z) => inset + (z - top) * scale;
  const inside = (x, y) => x >= inset && y >= inset && x <= size - inset && y <= size - inset;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#e9dcc3';
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.rect(inset, inset, size - inset * 2, size - inset * 2);
  ctx.clip();
  const road = wholeCity ? 6 : 8;
  for (const block of cityBlocks) {
    const x = mapX(block.x - (blockSize - road) / 2);
    const y = mapY(block.z - (blockSize - road) / 2);
    const width = (blockSize - road) * scale;
    if (x + width < inset || y + width < inset || x > size - inset || y > size - inset) continue;
    ctx.fillStyle = districtTones[block.zone];
    ctx.fillRect(x, y, width, width);
    if (!wholeCity) {
      ctx.fillStyle = '#6f63554a';
      for (const building of block.buildings) {
        ctx.fillRect(mapX(building.x - building.width / 2), mapY(building.z - building.depth / 2),
          building.width * scale, building.depth * scale);
      }
    }
  }

  function point(x, z, label, color, faceWest = false) {
    const px = mapX(x);
    const py = mapY(z);
    if (!inside(px, py)) return;
    ctx.beginPath();
    ctx.arc(px, py, wholeCity ? 3 : 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (label) {
      ctx.font = '600 14px system-ui';
      ctx.textAlign = (faceWest && px > 96) || px > size - 130 ? 'right' : 'left';
      ctx.fillText(label, px + (ctx.textAlign === 'right' ? -8 : 8), py + 4);
    }
  }

  if (!wholeCity) {
    ctx.beginPath();
    ctx.moveTo(mapX(busRoute[0].x), mapY(busRoute[0].z));
    for (const { x, z } of busRoute.slice(1)) ctx.lineTo(mapX(x), mapY(z));
    ctx.strokeStyle = '#627e7c';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const { platform } of Object.values(stops)) {
      ctx.fillStyle = '#627e7c';
      ctx.fillRect(mapX(platform.x) - 3, mapY(platform.z) - 3, 6, 6);
    }
    const route = commuteRoute(occupation);
    ctx.beginPath();
    ctx.moveTo(mapX(route[0].x), mapY(route[0].z));
    for (const { x, z } of route.slice(1)) ctx.lineTo(mapX(x), mapY(z));
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = '#a56842';
    ctx.lineWidth = 2.1;
    ctx.stroke();
    ctx.setLineDash([]);
    point(0, 0, language.zones.home, '#554333', true);
    const work = workplaces[occupation];
    point(work.x, work.z, language.employment.sites[occupation], '#a56842');
    for (const [name, place] of Object.entries(destinations)) {
      point(place.x, place.z, language.zones[name], '#554333');
    }
  }
  const px = mapX(position.x);
  const py = mapY(position.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-position.yaw);
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(5.5, 6.5);
  ctx.lineTo(0, 4);
  ctx.lineTo(-5.5, 6.5);
  ctx.closePath();
  ctx.fillStyle = '#364944';
  ctx.strokeStyle = '#fff1d6';
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ctx.fill();
  ctx.restore();
  ctx.restore();

  ctx.fillStyle = '#65503a';
  ctx.font = '700 11px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('N', inset, inset - 6);
  const bar = wholeCity ? 1_000 : 100;
  ctx.textAlign = 'right';
  ctx.fillText(wholeCity ? '1 km' : '100 m', size - inset, size - 6);
  ctx.strokeStyle = '#65503a';
  ctx.lineWidth = 2;
  const barEnd = size - inset - 43;
  ctx.beginPath();
  ctx.moveTo(barEnd - bar * scale, size - 11);
  ctx.lineTo(barEnd, size - 11);
  ctx.stroke();
}
