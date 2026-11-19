// Probe: does a hostile character NAME survive the import admission, and what does the library row's inline
// onclick (ui-browsers.js line 444) become after the HTML parser decodes the attribute?
var LE = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();
LE.makeTestWorld();
global.showToast = function () {};
var hostile = 'Mal");alert(document.domain);//';
var char = JSON.parse(JSON.stringify(worldState.character));
char.name = hostile;
var ad = sheetAdmit(char, { door: "character import", mode: "cross", detach: false, stage: "preview", rel: "@import:x", portable: true });
console.log('admit ok=', ad.ok, '| name after admission =', JSON.stringify(char.name));
var slug = LibrarySlug.library(char.name);
// exactly the ui-browsers.js 444 concatenation
var attr = "onclick='event.stopPropagation();_cbDelLib(\"" + escHtml(slug) + "\",\"" + escHtml(char.name).replace(/"/g, "&quot;") + "\")'";
console.log('markup  :', attr);
// The HTML tokenizer decodes character references inside attribute values before the handler is compiled.
var decoded = attr.replace(/^onclick='/, '').replace(/'$/, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
console.log('handler JS:', decoded);
try { new Function('event', '_cbDelLib', 'alert', 'document', decoded); console.log('handler parses as JS: yes'); } catch (e) { console.log('handler parses as JS: NO (' + e.message + ')'); }
// does the alert actually run? execute with stubs
var ran = [];
try { (new Function('event', '_cbDelLib', 'alert', 'document', decoded))({ stopPropagation: function () {} }, function () { ran.push('_cbDelLib'); }, function (x) { ran.push('alert(' + x + ')'); }, { domain: 'game.origin' }); } catch (e) { ran.push('threw ' + e.message); }
console.log('executed:', ran.join(' then '));
