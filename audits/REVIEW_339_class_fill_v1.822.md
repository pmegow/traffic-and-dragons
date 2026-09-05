# Owner review — #339 class-ladder capability fill (v1.822)

Fable drafted 176 capability entries so every class-bible feature resolves. Each row: the class bible's feature (level), then the drafted canon — cost · magical · tradition · dice · effect. Entries are keyed by base name, so **fighting style**, **extra attack** and **consecrated ground** are ONE entry each shared across classes. Edit any row in `capability_bible.js` (or through the bible editor) and the coverage guard keeps the set complete.

## Draft numbers that are NOT in the class bible

The class bible's `ds` text gave no figure; the GM needs one; these are my drafts and the first thing to review:

- favored quarry — +1d6 on the first hit per scene
- old blood — +1 AC unarmored
- elemental vein — +1 damage die on your element
- sorcerous restoration — recover HALF your mana, once per day
- metamagic — +1 mana per shaping
- presence of the wyrm — WIS save or falter
- tides of chaos — advantage on a gamble
- bend luck — ±1d4, costs 1 mana
- chaos feeds you — regain mana equal to the surge's tier
- unraveling presence — foes: disadvantage on their first attempt against you each scene
- hound of ill omen — 1 mana
- the dark between — CHA save resists the drag
- bonded companion — the beast acts on your turn
- terror in the dark — WIS save
- totem spirit (Wolf) — allies +1d4 damage
- the beast beneath — unarmed 1d10; grapples unbreakable without magic
- furious leap — STR save or prone
- terrifying frenzy — WIS save
- storm shroud (lightning) — 1d8 to attackers (from the ds)
- disciple of life — +1d4 on every heal
- the green vow — STR to break the vines
- root and branch — STR to break free
- the falling star — DEX for half (ds gave the 4d10 and the knockdown, not a save)
- war shape — temporary HP equal to your level per shift
- wrath that walks — WIS or desert
- vampiric charm — WIS save (ds said "savings throw", stat unspecified)
- bone shards / bone structure / accelerated decay / unraveling — 1 mana each
- field of entropy — concentration, 2 mana
- bone armor — AC as plate, 1 mana, one scene
- bone golem — an hour and a heap of bone, one at a time, "strong as an ogre"
- bone dragon — per-day, one scene (ds: "Summons a bone dragon.")
- consecrated ground — MERGED semantics: the Cleric's night-rite version and Devotion's plant-your-feet version in one entry

## Tier bands used

Levels 1–4 → tier 1 · 5–9 → tier 2 · 10–14 → tier 3 · 15–20 → tier 4 (capstones tier 4, cost `per-campaign`). Tier is display/injection weight for abilities; cost is the real axis.


## Rogue

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 9 | **Blindsense** | passive | no | martial | N/A | You know where every hidden or invisible creature within 10ft stands — breath, weight on a board, the wrongness in the air. Nothing that close can surprise you, and you strike what you cannot see there without penalty. |

## Sorcerer

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 2 | **Font of Magic** | passive | yes | arcane | N/A | Your power is a reservoir in the blood, not a book. You always know exactly how much magic you have left, and at a glance how nearly spent any other caster in sight is. The reading is never wrong. |
| 5 | **Metamagic** | +1 mana per shaping | yes | arcane | N/A | Bend a spell's shape as you cast it: quicken it to an instant, twin it onto a second target, stretch its range or duration, or work it with no word or gesture at all. One shaping per casting, on top of the spell's own cost. |
| 7 | **Sorcerous Restoration** | per-day (ten minutes of stillness) | yes | arcane | N/A | Ten quiet minutes give back what a night gives other casters: recover half your mana. Once per day — a sorcerer who catches their wind is a sorcerer rearmed. |
| 9 | **Overchannel** | self-damage | yes | arcane | 1d6 to yourself per tier of the spell | Push a spell past its ceiling: maximum possible effect, no roll. The price is paid in your own body — 1d6 per tier of the spell — and those wounds refuse all healing until you next sleep. The power was never free; it was borrowed. |
| 11 | **Arcane Sight** | passive | yes | arcane | N/A | You see magic as plainly as light. Every enchantment, ward, curse and active spell declares itself; every illusion shows its brushstrokes; every disguised face shows the one beneath. |
| 13 | **Split Weave** | passive | yes | arcane | N/A | Your mind holds two workings at once: sustain two concentration spells simultaneously. Losing one does not shake the other. |
| 15 | **Body of Magic** | passive | yes | arcane | N/A | The flesh is half power now. You barely need food, sleep or air; poison and disease find nothing to grip; you age at a crawl. The frailty remains — what cuts you still cuts. |
| 17 | **Witnessed Once, Worked Once** | per-day | yes | arcane | as the spell | Once per day, work a spell you do not know but have seen worked in your sight — friend's blessing or enemy's curse — once, exactly as it was done, at its normal cost. |

## Sorcerer/Draconic Bloodline

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Old Blood** | passive | yes | arcane | N/A | The dragon in your line wakes. Fine scales harden your skin where armor would sit (+1 AC unarmored); one element runs in your veins, chosen once — flame, frost, storm or venom; and dragons and their kin know you on sight for what you carry. |
| 6 | **Elemental Vein** | passive | yes | arcane | +1 damage die on spells of your element | Your element cannot harm you, and it answers small requests without a spell: candle-flames bow, frost blooms across a window, sparks leap to your palm. Your spells of that element roll one extra damage die. |
| 10 | **Presence of the Wyrm** | at-will | yes | arcane | N/A | Let the old blood fill the room. Lesser creatures' nerve breaks under your attention — they flee, freeze or yield (WIS resists); hardened ones bargain more carefully. Neither charm nor fear: the older thing both descend from. |
| 14 | **Wings** | at-will | yes | arcane | N/A | They were always there, waiting. Wings tear free when called and fold away to nothing — true flight, your own, in any armor, at any hour. |
| 18 | **Wyrmform** | per-day | yes | arcane | N/A | Take the full shape of the dragon whose blood you carry — wings, breath, bulk and the fear that comes with it — for a scene. What you do wearing it is remembered. |
| 20 | **The Progenitor's Due** | per-campaign | yes | arcane | N/A | CAPSTONE. Speak the true name in your blood and your ancestor answers: the progenitor dragon itself comes, in the flesh, disposed to treat you as kin. What it does when it arrives is its own will — dragons are not tame. But it came for you, and the world saw it come. |

## Sorcerer/Wild Magic

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Tides of Chaos** | passive | yes | arcane | advantage on a gamble | Chaos likes you. When you gamble — a reckless casting, a mad plan, a coin-flip moment — fortune leans your way (advantage). In exchange your magic sometimes answers with an idea of its own: a surge the GM narrates, wondrous or inconvenient, never nothing. |
| 6 | **Bend Luck** | 1 mana | yes | arcane | ±1d4 to a roll just made | Another's fortune is yours to nudge: steal a stumble from an ally's slip or gift one to an enemy's sure step (±1d4). A visible flicker of wrongness accompanies it — dice land on edge, bowstrings snap, the horseshoe falls. |
| 10 | **Controlled Chaos** | passive | yes | arcane | N/A | The surge is no longer blind. When your magic answers with its own idea it offers two, and you choose which one happens. Chaos has stopped happening to you and started negotiating. |
| 14 | **Chaos Feeds You** | passive | yes | arcane | regain mana equal to the surge's tier | Every surge in your sight — yours, a miscast, an artifact's tantrum — pours power back into you instead of taking it. Standing in another caster's catastrophe, you are the only one getting stronger. |
| 18 | **Unraveling Presence** | passive | yes | arcane | foes: disadvantage on their first attempt against you each scene | Probability frays around you. Locks slip, arrows curve, the one loose stone finds an enemy's foot; within 30ft the improbable becomes merely uncommon, and it is never on the other side. A GM who plans around you plans in ranges. |
| 20 | **Rewrite the Odds** | per-campaign | yes | arcane | N/A | CAPSTONE. Name one moment of pure chance — a fall, a storm, a draw, a die — and declare its outcome, however impossible. It happens exactly as spoken. Chance owed you one, and everyone watching learns it paid. |

## Sorcerer/Shadow Magic

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Eyes of the Dark** | passive | yes | arcane | N/A | No darkness is dark to you, mundane or magical, and the dark answers small requests: torches gutter, shadows pool and stretch, a corner is unlit when you need one. Something on the far side of the dark knows your name now. |
| 6 | **Hound of Ill Omen** | 1 mana (one hound at a time) | yes | arcane | N/A | Whisper a name into a shadow and a hound of it steps out to harry that creature. It does not tire, it does not lose the trail, and its quarry sleeps badly until the hound is called off or destroyed. |
| 10 | **Shadow Walk** | at-will | yes | arcane | N/A | Every shadow is a door. Step into one and out of any other you have stood in before, however far — the cold between them crossed in a single held breath. What lives in that cold has learned to let you pass. |
| 14 | **The Shadow Half** | at-will | yes | arcane | N/A | Your shadow can leave you: a second self of dark that walks, watches and whispers back what it sees. While it is out you cast a shadow that is not yours, and the observant notice. If it is destroyed you feel it, and it returns only at nightfall. |
| 18 | **The Dark Between** | at-will | yes | arcane | N/A | Pull others through with you: carry companions along a Shadow Walk, or drag an enemy into the cold between (CHA resists) and finish the conversation there, in a realm where every advantage is yours. Its native things treat you as one of their lords. |
| 20 | **Sovereign of the Night** | per-campaign | yes | arcane | N/A | CAPSTONE. From one dusk to the next dawn the night is yours: every shadow a door, every darkness your eyes and ears, every dark thing yours to command. One night to move an army unseen, empty a fortress, or visit every enemy you have at once. Then the sun rises, and the debt is even. |

## Ranger

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 1 | **Favored Quarry** | at-will | no | martial | +1d6 on your first hit against it each scene | Study a creature for a breath and it is your quarry: you read its trail, its wounds and its next move, and your first strike against it each scene lands where it hurts. |
| 2 | **Fighting Style** | passive | no | martial | by style | Choose one, permanently, when you gain this: Archery (+2 to ranged attacks), Defense (+1 AC in armor), Dueling (+2 damage with a lone one-handed weapon), Two-Weapon (add your modifier to the off-hand hit), Great Weapon (reroll 1s and 2s on two-handed damage), or Protection (once per round, impose disadvantage on an attack against an adjacent ally). |
| 5 | **Extra Attack** | passive | no | martial | N/A | Attack twice whenever you take the attack action. |
| 7 | **Land's Stride** | passive | no | martial | N/A | Brush, bog, scree and snow cost you nothing: you move through wild ground at full pace where others crawl, and thorns and briars part rather than tear. |
| 11 | **The Long Hunt** | passive | yes | primal | N/A | Your Hunter's Mark never fades until you release it. You know the direction and freshness of your quarry's trail anywhere in the region, and it cannot lose you by mundane means. |
| 13 | **The Impossible Shot** | per-scene | no | martial | N/A | Once per scene, make the shot no one else would attempt — through the arrow slit, the rope at fifty paces, the apple off the moving cart. Declare it; it lands. |
| 15 | **One with the Wild** | passive | yes | primal | N/A | In natural terrain you cannot be tracked, ambushed or outpaced, and beasts will not raise a claw against you unprovoked. |
| 17 | **Apex Predator** | passive | no | martial | crit on 18–20 against it; allies +2 to hit it | Your marked quarry is already dead and its body just hasn't heard: your attacks against it crit on 18–20, it cannot hide from you, and your allies strike it harder for knowing you're on it. |

## Ranger/Hunter

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Bigger They Are** | passive | no | martial | +2d6 on your first strike each round | Your first strike each round against a wounded or oversized foe deals +2d6 — the larger the target, the surer your point finds the seam. |
| 6 | **Read the Beast** | at-will | no | martial | N/A | One look tells you any creature's strengths, its weaknesses and how much fight it has left — exact wounds, what it resists, and the move it will make next. |
| 10 | **Cull the Herd** | passive | no | martial | N/A | When a foe drops to your attack, your momentum carries into the next: immediately strike another target in reach or range. The chain breaks only when you miss. |
| 14 | **Nowhere Soft to Land** | passive | no | martial | N/A | Numbers stop meaning anything: foes gain no advantage from surrounding or flanking you, their opportunity strikes miss, and when three or more engage you, it is you who has the advantage. |
| 18 | **Slayer of Legends** | passive | no | martial | N/A | The creatures out of old stories are just bigger quarry: your weapons wound anything however warded, and no aura of terror, majesty or size makes your hands hesitate. |
| 20 | **The Last Great Hunt** | per-campaign | no | martial | N/A | CAPSTONE. Name a single creature the object of your Last Great Hunt: no distance, disguise or plane hides it from your pursuit, and when you finally close, your killing shot cannot be prevented — only survived. |

## Ranger/Beast Master

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Bonded Companion** | passive | yes | primal | N/A | A beast of the wild has chosen you: it fights beside you (acting on your turn), shares your instincts and obeys without words. If it dies, no other will choose you for a year and a day — the wild takes bonds seriously. |
| 6 | **Shared Senses** | at-will | yes | primal | N/A | Close your eyes and use your companion's: see, hear and scent through it at any distance you could walk in a day. |
| 10 | **Pack of Two** | passive | yes | primal | N/A | You fight as one animal in two bodies: when either of you lands a hit, the other may immediately strike the same target. |
| 14 | **Kinship of the Wild** | per-scene | yes | primal | N/A | Any beast will hear you out. Once per scene, ask the wild a favor — a hawk to carry word, wolves to harry a column, rats to empty a granary by dawn. |
| 18 | **Companion of Legend** | passive | yes | primal | N/A | Your companion has grown into something from the old stories — dire-sized, cunning as a person, known by name in three kingdoms. Enemies plan around it now, not you. |
| 20 | **Two Hearts, One Life** | at-will (the death-taking: per-campaign) | yes | primal | split your remaining HP | Death cannot part you: when either of you falls, the other may share its own life to pull them back (split your remaining HP between you). And once — only once — one of you may take the other's death entirely, whatever its cause. |

## Ranger/Gloom Stalker

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Terror in the Dark** | passive | no | martial | N/A | Foes you strike from darkness or ambush must check their nerve (WIS) or panic — a camp you hit at night starts breaking before it forms ranks. |
| 6 | **No Light Needed** | passive | yes | primal | N/A | You see perfectly in any darkness, mundane or magical, and darkness likes you back: within 30ft of you torches gutter and lanterns shrink to a glow. |
| 10 | **The Unseen Path** | once per round | yes | primal | N/A | Once per round, step from one shadow into another you can see. The dark is a hallway only you have the key to. |
| 14 | **Leave No Witness** | passive | no | martial | N/A | A foe you drop from stealth goes down silently — no cry, no clatter, no alarm — and nothing you do in darkness reveals where you are. |
| 18 | **Where Lights Die** | per-day | yes | primal | N/A | Night itself takes your side: once per day, drown a battlefield in a darkness only you and your allies see through, for a whole scene. |
| 20 | **The Long Night** | per-campaign | yes | primal | N/A | CAPSTONE. You are the thing veterans warn recruits about. Declare a night yours: until dawn, within a mile, the darkness answers to you — who sleeps, who wakes, who is found, and who never is. |

## Primal

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 2 | **Gathering Rage** | passive | no | martial | +10% damage per attack after the first | Each attack after the first in a fight adds another 10% to the damage you deal, building as long as you keep swinging. Stop, and the count starts over. |
| 5 | **Extra Attack** | passive | no | martial | N/A | Attack twice whenever you take the attack action. |
| 7 | **Feral Instinct** | passive | no | martial | advantage on initiative | Advantage on initiative. If you are surprised while raging, you act normally anyway. |
| 9 | **Brutal Critical** | passive | no | martial | +1 damage die on a critical hit | Roll one extra damage die whenever you land a critical hit. |
| 11 | **Rage Without End** | passive | no | martial | N/A | Your rage lasts as long as the fight does, and dropping to 0 HP does not end it — you get one more round of fury on your feet before your body files its complaint. |
| 13 | **Shrug It Off** | passive | no | martial | halve all damage that is not an attack on your mind | While raging, halve all damage that isn't an attack on your mind. Pain is information, and you've stopped reading your mail. |
| 15 | **The Beast Beneath** | passive | no | martial | unarmed strikes 1d10 | Your body answers the wild directly: your unarmed strikes and grapples land like a great beast's (a foe you grapple cannot break free without magic), and on all fours you outrun horses. |
| 17 | **More Than Mortal** | passive | no | martial | STR +4, CON +4 (caps raised) | Strength and Constitution push past the mortal ceiling. Doors, chains and 'impossible' are all suggestions now. |

## Primal/Totemborn

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Totem Spirit** | passive (chosen once; renegotiated only at a sacred site) | yes | primal | Wolf: allies +1d4 damage | A spirit walks in your skin — choose it: Bear (halve all damage while raging), Eagle (no one you charge escapes, no one you flee catches), or Wolf (every ally fighting beside you strikes harder). The totem can be renegotiated only at a sacred site. |
| 6 | **Totem Aspect** | passive | yes | primal | N/A | The spirit stays after the rage: Bear hauls like an ox team, Eagle reads a hillside a mile off, Wolf tracks by scent alone at a dead run. |
| 10 | **Spirit Walk** | per-day (while you sleep) | yes | primal | N/A | Sleep, and send your spirit out in the totem's shape for an hour — scout the pass, circle the camp, whisper to your kin in their dreams. Your body lies defenseless meanwhile. |
| 14 | **Two Totems** | passive | yes | primal | N/A | A second spirit accepts you: carry both totems' gifts at once. Shamans argue about whether that's allowed. The spirits don't. |
| 18 | **The Great Spirit's Voice** | at-will | yes | primal | N/A | Every beast of your totems' kind within the valley answers your call, and the spirits of the wild deal with you as an equal, not a guest. |
| 20 | **Avatar of the Totem** | per-day | yes | primal | N/A | The totem wears YOU: become the spirit made flesh for a scene — a bear the size of a wagon, an eagle that blots the torchlight, a wolf out of the first winter. Your legend and the spirit's are the same story now. |

## Primal/Berserker

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Blood Price** | passive | no | martial | +10% damage after taking damage (stacks with Gathering Rage) | Taking damage adds another 10% to the damage you cause, on top of Gathering Rage. The count resets when the fight does. |
| 6 | **Terrifying Frenzy** | passive | no | martial | N/A | Your frenzy is a weapon everyone else feels: foes who watch you drop one of their own must check their nerve (WIS) or give ground. |
| 10 | **Furious Leap** | at-will | no | martial | N/A | The gap between you and your prey is never safe: leap your full movement onto any foe, arriving as an attack that puts them on the ground (STR resists the knockdown). |
| 14 | **Rage Undying** | passive (the 1 HP stand: per-day) | no | martial | 100% damage bonus after the stand | Frenzy no longer ends while enemies stand and costs no exhaustion after — and the first time each day you'd drop mid-frenzy, you stand back up at 1 HP with a 100% damage bonus until the fight ends. |
| 18 | **Avalanche of One** | passive | no | martial | N/A | Your charge breaks formations: shield walls scatter, gates crack, cavalry balks. Enemy commanders write their orders around where you might be. |
| 20 | **The Last Red Day** | per-campaign | no | martial | N/A | CAPSTONE. Declare the Last Red Day: until the battle ends you cannot die, cannot tire, and cannot be stopped by anything smaller than the battle itself. When it ends you sleep for a week — win or lose. |

## Primal/Stormcaller

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Storm Shroud** | passive while raging (weather chosen once) | yes | primal | lightning: 1d8 to attackers | Your rage wears weather — choose it: lightning (attackers take 1d8 back), thunder (your blows throw foes off their feet), or frost (everything near you slows). The sky above you agrees with your mood. |
| 6 | **Ride the Wind** | passive | yes | primal | N/A | The storm carries its own: leap gaps no mortal could, and fall from any height into a thunderclap landing that costs you nothing. |
| 10 | **Call the Bolt** | once per round | yes | primal | 3d10 lightning | Point at what the sky should hate: once per round a bolt falls on a foe within 60ft. |
| 14 | **Eye of the Storm** | passive | yes | primal | N/A | Allies inside your aura stand in the eye: your weather never touches them, and arrows shot into it are slapped aside by the wind. |
| 18 | **Season of Wrath** | per-day | yes | primal | N/A | Your rage bends the weather for miles — fog to hide a retreat, a squall to ground the enemy's archers, a killing frost at midsummer. The land keeps your grudges. |
| 20 | **The Walking Tempest** | per-day | yes | primal | Chain Lightning + Thunder Wave each round; blows carry Booming Blade at triple strength | Stop pretending to be a person: become the storm outright for a scene — a moving column of wind, frost and lightning that armies cannot hold and arrows cannot find. Chain Lightning and Thunder Wave cast themselves each round, and every blow carries Booming Blade at triple strength. |

## Paladin

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 2 | **Fighting Style** | passive | no | martial | by style | Choose one, permanently, when you gain this: Archery (+2 to ranged attacks), Defense (+1 AC in armor), Dueling (+2 damage with a lone one-handed weapon), Two-Weapon (add your modifier to the off-hand hit), Great Weapon (reroll 1s and 2s on two-handed damage), or Protection (once per round, impose disadvantage on an attack against an adjacent ally). |
| 5 | **Extra Attack** | passive | no | martial | N/A | Attack twice whenever you take the attack action. |
| 7 | **Aura of Protection** | passive | yes | divine | +CHA modifier to saving throws | You and every ally within 10ft add your CHA modifier to all saving throws while you stand. |
| 9 | **Aura of Courage** | passive | yes | divine | N/A | Allies within 10ft cannot be frightened while you stand. |
| 11 | **Oathlight** | passive | yes | divine | +1d8 radiant per hit | Your weapon carries your oath without being asked: every hit deals +1d8 radiant, and creatures of darkness find the light sticky — it clings, and marks them for everyone to see. |
| 13 | **The Unbroken Line** | passive | yes | divine | N/A | While you stand, allies within your aura cannot be moved, felled or made to flee against their will. Lines break where you aren't. |
| 15 | **Judgment's Eye** | passive (the compulsion: per-scene) | yes | divine | N/A | Lies rot in your gaze: you always know when you're told a falsehood, and once per scene you may compel one creature to answer a single question truly. |
| 17 | **Saint's Vessel** | passive | yes | divine | N/A | Your body is consecrated ground: hostile magic must overcome your conviction (CHA) to touch you at all, and wherever you sleep counts as hallowed. |

## Paladin/Oath of Vengeance

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **The Named Enemy** | one name at a time, spoken before witnesses | yes | divine | advantage on everything against them | Speak a wrongdoer's name before witnesses: against them you have advantage on everything — striking, tracking, resisting their arts — until justice is done. Choose carefully; the oath remembers. |
| 6 | **No Rest for the Wicked** | passive | yes | divine | N/A | Your named enemy cannot lose you: you sense their direction within a day's ride, and while the hunt is on you need half the sleep and none of the comfort. |
| 10 | **Drag Them Back** | per-scene | yes | divine | N/A | The guilty do not get to leave: once per scene, halt a fleeing foe where it stands — teleport, wings or terror avail it nothing for one full round. |
| 14 | **Sentence Passed** | passive | yes | divine | N/A | Your smites against the named enemy cannot be resisted, reduced or forgiven — and each one breaks a hold their power has over someone else. |
| 18 | **Wrath That Walks** | passive | yes | divine | N/A | Your reputation does half the work now: the corrupt across a region know you are coming, and their servants must check their nerve or abandon them first. |
| 20 | **The Final Accounting** | per-campaign | yes | divine | N/A | CAPSTONE. Declare the Accounting against your named enemy: neither of you can die, flee or be aided until one yields or falls. Every debt settles inside that circle. |

## Paladin/Oath of Devotion

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Beacon of Honesty** | passive | yes | divine | N/A | Your presence is an oath others lean on: allies who can see you cannot be charmed or made afraid — and your word, once given, is impossible for you to break, and everyone can feel that it is. |
| 6 | **Shield the Weak** | once per round | yes | divine | half damage to you | Once per round, take a blow meant for anyone within reach — and take it better than they would have: half damage to you. |
| 10 | **Consecrated Ground** | a rite (in a fight: where you plant your feet; a night's rite: one standing place at a time) | yes | divine | N/A | Ground you hallow is yours: nothing unholy crosses it uninvited — undead and fiends must fight their own nature to come within 10ft — and the dying inside it do not slip away. A night's rite makes the consecration hold, and anyone who sleeps within wakes as though rested a week. Raising a new place lets the old go quiet. |
| 14 | **The Gentle Hand** | passive | yes | divine | healing pool doubled | Your healing pool doubles, and Lay on Hands now mends minds as well as bodies — madness, despair and magical corruption end at your touch. |
| 18 | **Light Undimmed** | passive | yes | divine | all healing doubled | Your radiance becomes a fact of the region: within your aura all healing is doubled, all darkness is merely shade, and lies stumble on their way out of the mouth. |
| 20 | **Call the Dawn** | per-campaign | yes | divine | healed whole; cannot fall below 1 HP | CAPSTONE. When all is lost, call the dawn early: every ally standing with you is healed whole, freed of fear and curse, and cannot fall below 1 HP until the fight ends. The bards will get it wrong. It was better than they say. |

## Paladin/Oath of Ancients

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **The Green Vow** | passive (the vines: per-scene) | yes | divine, primal | N/A | You swore to the life older than the gods: wild places accept you as kin, your smites bloom with thorned light, and once per scene the vines answer you — grasping, tripping, holding fast. |
| 6 | **Sap and Stone** | passive | yes | divine, primal | N/A | Poison, rot and wither slide off you and those at your side, and your body keeps the forest's calendar — you age a year for its ten. |
| 10 | **Roots of the World** | at-will (the path: per-day) | yes | divine, primal | N/A | Tree, stone and stream confide in you — what passed, when, and bleeding or not. Once per day the land opens a path: brush parts, fords surface, cliffs offer stairs. |
| 14 | **Undying Green** | per-day (triggers on your fall) | yes | divine, primal | return at half your HP | The first time each day you would fall, you don't: life floods back at half strength, and green shoots rise in your footprints. The old life does not let go of its sworn. |
| 18 | **Season's Champion** | per-day | yes | divine, primal | N/A | The wild rises where you fight: for a scene the terrain takes your side — thorn hedges, sudden bogs, groves that hide your friends and swallow your enemies. |
| 20 | **The Old Light** | per-campaign | yes | divine, primal | N/A | CAPSTONE. Kindle the Old Light — the sun the first forests grew under: within a mile, corruption burns out of land and folk alike, the wild's dead rise as allies for one battle, and what you plant that day cannot be killed by anything younger than the world. |

## Cleric

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 2 | **Minor Miracle** | per-rest | yes | divine | N/A | Spend your god's authority out loud and it answers in its own idiom — light in a dark place, a binding broken, a frightened crowd's courage handed back. The god answers the priest, not the request: what arrives is what your deity would give, not what you asked for. |
| 5 | **Destroy Undead** | passive (rides your Turn Undead) | yes | divine, necromantic | N/A | Undead of lesser standing than you no longer flee when you turn them — they come apart where they stand. Anything older or greater than you still runs, and remembers who made it run. |
| 7 | **Divine Strike** | passive (once per turn) | yes | divine | +1d8 of your deity's kind | Your god blesses your weapon: once per turn a hit carries an extra d8 of your deity's own kind — light, flame, frost, rot — and the wound is unmistakably divine to anyone who looks at the body. |
| 9 | **Divine Intervention** | once per seven days (answered or not) | yes | divine | d100 under your level | Pray aloud for your god to act directly. Roll d100; under your level it does — plainly, publicly, and in its own way. Answered or not, it will not be asked again for seven days. |
| 11 | **Consecrated Ground** | a rite (in a fight: where you plant your feet; a night's rite: one standing place at a time) | yes | divine | N/A | Ground you hallow is yours: nothing unholy crosses it uninvited — undead and fiends must fight their own nature to come within 10ft — and the dying inside it do not slip away. A night's rite makes the consecration hold, and anyone who sleeps within wakes as though rested a week. Raising a new place lets the old go quiet. |
| 13 | **The Blessing Holds** | passive | yes | divine | N/A | Your boons outlast the danger that prompted them. Any blessing you lay on a companion runs until your next rest instead of fading with the fight — a party that travels with you travels blessed. |
| 15 | **Death Waits** | per-rest | yes | divine | stand at 1 HP | When you or anyone you can see drops, death is told to wait: they stand at 1 hit point instead of falling. The same creature cannot be spared twice in one day — the second time, the god is not listening. |
| 17 | **Smite** | per-day | yes | divine | 95% of the target's remaining HP | Name a creature you can see and your god strikes it directly: a single blow equal to 95% of the hit points it has left, delivered in your deity's own idiom — a thunderclap, ghostly tentacles from the deep; the GM chooses the manifestation. It is never a killing blow: whatever it hits is left at death's door, and what happens next is up to you. |

## Cleric/Life Domain

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Disciple of Life** | passive | yes | divine | +1d4 on every heal | Every healing you work gives back more than it should, and your hands read a body at a touch: what broke it, how long it has, and whether the trouble is wound, poison, sickness or grief. |
| 6 | **Cleanse** | a night's vigil | yes | divine | N/A | Disease, poison, rot and afflictions of the body lift where you keep vigil: one night's work cures any single creature, and a plague ends in whatever village you stay in. It mends the body — what corrupts a soul is not your department. |
| 10 | **Preserve Life** | per-rest | yes | divine | stand at 1 HP | Catch someone in the first moments after death — a creature dead less than a minute stands again at 1 hit point, whole enough to walk. What they saw while they were gone is between them and your god. |
| 14 | **Restore Limb** | a night of prayer | yes | divine | N/A | A night of prayer over the wounded regrows what was lost: an arm, a leg, an eye, a hand — anything short of a head. The new flesh is whole, strong and unmistakably a gift; it carries no scar, and everyone who knew the old wound knows exactly who to thank. |
| 18 | **Battlefield Miracle** | per-day | yes | divine | N/A | Declare it, and for one scene no ally within your sight dies. They fall, they bleed, they are dragged from the field — and every one of them wakes up. Your enemies enjoy no such protection. |
| 20 | **The Return** | per-campaign | yes | divine | N/A | CAPSTONE. Ask for one person back and be answered. Whatever remains of them — a body, a scrap, a name — they return whole and themselves, however they died and however long ago. |

## Cleric/War Domain

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **War Priest** | passive | yes | divine | N/A | Prayer and blow are one motion. You never have to choose between casting and fighting on a turn, and armor, shield and weapon never hinder your magic — a spell of yours has been swung as often as spoken. |
| 6 | **Guided Strike** | once per fight | yes | divine | a miss becomes a hit | Once per fight a miss becomes a hit — yours, or any companion's you can see. Your god corrects the swing visibly, and everyone on the field knows whose hand did it. |
| 10 | **The Line Holds** | passive | yes | divine | N/A | Nobody breaks where you stand. Allies who can see or hear you cannot be routed, frightened or panicked, and the wounded among them keep their feet as long as you keep yours. |
| 14 | **Consecrated Arms** | passive | yes | divine | N/A | Every weapon your party carries counts as blessed while you are in the fight — the ghost, the fiend, the thing ordinary steel passes straight through takes the blow like anything else. Yours in particular has no bad angles. |
| 18 | **The God of Battle Attends** | per-day | yes | divine | N/A | Call your deity onto the field, and it comes visibly — a wave of standing light, a shadow in armor twelve feet tall — and fights beside you for that encounter, as capable as you are. Everyone present sees it. Word of it travels ahead of you. |
| 20 | **Decide the Battle** | per-campaign | yes | divine | N/A | CAPSTONE. In a battle you are fighting in, name the victor and the field goes that way: reinforcements arrive, the flank folds, the champion's horse throws them. The outcome is yours. The cost in the dead is not, and you will be counting it afterwards. |

## Cleric/Subjugation Domain

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **The Oath** | passive | yes | divine | N/A | A promise spoken to you binds. The oath-breaker knows the instant they break it, and so do you, wherever you are — and misfortune of your god's choosing dogs them until amends are made. Only words offered willingly can bind; a forced vow is just noise. |
| 6 | **The Yoke** | one yoked servant at a time | yes | divine | N/A | Bind a defeated or helpless creature into your service: awake, aware, resentful and obedient. You give orders and it carries them out hating every step — you see nothing through its eyes and speak nothing through its mouth; it serves, it is not worn. Release it, or die, and it is free. |
| 10 | **The Knee** | at-will | yes | divine | N/A | The weight of your god hangs on your voice. Small commands spoken directly — kneel, drop it, wait, speak — land unless the target has real cause to resist, and even then defiance is visible effort. You never puppet a body; you press a will, and its owner is awake for every moment of it. |
| 14 | **The Missive** | one standing command abroad at a time | yes | divine | N/A | Your compulsion no longer needs your presence. A command under your seal, or carried by a messenger in your name, binds as though you spoke it eye to eye — distance was the defense, and there is no defense. |
| 18 | **The Word** | per-day | yes | divine | N/A | Speak one short command in your god's own voice, and every creature that hears it obeys for one action. Nothing immediately self-destructive can be commanded, and named foes get a WIS save; the rest simply do it, and remember afterwards that they did. |
| 20 | **The Law** | per-campaign | yes | divine | N/A | CAPSTONE. Speak one decree over a place and it becomes law in the oldest sense: the land itself enforces it. No blood spilled in this valley. No lie spoken in this city. It holds until a god's own authority overturns it, and your name is on it forever. |

## Druid

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 7 | **Poison Immunity** | passive | yes | primal | N/A | Natural poisons and venoms have no effect on you. |
| 9 | **Beast Spells** | passive | yes | primal | N/A | Cast druid spells while in Wild Shape — the beast's throat carries the words. |
| 11 | **Second Skin** | passive | yes | primal | N/A | Wild Shape is a breath, not a ritual: shift as part of any action, gear melding or staying as you choose, and your beast ceiling keeps climbing with your level. |
| 13 | **Voice of the Land** | at-will | yes | primal | N/A | The land within a mile confides in you: ask it what walks, what sickens, what hides. Its answer is always true and always partial — the land has its own sense of humor. |
| 15 | **Root and Branch** | passive (the restraint: per-scene) | yes | primal | N/A | The green fights for you unasked: difficult terrain never slows you, and once per scene the undergrowth itself restrains everything you name within 30ft. |
| 17 | **Shape of the World** | per-day, once per element | yes | primal | N/A | Your Wild Shape reaches past flesh: elemental bodies — living flame, stone, water, wind — once per day each. The beasts were practice. |

## Druid/Circle of Stars

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Wear the Sky** | chosen each night | yes | primal | Archer 1d8 radiant; Chalice +1d6 splash heal; Serpent 1d6 radiant back | Star-charts live under your skin: each night choose a constellation to wear — the Archer (bolts of starlight, 1d8 radiant, 60ft, no mana), the Chalice (your healing spells splash 1d6 to a second ally within reach), or the Serpent (you shed dim starlight, and foes who strike you from beside it take 1d6 radiant back). The chosen stars glimmer through your skin while you work. |
| 6 | **Read the Night** | per-scene | yes | primal | +2 on the one roll the sign warned of | The sky briefs you: once per scene, ask the stars one question about what is coming and receive a true sign. Any ally you share the sign with carries its light on the one roll it warned them about. |
| 10 | **The Falling Star** | per-day | yes | primal | 4d10 radiant | Call a piece of the sky down: 4d10 radiant in a 10ft ring and every foe inside knocked from their feet. The crater glows until dawn, and nothing inside its light can hide from you — not behind stone, spell or skin. |
| 14 | **Half Made of Night** | passive | yes | primal | resistance to nonmagical weapons | Starlight thins you: blades and arrows dim as they land, you no longer need sleep or breath — you keep watch the way the stars do — and moonlight and starlight bear your weight as solid ground. |
| 18 | **The Moving Heavens** | passive | yes | primal | N/A | The constellations answer mid-fight: wear two at once and swap either each round. The sky over your battles is always the sky YOU need — dark for your rogues, bright for your archers, starless and silent for your escape. |
| 20 | **The Sky Entire** | per-day | yes | primal | N/A | Bring the sky down to arm's reach for a scene: your party walks on air that holds, falls simply refuse to happen, every foe stands lit by prosecutor starlight (no hiding, no feints, no borrowed faces), and one star keeps an old promise — the first ally who would die that scene, instead, does not. |

## Druid/Circle of the Moon

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **War Shape** | passive | yes | primal | temporary HP equal to your level on every shift | Your Wild Shape is built for the front line: combat forms beyond your years, shifting instant, and the beast's hide takes the first wounds meant for you. |
| 6 | **Fang and Focus** | passive | yes | primal | N/A | Your claws and fangs bite through wards meant for steel (they count as magical), and the beast's throat can still carry your casting — roar the spell. |
| 10 | **Shapes of the Ice Years** | passive | yes | primal | N/A | The moon shows you older beasts: forms long extinct — cave bears the size of carts, wolves from the first winters. Your shapes now frighten as they fight. |
| 14 | **The Half-Form** | at-will | yes | primal | N/A | Take the middle shape: your hands and voice with the beast's strength and senses — cast, speak, climb and rend in the same body. |
| 18 | **Tide of Shapes** | at-will | yes | primal | N/A | Shift without count or cost, flowing form to form mid-motion — bird to bear mid-pounce. Your enemies fight a different animal every round and never the one they planned for. |
| 20 | **The First Beast** | per-day | yes | primal | N/A | Wear the First Beast — the shape all animals remember in their bones. For a scene, everything wild within a mile answers its cry as kin, and nothing mortal that sees it ever quite settles on what it was. |

## Druid/Circle of Flame

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Kindled Heart** | at-will | yes | primal | 1d8 fire | A mote of living wildfire rides with you: hurl it each round (1d8 fire, 30ft, no mana), and it never touches what you love — your fire cannot harm an ally unless you will it. |
| 6 | **Cleansing Burn** | passive | yes | primal | allies heal 1d6 each round in your fire | Your flames read intent: allies standing in fire you made take no harm and knit closed instead, and your fire ignores resistance — the wild flame is older than any ward built against it. |
| 10 | **Flamestep** | at-will (the burst: per-scene) | yes | primal | 2d8 fire around your exit | Step into any fire you can see and out of any other: a candle is a door, a burning village is a hall of doors. Once per scene, arrive as a burst — 2d8 fire around your exit, allies excepted, as always. |
| 14 | **The Green Ash** | passive | yes | primal | casts cost 1 less mana (minimum 1) on reborn ground | Ground your fire has touched is yours for a season: it regrows overnight — greener, taller, wilder — and while you stand on land you have burned and reborn, your casts cost one less mana and fire cannot harm you at all. |
| 18 | **Firestorm Shepherd** | per-day | yes | primal | N/A | Whistle up a wildfire the size of a hill and walk it like a hound: it moves where you point, spares every living thing you name, and where it has passed, flowers open by morning. Armies break before it; forests thank you after. |
| 20 | **The First Fire** | per-campaign (the tithe is forever) | yes | primal | N/A | CAPSTONE. Set the First Fire in the wound: the dead thing burns for a single heartbeat and stands back up new-grown and whole. The fire keeps your warmth as its tithe — ever after, flames bow away from you, and you will never be warm again. |

## Necromancer

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 2 | **Undead Thrall** | passive (rides your Raise Thrall) | yes | necromantic | +INT modifier HP | Your Raise Thrall servant persists permanently until destroyed, gains bonus HP equal to your INT modifier, and can follow simple multi-step orders — go to X and perform task Y. |
| 5 | **Grim Harvest** | passive (once per turn) | yes | necromantic | regain HP equal to twice the spell's tier (minimum 2) | When you kill a creature with a spell, regain HP equal to twice the spell's tier. Once per turn. |
| 9 | **Necrotic Resilience** | passive | yes | necromantic | resistance to necrotic; advantage on death saves | Resistance to necrotic damage and advantage on death saving throws. Undead you control cannot be turned by clerics or paladins. |
| 11 | **Dark Immunity** | passive | yes | necromantic | N/A | Immune to all forms of decay, disease, and death or blood magic. |
| 13 | **Dire Phylactery** | a focus object; concentration on a target | yes | necromantic | every 5 HP the target loses stores 1 mana | Requires a focus object. While you focus on a target, every 5 hit points it loses are stored as 1 mana in the focus. The stored mana can later be drawn into you as a supply. |
| 15 | **Vampiric Charm** | at-will | yes | necromantic | N/A | The promise of death's defeat is intoxicating: the target saves or becomes your thrall — willing, adoring, obedient. A new saving throw may be rolled every dawn. |
| 17 | **Path of the Lich** | once, irreversible | yes | necromantic | N/A | The path to becoming a lich is open to you. It is taken once and cannot be untaken. |

## Necromancer/Bone Sculptor

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Bone Shards** | 1 mana | yes | necromantic | 1d4 per caster level | Cast shards of bone at the target: 1d4 per caster level, out to 80 feet. |
| 6 | **Bone Armor** | 1 mana | yes | necromantic | AC as plate | Clad yourself in hardened, articulated bone platemail — the protection of plate with none of its weight or noise — for a scene. |
| 10 | **Bone Structure** | 1 mana per structure | yes | necromantic | N/A | Raise structures of bone from the ground — a wall, a bridge, a cage, a stair — shaped as you will. Fails on consecrated earth. |
| 14 | **Bone Golem** | an hour and a heap of bone (one golem at a time) | yes | necromantic | N/A | Build a golem of bone: strong as an ogre, tireless, obedient. It lasts until destroyed; you keep one at a time. |
| 18 | **Army of Bone** | concentration | yes | necromantic | 25 skeletons at a time | Waves of skeletons crash against the enemy, 25 at a time. As skeletons fall, new ones rise and join the fight. It continues until your concentration breaks. |
| 20 | **Bone Dragon** | per-day | yes | necromantic | N/A | Summon a bone dragon — wings, jaws and a breath of grave-dust — for a scene. It obeys you and nothing else. |

## Necromancer/Entropist

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Accelerated Decay** | 1 mana | yes | necromantic | 2d8 necrotic + 1d10 years of age | Your touch rots living flesh: 2d8 necrotic and the target ages 1d10 years. What you rot stays rotted — wounds you deal cannot be magically healed until the next dawn. |
| 6 | **Rust in the Air** | at-will (the parry: once per round) | yes | necromantic | incoming damage halved, the weapon ruined | Your decay no longer needs touch — corrode objects at 30ft. Once per round, when a nonmagical weapon or projectile strikes you, it decays mid-blow: damage halved, the weapon ruined. |
| 10 | **Field of Entropy** | concentration (2 mana) | yes | necromantic | healing halved; objects age a year per round | A 30ft radius where everything ends faster: structures sag and crack, potions spoil, food blackens, healing is halved, and objects age a year every round. |
| 14 | **Unraveling** | 1 mana | yes | necromantic | N/A | Decay reaches the immaterial: end one active spell or enchantment you can see, or silence a magic item until dawn — its virtue rusts like everything else. |
| 18 | **Ruin** | a minute of ritual | yes | necromantic | N/A | A minute of ritual collapses years into moments on one structure: a fortress gate becomes a breach, a bridge becomes a memory, a siege engine becomes mulch. Consecrated ground resists. |
| 20 | **Entropy Incarnate** | per-day | yes | necromantic | 4d10 necrotic per round + a year of age | For one scene you are the ending of things: nonliving matter you touch turns to dust outright, hostile magic gutters out within 30ft of you, and living creatures who stand against you age a year and take 4d10 necrotic each round. |

## Necromancer/Soul Binder

| Lv | Feature | Cost | Magical | Tradition | Dice | Effect |
|---|---|---|---|---|---|---|
| 3 | **Soulfire** | one bound soul | yes | necromantic | regain mana equal to the soul's level, or +1 tier on your next spell | A bound soul is fuel: consume one to regain mana equal to the soul's level, or to cast your next spell as if one tier higher. The soul is spent forever — it does not pass on, it burns. |
| 6 | **Greater Vessels** | per-day | yes | necromantic | N/A | Once per day you bind at 30ft the instant death occurs, and your vessels hold souls indefinitely. |
| 10 | **Soul Puppet** | one bound soul and a fresh corpse | yes | necromantic | N/A | Pour a bound soul into a fresh corpse: the dead walks again with its own memories and skills intact — a thinking servant, not a shambler. It knows exactly what it owes you. |
| 14 | **Anchored Soul** | a prepared vessel (a month to craft) | yes | necromantic | N/A | Your own soul rides in a prepared vessel: the first time you die, you wake beside it a day later and the vessel shatters. Crafting a new anchor takes a month. This is the apprenticeship for what waits at level 17. |
| 18 | **Reap the Field** | passive | yes | necromantic | N/A | Any creature that dies within 60ft offers you its soul — no action, no vessel prepared, you ARE the vessel. Battles fill your satchel; armies feed you. |
| 20 | **Judge of the Dead** | passive (the calling-back: per-campaign, every soul you hold) | yes | necromantic | N/A | No soul passes within a mile without your leave: the dying linger until you rule, and the dead cannot be raised against you. Once — only once — you may spend every soul you hold to call one person truly back to life. |
