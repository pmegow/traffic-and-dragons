// One relative named under several titles while the first question is open: each form opens its own question; the cap is 4.
require("./b.js");
q(); var forms = ["Old Queen Underbough", "Lady Underbough", "Queen Mother Underbough", "Mistress Underbough", "Dame Underbough"], i;
for (i = 0; i < forms.length; i++) { worldState.turn++; var r = run("[NPC:" + forms[i] + "|weeping " + i + "|hostile]"); console.log("  t" + worldState.turn + " [NPC:" + forms[i] + "|…] muts=" + JSON.stringify(r.muts) + (r.warns.length ? " warns=" + JSON.stringify(r.warns.map(function (w) { return w.slice(0, 150); })) : "")); }
console.log("  provisionals: " + Object.keys(memory.npcs).filter(function (k) { return memory.npcs[k].provisional; }).join(" | "));
console.log("  the princess: " + rows().split(";")[0]);
