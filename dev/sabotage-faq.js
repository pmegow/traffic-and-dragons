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
  { label: "the Reference card loses the FAQ link",
    find: "<a class=\"link\" href=\"faq.html\">Player FAQ — the first five minutes →</a>", replace: "",
    mustFail: "two doors" }
]);
prove("ui-boot.js", [
  { label: "the File menu loses the Player FAQ row",
    find: "    h+=btn(p+\"faq\",\"&#10067; Player FAQ\",0);", replace: "",
    mustFail: "two doors" }
]);
prove("sw.js", [
  { label: "sw.js's network-first regex drops faq.html (the SW would pin the page stale)",
    find: "faq\\.html(?:$|[?#])|", replace: "",
    mustFail: "network-first in sw.js" }
]);
process.exit(code);
