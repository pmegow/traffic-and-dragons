// Probe: the wizard import road (#762: charImportDirect -> _importCharToReview -> buildReview's pendingImportChar branch,
// char-creation.js 188-195) concatenates ch.subraceNm/ch.cls/ch.level/ch.maxHp/ch.xp/stats raw. Do hostile values in a
// .char file survive the file checks + the preview's admission?
var LE = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();
LE.makeTestWorld();
global.showToast = function () {};
var X = '<img src=x onerror=alert(1)>';
var data = { ver: SAVE_VER, type: "character", character: JSON.parse(JSON.stringify(worldState.character)) };
var ch = data.character;
ch.name = 'Mallory'; ch.subraceNm = X; ch.cls = X; ch.xp = X; ch.maxHp = X; ch.stats.STR = X;
console.log('charFileVersionIssue ->', JSON.stringify(charFileVersionIssue(data)));
var ad = sheetAdmit(ch, { door: "character import", mode: "cross", detach: false, stage: "preview", rel: "@import:Mallory", portable: true });
console.log('admit ok=', ad.ok);
console.log('subraceNm=', JSON.stringify(ch.subraceNm), 'cls=', JSON.stringify(ch.cls), 'xp=', JSON.stringify(ch.xp), 'maxHp=', JSON.stringify(ch.maxHp), 'STR=', JSON.stringify(ch.stats.STR));
// the buildReview import-branch fragment, verbatim concatenation
var frag = '<div class="rv-sub">' + (ch.subraceNm || ch.subrace || ch.ancestry || "") + " " + (ch.cls || "") + '</div>' + '<span class="rv">' + (ch.maxHp || ch.hp || 0) + '</span><span class="rv">' + (ch.xp || 0) + '</span>';
console.log('review card fragment:', frag);
