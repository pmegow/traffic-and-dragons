// Probe: after the preview's admission (sheetAdmit cross, the exact ctx showCharImportPreview passes), which
// untyped fields of a hostile .char still hold markup? showCharImportPreview concatenates stats[s], char.level,
// char.hp, char.maxHp raw into innerHTML (ui-browsers.js 502/516/521).
var LE = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();
LE.makeTestWorld();
global.showToast = function (m) { console.log('TOAST', m); };
var X = '<img src=x onerror=alert(1)>';
var char = JSON.parse(JSON.stringify(worldState.character));
char.name = 'Mallory';
char.stats = { STR: X, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };
char.level = X; char.hp = X; char.maxHp = X;
var ad = sheetAdmit(char, { door: "character import", mode: "cross", detach: false, stage: "preview", rel: "@import:Mallory", portable: true });
console.log('admit ok=', ad.ok, ad.reason || '');
console.log('stats.STR=', JSON.stringify(char.stats.STR));
console.log('level=', JSON.stringify(char.level), 'hp=', JSON.stringify(char.hp), 'maxHp=', JSON.stringify(char.maxHp));
// Rebuild the exact preview fragments
var statRow = ["STR"].map(function (s) { return "<div>" + (char.stats[s] || "—") + "</div>"; }).join("");
console.log('statRow fragment:', statRow);
console.log('level fragment:', "Lv" + (char.level || 1));
console.log('hp fragment:', "HP " + char.hp + "/" + char.maxHp);
