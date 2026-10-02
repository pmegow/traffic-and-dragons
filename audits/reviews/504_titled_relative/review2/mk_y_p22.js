// Builds y_p22_original_prng_count.js: the first reviewer's p22 with its ORIGINAL PRNG, plus a counter of distinct sequences.
var fs = require("fs");
var s = fs.readFileSync(__dirname + "/../agent/p22_fuzz4.js", "utf8");
s = s.replace('require("./base.js");', 'require("../agent/base.js");var __distinct={};');
var a = "    var vs = check(res), a; for (a = 0; a < vs.length; a++) { if (/^CROSS/.test(vs[a]) && armedUsed) continue; note(vs[a], seq, hit); }\n  }";
if (s.indexOf(a) < 0) throw new Error("anchor missing");
s = s.replace(a, a + '\n  __distinct[seq.join("|").replace(/#[0-9]+/g,"#")]=1;');
var b = 'console.log("\\n" + N + " sequences, "';
if (s.indexOf(b) < 0) throw new Error("anchor 2 missing");
s = s.replace(b, 'console.log("DISTINCT sequences (note counters ignored): "+Object.keys(__distinct).length+" of "+N);' + b);
fs.writeFileSync(__dirname + "/y_p22_original_prng_count.js", s);
console.log("written");
