// READ-ONLY: the two field characters whose roster row still holds a slot pin beside a sheet (stale row copies).
// Prints the voice fields on the row and on the sheet, nothing else.
var fs = require("fs");
var F = ["voiceId", "speechifyVoiceId", "inworldVoiceId", "voiceDirection", "voiceRate"];
function pins(o) { var r = {}, i; if (!o) return null; for (i = 0; i < F.length; i++) if (o[F[i]]) r[F[i]] = o[F[i]]; return r; }
[["C:/Projects/traffic-and-dragons/Campaigns/The_Iron_Meridian__Gazz_Quickfuse_/saves/The_Iron_Meridian__Gazz_Quickfuse__Gazz_Quickfuse_t207.tnd", "Thessa Saltborn"],
 ["C:/Projects/traffic-and-dragons/Campaigns/The_Long_Walk/saves/The_Long_Walk_Silas_Morne_t146.tnd", "Nyla Lorrath"]].forEach(function (p) {
  var j = JSON.parse(fs.readFileSync(p[0], "utf8")), n = (j.worldState.npcs || []).filter(function (x) { return x.name === p[1]; })[0];
  console.log(p[1] + " | party " + !!n.partyMember + " | row " + JSON.stringify(pins(n)) + " | sheet " + JSON.stringify(pins(n.charSheet)) + " | sheet.name " + JSON.stringify(n.charSheet.name));
});
