// Pure tabletop appearance schema. Physics belongs to the material, never its color or sheen.
import { SURFACE_LOOKS } from './surface-looks.js';
export const TABLE_FINISHES = {
  default: { label: 'Material Default' },
  matte: { label: 'Matte', roughness: 0.95 },
  satin: { label: 'Satin', roughness: 0.5 },
  gloss: { label: 'Gloss', roughness: 0.22 },
};
export function tableStyle(value = {}) {
  if (!value || typeof value !== 'object') throw Error('Invalid tabletop style');
  const surface = value.surface ?? 'none', finish = value.finish ?? 'default';
  if (!Object.hasOwn(SURFACE_LOOKS, surface)) throw Error('Unknown tabletop material: ' + surface);
  if (!Object.hasOwn(TABLE_FINISHES, finish)) throw Error('Unknown tabletop finish: ' + finish);
  const base = value.base === undefined ? SURFACE_LOOKS[surface].color ?? null : value.base;
  if (base !== null && (typeof base !== 'string' || !/^#[0-9a-f]{6}$/i.test(base))) throw Error('Invalid tabletop base color');
  if (base === null && SURFACE_LOOKS[surface].pattern !== null) throw Error('This tabletop material needs a base color');
  return { surface, base: base?.toLowerCase() ?? null, finish };
}
export function tableLook(value) {
  const style = tableStyle(value), material = SURFACE_LOOKS[style.surface];
  return { ...material, ...(style.base === null ? {} : {color:style.base, pattern:material.pattern ?? 'plain'}),
    ...(TABLE_FINISHES[style.finish].roughness === undefined ? {} : {roughness:TABLE_FINISHES[style.finish].roughness}) };
}
export function sameTableLook(a,b) {
  const x=tableStyle(a), y=tableStyle(b);
  return x.surface===y.surface && x.base===y.base && x.finish===y.finish;
}
export function tablePresetProblem(p) {
  if (!p || typeof p.name !== 'string' || !p.name.trim() || p.name.trim().length>40) return 'tabletop preset needs a name of 1–40 characters';
  try { tableStyle(p); return null; } catch(e) { return e.message; }
}
export const TABLE_PRESETS = [
  {name:'Plain',surface:'none'},
  // TnD website/themes.css, light --bg0 (2026-11-09).
  {name:'TnD light',surface:'none',base:'#b0a68b',finish:'matte'},
  {name:'Green Felt',surface:'felt'},
  {name:'Blood Red Felt',surface:'felt',base:'#8b0808'},
  {name:'Blue Felt',surface:'felt',base:'#274c72'},
  {name:'Oak',surface:'wood',base:'#b88b51'},
  {name:'Walnut',surface:'wood',base:'#60402b'},
  {name:'Cherry',surface:'wood',base:'#934b36'},
  {name:'Stone',surface:'stone'},
  {name:'Brushed Steel',surface:'brushedMetal'},
].map(p=>({name:p.name,...tableStyle(p)}));
