// sabotage-372-register-reach.js — mutation proof for #372: the register guard's three new channels (chapter
// re-ask, quest/schedule labels, modern idiom), the sheet report, the readout item and the census ring — one
// clause per scanner plus the async guard driven through the standalone suite.
// Usage: node dev/sabotage-372-register-reach.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","#372 register reach"]];
rc|=sabotage.prove({
  file:"helpers.js",
  command:CMD,
  cases:[
    { label:"#372 ③: the label list loses the paperwork nouns",
      mustFail:"#372 ③ labels",
      find:"var LABEL_RE=wordListRe(REGISTER_WORDS.concat(PAPERWORK_WORDS));",
      replace:"var LABEL_RE=wordListRe(REGISTER_WORDS);" },
    { label:"#372 ③: the label scanner reads the prose too",
      mustFail:"#372 ③ labels",
      find:'return wordListScan(ops.join(" \\n "),LABEL_RE);}',
      replace:'return wordListScan(String(raw||""),LABEL_RE);}' },
    { label:"#372 ④: the idiom census goes blind",
      mustFail:"#372 ④ idiom",
      find:"function idiomScan(text){return wordListScan(text,IDIOM_RE);}",
      replace:"function idiomScan(text){return [];}" },
    { label:"#372: the census ring grows forever",
      mustFail:"#372 the census ring",
      find:"  while(c[channel].length>REGISTER_LOG_MAX)c[channel].shift();\n",
      replace:"" },
    { label:"#372 ②: the sheet report skips the #330 want",
      mustFail:"#372 ② sheets",
      find:"    var w=s.agenda&&s.agenda.want;if(typeof w===\"string\"&&w)",
      replace:"    var w=null;if(typeof w===\"string\"&&w)" },
    { label:"#372: a sheet-sourced register word no longer reads WATCH",
      mustFail:"#372 the #17 readout",
      find:'(rgSheet.length||rgC.chapterDirty)?"warn":"ok"',
      replace:'(rgC.chapterDirty)?"warn":"ok"' }
  ]
});
rc|=sabotage.prove({
  file:"game.js",
  command:CMD,
  cases:[
    { label:"#372 ③④: observeDriftAxes stops filing labels and idiom",
      mustFail:"#372 the census ring",
      find:'  if(typeof registerCensusFile==="function"){registerCensusFile("label",registerLabelScan(raw),turn);registerCensusFile("idiom",idiomScan(clean),turn);}',
      replace:'  if(false){registerCensusFile("label",registerLabelScan(raw),turn);registerCensusFile("idiom",idiomScan(clean),turn);}' }
  ]
});
rc|=sabotage.prove({
  file:"memory.js",
  command:CMD,
  cases:[
    { label:"#372 ①: a rewrite that still carries the word is committed anyway",
      mustFail:"#372 ① chapters",
      find:"  return registerScan(t).length?{text:original,cleaned:false}:{text:t,cleaned:true};",
      replace:"  return {text:t,cleaned:true};" },
    { label:"#372 ①: summarize() files the chapter without the guard",
      mustFail:"#372 ① chapters",
      find:"    await chapterRegisterGuard(extracted,worldState.turn);",
      replace:"" }
  ]
});
rc|=sabotage.prove({
  file:"memory.js",
  command:["node",["dev/tests-372-register-reach.js"]],
  cases:[
    { label:"#372 ①: the guard never re-asks (returns before the call)",
      mustFail:"the guard alone: a hit",
      find:"  if(!hits.length)return {hits:hits,reasked:false,cleaned:false};",
      replace:"  if(hits.length>=0)return {hits:hits,reasked:false,cleaned:false};" },
    { label:"#372 ①: the rewrite drags the session log along",
      mustFail:"the guard alone: a hit",
      find:'CHAPTER_REWRITE_SYS,700,null,{kind:"summarize",noHistory:true});',
      replace:'CHAPTER_REWRITE_SYS,700,null,{kind:"summarize",noHistory:false});' },
    { label:"#372 ①: a failed rewrite counts as a failed extraction",
      mustFail:"the rewrite call throws",
      find:'  catch(e){if(typeof console!=="undefined")console.warn("[memory] #372 chapter rewrite call failed',
      replace:'  catch(e){throw e;if(typeof console!=="undefined")console.warn("[memory] #372 chapter rewrite call failed' }
  ]
});
rc|=sabotage.prove({
  file:"table-talk.js",
  command:CMD,
  cases:[
    { label:"#372: Table Talk drops the census line",
      mustFail:"#372 the #17 readout",
      find:'  if(typeof registerCensusLine==="function"){var _rc=registerCensusLine();if(_rc)s.push(_rc);}',
      replace:'' }
  ]
});
process.exit(rc?1:0);
