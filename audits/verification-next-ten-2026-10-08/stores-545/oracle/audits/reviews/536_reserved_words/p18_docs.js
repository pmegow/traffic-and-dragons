// REVIEW PROBE p18 (read-only, no engine): what the contract lines and comments of the two commits say, against the tree.
// argv: <tree>
var fs = require("fs"), path = require("path"), root = process.argv[2];
function rd(f) { try { return fs.readFileSync(path.join(root, f), "utf8"); } catch (e) { return ""; } }
function count(hay, needle) { var n = 0, i = 0; while ((i = hay.indexOf(needle, i)) >= 0) { n++; i += needle.length; } return n; }
console.log("tree: " + root.split("/").pop());
var srcFiles = fs.readdirSync(root).filter(function (f) { return /\.(js|html)$/.test(f); }), src = srcFiles.map(function (f) { return rd(f); }).join("\n");
var ident = rd("DOC/contracts/identity.md"), tags = rd("DOC/contracts/tags.md"), claude = rd("CLAUDE.md"), tt = rd("tag_table.js"), api = rd("api.js");
console.log("1. the symbol TAG_RESERVED_WORDS: defined or used in source files " + count(src, "TAG_RESERVED_WORDS") + " time(s); named in DOC/contracts/identity.md " + count(ident, "TAG_RESERVED_WORDS") + " time(s)");
console.log("   RESERVED_KEY_WORDS in source: " + count(src, "RESERVED_KEY_WORDS") + "; in identity.md: " + count(ident, "RESERVED_KEY_WORDS"));
console.log("2. DOC/contracts/tags.md (CLAUDE.md: read it when you touch tag_table.js, applyMuts or a refusal path) mentions #536: " + (tags.indexOf("#536") >= 0) + ", tagStripReserved: " + (tags.indexOf("tagStripReserved") >= 0) + ", 'reserved': " + /reserved/i.test(tags));
console.log("   the same file documents the chained WARES form the strip does not read: " + (tags.indexOf("[WARES:a|1 gp|n]|b|1 gp|m]") >= 0));
var c1 = (tt.match(/\/\* #536: takes every tag[\s\S]*?\*\//) || [""])[0].replace(/\s+/g, " ");
console.log("3. tag_table.js, the comment on tagStripReserved: " + JSON.stringify(c1.slice(0, 330)));
var c2 = (tt.match(/\/\* #536: the reserved word a tag payload carries[\s\S]*?\*\//) || [""])[0].replace(/\s+/g, " ");
console.log("4. tag_table.js, the comment on tagReservedWord (last sentence): " + JSON.stringify(c2.slice(-140)));
var c3 = (api.match(/\/\* #536: a tag whose operand[\s\S]*?\*\//) || [""])[0].replace(/\s+/g, " ");
console.log("5. api.js, the comment at the call: " + JSON.stringify(c3.slice(0, 260)));
var order = ["text=tagRestoreBareMarkers(text)", "var _rsv=tagStripReserved(text)", "opts.allow.length", "w2PrepareResponse(text)"].map(function (s) { return s + "@" + api.indexOf(s, api.indexOf("function applyMuts(")); });
console.log("6. order inside applyMuts (character offsets): " + order.join("  <  "));
var row = (claude.match(/\| `api\.js` \|[^\n]*/) || [""])[0];
console.log("   CLAUDE.md api.js row says: " + JSON.stringify((row.match(/THE tag-application boundary:[^;]*;[^;]*;[^;]*;/) || [""])[0]));
// dead / unreachable pieces of the two diffs
var help = rd("helpers.js"), game = rd("game.js"), cg = rd("campaign_generator.js");
console.log("7. reservedWordIn's fallback path label \"the value\" is reachable only for a top-level STRING: callers = " + count(src, "reservedWordIn(") + " call sites (incl. its own recursion and definition); validateBlueprint returns before it for a non-object (" + (game.indexOf('if(!bp||typeof bp!=="object")return"Not a valid blueprint file."') >= 0) + "), validateSkeletonStructure throws before it without premise/acts (" + (cg.indexOf('if(!skel||!skel.premise||!skel.acts||skel.acts.length!==3)throw') >= 0) + ")");
console.log("8. the claim refusal carries name:\"CANON_TXN\" (" + count(tt, 'name:"CANON_TXN"') + " write) and nothing reads .name for a claim: the label is " + JSON.stringify((api.match(/_rsx\.claim\?"the claim and everything inside it":_rsx\.name/) || ["(pattern not found)"])[0]));
