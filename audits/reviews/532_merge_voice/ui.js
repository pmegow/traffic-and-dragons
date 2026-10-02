// Minimal fake DOM so the REAL ui-sheets.js voice controls (csWireVoice) and generateNpcSheet can be driven headlessly.
// Elements are plain objects that remember their listeners; fire(id, type) calls the real handler.
var els = {};
function el(id) { if (!els[id]) els[id] = { id: id, value: "", textContent: "", options: [{ textContent: "(option)" }], selectedIndex: 0, isConnected: true, _l: {}, addEventListener: function (t, fn) { (this._l[t] = this._l[t] || []).push(fn); } }; return els[id]; }
global.document = { getElementById: function (id) { return el(id); }, addEventListener: function () {}, removeEventListener: function () {} };
global.fire = function (id, type) { (el(id)._l[type] || []).forEach(function (fn) { fn({}); }); };
global.elOf = el;
global.resetEls = function () { els = {}; };
global.showLoadingModal = function () { return function () {}; };
global.busy = false;
loadUi("ui-sheets.js");
