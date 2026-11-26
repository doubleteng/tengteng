// Mixed-radix appearance IDs let the room assign a distinct look if two
// browsers happen to pick the same outfit. The ID has no personal information.
const coats = [0x41786d,0xb34e42,0xd2a03f,0x4a75a7,0x98739f,0x778747,0x384657,0xdb7951,0x287e8d,0x7e364f,0xa59576,0x5f57a1];
const trousers = [0x394754,0x5a514b,0x4f614f,0x34333e,0x7c6e5e,0x455878];
const skins = [0x704831,0x966449,0xb77c60,0xd09a75,0xe3b592,0xf0cbb1];
const hairColors = [0x302623,0x513b31,0x785339,0xaf8d5d,0x989992];
const bags = [0xb26a42,0x5d7469,0x445974,0x985a68,0x756644];
export const appearanceCount = coats.length*trousers.length*skins.length*hairColors.length*3*bags.length;
export const randomLook = () => crypto.getRandomValues(new Uint32Array(1))[0] % appearanceCount;
function mix(a,b,k) {
  const channel = shift => Math.round(((a>>shift)&255)*(1-k)+((b>>shift)&255)*k);
  return (channel(16)<<16)|(channel(8)<<8)|channel(0);
}
export function visitorLook(id) {
  let value=id;
  const take=n=>{const index=value%n;value=Math.floor(value/n);return index;};
  const jacket=coats[take(coats.length)],pants=trousers[take(trousers.length)],skin=skins[take(skins.length)];
  const hair=hairColors[take(hairColors.length)],style=take(3),canvas=bags[take(bags.length)];
  return {jacket,aqua:mix(jacket,0xf1eddd,.22),deep:mix(jacket,0x172630,.36),trousers:pants,seam:mix(pants,0xefdece,.15),
    skin,lips:mix(skin,0x952f41,.38),cheek:mix(skin,0xd67767,.32),hair,hairLight:mix(hair,0xe7c59c,.22),
    canvas,flap:mix(canvas,0xe2c690,.26),binding:mix(canvas,0x34252a,.42),style};
}
