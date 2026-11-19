// Probe: serialize/parse round trip — unknown fields, a chunked transcript, a segment-0 mutation between saves,
// and a "__proto__"-named key inside a nested map.
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
var ws = L.makeTestWorld({ campId: "campA", futureField: { deep: [1, 2, { x: "y" }] } });
var i; for (i = 0; i < 600; i++) ws.transcript.push({ t: i, r: i % 2 ? "gm" : "player", x: "line " + i + " \u2014 \ud83d\udc09 caf\u00e9" });
ws.npcs.push(JSON.parse('{"name":"N","__proto__":{"polluted":1},"unknownNpcField":7}'));
var s1 = serializeWorldState(ws);
mutateTranscriptEntry(ws.transcript, 3, function (e) { e.rc = 1; });
var s2 = serializeWorldState(ws);
var back = parseWorldState(s2);
var tr = back.transcript;
console.log("form:", Object.keys(JSON.parse(s2).transcript)[0], "| entries:", tr.length, "| e3.rc:", tr[3].rc, "| e599 text ok:", tr[599].x === ws.transcript[599].x, "| s1!==s2:", s1 !== s2);
console.log("unknown top field:", JSON.stringify(back.futureField), "| npc unknown:", back.npcs[0].unknownNpcField, "| own __proto__ key kept:", Object.prototype.hasOwnProperty.call(back.npcs[0], "__proto__"), "| Object.prototype polluted:", ({}).polluted);
console.log("deep equal (minus transcript form):", JSON.stringify(back) === JSON.stringify(ws));
