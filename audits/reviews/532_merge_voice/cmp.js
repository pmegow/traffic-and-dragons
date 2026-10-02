// Side-by-side diff of two probe outputs, cell by cell (strips the [BEFORE]/[AFTER] prefix).
var fs = require("fs");
function load(f) { var o = {}; fs.readFileSync(f, "utf8").split(/\r?\n/).forEach(function (l) { var m = l.match(/^\[(?:BEFORE|AFTER)\] (.*?): (\{.*\}|\[.*\]|.*)$/); if (m) o[m[1]] = m[2]; }); return o; }
var b = load(process.argv[2]), a = load(process.argv[3]), keys = Object.keys(a), same = 0;
Object.keys(b).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
keys.forEach(function (k) { if (b[k] === a[k]) { same++; return; } console.log("== " + k + "\n   BEFORE " + b[k] + "\n   AFTER  " + a[k]); });
console.log("(" + same + " of " + keys.length + " cells identical)");
