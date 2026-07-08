// ability_bible.js — canonical class-ability reference (`ability_bible`, TODO #10).
//
// Same unified "capability" schema as spell_bible (kind:"ability"), keyed by BASE name. Entries
// here are the ability-ONLY capabilities. Abilities that are ALSO spells (Sacred Flame, Healing
// Word, Divine Smite, Hunter's Mark, ...) live in spell_bible and are NOT duplicated here — one
// canon per base name. `capabilityLookup()` below resolves any capability name across the emergent
// overlay, spell_bible, and ability_bible, so the card and cross-kind injection ask one function.
//
// isMagical AUTHORING RULE (same as spells): true if it would light up under Detect Magic / be
// targetable by Dispel Magic. Martial and skill abilities are false; arcane/divine/druidic/
// necromantic ones are true. `cost` recharge model: at-will | passive | per-rest | per-day.

var ABILITY_BIBLE={
  // ── Warrior (mundane) ──
  "power strike":{kind:"ability",tier:0,cost:"at-will",isMagical:false,targets:"1 attack",duration:"instantaneous",effect:"On a declared attack, add +1d6 damage on a hit. Declared before the roll."},
  "shield wall":{kind:"ability",tier:0,cost:"at-will",isMagical:false,duration:"until your next turn",effect:"Reduce all incoming damage by 3 until the start of your next turn. Requires a shield or braced stance."},
  "weapon mastery":{kind:"ability",tier:0,cost:"passive",isMagical:false,effect:"No penalty for using improvised or unfamiliar weapons — proficient with anything wieldable."},
  // ── Rogue (mundane) ──
  "sneak attack":{kind:"ability",tier:0,cost:"at-will",isMagical:false,targets:"1 attack",duration:"instantaneous",effect:"Double the attack's damage dice when you have advantage, are unseen, or the target is flanked by an ally. Once per turn."},
  "evasion":{kind:"ability",tier:0,cost:"passive",isMagical:false,effect:"On a FAILED DEX save against an area effect, take half damage instead of full. (Class-feature Evasion later upgrades this to zero on a success.)"},
  "lockpick":{kind:"ability",tier:0,cost:"at-will",isMagical:false,effect:"Open locks and disarm mechanical traps with a DEX check against the device's DC. Requires thieves' tools."},
  // ── Sorcerer (magical) ──
  "arcane bolt":{kind:"ability",tier:0,cost:"at-will",isMagical:true,range:"120ft",targets:"1 creature",duration:"instantaneous",dice:"1d8 force",effect:"A ranged spell attack (INT vs AC); 1d8 force on a hit. The sorcerer's reliable at-will strike."},
  "fire lance":{kind:"ability",tier:0,cost:"at-will",isMagical:true,range:"60ft",targets:"1 creature or object",duration:"instantaneous",dice:"1d10 fire",effect:"A lance of flame; 1d10 fire on a hit and ignites unattended flammable targets."},
  "arcane shield":{kind:"ability",tier:0,cost:"at-will",isMagical:true,range:"self",targets:"self",duration:"until hit",effect:"A shimmer of force absorbs the next 5 damage you take, then dissipates. Raised as a reaction."},
  "blink":{kind:"ability",tier:0,cost:"at-will",isMagical:true,range:"30ft",targets:"self",duration:"instantaneous",save:"DC 15 DEX or arrive off-target",effect:"Teleport up to 30ft to a space you can see. On a failed DC 15 DEX check you arrive at a nearby unintended spot."},
  // ── Ranger (Trackless Step / Volley are mundane; Hunter's Mark is a spell — see spell_bible) ──
  "trackless step":{kind:"ability",tier:0,cost:"passive",isMagical:false,effect:"Leave no trail in natural terrain; cannot be tracked by nonmagical means while moving through wilderness at a careful pace."},
  "volley":{kind:"ability",tier:0,cost:"at-will",isMagical:false,targets:"up to 2 creatures in range",duration:"instantaneous",effect:"With one action, make a ranged attack against up to 2 targets within your weapon's range."},
  // ── Berserker (mundane) ──
  "rage":{kind:"ability",tier:0,cost:"per-rest",isMagical:false,duration:"3 rounds",effect:"Enter a battle fury: +2 STR, +2 melee damage, and you push through pain (resist physical damage, ignore first wounds). Lasts 3 rounds. Ends early if you take no hostile action."},
  "reckless attack":{kind:"ability",tier:0,cost:"at-will",isMagical:false,targets:"your attacks this turn",duration:"until your next turn",effect:"Attack with advantage this turn; in exchange, attacks against you have advantage until your next turn."},
  "intimidating presence":{kind:"ability",tier:0,cost:"at-will",isMagical:false,range:"30ft",targets:"1 creature",save:"CHA contest",effect:"A CHA check to terrify one creature. On a success it is shaken (-2 to all rolls) until it can no longer see you or the scene ends."},
  // ── Paladin (Lay on Hands / Divine Sense are magical; Divine Smite is a spell — see spell_bible) ──
  "lay on hands":{kind:"ability",tier:0,cost:"pool, refreshes on a long rest",isMagical:true,range:"touch",targets:"1 creature",effect:"Draw from a healing pool of 5 × your level HP: touch to restore HP, or spend 5 points to cure one disease or neutralize one poison. Cannot harm undead with it here."},
  "divine sense":{kind:"ability",tier:0,cost:"per-rest",isMagical:true,range:"60ft",targets:"area",duration:"until your next turn",effect:"Sense the location of any undead, fiend, or celestial within 60ft, and any consecrated or desecrated place, until the end of your next turn."},
  // ── Cleric (Turn Undead only; Sacred Flame + Healing Word are spells — see spell_bible) ──
  "turn undead":{kind:"ability",tier:0,cost:"per-rest",isMagical:true,range:"30ft",targets:"undead in range",duration:"1 minute",save:"WIS (DC 8 + WIS + proficiency)",effect:"Channel Divinity: each undead within 30ft that fails a WIS save must spend its turns fleeing you and cannot willingly move closer, for 1 minute or until it takes damage."},
  // ── Druid (Wild Shape / Speak with Animals magical; Druidic is a language) ──
  "wild shape":{kind:"ability",tier:0,cost:"per-rest",isMagical:true,range:"self",targets:"self",duration:"hours by level",effect:"Transform into a beast you have seen, up to a CR limit that scales with level. You take on its stats; you revert at 0 HP or when you choose. Gear melds. Cannot cast spells while shaped until high level."},
  "druidic":{kind:"ability",tier:0,cost:"passive",isMagical:false,effect:"You know Druidic, the secret language of druids, and can leave hidden messages (via marks and signs in nature) that only those who know it can read."},
  "speak with animals":{kind:"ability",tier:0,cost:"at-will",isMagical:true,range:"nearby beasts",duration:"conversational",effect:"Comprehend and verbally communicate with beasts. They can share what they have sensed recently, but are limited by animal intelligence and perspective."},
  // ── Necromancer (necromantic, magical) ──
  "raise thrall":{kind:"ability",tier:0,cost:"at-will",isMagical:true,range:"10ft",targets:"1 fresh corpse",effect:"Animate a fresh corpse within 10ft as a zombie thrall that follows basic commands. Requires a body present. ONE thrall at a time (until the archetype expands it); the thrall collapses if you fall unconscious."},
  "drain life":{kind:"ability",tier:0,cost:"at-will",isMagical:true,range:"30ft",targets:"1 creature",duration:"instantaneous",dice:"1d6 necrotic",effect:"A melee or 30ft necrotic touch; deal 1d6 necrotic and regain HP equal to half the damage dealt."},
  "death sight":{kind:"ability",tier:0,cost:"passive",isMagical:true,range:"60ft",targets:"area",effect:"Sense undead, corpses, and death-taint within 60ft without seeing them, and gain advantage on Arcana/Lore checks about undead, curses, or death magic."}
};

// Ability lookup (ability_bible only), base-name keyed.
function abilityBibleLookup(nm){var k=(typeof spellBaseName==="function")?spellBaseName(nm):String(nm||"").toLowerCase().trim();return (typeof ABILITY_BIBLE!=="undefined"&&ABILITY_BIBLE[k])||null;}

// Unified capability lookup — the ONE function the card and cross-kind injection call. Resolution
// order: emergent overlay + spell_bible (spellBibleLookup) first, then ability_bible. So an ability
// that is really a spell (Sacred Flame, Hunter's Mark), or one canonized via [SPELL_DEF:], wins.
function capabilityLookup(nm){
  if(typeof spellBibleLookup==="function"){var s=spellBibleLookup(nm);if(s)return s;}
  return abilityBibleLookup(nm);
}
