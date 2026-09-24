// sabotage-437-motivation-lifecycle.js — mutation proof for #437: a companion's motivation lifecycle
// (settle → none standing → born by the story). Clauses: the settle archives before it empties, the
// paperwork refusal on birth, the tag's motivation axis, the prompt's "none standing" line, the
// extractor belt (companions only), and the generator's no-books rule + the reviewer's REGISTER
// dimension. Usage: node dev/sabotage-437-motivation-lifecycle.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","#437 motivation lifecycle"]];
rc|=sabotage.prove({
  file:"helpers.js",
  command:CMD,
  cases:[
    { label:"#437: a settled purpose is dropped instead of archived",
      mustFail:"#437 pure: motivationSettle",
      find:"  cs.motivationHistory.push(rec);cs.motivation=\"\";return rec;",
      replace:"  cs.motivation=\"\";return rec;" },
    { label:"#437: a paperwork purpose is written",
      mustFail:"#437 pure: motivationSettle",
      find:"  if(hits.length)return {refused:hits};\n",
      replace:"" },
    { label:"#437: the settled line repeats the old purpose's words",
      mustFail:"#437 pure: motivationSettle",
      find:'  return "settled"+(last.camp?" in "+last.camp:"")+": "+(last.how||"settled");',
      replace:'  return "settled"+(last.camp?" in "+last.camp:"")+": "+last.text+" — "+(last.how||"settled");' }
  ]
});
rc|=sabotage.prove({
  file:"tag_table.js",
  command:CMD,
  cases:[
    { label:"#437: the tag's motivation axis is dead (falls through to the flaw path)",
      mustFail:"#437 tag: [COMPANION_GROWTH:Name|motivation|settled: how]",
      find:'  if(/^motivation$/i.test(gm[2].trim())){',
      replace:'  if(false){' },
    { label:"#437: a refused paperwork purpose leaves no mutation line",
      mustFail:"#437 tag: [COMPANION_GROWTH:Name|motivation|settled: how]",
      find:'R.muts.push("⚠ "+gname+"\'s new purpose refused — a paperwork purpose (',
      replace:'if(false)R.muts.push("⚠ "+gname+"\'s new purpose refused — a paperwork purpose (' }
  ]
});
rc|=sabotage.prove({
  file:"api.js",
  command:CMD,
  cases:[
    { label:"#437: a settled purpose vanishes from PARTY HISTORIES instead of reading as closed",
      mustFail:"#437 prompt: PARTY HISTORIES",
      find:'else if(ml)pers+=" motivation — none standing ("+ml+");";',
      replace:'' },
    { label:"#437: the ending forgets the settled purpose",
      mustFail:"#437 prompt: PARTY HISTORIES",
      find:'else if(_ml)bits.push("purpose settled ("+_ml+")");',
      replace:'' }
  ]
});
rc|=sabotage.prove({
  file:"memory.js",
  command:CMD,
  cases:[
    { label:"#437: the belt settles the hero's purpose too",
      mustFail:"#437 belt: the extractor's motivationChanges",
      find:"_mcCs=(!memoryNpcIsPlayer(_mcN)&&typeof findCompanionChar===\"function\")?findCompanionChar(_mcN):null;",
      replace:"_mcCs=(typeof findCompanionChar===\"function\")?findCompanionChar(_mcN):null;if(!_mcCs&&memoryNpcIsPlayer(_mcN))_mcCs=worldState.character;" },
    { label:"#437: the extraction schema forgets the field",
      mustFail:"#437 belt: the extractor's motivationChanges",
      find:'\\"motivationChanges\\":[{\\"name\\":\\"party member\\",',
      replace:'\\"motivationChangesX\\":[{\\"name\\":\\"party member\\",' }
  ]
});
rc|=sabotage.prove({
  file:"game.js",
  command:CMD,
  cases:[
    { label:"#437: the generator's no-books rule is gone",
      mustFail:"#437 generator: the freeform skeleton prompt",
      find:'    +"- THIS WORLD KEEPS NO BOOKS: never build the premise, an act or an arc on a debt, ledger, contract, tax, toll, tithe, creditor or paperwork of any kind',
      replace:'    +"- This world keeps its own counsel: never build the premise, an act or an arc on a debt, ledger, contract, tax, toll, tithe, creditor or paperwork of any kind' }
  ]
});
rc|=sabotage.prove({
  file:"campaign_generator.js",
  command:CMD,
  cases:[
    { label:"#437: the reviewer's REGISTER dimension is gone",
      mustFail:"#437 generator: the freeform skeleton prompt",
      find:'    +"\\n- REGISTER: a premise, act or arc built on a debt, ledger, contract, tax, toll, tithe, creditor or paperwork of any kind',
      replace:'    +"\\n- BOOKS: a premise, act or arc built on a debt, ledger, contract, tax, toll, tithe, creditor or paperwork of any kind' }
  ]
});
process.exit(rc?1:0);
