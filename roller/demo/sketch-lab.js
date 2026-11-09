// An isolated comparison surface; it never reads or writes the standalone app's saved looks.
import { DiceView, DIE_PRESETS, presetStyle } from '../render/index.js';
import { exitMenu } from '../render/exit-table.js';
import { VERSION, MAX_DICE } from '../src/index.js';
const $ = id => document.getElementById(id);
const post = !new URLSearchParams(location.search).has('surface');
$('version').textContent = 'v' + VERSION;
$('compare').textContent = post ? 'Compare with surface hatching' : 'Compare with post-process hatching';
$('compare').href = post ? '?surface' : location.pathname;
if (!post) $('mode').textContent = 'Surface hatching comparison. No saved settings are changed.';
for (const { name, label } of exitMenu()) $('exit').add(new Option(label, name));
$('exit').value = 'scurry';
let view, busy = true, seed = 47;
const looks = ['Sketch', 'Teal Glass', 'Ink Sketch'].map(name => presetStyle(DIE_PRESETS.find(p => p.name === name)));
const say = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error', error); };
const buttons = () => { for (const id of ['roll', 'clear', 'add', 'paper', 'ink']) $(id).disabled = busy; };
async function bake(task) {
  if (busy) return;
  busy = true; buttons();
  try { await task(); } catch (error) { say(error.message, true); console.error('Sketch prototype:', error); }
  finally { busy = false; buttons(); }
}
$('roll').addEventListener('click', () => bake(async () => {
  view.clear();
  const result = await view.bakeAsync({ dice: ['d20', 'd20', 'd6', 'd6'], seed: seed++ });
  result.looks = [looks[0], looks[1], looks[2], looks[1]];
  view.play(result).catch(error => { say(error.message, true); console.error(error); });
  say('Sketch + Ink Sketch + two glass dice. Play Exit, then drop a d20 before they finish.');
}));
$('clear').addEventListener('click', () => {
  view.clear({ exit: $('exit').value }).catch(error => { say(error.message, true); console.error(error); });
  say('Exit running. You can drop another die now.');
});
$('add').addEventListener('click', () => bake(async () => {
  if (view.dice.length >= MAX_DICE) throw new Error('The table is full. Play an exit before adding another die.');
  const fromTable = view.dice.length, styles = view.dieStyles();
  const result = await view.bakeDropAsync(['d20'], { seed: seed++ });
  result.looks = [...styles, looks[Number($('add-look').value)]];
  view.play(result, { fromTable }).catch(error => { say(error.message, true); console.error(error); });
  say('A d20 is joining the table while existing exits continue.');
}));
for (const id of ['paper', 'ink']) $(id).addEventListener('input', () => {
  for (const index of [0, 2]) looks[index] = { ...looks[index], body: $('paper').value, ink: $('ink').value };
  for (const d of [...view.dice, ...[...view.exiting].map(r => r.die)]) {
    const style = looks.find(s => s.finish === d.style.finish);
    if (style && style.finish !== 'glass') view.dress(d, style);
  }
  view.render();
});
let drag;
$('view').addEventListener('pointerdown', e => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; $('view').setPointerCapture(e.pointerId); });
$('view').addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id || !view) return; view.orbit((e.clientX - drag.x) * .3, (e.clientY - drag.y) * .3); drag.x = e.clientX; drag.y = e.clientY; });
for (const event of ['pointerup', 'pointercancel']) $('view').addEventListener(event, () => { drag = null; });
$('view').addEventListener('wheel', e => { e.preventDefault(); view?.zoom(Math.exp(e.deltaY * .001)); }, { passive: false });
try {
  view = new DiceView({ container: $('view'), sketchPostprocess: post, zoom: .9, speed: 1.2 });
  window.__sketchLab = { view, looks };
  await view.setDieBag({ bag: looks });
  await view.warmUp();
  busy = false; buttons(); say('Ready. Roll the mixed set to begin.');
  document.documentElement.dataset.sketchReady = 'true';
} catch (error) { say('Could not start the preview: ' + error.message, true); console.error(error); }
