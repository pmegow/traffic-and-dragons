// sabotage-refusal.js — prove the #197 model-refusal guards are not decorative.
// #197: an in-band model refusal ("I cannot continue generating content for this scene…",
// field t1985) commits as NON-CANON — tags withheld, transcript rf-marked, retrieval-excluded,
// note latches restored. Each mutation below removes one load-bearing clause; the exact #197
// engine test must turn red, and sabotage.js restores byte-identical source after every case.
// The change spans four files, so every prove rides the WORKING copies of all of them into the
// scratch clone (the `also` option — the multi-file sibling of the #196 working-suite fix).
var sabotage=require("./sabotage.js"),rc=0;
var ALSO=["game.js","api.js","state.js","memory.js"];
var CMD=["node",["dev/run-tests.js","#197"]];

rc|=sabotage.prove({file:"game.js",command:CMD,also:ALSO,cases:[
  {label:"#197 refusal fork disabled — a refusal turn applies its embedded tags again",
    mustFail:"#197 commit: a refusal turn is non-canon",
   find:"var _refusal=(typeof detectModelRefusal===\"function\")&&detectModelRefusal(cleanTxt(resp));",
   replace:"var _refusal=false;"},
  {label:"#197 latch restore dropped — a refusal burns every delivered one-shot nudge",
    mustFail:"#197 commit: a refusal restores the delivered note latches",
   find:"if(o.latchSnap&&typeof restoreNoteLatches===\"function\")restoreNoteLatches(o.latchSnap);",
   replace:""}
]});

rc|=sabotage.prove({file:"api.js",command:CMD,also:ALSO,cases:[
  {label:"#197 meta-object gate removed — in-fiction 'I cannot continue down the tunnel' becomes a refusal",
    mustFail:"#197 detector: dialogue, in-fiction inability",
   find:"return REFUSAL_META_RE.test(s.slice(m[0].length,m[0].length+100));",
   replace:"return true;"},
  {label:"#197 whole-response cap removed — long narration with a refusal-shaped opening is eaten",
    mustFail:"#197 detector: dialogue, in-fiction inability",
   find:"if(!s||s.length>REFUSAL_MAX_CHARS)return false;",
   replace:"if(!s)return false;"}
]});

rc|=sabotage.prove({file:"state.js",command:CMD,also:ALSO,cases:[
  {label:"#197 rf stamp dropped — the refusal transcript entry loses its non-canon mark",
    mustFail:"#197 commit: a refusal turn is non-canon",
   find:"if(meta&&meta.refusal)_e.rf=1;",
   replace:""}
]});

rc|=sabotage.prove({file:"memory.js",command:CMD,also:ALSO,cases:[
  {label:"#197 retrieval exclusion narrowed — rf-marked refusals served as episodic truth again",
    mustFail:"#197 RAG: an rf-marked refusal turn is never served",
   find:"if(en0.rc||en0.rf)continue;",
   replace:"if(en0.rc)continue;"}
]});

process.exit(rc?1:0);
