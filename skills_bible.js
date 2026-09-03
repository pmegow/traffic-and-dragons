// skills_bible.js — the canonical skills reference (TODO #52). Own file per the *_bible
// convention (capability = spells+abilities; skills are a genuinely different domain).
// Skill LEVELS are earned in play ([SKILL_SUCCESS:] successes → SKILL_THRESHOLDS, data.js);
// before this file a level had NO defined mechanics — "Trained" biased the GM narratively
// and did nothing specified. This file answers "how are skills used in play" with DATA:
//
//   • SKILL_LEVEL_MECHANICS — ONE global ladder (index = level, aligned with SKILL_LEVELS):
//     a flat check bonus per level (stacks with the stat modifier) plus auto-success bands
//     (a Trained cook stops rolling for breakfast; a Master rolls only when it matters).
//     Design call 2026-08-06 (Fable, user unavailable — deliberately data-only so a rebalance
//     is a 6-line edit): bonus + auto-success over advantage tiers (fuzzier, unenforceable)
//     and DC shifts (invisible in the shown roll — the player can't see their skill working).
//   • SKILLS_BIBLE — per-skill canonical definition: what the skill covers, its boundary
//     against confusable neighbors (Perception notices / Investigation deduces / Insight
//     reads people), and whether it can be attempted untrained.
//
// Two consumers, one source (the capability_bible pattern):
//   GM injection — buildSkillMechanicsDoc() (api.js, STABLE half: the constant ladder +
//     untrained rules) and buildSkillCanonBlock() (api.js, VOLATILE half: level, bonus, and
//     definition for the player's EARNED skills only — same anti-drift re-inject-from-data
//     discipline as the spell bible).
//   Viewer — skillCardHTML (helpers.js) rendering these entries in bible_study.html.
//
// ENTRY SCHEMA: keyed by EXACT skill id (data.js SKILLS — also the character.skills key, so
// no case-folding layer is needed). untrained: "yes" (anyone may attempt on the raw stat
// mod) | "hard" (+5 DC or disadvantage untrained) | "no" (cannot be meaningfully attempted
// without at least Familiar). def: one-line canon, boundary notes where skills abut.
// Stats/categories stay in data.js SKILLS — single source; this file never duplicates them.
//
// COVERAGE GUARD (engine-tested): every SKILLS id has an entry here and every key here is a
// real SKILLS id — a new skill and its bible entry land in the SAME commit.

// The global level ladder. Index = skill level (0–6, matching SKILL_LEVELS; #302 added Legendary). bonus stacks
// with the stat modifier on d20 checks; rule is the injected per-level text (the doc builder
// renders "LevelName: rule" from these, so a rebalance here propagates everywhere).
var SKILL_LEVEL_MECHANICS=[
  {bonus:0,rule:"no bonus — raw stat modifier only (see untrained rules)"},
  {bonus:1,rule:"+1 to checks where the skill applies"},
  {bonus:2,rule:"+2; easy (DC 10) routine uses succeed WITHOUT a roll when unhurried"},
  {bonus:3,rule:"+3; easy (DC 10) uses succeed without a roll even under pressure"},
  {bonus:4,rule:"+4; moderate (DC 15) uses also succeed without a roll when unhurried"},
  {bonus:5,rule:"+5; roll only for hard (DC 20+), contested, or high-stakes attempts"},
  {bonus:6,rule:"+6; hard (DC 20) uses also succeed without a roll when unhurried — roll only for contested, legendary (DC 25+), or high-stakes attempts"}/* #302: Legendary, 100 successes */
];

var SKILLS_BIBLE={
  // ── Physical ──
  "Jumping":{untrained:"yes",def:"Explosive leaps — clearing gaps, vaulting obstacles, reaching ledges. Distance and a safe landing both ride on it."},
  "Sprinting":{untrained:"yes",def:"Short bursts of flat-out speed — chases, closing distance, escaping before the gate drops. Sustained pace is Distance Running."},
  "Lifting":{untrained:"yes",def:"Raw load-bearing strength — hoisting beams, shifting boulders, forcing a stuck door by main strength."},
  "Grappling":{untrained:"yes",def:"Seizing and holding a resisting creature — pins, locks, throws, and breaking free of holds."},
  "Climbing":{untrained:"yes",def:"Ascending walls, cliffs, rigging, and trees — finding holds, managing ropework, not falling."},
  "Swimming":{untrained:"yes",def:"Moving and surviving in water — fighting currents, diving, staying afloat in armor or storm surf."},
  "Distance Running":{untrained:"yes",def:"Sustained pace over hours — forced marches, courier runs, outlasting pursuit. Short bursts are Sprinting."},
  "Riding":{untrained:"yes",def:"Controlling a mount — riding hard, jumps, combat from the saddle, calming a spooked animal under you. Unmounted beasts are Animal Handling."},
  // ── Endurance ──
  "Hold Breath":{untrained:"yes",def:"Going without air — long dives, thick smoke, a strangler's grip. How long you stay conscious and functional."},
  "Endure Pain":{untrained:"yes",def:"Functioning through agony — torture, a cauterized wound, marching on a broken bone without folding."},
  "Tolerate Alcohol/Drugs":{untrained:"yes",def:"Keeping your head under intoxicants taken willingly — drinking contests, ritual substances, blunting a spiked cup's worst."},
  // ── Wilderness ──
  "Foraging":{untrained:"yes",def:"Finding food and water in the wild — edible plants, safe fungi, small-game snares. Shelter and hazards are Survival."},
  "Cooking":{untrained:"yes",def:"Turning provisions into meals — camp cookery, preserving rations, spotting spoiled or adulterated food."},
  "Survival":{untrained:"yes",def:"Staying alive in hostile country — shelter, fire in the rain, reading weather and terrain hazards. Foraging feeds you; Navigation points you."},
  "Animal Handling":{untrained:"yes",def:"Calming, controlling, and reading beasts — soothing, driving a team, training. Mounted control is Riding."},
  "Navigation":{untrained:"yes",def:"Knowing where you are and how to get there — stars, maps, dead reckoning, not walking in circles."},
  "Tracking":{untrained:"hard",def:"Following creatures by sign — prints, broken twigs, blood trails; also urban tailing through crowds and alleys (WIS reads the environment, INT anticipates movement)."},
  // ── Knowledge ──
  "Arcana":{untrained:"no",def:"Book-knowledge of magic — identifying spells and effects, magical theory, wards, planar lore. Without study you simply do not know."},
  "Lore":{untrained:"yes",def:"History, legends, heraldry, and the tales folk tell — who ruled, what fell, and why. Untrained reaches only common knowledge."},
  "Investigation":{untrained:"yes",def:"Active deduction — searching a room, connecting clues, spotting the inconsistency in a story or scene. Perception notices; Investigation interprets."},
  "Nature":{untrained:"yes",def:"Practical knowledge of the living world — beasts, plants, seasons, and the signs of natural hazards."},
  "First Aid":{untrained:"hard",def:"Battlefield medicine — stanching wounds, splinting, treating the symptoms of poison and disease. Not magical healing; wrong treatment can harm."},
  "Alchemy":{untrained:"no",def:"Preparing and identifying potions, poisons, oils, and reagents — and handling them without harming yourself."},
  // ── Craft ──
  "Smithing":{untrained:"no",def:"Working metal — forging, repairing arms and armor, judging a blade's quality at a glance."},
  "Handcraft":{untrained:"hard",def:"Fine making and mending — leatherwork, fletching, carpentry, tailoring; judging craftsmanship in others' work."},
  "Explosives":{untrained:"no",def:"Black powder and volatile compounds — placing charges, cutting fuses, disarming a device without losing fingers."},
  // ── Social ──
  "Persuasion":{untrained:"yes",def:"Winning people over honestly — negotiation, appeals, rallying a room. Deception lies; Intimidation threatens."},
  "Deception":{untrained:"yes",def:"Convincing lies — bluffs, cons, masked intent, forged sincerity. Contested by Insight."},
  "Intimidation":{untrained:"yes",def:"Compliance through fear — threats, menace, interrogation pressure. Buys obedience at the cost of goodwill Persuasion would keep."},
  "Performance":{untrained:"yes",def:"Holding an audience — music, oratory, acting; also carrying off a role convincingly before a crowd."},
  "Trading":{untrained:"yes",def:"Commerce — appraisal, haggling, reading a market, smelling a bad deal before the coin leaves your hand."},
  // ── Roguish ──
  "Stealth":{untrained:"yes",def:"Moving unseen and unheard — hiding, sneaking, shadowing in shadow. Manual tricks in plain view are Sleight of Hand."},
  "Sleight of Hand":{untrained:"hard",def:"Nimble fingers under watching eyes — palming, picking pockets, planting items, cheating a visibly fair game."},
  "Lockpicking":{untrained:"no",def:"Defeating locks and mechanical traps with picks and tension — and knowing when one is beyond you."},
  "Gambling":{untrained:"yes",def:"Games of chance and the people who play them — odds, tells, spotting a cheat (cheating yourself is Sleight of Hand)."},
  // ── Perception ──
  "Perception":{untrained:"yes",def:"Noticing what is there — spotting, hearing, smelling, passive wariness. Investigation deduces meaning; Insight reads people."},
  "Insight":{untrained:"yes",def:"Reading people — motives, lies, moods, the thing left unsaid. The opposing blade to Deception."}
};

// Accessors (the classDef() pattern — consumers never index the tables directly).
function skillBibleEntry(id){return SKILLS_BIBLE[id]||null;}
function skillLevelBonus(lvl){return (SKILL_LEVEL_MECHANICS[lvl]&&SKILL_LEVEL_MECHANICS[lvl].bonus)||0;}
// The untrained specialist lists, derived once per call (insertion order = SKILLS order —
// deterministic, so the stable-half doc built from these stays byte-identical).
function skillsUntrained(kind){var out=[],k;for(k in SKILLS_BIBLE){if(SKILLS_BIBLE[k].untrained===kind)out.push(k);}return out;}
