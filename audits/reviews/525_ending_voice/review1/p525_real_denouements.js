require("./h.js");
// READ-ONLY: the real denouements on the owner's saves — their shape (paragraph breaks, markdown, last line), to judge how the
// model formats an ending. Looks at transcript entries flagged den and at the DENOUEMENT chapter.
var fs = require("fs"), path = require("path");
var CR = "C:/Projects/traffic-and-dragons/Campaigns";
fs.readdirSync(CR).forEach(function (camp) {
  var sd = path.join(CR, camp, "saves"); if (!fs.existsSync(sd)) return;
  fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); }).forEach(function (f) {
    var save; try { save = JSON.parse(fs.readFileSync(path.join(sd, f), "utf8")); } catch (e) { return; }
    var ws; try { ws = inflateWorldStateSnapshot(save.worldState); } catch (e2) { return; }
    var dens = (ws.transcript || []).filter(function (e) { return e && e.den; });
    var ch = ((save.memory && save.memory.chapters) || []).filter(function (c) { return /^DENOUEMENT:/.test(String(c.summary || "")); });
    if (!dens.length && !ch.length) return;
    console.log("\n##### " + f + " — den entries " + dens.length + ", DENOUEMENT chapters " + ch.length + ", ended " + J(ws.ended && ws.ended.cause) + ", model " + J(dens[0] && dens[0].m));
    dens.forEach(function (e) {
      var x = String(e.x), lines = x.split("\n");
      console.log("  length " + x.length + " chars, " + x.split(/\s+/).length + " words, paragraphs " + x.split(/\n\s*\n/).length + ", has markdown *,_,#,---: " + /[*_#]|^---/m.test(x) + ", CRLF: " + /\r/.test(x));
      console.log("  FIRST 160: " + J(x.slice(0, 160)));
      console.log("  LAST line: " + J(lines[lines.length - 1].slice(-260)));
      console.log("  person: I/me/my " + (x.match(/\b(I|me|my)\b/g) || []).length + " | you/your " + (x.match(/\b(you|your)\b/gi) || []).length + " | hero name " + (x.match(new RegExp("\\b" + String(ws.character.name).split(/\s+/)[0] + "\\b", "g")) || []).length);
    });
  });
});
