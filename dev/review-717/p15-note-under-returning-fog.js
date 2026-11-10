// p15-note-under-returning-fog.js — the fog RETURNS over ground shown only "while the marker stands there" (a town
// entered by name: the sheet's middle). The player may write a NOTE on a thing they can see there (#711 round 4: the
// card's Add note, kept on the campaign). When the party then goes to a named place, the middle closes again: can the
// note still be read? Same question for a campaign mapped BEFORE the fog (ruling 4): notes written on a whole sheet.
// node dev/review-717/p15-note-under-returning-fog.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
function readable(z) { var h = {}; TnDMaps.scene.build(atlasDoc(z), "ink", { reveal: atlasReveal(z) }).layers.forEach(function (L) { if (L.name === "hits") L.items.forEach(function (x) { h[x.id] = 1; }); }); return h; }
hr("N1 a note written while the party is 'somewhere' in the town, then the party walks to a named place");
(function () {
  var S = H.start(false), A = S.A, c = S.c, T = S.T, h0 = readable(c.townId), unit = c.town.frame.kmPerUnit * 1000, noted, far, r, h1;
  out("marker", atlasMarkers(c.townId)[0].label); out("things the player can read on arrival", Object.keys(h0).length);
  noted = atlasThings(c.town).filter(function (t) { return h0[t.id]; })[0]; r = atlasNoteSet(c.townId, noted.id, "Ask here about the missing ledger."); out("note saved on", noted.name + " " + JSON.stringify(r.ok));
  far = atlasThings(c.town).filter(function (t) { return !t.portal || t.portal.to.generator !== "region"; }).map(function (t) { return { t: t, d: Math.sqrt(Math.pow(t.x - noted.x, 2) + Math.pow(t.y - noted.y, 2)) * unit }; }).sort(function (a, b) { return b.d - a.d; })[0];
  H.turn("[SUBLOCATION:" + far.t.name + "] Across town."); h1 = readable(c.townId);
  out("the party walks to", far.t.name + " (" + Math.round(far.d) + " m from the noted place)"); out("record", H.seen(A, c.townId));
  out("the noted place can still be clicked", !!h1[noted.id]); out("the note is still on the campaign", atlasNote(c.townId, noted.id)); out("any other door to it (a list of notes)?", "none: A.notes is read only through a thing's card");
})();
hr("N2 a campaign mapped before the fog: notes on a whole sheet, then the first load under #717");
(function () {
  var S = H.start(false), A = S.A, c = S.c, far, h;
  H.turn("[SUBLOCATION:" + c.inn.name + "]"); far = c.reg.places[5]; atlasNoteSet(A.seed, far.id, "Rumoured: a dragon's hoard."); atlasNoteSet(c.townId, c.market.id, "Market day is Fireday.");
  delete A.seen; worldState = parseWorldState(serializeWorldState(worldState)); migrateWorldState(); atlasForget(); A = worldState.atlas;
  h = readable(A.seed); out("the note on " + far.name + " (realm) can be opened", !!h[far.id]); h = readable(c.townId); out("the note on the market (town) can be opened", !!h[c.market.id]); out("notes kept", Object.keys(A.notes));
})();
