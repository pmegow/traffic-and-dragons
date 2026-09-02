# Class content review — Ranger (#120), Paladin (#122), Eldritch Knight benches (#72 ③)

**Reviewer:** Fable, 2026-09-01. **Ruling:** owner chose "apply reviews directly, with a review doc for the approval pass". Every edit below is live in `class_bible.js` (canonical re-emit; the BIBLE EDITOR CONTRACT byte-pins the form). Nothing here mints new capability canon — every spell added to a bench already resolves in `capability_bible.js`, so the coverage guard stays green by construction.

## Verdicts (the #117 pass: balance · tier placement · narratability/enforceability)

**Ranger — sound; three fixes.** The 1–20 ladder reads as fiction the GM can enforce (The Long Hunt, The Impossible Shot, Apex Predator are the template-grade rows). Half-caster tiers `{2:7,3:9,4:13}` match the Paladin's and stay a draft by design. Benches T1–T4 carry four names each (the row's "T3 thin (2 spells)" note was stale). Fixes: ① the starting ability shared its NAME with the T1 spell *Hunter's Mark*, and because `capabilityLookup` resolves an ability to its spell canon, the sheet said `+d4` while the injected canon said `+1d6` every turn — renamed **Favored Quarry** with narratable text; ② L7 and L9 were rules-shorthand (`no difficult terrain penalty`, `+10 Stealth`) on a ladder whose other rows are narrated — rewritten in the house style; ③ the Hunter and Gloom Stalker blurbs quoted borrowed feature names the authored rows never use (Colossus Slayer, Giant Killer, Dread Ambusher) — the blurbs now describe the rows that exist. Beast Master left as authored.

**Paladin — sound; three fixes.** The ladder (Oathlight, The Unbroken Line, Judgment's Eye, Saint's Vessel) and all three oaths are narratable and enforceable; Devotion L20 *Call the Dawn* is the best capstone in the book. Fixes: ① the T2 and T3 benches held three names against the Ranger's four — **Zone of Truth** (fits Judgment's Eye) and **Spirit Guardians** added from the divine pool; ② skill seeds were two against the Ranger's three — **Lore** added; ③ the three oath blurbs quoted borrowed feature names (Vow of Enmity, Sacred Weapon, Holy Nimbus, Aura of Warding, Undying Sentinel) — rewritten to describe the authored rows. *Divine Smite* also exists as both a starting ability and the T1 spell, but the ability text agrees with the canon (2d8), so it was left alone.

**Eldritch Knight — the fill-phase blank closed.** `spellTiers` unlocks T3 at 14 and T4 at 18, yet both benches were `[]` (the C2 picker skipped them loudly) and T2 held two names. Filled abjuration/evocation from the Sorcerer benches: T2 +Scorching Ray, +Arcane Lock; T3 Counterspell / Dispel Magic / Fireball / Diamond Skin; T4 Wall of Fire / Ice Storm / Banishment / Greater Invisibility.

**Not changed, on record:** the half-caster tier schedule (a #72 ④ template number); the SRD-shaped names the #221 content pass owns (this review only removed borrowed names from BLURBS, never from keys).

## Every change

| Where | From | To |
|---|---|---|
| Ranger ability Hunter's Mark → Favored Quarry (name collision with the T1 spell; the ability's +d4 text contradicted the spell canon's +1d6) | "Hunter's Mark" | "Favored Quarry" |
| Ranger ability Favored Quarry text | "Mark a target. +d4 damage and advantage on tracking." | "Study a creature for a breath and it is your quarry: you read its trail, its wounds, and its next move, and your first strike against it each scene lands where it hurts." |
| Ranger L7 Land's Stride — narratable | "no difficult terrain penalty." | "Brush, bog, scree and snow cost you nothing: you move through wild ground at full pace where others crawl, and thorns and briars part rather than tear." |
| Ranger L9 Hide in Plain Sight — narratable | "+10 Stealth camouflage." | "Given a minute and anything to work with — mud, leaf, ash, shadow — you become part of the ground: until you move, anyone searching for you looks straight through you." |
| Ranger/Hunter desc — describes the authored rows, drops borrowed feature names | "Colossus Slayer on wounded targets. Giant Killer reaction. Defensive multiattack." | "The bigger they are: wounded and oversized prey fall to your first strike, you read any beast at a glance, and one kill carries into the next." |
| Ranger/Gloom Stalker desc — describes the authored rows | "Invisible in magical darkness. Extra attack on first round. Dread Ambusher." | "Terror from the dark: you see in any darkness, step shadow to shadow, and the camp you hit at night never raises an alarm." |
| Paladin T2 bench +Zone of Truth (divine, in the bible; fits Judgment's Eye) | ["Aid","Magic Weapon","Find Steed"] | ["Aid","Magic Weapon","Find Steed","Zone of Truth"] |
| Paladin T3 bench +Spirit Guardians (divine, in the bible) | ["Revivify","Dispel Magic","Aura of Vitality"] | ["Revivify","Dispel Magic","Aura of Vitality","Spirit Guardians"] |
| Paladin skillSeeds +Lore | ["Persuasion","Insight"] | ["Persuasion","Insight","Lore"] |
| Paladin/Vengeance desc | "Hunter of the wicked. Vow of Enmity for advantage. Relentless pursuit. Banishment." | "Hunter of the wicked: name your enemy before witnesses and nothing shields them — not distance, not flight, not their own power." |
| Paladin/Devotion desc | "Sacred Weapon -- add CHA to attacks. Holy Nimbus aura. Purity of spirit." | "The oath others lean on: your word cannot break, your body takes the blow meant for the weak, and where you stand becomes holy ground." |
| Paladin/Ancients desc | "Nature's warrior. Aura of Warding vs spells. Undying Sentinel at 0 HP." | "Sworn to the life older than the gods: the wild takes your side, rot slides off you, and the first time each day you would fall, the green does not let go." |
| EK T2 bench 2→4 (+Scorching Ray, +Arcane Lock) | ["Misty Step","Mirror Image"] | ["Misty Step","Mirror Image","Scorching Ray","Arcane Lock"] |
| EK T3 bench filled (abjuration/evocation) | [] | ["Counterspell","Dispel Magic","Fireball","Diamond Skin"] |
| EK T4 bench filled (abjuration/evocation) | [] | ["Wall of Fire","Ice Storm","Banishment","Greater Invisibility"] |
