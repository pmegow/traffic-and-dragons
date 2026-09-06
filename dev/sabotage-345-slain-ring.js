// dev/sabotage-345-slain-ring.js — proves the #345 source fix is guarded: the combat-slain ring must be
// written at KILL time by every kill path, and an open conflict must heal when the kill lands.
//   node dev/sabotage-345-slain-ring.js
var sabotage = require("./sabotage.js");
var rc = sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js", "class bible (#72)"]],
  cases: [
    { label: "[ENEMY_SLAIN:] goes back to marking the tracker only (the ring waits for the close — the v1823 ordering)",
      find: 'else{kfoe.hp=0;foeSlain(kfoe,R);/* #345: the ring at kill time */', replace: 'else{kfoe.hp=0;kfoe.down="slain";' },
    { label: "[ENEMY_HP:] to 0 stops writing the ring",
      find: '}else foeSlain(foe,R);/* #345 */', replace: '}else foe.down="slain";' },
    { label: "the victory sweep stops writing the ring",
      find: '_ceLive[_cl].hp=0;foeSlain(_ceLive[_cl],R);/* #345 */', replace: '_ceLive[_cl].hp=0;_ceLive[_cl].down="slain";' },
    { label: "the heal is dropped from the ring write (an open conflict outlives the kill)",
      find: '  if(typeof _w2HealCombatSlain==="function")_w2HealCombatSlain(nm,R);\n', replace: '' }
  ]
});
process.exit(rc);
