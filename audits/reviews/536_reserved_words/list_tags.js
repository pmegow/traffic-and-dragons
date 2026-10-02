process.env.ENGINE_ROOT = process.argv[2];
require("../../thu/vtags/harness.js");
console.log("TAG_TABLE (" + TAG_TABLE.length + "): " + TAG_TABLE.map(function (e) { return e.t + (e.nc ? "*" : ""); }).join(" "));
console.log("STRIP names not in table: " + TAG_STRIP_NAMES.filter(function (n) { return !TAG_TABLE.some(function (e) { return e.t === n; }); }).join(" "));
console.log("reserved words: " + Object.keys(typeof RESERVED_KEY_WORDS !== "undefined" ? RESERVED_KEY_WORDS : {}).join(", "));
console.log("Object.prototype own names: " + Object.getOwnPropertyNames(Object.prototype).join(", "));
