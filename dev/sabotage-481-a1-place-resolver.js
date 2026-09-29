// dev/sabotage-481-a1-place-resolver.js — proves the #481 A1 guards are guarded: LOCATION_ITEM's place operand, the
// SUBLOCATION arrival, fileSubLocation and the SOUNDSCAPE target must all go through the ONE place resolver, and the
// resolver's case/article-insensitive step must stay (else "The Village Hall" is refused again, as at Village t216 when a
// tomb-iron core was destroyed, and case twins like the Runelords shop are minted again). Each mutation runs in a
// disposable clone (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-481-a1-place-resolver.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 A1"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("memory.js", [
  { label: "the item filer composes its key raw again (the t216 refusal)",
    find: '    var _rp=(typeof resolvePlaceName==="function")?resolvePlaceName(String(place).trim()):null;\n', replace: '    var _rp=null;\n',
    mustFail: "the item filer accepts every naming the arrival accepts" },
  { label: "fileSubLocation mints twins again",
    find: '  var _rp=(typeof resolvePlaceName==="function")?resolvePlaceName(name,parent):null;\n', replace: '  var _rp=null;\n',
    mustFail: "never mints a twin" },
  { label: "the soundscape target composes raw again",
    find: '    var _rpA=(typeof resolvePlaceName==="function")?resolvePlaceName(v.target):null;', replace: '    var _rpA=null;',
    mustFail: "the soundscape target resolves" }
]);
prove("identity.js", [
  { label: "the resolver loses its case/article-insensitive step",
    find: '  var want=placeNameNorm(nm);if(!want)return null;\n', replace: '  return null;\n',
    mustFail: "never mints a twin" }
]);
prove("tag_table.js", [
  { label: "the arrival bypasses the resolver",
    find: '  var _rp=(typeof resolvePlaceName==="function")?resolvePlaceName(_sln):null,', replace: '  var _rp=null,',
    mustFail: "never mints a twin" }
]);
process.exit(code);
