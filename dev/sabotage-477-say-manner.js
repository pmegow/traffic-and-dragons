// #477 a SAY mood that is a manner of speaking is not Inworld steering — proven by mutation in a disposable clone.
//   node dev/sabotage-477-say-manner.js
var sabotage=require('./sabotage.js'),code=0;
var CMD=['node',['dev/run-tests.js','#96 [SAY:]']];
code|=sabotage.prove({file:'helpers.js',command:CMD,cases:[
 {label:'the speech verb is no longer stripped: "sound amused" loses its feeling to the allow-list (#555: the verb itself is not a feeling)',mustFail:"'sound amused' keeps the feeling",
  find:'  p=p.replace(SAY_SPEECH_VERB_RE,"");\n  if(!p)return "";',
  replace:'  if(!p)return "";'},
 {label:'the allow-list gate is gone (#555): "carefully" survives its verb and "low" steers',mustFail:"'speaking carefully' must vanish",
  find:'  for(i=0;i<words.length;i++)if(!SAY_STEER_WORDS[words[i].replace(/[^a-z]/g,"")])return "";',
  replace:''}
]});
/* #555: the allow-list itself */
code|=sabotage.prove({file:'helpers.js',command:CMD,cases:[
 {label:'"low" and "practical" are admitted to the steering list (the t264 dirge returns)',mustFail:"'low' and 'practical' must vanish",
  find:'var o={};("amused fond warm warmly',
  replace:'var o={};("low practical amused fond warm warmly'},
 {label:'one allowed word carries a whole part ("morbidly amused" and "low and warm" steer)',mustFail:'one word outside the list drops the whole part',
  find:'  for(i=0;i<words.length;i++)if(!SAY_STEER_WORDS[words[i].replace(/[^a-z]/g,"")])return "";',
  replace:'  var anyOk=false;for(i=0;i<words.length;i++)if(SAY_STEER_WORDS[words[i].replace(/[^a-z]/g,"")])anyOk=true;if(!anyOk)return "";'}
]});
code|=sabotage.prove({file:'tts.js',command:CMD,cases:[
 {label:'the prefix stops routing steering parts through sayMoodSteer',mustFail:'the prefix must carry nothing for a manner alone',
  find:'else { var sp = (typeof sayMoodSteer === "function") ? sayMoodSteer(p) : p; if (sp) steer.push(sp);',
  replace:'else { var sp = p; if (sp) steer.push(sp);'}
]});
process.exit(code);
