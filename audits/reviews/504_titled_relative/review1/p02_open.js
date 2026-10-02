// p02 — while the question is open: do later tags for the same person gather on the provisional, and do
// tags for the ESTABLISHED person still land on her?
require("./base.js");
function setup() { fresh(); person("Wilhelmina Underbough", "she/her"); run("[NPC:Queen Underbough|furious|hostile]"); worldState.turn = 86; }
function after(label, text) {
  setup();
  var r = run(text);
  console.log(label + "\n   tags: " + text + "\n   rows: " + rows() + "\n   mem:  " + mems() + "\n   muts: " + JSON.stringify(r.muts));
}
hdr("A. variants of the CALLED name on a later turn (exact alias match is the only route to the provisional)");
after("A1 same string", "[NPC:Queen Underbough|pacing|hostile]");
after("A2 leading article", "[NPC:The Queen Underbough|pacing|hostile]");
after("A3 lower case", "[NPC:queen Underbough|pacing|hostile]");
after("A4 parenthetical", "[NPC:Queen Underbough (her mother)|pacing|hostile]");
after("A5 note under a variant", "[NPC_NOTE:The Queen Underbough|wants the wedding called off]");
after("A6 pronoun under a variant", "[NPC_PRONOUN:The Queen Underbough|she/her]");

hdr("B. the ESTABLISHED person named by her surname while the question is open (pre-#504: all of these landed on her)");
after("B1 bare surname", "[NPC:Underbough|smiling|ally]");
after("B2 an office + surname", "[NPC:Captain Underbough|smiling|ally]");
after("B3 Princess + surname (her own rank, not on file)", "[NPC:Princess Underbough|smiling|ally]");
after("B4 young + surname", "[NPC:Young Underbough|smiling|ally]");
after("B5 note by surname", "[NPC_NOTE:Underbough|owes the hero a favour]");
after("B6 pronoun by surname", "[NPC_PRONOUN:Underbough|she/her]");
after("B7 full name still exact", "[NPC:Wilhelmina Underbough|smiling|ally]");
after("B8 given name", "[NPC:Wilhelmina|smiling|ally]");
after("B9 Princess Wilhelmina", "[NPC:Princess Wilhelmina|smiling|ally]");

hdr("C. control: the same tags with NO question open (what the surname did before the provisional existed)");
fresh(); person("Wilhelmina Underbough", "she/her"); worldState.turn = 86;
var r = run("[NPC:Underbough|smiling|ally] [NPC_NOTE:Underbough|owes the hero a favour]");
console.log("   rows: " + rows() + "\n   mem:  " + mems());

hdr("D. after the SAME answer: is the fork healed?");
setup(); run("[NPC:Underbough|smiling|ally]"); worldState.turn = 87;
r = run("It is her. [NPC_MERGE:Wilhelmina Underbough|" + PK("Queen Underbough", 85) + "]");
console.log("   rows: " + rows() + "\n   mem:  " + mems() + "\n   muts: " + JSON.stringify(r.muts));
console.log("   resolve('Underbough') = " + resolveNpcName("Underbough"));
