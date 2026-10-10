// dev/sabotage-610-google-link.js — proves #610 is guarded: the doors line and its Link button (helpers.js), the adapter's link
// path (the popup opens before the ticket fetch, the ticket rides as ?link=, the export), and the dialog's wiring.
//   node dev/sabotage-610-google-link.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#610"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var DOORS = "#610 accountDoorsHtml", ADAPTER = "#610 the adapter's link path", DIALOG = "#610 the Account dialog", RECONNECT = "#610 the door used last is remembered";/* declared before every use — a hoisted undefined mustFail would attribute anything */
prove("helpers.js", [
  { label: "the Link button never shows",
    find: 'if(!has("google"))h+="<button class=\'btn-p\' id=\'ac-link-google\'', replace: 'if(false)h+="<button class=\'btn-p\' id=\'ac-link-google\'',
    mustFail: DOORS },
  { label: "a server that lists no doors is read as already linked (no button against an older server)",
    find: 'var p=(a&&Array.isArray(a.providers))?a.providers:["github"],', replace: 'var p=(a&&Array.isArray(a.providers))?a.providers:["github","google"],',
    mustFail: DOORS }
]);
prove("storage-adapter.js", [
  { label: "the link popup opens at the plain door (the ticket never reaches it)",
    find: '      _link ? "" : serverUrl + _authPath,', replace: '      serverUrl + _authPath,',
    mustFail: ADAPTER },
  { label: "a successful sign-in no longer remembers its door",
    find: 'try { localStorage.setItem(SERVER_PROV_KEY, provider === "google" ? "google" : "github"); }', replace: 'try { }',
    mustFail: RECONNECT },
  { label: "an unknown remembered value is read as a door",
    find: 'return (p === "google" || p === "github") ? p : null;', replace: 'return p || null;',
    mustFail: RECONNECT },
  { label: "the ticket is dropped from the door's URL",
    find: '_popup.location.href = serverUrl + _authPath + "?link=" + encodeURIComponent(d.ticket);', replace: '_popup.location.href = serverUrl + _authPath;',
    mustFail: ADAPTER }
]);
prove("ui-campaigns.js", [
  { label: "the provider-less reconnect falls to GitHub again",
    find: 'if(!provider){provider=(typeof storageAdapter!=="undefined"&&storageAdapter.lastLoginProvider)?storageAdapter.lastLoginProvider():null;', replace: 'if(false){provider=(typeof storageAdapter!=="undefined"&&storageAdapter.lastLoginProvider)?storageAdapter.lastLoginProvider():null;',
    mustFail: RECONNECT }
]);
prove("ui-modals.js", [
  { label: "a dead session is a bare error again (the 401 branch is gone)",
    find: "if(/HTTP 401/.test(String(err))){", replace: "if(false){",
    mustFail: "#610 a dead session" },
  { label: "the Link button is not wired",
    find: 'var lg=document.getElementById("ac-link-google");if(lg)lg.addEventListener(', replace: 'var lg=null;if(lg)lg.addEventListener(',
    mustFail: DIALOG }
]);
process.exit(code);
