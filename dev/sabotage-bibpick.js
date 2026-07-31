// sabotage-bibpick.js — prove the BIB PICKER CONTRACT (v1.507) actually guards.
// Each case breaks one clause of the "+ from bible" picker in bible_editor.html;
// the suite must go red on every one, and every mutation must change real bytes.
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({
  file: "bible_editor.html",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "tier filter inverted (spells of every tier leak in)",
      find: "if (!e || e.kind !== \"spell\" || e.tier !== want) return;",
      replace: "if (!e || e.kind !== \"spell\") return;" },
    { label: "ability entries leak into the spell picker",
      find: "e.kind !== \"spell\" || e.tier !== want",
      replace: "e.tier !== want" },
    { label: "cantrips no longer maps to tier 0",
      find: "var want = tier === \"cantrips\" ? 0 : parseInt(tier, 10);",
      replace: "var want = parseInt(tier, 10);" },
    { label: "already-listed names stop being excluded",
      find: "if (have[nk] || seen[nk]) return;",
      replace: "if (seen[nk]) return;" },
    { label: "the parenthetical strip is dropped from the comparator",
      find: "var norm = function (s) { var i = String(s || \"\").indexOf(\"(\"); return (i < 0 ? String(s || \"\") : String(s).slice(0, i)).replace(/\\s+$/, \"\").toLowerCase(); };",
      replace: "var norm = function (s) { return String(s || \"\").toLowerCase(); };" },
    { label: "ADD entries no longer join the candidates",
      find: "for (k in (addMap || {})) take(k, addMap[k]);",
      replace: "" },
    { label: "the button renders but is never wired",
      find: "var bps = m.querySelectorAll(\"button[data-bibpick]\");",
      replace: "var bps = [];" },
    { label: "chipList stops rendering the button",
      find: "if (tier !== undefined) h += \" <button data-bibpick='\" + path + \"' data-bibtier='\" + esc(String(tier)) + \"' title='pick from the capability bible'>+ from bible</button>\";",
      replace: "" }
  ]
}));
