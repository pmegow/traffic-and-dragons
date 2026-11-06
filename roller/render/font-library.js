// One loading path for bundled, installed and imported fonts. Every unavailable face resolves
// to system-ui, including a lost file, denied access, bad data or a stalled load.
import { NUMERAL_FONTS, numeralFont, nameImportedFont, cssFontString } from './numeral-fonts.js';
import { createFontStore } from './font-store.js';

export function createFontLibrary({
  store = createFontStore(),
  makeFace = (name, source, options) => new FontFace(name, source, options),
  addFace = face => document.fonts.add(face),
  digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''),
  report = message => console.warn('Dice fonts: ' + message),
  timeout = 5000,
} = {}) {
  const loads = new Map(), states = new Map();
  const bounded = async promise => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('font access timed out')), timeout); })]); }
    finally { clearTimeout(timer); }
  };
  const announce = (key, value) => {
    states.set(key, value);
  };
  const sources = {
    bundled: source => 'url(' + cssFontString(new URL('../' + source.value, import.meta.url).href) + ')',
    local: source => 'local(' + cssFontString(source.value) + ')',
    file: async source => {
      const record = await store.get(source.value);
      if (!record?.bytes) throw new Error('the imported file is not saved on this device');
      nameImportedFont(record.key, record.label);
      return record.bytes;
    },
  };
  const load = async key => {
    const font = numeralFont(key);
    const source = font.source || (font.file ? { kind: 'bundled', value: font.file } : null);
    if (!source) { announce(key, { font, message: '', ready: true }); return font; }
    announce(key, { font: NUMERAL_FONTS.system, message: 'Loading ' + font.label + '…', ready: false });
    try {
      // Adding the face happens AFTER the deadline, so a timed-out load cannot later change a mask behind the view.
      const face = await bounded((async () => makeFace(font.face, await sources[source.kind](source), { weight: font.weights || font.weight }).load())());
      addFace(face);
      announce(key, { font, message: '', ready: true });
      return font;
    } catch (error) {
      const message = font.label + ' is unavailable; using the system font. ' + error.message;
      report(message);
      announce(key, { font: NUMERAL_FONTS.system, message, ready: true });
      return NUMERAL_FONTS.system;
    }
  };
  return {
    ready(key) {
      if (!loads.has(key)) loads.set(key, load(key));
      return loads.get(key);
    },
    state: key => states.get(key),
    effective(key) {
      const font = numeralFont(key);
      return states.get(key)?.font || (font.source || font.file ? NUMERAL_FONTS.system : font);
    },
    async listImported() {
      const records = await store.list();
      return records.map(({ key, label }) => { nameImportedFont(key, label); return { key, label }; });
    },
    async importFile(file) {
      if (!file || !/\.(ttf|otf)$/i.test(file.name)) throw new Error('Choose a .ttf or .otf font file.');
      if (!(file.size > 0) || file.size > 32 * 1024 * 1024) throw new Error('Choose a nonempty font file smaller than 32 MB.');
      const bytes = await file.arrayBuffer();
      const key = 'file:' + await digest(bytes);
      const font = numeralFont(key);
      const label = file.name.replace(/\.(ttf|otf)$/i, '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 200) || 'Imported font';
      const face = await bounded(makeFace(font.face, bytes, { weight: font.weight }).load());
      await store.put({ key, label, bytes });
      nameImportedFont(key, label);
      addFace(face);
      announce(key, { font, message: '', ready: true });
      loads.set(key, Promise.resolve(font));
      return { key, label };
    },
  };
}

export const fontLibrary = createFontLibrary();
