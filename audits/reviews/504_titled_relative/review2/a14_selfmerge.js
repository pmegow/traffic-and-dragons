// A self-merge of a record that has at least one event (the handler copies the duplicate's events onto the canonical: one list).
var t = process.env.T || "head";
process.env.PROBE_TREE = t === "head" ? "head" : t === "before" ? "../agent2/before" : t;
require("../agent/base.js");
[false, true].forEach(function (refs) {
  fresh({ refs: refs }); person("Bram", "he/him"); memory.npcs["Bram"].events.push({ turn: 80, note: "paid the toll" });
  var t0 = Date.now(), res, err = "";
  try { res = run("[NPC_MERGE:Bram|Bram]"); } catch (e) { err = e.message; }
  var m = memory.npcs["Bram"];
  console.log("  refs=" + refs + ": " + (Date.now() - t0) + " ms | muts=" + JSON.stringify(res && res.muts) + " | errors=" + JSON.stringify(res && res.r && res.r.errors) + (err ? " | THROWN " + err : "") + " | record: " + (m ? "events=" + (m.events || []).length : "DELETED") + " | row: " + (wsNpcByName("Bram") ? "kept" : "DELETED"));
  if (m && m.events && m.events.length > 1000) m.events.length = 1;
});
