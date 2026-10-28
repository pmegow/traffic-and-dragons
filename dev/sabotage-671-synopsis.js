// dev/sabotage-671-synopsis.js — proves the #671 guards on the story so far, the player-facing recap at the top of the
// Quest Journal. The ruling's two halves: the model writes from PLAYER-KNOWN material only (never the premise, never a
// pending title), and the recap refreshes after an arc or act completes (synopsisDue after the commit, never awaited,
// Table Talk excluded) or by the button. The receipt keeps every era; the block escapes; the record refuses an empty
// paragraph; the arc stamp the receipt's boundaries read is written by [ARC_COMPLETE:]. Each reversal must turn the
// #671 section red.
//   node dev/sabotage-671-synopsis.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#671"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the basis carries the premise (the author's spine reaches the player's recap)",
    find: 'out.stake=String(ws.stake||"").trim();', replace: 'out.stake=String(ws.stake||"").trim()+" "+String((ws.skeleton&&ws.skeleton.premise)||"");' },
  { label: "a pending act's title reaches the spine (what is coming, named before the story says it)",
    find: 'if(!a||(a.status!=="completed"&&a.status!=="active"))continue;/* a pending act is the author\'s, not the player\'s */', replace: 'if(!a)continue;' },
  { label: "synopsisDue ignores the record's count (a recap on every turn)",
    find: "return (s.basis.spine||0)<n;", replace: "return true;" },
  { label: "the receipt drops the first era (the deep past vanishes from the by-act list)",
    find: "for(i=0;i<b.eras.length;i++)items.push({turn:b.eras[i].to", replace: "for(i=1;i<b.eras.length;i++)items.push({turn:b.eras[i].to" },
  { label: "a parallel act files its chapters under whichever arc sorts last again (the Frizwick t95 misfile)",
    find: "if(!a.parallel)for(j=g.arcs.length-1;j>=0;j--)", replace: "if(a.parallel||!a.parallel)for(j=g.arcs.length-1;j>=0;j--)" },
  { label: "an NPC's withheld secret reaches the recap (the blueprint's hidden truth, before its reveal act)",
    find: "var kn=(n.knowledge||[]).concat((n.events||[]).map(function(e){return e&&e.note?String(e.note):\"\";}))", replace: "var kn=(n.knowledge||[]).concat((n.events||[]).map(function(e){return e&&e.note?String(e.note):\"\";}),(n.secrets||[]).map(function(s){return s&&s.text?String(s.text):\"\";}))" },
  { label: "the CURRENT act's goal reaches the recap (the turning point not yet reached, told ahead)",
    find: "goal:a.status===\"completed\"?String(a.goal||\"\"):\"\"", replace: "goal:String(a.goal||\"\")" },
  { label: "the why is dropped from the block (the record carries it, the journal never shows it)",
    find: "if(syn&&syn.why)h+=lbl+\"Why you fight</div>", replace: "if(syn&&syn.why&&!syn.why)h+=lbl+\"Why you fight</div>" },
  { label: "the block prints the paragraph unescaped",
    find: '"+escHtml(syn.about)+"', replace: '"+syn.about+"' }
]);
prove("game.js", [
  { label: "an empty paragraph is accepted as the recap (the previous one is overwritten with nothing)",
    find: 'if(!about)throw new Error("the recap came back without its paragraph");', replace: 'if(about===null)throw new Error("the recap came back without its paragraph");' },
  { label: "the hook runs on Table Talk too",
    find: "syncUI();if(!isTT)maybeRefreshSynopsis();", replace: "syncUI();maybeRefreshSynopsis();" },
  { label: "the side call loses its telemetry kind (the Usage modal and the server's per-purpose rows file it as other)",
    find: '{noHistory:true,kind:"synopsis"}', replace: '{noHistory:true,kind:"other"}' }
]);
prove("tag_table.js", [
  { label: "[ARC_COMPLETE:] no longer stamps the closing arc's completedTurn (the receipt loses its arc boundaries)",
    find: "_act.arcs[_sj].completedTurn=worldState.turn;", replace: "_act.arcs[_sj].completedTurnLost=worldState.turn;" }
]);
process.exit(code);
