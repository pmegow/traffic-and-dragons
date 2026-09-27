// dev/sabotage-469-retold-memory.js — proves the #469 retold-memory guard is armed: a bystander who retells a party
// member's defining moment in the record's words is caught (helpers.js), the note consumes its ping and is registered
// (api.js), the moments block carries the register rule (api.js), the summarizer refuses to quote a bystander
// (memory.js), and sendAction arms the ping only from a real reply with the party exempt (game.js).
// Each clause must make one "#469" assertion of the "class bible" section fail; a mutation that changes no bytes fails.
//   node dev/sabotage-469-retold-memory.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "class bible"]];
var rc = 0;

rc |= sabotage.prove({
  file: "helpers.js",
  command: CMD,
  cases: [
    { label: "#469 — the party's own telling counts as a bystander's",
      mustFail: "the member's own telling fired",
      find: "    if(own)continue;/* the party's own telling is theirs to give */",
      replace: "    if(false)continue;/* the party's own telling is theirs to give */" },
    { label: "#469 — one shared word is enough: a fresh remark fires",
      mustFail: "fired",
      find: "var MOTIF_MIN_WORDS=3,MOTIF_WORD_MIN=6,MOTIF_GIST_CHARS=60;",
      replace: "var MOTIF_MIN_WORDS=1,MOTIF_WORD_MIN=6,MOTIF_GIST_CHARS=60;" },
    { label: "#469 — names count as content: a name-only overlap fires",
      mustFail: "a name-only overlap fired",
      find: "if(w.length>=MOTIF_WORD_MIN&&!MOTIF_STOP[w]&&!ex[w])out[w]=1;",
      replace: "if(w.length>=MOTIF_WORD_MIN&&!MOTIF_STOP[w])out[w]=1;" },
    { label: "#469 ④ — a raise no longer carries: the record vanishes mid-conversation",
      mustFail: "a raise one user turn ago did not carry",
      find: "var PAST_RAISED_TURNS=2,PAST_WORD_MIN=5;",
      replace: "var PAST_RAISED_TURNS=0,PAST_WORD_MIN=5;" },
    { label: "#469 ④ — a member's name alone raises the past",
      mustFail: "her name alone raised it",
      find: "if((named&&(cued||hits>=1))||hits>=2||",
      replace: "if(named||hits>=2||" }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: CMD,
  cases: [
    { label: "#469 — the note keeps its ping: it would fire every turn",
      mustFail: "ping not consumed",
      find: "  delete worldState.motifPing;\n  if(!worldState.motifNudged)worldState.motifNudged={};",
      replace: "  if(!worldState.motifNudged)worldState.motifNudged={};" },
    { label: "#469 — the builder falls out of NOTE_BUILDERS: the note is never delivered",
      mustFail: "not in NOTE_BUILDERS",
      find: "buildRecurringNameNudge,buildMotifNudge,/* #469 */buildSoundscapeNote];",
      replace: "buildRecurringNameNudge,/* #469 */buildSoundscapeNote];" },
    { label: "#469 — the moments block loses the once-not-every-meeting rule",
      mustFail: "header",
      find: ", and a bystander remarks on a moment once, not every meeting:\"];/* #469 ①: whose words these are */",
      replace: ":\"];/* #469 ①: whose words these are */" },
    { label: "#469 ④ — the village serves the earlier adventures on a walk to the well",
      mustFail: "the village served the earlier adventure on a walk to the well",
      find: "!pastRaisedByHero(typeof lastAction===\"string\"?lastAction:\"\",_ut,names,prior))_hold=true;",
      replace: "!pastRaisedByHero(typeof lastAction===\"string\"?lastAction:\"\",_ut,names,prior))_hold=false;" },
    { label: "#469 ④ — the Hall no longer serves the past",
      mustFail: "standing in the Hall did not serve the past",
      find: "    if(!(_hk&&_ak===_hk)){\n      var _ut=[]",
      replace: "    if(true){\n      var _ut=[]" },
    { label: "#469 ④ — this campaign's own moments are withheld with the earlier adventures",
      mustFail: "this campaign's own moment was withheld too",
      find: "    if(!cur.length)return L0+\"\\n\\n\";",
      replace: "    return L0+\"\\n\\n\";" }
  ]
});

rc |= sabotage.prove({
  file: "memory.js",
  command: CMD,
  cases: [
    { label: "#469 — the summarizer may quote a bystander again",
      mustFail: "the bystander clause is missing",
      find: "; what bystanders say about the party's past is recorded as an attitude ('Nyla was glad for Daeris'), never quoted or restated in its particulars",
      replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "game.js",
  command: CMD,
  cases: [
    { label: "#469 — a refusal arms the ping",
      mustFail: "the call site itself must be refusal-gated",
      find: "    if(!_refusal&&typeof detectMomentRetelling===\"function\"){",
      replace: "    if(typeof detectMomentRetelling===\"function\"){" },
    { label: "#469 — the hero is no longer exempt",
      mustFail: "the exempt list must be the hero + the living party",
      find: "var _mmList=[],_mmEx=[worldState.character.name],_mmi;",
      replace: "var _mmList=[],_mmEx=[],_mmi;" }
  ]
});

process.exit(rc);
