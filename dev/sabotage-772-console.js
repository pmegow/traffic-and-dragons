// dev/sabotage-772-console.js — proves the #772 console guards: the kind table and the route, the bounded session
// ring and its new count, the one renderer, the showToast door and the three inventory sites, and the button with its
// dot. Each clause runs its own test through --only.
//   node dev/sabotage-772-console.js
var sabotage = require("./sabotage.js");
var P = "FAIL #772 console ", CMD = ["node", ["dev/tests-772-console.js"]];
var T1 = P + "a toast's kind comes from its third argument and from nothing else; a call that names none is a notice",
  T2 = P + "only an inventory change pops while the console can be opened; everything pops while it cannot",
  T3 = P + "the ring keeps every line with its time, turn and kind; only a line that did not pop is new; reading clears the count",
  T4 = P + "the ring is bounded: past the cap the oldest lines are dropped and counted",
  T5 = P + "the renderer shows each line once, oldest first, escaped, with its time and turn; an empty console and dropped lines are said",
  T6 = P + "showToast routes before it draws anything, records every line, and the three inventory changes name their kind",
  T7 = P + "the Console button sits right of Table Talk with its dot, and the dot is grey until it is new";
var pure = [
  { label: "a bare string is read as a kind", find: 'var k=opts&&typeof opts==="object"?opts.kind:null;', replace: 'var k=opts&&typeof opts==="object"?opts.kind:opts;', mustFail: T1 },
  { label: "every kind pops", find: "return !!(row&&row.pops)||!doorOpen;", replace: "return true;", mustFail: T2 },
  { label: "a notice is swallowed when the console cannot be opened", find: "return !!(row&&row.pops)||!doorOpen;", replace: "return !!(row&&row.pops);", mustFail: T2 },
  { label: "a second kind pops", find: "var TOAST_KINDS={inventory:{pops:true}};", replace: "var TOAST_KINDS={inventory:{pops:true},notice:{pops:true}};", mustFail: T2 },
  { label: "a popped line counts as new", find: "  if(!e.popped||unread)_consoleNew++;", replace: "  _consoleNew++;", mustFail: T3 },
  { label: "reading does not clear the count", find: "function consoleRead(){_consoleNew=0;}", replace: "function consoleRead(){}", mustFail: T3 },
  { label: "a reader is handed the ring itself", find: "function consoleEntries(){return _consoleLog.slice();}", replace: "function consoleEntries(){return _consoleLog;}", mustFail: T3 },
  { label: "a line loses its turn", find: 'worldState.turn==="number")?worldState.turn:null,msg:', replace: 'worldState.turn==="number")?null:null,msg:', mustFail: T3 },
  { label: "the ring grows without bound", find: "  if(_consoleLog.length>CONSOLE_CAP){", replace: "  if(false){", mustFail: T4 },
  { label: "dropped lines are not counted", find: "_consoleDropped+=_consoleLog.length-CONSOLE_CAP;", replace: "", mustFail: T4 },
  { label: "Clear keeps the dropped count", find: "function consoleClear(){_consoleLog=[];_consoleNew=0;_consoleDropped=0;}", replace: "function consoleClear(){_consoleLog=[];_consoleNew=0;}", mustFail: T4 },
  { label: "a line is written as markup", find: '</span> "+escHtml(e.msg)+"</div>";}', replace: '</span> "+e.msg+"</div>";}', mustFail: T5 },
  { label: "a line with no turn shows one", find: '(e.turn===null?"":" · turn "+e.turn)', replace: '(" · turn "+e.turn)', mustFail: T5 },
  { label: "dropped lines are not said", find: "  if(dropped>0)h+=", replace: "  if(false)h+=", mustFail: T5 }
];
var shell = [
  { label: "a collected line is drawn as a toast anyway", find: 'if(!_pops){if(typeof consoleModalLanded==="function"&&consoleModalLanded())consoleRead();consoleDotPaint();return;}', replace: "consoleDotPaint();", mustFail: T6 },
  { label: "a line is not put on record", find: "  consolePush(msg,_kind,_pops,_carFades);", replace: "  ", mustFail: T6 }
];
var gained = [{ label: "items gained are collected instead of popping", find: 'showToast("🎒 Collected: "+shown,undefined,{kind:"inventory"});', replace: 'showToast("🎒 Collected: "+shown);', mustFail: T6 }];
var dropped = [{ label: "items deleted are collected instead of popping", find: '+stale,6000,{kind:"inventory"});', replace: "+stale,6000);", mustFail: T6 }];
var moved = [{ label: "a trade is collected instead of popping", find: 'showToast(res.line,5000,{kind:"inventory"});', replace: "showToast(res.line,5000);", mustFail: T6 }];
var page = [
  { label: "the Console button is gone", find: '<button class="chat-tab" id="console-btn" title="Console: the game\'s notices" onclick="showConsoleModal()">Console <span class="console-dot" id="console-dot"></span></button>', replace: "", mustFail: T7 },
  { label: "the dot is never green", find: ".console-dot.new{background:var(--grn);opacity:1}", replace: "", mustFail: T7 }
];
var failed = sabotage.prove({ file: "helpers.js", command: CMD, only: P, cases: pure });
if (!failed) failed = sabotage.prove({ file: "ui-shell.js", command: CMD, only: P, cases: shell });
if (!failed) failed = sabotage.prove({ file: "game.js", command: CMD, only: P, cases: gained });
if (!failed) failed = sabotage.prove({ file: "ui-sheets.js", command: CMD, only: P, cases: dropped });
if (!failed) failed = sabotage.prove({ file: "ui-modals.js", command: CMD, only: P, cases: moved });
if (!failed) failed = sabotage.prove({ file: "index.html", command: CMD, only: P, cases: page });
process.exit(failed ? 1 : 0);
