// The shared Numbers font control. Installed fonts are requested only by a user gesture;
// font-file import works without browser font enumeration. Both select the same preset key.
import { NUMERAL_FONTS, numeralFont, localFontKey, validFontKey } from '../render/numeral-fonts.js';
import { fontLibrary } from '../render/font-library.js';

export function bindFontPicker({ select, browse, importButton, fileInput, notice, preview }) {
  const groups = new Map();
  let busy = false;
  const say = message => { notice.textContent = message; };
  const add = (key, label, groupName) => {
    let option = [...select.options].find(o => o.value === key);
    if (option) { option.textContent = label; return; }
    if (!groups.has(groupName)) {
      const group = document.createElement('optgroup'); group.label = groupName;
      groups.set(groupName, group); select.appendChild(group);
    }
    groups.get(groupName).appendChild(new Option(label, key));
  };
  for (const key of ['sans', 'system', 'classic', 'gothic']) add(key, NUMERAL_FONTS[key].label, 'Built in');
  const ensure = key => {
    if (validFontKey(key)) add(key, numeralFont(key).label, key.startsWith('file:') ? 'Imported fonts' : 'Installed fonts');
  };
  const show = async () => {
    const key = select.value;
    const font = await fontLibrary.ready(key);
    if (select.value !== key) return;
    preview.style.fontFamily = font.family;
    preview.style.fontWeight = font.weight;
    if (!busy) say(fontLibrary.state(key)?.message || '');
  };
  const refresh = async () => {
    try { for (const { key, label } of await fontLibrary.listImported()) add(key, label, 'Imported fonts'); }
    catch (error) { console.warn('Dice font library:', error); say('Saved font files could not be read. ' + error.message); }
  };
  browse.hidden = typeof window.queryLocalFonts !== 'function';
  browse.addEventListener('click', async () => {
    busy = true; browse.disabled = true; say('Opening your font library…');
    try {
      const fonts = await window.queryLocalFonts();
      for (const font of fonts.sort((a, b) => a.fullName.localeCompare(b.fullName))) {
        add(localFontKey(font.postscriptName), font.fullName, 'Installed fonts');
      }
      say(fonts.length ? 'Choose an installed font from Numbers font.' : 'No installed fonts were shared. You can import a font file.');
      select.focus();
    } catch (error) {
      console.warn('Dice installed fonts:', error);
      say('Could not open installed fonts. You can import a font file. ' + error.message);
    } finally { busy = false; browse.disabled = false; }
  });
  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    busy = true; importButton.disabled = true; say('Loading your font…');
    try {
      const { key, label } = await fontLibrary.importFile(file);
      add(key, label, 'Imported fonts');
      select.value = key;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      say('Font saved on this device.');
    } catch (error) {
      console.error('Dice font import:', error);
      say('Could not import this font. ' + error.message);
    } finally { busy = false; importButton.disabled = false; fileInput.value = ''; }
  });
  select.addEventListener('change', show);
  refresh();
  return {
    ensure,
    select(key) { ensure(key); select.value = key; show(); },
  };
}
