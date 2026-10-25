// demo/preset-store.js — the toy's preset list: the built-ins and the looks saved on this browser.
//
// Pure apart from the storage it is handed ({ getItem, setItem }, localStorage in the toy), so node
// tests it with a fake. Saved presets are a JSON array under `key`. A stored entry that is not a good
// preset (render/presets.js ▸ presetProblem) is left out and named in `dropped`; storage that cannot
// be read is said in `loadProblem` — the toy shows both, never swallows them. A saved preset whose
// name a built-in now has (a look moved into the built-ins) is retired when its look is the
// built-in's, and kept under a free name ("Jade (saved)") when it differs, listed in `renamed`;
// either way storage is rewritten, so nothing is lost and nothing is listed twice.
//
//   const store = createPresetStore(localStorage);
//   store.list()                 // built-ins first ({ builtIn: true }), then saved ones in the order saved
//   store.save('Night', style)   // → { replaced }: a saved preset of that name (any case) is replaced
//   store.remove('Night')        // a saved preset; a built-in cannot be removed
//   store.match(style)           // the first preset showing exactly this look, or null

import { DIE_PRESETS, presetProblem, presetStyle, sameLook } from '../render/presets.js';

export const PRESETS_KEY = 'dice-sim:presets';

export function createPresetStore(storage, { key = PRESETS_KEY, builtIn = DIE_PRESETS } = {}) {
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  let saved = [];
  const dropped = [];
  const renamed = [];
  let loadProblem = null;
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) throw new Error('the stored presets are not a list');
    for (const p of parsed) {
      const problem = presetProblem(p);
      if (problem) dropped.push(problem);
      else saved.push({ name: p.name.trim(), ...presetStyle(p) });
    }
  } catch (e) {
    loadProblem = 'Saved presets could not be read (' + e.message + ').';
    saved = [];
  }
  // Looks that became built-ins.
  const taken = (name) => builtIn.some((b) => same(b.name, name)) || saved.some((s) => same(s.name, name));
  let changed = false;
  saved = saved.filter((s) => {
    const b = builtIn.find((x) => same(x.name, s.name));
    if (!b) return true;
    changed = true;
    return !sameLook(b, s);
  });
  for (const s of saved) {
    if (!builtIn.some((b) => same(b.name, s.name))) continue;
    let name = s.name + ' (saved)';
    for (let n = 2; taken(name); n++) name = s.name + ' (saved ' + n + ')';
    renamed.push({ from: s.name, to: name });
    s.name = name;
  }
  if (changed) {
    try { storage.setItem(key, JSON.stringify(saved)); } catch (e) {
      loadProblem = 'Presets now built in could not be cleared from this browser\'s saved list (' + e.message + ').';
    }
  }
  const persist = () => {
    try { storage.setItem(key, JSON.stringify(saved)); } catch (e) {
      throw new Error('Could not store the presets on this browser (' + e.message + ').');
    }
  };
  return {
    get dropped() { return dropped.slice(); },
    get loadProblem() { return loadProblem; },
    get renamed() { return renamed.slice(); },
    list() { return [...builtIn.map((p) => ({ ...p, builtIn: true })), ...saved.map((p) => ({ ...p, builtIn: false }))]; },
    find(name) { return this.list().find((p) => same(p.name, name)) || null; },
    match(style) { return this.list().find((p) => sameLook(p, style)) || null; },
    save(name, style) {
      const p = { name: typeof name === 'string' ? name.trim() : name, ...style };
      const problem = presetProblem(p);
      if (problem) throw new Error(problem.charAt(0).toUpperCase() + problem.slice(1) + '.');
      if (builtIn.some((b) => same(b.name, p.name))) throw new Error('"' + p.name + '" is a built-in preset: pick another name.');
      const entry = { name: p.name, ...presetStyle(p) };
      const at = saved.findIndex((s) => same(s.name, p.name));
      const before = saved.slice();
      if (at >= 0) saved[at] = entry; else saved.push(entry);
      try { persist(); } catch (e) { saved = before; throw e; }
      return { replaced: at >= 0 };
    },
    remove(name) {
      if (builtIn.some((b) => same(b.name, name))) throw new Error('"' + name + '" is a built-in preset and cannot be deleted.');
      const at = saved.findIndex((s) => same(s.name, name));
      if (at < 0) throw new Error('No saved preset is called "' + name + '".');
      const before = saved.slice();
      saved.splice(at, 1);
      try { persist(); } catch (e) { saved = before; throw e; }
    },
  };
}
