// spell_bible.js — the canonical spell reference (`spell_bible`, TODO #10).
//
// ONE registry, keyed by BASE spell name (parenthetical stripped, lowercased) so it overlays
// the existing SPELLS strings and the [SPELL_USED:] matcher with NO refactor of how spells are
// stored. Two consumers, one source: (1) GM-authoritative prompt injection on cast/use — the
// anti-drift fix (same re-inject-from-data pattern as the quest block / char sheet /
// [LOCATION_DESC:]); (2) the player-facing card (shared with the future `bible_study` viewer).
//
// Hand-authored (no editor, by design — like SPELLS / DEFAULT_RULES). Emergent/campaign spells
// the GM invents get a write-once [SPELL_DEF:] overlay in worldState, merged OVER this base at
// lookup time (see spellBibleLookup).
//
// ── ENTRY SCHEMA (unified "capability" shape; spells and abilities share it — `kind` is a
//    cosmetic display tag, the real axes are `cost` and `isMagical`) ──
//   kind       "spell"
//   tier       0 = cantrip, 1..4 = spell tier
//   cost       recharge model — "at-will" (cantrips, never expend) | "slot" (leveled; expends a
//              slot, refilled by a long rest). Future kinds also use: "1-day" | "1-rest" | "passive".
//   isMagical  true for every spell. AUTHORING RULE: true if it would light up under Detect Magic
//              or be targetable by Dispel Magic. (Load-bearing once abilities/items join — it's the
//              one real spell-vs-ability divider: dispel / counterspell / antimagic susceptibility.)
//   range / targets / duration / effect   the drift-prone canon the GM must NOT re-improvise
//   dice? / save? / concentration?        optional
//
// Starter set — a cross-class spread plus the two known drift cases: `message` (range crept to
// "limitless" in play) and `hunter's mark` (exclusive 1-target effect the GM re-cast without
// clearing, audit P10). Expand toward full coverage over time.

var SPELL_BIBLE={
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
  "dispel magic":{kind:"spell",tier:3,cost:"slot",isMagical:true,range:"120ft",targets:"1 creature, object, or magical effect",duration:"instantaneous",effect:"End one ongoing spell of 3rd tier or lower on the target automatically. For a higher-tier effect, make a spellcasting ability check (DC 10 + that spell's tier). Only affects ongoing magical effects, not instantaneous ones already resolved."}
};

// Base-name key: strip the display parenthetical ("Fire Bolt (d10 fire, 120ft)" -> "fire bolt"),
// lowercase, trim. Mirrors the [SPELL_USED:] base-name matcher so both resolve to the same entry.
function spellBaseName(nm){return String(nm||"").replace(/\s*\(.*\)/,"").toLowerCase().trim();}

// Look up canonical spell data by any name form. The per-campaign emergent overlay
// (worldState.spellBible, filed write-once by a future [SPELL_DEF:] tag) wins over the static base,
// so a GM-defined spell — or a GM correction to a base spell — is authoritative for that campaign.
function spellBibleLookup(nm){
  var key=spellBaseName(nm);
  if(typeof worldState!=="undefined"&&worldState&&worldState.spellBible&&worldState.spellBible[key])return worldState.spellBible[key];
  return (typeof SPELL_BIBLE!=="undefined"&&SPELL_BIBLE[key])||null;
}
