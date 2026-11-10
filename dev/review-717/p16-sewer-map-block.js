// p16-sewer-map-block.js — is the underground walk of p14 a flow the GM is led into? Prints the MAP block the GM reads
// while the party stands at the foot of the first grate: does the sewer's sheet name its other ways up as places of the
// level (so "[SUBLOCATION:<the other grate>]" is the exact name the naming rule asks for)?
// node dev/review-717/p16-sewer-map-block.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, out = H.out;
var S = H.start(false), A = S.A, c = S.c, mb;
H.turn("[SUBLOCATION:" + c.grates[0].name + "] Down the grate.");
mb = atlasMapBlock(); say(mb.slice(0, 1800));
out("the other ways up named in the block", c.town.portals.filter(function (p) { return (p.kind === "grate" || p.kind === "outfall") && p.id !== c.grates[0].id; }).map(function (p) { return p.name + ": " + (mb.indexOf(p.name) >= 0); }));
