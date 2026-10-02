// dev/sabotage-394-ending-record.js — proves the ending judges the hero from the record and makes its keepsake:
// the HERO line, the sourced closing instruction, the invent-no-failing clause, and the signed-in memento save.
//   node dev/sabotage-394-ending-record.js
var sabotage = require("./sabotage.js");
var rc1 = sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "the hero's sheet no longer reaches the ending (the HERO line is dropped)",
      find: '  lines.push("HERO: "+c.name+" — "+(_hb.length?_hb.join("; "):"the sheet records no trait, flaw or motivation; judge the hero only by the DEFINING MOMENTS below"));', replace: '' },
    { label: "the closing verdict loses its source in the told variant",
      find: 'told to its last act. Write its denouement: prose only, no tags, no headings, no meta commentary, 300-500 words. Honour every recorded fact below; invent nothing that contradicts them; leave the unfinished threads unfinished, named. The hero lives: end on the hero and the world they made, the story\'s threads at rest. Close with one short paragraph naming what the tale changed in the hero, or refused to change — drawn ONLY from the DEFINING MOMENTS and the hero\'s recorded trait, flaw and motivation below; where the sheet records none, name what the moments show, and invent no failing the record never played.',
      replace: 'told to its last act. Write its denouement: prose only, no tags, no headings, no meta commentary, 300-500 words. Honour every recorded fact below; invent nothing that contradicts them; leave the unfinished threads unfinished, named. The hero lives: end on the hero and the world they made, the story\'s threads at rest. Close with one short paragraph naming what the tale changed in the hero, or refused to change.' }
  ]
});
var rc2 = sabotage.prove({
  file: "game.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "the ending no longer saves the memento when signed in",
      find: '&&storageAdapter.hasToken())saveNarrativeMemento();', replace: '&&storageAdapter.hasToken()){}' },
    { label: "the ending saves the memento even when signed out (a failing toast at every ending)",
      find: '&&typeof storageAdapter.hasToken==="function"&&storageAdapter.hasToken())saveNarrativeMemento();', replace: ')saveNarrativeMemento();' }
  ]
});
process.exit(rc1 || rc2);
