// read-only: print the shape of one owner save (which fields can hold raw tagged GM text)
var fs = require("fs");
var f = process.argv[2];
var j = JSON.parse(fs.readFileSync(f, "utf8"));
function shape(o, d) {
  if (d > 3) return typeof o;
  if (Array.isArray(o)) return "[" + o.length + ": " + (o.length ? shape(o[o.length - 1], d + 1) : "") + "]";
  if (o && typeof o === "object") { return "{" + Object.keys(o).slice(0, 80).map(function (k) { return k + ":" + shape(o[k], d + 1); }).join(", ") + "}"; }
  return typeof o === "string" ? "str(" + o.length + ")" : typeof o;
}
console.log("top keys: " + Object.keys(j).join(", "));
Object.keys(j).forEach(function (k) { console.log("== " + k + ": " + shape(j[k], 0).slice(0, 2500)); });
