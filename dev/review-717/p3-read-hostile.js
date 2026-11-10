// p3-read-hostile.js — can a record that PASSES the load door (atlasSeenHeal) make atlasReveal throw, or hand
// view.setReveal a spec the library refuses (which the pane answers with "That sheet could not be drawn")? Feeds the
// heal door hostile-but-string keys and odd legs, then for every sheet: atlasReveal -> TnDMaps.scene.fog.spec ->
// TnDMaps.scene.build, reporting the first failure per case. Also: what the pre-heal (in-session) shapes do.
// node dev/review-717/p3-read-hostile.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
function tryReveal(z) {
  var spec, step = "atlasReveal";
  try { spec = atlasReveal(z); step = "fog.spec"; TnDMaps.scene.fog.spec(spec); step = "scene.build"; TnDMaps.scene.build(atlasDoc(z), "ink", { reveal: spec }); return { ok: true, spec: spec }; }
  catch (e) { return { ok: false, step: step, msg: String(e && e.message).slice(0, 260), spec: spec }; }
}
function base() {
  var S = H.start(false), A = S.A, c = S.c, idoc, rooms, sdoc;
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); idoc = atlasDoc(A.at); rooms = H.onceRooms(idoc);
  H.turn("[SUBLOCATION:" + rooms[0].name + "]"); H.turn("[SUBLOCATION:" + rooms[1].name + "]");
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:" + c.grates[0].name + "]"); sdoc = atlasDoc(A.at);
  H.turn("[LOCATION:" + c.p1.name + "]");
  S.inn = c.townId + "/" + c.inn.id; S.sewer = Object.keys(A.zones).filter(function (z) { return A.zones[z].kind === "dungeon"; })[0];
  return S;
}

hr("H1 keys that are non-empty strings (the heal door's only test) on every sheet kind");
(function () {
  var cases = ["t:", "p:", "p::", "p:wild", "p:wild:", "p:wild:garbage", "p:wild:z-1_-1", "p:wild:z99999_99999", "p:wild:zNaN_NaN", "p:wild:__proto__", "p:__proto__:x", "p:constructor:x", "t:__proto__", "t:constructor", "c", "x", " ", "t:" + new Array(5000).join("y")];
  cases.forEach(function (k) {
    var S = base(), A = S.A, bad = [];
    Object.keys(A.zones).forEach(function (z) {
      if (!A.seen[z]) A.seen[z] = { at: [], legs: [] };
      var first = A.seen[z].at[0] || "t:none";
      A.seen[z].at.push(k); A.seen[z].legs.push([k, first]); A.seen[z].legs.push([k, k]);
    });
    H.quiet(); var healed = atlasHeal();
    Object.keys(A.zones).forEach(function (z) { var r = tryReveal(z); if (!r.ok) bad.push(A.zones[z].kind + " @" + r.step + ": " + r.msg); });
    out(JSON.stringify(k.length > 40 ? k.slice(0, 12) + "…(" + k.length + ")" : k), (bad.length ? "FAILS " + JSON.stringify(bad) : "ok") + "  healChanged=" + healed + " toasts=" + H.toasts.length + " reports=" + H.reports.length);
  });
})();

hr("H2 what TnDMaps.wild.zoneAt answers for a via the realm does not have (the 'p:' key's point)");
(function () {
  var S = base(), reg = S.c.reg;
  ["garbage", "z-1_-1", "z99999_99999", "zNaN_NaN", "", "z1_1"].forEach(function (v) {
    var r; try { r = TnDMaps.wild.zoneAt(reg, v); out(JSON.stringify(v), { cx: r && r.cx, cy: r && r.cy, id: r && r.id }); } catch (e) { out(JSON.stringify(v), "throws: " + String(e.message).slice(0, 120)); }
  });
})();

hr("H3 shapes the heal door must drop or keep: is anything unreadable kept, and is a dropped record SAID?");
(function () {
  var shapes = {
    "array": [], "string": "junk", "number": 7, "null": null,
    "legs of one": { at: ["t:a"], legs: [["t:a"]] }, "legs of three": { at: ["t:a"], legs: [["t:a", "t:b", "t:c"]] }, "leg null": { at: ["t:a"], legs: [null] },
    "at number": { at: [3], legs: [] }, "at object": { at: {}, legs: [] }, "extra field": { at: ["t:a"], legs: [], junk: { deep: 1 } },
    "sparse at": (function () { var a = []; a[3] = "t:a"; return { at: a, legs: [] }; })()
  };
  Object.keys(shapes).forEach(function (n) {
    var S = base(), A = S.A, z = S.c.townId, kept, r;
    A.seen[z] = shapes[n]; H.quiet(); atlasHeal(); kept = A.seen[z] !== undefined; r = tryReveal(z);
    out(n, "kept=" + kept + " said=" + H.toasts.length + " reveal=" + (r.ok ? "ok" : "FAILS @" + r.step + ": " + r.msg));
  });
  /* the whole store */
  ["junk", 7, [], null].forEach(function (v) { var S = base(), A = S.A; A.seen = v; H.quiet(); atlasHeal(); out("A.seen=" + JSON.stringify(v), "healed to " + JSON.stringify(A.seen) + " said=" + H.toasts.length + " (a dropped whole record is " + (H.toasts.length ? "said" : "SILENT") + ")"); });
})();

hr("H4 in-session (no load door between): a junk leg in memory — does the READ throw? does the WRITER recover?");
(function () {
  var S = base(), A = S.A, z = S.c.townId, r;
  A.seen[z].legs.push(null); r = tryReveal(z); out("legs has a null — the read", r.ok ? "ok" : "THROWS @" + r.step + ": " + r.msg);
  H.quiet(); H.turn("[LOCATION:" + S.c.p0.name + "][SUBLOCATION:" + S.c.inn.name + "]"); H.turn("[SUBLOCATION:" + S.c.market.name + "]");
  out("the writer after it", { toasts: H.toasts.slice(), reports: H.reports.length, legs: A.seen[z].legs.length });
})();
