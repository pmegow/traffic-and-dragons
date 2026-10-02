// dev/sabotage-525-ending-voice.js — proves the #525 guards are guarded. The campaign ending is written to "you" (owner
// rulings 2026-10-01; game words and modern idiom belong to the campaign's chosen voice), and after it "RECORD: <one
// third-person sentence naming the hero>" is the defining moment the party carries. Before, the closing paragraph was
// filed in the prose's own person: The Princess put the hero's "I spent nineteen levels…" on four sheets.
// Rewritten 2026-10-02 after an independent review: the name test is Unicode-safe (the first one stacked a prefix on every
// load for "José"), the split takes every shape of the line, the fates and the moments block say whose "you" it is, and a
// reply with no prose is never shown. Each mutation runs in a disposable clone.
//   node dev/sabotage-525-ending-voice.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#525"]], SCREEN = ["node", ["dev/tests-525-ending-screen.js"]];
var code = 0;
function prove(file, cases, cmd) { if (!code) code = sabotage.prove({ file: file, command: cmd || CMD, cases: cases }); }
var PROMPT = "both ending prompts", SPLIT = "denouementSplit takes the RECORD line", REPRO = "the repro", FALL = "no RECORD line", HEAL = "the heal:", LOAD = "the load path runs the heal",
  WORD = "#525r a text names the hero", SHAPES = "#525r denouementSplit", FILING = "#525r filing", FATES = "#525r fates", ARRIVE = "#525r a sheet that arrives mid-session", VOICE = "#525r the ending is written in the voice";
prove("api.js", [
  { label: "the death ending no longer asks for the second person",
    find: "300-500 words.\"+DENOUEMENT_VOICE_RULE+\" Honour every recorded fact below; invent nothing that contradicts them; leave the unfinished threads unfinished, named. End on the world", replace: "300-500 words. Honour every recorded fact below; invent nothing that contradicts them; leave the unfinished threads unfinished, named. End on the world",
    mustFail: PROMPT },
  { label: "the told-tale ending no longer asks for the second person",
    find: "300-500 words.\"+DENOUEMENT_VOICE_RULE+\" Honour every recorded fact below; invent nothing that contradicts them; leave the unfinished threads unfinished, named. The hero lives", replace: "300-500 words. Honour every recorded fact below; invent nothing that contradicts them; leave the unfinished threads unfinished, named. The hero lives",
    mustFail: PROMPT },
  { label: "game words and modern idiom are allowed whatever the voice",
    find: "and modern idiom only if the VOICE below calls for them; otherwise use none.", replace: "and modern idiom freely.",
    mustFail: PROMPT },
  { label: "the endings no longer ask for the RECORD line",
    find: "var DENOUEMENT_RECORD_RULE=\" After the prose, on its own final line, write \\\"RECORD: \\\" and ONE plain sentence in the third person, past tense, naming the hero by name,", replace: "var DENOUEMENT_RECORD_RULE=\" Then stop. Add nothing after the prose,",
    mustFail: PROMPT },
  { label: "the ending's voice ignores the device's (an unpinned campaign is told 'use none')",
    find: 'var _dvId=(worldState.proseAuthor!=null)?worldState.proseAuthor:(typeof proseAuthor!=="undefined"?proseAuthor:"");', replace: 'var _dvId=worldState.proseAuthor||"";',
    mustFail: VOICE },
  { label: "the moments block shows an unhealed ending bare",
    find: 'var _mt=(m.kind==="ending"&&m.who&&typeof endingMomentText==="function")?endingMomentText(m.who,m.text):m.text;', replace: 'var _mt=m.text;',
    mustFail: ARRIVE },
  { label: "a healed copy and an old copy of one ending are two lines",
    find: 'var k=(m.camp||"")+"|"+m.turn+"|"+_mt;', replace: 'var k=(m.camp||"")+"|"+m.turn+"|"+m.text;',
    mustFail: ARRIVE }
]);
prove("helpers.js", [
  { label: "the RECORD line is never found",
    find: "    m=L[i].match(DENOUEMENT_RECORD_RE);\n    if(m){if(!rec)", replace: "    m=null;\n    if(m){if(!rec)",
    mustFail: SPLIT },
  { label: "a closing sentence that says 'record:' is taken for the line",
    find: "var DENOUEMENT_RECORD_RE=/^[", replace: "var DENOUEMENT_RECORD_RE=/[",
    mustFail: SPLIT },
  { label: "the RECORD line stays in the prose (shown, read aloud, transcribed)",
    find: "if(m){if(!rec)rec=m[1].trim();L.splice(i,1);continue;}", replace: "if(m){if(!rec)rec=m[1].trim();break;}",
    mustFail: SPLIT },
  { label: "a paragraph that begins with the word is taken for the line ('Record-keepers…')",
    find: "(?::|\\s[\\u2014\\u2013-]\\s)", replace: "(?::|\\s?[\\u2014\\u2013-]\\s?)",
    mustFail: SHAPES },
  { label: "a rule or a blank line after the line hides it",
    find: "  for(;;){trimEnd();i=L.length-1;if(i<0)break;", replace: "  for(;;){i=L.length-1;if(i<0)break;",
    mustFail: SHAPES },
  { label: "the label alone, with the sentence below, is not read",
    find: "if(m&&!m[1].trim()){rec=L[i].replace(", replace: "if(false){rec=L[i].replace(",
    mustFail: SHAPES },
  { label: "the line written twice leaves the first on the page",
    find: "if(m){if(!rec)rec=m[1].trim();L.splice(i,1);continue;}", replace: "if(m){if(!rec)rec=m[1].trim();L.splice(i,1);break;}",
    mustFail: SHAPES },
  { label: "written twice, the earlier sentence is filed",
    find: "if(m){if(!rec)rec=m[1].trim();L.splice(i,1);continue;}", replace: "if(m){rec=m[1].trim();L.splice(i,1);continue;}",
    mustFail: SHAPES },
  { label: "a line in a script without case is trimmed away as a rule",
    find: "if(wordCh(c)||c.charCodeAt(0)>0x2e7f)return true;}return false;}", replace: "if(wordCh(c))return true;}return false;}",
    mustFail: SHAPES },
  { label: "a text that never names the hero is filed bare (a companion carries 'You…' as her own)",
    find: "  return textNamesPerson(t,w)?t:w+\"'s ending: \"+t;", replace: "  return t;",
    mustFail: HEAL },
  { label: "a moment that names the hero is prefixed anyway",
    find: "  return textNamesPerson(t,w)?t:w+\"'s ending: \"+t;", replace: "  return w+\"'s ending: \"+t;",
    mustFail: REPRO },
  { label: "a name is found inside a longer word ('Tom' in 'Tomorrow')",
    find: "if(!wordCh(t.charAt(i-1))&&!wordCh(t.charAt(i+w.length)))return true;}", replace: "return true;}",
    mustFail: WORD },
  { label: "the word boundary is ASCII-only again ('José' in 'Joséphine')",
    find: 'function wordCh(c){return !!c&&(c.toLowerCase()!==c.toUpperCase()||(c>="0"&&c<="9"));}', replace: 'function wordCh(c){return !!c&&/[A-Za-z0-9]/.test(c);}',
    mustFail: WORD },
  { label: "a title or an article counts as the name ('The' names The Gray Fox)",
    find: "if(w.length>1&&PERSON_NAME_SKIP[w.toLowerCase()]!==1)out.push(w);}", replace: "if(w.length>1)out.push(w);}",
    mustFail: WORD },
  { label: "punctuation at the ends of a name word is part of it ('Mr.' is not the title 'Mr')",
    find: "while(a<b&&!wordCh(w.charAt(a)))a++;while(b>a&&!wordCh(w.charAt(b-1)))b--;w=w.slice(a,b);", replace: "",
    mustFail: WORD },
  { label: "the heal rewrites other kinds of moment",
    find: "    if(!m||m.kind!==\"ending\"||!m.who||typeof m.text!==\"string\")return;", replace: "    if(!m||!m.who||typeof m.text!==\"string\")return;",
    mustFail: HEAL },
  { label: "the heal skips the companions' sheets",
    find: "  var sheets=[ws.character],i;for(i=0;i<(ws.npcs||[]).length;i++)if(ws.npcs[i]&&ws.npcs[i].charSheet)sheets.push(ws.npcs[i].charSheet);\n", replace: "  var sheets=[ws.character],i;\n",
    mustFail: HEAL },
  { label: "a record that is not a list stops the heal (and with it the load)",
    find: "if(!cs||!Array.isArray(cs.coreMemories))return;cs.coreMemories.forEach(", replace: "if(!cs)return;(cs.coreMemories||[]).forEach(",
    mustFail: FILING }
]);
prove("game.js", [
  { label: "the moment is the closing paragraph in the prose's own person again (the reported defect)",
    find: "  if(_rec&&typeof fileCoreMemory===\"function\")fileCoreMemory(\"ending\",_hero,_rec);", replace: "  var _p2=t.split(/\\n\\s*\\n/);if(typeof fileCoreMemory===\"function\")fileCoreMemory(\"ending\",_hero,String(_p2[_p2.length-1]||\"\").trim().slice(0,240));",
    mustFail: REPRO },
  { label: "the transcript and the chapter keep the RECORD line",
    find: "var _ds=denouementSplit(text),t=_ds.prose;if(!t)return \"\";", replace: "var _ds=denouementSplit(text),t=String(text||\"\").trim();if(!t)return \"\";",
    mustFail: REPRO },
  { label: "the hero's fate line stays empty under a second-person ending",
    find: "line:ln||fallback||\"\",", replace: "line:ln,",
    mustFail: REPRO },
  { label: "with no RECORD line the closing paragraph is filed bare",
    find: "_rec=_lastP?(_hero?_hero+\"'s ending: \":\"\")+snippetAtSentence(_lastP,220):\"\";", replace: "_rec=_lastP?snippetAtSentence(_lastP,220):\"\";",
    mustFail: FALL },
  { label: "a closing paragraph that says the hero's name is filed bare ('You learned to stay, Ammut.')",
    find: "_rec=_lastP?(_hero?_hero+\"'s ending: \":\"\")+snippetAtSentence(_lastP,220):\"\";", replace: "_rec=_lastP?endingMomentText(_hero,snippetAtSentence(_lastP,220)):\"\";",
    mustFail: FILING },
  { label: "a missing RECORD line is silent",
    find: "if(typeof console!==\"undefined\")console.warn(\"[denouement] the ending carried no RECORD line", replace: "if(false)console.warn(\"[denouement] the ending carried no RECORD line",
    mustFail: FALL },
  { label: "a long record sentence is filed whole",
    find: "var _rec=_recS?snippetAtSentence(endingMomentText(_hero,_recS),240):\"\";", replace: "var _rec=_recS?endingMomentText(_hero,_recS):\"\";",
    mustFail: FALL },
  { label: "a record with no full stop loses its last word",
    find: "_recS+=\".\";/* review", replace: "_recS+=\"\";/* review",
    mustFail: FILING },
  { label: "a companion's fate line is the bare second-person sentence",
    find: "if(ln&&sheet!==worldState.character)ln=endingMomentText(_fHero,ln);", replace: "",
    mustFail: FATES },
  { label: "the fate stamp finds a name inside a longer word ('Tom' takes 'Tomorrow…')",
    find: "if(textNamesPerson(sent[i],name))return sent[i].trim();", replace: "if(sent[i].indexOf(String(name).split(/\\s+/)[0])>=0)return sent[i].trim();",
    mustFail: FATES }
]);
prove("game.js", [
  { label: "the screen and the voice get the raw reply, RECORD line and all",
    find: "var _df=denouementFrame(_shown);", replace: "var _df=denouementFrame(String(text||\"\"));",
    mustFail: "the screen shows the prose" },
  { label: "a reply with no prose is shown as it came",
    find: "if(!_shown)throw new Error(\"the ending came back with no prose\");", replace: "",
    mustFail: "a reply that is only the RECORD line" }
], SCREEN);
prove("state.js", [
  { label: "the load path never runs the heal",
    find: "{var _hem=0;try{_hem=healEndingMoments(worldState);}", replace: "{var _hem=0;try{_hem=0;}",
    mustFail: LOAD },
  { label: "a heal that throws fails the whole load",
    find: "}catch(_heE){if(typeof console!==\"undefined\")console.warn(\"[migrate] #525: the ending heal failed and was skipped", replace: "}catch(_heE){throw _heE;if(typeof console!==\"undefined\")console.warn(\"[migrate] #525: the ending heal failed and was skipped",
    mustFail: FILING }
]);
process.exit(code ? 1 : 0);
