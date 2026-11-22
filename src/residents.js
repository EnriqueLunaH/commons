export const residents = {
  ines: { name: 'Inés', skin: 0xb88266, hair: 0x4f392e, coat: 0xa16a56, pants: 0x646d60,
    trail: [[7.55, 2.31], [7.94, 2.95]], place: 'outdoors' },
  nico: { name: 'Nico', skin: 0x8a5f49, hair: 0x34322e, coat: 0x687d7a, pants: 0x6d6050,
    trail: [[9.03, -2.48], [9.00, -1.83]], place: 'outdoors' },
  luz: { name: 'Luz', skin: 0xd3a07d, hair: 0x6b4b38, coat: 0xe0caab, pants: 0x986955,
    trail: [[14.03, 10.32], [15.46, 10.34]], place: 'bakery' },
  mara: { name: 'Mara', skin: 0xb47761, hair: 0x514135, coat: 0x899477, pants: 0x79676a,
    trail: [[20.36, 13.53], [21.89, 13.55]], place: 'florist' },
};

export const residentIds = Object.keys(residents);

export function rememberedShift(employment) {
  if (!['returning', 'finished'].includes(employment.stage)) return null;
  return { day: employment.shiftDay, occupation: employment.occupation };
}
