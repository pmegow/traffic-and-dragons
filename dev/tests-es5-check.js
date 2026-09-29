// tests-es5-check.js — #481 G10: the ES5 check catches every forbidden form in real code shapes, never fires on the same
// characters inside strings, comments or regex literals, and the shipped client is clean. Standalone suite (run by
// dev/run-standalone-suites.js).
var fs = require("fs"), path = require("path");
var es5 = require("./check-es5.js");
var pass = 0, fail = 0;
function test(name, fn) {
  try { var why = fn(); if (why) { fail++; console.error("FAIL " + name + " — " + why); } else { pass++; console.log("PASS " + name); } }
  catch (e) { fail++; console.error("FAIL " + name + " — " + (e && e.stack || e)); }
}
function kinds(src) { return es5.scanEs5(src).map(function (h) { return h.kind + "@" + h.line; }); }

test("each forbidden form is caught, on its own line", function () {
  var src = "var a=1;\nconst b=2;\nlet c=3;\nvar f=x=>x+1;\nvar t=`hi ${a}`;\nclass Foo{}\nclass Bar extends Foo{}\n";
  var k = kinds(src).join(",");
  var want = "const declaration@2,let declaration@3,arrow function@4,template literal@5,class declaration@6,class declaration@7";
  return k === want ? "" : "got " + k;
});
test("destructuring declarations count too", function () {
  var k = kinds("const {a}=o;\nlet [b]=arr;\n").join(",");
  return k === "const declaration@1,let declaration@2" ? "" : "got " + k;
});
test("the same characters inside strings, comments and regex literals never count", function () {
  var src = [
    "var s=\"const x => `y` class Z {\";",
    "var q='let it be => fine';",
    "// const a => b; class C {}",
    "/* let x = `multi",
    "   line => comment */",
    "var re=/=>|`|const /g;",
    "var re2=(/a\\/b`/).test(s);",
    "if(x)return /let y=>/.test(z);"
  ].join("\n");
  var k = kinds(src);
  return k.length ? "false positives: " + k.join(",") : "";
});
test("property names and member access that spell a keyword are not declarations", function () {
  var k = kinds("var o={class:\"x\",let:1};o.class=2;el.let=3;var n=o.const;").join(",");
  return k ? "false positives: " + k : "";
});
test("division is not mistaken for a regex (the arrow after it is still seen)", function () {
  var k = kinds("var h=a/2/b;\nvar f=y=>y;\n").join(",");
  return k === "arrow function@2" ? "" : "got " + k;
});
test("line numbers survive multi-line strings, comments and templates", function () {
  var k = kinds("var a='x\\\n y';\n/*\n\n*/\nvar t=`a\nb`;\nvar g=z=>z;\n").join(",");
  return k === "template literal@6,arrow function@8" ? "" : "got " + k;
});
test("the whole shipped client is clean (every root *.js)", function () {
  var files = es5.clientFiles();
  if (files.length < 30) return "too few client files found (" + files.length + ") — the scan root is wrong";
  var bad = es5.checkFiles(files);
  return bad.length ? bad.slice(0, 5).map(function (b) { return path.basename(b.file) + ":" + b.line + " " + b.kind; }).join("; ") : "";
});
test("a violation appended to a real client file is found at the right line (the scanner reads the whole file)", function () {
  var src = fs.readFileSync(path.join(es5.ROOT, "tag_table.js"), "utf8");
  var lines = src.split("\n").length;
  var k = kinds(src + "\nvar __probe=x=>x;\n").join(",");
  return k === "arrow function@" + (lines + 1) ? "" : "got " + k + " (expected line " + (lines + 1) + ")";
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
