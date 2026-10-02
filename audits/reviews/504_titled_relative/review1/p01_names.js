// p01 — which names raise the #504 question, which merge, which fork. One established person per case.
require("./base.js");
function tryName(recordKey, pron, called, recAliases) {
  fresh();
  person(recordKey, pron);
  if (recAliases) memory.npcs[recordKey].aliases = recAliases.slice();
  var c, err = "";
  try { c = npcConsolidation(called); } catch (e) { err = "THROW " + e.message; c = {}; }
  var r, err2 = "";
  try { r = run("[NPC:" + called + "|waiting|neutral]"); } catch (e2) { err2 = "THROW " + e2.message; r = { muts: [] }; }
  var keys = Object.keys(memory.npcs);
  var out = keys.length === 1 ? "MERGED into the record" : (keys.some(function (k) { return memory.npcs[k].provisional; }) ? "ASKED (provisional)" : "FILED APART (new record, no question)");
  console.log(JSON.stringify(called) + " beside " + JSON.stringify(recordKey) + (pron ? " (" + pron + ")" : "") + (recAliases ? " aka " + JSON.stringify(recAliases) : "") + "  ->  " + out + "   ask=" + JSON.stringify(c.ask) + " key=" + JSON.stringify(c.key) + (err ? " " + err : "") + (err2 ? " " + err2 : "") + "   keys=" + JSON.stringify(keys));
}
hdr("baseline — designed behaviour");
tryName("Wilhelmina Underbough", "she/her", "Queen Underbough");
tryName("Belor Hemlock", "he/him", "Sheriff Hemlock");

hdr("surnames the core tokenizer splits (apostrophe, hyphen, accent, particle) — a titled relative");
tryName("Fitzwilliam D'Arcy", "he/him", "Lord D'Arcy");
tryName("Anna Smythe-Jones", "she/her", "Lady Smythe-Jones");
tryName("Mara Isén", "she/her", "Queen Isén");
tryName("Anna van der Berg", "she/her", "Lady van der Berg");
tryName("Simon de Montfort", "he/him", "Lord de Montfort");
tryName("Ameiko Kaijitsu", "she/her", "Lady Kaijitsu");
tryName("Kor'vak Dral", "he/him", "Lord Dral");

hdr("records that end in an epithet, a place or a suffix (the shared word is not the LAST core token)");
tryName("Aldric Underbough of Elderwood", "he/him", "Lord Underbough");
tryName("Wilhelmina Underbough the Younger", "she/her", "Queen Underbough");
tryName("Wilhelmina Underbough II", "she/her", "Queen Underbough");
tryName("Wilhelmina Underbough (the princess)", "she/her", "Queen Underbough");
tryName("Wilhelmina Underbough, Heir of Elderwood", "she/her", "Queen Underbough");

hdr("title shapes");
tryName("Wilhelmina Underbough", "she/her", "The Queen Underbough");
tryName("Wilhelmina Underbough", "she/her", "queen underbough");
tryName("Wilhelmina Underbough", "she/her", "QUEEN UNDERBOUGH");
tryName("Wilhelmina Underbough", "she/her", "Queen-Mother Underbough");
tryName("Wilhelmina Underbough", "she/her", "Queen Mother Underbough");
tryName("Wilhelmina Underbough", "she/her", "Queen Underbough (her mother)");
tryName("Wilhelmina Underbough", "she/her", "Underbough, the Queen");
tryName("Wilhelmina Underbough", "she/her", "Queen of Underbough");
tryName("Wilhelmina Underbough", "she/her", "Her Majesty Queen Underbough");
tryName("Wilhelmina Underbough", "she/her", "Queen Underbough's ghost");
tryName("Wilhelmina Underbough", "she/her", "Old Queen Underbough");
tryName("Wilhelmina Underbough", "she/her", "Dowager Queen Underbough");
tryName("Wilhelmina Underbough", "she/her", "Mrs Underbough");
tryName("Wilhelmina Underbough", "she/her", "Duchess Underbough");
tryName("Wilhelmina Underbough", "she/her", "Aunt Underbough");
tryName("Wilhelmina Underbough", "she/her", "Grandmother Underbough");
tryName("Wilhelmina Underbough", "she/her", "Widow Underbough");
tryName("Wilhelmina Underbough", "she/her", "Baroness Underbough");
tryName("Wilhelmina Underbough", "she/her", "Madam Underbough");
tryName("Wilhelmina Underbough", "she/her", "Young Underbough");
tryName("Wilhelmina Underbough", "she/her", "Elder Underbough");
tryName("Wilhelmina Underbough", "she/her", "Mother Underbough");
tryName("Wilhelmina Underbough", "she/her", "Sister Underbough");
tryName("Wilhelmina Underbough", null, "King Underbough");
tryName("Wilhelmina Underbough", "they/them", "King Underbough");

hdr("the record already carries a title — in the key, in an alias, in another spelling");
tryName("Ser Aldric Voss", "he/him", "Sir Voss");
tryName("Lord Aldric Voss", "he/him", "Lady Voss");
tryName("Lord Aldric Voss", "he/him", "Lord Voss");
tryName("Aldric Voss", "he/him", "Lord Voss", ["Lord Aldric"]);
tryName("Aldric Voss", "he/him", "Lord Voss", ["the lord of Blackmere"]);
tryName("Aldric Voss", "he/him", "Lord Voss", ["Landlord Voss"]);
tryName("Aldric Voss", "he/him", "Master Voss", ["the master's apprentice"]);
tryName("Aldric Voss", "he/him", "Sister Voss", ["his sister's keeper"]);

hdr("first word of the record is the shared one / single-word records / role records");
tryName("Underbough Wilhelmina", "she/her", "Queen Underbough");
tryName("Underbough", "she/her", "Queen Underbough");
tryName("The Underbough", "she/her", "Queen Underbough");
tryName("Garrick the Smith", "he/him", "Master Smith");
tryName("Tom Fisher", "he/him", "Mother Fisher");
tryName("Erik the Red", "he/him", "Lord Red");
tryName("Brother Marcus", "he/him", "Sister Marcus");
tryName("Mother Vane", "she/her", "Lady Vane");

hdr("Object.prototype keys and digits");
tryName("Wilhelmina Constructor", "she/her", "Queen Constructor");
tryName("Wilhelmina Underbough", "she/her", "constructor");
tryName("Wilhelmina Underbough", "she/her", "Queen __proto__");
tryName("Wilhelmina Valueof", "she/her", "Queen Valueof");
tryName("Wilhelmina Tostring", "she/her", "Queen Tostring");
tryName("Wilhelmina Hasownproperty", "she/her", "Queen Hasownproperty");
tryName("Unit 7 Underbough", "they/them", "Lord Underbough");
tryName("Wilhelmina Underbough3", "she/her", "Queen Underbough3");
tryName("Wilhelmina 3", "she/her", "Queen 3");
