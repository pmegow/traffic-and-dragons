// Scratch-only named proofs for the inventory census CLI (gate 7 since #599 (c): the ENGINE heals, the tool's own oracle
// judges — these clauses break the ORACLE and expect the suite to see the engine and the oracle disagree). No source mutation.
const fs = require('fs'), path = require('path'), os = require('os');
const sabotage = require('./sabotage.js');
const source = path.join(__dirname, 'census-inventory-rows.js');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-599-census-proof-'));
const file = path.join(scratch, 'census-inventory-rows.js');
const original = fs.readFileSync(source);
fs.writeFileSync(file, original.toString().replace('require("./load-engine.js")', 'require(' + JSON.stringify(path.join(__dirname, 'load-engine.js')) + ')'));
const prior = process.env.CENSUS_TOOL;
process.env.CENSUS_TOOL = file;
// Per-clause repository targets let diff discovery and applicability inspect the
// original source; prove() mutates only the absolute disposable copy supplied above.
try {
  process.exitCode = sabotage.prove({file, command:[process.execPath, [path.join(__dirname, 'tests-599-legacy-census.js')]], cases:[
    {file:'dev/census-inventory-rows.js', label:'erased equipped membership is rejected', find:'rows[idx[wk]].equipped = true', replace:'rows[idx[wk]].equipped = false', mustFail:'FAIL legacy census equipped membership:'},
    {file:'dev/census-inventory-rows.js', label:'reordered carried rows are rejected', find:'return { rows: rows, wornUnmatched: unmatched };', replace:'rows.reverse(); return { rows: rows, wornUnmatched: unmatched };', mustFail:'FAIL legacy census ordinary strings:'},
    {file:'dev/census-inventory-rows.js', label:'skipped unsupported mixed input is rejected', find:'var inv = s.inventory; S.sheets++; S.items += inv.length;', replace:'var inv = s.inventory.filter(function(e) { return typeof e === "string"; }); S.sheets++; S.items += inv.length;', mustFail:'FAIL legacy census unsupported mixed:'},
    {file:'dev/census-inventory-rows.js', label:'lost units are rejected', find:'var r = parseStored(list[i]); r.equipped = false;', replace:'var r = parseStored(list[i]); r.qty = 1; r.equipped = false;', mustFail:'FAIL legacy census unit conservation:'}
  ]});
} finally {
  if (prior === undefined) delete process.env.CENSUS_TOOL; else process.env.CENSUS_TOOL = prior;
  if (!fs.readFileSync(source).equals(original)) throw Error('source checker changed during scratch proof');
  const resolved = fs.realpathSync(scratch), temp = fs.realpathSync(os.tmpdir());
  if (path.dirname(resolved) !== temp || !path.basename(resolved).startsWith('tnd-599-census-proof-')) throw Error('unexpected proof cleanup path');
  fs.rmSync(resolved, {recursive:true, force:true});
}
