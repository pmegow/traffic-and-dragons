// dev/sabotage-faq.js — proves the player FAQ page's rules are guarded (#642): the render loop cut short, the escape dropped,
// the loud fallback silenced, the Home link and the menu row removed, the SW line removed — each must turn dev/tests-faq.js red.
//   node dev/sabotage-faq.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-faq.js"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("faq.html", [
  { label: "the render loop stops after the first question",
    find: "for(i=0;i<list.length;i++){e=list[i]||{};", replace: "for(i=0;i<1;i++){e=list[i]||{};",
    mustFail: "renders every TABLE_TALK_FAQ entry exactly once" },
  { label: "the question reaches innerHTML unescaped",
    find: "<h3>\"+esc(e.q)+\"</h3>", replace: "<h3>\"+e.q+\"</h3>",
    mustFail: "every string is escaped" },
  { label: "a missing list is silent (no console line)",
    find: "  if(!list&&typeof console!==\"undefined\")console.error(\"[faq] TABLE_TALK_FAQ is missing or empty — the page shows its loud fallback\");\n", replace: "",
    mustFail: "a missing or empty list is said" }
]);
prove("home.html", [
  { label: "the Reference card loses the guide link",
    find: "<a class=\"link\" href=\"DOC/beta-guide.html\">Beta guide — from zero to your first adventure →</a>", replace: "",
    mustFail: "two doors" }
]);
prove("ui-boot.js", [
  { label: "the File menu loses the Beta guide row",
    find: "    h+=btn(p+\"guide\",\"&#10067; Beta guide\",0);", replace: "",
    mustFail: "two doors" }
]);
/* owner 2026-10-18: the live TOC, the callout hints, the original setting */
prove("DOC/beta-guide.html", [
  { label: "a TOC entry stops being a link",
    find: '<li><a href="#broken">If something looks broken</a></li>', replace: "<li>If something looks broken</li>",
    mustFail: "TOC links every section" },
  { label: "a callout loses its hint (its TIPS entry is deleted)",
    find: '    8:["The input row","Say what you do, dictate with the mic, press Send \\u2014 and the Story and Table Talk tabs."]\n', replace: "",
    mustFail: "callouts carry a hint" },
  { label: "the press-and-hold path is removed",
    find: 'el.addEventListener("pointerdown",function(e){if(!coarse)return;cancel();hold={fired:false,x:e.clientX,y:e.clientY,timer:setTimeout(function(){if(hold){hold.fired=true;openModal(n);}},HOLD_MS)};});', replace: "",
    mustFail: "callouts carry a hint" }
]);
prove("DOC/beta-guide.html", [
  { label: "the guide loses its way back to the game",
    find: '<a href="../index.html">Game</a>', replace: "",
    mustFail: "a way back on both pages" }
]);
prove("faq.html", [
  { label: "the FAQ loses its way back to Home",
    find: '<nav><a href="home.html">Home</a>', replace: "<nav>",
    mustFail: "a way back on both pages" }
]);
prove("dev/shoot-beta-guide.js", [
  { label: "the staged world names a licensed town again",
    find: 'worldState.world.location="Harrowmere";', replace: 'worldState.world.location="Sandpoint";',
    mustFail: "licensed setting" }
]);
prove("sw.js", [
  { label: "sw.js's network-first regex drops faq.html (the SW would pin the page stale)",
    find: "faq\\.html(?:$|[?#])|", replace: "",
    mustFail: "network-first in sw.js" }
]);
/* #642 follow-up (owner 2026-10-17): the game's colour scheme on the FAQ and the guide */
prove("game-theme.js", [
  { label: "the stored light choice is never recognised (every satellite paints dark)",
    find: 'localStorage.getItem(KEY)==="light"', replace: 'localStorage.getItem(KEY)==="lite"',
    mustFail: "light when the game stored light" },
  { label: "the storage event is no longer followed (a toggle in the game leaves an open FAQ in the old scheme)",
    find: '  if(window.addEventListener)window.addEventListener("storage",function(e){if(!e||e.key===null||e.key===KEY)apply();});', replace: "",
    mustFail: "follows a storage event" }
]);
prove("faq.html", [
  { label: "the FAQ goes back to following the device instead of the game",
    find: '<script src="game-theme.js"></script>', replace: '<script src="website/system-theme.js"></script>',
    mustFail: "paints in the game's own colour scheme" }
]);
prove("DOC/beta-guide.html", [
  { label: "the guide drops the shared palette",
    find: '<link rel="stylesheet" href="../satellite.css">', replace: "",
    mustFail: "on the satellite palette" }
]);
prove("data.js", [
  { label: "the help desk's Rest answer drifts from the page's",
    find: "restores party health and mana to full, moves the clock to dawn and makes CAMP", replace: "heals the party to full, restores spells, moves the clock to dawn and makes CAMP",
    mustFail: "says the same thing everywhere" }
]);
process.exit(code);
