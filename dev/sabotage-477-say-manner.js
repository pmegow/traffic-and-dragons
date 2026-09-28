// #477 a SAY mood that is a manner of speaking is not Inworld steering — proven by mutation in a disposable clone.
//   node dev/sabotage-477-say-manner.js
var sabotage=require('./sabotage.js'),code=0;
var CMD=['node',['dev/run-tests.js','#96 [SAY:]']];
code|=sabotage.prove({file:'helpers.js',command:CMD,cases:[
 {label:'the speech verb is no longer stripped: "speaking carefully" steers as written',mustFail:"'speaking carefully' must vanish",
  find:'  p=p.replace(SAY_SPEECH_VERB_RE,"");\n  if(!p||SAY_PACING_RE.test(p))return "";',
  replace:'  if(!p||SAY_PACING_RE.test(p))return "";'},
 {label:'a pacing adverb steers again: "carefully" survives its verb',mustFail:"'speaking carefully' must vanish",
  find:'  if(!p||SAY_PACING_RE.test(p))return "";\n  return p;',
  replace:'  if(!p)return "";\n  return p;'}
]});
code|=sabotage.prove({file:'tts.js',command:CMD,cases:[
 {label:'the prefix stops routing steering parts through sayMoodSteer',mustFail:'the prefix must carry nothing for a manner alone',
  find:'else { var sp = (typeof sayMoodSteer === "function") ? sayMoodSteer(p) : p; if (sp) steer.push(sp);',
  replace:'else { var sp = p; if (sp) steer.push(sp);'}
]});
process.exit(code);
