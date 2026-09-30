// tests-481-g3-todo-viewer.js — #481 G3 (audit 2026-09-29; owner ruling: TRULY read-only): CLAUDE.md said the TODO viewer
// never writes, yet it could save TODO.md in place — a save with no edits changed four rows ([SAY:…|x] → …\|x] in #6, #370,
// #437, #477), its Renumber rewrote 44 of 45 open row numbers, and the lint passed both. Now every write and edit path is gone
// (Export, Renumber, Add, Edit, Delete, Complete, Restore, the status toggle, drag-reorder); the READ handle stays. Fable's
// contract bans createWritable, showSaveFilePicker, renumber( and _downloadMd. All TODO edits stay with Claude.
// (The real-browser half — a live TODO.md renders with no edit control — is dev/tests-481-g3-todo-viewer-browser.js.)
//   node dev/tests-481-g3-todo-viewer.js
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const src = fs.readFileSync(path.join(__dirname, '..', 'todo-viewer.html'), 'utf8');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS #481 G3 ' + name); } catch (e) { failed++; console.error('FAIL #481 G3 ' + name + ' — ' + (e && e.message || e)); } }
test('Fable\'s contract: no createWritable, no showSaveFilePicker, no renumber(, no _downloadMd', () => {
  ['createWritable', 'showSaveFilePicker', 'renumber(', '_downloadMd'].forEach(w => assert.ok(src.indexOf(w) < 0, 'the viewer still carries ' + w));
});
test('no edit path survives: export, add, edit, delete, complete, restore, the status toggle, drag-reorder', () => {
  ['buildMd(', 'exportMd(', 'doAddTask(', 'showAddTask(', 'startEditTask(', 'saveEditTask(', 'deleteTask(', 'completeTask(', 'restoreTask(', 'toggleDone(', 'clearDone(', 'draggable=', 'add-task-bar', 'mode:"readwrite"', "mode:'readwrite'"]
    .forEach(w => assert.ok(src.indexOf(w) < 0, 'the viewer still carries ' + w));
});
test('the read handle stays: open, refresh, the stored handle, drag-and-drop', () => {
  ['showOpenFilePicker', 'getFile()', 'function refresh(', 'requestPermission({mode:"read"})', 'function readFile('].forEach(w => assert.ok(src.indexOf(w) >= 0, 'the read path lost ' + w));
  assert.ok(/window\.__todoViewerTest\s*=/.test(src), 'the test seam (window.__todoViewerTest) is missing');
});
console.log('#481 G3 TODO VIEWER: ' + failed + ' failed, ' + passed + ' passed');
process.exit(failed ? 1 : 0);
