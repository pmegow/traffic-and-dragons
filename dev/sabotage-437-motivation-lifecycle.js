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
    { label:"#515: the settle keyword matches without its separator again ('Done running: …' settles instead of standing)",
      mustFail:"#515 the summary's fallback",
      find:"var MOTIVATION_SETTLED_RE=/^\\s*(settled|fulfilled|done|closed|abandoned|outgrown)\\b\\s*(?:[:—\\-]\\s*|$)/i;",
      replace:"var MOTIVATION_SETTLED_RE=/^\\s*(settled|fulfilled|done|closed|abandoned|outgrown)\\b\\s*[:—\\-]?\\s*/i;" },
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
      find:'  return "settled"+(last.camp?" in "+last.camp:"")+(opts&&opts.omitHow?"":": "+(last.how||"settled"));',
      replace:'  return "settled"+(last.camp?" in "+last.camp:"")+(opts&&opts.omitHow?"":": "+last.text+" — "+(last.how||"settled"));' }
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
      replace:'\\"motivationChangesX\\":[{\\"name\\":\\"party member\\",' },
    { label:"#515: the belt births over a standing purpose again (the tagged purpose is archived as replaced, a second toast follows)",
      mustFail:"#515 the summary's fallback",
      find:"if(typeof _mc.now===\"string\"&&_mc.now.trim()&&typeof _mcCs.motivation===\"string\"&&_mcCs.motivation.trim()){",
      replace:"if(false){" },
    { label:"#515: 'none' becomes the purpose again",
      mustFail:"#515 the summary's fallback",
      find:"if(typeof _mc.now===\"string\"&&/^(none|n\\/a|na|unknown|unchanged|same|—|-)$/i.test(_mc.now.trim())){",
      replace:"if(false){" }
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
rc|=sabotage.prove({
  "file": "memory.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#437 motivation lifecycle"
    ]
  ],
  "cases": [
    {
      "label": "#437: an archived settlement retires the later tagged purpose",
      "mustFail": "#437 replay:",
      "find": "  if(archived)return {settle:false};",
      "replace": "  if(archived)return {settle:true};"
    },
    {
      "label": "#437: missing settlement references are guessed from current state",
      "mustFail": "#437 reference:",
      "find": "  if(!purpose)return {refused:\"settlement has no exact settledPurpose reference\"};",
      "replace": "  if(!purpose)purpose=standing;"
    },
    {
      "label": "#437: wrong settlement references are accepted",
      "mustFail": "#437 reference:",
      "find": "  return {refused:\"settledPurpose matches neither the standing purpose nor its history\"};",
      "replace": "  return {settle:true};"
    },
    {
      "label": "#437: history changes while the model waits are ignored",
      "mustFail": "#437 snapshot:",
      "find": "if(row.standing!==standing||row.history!==history)",
      "replace": "if(row.standing!==standing)"
    },
    {
      "label": "#437: same-text closed and reborn purposes are conflated",
      "mustFail": "#437 ambiguity:",
      "find": "if(purpose===standing&&archived)return",
      "replace": "if(false)return"
    },
    {
      "label": "#437: genuine untagged settlement is lost",
      "mustFail": "#437 fallback:",
      "find": "  if(purpose===standing)return {settle:true};",
      "replace": "  if(purpose===standing)return {settle:false};"
    },
    {
      "label": "#437: extractor loses the current and archived purpose evidence",
      "mustFail": "#437 context:",
      "find": "  p+=buildSummaryMotivationBlock(motivationTable||summaryMotivationTable());",
      "replace": ""
    },
    {
      "label": "#437: malformed name reaches alias resolution",
      "mustFail": "#437 reference:",
      "find": "typeof _mc.name!==\"string\"||!_mc.name.trim()",
      "replace": "!_mc.name"
    }
  ]
});
rc|=sabotage.prove({
  "file": "memory.js",
  "command": [
    "node",
    [
      "dev/tests-437-summary.js"
    ]
  ],
  "cases": [
    {
      "label": "#437: real summarize drops the request snapshot",
      "mustFail": "#437 async request snapshot precedes",
      "find": "applySummaryExtract(extracted,_identityTable,_motivationTable);",
      "replace": "applySummaryExtract(extracted,_identityTable);"
    },
    {
      "label": "#437: the prompt recomputes evidence after a refused call",
      "mustFail": "#437 async reframed retry",
      "find": "buildExtractPrompt(_chapterDesc,_pend,win.raw,win.txt,it,_motivationTable);",
      "replace": "buildExtractPrompt(_chapterDesc,_pend,win.raw,win.txt,it);"
    },
    {
      "label": "#437: a same-name replacement sheet accepts the old response",
      "mustFail": "#437 async sheet replacement",
      "find": "table.rows[i].name===name&&table.rows[i].sheet===cs",
      "replace": "table.rows[i].name===name"
    }
  ]
});
rc|=sabotage.prove({
  "file": "memory.js",
  "command": [
    "node",
    [
      "dev/tests-437-summary.js"
    ]
  ],
  "cases": [
    {
      "label": "#437: unsafe fallback refusal has no player-visible warning",
      "mustFail": "#437 async request snapshot precedes",
      "find": "if(typeof showToast===\"function\")showToast(\"⚠ \"+_mcCs.name+\" — purpose change not filed: \"+_mg.refused);",
      "replace": ""
    },
    {
      "label": "#437: campaign and missing-snapshot guard is absent",
      "mustFail": "#437 async campaign replacement",
      "find": "if(table.world!==worldState||table.campId!==worldState.campId||table.campName!==worldState.campName||!row)",
      "replace": "if(false)"
    }
  ]
});
rc|=sabotage.prove({
  "file": "memory.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#437 motivation lifecycle"
    ]
  ],
  "cases": [
    {
      "label": "#437: summary resurrects an archived new-purpose target",
      "mustFail": "#437 retired birth:",
      "find": "  if(proposed)for(i=0;i<row.closed.length;i++)",
      "replace": "  if(false)for(i=0;i<row.closed.length;i++)"
    },
    {
      "label": "#437: split fallback loses its second entry",
      "mustFail": "#437 split fallback:",
      "find": "if(_ms){summaryMotivationAdvance(motivationTable,_mcCs);",
      "replace": "if(_ms){"
    },
    {
      "label": "#437: advancing applied entries mutates the original request snapshot",
      "mustFail": "#437 split fallback:",
      "find": "rows:_mt.rows.slice()",
      "replace": "rows:_mt.rows"
    }
  ]
});
rc|=sabotage.prove({
  "file": "memory.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#437 motivation lifecycle"
    ]
  ],
  "cases": [
    {
      "label": "#437: archived-birth guard compares raw text instead of the stored 200-character value",
      "mustFail": "#437 boundary:",
      "find": "summaryMotivationKey(motivationBirthText(change.now))",
      "replace": "summaryMotivationKey(change.now)"
    },
    {
      "label": "#437: archived settlement identity becomes case-sensitive",
      "mustFail": "#437 case identity:",
      "find": "summaryMotivationKey(row.closed[i].text)===summaryMotivationKey(purpose)",
      "replace": "row.closed[i].text===purpose"
    }
  ]
});
process.exit(rc?1:0);
