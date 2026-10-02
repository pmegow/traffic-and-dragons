// "No prompt text changed": the GM-facing tag doc, the strip regexes and a full system prompt, hashed per tree.
require("./common.js");
var crypto = require("crypto");
function h(s) { return crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 16); }
var h0 = world();
var doc = (typeof buildStateTagsDoc === "function") ? buildStateTagsDoc() : "";
var ct = (typeof buildCtTags === "function") ? String(buildCtTags()) : "", cb = (typeof buildCtBare === "function") ? String(buildCtBare()) : "";
var sys = quiet(function () { return buildSysPrompt(); }).r;
var sysStr = (typeof sys === "string") ? sys : JSON.stringify(sys);
console.log(ver() + " doc " + doc.length + " " + h(doc) + " | strip " + h(ct) + " " + h(cb) + " | handlers " + TAG_TABLE.length + " | sysprompt " + sysStr.length + " " + h(sysStr.split(ver()).join("VER")));
