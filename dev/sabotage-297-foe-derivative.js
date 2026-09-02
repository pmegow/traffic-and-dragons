// sabotage-297-foe-derivative.js — mutation proof for the #297 foe-routing guard: a DERIVATIVE foe
// name (possessive / extra words after a foe's name) must never route to the foe it derives from.
// Playtest v1767 t8: [ENEMY_SLAIN:Nolan Grimtide's raider] slew Nolan Grimtide himself. Each clause
// must make dev/run-tests.js FAIL; a mutation changing no bytes is a hard failure.
// Usage: node dev/sabotage-297-foe-derivative.js
var sabotage=require("./sabotage.js"),rc=0;
rc|=sabotage.prove({
  file:"tag_table.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#297: reverse containment restored — the possessive slays the boss again",
      mustFail:"a DERIVATIVE foe name never routes",
      find:"if(fn.indexOf(t)>=0||_foeQueryNames(t,fn))hits.push(f[i]);",
      replace:"if(fn.indexOf(t)>=0||t.indexOf(fn)>=0)hits.push(f[i]);" },
    { label:"#297: the possessive check dies — 'Nolan Grimtide's raider' routes to Nolan again",
      mustFail:"a DERIVATIVE foe name never routes",
      find:"  if(after===\"'\"||after===\"\\u2019\")return false;",
      replace:"" },
    { label:"#297: the word-boundary check dies — a name glued inside another word routes",
      mustFail:"a DERIVATIVE foe name never routes",
      find:"  if(/[a-z0-9]/.test(before)||/[a-z0-9]/.test(after))return false;",
      replace:"" }
  ]
});
process.exit(rc?1:0);
