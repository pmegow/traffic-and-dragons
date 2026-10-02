// Does [LOCATION:constructor] leave a campaign that stays stuck after a reload? (pre-fix tree) argv: <tree>
process.env.ENGINE_ROOT = process.argv[2];
require("../thu/vtags/harness.js");
var BASE = { proto: Object.getOwnPropertyNames(Object.prototype), obj: Object.getOwnPropertyNames(Object) };
function clean() { var n, i, out = []; n = Object.getOwnPropertyNames(Object.prototype); for (i = 0; i < n.length; i++) if (BASE.proto.indexOf(n[i]) < 0) { out.push(n[i]); delete Object.prototype[n[i]]; } n = Object.getOwnPropertyNames(Object); for (i = 0; i < n.length; i++) if (BASE.obj.indexOf(n[i]) < 0) { out.push("Object." + n[i]); delete Object[n[i]]; } return out; }
makeWorld(); delete worldState.kind; worldState.turn = 9;
var r = run("You walk on. [LOCATION:constructor]");
console.log("muts: " + JSON.stringify(r.muts) + " | errors: " + JSON.stringify(r.r.errors || []));
console.log("location now: " + JSON.stringify(worldState.world.location));
var t1 = ""; try { quiet(function () { buildSysPrompt(); }); t1 = "builds"; } catch (e) { t1 = "THROWS " + e.message; }
console.log("same session, next prompt: " + t1);
// the reload: only what is saved survives; the built-ins are fresh in a new page
var ws = JSON.parse(JSON.stringify(worldState)), mem = JSON.parse(JSON.stringify(memory));
console.log("written on built-ins this session (gone after a reload): " + clean().join(", "));
worldState = ws; memory = mem;
var t2 = ""; try { quiet(function () { buildSysPrompt(); }); t2 = "builds"; } catch (e2) { t2 = "THROWS " + e2.message; }
console.log("after a reload, next prompt: " + t2 + " | saved location " + JSON.stringify(worldState.world.location) + " | own map node for it: " + Object.prototype.hasOwnProperty.call((memory.map || {}).nodes || {}, "constructor"));
var r3; try { r3 = run("You leave. [LOCATION:Ashfen]"); } catch (e3) { r3 = { muts: ["THROW " + e3.message], r: {} }; }
clean();
var t3 = ""; try { quiet(function () { buildSysPrompt(); }); t3 = "builds"; } catch (e4) { t3 = "THROWS " + e4.message; }
console.log("after a tag that moves away (" + JSON.stringify(r3.muts).slice(0, 120) + "): " + t3);
