require("./h.js");
// #506 through the real [NPC:] handler: a sheeted, non-party NPC with a trait, in an adventure and in the Village.
function adv() {
  makeWorld(); delete worldState.kind; worldState.turn = 30;
  worldState.npcs.push({ name: "Bram", status: "watching the road", rel: "former companion", partyMember: false, pronouns: "he/him", met: 1, portrait: null, aliases: [],
    charSheet: { name: "Bram", cls: "Warrior", level: 3, trait: "Blunt and loyal", inventory: [], abilities: [] } });
  memory.npcs.Bram = { attitude: "", knowledge: [], events: [], aliases: [] }; return wsNpcByName("Bram");
}
function vil() { villageEF(); var f = wsNpcByName("Frizwick"); f.charSheet.trait = "Sharp-tongued and quick"; f.status = "pouring ale"; return f; }
var moods = [
  // conditions on the ruled list
  "unconscious", "terrified, captured by the slavers", "badly wounded, mending a net", "asleep", "fled", "missing", "bound", "petrified", "sick",
  // condition words used as dispositions / idioms (should these be kept?)
  "restrained", "polite, restrained", "duty-bound", "honor-bound, grim", "bound to help you", "bound and determined", "bound for the coast",
  "wounded pride", "wounded, defensive", "petrified of the dark", "petrified with fear", "sick of your excuses", "sick with worry", "sick and tired", "sick at heart", "worried sick",
  "missing her brother", "a captive audience", "captivated", "poisoned by envy", "injured pride", "chained to his desk", "prisoner of his own pride", "hostage to fortune", "paralyzed with indecision",
  "spellbound", "homesick", "lovesick", "boundless", "unbound", "sickly", "wounds", "fled the scene", "asleep at his post",
  // separators other than commas
  "terrified and captured", "terrified; captured", "terrified / captured", "terrified — captured", "terrified but unconscious", "calm. unconscious", "calm - unconscious", "calm (unconscious)", "calm | unconscious",
  // conditions NOT on the list
  "knocked out", "tied up", "held captive", "taken prisoner", "kidnapped", "enslaved", "jailed", "out cold", "in chains", "gagged", "blinded", "stunned", "cursed", "charmed", "possessed", "turned to stone", "feverish", "ill", "drugged", "trapped", "lost", "gone", "escaped", "in hiding", "dying", "bleeding out",
  // death statuses / near-death
  "dead", "slain by the slavers", "mortally wounded", "wounded, left for dead", "presumed dead", "unconscious, near-dead", "dead tired", "undead", "killed",
  // case
  "UNCONSCIOUS", "Captured", "Sick"
];
function one(make, mood) {
  var n = make(), before = n.status;
  var r = run("[NPC:" + n.name + "|" + mood + "|friend]");
  return { status: n.status, dead: n.dead, mut: r.muts.filter(function (m) { return /mood kept|refused|dead|RESURRECT/.test(m); }).join(" ~ ") };
}
console.log("ENGINE_ROOT=" + process.env.ENGINE_ROOT + "  moodConditions adventure/village = " + (typeof CAMPAIGN_KINDS !== "undefined" ? CAMPAIGN_KINDS.adventure.moodConditions + "/" + CAMPAIGN_KINDS.village.moodConditions : "?"));
moods.forEach(function (m) {
  var a = one(adv, m), v = one(vil, m);
  console.log(J(m) + "\n     adventure -> " + J(a.status) + (a.dead ? " DEAD@" + a.dead : "") + (a.mut ? "   [" + a.mut + "]" : "") + "\n     village   -> " + J(v.status) + (v.dead ? " DEAD@" + v.dead : "") + (v.mut ? "   [" + v.mut + "]" : ""));
});
