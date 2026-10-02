require("./h.js");
// Drive the REAL async campaignDenouement() against a stubbed model reply; capture what the player is shown (addMsg frame +
// replay/voice text + toasts), what the transcript/chapter hold, and what is filed on the sheets.
var shown = [];
addMsg = function (kind, html, opts) { shown.push({ kind: kind, html: String(html), opts: opts || {} }); return { remove: function () {} }; };
showCampaignEndedModal = function () { shown.push({ kind: "MODAL" }); };
function seed(hero) {
  w525(hero); shown = []; __toasts.length = 0;
  worldState.ended = { turn: 89, cause: "the tale is told", at: 1, spine: true }; worldState.denouementOwed = true; busy = false;
}
async function go(label, reply, hero) {
  seed(hero || "Ammut");
  var calls = 0;
  callGM = function () { calls++; return Promise.resolve(reply); };
  var warns = [], ow = console.warn, oi = console.info; console.warn = function () { warns.push(Array.prototype.join.call(arguments, " ")); }; console.info = function () {};
  await campaignDenouement();
  console.warn = ow; console.info = oi;
  var f = shown.filter(function (m) { return m.kind === "narrator"; })[0];
  var tr = worldState.transcript[worldState.transcript.length - 1];
  var ch = memory.chapters[memory.chapters.length - 1];
  console.log("\n=== " + label);
  console.log("reply            : " + J(reply));
  console.log("SCREEN html      : " + J(f && f.html));
  console.log("VOICE replayText : " + J(f && f.opts && f.opts.replayText));
  console.log("transcript x     : " + J(tr && tr.x) + (tr ? " den=" + tr.den : ""));
  console.log("chapter          : " + J(ch && ch.summary));
  console.log("hero ending(s)   : " + J(endings(worldState.character)));
  console.log("Daeris ending(s) : " + J(endings(wsNpcByName("Daeris").charSheet)));
  console.log("fate.line        : " + J(worldState.character.fate && worldState.character.fate.line));
  console.log("denouementOwed   : " + worldState.denouementOwed + " | ended modal shown: " + shown.some(function (m) { return m.kind === "MODAL"; }) + " | toasts: " + J(__toasts) + " | warns: " + J(warns.map(function (w) { return w.slice(0, 110); })));
}
(async function () {
  var P = "You walk out of the palace and the rain feels like a joke at your expense.\n\nYou learned to stay.";
  await go("A. expected shape", P + "\nRECORD: Ammut learned to stay when leaving was easier.");
  await go("B. the reply is ONLY the RECORD line", "RECORD: Ammut learned to stay when leaving was easier.");
  await go("C. RECORD label on its own line, sentence on the next", P + "\nRECORD:\nAmmut learned to stay when leaving was easier.");
  await go("D. RECORD written twice", P + "\nRECORD: Ammut learned to stay.\nRECORD: Ammut never looked back.");
  await go("E. bracketed like a state tag", P + "\n[RECORD: Ammut learned to stay when leaving was easier.]");
  await go("F. quoted line", P + "\n\"RECORD: Ammut learned to stay when leaving was easier.\"");
  await go("G. a line after the RECORD line", P + "\nRECORD: Ammut learned to stay when leaving was easier.\n\n---");
  await go("H. markdown rule BEFORE the RECORD line", P + "\n\n---\n\nRECORD: Ammut learned to stay when leaving was easier.");
  await go("I. no RECORD; the closing paragraph names the hero in the second person", "You walk out.\n\nYou learned to stay, Ammut. It cost you the road, and you paid it.");
  await go("J. RECORD names the hero but is second person", P + "\nRECORD: You, Ammut, learned to stay.");
  await go("K. RECORD is first person naming the hero", P + "\nRECORD: I, Ammut, learned to stay.");
  await go("L. prose whose last paragraph begins 'Record-keepers' and no RECORD line", "You walk out.\n\nRecord-keepers in the capital wrote it down wrong, as they always do. You never corrected them.");
  await go("M. empty reply", "");
  await go("N. truncated right after the label", P + "\nRECORD:");
  await go("O. hero 'The Gray Fox', RECORD that never names him", P + "\nRECORD: The tale refused to change him.", "The Gray Fox");
  await go("P. hero 'Silas Morne', RECORD uses the surname", P + "\nRECORD: Morne learned to stay.", "Silas Morne");
})();
