// dev/sabotage-606-refused-rename.js — proves #606 is guarded: a rename REFUSED for a collision moves nothing (no row is written,
// no equipped flag moves, the refusal is said), and an accepted rename keeps the flag on its row. The retired wornRename's shape —
// the handler moving the mark whatever the rename returned — is put back in each handler and must be caught.
//   node dev/sabotage-606-refused-rename.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#606 refused rename"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var HERO = "#606 refused rename on the hero", COMP = "#606 refused rename on a companion", TWIN = "#606 refused rename's twin";
prove("inventory.js", [
  { label: "the refused rename writes the row anyway (two rows named Sword, the receipt still says refused)",
    find: 'R.muts.push("⚠ "+label+m2);return false;', replace: 'R.muts.push("⚠ "+label+m2);inv[hit].name=String(newName).trim();return false;',
    mustFail: HERO },
  { label: "the refusal goes unsaid (the console still warns; the player's receipt is gone)",
    find: 'if(R&&R.muts)R.muts.push("⚠ "+label+m2);', replace: '',
    mustFail: HERO },
  { label: "an accepted rename drops the equipped flag (the renamed sword is no longer worn)",
    find: 'rows[i].name=nm;return {ok:true,row:rows[i]};', replace: 'rows[i].name=nm;rows[i].equipped=false;return {ok:true,row:rows[i]};',
    mustFail: TWIN }
]);
prove("tag_table.js", [
  { label: "the hero handler moves the mark whatever the rename returned (wornRename's old shape: a refused Sword→Blade leaves the Blade worn)",
    find: 'renameInventoryItem(worldState.character.inventory,irm[1].trim(),irm[2].trim(),R,null);',
    replace: 'renameInventoryItem(worldState.character.inventory,irm[1].trim(),irm[2].trim(),R,null);(function(v,a,b){var x=invFind(v,a),y=invFind(v,b);if(x>=0&&y>=0&&x!==y&&v[x].equipped){v[y].equipped=true;v[x].equipped=false;}})(worldState.character.inventory,irm[1].trim(),irm[2].trim());',
    mustFail: HERO },
  { label: "the companion handler moves the mark whatever the rename returned",
    find: 'renameInventoryItem(crCs.inventory,crm[2].trim(),crm[3].trim(),R,crOwner);',
    replace: 'renameInventoryItem(crCs.inventory,crm[2].trim(),crm[3].trim(),R,crOwner);(function(v,a,b){var x=invFind(v,a),y=invFind(v,b);if(x>=0&&y>=0&&x!==y&&v[x].equipped){v[y].equipped=true;v[x].equipped=false;}})(crCs.inventory,crm[2].trim(),crm[3].trim());',
    mustFail: COMP }
]);
process.exit(code);
