// agent3 bootstrap #2: the real engine with the REAL saveCore/saveMem/loadState (an in-memory localStorage), for load-path probes.
var WT = process.env.ENGINE_ROOT || "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/wt-rev3";
var mem = {};
global.localStorage = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; }, key: function (i) { return Object.keys(mem)[i] || null; }, get length() { return Object.keys(mem).length; } };
global.__ls = mem;
var l = require(WT + "/dev/load-engine.js");
var _ow = console.warn, _oi = console.info, _od = console.debug;
console.warn = function () {}; console.info = function () {}; console.debug = function () {};
l.loadEngine("game.js");
console.warn = _ow; console.info = _oi; console.debug = _od;
var geval = eval;
geval("addMsg=function(){return {appendChild:function(){},style:{},remove:function(){},textContent:'',innerHTML:'',className:''};};" +
  "showToast=function(m){__toasts.push(String(m));};var __toasts=[];syncUI=function(){};updateAbPanel=function(){};updateSpPanel=function(){};" +
  "showArchetypeModal=function(){};showStatBumpModal=function(){};" +
  "if(typeof storageAdapter==='undefined')storageAdapter={syncToServer:function(){},syncNow:function(){},resetSyncState:function(){}};");
global.makeWorld = function () { l.makeTestWorld(); __toasts.length = 0; return worldState; };
global.quiet = function (fn) { var warns = [], oc = console.warn, oi = console.info, od = console.debug, oe = console.error; console.warn = function (m) { warns.push("W " + String(m)); }; console.info = function (m) { warns.push("I " + String(m)); }; console.debug = function () {}; console.error = function (m) { warns.push("E " + String(m)); }; try { return { r: fn(), warns: warns }; } finally { console.warn = oc; console.info = oi; console.debug = od; console.error = oe; } };
global.J = function (v) { return JSON.stringify(v); };
global.endings = function (cs) { return (cs.coreMemories || []).filter(function (m) { return m && m.kind === "ending"; }).map(function (m) { return m.text; }); };
module.exports = { WT: WT, l: l };
