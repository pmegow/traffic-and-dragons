// Tabletop controls own only tabletop appearance/storage. Dice presets never enter this boundary.
import { tableStyle, TABLE_FINISHES, TABLE_PRESETS, tablePresetProblem, sameTableLook } from '../render/tabletop-style.js';
import { createPresetStore } from './preset-store.js';
import { attachColorPicker } from './color-picker.js';
const STATE_KEY = 'dice-sim:tabletop';
export function bindTabletop({ view, storage, onChange }) {
  const $ = id => document.getElementById(id), notice = $('table-notice');
  const report = error => { notice.textContent = error.message; console.error('tabletop:', error); };
  const store = createPresetStore(storage, {key:'dice-sim:table-presets',builtIn:TABLE_PRESETS,
    problem:tablePresetProblem,style:tableStyle,sameLook:sameTableLook});
  const warnings = [storage.blocked && 'Storage is blocked: tabletop choices last only this visit.',store.loadProblem,
    ...store.dropped, ...store.renamed.map(p=>'Saved tabletop "'+p.from+'" is now "'+p.to+'".')].filter(Boolean);
  if (warnings.length) report(Error(warnings.join(' ')));
  let current = tableStyle({surface:$('surface').value}), materials = Object.create(null);
  try {
    const raw = storage.getItem(STATE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      current = tableStyle(saved.current);
      for (const [key,value] of Object.entries(saved.materials ?? {})) {
        const style = tableStyle(value);
        if (style.surface !== key) throw Error('Saved tabletop material does not match its key');
        materials[key] = style;
      }
    }
  } catch(e) { report(Error('Could not restore tabletop choices: '+e.message)); }
  for (const [key,finish] of Object.entries(TABLE_FINISHES)) $('table-finish').add(new Option(finish.label,key));
  const picker = attachColorPicker($('table-color'));
  function syncPresets(name) {
    const selected = store.find(name ?? $('table-preset').value);
    const match = selected && sameTableLook(selected,current) ? selected : store.match(current);
    $('table-preset').replaceChildren(new Option('Custom Tabletop',''));
    $('table-preset').options[0].disabled = true;
    for (const [label,builtIn] of [['Built In',true],['Saved',false]]) {
      const entries = store.list().filter(p=>p.builtIn===builtIn);
      if (!entries.length) continue;
      const group = document.createElement('optgroup'); group.label = label;
      for (const p of entries) group.appendChild(new Option(p.name,p.name));
      $('table-preset').appendChild(group);
    }
    $('table-preset').value = match?.name ?? '';
    $('table-preset-delete').disabled = !match || match.builtIn;
  }
  function apply(persist = true) {
    current = tableStyle(current);
    view.setSurface(current.surface,current);
    $('surface').value = current.surface;
    $('stage').dataset.surface = current.surface;
    $('table-color').value = current.base ?? '#303744';
    $('table-finish').value = current.finish;
    picker.sync(); syncPresets();
    materials[current.surface] = current;
    if (persist) {
      storage.setItem(STATE_KEY,JSON.stringify({current,materials}));
      onChange();
    }
  }
  const action = fn => () => { try { fn(); } catch(e) { report(e); } };
  $('surface').addEventListener('change',action(()=>{
    const surface = $('surface').value;
    current = materials[surface] ?? tableStyle({surface});
    $('table-preset-name').value = '';
    apply();
  }));
  $('table-color').addEventListener('input',action(()=>{current={...current,base:$('table-color').value};apply();}));
  $('table-finish').addEventListener('change',action(()=>{
    current={...current,finish:$('table-finish').value,base:current.base ?? $('table-color').value};apply();
  }));
  $('table-preset').addEventListener('change',action(()=>{
    const preset = store.find($('table-preset').value);
    if (!preset) throw Error('The selected tabletop preset is unavailable');
    current=tableStyle(preset); $('table-preset-name').value=preset.builtIn?'':preset.name;apply();
  }));
  const save = action(()=>{store.save($('table-preset-name').value,current); syncPresets($('table-preset-name').value);});
  $('table-preset-save').addEventListener('click',save);
  $('table-preset-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();save();}});
  $('table-preset-delete').addEventListener('click',action(()=>{
    const name=$('table-preset').value;store.remove(name);$('table-preset-name').value=name;syncPresets();
  }));
  apply(false);
}
