// read-only: list worldState keys of one owner save with sizes; show sessionLog roles and a sample assistant entry head
var fs = require("fs");
var f = process.argv[2];
var j = JSON.parse(fs.readFileSync(f, "utf8"));
var ws = j.worldState;
Object.keys(ws).forEach(function (k) { var v = ws[k]; var s = JSON.stringify(v); console.log(k + " : " + (Array.isArray(v) ? "array[" + v.length + "]" : typeof v) + " json=" + (s ? s.length : 0)); });
console.log("sessionLog roles: " + j.sessionLog.map(function (m) { return m.role + "(" + String(m.content).length + ")"; }).join(", "));
var a = j.sessionLog.filter(function (m) { return m.role === "assistant"; })[0];
if (a) console.log("assistant sample: " + String(a.content).slice(0, 700).replace(/\n/g, "\n"));
console.log("transcript type: " + typeof ws.transcript + (typeof ws.transcript === "string" ? " len " + ws.transcript.length + " head " + JSON.stringify(ws.transcript.slice(0, 40)) : ""));
if (Array.isArray(ws.transcript)) console.log("transcript last: " + JSON.stringify(ws.transcript[ws.transcript.length - 1]).slice(0, 600));
if (ws.tagLog) console.log("tagLog last: " + JSON.stringify(ws.tagLog[ws.tagLog.length - 1]).slice(0, 600));
