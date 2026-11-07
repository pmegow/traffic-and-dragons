// cmp-s5.js — diff two s5-unmapped dumps (HEAD vs BASE): node dev/review-702-3/cmp-s5.js <head.json> <base.json>
var fs = require("fs");
var a = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), b = JSON.parse(fs.readFileSync(process.argv[3], "utf8")), n = 0, i;
for (i = 0; i < a.length; i++) {
  if (JSON.stringify(a[i]) === JSON.stringify(b[i])) continue;
  n++; console.log("reply " + i + " differs: " + a[i].reply);
  Object.keys(a[i]).forEach(function (k) {
    if (JSON.stringify(a[i][k]) !== JSON.stringify(b[i][k])) console.log("  " + k + ":\n    HEAD=" + JSON.stringify(a[i][k]).slice(0, 400) + "\n    BASE=" + JSON.stringify(b[i][k]).slice(0, 400));
  });
}
console.log(n + " of " + a.length + " replies differ (" + (a.length === b.length ? "same length" : "LENGTH DIFFERS " + a.length + " vs " + b.length) + ")");
