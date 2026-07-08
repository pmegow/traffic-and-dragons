// capability_bible.js — the unified capability reference (TODO #10). Spells AND abilities share it:
// they have NO intrinsic difference (kind is a cosmetic display tag; cost + isMagical are the real
// axes), so one registry holds both. Merged from spell_bible.js + ability_bible.js (v1.222). Keyed by
// BASE name (parenthetical stripped, lowercased) so it overlays the SPELLS strings and the
// [SPELL_USED:] matcher with no refactor. Genuinely-different domains (items, creatures, professions)
// get their OWN *_bible files — capability = spells+abilities; entities are separate.
//
// Two consumers, one source: GM-authoritative prompt injection on cast/use (anti-drift) + the player
// card / bible_study viewer (bibleCardHTML). GM-invented capabilities canonize write-once into the
// per-campaign overlay worldState.capabilityBible ([SPELL_DEF:]), which capabilityLookup prefers.
//
// ENTRY SCHEMA: kind ("spell"|"ability") | tier (0=cantrip/at-will, 1..4) | cost (at-will|slot|
// passive|per-rest|per-day|pool...) | isMagical (bool; AUTHORING RULE: true if it lights up under
// Detect Magic / is Dispel-targetable) | range | targets | duration | effect | dice? | save?

var CAPABILITY_BIBLE={
  // ── Cantrips (at-will, never expend) ──
  "fire bolt":{kind:"spell",tier:0,cost:"at-will",isMagical:true,range:"120ft",targets:"1 creature or object",duration:"instantaneous",dice:"1d10 fire",effect:"A ranged spell attack hurling a mote of fire; 1d10 fire on a hit. Ignites unattended flammable objects. Damage scales with caster level, not slots."},
  "message":{kind:"spell",tier:0,cost:"at-will",isMagical:true,range:"120ft",targets:"1 creature",duration:"1 round",effect:"Whisper a short message to one creature within range that only it hears; it may whisper a one-line reply only you hear. Requires a clear path to the target (blocked by total cover). Does NOT reach beyond 120ft — it is not telepathy or long-distance sending."},
  "ray of frost":{kind:"spell",tier:0,cost:"at-will",isMagical:true,range:"60ft",targets:"1 creature",duration:"instantaneous",dice:"1d8 cold",effect:"A ranged spell attack; 1d8 cold on a hit and the target's speed drops by 10ft until the start of your next turn."},
  "sacred flame":{kind:"spell",tier:0,cost:"at-will",isMagical:true,range:"60ft",targets:"1 creature",duration:"instantaneous",dice:"1d8 radiant",save:"DEX for none",effect:"Radiant light falls on a creature you can see; it makes a DEX save or takes 1d8 radiant. The target gains no benefit from cover."},
  "mage hand":{kind:"spell",tier:0,cost:"at-will",isMagical:true,range:"30ft",targets:"a spectral hand",duration:"1 minute",effect:"Conjure a floating spectral hand that can manipulate objects, open unlocked doors/containers, and carry up to 10 lb. It cannot attack, activate magic items, or wield weapons."},

  // ── Tier 1 (expends a 1st-tier slot) ──
  "magic missile":{kind:"spell",tier:1,cost:"slot",isMagical:true,range:"120ft",targets:"up to 3 creatures",duration:"instantaneous",dice:"1d4+1 force per dart",effect:"Three darts of force strike targets you can see, one dart each or combined; each auto-hits for 1d4+1 force. No attack roll, no save."},
  "shield":{kind:"spell",tier:1,cost:"slot",isMagical:true,range:"self",targets:"self",duration:"1 round",concentration:false,effect:"A reaction (cast when hit or targeted by magic missile): +5 AC until the start of your next turn, INCLUDING against the triggering attack, and negates magic missile."},
  "healing word":{kind:"spell",tier:1,cost:"slot",isMagical:true,range:"60ft",targets:"1 creature",duration:"instantaneous",dice:"1d4 + spell mod healing",effect:"A bonus action: one creature you can see regains 1d4 + your spellcasting modifier HP. No effect on undead or constructs."},
  "cure wounds":{kind:"spell",tier:1,cost:"slot",isMagical:true,range:"touch",targets:"1 creature",duration:"instantaneous",dice:"1d8 + spell mod healing",effect:"Touch a creature to restore 1d8 + your spellcasting modifier HP. No effect on undead or constructs."},
  "hunter's mark":{kind:"spell",tier:1,cost:"slot",isMagical:true,range:"90ft",targets:"1 creature",duration:"concentration, up to 1 hour",dice:"+1d6 weapon damage",effect:"Mark one creature you can see. Your weapon attacks against THAT target deal +1d6 damage, and you have advantage to track it. EXCLUSIVE: only one Hunter's Mark can exist at a time — casting it again moves the mark and ends the previous one. If the target drops, you may move the mark to a new creature as a bonus action."},
  "faerie fire":{kind:"spell",tier:1,cost:"slot",isMagical:true,range:"60ft",targets:"20ft cube",duration:"concentration, up to 1 minute",save:"DEX for none",effect:"Each creature in the cube that fails a DEX save is outlined in light: attacks against it have advantage and it cannot benefit from invisibility."},

  // ── Tier 2 (expends a 2nd-tier slot) ──
  "misty step":{kind:"spell",tier:2,cost:"slot",isMagical:true,range:"self",targets:"self",duration:"instantaneous",effect:"A bonus action: teleport up to 30ft to an unoccupied space you can see. Line of sight required — you cannot step through a wall you can't see past."},
  "pass without trace":{kind:"spell",tier:2,cost:"slot",isMagical:true,range:"self",targets:"self and allies within 30ft",duration:"concentration, up to 1 hour",effect:"You and allies within 30ft gain +10 to Stealth and cannot be tracked by nonmagical means, leaving no tracks or scent."},
  "hold person":{kind:"spell",tier:2,cost:"slot",isMagical:true,range:"60ft",targets:"1 humanoid",duration:"concentration, up to 1 minute",save:"WIS or paralyzed",effect:"A humanoid you can see must make a WIS save or be paralyzed. It repeats the save at the end of each of its turns, ending the effect on a success. Humanoids only — not beasts, undead, or monstrosities."},
  "invisibility":{kind:"spell",tier:2,cost:"slot",isMagical:true,range:"touch",targets:"1 creature",duration:"concentration, up to 1 hour",effect:"A creature you touch becomes invisible until it attacks, casts a spell, or the spell ends. Anything it is wearing or carrying is invisible too."},

  // ── Tier 3 (expends a 3rd-tier slot) ──
  "fireball":{kind:"spell",tier:3,cost:"slot",isMagical:true,range:"150ft",targets:"20ft-radius sphere",duration:"instantaneous",dice:"8d6 fire",save:"DEX for half",effect:"A bright streak blossoms into flame at a point you choose; each creature in a 20ft-radius sphere makes a DEX save, taking 8d6 fire (half on a success). Ignites unattended flammable objects."},
  "counterspell":{kind:"spell",tier:3,cost:"slot",isMagical:true,range:"60ft",targets:"1 creature casting a spell",duration:"instantaneous",effect:"A reaction when you see a creature within 60ft casting: automatically negate a spell of 3rd tier or lower. For a higher-tier spell, make a spellcasting ability check (DC 10 + that spell's tier) to interrupt it."},
  "dispel magic":{kind:"spell",tier:3,cost:"slot",isMagical:true,range:"120ft",targets:"1 creature, object, or magical effect",duration:"instantaneous",effect:"End one ongoing spell of 3rd tier or lower on the target automatically. For a higher-tier effect, make a spellcasting ability check (DC 10 + that spell's tier). Only affects ongoing magical effects, not instantaneous ones already resolved."},
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

// Base-name key: strip the display parenthetical, lowercase, trim. Mirrors the [SPELL_USED:] matcher.
function capBaseName(nm){return String(nm||"").replace(/\s*\(.*\)/,"").toLowerCase().trim();}

// The ONE capability lookup — used by the card, the viewer, and both injection blocks. The emergent
// per-campaign overlay (worldState.capabilityBible, filed write-once by [SPELL_DEF:]) wins over the
// static base, so a GM-defined capability — or a GM correction to a base one — is authoritative.
function capabilityLookup(nm){
  var key=capBaseName(nm);
  if(typeof worldState!=="undefined"&&worldState&&worldState.capabilityBible&&worldState.capabilityBible[key])return worldState.capabilityBible[key];
  return (typeof CAPABILITY_BIBLE!=="undefined"&&CAPABILITY_BIBLE[key])||null;
}
