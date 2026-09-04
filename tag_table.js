// tag_table.js — THE tag registry (UA1, session A). ⛨ DRIFT SURFACE.
// One ordered table drives what used to live in three hand-synced places: the applyMuts parsers,
// the cleanTxt strip regexes, and the STATE TAGS prompt docs. Divergence between those three was
// silent in both directions (the [ENEMY_SURRENDERS] phantom); here it is structurally impossible —
// coverage guards in dev/engine-tests.js fail the commit instead.
//
// SOLE PARSER since v1.261: applyMuts (api.js) is a thin veneer over applyMutsTable below. The
// legacy hand-written parser and the shadow/parity machinery that validated this table against
// it (shadow mode v1.241 → cutover v1.258 → reverse soak → deletion v1.261) are GONE. Retained
// tripwires: __tagUnknownScan (vocabulary gaps), __tagNoCombatWarns (UA27), and the engine-test
// coverage guards + frozen strip/doc hashes.
//
// ORDER IS LOAD-BEARING. TAG_TABLE array order = the exact current applyMuts execution order:
// LOCATION before LOCATION_DESC (travel edge needs the previous node), SUBLOCATION before
// DESC/SIZE (E9), NPC_ALIAS/NPC_MERGE before NPC (same-turn alias resolution),
// stampQuestCompletion LAST. Never reorder without a diff-mode soak.
//
// HANDLER CONTRACT: apply(text, R) where R is the per-response scratch:
//   R.muts   — mutation labels for the system line
//   R.turn   — worldState.turn frozen at entry
//   R.feGet()    — lazy first-encounter snippet (computed once per response)
//   R.combatStarts() — lazy [COMBAT_START:] position list (computed once per response; audit #8 —
//                  was recomputed by each of the 4 combat-attribute handlers)
//   R._xpMirror(n) — party XP mirror with the COMPANION_XP supersede scan
// Handlers reference worldState/memory/helpers as GLOBALS, exactly like the originals did —
// this is what let shadow mode run them against clones by swapping the globals during the
// UA1 validation era, and it remains the calling convention.

// ── Strip registry (derives cleanTxt's _CT_TAGS/_CT_BARE — order preserved from the originals) ──
// #300 — the post-handler seam of the downed state: every committed response after the one that downed
// the hero counts as an unresolved turn unless it carried the resolution tag; at DOWNED_MAX_TURNS the
// engine rules a true death itself (the GM was told, twice). Also parks a multiplayer PC companion whose
// HP reached 0 — death is personal, the party continues, they rejoin at the next camp (mpRejoinFallen).
function downedObserve(text,R){
  if(!worldState)return;
  var d=worldState.downed;
  if(d&&!worldState.deathPending&&!/\[DOWNED_RESOLVED:/i.test(text)&&d.since!==R.turn){
    d.turns=(d.turns||0)+1;
    if(d.turns>=DOWNED_MAX_TURNS){var here=(worldState.world&&worldState.world.location)||"";
      worldState.deathPending={turn:R.turn,cause:"bled out unresolved"+(here?" at "+here:"")+((typeof presentCompanions==="function"&&presentCompanions().length)?"":" with no one to intervene")};
      R.muts.push("☠ DEATH: downed for "+d.turns+" turns with no resolution");}
  }
  if(typeof mpFallPC==="function"&&worldState.npcs){var i;for(i=0;i<worldState.npcs.length;i++){var n=worldState.npcs[i];if(n&&n.partyMember&&n.isPC&&n.charSheet&&typeof n.charSheet.hp==="number"&&n.charSheet.hp<=0&&!npcIsDead(n))mpFallPC(n.name,"wounds");}}
}
// #302 — THE paymaster. Level is read BEFORE the award (a payout that lifts the level never
// re-prices itself); the shared mirror carries the milestone to every living companion exactly
// as a GM [XP:] would (R._xpMirror, #178). Returns the XP paid so a caller can name it.
function awardMilestoneXp(kind,label,R){
  var c=worldState&&worldState.character;
  if(!c||typeof MILESTONE_XP==="undefined"||!MILESTONE_XP[kind])return 0;
  var n=MILESTONE_XP[kind]*Math.max(1,c.level||1);
  c.xp+=n;
  if(R&&R.muts)R.muts.push("+"+n+" XP ("+kind+" milestone: "+label+")");
  if(typeof checkLevelUp==="function")checkLevelUp();
  if(R&&typeof R._xpMirror==="function")R._xpMirror(n);
  if(typeof showToast==="function")showToast("\u2726 +"+n+" XP \u2014 "+(kind==="quest"?"quest completed":kind==="boss"?"boss defeated":"act completed")+": "+label);
  return n;
}
// #302 — pure over the CLOSING encounter: the slain foes that qualify as bosses. A foe still
// living (a post-close newcomer, #254) can never qualify — only the dead are counted.
function combatBossFoes(){
  var c=worldState&&worldState.character,cb=worldState&&worldState.combat;if(!c||!cb||!cb.foes)return [];
  var out=[],i,ratio=(typeof BOSS_HP_RATIO==="number")?BOSS_HP_RATIO:1.5,pm=Math.max(1,c.maxHp||1);
  for(i=0;i<cb.foes.length;i++){var f=cb.foes[i];if(f.down!=="slain")continue;
    var mh=f.maxHp||0,named=(typeof wsNpcByName==="function")&&!!wsNpcByName(f.name);
    if(mh>=ratio*pm||(named&&mh>=pm))out.push(f);}
  return out;
}
var TAG_STRIP_NAMES=["HP","GOLD","ITEM_GAINED","ITEM_LOST","ITEM_KEPT","ITEM_RENAMED","LOCATION","NPC","XP","QUEST_STEP","QUEST","DICE","COMBAT_START","COMBAT_END","COMBAT_ROUND","ENEMY_HP","ENEMY_SLAIN","ENEMY_SURRENDERS","ABILITY_GAINED","ALIGNMENT","LORE","DECISION","FUTURE_EVENT_RESOLVED","FUTURE_EVENT","NPC_NOTE","NPC_FORGET","NPC_SUPERSEDE","NPC_PRONOUN","SPELL_USED","SPELL_DEF","ITEM_DEF","MANA","SKILL_SUCCESS","CONDITION","CONDITION_REMOVED","RELATIONSHIP","RELATIONSHIP_REMOVED","RELATIONSHIP_BOND","RELATIONSHIP_BOND_REMOVED","RELATIONSHIP_DYNAMIC","RELATIONSHIP_DYNAMIC_REMOVED","RELATIONSHIP_PAIR_REMOVED","SAVE_MOD","SAVE_MOD_REMOVED","LANGUAGE","STORY_BEAT","CORE_MEMORY","PARTY_MEMBER","PARTY_SPLIT","COMBAT_STATS","COMBAT_IMMUNE","COMBAT_RESIST","COMBAT_VULN","LOCATION_DESC","LOCATION_SIZE","SUBLOCATION","TIME","TIME_CHECK","TIME_ADVANCE","SCHEDULE","SCHEDULE_RESOLVED","SCHEDULE_CANCEL","WEATHER","REST","LOCATION_ITEM","LOCATION_STATE","LOCATION_RESIDENT","WARES","WANTED","DOWNED_RESOLVED","DEATH_ANSWER","WHISPER","LOCATION_HOURS","SUGGEST","CHECK","NPC_ALIAS","NPC_MERGE","NPC_LINK","FACTION","NPC_FACTION","FACTION_REL","COMPANION_HP","COMPANION_ITEM_GAINED","COMPANION_ITEM_LOST","COMPANION_ITEM_KEPT","COMPANION_ITEM_RENAMED","COMPANION_SPELL_USED","COMPANION_MANA","COMPANION_XP","COMPANION_CONDITION","COMPANION_CONDITION_REMOVED","COMPANION_RELATIONSHIP","COMPANION_RELATIONSHIP_REMOVED","COMPANION_RELATIONSHIP_BOND","COMPANION_RELATIONSHIP_BOND_REMOVED","COMPANION_RELATIONSHIP_DYNAMIC","COMPANION_RELATIONSHIP_DYNAMIC_REMOVED","COMPANION_RELATIONSHIP_PAIR_REMOVED","COMPANION_ABILITY","COMPANION_ALIGNMENT","NO_CHANGE","ARC_COMPLETE","ARC_CONTINUE","ACT_COMPLETE","SAY","ACTIONS","RETCON","ALIAS","MERGE","SCENE_CAST","NPC_DEATH_REPORTED"];/* #168 W7: explicit relationship axes coexist with compatibility-only legacy tags; all remain invisible to prose. #194: SCENE_CAST + NPC_DEATH_REPORTED join the vocabulary. */
var TAG_STRIP_BARE=["ENEMY_SURRENDERS","ENEMY_SLAIN","SUBLOCATION_LEAVE","NO_CHANGE"];/* bare ENEMY_SLAIN is UNSUPPORTED (warn, no-op) but must still strip — an unstripped bare tag leaks to the story. #211: bare [NO_CHANGE] is the audit ack's minimal form */
// Stripped/known names that DELIBERATELY have no applyMuts handler — each with its reason.
// DICE: display-only, rendered by diceTxt. ACTIONS: legacy pre-v1.110 format, replay-only.
// RETCON: consumed at logTranscript time (RAG de-index), not a state mutation.
// SAY: dialogue attribution (#96) — consumed by deriveSpeakerMapFromTags (game.js) at narration
// time from the RAW response; display strips it, state never sees it.
// (ENEMY_SURRENDERS graduated OUT of this list at v1.264 — the UA2 phantom is now a real
// handler, implemented with multi-enemy combat per MULTI_ENEMY_COMBAT.md §3.)
/* Operator-only repair tag: deliberately absent from TAG_DOC_LINES so the GM cannot invent it.
   It must still share the parser's strip registry or the repair instruction would leak to prose. */
TAG_STRIP_NAMES.splice(7,0,"NPC_DEATH_RETRACTED");
TAG_STRIP_NAMES=["SCENE_REF","SCENE_NOT","SCENE_REVEAL","SCENE_DEATH","CANON_TXN_BEGIN","CANON_TXN_END"].concat(TAG_STRIP_NAMES);
// SCENE_CAST (#194): parse-less ON PURPOSE — cast presence commits at the POST-HANDLER seam
// (derivePresenceFromResponse, identity.js) beside the guestbook arrival drain, because the
// attendance snapshot must see same-response [LOCATION:]/[PARTY_SPLIT:]/fold state SETTLED
// (amendment ③ — a positional handler would stamp against unsettled state). SAY's presence
// half (#194) commits at that same seam for the same reason; its TTS half stays at narration time.
/* #211: [NO_CHANGE] / [NO_CHANGE:context] — the audit-note acknowledgment channel (the B5/#60b
   class generalized, third instance: "Daeris is with the party, unchanged; nothing to correct
   there" opening live narrations). Deliberately parse-less: the tag EXISTS so the no-change
   decision has somewhere to go besides prose; it mutates nothing and is stripped everywhere.
   Taught ONLY in ENGINE_NOTES_PROTOCOL (api.js) — deliberately absent from TAG_DOC_LINES so the
   GM never emits it outside a note response (the NPC_DEATH_RETRACTED operator-only precedent). */
var TAG_NO_HANDLER=["DICE","ACTIONS","RETCON","SAY","CANON_TXN_BEGIN","CANON_TXN_END","SCENE_CAST","NO_CHANGE"];
function buildCtTags(){return new RegExp("\\[("+TAG_STRIP_NAMES.join("|")+"):[^\\]]+\\]","g");}
function buildCtBare(){return new RegExp("\\[("+TAG_STRIP_BARE.join("|")+")\\]","g");}

// ── Doc registry (derives the STATE TAGS block in buildSysPrompt's STABLE half) ─────────────────
// BYTE-IDENTITY IS THE CONTRACT: buildStateTagsDoc() must reproduce the battle-tested prompt text
// exactly (engine-tested against a frozen golden + a pre/post stable-half capture). Wording
// changes are their own deliberate, A/B-tested commits — never bundled with mechanics.
var TAG_DOC_LINES=[
"STATE TAGS (use in responses, never shown to player):\n",
"REFERENTIAL INTEGRITY: on first observing any story-significant person, emit [SCENE_REF:short_handle|canonical name] or [SCENE_REF:short_handle|?] when unknown. If the story explicitly establishes that handle is NOT a known NPC, emit [SCENE_NOT:handle|canonical name|explicit]; for an uncertain point-of-view guess use inference instead of explicit. A later on-screen identity reveal emits [SCENE_REVEAL:handle|canonical name]. Never infer that an anonymous actor is a known NPC merely because the player names that NPC.\n",
"IRREVERSIBLE CONSEQUENCES ARE TRANSACTIONS: a death and every quest/objective/reward consequence caused by it must be enclosed together as [CANON_TXN_BEGIN:stable_id|npc-death|canonical name or -|scene_handle|quest title or -] ... [CANON_TXN_END:stable_id]. Use [SCENE_DEATH:scene_handle] for the observed death. Reuse the SAME stable_id for delayed consequences; exact replay is ignored. Independent quest closure uses claim type quest-outcome, subject/handle '-' and its active quest title. Never place unrelated outcomes in one envelope. Inside the markers put ONLY the death and its quest/objective/reward tags; combat, time, and every other tag belongs OUTSIDE the markers (an out-of-place tag is applied normally, never canonized).\n",
"[HP:+/-X] [GOLD:+/-X gp -- ALWAYS in gold pieces; 10sp=1gp, 100cp=1gp; convert before tagging] [ITEM_GAINED:name] [ITEM_LOST:name] [LOCATION:name] [XP:N] -- XP:N is FLAVOUR ONLY (a clever or non-violent solution, a discovery, a social win), at most 10x character level per response; quest completions, boss kills and act endings are PAID BY THE ENGINE automatically the moment their tags land -- never add your own [XP:] for those\n",
"DOWNED (#300): at 0 HP the player is DOWN, not dead -- the engine offers them only struggle or yield. Resolve it within two responses by capture, rescue, or a companion's intervention and mark the outcome [DOWNED_RESOLVED:captured|why] / [DOWNED_RESOLVED:rescued|why] / [DOWNED_RESOLVED:intervened|why], healing with [HP:+N] as the story allows (the engine files the scar as a Defining Moment). Only if the story truly kills them: [DOWNED_RESOLVED:dead|how]. Never narrate a downed hero as hale. Rest heals: [REST:long] restores the party to full and is a CAMP; [REST:short] restores one hit die.\n",
"ITEM TAG FORMAT: emit the tag once per item with the bare item name -- never bake quantities into the name (no 'Torch x3'); to grant three torches, emit [ITEM_GAINED:Torch] three times.\n",
"CONSUMABLES ARE SPENT: the moment a consumable is used -- a potion drunk, a charge detonated, ammunition fired, a scroll read -- emit [ITEM_LOST:name] in that SAME response; narrated consumption without the tag leaves a ghost item on the sheet forever\n",
"TAKING IS TAGGED: whenever the party gains possession of an item -- picked up, retrieved, looted, bought, gifted, handed over -- emit [ITEM_GAINED:name] in that SAME response; a narrated acquisition without the tag never reaches the sheet\n",
"AN ITEM IS A DISCRETE PORTABLE OBJECT: [ITEM_GAINED:] takes a thing the character could set down on a table and pick up again -- a blade, a letter, a corked vial of blood. It is NOT a substance on their hands ('blood'), NOT an observation or status note ('confirmed loft position clear'), NOT a wound, condition or state, and NEVER a person or creature; if it fails the set-it-down test, narrate it instead of tagging it\n",
"GOLD IS PHYSICS TOO: every narrated payment -- a room, a meal, a bribe, a toll, a purchase -- MUST emit [GOLD:-N] in the same response, and every earning (wages, a sale, a reward) emits [GOLD:+N]; narrated coin without the tag desyncs the sheet\n",
"QUEST GOLD: completed work of real stakes SHOULD pay gold alongside XP -- guideline roughly 10x character level in gp for minor jobs, 50x for major contracts; emit it with the completion tags\n",
"LOOT SELLS: merchants are a faucet -- when the player offers loot to a merchant, state a concrete buy price and close an accepted sale with [GOLD:+N] [ITEM_LOST:name]\n",
"TRAVEL MOVES THE MAP: any journey that ends somewhere else -- another town, a waystation, a camp on the road -- MUST emit [LOCATION:name] on arrival; [TIME:] and [WEATHER:] alone do NOT move the party, and narrating a new place while the tracker still shows the old one corrupts the geography canon\n",
"ITEM NAMES CARRY PROVENANCE: name items so their origin stays recoverable ('Vial of basilisk blood', 'Signet ring (from Sheriff Hemlock)') -- never a bare noun like 'blood'; the name is the ONLY thing the sheet keeps, so where or whom it came from must live in it\n",
"[ITEM_RENAMED:old name|new name] -- the story renamed, reforged, or evolved a carried item: relabels the sheet entry IN PLACE (stack count kept). Use it when the fiction gives an existing item a new identity -- never for gaining or losing items, and never to merge two different entries. For a party member's item: [COMPANION_ITEM_RENAMED:name|old|new]\n",
"[NPC:name|status|relation] -- status=current mood/condition in 2-4 WORDS (a label like 'wary, bargaining' -- never a sentence; scene detail belongs in prose or [NPC_NOTE:]), relation=how they relate to the player (ally/enemy/acquaintance/rival/etc.); NEVER put pronouns in these fields -- pronouns go ONLY in [NPC_PRONOUN:]. [PARTY_MEMBER:name|true/false] [QUEST:title|status] [ABILITY_GAINED:Name|Desc]\n",
"NPC DEATH IS PERMANENT CANON: when a named character dies -- killed in combat, executed, assassinated, lost to any cause -- emit [NPC:name|dead|relation] in that SAME response; the engine records the death permanently (they leave the living roster and join the DECEASED line) and refuses later status writes. A dead character can return ONLY through an explicit in-story resurrection, tagged [NPC:name|resurrected|relation]. Never quietly reintroduce a dead character as alive.\n",
"REWARDS ARE PAID EXACTLY ONCE, when a quest first closes: if you correct or re-state an already-completed or failed quest (e.g. alongside a [RETCON:]), NEVER re-emit its [XP:]/[GOLD:]/[ITEM_GAINED:] -- they are already banked and a re-emission pays the player twice\n",
"[LOCATION_DESC:text] -- canonical description of this location; emit ONCE on first visit ONLY; stored permanently and never overwritten. ALWAYS name every visible exit and where each leads -- exits are canon: a way in or out that the description never mentioned does not exist\n",
"[LOCATION_SIZE:scale|travelMins] -- size of current location; scale=tiny/small/medium/large/vast; travelMins=estimated minutes to cross on foot (e.g. [LOCATION_SIZE:large|45]); emit once on first visit alongside LOCATION_DESC\n",
"[SUBLOCATION:name] -- player enters a named area within current world location (e.g. tavern common room, thieves' guild hall)\n",
"[SUBLOCATION_LEAVE] -- player exits the sub-location back to the parent world location\n",
"[TIME:time of day] -- update whenever time meaningfully advances (e.g. [TIME:dawn], [TIME:late night]); the world clock does NOT move on its own, so a night's camp, a long journey, or a rest all need this tag or the prompt keeps reporting the old time\n",
"[WEATHER:description] -- update when the weather changes (e.g. [WEATHER:heavy rain], [WEATHER:clear and cold])\n",
"[TIME_CHECK:phase] -- THE FIRST TAG OF EVERY RESPONSE, before you write any prose: read the CAMPAIGN CLOCK block and declare what time of day the scene OPENS at (labels: dawn, morning, midmorning, midday, afternoon, dusk, evening, night, midnight, late night). This is a reading, not a change -- it never moves the clock. If the clock disagrees with where you believe the story is, do NOT fix it here: charge the missing time with [TIME_ADVANCE:] or declare [TIME:phase] and let the engine reconcile. Narrate light, temperature, and activity consistent with the phase you declared.\n",
"[TIME_ADVANCE:N] -- EVERY turn, estimate how much time the turn COVERED and emit it so the campaign clock advances. Unit-suffixed: [TIME_ADVANCE:2h], [TIME_ADVANCE:30m], [TIME_ADVANCE:1d 6h]; a bare number is minutes. Minimum one minute. CHARGE THE WHOLE SCENE, not just the words on the page: a turn covers everything between the previous beat and this one -- getting there, waiting, the work itself, and the aftermath before the next scene begins. Two lines of dialogue in a shop are not two minutes of that character's day; they walked over, waited to be served, haggled, and left. Reference (scene-inclusive, so estimates stay consistent): a blow-by-blow combat round ~1 min; a word in passing 5-10 min; a real conversation, interrogation, or negotiation 20-45 min; searching a room or reading a scene 30-60 min; an errand, a shop visit, or asking around town 1-2 h; travel between places = hours, judge by distance. When the narration itself implies a gap ('later that evening', 'by the time you get there', the party settling in), charge the gap the story implies, not the sentence that describes it. EXCEPTION -- a full overnight sleep: do NOT estimate its duration; emit [REST:long] instead and the engine rolls the clock forward to dawn itself (any [TIME_ADVANCE:] in the same response is ignored). You only ESTIMATE durations -- the engine does all the arithmetic and every countdown; never compute or state elapsed totals or 'days remaining' yourself.\n",
"[SCHEDULE:label|when] -- register a future event at now+when (e.g. [SCHEDULE:Winter solstice|11d], [SCHEDULE:Poison wears off|10m]); 'when' is a duration (11d/3h/10m). The engine stores the target and COMPUTES the time remaining every turn -- set it ONCE and never restate the number. [SCHEDULE_RESOLVED:label] when it happens / is dealt with; [SCHEDULE_CANCEL:label] if it will no longer occur. When the CAMPAIGN CLOCK block shows an event under HAPPENING NOW, narrate it (a long-elapsed one already happened during a rest/timeskip -- narrate it as already having occurred) and emit any consequent tag, then [SCHEDULE_RESOLVED:] it.\n",
"[LOCATION_ITEM:name|placed] -- item left or hidden here (pair with [ITEM_LOST:]); [LOCATION_ITEM:name|taken] -- item removed by NPC/event (player pickup auto-handled by [ITEM_GAINED:])\n",
"[LOCATION_STATE:what changed] -- emit when the CURRENT location is MATERIALLY and durably changed (a structure collapsed or destroyed, burned, flooded, sealed, ruined by battle): the engine keeps a permanent change record per location and serves it back every turn, so the place is never again described as it was before. One short factual clause per change; never re-emit a change already on the record; transient scene dressing (weather, a mess soon cleared) does NOT qualify\n",
"[WARES:item|price|note] -- WANTS & ECONOMY: something concretely FOR SALE at the current settlement (name the seller in the note), priced at its VALUE -- the plain type's worth plus what its properties add (rare, fine quality, a minor enchantment, a major one) -- never scaled to the party's purse. The engine keeps the market on the location for a week of game time and serves it back under FOR SALE HERE; answer the engine's MARKET ask with one or two such lines, or [WARES:none] where nothing is sold (wilderness, a ruin). [WANTED:item|offer|by] -- someone here wants something the party CARRIES or could fetch, with what they offer for it; served back under WANTED HERE. Both are tags on purpose: wares that live only in prose are gone next turn\n",
"[LOCATION_HOURS:open-close|note] -- when you invent an establishment's hours (a shop, a temple, a gate), file them on the current place so the clock can honour them next visit: whole hours 0-24, overnight ranges like 20-4 are fine; the geography block will say OPEN or CLOSED at this hour from then on. [LOCATION_HOURS:none] -- this place never closes or keeps no hours (answers the engine's HOURS ask once)\n",
"[SUGGEST:action one|action two|action three] -- SUGGESTED ACTIONS: the LAST tag of every narrative response, after the prose and every other tag -- exactly three short actions (under 10 words each) the player could take next: only people, objects and exits the scene has placed, at most one spell or named ability, never a door or person the narration has not mentioned, never a name or plan the outline has not surfaced on screen. The engine renders them as buttons and checks each against the scene\n",
"[CHECK:Strength check|+3|DC 15] -- THE PLAYER ROLLS (this campaign's setting): when the player's action calls for a d20 check or saving throw, emit this tag with the modifier and the DC INSTEAD of a [DICE:] result, and END your response there, before the outcome is known. The player rolls; the next message brings the result for you to narrate. Never invent a die result while this is on; no [SUGGEST:] on a response that ends at a check\n",
"[WHISPER:one sentence of what is said about the party] -- only when the engine asks (WHISPERS): a rumour as people tell it, garbled or unfair as rumour is; the engine keeps the last few and serves them back as hearsay, never as truth\n",
"[LOCATION_RESIDENT:name] -- mark a named character as ROUTINELY BASED at the current location (an innkeeper at her inn, a smith at his forge); emit it once, when the story establishes the association. This records their usual base ONLY -- it never means they are present right now, and never substitutes for meeting them. [LOCATION_RESIDENT:name|false] when they permanently cease to be based there (moved away, business destroyed). Never re-emit one the GEOGRAPHY block already shows\n",
"[COMBAT_START:name|hp|ac|atkbonus|dmgdie|morale] -- emitting it DURING an active fight adds ANOTHER enemy to the same encounter (one tag per distinct foe; a faceless group can be one pooled entry like 'Goblin pack'). [ENEMY_HP:-X] or [ENEMY_HP:Name|-X] -- use the named form whenever more than one enemy is up. [ENEMY_SLAIN:Name] -- when your narration kills a foe OUTRIGHT (stealth kill, execution, coup de grace, environmental death), assert it with this tag; the engine zeroes them. Never invent a damage number to 'cover' a narrated kill -- [ENEMY_HP:] is for dice damage, which may leave the foe standing; a foe the engine still shows alive whom your prose declared dead is a desync. [COMBAT_ROUND:N] [COMBAT_END:victory/defeat/fled]\n",
"[COMBAT_STATS:STR:N|DEX:N|CON:N|INT:N|WIS:N|CHA:N|CR:N] -- always emit alongside COMBAT_START; use official D&D stats\n",
"[COMBAT_IMMUNE:fire,poison] [COMBAT_RESIST:cold,lightning] [COMBAT_VULN:thunder] -- omit entirely if none; comma-separated damage types only\n",
"CLOSE EVERY FIGHT: emit [COMBAT_END:...] the moment combat ends by ANY means -- not only a kill. Use [COMBAT_END:fled] when the enemy breaks off or is driven away, [COMBAT_END:truce] on a parley/surrender, [COMBAT_END:disengaged] when the party leaves the fight. A fight left unclosed sits stale in the tracker.\n",
"[ENEMY_SURRENDERS] (all remaining enemies yield) or [ENEMY_SURRENDERS:Name] (one enemy yields) -- the fight ends for that foe but they LIVE; when a surrendered foe is a speaking character, register them with [NPC:name|status|relation] in the same response so they enter the world properly\n",
"[ALIGNMENT:law+1] [ALIGNMENT:good-1] (use on morally significant choices only)\n",
"[SPELL_USED:spellname] -- emit on EVERY leveled cast (cantrips are free and never expend; use the exact spell name). MANA: casting spends mana equal to the spell's tier -- the sheet shows Mana current/max; never narrate a cast the pool cannot cover. Cast costs have NO tag of their own -- never emit [MANA:] for a cast; the engine alone books cast costs from [SPELL_USED:] and [COMPANION_SPELL_USED:] ([MANA:] exists ONLY for external effects like a leech, a burn, or a restorative -- see its line below). ONE exception: a NECROMANCER may cast beyond an empty pool, and the engine automatically pays their blood price per missing point -- NEVER emit [HP:] for that price (it would double-charge). Racial 1/day spells spend no mana and recharge at dawn.\n",
"[MANA:-N|cause] / [MANA:+N|cause] -- EXTERNAL mana effects on the player ONLY (a leech's drain, a mana burn, a restorative draught): the engine applies it to the pool, clamped at zero and at max, and shows the cause. [COMPANION_MANA:Name|+/-N|cause] is the party-member twin. NEVER use these for cast costs -- casting is booked SOLELY by [SPELL_USED:]/[COMPANION_SPELL_USED:], and pairing a [MANA:] with the same cast double-charges it. A target with no mana pool is unaffected -- do not emit for them.\n",
"SPELL RANGES ARE PHYSICS: before any cast resolves, judge the distance CONCRETELY against the spell's listed range using the GEOGRAPHY block's location size -- a target in another building, street, or district, or whose current location is unknown, is BEYOND any short-range spell (~120ft or less) no matter how urgent the player's intent; narrate the failed reach and offer what the listed range actually allows\n",
"[SPELL_DEF:Name|range=X|targets=Y|duration=Z|effect=...|cost=slot|tier=1|category=arcane,divine|magical=yes] -- ONLY when a spell is cast that is NOT already in the CANONICAL SPELL RULES list (one you invented or a homebrew): define its canon ONCE so the engine pins it and it can never drift. '=' per field, '|' between fields; category is a comma-separated tradition list (arcane/divine/primal/necromantic/martial); keep effect free of '|' and ']'. Recorded once, re-injected forever -- do not redefine a spell already listed.\n",
"[ITEM_DEF:Name|category=consumable|effect=...|uses=single use|value=50 gp] -- PROPOSE canon for a carried item the story has made mechanics-bearing (a potion's effect, a device's function) that is NOT already in the ITEM CANON list. This is a PROPOSAL: the player must accept it before it becomes canon, so keep narrating without assuming the definition until it appears in ITEM CANON. category is one of weapon/armor/consumable/tool/quest/treasure/mundane; '=' per field, '|' between fields; keep effect free of '|' and ']'. Never redefine an item already listed, and NEVER put instance state (charges left, ownership, provenance) in a definition -- definitions describe the TYPE.\n",
"[REST:long] when the party completes a full/long rest (a night's sleep) -- refills every party member's MANA pool and restores 1/day racial spells, and rolls the campaign clock forward to DAWN of the next day (days run dawn to dawn -- never emit [TIME_ADVANCE:] for the sleep itself); also emit [TIME:dawn] so the scene time matches, and narrate HP recovery with [HP:+N] as usual\n",
"[FUTURE_EVENT_RESOLVED:what] (when a pending future event occurs)\n",
"[LORE:fact] [DECISION:description] [FUTURE_EVENT:what|when] [NPC_NOTE:name|note] [NPC_PRONOUN:name|she/her]\n",
"[NPC_FORGET:name|person or event] -- erase one specific memory from an NPC (emit when the Oubliate spell is cast and the WIS save fails); the engine scrubs that fact from what the NPC knows so it cannot resurface\n",
"[NPC_SUPERSEDE:name|outdated fact|current truth] -- when a revelation makes something on an NPC's record WRONG (an identity confirmed, a lie exposed, a belief corrected): the engine retires the outdated fact and records the truth so the two are never served side by side. If the reveal shows two known NPCs are the SAME person, also emit [NPC_MERGE:canonical|duplicate]\n",
"[RETCON:what was corrected] -- emit whenever you correct, rewind, or retract something you previously narrated (including after an out-of-character correction from the player); the engine de-indexes the superseded narration from episodic memory so the wrong version can never resurface as truth. If the retracted narration is OLDER than your immediately previous response, add its turn number as a second field ([RETCON:what was corrected|turn] -- turn numbers appear in the bracketed [Turn N] headers of past-scene excerpts) so the RIGHT scene is de-indexed\n",
"[NPC_ALIAS:canonical_name|alias] -- when a character is given a new name or title; links alias to canonical; prevents duplicate entries; emit alongside the NPC tag that introduces the alias. If the named character is the PLAYER or a party member, the alias is recorded as a TITLE/EPITHET on their character sheet ('Butcher of Ashfen') -- epithets are YOURS to grant, only at dramatic moments the story has earned: NEVER emit one because the player asks for, invents, or declares a title for themselves (deflect self-titling in prose -- names are given by the world, not taken); the player may reject a granted epithet from their sheet\n",
"[NPC_MERGE:canonical_name|duplicate_name] -- when two NPC entries turn out to be the same person; absorbs events/knowledge from duplicate into canonical and removes duplicate\n",
"[ALIAS:domain|canonical|alias] and [MERGE:domain|canonical|duplicate] -- the generalized identity pair (domains: npc); same effect as the NPC_ tags above, and the form engine notes may ask for. A name containing | or ] cannot ride these tags and is refused\n",
"[NPC_LINK:name1|name2|relationship] -- relationship between two named characters (NPC↔NPC or NPC↔player); emit when establishing or changing how two characters relate (e.g. [NPC_LINK:Zarith|Guard Captain|employer/employee], [NPC_LINK:Borin|player|old debt]); updates existing link if already set\n",
"[FACTION:name|desc] -- register or update a faction, guild, order, or organisation (e.g. [FACTION:The Black Hand|criminal thieves guild controlling the docks]); use on first mention\n",
"[NPC_FACTION:npcName|factionName|role] -- assign an NPC to a faction with their role (e.g. [NPC_FACTION:Zarith|The Black Hand|enforcer]); auto-registers the faction if unknown\n",
"[FACTION_REL:faction1|faction2|relationship] -- relationship between two factions (e.g. [FACTION_REL:The Black Hand|City Watch|bitter enemies], [FACTION_REL:Merchant Guild|City Watch|uneasy allies])\n",
// The exact-ids list DERIVES from SKILLS (data.js, loaded before this file) — hand-maintained it
// rotted (v1.546: Explosives shipped in SKILLS but never entered the list, so the GM was never
// told it could award it). SKILLS is load-time constant, so per-turn byte-identity (the cache
// contract above) holds; the frozen doc hash + the bidirectional engine guard pin both halves.
"[SKILL_SUCCESS:skill_id] -- on a successful skilled action (exact ids: "+SKILLS.map(function(s){return s.id;}).join(", ")+")\n",
"[SKILL_SUCCESS:Tracking] covers both wilderness tracking (following prey or people by physical signs) and urban tailing (shadowing a mark through crowds, alleys, or city streets). Use WIS for reading the environment, INT for anticipating movement patterns.\n",
"[CONDITION:name|duration|cause] [CONDITION_REMOVED:name] -- duration is descriptive (e.g. 'until antidote', 'saving throw each hour CON DC 15'); cause = what inflicted it (e.g. 'Reaper Spider bite') -- ALWAYS name the cause so the sheet carries the why\n",
"RELATIONSHIPS HAVE TWO AXES. [RELATIONSHIP_BOND:entity|durable bond] records durable canon such as Wife/Husband/Family/Sworn ally/Nemesis; [RELATIONSHIP_DYNAMIC:entity|current dynamic] records changeable posture such as tense, warming, owed a favor, or suspicious. A passing moment belongs in DYNAMIC and must never replace BOND. New bonds commit directly; replacing or removing an existing bond is proposed first and must be confirmed by repeating the exact tag on a LATER response. [RELATIONSHIP_BOND_REMOVED:entity] and [RELATIONSHIP_DYNAMIC_REMOVED:entity] remove only that axis; [RELATIONSHIP_PAIR_REMOVED:entity] explicitly removes both (and also needs later confirmation when a bond exists). Legacy [RELATIONSHIP:] / [RELATIONSHIP_REMOVED:] are compatibility-only: the engine will not guess an axis and will ask you to re-emit an explicit tag. Values over 240 characters are refused. entity=NPC or faction.\n",
"[SAVE_MOD:source|type|amount] [SAVE_MOD_REMOVED:source] -- type=stat (CON/DEX/etc.) or threat (Poison/Fire/Cold/Lightning/Fear/Charm/Psionic/Holy/Shadow/Disease/Magic/Other); amount=integer\n",
"[LANGUAGE:name|fluent] or [LANGUAGE:name|broken] -- when character learns or improves a language\n",
"[STORY_BEAT:one sentence] -- major narrative milestone; use sparingly for truly significant moments only. Concrete triggers, one beat per such moment: a companion joins or leaves the party, an oath or bargain is struck, a major revelation lands, first blood is drawn in a significant conflict, a quest completes\n",
"[CORE_MEMORY:subject|one sentence] -- a PERMANENT defining moment filed onto every present party member's sheet and kept in front of you forever. Use RARELY -- only for moments that must never be forgotten: a wedding, a sworn vow, a betrayal, a life-changing revelation. The engine already auto-files near-death, party joins/leaves, deaths, and weighty bond changes -- never duplicate those. subject = the character the moment is about; name BOTH parties in the sentence so it reads true on every sheet\n",
"[SAY:Character Name] -- VOICE ATTRIBUTION: place immediately BEFORE every line of spoken dialogue, naming its speaker, e.g. [SAY:Frizwick]\"Don't jinx it,\" Frizwick mutters. Tag EVERY quoted line -- including the player character's own lines (use their character NAME, never 'you'). Tag EACH NEW PARAGRAPH of a continuing speech too -- a paragraph-opening quote always takes a fresh tag; an untagged one falls to the narrator. Use the speaker's exact registered name; omit the tag only for unnamed incidental speakers. The tag is invisible to the player and tells the narrator engine which voice performs the line -- an untagged line is read in the narrator's voice. A tagged speaker is understood to be PHYSICALLY PRESENT in the scene you are narrating -- if a voice is remote or unreal (a letter read aloud, a sending, a scrying, a remembered line, a dream), do not tag it; render it in the narrator's voice.\n",
"[ARC_COMPLETE:arc title] -- emit when the current arc's objective is fulfilled; advances to the next arc\n",
"[ARC_CONTINUE:arc title|why it remains open] -- the OTHER answer to an ARC DRIFT CHECK: the arc is genuinely unfinished. Records your reason and resets the check timer. Every drift check must be answered with this or [ARC_COMPLETE:] -- never left unanswered\n",
"[ACT_COMPLETE:act title] -- emit when the act's turning point occurs; advances to the next act. The title must MATCH the active act, and every arc in it must be closed first ([ARC_COMPLETE:] may land in the same response)\n",
"COMPANION SHEET TAGS — use these (not the player tags) when the event affects a named party member, not the player:\n",
"[SCENE_CAST:Name, Name] -- WHO IS PHYSICALLY HERE: the characters standing in the scene you are narrating, close enough to be spoken to or struck this instant. Emit ONE such line when the engine asks (it asks at scene changes); name every present character and nobody else -- someone the party is talking ABOUT, expecting, or remembering is NOT in the cast. If the party is alone, emit [SCENE_CAST:none].\n",
"[NPC_DEATH_REPORTED:name|source] -- a death the party did NOT witness: learned from testimony, a discovered body, or news from elsewhere. Commits the death honestly as REPORTED second-hand canon (no eyewitness claim). Use it when you narrate an off-screen death; never for a death the party watches happen -- that one is [NPC:name|dead|relation], inside its CANON_TXN when rewards ride with it.\n",
"[COMPANION_HP:Name|+/-N] [COMPANION_ITEM_GAINED:Name|item] [COMPANION_ITEM_LOST:Name|item] [COMPANION_XP:Name|N]\n",
"[COMPANION_CONDITION:Name|condName|duration|cause] [COMPANION_CONDITION_REMOVED:Name|condName]\n",
"[COMPANION_RELATIONSHIP_BOND:Name|entity|durable bond] [COMPANION_RELATIONSHIP_BOND_REMOVED:Name|entity] [COMPANION_RELATIONSHIP_DYNAMIC:Name|entity|current dynamic] [COMPANION_RELATIONSHIP_DYNAMIC_REMOVED:Name|entity] [COMPANION_RELATIONSHIP_PAIR_REMOVED:Name|entity]. The legacy COMPANION_RELATIONSHIP forms are compatibility-only and queue an explicit axis decision.\n",
"[COMPANION_ABILITY:Name|abilityName|desc] [COMPANION_ALIGNMENT:Name|law+1]\n",
"[COMPANION_SPELL_USED:Name|spellname] -- when a PARTY MEMBER casts a leveled spell (cantrips never expend; use the exact spell name). Same mana economy, spent from THEIR own pool (shown on their party sheet). The player's own casts keep [SPELL_USED:].\n",
"[PARTY_SPLIT:Name|Location] or [PARTY_SPLIT:Name|Location|Sublocation] -- a party member strikes out on their OWN: they are at that location, away from the party, until you emit [PARTY_SPLIT:Name|rejoin] when they return. Split members move ONLY via this tag -- bare [LOCATION:] moves the main party and NEVER touches them. The player character cannot split (the story camera follows them).\n",
"Use the companion's exact name as it appears in the party list. Apply the same upkeep rules as for the player.\n",
"THE MOMENT an NPC agrees to travel with the party — even conditionally or provisionally — you MUST emit [PARTY_MEMBER:name|true] in that same response; never narrate a joining without the tag.\n",
"XP IS SHARED AUTOMATICALLY: every [XP:N] you award is mirrored by the engine to all party members. Use [COMPANION_XP:Name|N] ONLY for a bonus one companion earns alone — never re-emit a shared award with it.\n\n"
];
// #311 ① (owner ruling 2026-09-03, validated on the t2097 save): ENGINE-ONLY tags — those whose only
// legitimate emission ANSWERS an engine note — leave the standing STATE TAGS doc; the note that asks
// carries the syntax (contract-pinned in run-tests: every name here appears inside a builder's text).
// They stay in TAG_TABLE: parsed, stripped, documented at ask time. Measured: 1,187 chars off the cached
// half — small money, zero attention cost, and the standing vocabulary reads as what the GM may do unasked.
var TAG_DOC_ENGINE_ONLY=["NPC_SUPERSEDE","NPC_MERGE","ALIAS","MERGE","ITEM_RENAMED","COMPANION_ITEM_RENAMED","WHISPER"];
function _docLineEngineOnly(line){
  var m,re=/\[([A-Z][A-Z_]+)(?=[:\]|])/g,names=[];
  while((m=re.exec(line)))if(names.indexOf(m[1])<0)names.push(m[1]);
  if(!names.length)return false;
  var i;for(i=0;i<names.length;i++)if(TAG_DOC_ENGINE_ONLY.indexOf(names[i])<0)return false;
  return true;
}
function buildStateTagsDoc(){var out=[],i;for(i=0;i<TAG_DOC_LINES.length;i++){if(_docLineEngineOnly(TAG_DOC_LINES[i]))continue;if(TAG_DOC_LINES[i].indexOf("[SUGGEST:")===0&&typeof suggestInband!=="undefined"&&!suggestInband)continue;/* #328: the rollback switch removes the ask itself */if(TAG_DOC_LINES[i].indexOf("[CHECK:")===0&&!(typeof playerRollsDice!=="undefined"&&playerRollsDice))continue;/* #329: taught only while the player rolls */out.push(TAG_DOC_LINES[i]);}return out.join("");}

// ── THE TABLE — ordered handler registry. Bodies are 1:1 transcriptions of the applyMuts blocks
// (only `muts`→R.muts, `turn`→R.turn, `feGet`→R.feGet, `_xpMirror`→R._xpMirror renamed). ──────────
// ── UA26 multi-foe combat helpers (shape: worldState.combat={round,engaged,foes:[...]}) ────────
// A foe at hp<=0 or with .down set is out of the fight but stays in foes[] (panel strike-through
// + GM aftermath context). combat.engaged = the foe the player last damaged (deterministic
// "who am I fighting" proxy — ratified decision 2, MULTI_ENEMY_COMBAT.md §7).
function combatLivingFoes(){var out=[],i,f=(worldState.combat&&worldState.combat.foes)||[];
  for(i=0;i<f.length;i++){if(!f[i].down&&f[i].hp>0)out.push(f[i]);}return out;}
// B3 (v1.361): a slain foe who is a REGISTERED NPC gets the durable dead stamp when the
// encounter closes — without this the kill evaporated with worldState.combat (the Rinn Toldrath
// class: [ENEMY_HP:] set down:"slain", [COMBAT_END:] nulled the object, and no store ever heard).
// EXACT match only, on the alias-resolved canonical name: a pooled foe ("Goblin pack") or an
// unregistered mook must never stamp a real NPC (the B3 mis-match hazard).
function propagateSlainFoes(R){
  var f=(worldState.combat&&worldState.combat.foes)||[],i;
  for(i=0;i<f.length;i++){
    if(f[i].down!=="slain")continue;
    /* #299: the combat-slain ring — EVERY slain foe, rostered or not. The encounter vanishes with the
       close; without this the summary validator had nothing to match a rolled foe's cited death against
       and opened a W2 conflict for a corpse that needed no ceremony (the t24 Chain-Dragger, six notes). */
    if(f[i].name){if(!worldState.combatSlain)worldState.combatSlain=[];var _csn=String(f[i].name).trim();if(!worldState.combatSlain.some(function(x){return x.name===_csn&&x.turn===R.turn;}))worldState.combatSlain.push({name:_csn,turn:R.turn});var _cap=(typeof COMBAT_SLAIN_CAP==="number")?COMBAT_SLAIN_CAP:12;if(worldState.combatSlain.length>_cap)worldState.combatSlain=worldState.combatSlain.slice(worldState.combatSlain.length-_cap);}
    var cn=resolveNpcName(String(f[i].name||"").trim());
    var w=wsNpcByName(cn);
    if(!w||npcIsDead(w))continue;
    if(worldState.sceneRefs&&typeof w2DeathAuthorized==="function"&&!w2DeathAuthorized(cn,null)){
      if(typeof _w2Conflict==="function")_w2Conflict(cn,"-","registered combat foe lacks a prior positive scene binding");
      R.muts.push(w.name+": combat death quarantined (identity unproven)");
      continue;
    }
    w.dead=R.turn;w.status="slain";
    if(memory.npcs[cn]&&!memory.npcs[cn].dead)memory.npcs[cn].dead=R.turn;
    if(typeof _w2ResolveConflicts==="function")_w2ResolveConflicts(cn,null);/* #175bR: same heal as the direct [NPC:|dead] write */
    R.muts.push(w.name+": dead (combat, t"+R.turn+")");
    if(typeof console!=="undefined")console.warn("[combat] slain foe "+w.name+" is a registered NPC — DECEASED stamped (B3)");
  }
}
function _foeQueryNames(q,fn){
  var at=q.indexOf(fn);if(at<0||!fn)return false;
  var before=at>0?q.charAt(at-1):" ",after=q.charAt(at+fn.length);
  if(/[a-z0-9]/.test(before)||/[a-z0-9]/.test(after))return false;/* word boundaries: "thenolan" / "grimtidex" are not him */
  if(after==="'"||after==="\u2019")return false;/* the possessive: "nolan grimtide's raider" is someone else */
  return true;
}
function combatFoeByName(nm){
  var f=(worldState.combat&&worldState.combat.foes)||[],i,t=String(nm||"").toLowerCase().trim();
  for(i=0;i<f.length;i++){if(f[i].name.toLowerCase()===t)return f[i];}
  /* #297 (playtest v1767, t8): reverse containment ("the query contains a foe's name") used to accept
     "Nolan Grimtide's raider" as Nolan Grimtide — a POSSESSIVE DERIVATIVE (X's something) slew the
     boss, emptied the encounter, and propagated a false death to the roster that the story then had to
     absorb. A possessive right after the foe's name names a DIFFERENT creature and refuses (loud
     not-found, no mutation); epithets and descriptors ("Kresh the Tall", "the wounded Nolan Grimtide")
     still route, and the name must sit on word boundaries either way. */
  var hits=[];for(i=0;i<f.length;i++){var fn=f[i].name.toLowerCase();if(fn.indexOf(t)>=0||_foeQueryNames(t,fn))hits.push(f[i]);}
  if(hits.length>1&&typeof console!=="undefined")console.warn("[combat] '"+nm+"' is ambiguous — containment matches "+hits.length+" foes ("+hits.map(function(x){return x.name;}).join(", ")+"); using the first (#136②; the mutation still lands per the ratified always-lands ruling — the bare-tag path already warned on exactly this shape)");
  if(hits.length)return hits[0];
  return null;
}
// P3-F1 (v1.272): positional adjacency binding for the combat attribute tags. The doc rule is
// "emit COMBAT_STATS/IMMUNE/RESIST/VULN alongside COMBAT_START", so each attribute tag binds to
// the foe whose [COMBAT_START:] most recently PRECEDES it in the response text. The old code
// bound the FIRST attribute tag in the response to the LAST-added foe — right only when a
// response adds exactly one foe; the v1.271-playtest t10 ambush (2 foes + 2 stats in one
// response) put foe #1's statline on foe #2 and silently dropped the rest.
// COMBAT_ATTR_FALLBACK governs an attribute tag with NO preceding COMBAT_START in its response
// (a lone mid-fight stats correction — never yet observed live):
//   "engaged"    — mirror bare-ENEMY_HP addressing: single living foe, else the engaged foe,
//                  else first living + warn (ONE addressing model across all combat tags).
//   "last-added" — the pre-v1.272 behavior (last foe in the array, living or not).
// Deliberately a one-line flip; engine tests pin BOTH settings so changing it is a safe edit.
var COMBAT_ATTR_FALLBACK="engaged";
function combatStartPositions(text){
  var re=/\[COMBAT_START:([^|\]]+)\|/g,m,out=[];
  while((m=re.exec(text)))out.push({idx:m.index,name:m[1].trim()});
  return out;
}
function combatAttrFoe(starts,idx){
  if(!worldState.combat||!worldState.combat.foes.length)return null;
  var i,name=null;
  for(i=0;i<starts.length;i++){if(starts[i].idx<idx)name=starts[i].name;else break;}
  if(name){var f=combatFoeByName(name);if(f)return f;}
  var fl=worldState.combat.foes;
  if(COMBAT_ATTR_FALLBACK==="engaged"){
    var living=combatLivingFoes();
    if(living.length===1)return living[0];
    var eng=worldState.combat.engaged?combatFoeByName(worldState.combat.engaged):null;
    if(eng&&!eng.down&&eng.hp>0)return eng;
    if(living.length){console.warn("[combat] ambiguous combat-attribute tag with "+living.length+" foes up and none engaged — routed to "+living[0].name);return living[0];}
  }
  return fl[fl.length-1];
}
function combatDmgList(s){return s.split(",").map(function(x){return x.trim();}).filter(function(x){return x&&x.toLowerCase()!=="none";});}
// Audit #8 (AUDIT_FABLE_07_16_2026): the IMMUNE/RESIST/VULN handler bodies were byte-identical
// ×3 copy-paste except tag name + target field — ONE factory now generates all three table
// entries (the table's own "adding a tag = one entry" philosophy). Behavior is 1:1 with the
// hand-written bodies it replaces: same nc flag, same no-combat guard, same g-loop regex shape
// ("\\["+tagName+":([^\\]]+)\\]" ≡ the old literals), same P3-F1 positional-adjacency binding
// via combatAttrFoe over R.combatStarts() (the per-response lazy cache of combatStartPositions
// — see applyMutsTable), same COMBAT_ATTR_FALLBACK routing and warn paths inside combatAttrFoe.
function combatAttrEntry(tagName,field){
  return {t:tagName,nc:1,apply:function(text,R){
    if(!worldState.combat||!worldState.combat.foes.length)return;
    var starts=R.combatStarts();
    var re=new RegExp("\\["+tagName+":([^\\]]+)\\]","g"),m;
    while((m=re.exec(text))){var foe=combatAttrFoe(starts,m.index);if(!foe)continue;foe[field]=combatDmgList(m[1]);}}};
}
/* #110 (v1.508): casting is a MANA spend, not a slot flip. manaPayCast is the ONE payment
   routine for player and companion casts: racial 1/day spells keep the hard used gate and
   never touch the pool; everything else pays its tier from the caster's pool (used survives
   as informational "cast since last rest"). An unpayable cast floors at 0 and WARNS —
   except a NECROMANCER, who overdraws in blood: MANA_BLOOD_HP per missing point, deducted
   HERE by the engine (the doc forbids the GM re-emitting [HP:] for it — the XP-mirror
   precedent, or the price would double-count). */
function manaPayCast(caster,sp,who,R){
  if(sp.racial){sp.used=true;R.muts.push(who+"cast: "+sp.nm+" (1/day)");return;}
  sp.used=true;
  var cost=manaSpellCost(sp),max=manaMax(caster),cur=manaCur(caster);
  if(cost<=cur){caster.mana=cur-cost;R.muts.push(who+"cast: "+sp.nm+" (−"+cost+" mana, "+caster.mana+"/"+max+")");return;}
  var deficit=cost-cur;caster.mana=0;
  if(caster.cls==="Necromancer"){
    var blood=deficit*MANA_BLOOD_HP;
    caster.hp=Math.max(0,(typeof caster.hp==="number"?caster.hp:0)-blood);
    R.muts.push(who+"BLOOD MAGIC: "+sp.nm+" (−"+cur+" mana, −"+blood+" HP for "+deficit+" missing point"+(deficit>1?"s":"")+")");
    if(typeof showToast==="function")showToast("🩸 Blood magic: −"+blood+" HP");
  }else{
    R.muts.push(who+"cast: "+sp.nm+" (pool SHORT "+deficit+" — paid "+cur+", floored at 0)");
    console.warn("[tags] SPELL_USED: "+(who||"player ")+sp.nm+" costs "+cost+" but only "+cur+" mana remained — the GM narrated a cast the pool cannot pay (only a Necromancer may overdraw)");
  }
}
/* #266 (Fable f53, joint review 2026-08-27): THE near-miss detector. Six handlers shared one
   shape — a loose outer match (or a strict outer that simply never fired) with a strict inner
   match — and an operand missing the exact expected form fell between them with ZERO warn:
   parsed as a known tag name (so __tagUnknownScan is blind), mutating nothing, telling no one.
   [SCENE_NOT:] is the sharp case: a dropped W2 NEGATIVE quietly weakens the death gate. ONE
   helper, called at each handler's head with the tag's strict shape: every occurrence of the
   name that fails the strict form warns AND pushes a ⚠ muts line naming the expected shape.
   Well-formed tags never match here — the pin test holds all six silent on correct input. */
/* #272 D5 (f44, ruling R3 2026-08-28): the merge pre-image replaces portrait bytes with an
   honest {portraitOmitted:true,bytes:N} marker — a portrait-bearing merge used to embed the
   whole base64 image (~20-60KB) into memory.archive.identityMerges FOREVER, in the one blob
   with no LZ boundary (the t308 mobile-quota class). THE STATED TRADEOFF: when canonical and
   duplicate both carry DISTINCT portraits, the duplicate's image is not copied forward (the
   handler keeps the canonical's own), so an un-merge now restores every fact, alias, event,
   and relationship but that duplicate's IMAGE is gone for good — accepted: portraits are
   regenerable art, not canon. Small strings (non-payload values) pass through untouched.
   Existing archived pre-images are left as written (the #257 no-migration precedent). */
function _mgPreImageWs(n){
  if(!n)return null;
  var c=JSON.parse(JSON.stringify(n));
  if(typeof c.portrait==="string"&&c.portrait.length>256)c.portrait={portraitOmitted:true,bytes:c.portrait.length};
  if(c.charSheet&&typeof c.charSheet.portrait==="string"&&c.charSheet.portrait.length>256)c.charSheet.portrait={portraitOmitted:true,bytes:c.charSheet.portrait.length};
  return c;
}
function __tagNearMiss(text,R,name,strictSrc,shape){
  var all=String(text||"").match(new RegExp("\\["+name+":[^\\]]*\\]","g"))||[],i,strict=new RegExp(strictSrc);
  for(i=0;i<all.length;i++){
    if(strict.test(all[i]))continue;
    if(typeof console!=="undefined")console.warn("[tags] "+name+" operand near-miss — dropped, nothing mutated: "+all[i]+" (expected "+shape+") (#266)");
    R.muts.push("⚠ ["+name+":] malformed — dropped (expected "+shape+")");
  }
}
var TAG_TABLE=[
{t:"HP",apply:function(text,R){var hpTags=text.match(/\[HP:\s*([+-]?\d+)[^\]]*\]/g)||[];if(!hpTags.length)return;
  // UA8: a save that escaped migration can carry non-finite hp/maxHp — the clamp math below
  // would then poison hp to NaN permanently. Heal with migrateWorldState's exact semantics
  // (maxHp FIRST — audit E71), loudly.
  var hpc=worldState.character;
  if(typeof hpc.maxHp!=="number"||!isFinite(hpc.maxHp)){console.warn("[tags] non-finite maxHp ("+hpc.maxHp+") healed before [HP:] apply (UA8)");hpc.maxHp=(typeof hpc.hp==="number"&&isFinite(hpc.hp)&&hpc.hp>0)?hpc.hp:8;}
  if(typeof hpc.hp!=="number"||!isFinite(hpc.hp)){console.warn("[tags] non-finite hp ("+hpc.hp+") healed before [HP:] apply (UA8)");hpc.hp=hpc.maxHp||8;}
  var hpi;for(hpi=0;hpi<hpTags.length;hpi++){var hpm=hpTags[hpi].match(/\[HP:\s*([+-]?\d+)[^\]]*\]/);if(!hpm)continue;var dv=parseInt(hpm[1]);worldState.character.hp=Math.min(worldState.character.maxHp,Math.max(0,worldState.character.hp+dv));R.muts.push(dv>0?"Healed "+dv+" HP":"Took "+Math.abs(dv)+" damage");}
  /* #300: 0 HP is DOWNED, not dead. The engine arms the state here (the one HP write site); the downed
     note takes the wheel, the seam counts unresolved turns, DOWNED_RESOLVED or a heal above 0 ends it. */
  var _hc=worldState.character;
  if(_hc.hp<=0){if(!worldState.downed){worldState.downed={since:R.turn,turns:0};R.muts.push("DOWNED — at death's door");if(typeof showToast==="function")showToast("☠ "+(_hc.name||"You")+" is DOWN — struggle, or yield");if(typeof carNotify==="function")carNotify("downed","You are down. Struggle, or yield?");}}
  else if(worldState.downed){delete worldState.downed;R.muts.push("Back on your feet");}}},
/* #301: Death's answer — engine-only vocabulary (the DEATH QUESTION note teaches it). Records the gift on the
   scene; the gift becomes canon only when the player walks BACK (deathSceneChoose), on the restored world. */
{t:"DEATH_ANSWER",apply:function(text,R){var _da=text.match(/\[DEATH_ANSWER:([^\]]*)\]/);if(!_da)return;var ds=worldState.deathScene;if(!ds){if(typeof console!=="undefined")console.warn("[death] [DEATH_ANSWER:] outside the escort scene — ignored (#301)");return;}var _ans=_da[1].trim();if(!_ans||/^none$/i.test(_ans)){ds.answer=null;R.muts.push("Death declines the question");}else{ds.answer=_ans.slice(0,400);R.muts.push("Death answers: "+ds.answer.slice(0,80));}ds.stage="choose";}},
/* #329: the player's roll — filed for THIS turn while the setting is on. A response that emits the check and
   rolls it anyway is the GM forgetting the contract: treated as engine-rolled, loudly, never a stuck die. */
{t:"CHECK",apply:function(text,R){if(!(typeof playerRollsDice!=="undefined"&&playerRollsDice))return;var m=text.match(/\[CHECK:([^\]]+)\]/);if(!m)return;var chk=parseCheckTag(m[1]);if(!chk)return;
  if(/\[DICE:/.test(text)){if(typeof console!=="undefined")console.warn("[dice] #329 the GM emitted [CHECK:"+chk.label+"] and rolled it anyway \u2014 treated as engine-rolled this turn");R.muts.push("The GM rolled "+chk.label+" itself this time");return;}
  chk.turn=R.turn;worldState.pendingCheck=chk;R.muts.push("Roll: "+chk.label+" (d20"+(chk.mod?(chk.mod>0?"+":"")+chk.mod:"")+(chk.dc!=null?" vs DC "+chk.dc:"")+") \u2014 yours to roll");}},
/* #328: the GM's own suggestion buttons — filed for THIS turn; generateActions consumes them (or falls
   through to the separate call when the tag is missing or short). No state beyond the one-turn record. */
{t:"SUGGEST",apply:function(text,R){var m=text.match(/\[SUGGEST:([^\]]+)\]/);if(!m)return;var acts=parseSuggestTag(m[1]);if(acts.length)worldState.suggestInband={turn:R.turn,acts:acts};}},
/* #317: a rumour about the party — engine-asked (the WHISPERS note), filed on a ring, served as hearsay. */
{t:"WHISPER",apply:function(text,R){var wt=text.match(/\[WHISPER:([^\]]*)\]/g)||[];var wi;for(wi=0;wi<wt.length;wi++){var t=wt[wi].slice(9,-1).trim();if(!t)continue;if(!worldState.whispers)worldState.whispers=[];var at=(worldState.world&&(worldState.world.location||""))||"";worldState.whispers.push({text:t.slice(0,240),turn:R.turn,at:at});var cap=(typeof WHISPERS_CAP==="number")?WHISPERS_CAP:12;if(worldState.whispers.length>cap)worldState.whispers=worldState.whispers.slice(worldState.whispers.length-cap);R.muts.push("Whisper: "+t.slice(0,60));}}},
/* #207 ②: hours on the CURRENT node (sublocation-aware). Overnight ranges (20-4) are legal; the geo block
   decides OPEN/CLOSED from the clock. A range that does not parse refuses loudly and files nothing. */
{t:"LOCATION_HOURS",apply:function(text,R){var lh=text.match(/\[LOCATION_HOURS:([^\]]*)\]/);if(!lh)return;
  if(/^\s*none\s*$/i.test(lh[1])){/* #207 ③: the honest no — this place keeps no hours; the ask never repeats here */var nk=currentNodeKey();if(typeof locResolve==="function")nk=locResolve(nk);if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};if(!memory.map.nodes[nk])memory.map.nodes[nk]={firstVisit:R.turn,visits:0,description:null,parent:(nk.indexOf("|")>=0?nk.split("|")[0]:null),npcs:[],items:[]};memory.map.nodes[nk].hoursNone={t:R.turn};R.muts.push("Hours: none kept here");return;}
  var parts=lh[1].split("|"),m=String(parts[0]||"").trim().match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/);if(!m||+m[1]>24||+m[2]>24){if(typeof console!=="undefined")console.warn("[hours] [LOCATION_HOURS:"+lh[1]+"] refused — the form is [LOCATION_HOURS:open-close|note] with whole hours 0-24 (#207)");return;}var key=currentNodeKey();if(typeof locResolve==="function")key=locResolve(key);if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};if(!memory.map.nodes[key])memory.map.nodes[key]={firstVisit:R.turn,visits:0,description:null,parent:(key.indexOf("|")>=0?key.split("|")[0]:null),npcs:[],items:[]};memory.map.nodes[key].hours={open:+m[1],close:+m[2],note:String(parts.slice(1).join("|")||"").trim().slice(0,80)};R.muts.push("Hours: "+m[1]+"-"+m[2]);}},
/* #300: the GM's resolution of a downed hero — captured / rescued / intervened end it (stabilised at 1 HP if
   no heal came, the scar filed as a Defining Moment by the engine); dead arms the true-death path. */
{t:"DOWNED_RESOLVED",apply:function(text,R){var _dm=text.match(/\[DOWNED_RESOLVED:([^|\]]+)(?:\|([^\]]*))?\]/);if(!_dm)return;var _out=_dm[1].trim().toLowerCase(),_why=(_dm[2]||"").trim(),_dc=worldState.character;
  if(_out==="dead"||_out==="death"||_out==="killed"||_out==="slain"){worldState.deathPending={turn:R.turn,cause:_why||"slain"};R.muts.push("☠ DEATH: "+(_why||"slain"));return;}
  if(["captured","rescued","intervened","spared","saved"].indexOf(_out)<0){if(typeof console!=="undefined")console.warn("[downed] [DOWNED_RESOLVED:"+_out+"] refused — outcomes are captured|rescued|intervened|dead (#300)");return;}
  delete worldState.downed;if(_dc.hp<1){_dc.hp=1;R.muts.push("Stabilised at 1 HP");}
  R.muts.push("Downed resolved: "+_out+(_why?" — "+_why:""));
  if(typeof fileCoreMemory==="function")fileCoreMemory("downed",_dc.name,_dc.name+" was left for dead"+(worldState.world&&worldState.world.location?" at "+worldState.world.location:"")+" and lived — "+(_why||_out)+".");}},
{t:"GOLD",apply:function(text,R){var goldTags=text.match(/\[GOLD:\s*([+-]?\d+)[^\]]*\]/g)||[];var gli;for(gli=0;gli<goldTags.length;gli++){var glm=goldTags[gli].match(/\[GOLD:\s*([+-]?\d+)[^\]]*\]/);if(!glm)continue;var dg=parseInt(glm[1]);worldState.character.gold=Math.max(0,worldState.character.gold+dg);R.muts.push(dg>0?"+"+dg+" gp":dg+" gp");}}},
{t:"ITEM_GAINED",apply:function(text,R){var igTags=text.match(/\[ITEM_GAINED:([^\]]+)\]/g)||[],igCounts={},igi;for(igi=0;igi<igTags.length;igi++){var ig0=igTags[igi].match(/\[ITEM_GAINED:([^\]]+)\]/);if(ig0){var iq0=_qtyParse(ig0[1]),ik0=itemBaseName(iq0.base);igCounts[ik0]=(igCounts[ik0]||0)+iq0.n;}}for(igi=0;igi<igTags.length;igi++){var igm=igTags[igi].match(/\[ITEM_GAINED:([^\]]+)\]/);if(!igm)continue;var igq=_qtyParse(igm[1]),igqi;duplicateItemGrantWarning(worldState.character.inventory,igq.base,igCounts[itemBaseName(igq.base)],null,R,text);for(igqi=0;igqi<igq.n;igqi++)addInventoryItem(worldState.character.inventory,igq.base);R.muts.push("+"+igq.base+(igq.n>1?" x"+igq.n:""));autoTakeLocationItem(igq.base);_itemDefCandidate(igq.base);}}},
{t:"ITEM_LOST",apply:function(text,R){var ilTags=text.match(/\[ITEM_LOST:([^\]]+)\]/g)||[];var ili;for(ili=0;ili<ilTags.length;ili++){var ilm=ilTags[ili].match(/\[ITEM_LOST:([^\]]+)\]/);if(!ilm)continue;var ilq=_qtyParse(ilm[1]),ilqi,ilHit=0;for(ilqi=0;ilqi<ilq.n;ilqi++){if(removeInventoryItem(worldState.character.inventory,ilq.base))ilHit++;}if(ilHit){R.muts.push("-"+ilq.base+(ilHit>1?" x"+ilHit:""));_clearConsumablePending(null,ilq.base);}else if(typeof console!=="undefined")console.warn("[tags] ITEM_LOST: no inventory entry matches '"+ilq.base+"' — nothing removed, no receipt minted (#136⑤, the live t1530 -none class)");}}},
// #60b: the CONSUMABLE CHECK's negative answer. Not a sheet mutation — it records that the GM
// confirmed "not spent" at the item's current count, so the check stops re-asking (see
// _stampItemKept, api.js, for the feedback loop this closes). Ordered AFTER ITEM_LOST so the
// latched count reflects any spend applied in the same response. No R.muts push: nothing changed
// on the sheet, and a "kept" line in the mutation summary would be noise.
// #176: relabel a carried item in place (renameInventoryItem, api.js — count kept, position
// kept, unknown/collision refuse LOUDLY). Ordered AFTER ITEM_GAINED/ITEM_LOST so a same-response
// undo-the-stack correction settles before the relabel.
{t:"ITEM_RENAMED",apply:function(text,R){var irTags=text.match(/\[ITEM_RENAMED:([^|\]]+)\|([^\]]+)\]/g)||[];var iri;for(iri=0;iri<irTags.length;iri++){var irm=irTags[iri].match(/\[ITEM_RENAMED:([^|\]]+)\|([^\]]+)\]/);if(!irm)continue;renameInventoryItem(worldState.character.inventory,irm[1].trim(),irm[2].trim(),R,null);}}},
{t:"ITEM_KEPT",apply:function(text,R){var ikTags=text.match(/\[ITEM_KEPT:([^\]]+)\]/g)||[];var iki;for(iki=0;iki<ikTags.length;iki++){var ikm=ikTags[iki].match(/\[ITEM_KEPT:([^\]]+)\]/);if(!ikm)continue;_stampItemKept(null,worldState.character.inventory,ikm[1].trim());}}},
{t:"LOCATION",apply:function(text,R){var loc=text.match(/\[LOCATION:([^\]]+)\]/);if(loc){var _lname=locResolve(normalizeEndpointPair(loc[1].trim()));/* #156: route names canonicalize on an UNORDERED endpoint pair at the write boundary — a reversed "(Sandpoint–Magnimar)" must land on the same node as "(Magnimar–Sandpoint)" (the #153 two-roads-one-key class, Sol §7); #156B: then RESOLVE through the identity table, so a merged alias re-anchors the canonical name in the pointer AND the prompt header (anti-drift feedback) */var _twin=locationWorldTwinConflict(_lname);if(_twin){if(!worldState.locationTwinConflicts)worldState.locationTwinConflicts=[];if(worldState.locationTwinConflicts.length<4)worldState.locationTwinConflicts.push(_twin);R.muts.push("Location move REFUSED: '"+_lname+"' is already a sub-location of "+_twin.parent);if(typeof console!=="undefined")console.warn("[location] [LOCATION:"+_lname+"] refused — existing child "+_twin.child+" would be twinned as a world node");return;}var _prevLoc=worldState.world.location;fileLocation(_lname,"",R.turn);worldState.world.location=_lname;worldState.world.sublocation=null;R.muts.push("-> "+_lname);
  // F2 (v1.216) generalized for multi-foe (v1.264): a WORLD-location change means the whole
  // encounter is over — the party traveled away. The old exemption relied on COMBAT_START
  // OVERWRITING; under add-a-foe semantics skipping the clear would leak the old location's
  // foes into the new fight, so the clear now runs UNCONDITIONALLY on a real move — silently
  // (no stale-warn, no muts line) when the same response opens a fresh fight, since the new
  // COMBAT_START immediately rebuilds the tracker (preserves v1.216's observable behavior).
  if(worldState.combat&&_lname!==_prevLoc){
    /* #260 (JP0-7, Fable f50 verified ×2): handlers run in TABLE order and [LOCATION:] precedes
       every combat handler — so this clear used to wipe the tracker BEFORE a same-response
       killing blow or victory close was read: the kill fell on a null tracker (UA27 orphan),
       never propagated, and the #225 nudge then asked the GM to RE-OPEN the finished fight.
       When the response carries OUTCOME tags for the open fight, the clear DEFERS to the
       post-handler seam: the tags apply first; if no close landed, the seam clears with the
       same loud message, sparing foes a same-response [COMBAT_START:] introduced (#258's
       pattern). A response with no outcome tags keeps the original immediate clear. */
    if(/\[(COMBAT_END:|ENEMY_HP[:\]]|ENEMY_SLAIN[:\]]|ENEMY_SURRENDERS[:\]])/.test(text)){
      R._deferCombatClear={to:_lname};
    }else{
    var _freshFight=/\[COMBAT_START:/.test(text);
    var _staleFoe=(worldState.combat.foes||[]).map(function(f){return f.name;}).join(", ")||"?";
    propagateSlainFoes(R);/* B3: foes already slain before the party moved on still get their durable stamp */
    worldState.combat=null;
    if(!_freshFight){R.muts.push("Combat ended (left the area)");if(typeof console!=="undefined")console.warn("[combat] auto-cleared stale combat ("+_staleFoe+") on move to "+_lname+" — GM emitted no [COMBAT_END:]");}}}}}},
{t:"SUBLOCATION",apply:function(text,R){var sloctag=text.match(/\[SUBLOCATION:([^\]]+)\]/);if(sloctag){worldState.world.sublocation=sloctag[1].trim();fileSubLocation(sloctag[1].trim(),R.turn);R.muts.push("Sub: "+sloctag[1].trim());}}},
{t:"SUBLOCATION_LEAVE",apply:function(text,R){if(/\[SUBLOCATION_LEAVE\]/.test(text)){worldState.world.sublocation=null;R.muts.push("Left sub-location");}}},
{t:"SCENE_REF",apply:function(text,R){var ts=text.match(/\[SCENE_REF:([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<ts.length;i++){var m=ts[i].match(/\[SCENE_REF:([^|\]]+)\|([^\]]+)\]/);if(m)sceneRefBind(m[1].trim(),m[2].trim(),R);}}},
{t:"SCENE_NOT",apply:function(text,R){__tagNearMiss(text,R,"SCENE_NOT","^\\[SCENE_NOT:[^|\\]]+\\|[^|\\]]+\\|(explicit|inference)\\]$","[SCENE_NOT:handle|Entity|explicit-or-inference] — a dropped negative weakens the death gate");var ts=text.match(/\[SCENE_NOT:([^|\]]+)\|([^|\]]+)\|(explicit|inference)\]/g)||[],i;for(i=0;i<ts.length;i++){var m=ts[i].match(/\[SCENE_NOT:([^|\]]+)\|([^|\]]+)\|(explicit|inference)\]/);if(m)sceneRefExclude(m[1].trim(),m[2].trim(),m[3].trim(),R);}}},
{t:"SCENE_REVEAL",apply:function(text,R){var ts=text.match(/\[SCENE_REVEAL:([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<ts.length;i++){var m=ts[i].match(/\[SCENE_REVEAL:([^|\]]+)\|([^\]]+)\]/);if(m)sceneRefReveal(m[1].trim(),m[2].trim(),R);}}},
{t:"SCENE_DEATH",apply:function(text,R){var ts=text.match(/\[SCENE_DEATH:([^\]]+)\]/g)||[],i;for(i=0;i<ts.length;i++){var m=ts[i].match(/\[SCENE_DEATH:([^\]]+)\]/);if(m)sceneRefDeath(m[1].trim(),R);}}},
/* #216: read-only — compares, never moves. MUST precede TIME/TIME_ADVANCE/REST in table order:
   the declaration describes the scene's OPENING, i.e. the clock the GM read in its prompt,
   so it is judged before any of this response's own advances land. */
{t:"TIME_CHECK",apply:function(text,R){/* NOT nc — shipped with nc:1 by mistake (v1.700), which made the every-response declaration trip the UA27 no-combat warn on every peaceful turn */var tcTag=text.match(/\[TIME_CHECK:([^\]]+)\]/);if(tcTag&&typeof clockCheckDeclared==="function")clockCheckDeclared(tcTag[1].trim());}},
{t:"TIME",apply:function(text,R){var timeTag=text.match(/\[TIME:([^\]]+)\]/);if(timeTag){worldState.world.time=timeTag[1].trim();R.timeText=timeTag[1].trim();/* #131: the tail reconciles the clock to this AFTER TIME_ADVANCE/REST land */R.muts.push("Time: "+timeTag[1].trim());}}},
{t:"WEATHER",apply:function(text,R){var wxTag=text.match(/\[WEATHER:([^\]]+)\]/);if(wxTag){worldState.world.weather=wxTag[1].trim();R.muts.push("Weather: "+wxTag[1].trim());}}},
// ── #73 campaign clock ──────────────────────────────────────────────────────────────────────
// [TIME_ADVANCE:N] advances the elapsed-minutes clock. The GM emits a natural-unit ESTIMATE
// (2h / 30m / 1d 6h / bare=minutes); clockAdvance does the arithmetic, clamps >=1, monotonic.
// Multiple occurrences in one response sum (a travel turn may tag legs). A jump here is exactly
// what scheduleDue()'s threshold check is built to survive (rest 6h past a 1h deadline).
{t:"TIME_ADVANCE",apply:function(text,R){var ts=text.match(/\[TIME_ADVANCE:([^\]]+)\]/g)||[],i;if(!ts.length)return;
  // #89 (v1.433): a [REST:long] in the same response OWNS the clock — restSpells rolls it to the
  // next dawn (see the REST entry below), and summing the GM's own sleep-duration estimate on top
  // would overshoot the boundary (advance 8h, then roll to the NEXT dawn = the 28h-sleep class).
  // Absorb them LOUDLY — an under-advance is bounded (<1 day, self-correcting next turn); the
  // alternative over-advance is not.
  if(/\[REST:\s*long\b[^\]]*\]/i.test(text)){R.muts.push("Time tags absorbed by the rest (the clock rolls to dawn instead)");return;}
  var want=0;for(i=0;i<ts.length;i++){var m=ts[i].match(/\[TIME_ADVANCE:([^\]]+)\]/);if(m){var _d=parseDuration(m[1]);want+=(_d<1?1:_d);}}/* per-tag minimum 1, as clockAdvance always enforced */
  // #89 review verdict (todo_checkWithFable #3): cap a single response's advance LOUDLY — a
  // legitimate "three weeks pass" fits; "9999d" (27 years) is a malformed tag, and applying it
  // silently was the flagged no-silent-failures class.
  var capped=false;
  if(want>CLOCK_MAX_RESPONSE_ADVANCE){console.warn("[clock] TIME_ADVANCE of "+want+"m exceeds the per-response cap ("+CLOCK_MAX_RESPONSE_ADVANCE+"m / 30 days) — clamped. Malformed tag?");capped=true;want=CLOCK_MAX_RESPONSE_ADVANCE;}
  var added=clockAdvance(want);
  if(added>0)R.muts.push("Time +"+added+"m ("+clockFmt()+")"+(capped?" ⚠ clamped to 30d — check the tag":""));}},
// [SCHEDULE:label|when] stores an ABSOLUTE due-time (now+when); the countdown is COMPUTED every
// turn by buildClockBlock, never stored — the anti-hallucination heart of #73.
{t:"SCHEDULE",apply:function(text,R){__tagNearMiss(text,R,"SCHEDULE","^\\[SCHEDULE:[^|\\]]+\\|[^\\]]+\\]$","[SCHEDULE:what|when] — a deadline needs its when half");var ss=text.match(/\[SCHEDULE:([^\]]+)\]/g)||[],i;for(i=0;i<ss.length;i++){var m=ss[i].match(/\[SCHEDULE:([^|\]]+)\|([^\]]+)\]/);if(!m)continue;var ev=scheduleAdd(m[1],m[2]);if(ev){var _sf=scheduleAdd._lastFold;if(_sf&&_sf.from&&String(_sf.from).toLowerCase()!==String(ev.label).toLowerCase())R.muts.push("Schedule folded: \""+_sf.from+"\" is the existing deadline \""+ev.label+"\" ("+fmtGap(ev.dueMin-clockNow())+")");/* #235: the old line paired the KEPT label with the NEW countdown and hid the fold entirely */else R.muts.push("Scheduled: "+ev.label+" ("+fmtGap(ev.dueMin-clockNow())+")");}}}},
{t:"SCHEDULE_RESOLVED",apply:function(text,R){var ss=text.match(/\[SCHEDULE_RESOLVED:([^\]]+)\]/g)||[],i;for(i=0;i<ss.length;i++){var m=ss[i].match(/\[SCHEDULE_RESOLVED:([^\]]+)\]/);if(!m)continue;var _srN=scheduleRemove(m[1]);if(_srN===1)R.muts.push("Event resolved: "+m[1].trim());else if(_srN>1){var _srL=scheduleRemove._lastRemoved||[];R.muts.push("Event resolved: '"+m[1].trim()+"' matched "+_srN+" deadlines — all retired: "+_srL.join("; "));if(typeof console!=="undefined")console.warn("[clock] SCHEDULE_RESOLVED '"+m[1].trim()+"' retired "+_srN+" deadlines by substring — "+_srL.join("; ")+" (#270/f66: matching is deliberate; the count is now honest)");}}}},
{t:"SCHEDULE_CANCEL",apply:function(text,R){var ss=text.match(/\[SCHEDULE_CANCEL:([^\]]+)\]/g)||[],i;for(i=0;i<ss.length;i++){var m=ss[i].match(/\[SCHEDULE_CANCEL:([^\]]+)\]/);if(!m)continue;var _scN=scheduleRemove(m[1]);if(_scN===1)R.muts.push("Event cancelled: "+m[1].trim());else if(_scN>1){var _scL=scheduleRemove._lastRemoved||[];R.muts.push("Event cancelled: '"+m[1].trim()+"' matched "+_scN+" deadlines — all retired: "+_scL.join("; "));if(typeof console!=="undefined")console.warn("[clock] SCHEDULE_CANCEL '"+m[1].trim()+"' retired "+_scN+" deadlines by substring — "+_scL.join("; ")+" (#270/f66)");}}}},
{t:"LOCATION_DESC",apply:function(text,R){var ldesc=text.match(/\[LOCATION_DESC:([^\]]+)\]/);if(ldesc)fileLocationDesc(ldesc[1]);}},
{t:"LOCATION_SIZE",apply:function(text,R){var lsize=text.match(/\[LOCATION_SIZE:([^|]+)\|([^\]]+)\]/);if(lsize){var lsKey=currentNodeKey();/* UA9 */if(memory.map&&memory.map.nodes[lsKey]){memory.map.nodes[lsKey].size=lsize[1].trim();memory.map.nodes[lsKey].travelMins=parseInt(lsize[2])||null;}}}},
{t:"LOCATION_ITEM",apply:function(text,R){__tagNearMiss(text,R,"LOCATION_ITEM","^\\[LOCATION_ITEM:[^|\\]]+\\|(placed|taken)\\]$","[LOCATION_ITEM:name|placed-or-taken]");var locItms=text.match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/g)||[];var lii;for(lii=0;lii<locItms.length;lii++){var lip=locItms[lii].match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/);if(!lip)continue;fileLocationItem(lip[1].trim(),lip[2],R.turn);R.muts.push(lip[2]==="placed"?"Left: "+lip[1].trim():"Taken: "+lip[1].trim());}}},
// #105 (B17): the durable state-change record — a place the party materially changed must never
// again be served as intact. Append-only via fileLocationState (memory.js; the write-once
// description is untouched); read back by buildGeoBlock (current node, beside the frozen
// description) and buildChangedLocationsBlock (the always-present remote roll-up, api.js).
// Ordered AFTER LOCATION so a move + a state note in one response land on the NEW node.
{t:"LOCATION_STATE",apply:function(text,R){var lsTags=text.match(/\[LOCATION_STATE:([^\]]+)\]/g)||[];var lsi;for(lsi=0;lsi<lsTags.length;lsi++){var lsm=lsTags[lsi].match(/\[LOCATION_STATE:([^\]]+)\]/);if(!lsm)continue;if(fileLocationState(lsm[1].trim(),R.turn))R.muts.push("Location changed: "+lsm[1].trim().slice(0,60));}}},
/* #303 WANTS & ECONOMY — [WARES:item|price|note] files a ware on the WORLD node (fileWare: size-capped, clock-expiring, re-statement refreshes); [WARES:none] records an honest empty market; a price outside WARES_PRICE_BAND× of the bible value warns and receipts the canon beside it — the narrated price is never rewritten. [WANTED:item|offer|by] files what someone here wants from the party. */
{t:"WARES",apply:function(text,R){var wt=text.match(/\[WARES:([^\]]*)\]/g)||[];var wi;for(wi=0;wi<wt.length;wi++){var body=wt[wi].slice(7,-1).trim();if(/^none$/i.test(body)){if(fileWaresNone(R.turn))R.muts.push("Market: nothing for sale here");continue;}var parts=body.split("|");if(parts.length<2||!parts[0].trim()||!parts[1].trim()){if(typeof console!=="undefined")console.warn("[wares] [WARES:"+body+"] refused — the form is [WARES:item|price|note] or [WARES:none] (#303)");continue;}var row=fileWare(parts[0],parts[1],parts.slice(2).join("|"),R.turn);if(!row)continue;var rec="For sale: "+row.item+" — "+row.price;var canon=(typeof itemLookup==="function")?itemLookup(row.item):null;var cg=(typeof itemValueGp==="function")?itemValueGp(canon):null;var pg=(typeof itemValueGp==="function")?itemValueGp({value:row.price}):null;var band=(typeof WARES_PRICE_BAND==="number")?WARES_PRICE_BAND:3;if(cg&&pg&&(pg>cg*band||pg<cg/band)){if(typeof console!=="undefined")console.warn("[wares] "+row.item+" priced "+row.price+" against a bible value of "+cg+" gp — outside the "+band+"× band; the narrated price stands, canon shown beside it (#303)");rec+=" (canon "+cg+" gp)";}R.muts.push(rec);}}},
{t:"WANTED",apply:function(text,R){var wt=text.match(/\[WANTED:([^\]]*)\]/g)||[];var wi;for(wi=0;wi<wt.length;wi++){var parts=wt[wi].slice(8,-1).split("|");if(parts.length<2||!parts[0].trim()){if(typeof console!=="undefined")console.warn("[wanted] "+wt[wi]+" refused — the form is [WANTED:item|offer|by] (#303)");continue;}var row=fileWanted(parts[0],parts[1],parts[2],R.turn);if(row)R.muts.push("Wanted here: "+row.item+(row.by?" (by "+row.by+")":""));}}},
{t:"NPC_ALIAS",apply:function(text,R){var npcAliasTags=text.match(/\[NPC_ALIAS:([^|\]]+)\|([^\]]+)\]/g)||[];var alii;for(alii=0;alii<npcAliasTags.length;alii++){var alp=npcAliasTags[alii].match(/\[NPC_ALIAS:([^|\]]+)\|([^\]]+)\]/);if(!alp)continue;var alCanon=alp[1].trim(),alAlias=alp[2].trim();
  // #47 (v1.268): a player-name (or literal "player") match is an EPITHET — character schema,
  // NOT NPC memory. Must short-circuit BEFORE the memory.npcs upsert below: the legacy path
  // would otherwise create a memory.npcs entry FOR THE PLAYER (the identity leak the design
  // rejected). Known accepted edge: an NPC who genuinely shares the player's exact name gets
  // their aliases routed here — the campaign can't distinguish them in prose either.
  var _plNm=(worldState.character&&worldState.character.name)||"";
  if(/^player$/i.test(alCanon)||(_plNm&&alCanon.toLowerCase()===_plNm.toLowerCase())){
    if(!worldState.character.aliases)worldState.character.aliases=[];
    if(worldState.character.aliases.indexOf(alAlias)<0){
      worldState.character.aliases.push(alAlias);
      relationshipRekeyEntity(_plNm,alAlias);/* #168 W7: player epithets cannot leave a second directed edge or unreachable staged decision. */
      R.muts.push("Epithet: "+alAlias);
      if(typeof showToast==="function")showToast("✦ Epithet earned: "+alAlias);
    }
    continue;
  }
  // A party member's epithet lands on the SHEET (display) *and* falls through to the normal
  // memory alias (resolution) — the two alias layers stay distinct but a companion has both.
  // (PC↔NPC swap symmetry: _switchPlayerCharacter promotes charSheet→character wholesale, so
  // aliases[] rides automatically — no swap-path code needed.)
  var _alCs=findCompanionChar(alCanon);
  if(_alCs){if(!_alCs.aliases)_alCs.aliases=[];if(_alCs.aliases.indexOf(alAlias)<0)_alCs.aliases.push(alAlias);}
  if(!memory.npcs[alCanon])memory.npcs[alCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[alCanon].aliases)memory.npcs[alCanon].aliases=[];if(memory.npcs[alCanon].aliases.indexOf(alAlias)<0)memory.npcs[alCanon].aliases.push(alAlias);var _alWs=wsNpcByName(alCanon);if(_alWs){if(!_alWs.aliases)_alWs.aliases=[];if(_alWs.aliases.indexOf(alAlias)<0)_alWs.aliases.push(alAlias);}relationshipRekeyEntity(alCanon,alAlias);if(typeof guestbookRekeyName==="function")guestbookRekeyName(alCanon,alAlias);/* #173 amendment ④: a record filed while the alias was the working name folds under the canonical */R.muts.push("Alias: "+alAlias+" -> "+alCanon);}}},
{t:"NPC_MERGE",apply:function(text,R){var npcMergeTags=text.match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/g)||[];var mgii;for(mgii=0;mgii<npcMergeTags.length;mgii++){var mgp=npcMergeTags[mgii].match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/);if(!mgp)continue;var mgCanon=mgp[1].trim(),mgDupe=mgp[2].trim();var _imWs=wsNpcByName(mgDupe);if(memory.npcs[mgDupe]||_imWs){/* #156: complete pre-image BEFORE any mutation — every identity merge is reversible by construction (P12); rides the .tnd import whitelist. #272 D5 (f44b): hoisted ABOVE the memory branch — a worldState-only duplicate used to fold with NO pre-image at all; portraits ride as honest markers via _mgPreImageWs. */memArchive().identityMerges.push({domain:"npc",canonical:mgCanon,duplicate:mgDupe,turn:R.turn,records:{mem:memory.npcs[mgDupe]?JSON.parse(JSON.stringify(memory.npcs[mgDupe])):null,ws:_mgPreImageWs(_imWs)}});}if(memory.npcs[mgDupe]){if(!memory.npcs[mgCanon])memory.npcs[mgCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[mgCanon].aliases)memory.npcs[mgCanon].aliases=[];if(!npcIsProvisional(mgDupe)&&memory.npcs[mgCanon].aliases.indexOf(mgDupe)<0)memory.npcs[mgCanon].aliases.push(mgDupe);/* #156: a provisional ° key never recurs in prose — registering it as a permanent alias would only pollute the table */var mgevs=memory.npcs[mgDupe].events||[],mgevi;for(mgevi=0;mgevi<mgevs.length;mgevi++)memory.npcs[mgCanon].events.push(mgevs[mgevi]);var mgkns=memory.npcs[mgDupe].knowledge||[],mgkni;for(mgkni=0;mgkni<mgkns.length;mgkni++){if(memory.npcs[mgCanon].knowledge.indexOf(mgkns[mgkni])<0)memory.npcs[mgCanon].knowledge.push(mgkns[mgkni]);}if(memory.npcs[mgCanon].knowledge.length>12){var mgOv=memory.npcs[mgCanon].knowledge.splice(0,memory.npcs[mgCanon].knowledge.length-12),mgOvi;for(mgOvi=0;mgOvi<mgOv.length;mgOvi++)memArchive().npcKnowledge.push({npc:mgCanon,fact:mgOv[mgOvi],turn:worldState.turn});if(typeof console!=="undefined")console.warn("[memory] #144A: merge truncated "+mgOv.length+" older facts on "+mgCanon+" — archived, not destroyed (the t1265→t1549 Morwen class: ~36 facts across 3 keys silently cut to 12)");R.muts.push("Merge: "+mgOv.length+" older facts on "+mgCanon+" archived");}/* re-slice to the write-site cap after a merge concat (E50 parallel) — pre-#144A this slice DESTROYED the overflow at exactly the moment two half-histories finally united */if(memory.npcs[mgDupe].aliases){var mgals=memory.npcs[mgDupe].aliases,mgali;for(mgali=0;mgali<mgals.length;mgali++){if(memory.npcs[mgCanon].aliases.indexOf(mgals[mgali])<0)memory.npcs[mgCanon].aliases.push(mgals[mgali]);}}if(!memory.npcs[mgCanon].firstEncounter&&memory.npcs[mgDupe].firstEncounter)memory.npcs[mgCanon].firstEncounter=memory.npcs[mgDupe].firstEncounter;if(memory.npcs[mgDupe].dead&&!memory.npcs[mgCanon].dead)memory.npcs[mgCanon].dead=memory.npcs[mgDupe].dead;/* B3: a merge must not lose the dupe's death */delete memory.npcs[mgDupe];}
  var _mgDupN=wsNpcByName(mgDupe),_mgCanN=wsNpcByName(mgCanon);/* #7: shared lookup (degenerate X|X merge still nets to entry removed, same as the old single-pass else-if) */
  if(_mgDupN){
    if(!_mgCanN){_mgCanN={name:mgCanon,status:_mgDupN.status||"unknown",rel:_mgDupN.rel||"unknown",met:_mgDupN.met||R.turn,partyMember:false,portrait:null,aliases:[]};worldState.npcs.push(_mgCanN);}
    if(_mgDupN.partyMember)_mgCanN.partyMember=true;
    if(_mgDupN.charSheet&&_mgCanN.charSheet)relationshipMergeSheets(_mgCanN.charSheet,_mgDupN.charSheet,mgCanon,mgDupe);else if(_mgDupN.charSheet&&!_mgCanN.charSheet)_mgCanN.charSheet=_mgDupN.charSheet;
    if(_mgDupN.portrait&&!_mgCanN.portrait)_mgCanN.portrait=_mgDupN.portrait;
    if(_mgDupN.portraitOffset&&!_mgCanN.portraitOffset)_mgCanN.portraitOffset=_mgDupN.portraitOffset;
    if(_mgDupN.pronouns&&!_mgCanN.pronouns)_mgCanN.pronouns=_mgDupN.pronouns;
    if(_mgDupN.dead&&!_mgCanN.dead)_mgCanN.dead=_mgDupN.dead;/* B3: a merge must not lose the dupe's death */
    if((!_mgCanN.status||_mgCanN.status==="unknown")&&_mgDupN.status)_mgCanN.status=_mgDupN.status;
    if((!_mgCanN.rel||_mgCanN.rel==="unknown")&&_mgDupN.rel)_mgCanN.rel=_mgDupN.rel;
    if(typeof _mgDupN.met==="number"&&(typeof _mgCanN.met!=="number"||_mgDupN.met<_mgCanN.met))_mgCanN.met=_mgDupN.met;
  }
  worldState.npcs=worldState.npcs.filter(function(n){return n.name!==mgDupe;});
  if(memory.npcGraph){var _mge=memory.npcGraph.edges||[],_mgei;for(_mgei=0;_mgei<_mge.length;_mgei++){if(_mge[_mgei].a===mgDupe)_mge[_mgei].a=mgCanon;if(_mge[_mgei].b===mgDupe)_mge[_mgei].b=mgCanon;}var _mgnf=memory.npcGraph.npcFactions;if(_mgnf&&_mgnf[mgDupe]){if(!_mgnf[mgCanon])_mgnf[mgCanon]=_mgnf[mgDupe];else _mgnf[mgCanon]=_mgnf[mgCanon].concat(_mgnf[mgDupe]);delete _mgnf[mgDupe];}}relationshipRekeyEntity(mgCanon,mgDupe);/* #168 W7: re-resolve rows and pending decisions on player AND companion sheets through one adapter. */if(typeof guestbookRekeyName==="function")guestbookRekeyName(mgCanon,mgDupe);/* #173 amendment ④: a merge must not orphan the duplicate's visit provenance — fold every node's dup-keyed record under the canonical */R.muts.push("Merged: "+mgDupe+" -> "+mgCanon);}}},
/* #156 Phase A: the generalized identity pair — parse core in identity.js (_identityActionTag:
   3-segment split, pipe/unknown-domain/uncapable-domain refusals all LOUD and mutation-free);
   npc operands route into the two legacy handlers above, so the vocabularies cannot diverge.
   EARLY position beside NPC_ALIAS/NPC_MERGE for the same reason they are early: later tags in
   the SAME response must resolve through a just-registered alias or just-merged key. */
{t:"ALIAS",apply:function(text,R){_identityActionTag("ALIAS",text,R);}},
{t:"MERGE",apply:function(text,R){_identityActionTag("MERGE",text,R);}},
// MOOD/RELATION SEPARATION (v1.372): the status and relation slots accept EMPTY (`*` not `+`) so
// the GM can update one field without restating the other — `[NPC:Name||ally]` sets the relation
// and leaves the mood alone. Before this, an empty slot failed the whole regex and the tag was
// dropped SILENTLY (both fields lost, no warn) — so the format's only options were "invent a value
// for every slot" or "lose the write", and inventing is what put relation words like "acquaintance"
// into mood fields. The write path below ALREADY had the right semantics (`if(npStatus)` = leave
// unchanged); only the parse couldn't express it.
{t:"NPC",apply:function(text,R){var npcs=text.match(/\[NPC:([^|\]]+)\|([^|\]]*)(?:\|([^|\]]*))?\]/g)||[];var ni;for(ni=0;ni<npcs.length;ni++){var np=npcs[ni].match(/\[NPC:([^|\]]+)\|([^|\]]*)(?:\|([^|\]]*))?\]/);if(!np)continue;var _npRaw=np[1].trim(),_npResolved=resolveNpcName(_npRaw);if(typeof memoryNpcIsPlayer==="function"&&memoryNpcIsPlayer(_npResolved)){if(typeof console!=="undefined")console.warn("[tags] NPC write for player '"+_npRaw+"' refused — player identity belongs to the character sheet");R.muts.push("NPC write refused (player): "+_npRaw);continue;}var npName=npcUpsertTarget(_npRaw,(np[3]||"").trim(),R);/* #156: THE collision boundary — returns the resolved canonical or a provisional identity when the write is a collision suspect. */
  var npStatus=clampNpcMood((np[2]||"").trim()),npRel=clampNpcMood((np[3]||"").trim()),npPron="";
  if(isPronounStr(npRel)){npPron=npRel;npRel="";}
  if(isPronounStr(npStatus)){if(!npPron)npPron=npStatus;npStatus="";}
  var _npN=wsNpcByName(npName);/* #7: shared lookup */
  // B3 (v1.361): death is FIRST-CLASS canon. A death-status write stamps npc.dead=turn on BOTH
  // stores; once stamped, a NON-death status write is REFUSED (loud warn + toast + a GM-decides
  // nudge next turn) — the resurrection-by-overwrite leg: one momentum-driven [NPC:name|scheming|
  // enemy] used to silently re-animate a corpse (the Rinn Toldrath class). The GM keeps the
  // fiction: an explicit resurrection status ([NPC:name|resurrected|...]) clears the stamp —
  // same nudge-not-block shape as the quest archived-resurrection guard above.
  var _npWasDead=npcIsDead(_npN);
  if(_npN&&npStatus&&_npWasDead){
    if(NPC_RESURRECT_RE.test(npStatus)){
      delete _npN.dead;if(memory.npcs[npName])delete memory.npcs[npName].dead;_npWasDead=false;
      _npN.status=npStatus;_npN.statusTurn=R.turn;R.muts.push(npName+" RESURRECTED");
      if(typeof console!=="undefined")console.warn("[npc] "+npName+" resurrected — DECEASED stamp cleared (explicit in-story resurrection)");
    }else if(npcDeadStatus(npStatus)){_npN.status=npStatus;_npN.statusTurn=R.turn;/* re-stating the death is harmless */}
    else{
      if(typeof console!=="undefined")console.warn("[npc] status write \""+npStatus+"\" REFUSED — "+npName+" is recorded dead"+(typeof _npN.dead==="number"?" (t"+_npN.dead+")":"")+"; only an explicit resurrection status revives (B3)");
      if(typeof showToast==="function")showToast("⚠ "+npName+" is dead — status change refused");
      R.muts.push(npName+": status refused (dead)");
      if(!worldState.deadStatusConflicts)worldState.deadStatusConflicts=[];
      var _dcDup=false,_dci;for(_dci=0;_dci<worldState.deadStatusConflicts.length;_dci++){if(worldState.deadStatusConflicts[_dci].name===npName){_dcDup=true;break;}}
      if(!_dcDup)worldState.deadStatusConflicts.push({name:npName,status:npStatus,turn:R.turn});
      npStatus="";/* refused — the memory-side writes below must not re-animate either */
    }
  /* v1.381: stamp the turn a MOOD was written, so staleness is measurable per character rather
     than guessed. Only on an actual mood write — a relation-only update ([NPC:Name||ally]) must
     NOT refresh the mood's age, or the audit would be fooled into thinking a stale mood is fresh. */
  }else if(_npN){if(npStatus){_npN.status=npStatus;_npN.statusTurn=R.turn;}}
  /* v1.372: a new NPC's MOOD seeds EMPTY, not "unknown" — "unknown" is not a mood, and the field
     is now allowed to be honestly blank (the roster render skips empty parts). `rel` keeps
     "unknown" because that IS a legitimate category for a relationship we haven't established. */
  else{worldState.npcs.push({name:npName,status:npStatus||"",statusTurn:npStatus?R.turn:0,rel:npRel||"unknown",pronouns:npPron||null,met:R.turn,partyMember:false,portrait:null,aliases:[]});_npN=worldState.npcs[worldState.npcs.length-1];if(typeof checkLegacyCharacter==="function")checkLegacyCharacter();}
  if(_npN){if(npRel)_npN.rel=npRel;if(npPron)_npN.pronouns=npPron;
    /* npcDeadStatus internally rejects resurrection phrasing ("raised from the dead" contains a
       death word) — so this stamp can never re-kill what the resurrection branch just cleared */
    if(npStatus&&!_npN.dead&&npcDeadStatus(npStatus)&&typeof plotArmor==="function"&&plotArmor(npName)){plotArmorRefuse(npName,R,"status tag");_npN.status="escaped";_npN.statusTurn=R.turn;}/* #319: the death write becomes an exit */
    else if(npStatus&&!_npN.dead&&npcDeadStatus(npStatus)){_npN.dead=R.turn;R.muts.push(npName+": dead (t"+R.turn+")");
      /* #175bR: an AUTHORIZED death answers the very question its standing conflict asked — without
         this heal the record survived its own resolution and re-toasted every 18 turns forever
         (only _w2StampDead and the committed-envelope site healed; this direct write did not). */
      if(typeof _w2ResolveConflicts==="function")_w2ResolveConflicts(npName,null);}}
  /* v1.372 — THE contamination fix. This line used to read:
         if(npRel)memory.npcs[npName].attitude=npRel;
     i.e. EVERY [NPC:] tag carrying a relation overwrote memory.npcs[].attitude with the RELATION.
     But the summarize extractor is spec'd to write a "2-4 word mood" into that same field, so one
     field had two authors writing two different CATEGORIES of data, last-write-wins. Since the GM
     re-tags anyone it interacts with, the extractor's mood was routinely destroyed within a turn or
     two — measured live: summarizer wrote "weary, grieving", the next tag restating an UNCHANGED
     relation reset it to "ally". Characters whose attitude still held a real mood (Frizwick
     "easy, approving") kept it only because nobody had re-tagged them in ~50 turns.
     attitude is now SUMMARIZER-OWNED: the tag writes mood to npc.status and relation to npc.rel,
     and touches attitude never. Seeds empty, not from npRel (same reason). */
  if(!memory.npcs[npName])memory.npcs[npName]={attitude:"",knowledge:[],events:[],aliases:[]};if(_npN&&_npN.dead&&!memory.npcs[npName].dead)memory.npcs[npName].dead=_npN.dead;/* B3: mirror the stamp */if(!memory.npcs[npName].firstEncounter)memory.npcs[npName].firstEncounter=R.feGet();if(npPron)memory.npcs[npName].pronouns=npPron;if(!_npWasDead)npcRegisterMention(npName);/* #194: REGISTRATION ONLY — a mention can never teleport a character. Presence is derived at the post-handler seam from [SAY:]/combat/arrival/[SCENE_CAST:] writers (derivePresenceFromResponse). B3 gate kept: the dead aren't even display-associated by a re-mention */R.muts.push("NPC: "+npName);}}},
/* #173: explicit residency — the guestbook's second, independent axis. resident:true means
   "routinely based here" (an innkeeper at their inn), NEVER "physically present now"; the
   record carries NO fabricated visit turn (the owner rejected any turn-sentinel encoding).
   Current-node scoped, same grain as LOCATION_ITEM/LOCATION_STATE. Ordered AFTER the NPC
   handler so a same-response introduction + residency mark resolves the just-registered name. */
{t:"LOCATION_RESIDENT",apply:function(text,R){var lrTags=text.match(/\[LOCATION_RESIDENT:([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var lri;for(lri=0;lri<lrTags.length;lri++){var lrm=lrTags[lri].match(/\[LOCATION_RESIDENT:([^|\]]+)(?:\|([^\]]+))?\]/);if(!lrm)continue;
  var lrName=lrm[1].trim(),lrOn=!(lrm[2]&&/^false$/i.test(lrm[2].trim()));
  var lrKey=currentNodeKey();
  if(!lrKey){if(typeof console!=="undefined")console.warn("[guestbook] LOCATION_RESIDENT:"+lrName+" dropped — no current location");continue;}
  if(typeof guestbookSetResident==="function"&&guestbookSetResident(lrKey,lrName,lrOn))R.muts.push(lrOn?("Resident here: "+lrName):("No longer based here: "+lrName));
  else if(typeof console!=="undefined")console.warn("[guestbook] LOCATION_RESIDENT:"+lrName+" not applied at '"+lrKey+"' — node unfiled or no such record");
}}},
/* #194 L3 (owner ruling ② 2026-08-17): the HONEST OFF-SCREEN DEATH. W2's structured-evidence
   gate is right to refuse an unwitnessed on-screen death claim — but the t1903 incident proved
   the refusal loop's cost (divergent canon, nine conflict records, an 18-turn toast loop,
   stranded rewards) exceeds a wrongly-accepted off-screen death's. This tag is the exit the loop
   never had: it commits the death AS REPORTED — second-hand canon, npc.deathReported stamped, no
   eyewitness claim — so refusal terminates in a decision instead of forever. Deliberately exempt
   from scene-evidence gating (that gate proves EYEWITNESS claims; this tag makes none). Creates
   a never-registered victim (the t1837 Vess class had no path to record its own murder victim).
   Emit OUTSIDE canon envelopes; owed rewards ride a NEW envelope afterwards via the
   dead-in-canon closing-bookkeeping path. */
{t:"NPC_DEATH_REPORTED",apply:function(text,R){var rdTags=text.match(/\[NPC_DEATH_REPORTED:([^|\]]+)(?:\|([^\]]*))?\]/g)||[],rdi;for(rdi=0;rdi<rdTags.length;rdi++){
  var rdm=rdTags[rdi].match(/\[NPC_DEATH_REPORTED:([^|\]]+)(?:\|([^\]]*))?\]/);if(!rdm)continue;
  var rdRaw=rdm[1].trim(),rdSrc=(rdm[2]||"").trim()||"unspecified report";
  var rdName=resolveNpcName(rdRaw);
  if(typeof memoryNpcIsPlayer==="function"&&memoryNpcIsPlayer(rdName)){if(typeof console!=="undefined")console.warn("[tags] NPC_DEATH_REPORTED for the PLAYER refused — player death is not roster canon");R.muts.push("Reported death refused (player): "+rdRaw);continue;}
  var rdN=wsNpcByName(rdName);
  if(!rdN){worldState.npcs.push({name:rdName,status:"",statusTurn:0,rel:"unknown",pronouns:null,met:R.turn,partyMember:false,portrait:null,aliases:[]});rdN=worldState.npcs[worldState.npcs.length-1];R.muts.push("Registered from death report: "+rdName);/* status seeds EMPTY so the stamp branch below runs — a "dead" seed reads as already-canon to npcIsDead's legacy-status fallback and the dead FLAG never lands */}
  if(!npcIsDead(rdN)&&typeof plotArmor==="function"&&plotArmor(rdName)){plotArmorRefuse(rdName,R,"death report");rdN.status="escaped (the report was wrong)";rdN.statusTurn=R.turn;}/* #319 */
  else if(npcIsDead(rdN)){if(!rdN.deathReported)rdN.deathReported={turn:R.turn,source:rdSrc};R.muts.push(rdName+": death already canon (report noted)");}
  else{
    rdN.dead=R.turn;if(!npcDeadStatus(rdN.status))rdN.status="dead";rdN.statusTurn=R.turn;
    rdN.deathReported={turn:R.turn,source:rdSrc};
    if(typeof _w2ResolveConflicts==="function")_w2ResolveConflicts(rdName,null);/* #324: a reported death answers the standing dispute — the strip on the quest its receipt named lifts (the #175 heal, at the third death path) */
    R.muts.push(rdName+": dead AS REPORTED (t"+R.turn+" — "+rdSrc+")");
    if(typeof showToast==="function")showToast("† "+rdName+" — death recorded as reported (not witnessed)");
  }
  if(!memory.npcs[rdName])memory.npcs[rdName]={attitude:"",knowledge:[],events:[],aliases:[]};
  if(!memory.npcs[rdName].dead)memory.npcs[rdName].dead=rdN.dead;
  if(!memory.npcs[rdName].firstEncounter)memory.npcs[rdName].firstEncounter=R.feGet();
  if(typeof fileNpcEvent==="function")fileNpcEvent(rdName,"Death reported, not witnessed: "+rdSrc,R.turn);
  if(typeof _w2ResolveConflicts==="function")_w2ResolveConflicts(rdName,null);/* the report answers the very question the dispute asked */
  if(worldState.deathEvidencePing&&worldState.deathEvidencePing.name===rdName)delete worldState.deathEvidencePing;
}}},
/* Owner-operated canon repair, intentionally NOT prompt-documented. Death permanence remains the
   default: a first pass accepts only an already-filed corpse, an already-filed NPC memory, a
   non-empty reason, and an already-existing remote map node. A completion pass for an older
   handler is allowed only when its archived receipt and unchanged repaired-node membership both
   match. The complete pre-image of every changed field is archived before mutation. */
{t:"NPC_DEATH_RETRACTED",apply:function(text,R){var drTags=text.match(/\[NPC_DEATH_RETRACTED:([^|\]]+)\|([^|\]]+)\|([^|\]]+)\]/g)||[],dri;for(dri=0;dri<drTags.length;dri++){
  var dr=drTags[dri].match(/\[NPC_DEATH_RETRACTED:([^|\]]+)\|([^|\]]+)\|([^|\]]+)\]/);if(!dr)continue;
  var drRaw=dr[1].trim(),drName=resolveNpcName(drRaw),drReason=dr[2].trim(),drLoc=locResolve(normalizeEndpointPair(dr[3].trim()));
  var drWorld=wsNpcByName(drName),drMemory=memory.npcs&&memory.npcs[drName],drNode=memory.map&&memory.map.nodes&&memory.map.nodes[drLoc];
  var drDeathClaim=function(v){var s=String(v&&v.note!==undefined?v.note:v);return /^\s*(?:(?:(?:the|his|her|their)\s+)?(?:body|corpse)|(?:the|his|her|their)\s+remains)\b/i.test(s)||/^\s*(?:(?:(?:is|was|has been|had been)\s+)(?:slain|killed|dead|deceased|died|perished)|(?:slain|killed)\s+by|(?:dead|deceased|died|perished)\b)/i.test(s)||new RegExp("^\\s*(?:"+drName.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"|he|she|they)\\b[^.!?]{0,60}?\\b(?:slain|killed|dead|deceased|died|perished)\\b","i").test(s);/* P4b (#169): a NAME-led or pronoun-led death claim ("Mokmurian was slain by…") is a claim about THIS NPC and must not survive the retraction */};
  var drDeathAttitude=!!(drMemory&&/^\s*(?:dead|deceased|slain|killed|perished)\s*$/i.test(String(drMemory.attitude||""))),drNeedsCleanup=drDeathAttitude,drHasCorrection=false,drScan,drs;
  if(drMemory){drScan=drMemory.knowledge||[];for(drs=0;drs<drScan.length;drs++){if(String(drScan[drs]).indexOf("Death attribution corrected:")===0)drHasCorrection=true;if(drDeathClaim(drScan[drs]))drNeedsCleanup=true;}drScan=drMemory.events||[];for(drs=0;drs<drScan.length;drs++){if(drDeathClaim(drScan[drs]))drNeedsCleanup=true;}if(!drHasCorrection)drNeedsCleanup=true;}
  var drPriorRows=memory.archive&&memory.archive.npcDeathCorrections||[],drPrior=false,drPriorRow,drp,drAtTarget=false;
  for(drp=0;drp<drPriorRows.length;drp++){drPriorRow=drPriorRows[drp];if(drPriorRow&&drPriorRow.name===drName&&drPriorRow.location&&locSame(locResolve(drPriorRow.location),drLoc)){drPrior=true;break;}}
  if(drMemory&&drMemory.lastSeenAt&&drNode&&locSame(locResolve(drMemory.lastSeenAt),drLoc)){var drTargetNpcs=drNode.npcs||[];for(drp=0;drp<drTargetNpcs.length;drp++){if(drTargetNpcs[drp]===drName){drAtTarget=true;break;}}}
  var drRecordedDead=!!(drWorld&&drMemory&&(npcIsDead(drWorld)||drMemory.dead)),drCompletionReplay=!drRecordedDead&&drPrior&&drAtTarget&&drNeedsCleanup,drRefuse="";
  if(typeof memoryNpcIsPlayer==="function"&&memoryNpcIsPlayer(drName))drRefuse="the player identity is not an NPC";
  else if(!drWorld||!drMemory)drRefuse="the NPC must already exist in both canon stores";
  else if(!drRecordedDead&&!drCompletionReplay)drRefuse="the NPC is not recorded dead and has no matching unfinished correction at this node";
  else if(!drReason)drRefuse="a correction reason is required";
  else if(!drNode)drRefuse="the destination must be an existing map node";
  else if(locSame(drLoc,locResolve(currentNodeKey())))drRefuse="the destination must be remote from the party's current node";
  if(drRefuse){if(typeof console!=="undefined")console.warn("[npc] NPC_DEATH_RETRACTED for '"+drRaw+"' REFUSED - "+drRefuse);R.muts.push("Death retraction REFUSED for "+drRaw+": "+drRefuse);/* P4b (#169): refusals ride the provenance ring, not just the console */continue;}
  var drNodes=memory.map.nodes,drMemberships=[],drNodePre=[],drKey,drList,drj,drHad;
  var drDeathTurn=typeof drWorld.dead==="number"?drWorld.dead:(typeof drMemory.dead==="number"?drMemory.dead:0);
  for(drKey in drNodes){drList=drNodes[drKey].npcs||[];drHad=false;for(drj=0;drj<drList.length;drj++){if(drList[drj]===drName){drHad=true;break;}}if(drHad)drMemberships.push(drKey);if(drHad||drKey===drLoc)drNodePre.push({node:drKey,npcs:drNodes[drKey].npcs?drNodes[drKey].npcs.slice():null});}
  var drArchive=memArchive();if(!drArchive.npcDeathCorrections)drArchive.npcDeathCorrections=[];
  drArchive.npcDeathCorrections.push({turn:R.turn,name:drName,reason:drReason,location:drLoc,completionReplay:drCompletionReplay,before:{
    world:{deadSet:Object.prototype.hasOwnProperty.call(drWorld,"dead"),dead:drWorld.dead,status:drWorld.status,statusTurn:drWorld.statusTurn},
    memory:{deadSet:Object.prototype.hasOwnProperty.call(drMemory,"dead"),dead:drMemory.dead,lastSeenAt:drMemory.lastSeenAt,attitude:drMemory.attitude,knowledge:JSON.parse(JSON.stringify(drMemory.knowledge||[])),events:JSON.parse(JSON.stringify(drMemory.events||[]))},
    map:{memberships:drMemberships,nodes:drNodePre}
  }});
  delete drWorld.dead;delete drMemory.dead;
  if(npcDeadStatus(drWorld.status)){drWorld.status="";drWorld.statusTurn=0;}
  if(drDeathAttitude)drMemory.attitude="";
  var drKnowledge=drMemory.knowledge||[],drKeptKnowledge=[];
  for(drj=0;drj<drKnowledge.length;drj++){if(!drDeathClaim(drKnowledge[drj]))drKeptKnowledge.push(drKnowledge[drj]);}
  drMemory.knowledge=drKeptKnowledge;
  var drEvents=drMemory.events||[],drKeptEvents=[],drEvent;
  for(drj=0;drj<drEvents.length;drj++){drEvent=drEvents[drj];if(!drDeathClaim(drEvent)||drDeathTurn&&typeof drEvent.turn==="number"&&drEvent.turn<drDeathTurn)drKeptEvents.push(drEvent);}
  drMemory.events=drKeptEvents;
  for(drKey in drNodes){drList=drNodes[drKey].npcs;if(!drList)continue;for(drj=drList.length-1;drj>=0;drj--){if(drList[drj]===drName)drList.splice(drj,1);}}
  if(!drNode.npcs)drNode.npcs=[];drNode.npcs.push(drName);drMemory.lastSeenAt=drLoc;drMemory.lastSeenTurn=R.turn;/* #175bR */
  var drCorrection="Death attribution corrected: "+drReason+". "+drName+" remains alive at "+drLoc+".";
  if(drMemory.knowledge.indexOf(drCorrection)<0){drMemory.knowledge.push(drCorrection);while(drMemory.knowledge.length>12)drArchive.npcKnowledge.push({npc:drName,fact:drMemory.knowledge.shift(),turn:R.turn});}
  fileLore("Death correction - "+drName+": "+drReason+". Last known at "+drLoc+".");
  if(!drCompletionReplay)fileDecision(R.turn,"Canon correction: "+drName+" was not the slain figure; "+drReason+".");
  R.muts.push((drCompletionReplay?"Death correction completed: ":"Death retracted: ")+drName+" - "+drReason+" (at "+drLoc+")");
  if(typeof console!=="undefined")console.warn("[npc] death attribution "+(drCompletionReplay?"cleanup resumed":"retracted")+" for "+drName+" - pre-image archived; alive at "+drLoc);
}}},
{t:"XP",apply:function(text,R){/* #302: the GM's [XP:] is FLAVOUR — summed per response and clamped to GM_XP_CAP_PER_LEVEL × level; quests, bosses and acts are paid by awardMilestoneXp at their own seams. The clamp is loud on both channels, never silent. */var xpTags=text.match(/\[XP:\s*\+?(\d+)[^\]]*\]/g)||[];var xpi,_xpSum=0;for(xpi=0;xpi<xpTags.length;xpi++){var xpm=xpTags[xpi].match(/\[XP:\s*\+?(\d+)[^\]]*\]/);if(!xpm)continue;_xpSum+=parseInt(xpm[1]);}if(!_xpSum)return;var _xpCap=(typeof GM_XP_CAP_PER_LEVEL==="number"?GM_XP_CAP_PER_LEVEL:10)*Math.max(1,worldState.character.level||1);if(_xpSum>_xpCap){if(typeof console!=="undefined")console.warn("[xp] GM award "+_xpSum+" XP clamped to "+_xpCap+" ("+GM_XP_CAP_PER_LEVEL+"× level; quests, bosses and acts are engine-paid — #302)");R.muts.push("+"+_xpCap+" XP (GM award "+_xpSum+" clamped to "+_xpCap+")");_xpSum=_xpCap;}else R.muts.push("+"+_xpSum+" XP");worldState.character.xp+=_xpSum;checkLevelUp();R._xpMirror(_xpSum);}},
{t:"QUEST",apply:function(text,R){/* #175 side-find: the optional desc group required 1+ chars, so [QUEST:title|completed|] — trailing pipe, empty desc, a natural model shape — silently no-opped: no warn, no mutation, quest left active forever */var quests=text.match(/\[QUEST:([^|\]]+)\|([^|\]]+)(?:\|([^\]]*))?\]/g)||[];var qi;for(qi=0;qi<quests.length;qi++){var qp=quests[qi].match(/\[QUEST:([^|\]]+)\|([^|\]]+)(?:\|([^\]]*))?\]/);if(!qp)continue;var qTitle=qp[1].trim(),qStat=qp[2].trim().toLowerCase(),qDesc=qp[3]?qp[3].trim():"";if(qStat==="complete"||qStat==="done"||qStat==="finished")qStat="completed";else if(qStat==="abandoned"||qStat==="dropped")qStat="failed";else if(qStat==="accepted")qStat="active";
  /* #259 (JP0-3b, owner ruling 2026-08-28): |declined is the PLAYER's journal decision, not GM
     vocabulary — the pre-#229 normalization silently filed it as FAILED (wrong archive class,
     wrong History label, and it let the GM close a quest the player never touched). */
  if(qStat==="declined"){
    if(typeof console!=="undefined")console.warn("[quest] [QUEST:"+qTitle+"|declined] refused — declining is the player's call (the quest journal's Decline button); the GM narrates, the player decides (#259)");
    R.muts.push("⚠ Quest '"+qTitle+"': |declined is the player's journal decision — status not applied");
    continue;}
  /* #259: the status WHITELIST. An improvised status ("paused", "ongoing") used to enter the live
     store raw and become a ZOMBIE row — invisible to every active/offered prompt reader, the #191
     staleness tooth, the completion tooth, and the #17 indicator, forever. Sol's runtime repro. */
  if(qStat!=="offered"&&qStat!=="active"&&qStat!=="completed"&&qStat!=="failed"){
    if(typeof console!=="undefined")console.warn("[quest] [QUEST:"+qTitle+"|"+qStat+"] refused — unknown status; the vocabulary is offered/active/completed/failed (#259)");
    R.muts.push("⚠ Quest '"+qTitle+"': unknown status '"+qStat+"' not applied — use offered/active/completed/failed");
    continue;}
  var _qReoffer=false,qIdx=-1,qj;for(qj=0;qj<worldState.questLog.length;qj++){if(worldState.questLog[qj].title.toLowerCase()===qTitle.toLowerCase()){qIdx=qj;break;}}
  // UA42/F3: a title already ARCHIVED as completed/failed must not silently resurrect via a
  // bare upsert (Playtest 2: 'Chapel in the Mud' completed t7, re-created by [QUEST:x|active]
  // at t9 and t60 — archived AND live at once, rewards payable twice). Loud skip — a genuine
  // follow-up quest needs a NEW title. Case-insensitive scan mirrors the live-log matching
  // above (memory.quests is keyed by original-case title — no direct key hit).
  if(qIdx<0&&memory.quests){var _ak=Object.keys(memory.quests),_ai,_arch=null;
    for(_ai=0;_ai<_ak.length;_ai++){if(_ak[_ai].toLowerCase()===qTitle.toLowerCase()){_arch=memory.quests[_ak[_ai]];break;}}
    /* #229: an ABANDONED title is blocked from re-creation in any non-offered status — the
       "active crises ARE quests" channel would otherwise force-reactivate the very goal the
       player just dropped. |offered stays legal: the world may re-raise it, the player decides. */
    if(_arch&&(_arch.status==="abandoned"||_arch.status==="declined")&&qStat!=="offered"){/* #259 (ruling 2026-08-28): a DECLINED title joins the guard — the player said no; only a fresh |offered may re-raise it */
      /* #235: the refusal must name the ACTUAL author. This wording hardcoded "the player dropped
         it" for BOTH authors — a false statement of player agency for every wall sweep, carried
         into the console, the provenance ring, the turn's system message and the #229 decisions
         modal. questArchiveWording (helpers.js) is the one renderer; a legacy record with no
         `by` reads neutrally rather than inventing an author it never recorded. */
      var _aw=questArchiveWording(_arch);
      console.warn("[quest] blocked re-creation of abandoned quest '"+qTitle+"' as "+qStat+" — it "+_aw.phrase+"; only a fresh |offered may bring it back");
      R.muts.push("Quest '"+qTitle+"' "+_aw.phrase+" — not re-registered (re-offer with [QUEST:"+qTitle+"|offered] only if the fiction re-raises it)");
      continue;}
    if(_arch&&(_arch.status==="abandoned"||_arch.status==="declined")&&qStat==="offered")_qReoffer=true;/* #259: the legal return path — stamped so a same-response |active cannot ride it */
    if(_arch&&(_arch.status==="completed"||_arch.status==="failed")){
      console.warn("[quest] blocked re-creation of archived quest '"+qTitle+"' ("+_arch.status+") — a follow-up needs a NEW title");
      R.muts.push("Quest '"+qTitle+"' already "+_arch.status+" — not reopened");
      // P3-F2 backstop (v1.273): the guard swallows the quest tag, but XP/GOLD ride separate
      // handlers that already RAN (table order) — a re-completion's rewards apply twice (live
      // t16, Playtest 3). Primary defense is the REWARDS-ARE-PAID-EXACTLY-ONCE doc line; this
      // detection fires only when that fails: same-response rewards MATCHING the archived paid
      // record = near-certain double pay. Loud (toast + warn), deliberately never a mutation —
      // reversal would fight table order and the XP mirror/level-up side effects.
      // v1.277 widening (live t10 evasion, Playtest 5): the GM re-completed with a DIFFERENT
      // XP value than the paid record — value-matching alone let it through silently. ANY
      // same-response reward on a blocked completed-re-emission now warns; matching amounts
      // keep the stronger paid-TWICE wording. Still warn-only by design.
      if(_arch.paid){var _dx=text.match(/\[XP:\s*\+?(\d+)/),_dg=text.match(/\[GOLD:\s*\+?(\d+)/),_hits=[],_any=[];
        if(_dx){_any.push("+"+_dx[1]+" XP");if(_arch.paid.xp&&parseInt(_dx[1])===_arch.paid.xp)_hits.push("+"+_arch.paid.xp+" XP");}
        if(_dg){_any.push("+"+_dg[1]+" gp");if(_arch.paid.gold&&parseInt(_dg[1])===_arch.paid.gold)_hits.push("+"+_arch.paid.gold+" gp");}
        if(_hits.length){
          console.warn("[quest] blocked re-completion of '"+qTitle+"' re-emitted its paid rewards ("+_hits.join(", ")+") — possible double payment");
          if(typeof showToast==="function")showToast("⚠ "+qTitle+": "+_hits.join(", ")+" may have been paid TWICE (rewards re-emitted with a blocked re-completion) — the Sync modal can correct");}
        else if(_any.length){
          var _orig=[];if(_arch.paid.xp)_orig.push("+"+_arch.paid.xp+" XP");if(_arch.paid.gold)_orig.push("+"+_arch.paid.gold+" gp");
          console.warn("[quest] blocked re-creation of '"+qTitle+"' arrived with rewards ("+_any.join(", ")+"; original close paid "+(_orig.join(", ")||"nothing")+") — possible re-pay with different amounts");
          if(typeof showToast==="function")showToast("⚠ "+qTitle+": "+_any.join(", ")+" arrived with a blocked re-completion (original close paid "+(_orig.join(", ")||"nothing")+") — check the sheet; Sync can correct");}}
      continue;}}
  if(qIdx>=0){worldState.questLog[qIdx].lastTouch=R.turn;delete worldState.questLog[qIdx].staleNudged;
    /* #259: the reopen guard's TEETH. The guard blocks re-CREATION only; once a permitted |offered
       re-created the row, a second tag in the SAME response hit the ordinary upsert and flipped it
       live — a two-tag [QUEST:x|offered][QUEST:x|active] pair defeated the player gate in one
       response (Fable f17, verifier-confirmed). Same-response activation of a re-offered dropped
       title is definitionally not player consent; the next response's |active stays legal. */
    if(qStat==="active"&&worldState.questLog[qIdx].reofferedTurn===R.turn){
      if(typeof console!=="undefined")console.warn("[quest] [QUEST:"+qTitle+"|active] refused — this title was re-offered THIS response after the player dropped it; activation needs the player's accept (a later response) (#259)");
      R.muts.push("⚠ Quest '"+qTitle+"' re-offered just now — activation waits for the player");
      continue;}}/* #191ⓑ: any QUEST tag naming a live row is a touch — resets the staleness clock and re-arms the review latch (re-emitting [QUEST:title|active] is the documented zero-vocabulary ack) */
  if(qIdx<0){var _qNew={title:qTitle,status:qStat,desc:qDesc,objectives:[],started:R.turn,lastTouch:R.turn};/* #231 the arc wall: the bornArc stamp is DEFERRED to the post-handler seam (#265① — QUEST runs before ARC_COMPLETE in table order, so an inline stamp bound a same-response newborn to the DYING arc and the wall archived it at birth; the seam stamps after every arc transition settles, and the wall's own sweep runs before the seam, so an unstamped newborn is immune to THIS response's sweep by construction). EMERGENT quests only; ambiguity stays unstamped — immune, never guessed. */if(typeof questIsEmergent==="function"&&questIsEmergent(qTitle)){if(!R._newQuests)R._newQuests=[];R._newQuests.push(qTitle);}if(_qReoffer){_qNew.reofferedTurn=R.turn;/* #259 */
    /* #265③ (Fable f11): a guard-permitted return of an archived abandoned/declined thread starts
       from its OWN checklist, not a blank one — the archive held the objectives (done-flags and
       all) while the live row restarted from narrative memory, the exact drift class the
       authoritative quest block exists to prevent. The GM's fresh desc wins; the archived desc
       only fills a blank. */
    if(_arch&&(_arch.objectives||[]).length){var _rhi;_qNew.objectives=[];for(_rhi=0;_rhi<_arch.objectives.length;_rhi++){var _rho=_arch.objectives[_rhi],_rhc={text:_rho.text,done:!!_rho.done};if(_rho.optional)_rhc.optional=true;_qNew.objectives.push(_rhc);}R.muts.push("Quest '"+qTitle+"' returns with its checklist ("+_qNew.objectives.length+" objectives restored)");}
    if(!qDesc&&_arch&&_arch.desc)_qNew.desc=_arch.desc;}
  worldState.questLog.push(_qNew);if(qStat==="offered"){if(typeof Sound!=="undefined")Sound.play("click_glass");/* TODO #7: side-effect only — never touches parse/mutation flow. BEFORE the toast so it claims the playIfQuiet window and the toast-level poke steps aside */if(typeof showToast==="function")showToast("⚑ Quest opportunity: "+qTitle);R.muts.push("Quest offered: "+qTitle);}else R.muts.push("Quest: "+qTitle+" ("+qStat+")");}else{var qq=worldState.questLog[qIdx];qq.status=qStat;if(qDesc)qq.desc=qDesc;R.muts.push("Quest "+qTitle+": "+qStat);}
  if(qStat==="completed"||qStat==="failed"){
    // UA42: player-visible closure — the toast names the same-response rewards so a close never
    // again passes in silence (two Playtest-2 completions had ZERO feedback). Positive gold only:
    // a same-response deduction is not a reward.
    var _rw=[],_ms=(qStat==="completed")?awardMilestoneXp("quest",qTitle,R):0;if(_ms)_rw.push("+"+_ms+" XP");/* #302: the engine pays the completion, level-scaled, before the toast names it */
    var _rx=text.match(/\[XP:\s*\+?(\d+)/);if(_rx)_rw.push("+"+Math.min(parseInt(_rx[1]),(typeof GM_XP_CAP_PER_LEVEL==="number"?GM_XP_CAP_PER_LEVEL:10)*Math.max(1,worldState.character.level||1))+" XP (GM)");
    var _rg=text.match(/\[GOLD:\s*\+?(\d+)/);if(_rg)_rw.push("+"+_rg[1]+" gp");/* \+?(\d+) cannot match a minus — deductions never read as rewards */
    var _ri=(text.match(/\[ITEM_GAINED:[^\]]+\]/g)||[]).length;if(_ri)_rw.push(_ri+" item"+(_ri>1?"s":""));
    if(typeof showToast==="function")showToast((qStat==="completed"?"✓ Quest completed: ":"✗ Quest failed: ")+qTitle+(_rw.length?" — "+_rw.join(", "):""));
    archiveQuest(qTitle,qStat);
    // P3-F2: record what this close paid (reusing the UA42 parse above) so the reopen guard
    // can recognize a reward re-emission later. Case-insensitive key scan mirrors the guard's.
    if(_rx||_rg){var _pk=Object.keys(memory.quests||{}),_pi;for(_pi=0;_pi<_pk.length;_pi++){
      if(_pk[_pi].toLowerCase()===qTitle.toLowerCase()){memory.quests[_pk[_pi]].paid={xp:_rx?parseInt(_rx[1]):0,gold:_rg?parseInt(_rg[1]):0};break;}}}}}}},
{t:"QUEST_STEP",apply:function(text,R){var qsteps=text.match(/\[QUEST_STEP:([^|\]]+)\|([^|\]]+)\|?([^\]]*)\]/g)||[];var qsi;for(qsi=0;qsi<qsteps.length;qsi++){var qsp=qsteps[qsi].match(/\[QUEST_STEP:([^|\]]+)\|([^|\]]+)\|?([^\]]*)\]/);if(!qsp)continue;var qsTitle=qsp[1].trim(),qsObj=qsp[2].trim();/* #205b: the tail is a token list — done vocab and an optional/required flag may ride the third
   and fourth fields in either order ([...|optional], [...|true|optional], [...|false|required]).
   A flagless re-emission leaves optionality alone (checking a box must not strip the flag). */
   var qsToks=(qsp[3]||"").split("|"),qsDone=false,qsOpt=null,qti;for(qti=0;qti<qsToks.length;qti++){var qtv=qsToks[qti].trim();if(/^(true|done|1|yes|x)$/i.test(qtv))qsDone=true;else if(/^optional$/i.test(qtv))qsOpt=true;else if(/^required$/i.test(qtv))qsOpt=false;}var qsq=null,qk;for(qk=0;qk<worldState.questLog.length;qk++){if(worldState.questLog[qk].title.toLowerCase()===qsTitle.toLowerCase()){qsq=worldState.questLog[qk];break;}}if(!qsq){var _qsArch=(memory&&memory.quests)?memory.quests[qsTitle]:null;if(!_qsArch&&memory&&memory.quests){var _qsk;for(_qsk in memory.quests){if(_qsk.toLowerCase()===qsTitle.toLowerCase()){_qsArch=memory.quests[_qsk];break;}}}
   if(_qsArch){if(typeof console!=="undefined")console.warn("[quest] QUEST_STEP on archived quest '"+qsTitle+"' ("+_qsArch.status+") — objective '"+qsObj+"' not recorded; closed quests do not gain objectives (#265②)");R.muts.push("⚠ '"+qsTitle+"' is already "+_qsArch.status+" — objective not recorded");}
   else{if(typeof console!=="undefined")console.warn("[quest] QUEST_STEP names no known quest: '"+qsTitle+"' — objective '"+qsObj+"' dropped (mis-title? the ACTIVE block's titles are authoritative) (#265②)");R.muts.push("⚠ Objective dropped — no quest titled '"+qsTitle+"'");}
   continue;}/* #265② (Fable f52): the silent fall-through starved the checklist the completion machinery reads; the adjacent offered-skip below stays a SILENT deliberate gate (pinned, v1.144) */qsq.lastTouch=R.turn;delete qsq.staleNudged;/* #191ⓑ: objective activity is a touch */if(qsq.status==="offered")continue;if(!qsq.objectives)qsq.objectives=[];var ofound=false,oj2;for(oj2=0;oj2<qsq.objectives.length;oj2++){if(qsq.objectives[oj2].text.toLowerCase()===qsObj.toLowerCase()){qsq.objectives[oj2].done=qsDone;if(qsOpt===true)qsq.objectives[oj2].optional=true;else if(qsOpt===false)delete qsq.objectives[oj2].optional;ofound=true;break;}}if(!ofound){var qsNew={text:qsObj,done:qsDone};if(qsOpt===true)qsNew.optional=true;qsq.objectives.push(qsNew);}R.muts.push(qsTitle+(qsDone?" ✓ ":" + ")+qsObj+(qsOpt===true?" (optional)":""));}}},
// UA26: multi-match g-loop (legacy matched only the FIRST tag — the H2 class: 18/150 Haiku turns
// emitted a second COMBAT_START during a fight and it was silently lost). No combat → start the
// encounter; combat active → ADD a foe; duplicate living name → re-emission, ignored + warn;
// 9th foe → runaway-model guard (cap 8, ratified decision 4).
{t:"COMBAT_START",apply:function(text,R){
  var csTags=text.match(/\[COMBAT_START:([^|\]]+)\|(\d+)\|(\d+)\|([+-]?\d+)\|([^|]+)\|([^\]]+)\]/g)||[];var csi;
  for(csi=0;csi<csTags.length;csi++){
    var cs2=csTags[csi].match(/\[COMBAT_START:([^|\]]+)\|(\d+)\|(\d+)\|([+-]?\d+)\|([^|]+)\|([^\]]+)\]/);if(!cs2)continue;
    var foe={name:cs2[1].trim(),hp:parseInt(cs2[2]),maxHp:parseInt(cs2[2]),ac:parseInt(cs2[3]),atk:parseInt(cs2[4]),dmg:cs2[5].trim(),morale:cs2[6].trim()};
    /* #266 (Fable f30): a living PARTY MEMBER entering the ENEMY tracker is the moment ordinary
       damage tags become able to stamp a companion durably dead against a healthy sheet — and it
       was silent. Warn-only by design: a betrayal scene is legal fiction; the anomaly just may
       not pass unremarked. */
    var _pmFoe=(typeof findCompanionChar==="function")?findCompanionChar(foe.name):null;
    if(_pmFoe||(worldState.character&&worldState.character.name&&foe.name.toLowerCase()===worldState.character.name.toLowerCase())){
      if(typeof console!=="undefined")console.warn("[combat] COMBAT_START names a living PARTY MEMBER: '"+foe.name+"' is entering the ENEMY tracker — damage tags can now kill them on the roster (betrayal scene, or ally/enemy confusion?) (#266)");
      R.muts.push("⚠ "+foe.name+" — a party member — has entered the ENEMY tracker");
      if(typeof showToast==="function")showToast("⚠ "+foe.name+" (party member) entered the enemy tracker");
    }
    if(!worldState.combat){worldState.combat={round:1,engaged:null,foes:[foe],node:(typeof currentNodeKey==="function"?locResolve(currentNodeKey()):null)};/* #149: where the fight STARTED — the aftermath nudge anchors here, so a close+move response can never file battlefield damage onto the destination (the mis-anchor hazard); #156B: anchored canonical */R.muts.push("Combat: "+foe.name);continue;}
    var dup=null,di,fl=worldState.combat.foes;
    for(di=0;di<fl.length;di++){if(fl[di].name.toLowerCase()===foe.name.toLowerCase()&&!fl[di].down&&fl[di].hp>0){dup=fl[di];break;}}
    if(dup){console.warn("[combat] duplicate COMBAT_START for living foe '"+foe.name+"' ignored (re-emission)");continue;}
    if(fl.length>=8){console.warn("[combat] foe cap (8) reached — COMBAT_START '"+foe.name+"' ignored (runaway-model guard)");continue;}
    fl.push(foe);R.muts.push("Combat +foe: "+foe.name);
  }}},
// COMBAT_STATS / IMMUNE / RESIST / VULN bind by POSITIONAL ADJACENCY — each occurrence goes to
// the foe whose COMBAT_START precedes it in the text (P3-F1 fix, v1.272; see combatAttrFoe for
// the no-preceding-start fallback policy). g-loops: every occurrence lands (MULTI_ENEMY_COMBAT §3).
{t:"COMBAT_STATS",nc:1,apply:function(text,R){
  if(!worldState.combat||!worldState.combat.foes.length)return;
  var starts=R.combatStarts();
  var re=/\[COMBAT_STATS:STR:(\d+)\|DEX:(\d+)\|CON:(\d+)\|INT:(\d+)\|WIS:(\d+)\|CHA:(\d+)\|CR:([0-9.\/]+)\]/g,m;
  while((m=re.exec(text))){var foe=combatAttrFoe(starts,m.index);if(!foe)continue;
    foe.stats={STR:+m[1],DEX:+m[2],CON:+m[3],INT:+m[4],WIS:+m[5],CHA:+m[6],CR:m[7]};}}},
// The IMMUNE/RESIST/VULN triplet is factory-generated (audit #8, see combatAttrEntry above) —
// same entries, same positions, same "COMBAT_IMMUNE"/"COMBAT_RESIST"/"COMBAT_VULN" t-names
// (coverage guards + strip registry key on them).
combatAttrEntry("COMBAT_IMMUNE","immune"),
combatAttrEntry("COMBAT_RESIST","resist"),
combatAttrEntry("COMBAT_VULN","vuln"),
// UA26: g-loop + named addressing (legacy matched only the first bare tag; the 12 named
// [ENEMY_HP:Kresh|-6] forms in the Haiku window were silently DROPPED). Bare form routes to the
// single living foe, else the ENGAGED foe, else first-living + warn — the mutation always lands
// (narrated damage must not vanish; ratified decision 2). Any damage sets combat.engaged.
{t:"ENEMY_HP",nc:1,apply:function(text,R){
  var eTags=text.match(/\[ENEMY_HP:[^\]]+\]/g)||[];var ei;
  for(ei=0;ei<eTags.length;ei++){
    if(!worldState.combat)break;
    var named=eTags[ei].match(/\[ENEMY_HP:([^|\]]+)\|\s*([+-]?\d+)[^\]]*\]/);
    var bare=named?null:eTags[ei].match(/\[ENEMY_HP:\s*([+-]?\d+)[^\]]*\]/);
    var foe=null,dv=0;
    if(named){dv=parseInt(named[2]);foe=combatFoeByName(named[1]);
      if(!foe){console.warn("[combat] named ENEMY_HP target not found: "+named[1].trim()+" — no mutation");continue;}}
    else if(bare){dv=parseInt(bare[1]);
      var living=combatLivingFoes();if(!living.length)continue;
      if(living.length===1)foe=living[0];
      else{var eng=worldState.combat.engaged?combatFoeByName(worldState.combat.engaged):null;
        if(eng&&!eng.down&&eng.hp>0)foe=eng;
        else{foe=living[0];console.warn("[combat] ambiguous bare ENEMY_HP with "+living.length+" foes up — routed to "+foe.name+"; use [ENEMY_HP:Name|-X]");}}}
    else continue;
    foe.hp=Math.max(0,foe.hp+dv);
    worldState.combat.engaged=foe.name;
    if(foe.hp<=0){if(typeof plotArmor==="function"&&plotArmor(foe.name)){foe.hp=1;foe.down="fled";plotArmorRefuse(foe.name,R,"combat");R.muts.push(foe.name+" breaks and flees");}else foe.down="slain";worldState.combat.engaged=null;}/* #319 */
  }}},
// v1.463 (t1188 trafficker ambush): the GM's only way to kill a foe was a damage NUMBER, so a
// narrated stealth execution emitted honest dice damage (-8 vs 18 hp) and the foe stayed up —
// prose said one living, tracker said four. ENEMY_SLAIN is the missing OUTCOME word: the GM
// asserts the death, the engine does the arithmetic (the clock's no-arithmetic philosophy;
// ENEMY_SURRENDERS' outcome-tag shape). NAMED ONLY by design — a malformed bare tag must never
// wipe an encounter, so bare warns + no-ops (it IS stripped, via TAG_STRIP_BARE, so it can't
// leak to the story either). Placed before COMBAT_END so an all-slain response auto-closes.
{t:"ENEMY_SLAIN",nc:1,apply:function(text,R){
  if(!worldState.combat)return;
  var kT=text.match(/\[ENEMY_SLAIN:([^\]]+)\]/g)||[];var ki;
  for(ki=0;ki<kT.length;ki++){var km=kT[ki].match(/\[ENEMY_SLAIN:([^\]]+)\]/);if(!km)continue;
    var kfoe=combatFoeByName(km[1]);
    if(!kfoe){console.warn("[combat] ENEMY_SLAIN target not found: "+km[1].trim()+" — no mutation");continue;}
    if(kfoe.down||kfoe.hp<=0)continue;/* already down — re-emission, quiet no-op */
    if(typeof plotArmor==="function"&&plotArmor(kfoe.name)){kfoe.hp=Math.max(1,kfoe.hp);kfoe.down="fled";plotArmorRefuse(kfoe.name,R,"combat");R.muts.push(kfoe.name+" breaks and flees");}/* #319: a load-bearing foe leaves the fight alive */
    else{kfoe.hp=0;kfoe.down="slain";R.muts.push(kfoe.name+" slain");}
    if(worldState.combat.engaged===kfoe.name)worldState.combat.engaged=null;}
  if(/\[ENEMY_SLAIN\]/.test(text))console.warn("[combat] bare ENEMY_SLAIN unsupported — name the foe ([ENEMY_SLAIN:Name]); no mutation");}},
// UA2 resolved as IMPLEMENT (user call 2026-07-10): the former phantom becomes a real beat.
// Sits between ENEMY_HP and COMBAT_ROUND so COMBAT_END's all-down close sees surrender state
// emitted in the same response. Named form yields one foe; bare form yields all living.
{t:"ENEMY_SURRENDERS",nc:1,apply:function(text,R){
  if(!worldState.combat)return;
  var nT=text.match(/\[ENEMY_SURRENDERS:([^\]]+)\]/g)||[];var si;
  for(si=0;si<nT.length;si++){var sm=nT[si].match(/\[ENEMY_SURRENDERS:([^\]]+)\]/);if(!sm)continue;
    var sfoe=combatFoeByName(sm[1]);
    if(!sfoe){console.warn("[combat] ENEMY_SURRENDERS target not found: "+sm[1].trim());continue;}
    if(!sfoe.down&&sfoe.hp>0){sfoe.down="surrendered";R.muts.push(sfoe.name+" surrenders");
      if(worldState.combat.engaged===sfoe.name)worldState.combat.engaged=null;}}
  if(/\[ENEMY_SURRENDERS\]/.test(text)){var lv=combatLivingFoes(),li;
    for(li=0;li<lv.length;li++){lv[li].down="surrendered";R.muts.push(lv[li].name+" surrenders");}
    worldState.combat.engaged=null;}}},
{t:"COMBAT_ROUND",nc:1,apply:function(text,R){var cr=text.match(/\[COMBAT_ROUND:(\d+)\]/);if(cr&&worldState.combat)worldState.combat.round=parseInt(cr[1]);}},
// Explicit COMBAT_END closes the WHOLE encounter regardless of foe states. Without the tag, the
// single-foe kill safety net generalizes: ALL foes down auto-closes — any surrendered foe among
// them closes as "surrender" (≡ truce), otherwise victory (MULTI_ENEMY_COMBAT §2).
{t:"COMBAT_END",nc:1,apply:function(text,R){
  var ce=text.match(/\[COMBAT_END:([^\]]+)\]/);
  if(ce&&!worldState.combat){
    /* #225 (field t2231, the Bronze Bell Warden): a COMBAT_END over a null tracker used to push
       "Combat: victory" into muts and arm the #149 aftermath nudge — a false outcome recorded
       over a fight that was never open (the ghost close at the end of four orphaned turns). The
       tag is absorbed (stripped like everything else); the UA27 warn + the #225 orphan channel
       below carry the loudness. Same-response rewards ([XP:] beside the close) still land —
       they are their own handlers. */
    return;}
  if(ce){
    /* #214① (field 2026-08-22, the Grey-Hided Skulker): the outcome word is a STRUCTURED
       assertion that the fight is over. A victory-shaped close that leaves foes standing in
       the tracker is the narration/stat desync — the prose said "the last of them goes down"
       while Skulker C sat at 8/32. Resolve the survivors HERE, before propagateSlainFoes, so
       a rostered foe’s death still routes through the same scene-evidence gate as any other
       named death; a generic rolled foe simply zeroes. Non-victory outcomes resolve NOTHING —
       fled/truce/disengaged/defeat mean the foe stopped fighting, not that it died. */
    /* #254 (JP0-6, Fable f26; joint review 2026-08-27) — WHICH foes is this close about?
       Handlers run in TABLE order, so COMBAT_START has ALREADY appended any same-response
       newcomer to the DYING encounter before this handler runs; handler order therefore cannot
       answer the question, and #214① below read the whole living list. The answer is POSITIONAL —
       the identical mechanism the COMBAT_STATS/IMMUNE/RESIST/VULN tags already bind by
       (combatStartPositions → combatAttrFoe): a foe whose [COMBAT_START:] sits at a GREATER
       string index than the [COMBAT_END:] arrived after the fight closed and is not part of it.
       "You cut down the last bandit — suddenly the bodyguard draws steel" used to stamp the
       bodyguard slain, and on a save whose sceneRefs ledger was never activated w2DeathAuthorized
       authorizes unconditionally — so a rostered character died with no blow landed. Those foes
       are exempt from the victory resolution AND they CARRY THE TRACKER below: the loss of the
       fresh fight used to be unconditional, happening even when the death gate refused.
       HONEST LIMIT (f26 verifier): a newcomer whose COMBAT_START textually PRECEDES the close is
       NOT protected — that order is ambiguous with the legitimate start-slay-close emission.
       Known narrow gap: a duplicate COMBAT_START after the close naming an ALREADY-living foe
       exempts that foe; the emission is already anomalous (the dup guard warns) and the outcome
       is the conservative one — no invented death. */
    var _ceKeep=[],_ceRest=[];
    if(worldState.combat){
      var _ceIdx=text.indexOf(ce[0]),_ceStarts=R.combatStarts(),_ceAfter={},_cq;
      for(_cq=0;_cq<_ceStarts.length;_cq++){if(_ceStarts[_cq].idx>_ceIdx)_ceAfter[String(_ceStarts[_cq].name||"").toLowerCase()]=1;}
      var _ceStanding=combatLivingFoes(),_cs2;
      for(_cs2=0;_cs2<_ceStanding.length;_cs2++){
        if(_ceAfter[String(_ceStanding[_cs2].name||"").toLowerCase()])_ceKeep.push(_ceStanding[_cs2]);
        else _ceRest.push(_ceStanding[_cs2]);
      }
    }
    /* #268 (Fable f27): recognition is DEFEAT-EXCLUSION FIRST, victory-markers-ANYWHERE second.
       The old anchored /^(victor|won|...)/ missed every decorated form — "pyrrhic victory",
       "decisive victory", "the battle is won" — silently reproducing the pre-#214 discard. The
       exclusion runs first so a mixed outcome ("defeat — the warden kills the party") can never
       read as a win off its fatal verb; a genuinely unrecognized word over LIVING foes is LOUD
       (the else-branch below) instead of a silent discard — it can under-resolve, never falsely kill. */
    var _ceOut=ce[1].trim();
    /* Queue entry 29 probe 4 (2026-09-03): with NO fight open before this response, COMBAT_START (table order)
       has already minted the tracker by the time this handler runs, so the #225 null-tracker absorb above
       cannot fire and "Combat: victory" was recorded over a fight that never was. If EVERY foe in the tracker
       started after the close, the close refers to nothing: absorb it — no outcome line, no milestone, no
       aftermath arm — and let the fresh encounter carry exactly as #254 intends. */
    var _ceGhost=!!(worldState.combat&&!_ceRest.length&&_ceKeep.length&&_ceKeep.length===worldState.combat.foes.length);
    if(_ceGhost){if(typeof console!=="undefined")console.warn("[combat] COMBAT_END:"+_ceOut+" before any fight — every foe in the tracker was introduced after the close; absorbed, the new encounter carries (#225/#254)");R.muts.push("\u26a0 COMBAT_END before any fight \u2014 absorbed; the encounter that opened this response carries on");}
    var _ceDefeatLed=/(defeat|\blost\b|\bloss\b|the party (falls|fell|dies|died|is slain|was slain|is wiped|breaks)|you (die|died|fall|fell|are slain|were slain)|tpk|fled|flee|escape|retreat|withdraw|disengag|truce|parley|stand-?off|spared|surrender|captur)/i.test(_ceOut);
    var _ceVictory=!_ceDefeatLed&&/(victor|triumph|\bw[oi]n\b|\bwins\b|rout|slain|slaughter|kill|\bdead\b|destroy|crush|annihilat|vanquish|put down)/i.test(_ceOut);
    if(worldState.combat&&!_ceVictory&&!_ceDefeatLed&&_ceRest.length){
      /* the unrecognized-outcome fork: foes are DISCARDED (pre-#214 semantics, never falsely
         killed) but no longer silently — both channels hear it, the recovery vocabulary taught. */
      var _ceUn=[],_cu;for(_cu=0;_cu<_ceRest.length;_cu++)_ceUn.push(_ceRest[_cu].name);
      if(typeof console!=="undefined")console.warn("[combat] COMBAT_END outcome '"+_ceOut+"' not recognized as victory or defeat — "+_ceUn.join(", ")+" discarded UNresolved (if they died, re-assert with [ENEMY_SLAIN:name] before the close) (#268)");
      R.muts.push("⚠ outcome '"+_ceOut+"' not recognized — "+_ceUn.join(", ")+" left the fight unresolved (not slain)");
      if(typeof showToast==="function")showToast("⚠ Combat closed on an unrecognized outcome ('"+_ceOut+"') with "+_ceUn.length+" foe(s) unresolved");
    }
    if(worldState.combat&&_ceVictory){
      var _ceLive=_ceRest,_cl;
      for(_cl=0;_cl<_ceLive.length;_cl++){_ceLive[_cl].hp=0;_ceLive[_cl].down="slain";
        R.muts.push(_ceLive[_cl].name+" slain (still standing at victory — resolved to the narration)");}
      if(_ceLive.length){
        if(typeof console!=="undefined")console.warn("[combat] COMBAT_END:"+ce[1].trim()+" closed with "+_ceLive.length+" foe(s) still standing \u2014 resolved as slain; the narration outranks an untagged hp bar (#214)");
        if(typeof showToast==="function")showToast("\u2694 "+(_ceLive.length===1?_ceLive[0].name+" was":_ceLive.length+" foes were")+" still standing at victory \u2014 resolved as slain");
      }
    }
    if(worldState.combat&&_ceVictory&&!_ceGhost){var _bf=combatBossFoes();if(_bf.length)awardMilestoneXp("boss",_bf.map(function(f){return f.name;}).join(", "),R);}/* #302: one boss payday per victory close, however many bosses fell */
    if(!_ceGhost){propagateSlainFoes(R);/* B3: stamp registered-NPC kills BEFORE the tracker vanishes */if(!/\[LOCATION_STATE:/i.test(text))worldState.pendingLocState={node:(worldState.combat&&worldState.combat.node)||(typeof currentNodeKey==="function"?locResolve(currentNodeKey()):null),turn:worldState.turn};/* #149: arm the aftermath nudge at the fight's OWN node; a response that already filed a [LOCATION_STATE:] used the channel itself */
    R.muts.push("Combat: "+ce[1].trim());}
    if(_ceKeep.length){
      /* #254: the closed fight is over and its corpses go with it; the post-close arrivals become
         a NEW encounter at the node the party stands on now. The #149 aftermath anchor above
         still points at the OLD fight's node — that is deliberate, the damage happened there. */
      var _ceNm=[],_cn;for(_cn=0;_cn<_ceKeep.length;_cn++)_ceNm.push(_ceKeep[_cn].name);
      worldState.combat={round:1,engaged:null,foes:_ceKeep,node:(typeof currentNodeKey==="function"?locResolve(currentNodeKey()):null)};
      R.muts.push("Combat continues: "+_ceNm.join(", ")+" (entered after the close — not part of it)");
      if(typeof console!=="undefined")console.warn("[combat] COMBAT_END:"+ce[1].trim()+" closed the old fight, but "+_ceNm.join(", ")+" entered AFTER the close tag — exempt from its resolution and carried into a new encounter (#254)");
    }else worldState.combat=null;
    return;}
  if(!worldState.combat)return;
  var f=worldState.combat.foes,i,anyUp=false,surr=false,names=[];
  for(i=0;i<f.length;i++){if(!f[i].down&&f[i].hp>0){anyUp=true;break;}
    if(f[i].down==="surrendered")surr=true;names.push(f[i].name);}
  if(anyUp||!f.length)return;
  propagateSlainFoes(R);/* B3: auto-close path — same stamp */
  if(!/\[LOCATION_STATE:/i.test(text))worldState.pendingLocState={node:(worldState.combat&&worldState.combat.node)||(typeof currentNodeKey==="function"?locResolve(currentNodeKey()):null),turn:worldState.turn};/* #149: auto-close arms the same aftermath nudge; #156B: canonical anchor */
  worldState.combat=null;
  R.muts.push(surr?"Combat: surrender ("+names.join(", ")+")":"Combat: victory ("+names.join(", ")+")");}},
{t:"ABILITY_GAINED",apply:function(text,R){var abs=text.match(/\[ABILITY_GAINED:([^|\]]+)\|([^\]]+)\]/g)||[];var abi;for(abi=0;abi<abs.length;abi++){var abp=abs[abi].match(/\[ABILITY_GAINED:([^|\]]+)\|([^\]]+)\]/);if(!abp)continue;if(!worldState.character.abilities)worldState.character.abilities=[];var already=false,abj;for(abj=0;abj<worldState.character.abilities.length;abj++){if(worldState.character.abilities[abj].nm===abp[1]){already=true;break;}}if(!already){worldState.character.abilities.push({nm:abp[1],ds:abp[2],gained:R.turn});R.muts.push("Ability: "+abp[1]);}}}},
{t:"ALIGNMENT",apply:function(text,R){var alms=text.match(/\[ALIGNMENT:(law|good)([+-]\d+)\]/gi)||[];var ali;for(ali=0;ali<alms.length;ali++){var ap=alms[ali].match(/\[ALIGNMENT:(law|good)([+-]\d+)\]/i);if(ap){if(!worldState.character.alignLaw)worldState.character.alignLaw=0;if(!worldState.character.alignGood)worldState.character.alignGood=0;if(ap[1].toLowerCase()==="law")worldState.character.alignLaw=Math.max(-3,Math.min(3,worldState.character.alignLaw+parseInt(ap[2])));else worldState.character.alignGood=Math.max(-3,Math.min(3,worldState.character.alignGood+parseInt(ap[2])));var newAl=alignLabel(worldState.character.alignLaw,worldState.character.alignGood);if(newAl!==worldState.character.actualAlignment){R.muts.push("Align: "+newAl);worldState.character.actualAlignment=newAl;}}}}},
{t:"SPELL_USED",apply:function(text,R){var spellUsed=text.match(/\[SPELL_USED:([^\]]+)\]/g)||[];var sui;for(sui=0;sui<spellUsed.length;sui++){var sup=spellUsed[sui].match(/\[SPELL_USED:([^\]]+)\]/);if(sup&&worldState.character.spells){var spNm=sup[1].toLowerCase().trim(),spj,spHit=false;for(spj=0;spj<worldState.character.spells.length;spj++){var sp=worldState.character.spells[spj];if(sp.lvl===0)continue;
var spBase=sp.nm.replace(/\s*\(.*\)/,"").toLowerCase().trim();if(spBase===spNm||sp.nm.toLowerCase()===spNm){manaPayCast(worldState.character,sp,"",R);spHit=true;break;}}if(!spHit&&typeof console!=="undefined")console.warn("[tags] SPELL_USED: '"+sup[1].trim()+"' is not on the player's sheet — no cast booked (#136③)");}}}},
// UA25: the companion twin of SPELL_USED — inserted HERE (not in the companion cluster) so a
// same-response cast-then-rest resolves rest-last for companions exactly as it does for the
// player (SPELL_USED runs before REST in table order). Misses warn: a companion cast the
// engine can't book is the free-casting drift this tag exists to close (no-silent-failures).
{t:"COMPANION_SPELL_USED",apply:function(text,R){var csuTags=text.match(/\[COMPANION_SPELL_USED:([^|\]]+)\|([^\]]+)\]/g)||[];var csui;
  for(csui=0;csui<csuTags.length;csui++){var csum=csuTags[csui].match(/\[COMPANION_SPELL_USED:([^|\]]+)\|([^\]]+)\]/);if(!csum)continue;
  var csuCs=findCompanionChar(csum[1]);
  if(!csuCs||!csuCs.spells){console.warn("[tags] COMPANION_SPELL_USED: no party member matches '"+csum[1].trim()+"' — cast not booked");continue;}
  var csuNm=csum[2].toLowerCase().trim(),csuj,csuHit=false;
  for(csuj=0;csuj<csuCs.spells.length;csuj++){var csp=csuCs.spells[csuj];
    var cspBase=csp.nm.replace(/\s*\(.*\)/,"").toLowerCase().trim();
    if(cspBase===csuNm||csp.nm.toLowerCase()===csuNm){csuHit=true;
      if(csp.lvl===0)break;/* cantrips never expend — same rule as the player; matched, so no warn */
      manaPayCast(csuCs,csp,csum[1].trim()+" ",R);break;}}/* #110: same payment routine, the COMPANION's own pool */
  if(!csuHit)console.warn("[tags] COMPANION_SPELL_USED: "+csum[1].trim()+" knows no spell matching '"+csum[2].trim()+"' — cast not booked");}}},
/* #138: EXTERNAL mana effects (a leech's drain, a mana burn, a restorative draught) — the GM
   asserts the effect, the engine does ALL arithmetic, clamped 0..manaMax. Deliberately NOT for
   cast costs: manaPayCast above owns those (doc-forbidden pairing — a [MANA:] beside the same
   cast double-charges). A manaless target is a LOUD no-op — draining a Warrior is a GM misfire
   worth surfacing, never a minted pool. Placed directly after the cast twins so a same-response
   cast-then-drain resolves in emission order. */
{t:"MANA",apply:function(text,R){var mnTags=text.match(/\[MANA:\s*([+-]?\d+)(?:\|([^\]]*))?\]/g)||[];var mni;
  for(mni=0;mni<mnTags.length;mni++){var mnm=mnTags[mni].match(/\[MANA:\s*([+-]?\d+)(?:\|([^\]]*))?\]/);if(!mnm)continue;
  var mnC=worldState.character,mnMax=manaMax(mnC);
  if(!mnMax){console.warn("[tags] MANA: "+(mnC.name||"the player")+" has no mana pool — external mana effect ignored");continue;}
  var mnD=parseInt(mnm[1],10)||0;
  mnC.mana=Math.max(0,Math.min(mnMax,manaCur(mnC)+mnD));
  R.muts.push("Mana "+(mnD>=0?"+":"")+mnD+(mnm[2]?" ("+mnm[2].trim()+")":"")+" → "+mnC.mana+"/"+mnMax);}}},
{t:"COMPANION_MANA",apply:function(text,R){var cmnTags=text.match(/\[COMPANION_MANA:([^|\]]+)\|\s*([+-]?\d+)(?:\|([^\]]*))?\]/g)||[];var cmni;
  for(cmni=0;cmni<cmnTags.length;cmni++){var cmnm=cmnTags[cmni].match(/\[COMPANION_MANA:([^|\]]+)\|\s*([+-]?\d+)(?:\|([^\]]*))?\]/);if(!cmnm)continue;
  var cmnCs=findCompanionChar(cmnm[1]);
  if(!cmnCs){console.warn("[tags] COMPANION_MANA: no party member matches '"+cmnm[1].trim()+"' — effect not booked");continue;}
  var cmnMax=manaMax(cmnCs);
  if(!cmnMax){console.warn("[tags] COMPANION_MANA: "+cmnm[1].trim()+" has no mana pool — external mana effect ignored");continue;}
  var cmnD=parseInt(cmnm[2],10)||0;
  cmnCs.mana=Math.max(0,Math.min(cmnMax,manaCur(cmnCs)+cmnD));
  R.muts.push(cmnm[1].trim()+": mana "+(cmnD>=0?"+":"")+cmnD+(cmnm[3]?" ("+cmnm[3].trim()+")":"")+" → "+cmnCs.mana+"/"+cmnMax);}}},
{t:"SPELL_DEF",apply:function(text,R){var spellDefs=text.match(/\[SPELL_DEF:([^\]]+)\]/g)||[];var sdi;for(sdi=0;sdi<spellDefs.length;sdi++){
  var sdm=spellDefs[sdi].match(/\[SPELL_DEF:([^\]]+)\]/);if(!sdm)continue;
  var sdParts=sdm[1].split("|"),sdName=(sdParts[0]||"").trim();if(!sdName||typeof capBaseName!=="function")continue;
  var sdKey=capBaseName(sdName);if(!worldState.capabilityBible)worldState.capabilityBible={};
  if(worldState.capabilityBible[sdKey]){if(typeof console!=="undefined")console.warn("[tags] SPELL_DEF: '"+sdName+"' already defined — write-once, redefinition ignored (#136③)");continue;}
  /* #253 (JP0-8, Fable f51; owner ruling 2026-08-28): a name the STATIC bible already carries is
     not a correction, it is a permanent SHADOW. capabilityLookup gives the overlay precedence, so
     one hallucinated [SPELL_DEF:Fireball|tier=1|…] rewrote the injected canon, the card, the
     viewer AND the mana price (manaSpellCost→manaMax) forever, behind a muts line that read like
     an ordinary definition. The doc line already forbade it and canonizeCompanionSpellDefs
     (game.js) already refused on-catalog names at its one call site — only the handler disagreed.
     Emergent (off-catalog) spells keep the overlay-wins write-once flow untouched; pre-existing
     shadows are left as written (no migration — historical canon stands). */
  if(typeof capIsBaseCatalog==="function"&&capIsBaseCatalog(sdName)){
    if(typeof console!=="undefined")console.warn("[tags] SPELL_DEF: '"+sdName+"' is already curated in the capability bible — REFUSED, curated canon is not redefinable in play (#253); invent a distinct name for a genuinely new working");
    R.muts.push("⚠ Spell canon NOT redefined: "+sdName+" is already curated — the official entry stands");
    continue;}
  var sdEntry={kind:"spell",tier:0,cost:"at-will",isMagical:true,category:[],range:"",targets:"",duration:"",effect:""},sdp;
  for(sdp=1;sdp<sdParts.length;sdp++){var kv=sdParts[sdp].split("=");if(kv.length<2)continue;var kk=kv[0].trim().toLowerCase(),vv=kv.slice(1).join("=").trim();
    if(kk==="range")sdEntry.range=vv;else if(kk==="targets"||kk==="target")sdEntry.targets=vv;else if(kk==="duration")sdEntry.duration=vv;else if(kk==="effect")sdEntry.effect=vv;else if(kk==="cost")sdEntry.cost=vv;else if(kk==="tier"){var _sdT=parseInt(vv);if(isNaN(_sdT)&&typeof console!=="undefined")console.warn("[tags] SPELL_DEF: unparseable tier '"+vv+"' on "+sdName+" — defaulting to 0 (#136③)");sdEntry.tier=isNaN(_sdT)?0:_sdT;}else if(kk==="save")sdEntry.save=vv;else if(kk==="dice")sdEntry.dice=vv;else if(kk==="category")sdEntry.category=vv.split(",").map(function(x){return x.trim().toLowerCase();}).filter(Boolean);else if(kk==="magical")sdEntry.isMagical=/^\s*(y|t|1|true)/i.test(vv);}
  worldState.capabilityBible[sdKey]=sdEntry;R.muts.push("Spell canon defined: "+sdName);
}}},
/* #81: [ITEM_DEF:] is a PROPOSAL, never a write — the ruled difference from SPELL_DEF's
   write-once-direct. The engine queues it on worldState.pendingItemDefs; the player accepts or
   declines (itemDefAccept/itemDefDecline, helpers.js) and only acceptance writes the overlay
   (model-authored write-once was rejected: the first hallucination becomes permanent canon). */
{t:"ITEM_DEF",apply:function(text,R){var itemDefs=text.match(/\[ITEM_DEF:([^\]]+)\]/g)||[];var idi;for(idi=0;idi<itemDefs.length;idi++){
  var idm=itemDefs[idi].match(/\[ITEM_DEF:([^\]]+)\]/);if(!idm)continue;
  var idParts=idm[1].split("|"),idName=(idParts[0]||"").trim();if(!idName||typeof itemBaseName!=="function")continue;
  var idKey=itemBaseName(idName);if(!idKey)continue;
  if(typeof itemDefOverlayReplaceable==="function"?!itemDefOverlayReplaceable(idKey):(worldState.itemBible&&worldState.itemBible[idKey])){if(typeof console!=="undefined")console.warn("[tags] ITEM_DEF: '"+idName+"' already in the accepted overlay — write-once, redefinition ignored (#81)");continue;}
  if(!worldState.pendingItemDefs)worldState.pendingItemDefs=[];
  var idDup=false,idq;for(idq=0;idq<worldState.pendingItemDefs.length;idq++){if(worldState.pendingItemDefs[idq].key===idKey){idDup=true;break;}}
  if(idDup){if(typeof console!=="undefined")console.warn("[tags] ITEM_DEF: '"+idName+"' already awaiting player confirmation — duplicate proposal dropped (#81)");continue;}
  if(worldState.pendingItemDefs.length>=5){if(typeof console!=="undefined")console.warn("[tags] ITEM_DEF: proposal queue full (5) — '"+idName+"' dropped (runaway-model guard, #81)");continue;}
  var idEntry={category:"tool",effect:"N/A",uses:"N/A",value:"N/A"},idp;
  var ID_CATS={weapon:1,armor:1,consumable:1,tool:1,quest:1,treasure:1,mundane:1};
  /* #298 (playtest v1767): the engine note taught the POSITIONAL form [ITEM_DEF:name|category|effect|uses|value]
     while this parser read only key=value pairs — every positional part was skipped SILENTLY and the player
     was asked to accept an empty "tool / N/A" definition (three were accepted as canon in the run). Both
     grammars are legal now: a part without "=" is read by position (category, effect, uses, value). */
  var idPos=["category","effect","uses","value"],idPosN=0;
  for(idp=1;idp<idParts.length;idp++){var idkv=idParts[idp].split("=");var idk,idv;
    if(idkv.length<2){if(idPosN>=idPos.length){if(typeof console!=="undefined")console.warn("[tags] ITEM_DEF: extra positional field '"+idParts[idp].trim()+"' on '"+idName+"' ignored (#298)");continue;}idk=idPos[idPosN++];idv=idParts[idp].trim();}
    else{idk=idkv[0].trim().toLowerCase();idv=idkv.slice(1).join("=").trim();}
    if(idk==="category"){var idc=idv.toLowerCase();if(ID_CATS[idc])idEntry.category=idc;else if(typeof console!=="undefined")console.warn("[tags] ITEM_DEF: unknown category '"+idv+"' on '"+idName+"' — defaulted to tool (#81)");}
    else if(idk==="effect"||idk==="uses"||idk==="value"){if(idv)idEntry[idk]=idv;}
    else if(typeof console!=="undefined")console.warn("[tags] ITEM_DEF: field '"+idk+"' on '"+idName+"' ignored — instance state never enters a TYPE definition (#81)");}
  worldState.pendingItemDefs.push({key:idKey,name:idName,entry:idEntry,turn:R.turn});
  R.muts.push("Item canon proposed: "+idName+" (awaiting your confirmation)");
}}},
{t:"REST",apply:function(text,R){if(/\[REST:\s*long\b[^\]]*\]/i.test(text)&&typeof restSpells==="function"){var _slept=restSpells(true);/* #89: restSpells owns the dawn roll — one site, both paths (button + tag); #300: it heals to full and, from the tag path, QUEUES the camp (taken at commit, never mid-parse) */R.muts.push("Rest: healed to full, spell slots restored"+(_slept?"; slept until dawn (+"+_slept+"m, "+clockFmt()+")":""));worldState.checkpointDue="rest";}
  else if(/\[REST:\s*short\b[^\]]*\]/i.test(text)&&typeof restShortHeal==="function"){var _sh=restShortHeal();if(_sh)R.muts.push("Short rest: +"+_sh+" HP");}}},
{t:"LORE",apply:function(text,R){var lores=text.match(/\[LORE:([^\]]+)\]/g)||[];for(var li=0;li<lores.length;li++){var lp=lores[li].match(/\[LORE:([^\]]+)\]/);if(lp)fileLore(lp[1]);}}},
{t:"DECISION",apply:function(text,R){var decs=text.match(/\[DECISION:([^\]]+)\]/g)||[];for(var di=0;di<decs.length;di++){var dp=decs[di].match(/\[DECISION:([^\]]+)\]/);if(dp)fileDecision(R.turn,dp[1]);}}},
{t:"FUTURE_EVENT",apply:function(text,R){__tagNearMiss(text,R,"FUTURE_EVENT","^\\[FUTURE_EVENT:[^|\\]]+\\|[^\\]]+\\]$","[FUTURE_EVENT:what|when]");var fes=text.match(/\[FUTURE_EVENT:([^|]+)\|([^\]]+)\]/g)||[];for(var fi=0;fi<fes.length;fi++){var fp=fes[fi].match(/\[FUTURE_EVENT:([^|]+)\|([^\]]+)\]/);if(fp)fileFutureEvent(fp[2],"",fp[1],R.turn);}}},
{t:"FUTURE_EVENT_RESOLVED",apply:function(text,R){var fres=text.match(/\[FUTURE_EVENT_RESOLVED:([^\]]+)\]/g)||[];var fri;for(fri=0;fri<fres.length;fri++){var frp=fres[fri].match(/\[FUTURE_EVENT_RESOLVED:([^\]]+)\]/);if(frp)resolveFutureEvent(frp[1]);}}},
{t:"NPC_NOTE",apply:function(text,R){__tagNearMiss(text,R,"NPC_NOTE","^\\[NPC_NOTE:[^|\\]]+\\|[^\\]]+\\]$","[NPC_NOTE:name|note]");var nns=text.match(/\[NPC_NOTE:([^|\]]+)\|([^\]]+)\]/g)||[];for(var nni=0;nni<nns.length;nni++){var nnp=nns[nni].match(/\[NPC_NOTE:([^|\]]+)\|([^\]]+)\]/);if(nnp)fileNpcEvent(nnp[1],nnp[2],R.turn);}}},
{t:"NPC_FORGET",apply:function(text,R){var forgets=text.match(/\[NPC_FORGET:([^|\]]+)\|([^\]]+)\]/g)||[];var fgi;for(fgi=0;fgi<forgets.length;fgi++){var fgp=forgets[fgi].match(/\[NPC_FORGET:([^|\]]+)\|([^\]]+)\]/);if(!fgp)continue;var fgName=resolveNpcName(fgp[1].trim()),fgWhat=fgp[2].trim().toLowerCase();var fgNpc=memory.npcs[fgName];if(!fgNpc)continue;var fgRem=0;if(fgNpc.knowledge){var fgkb=fgNpc.knowledge.length;fgNpc.knowledge=fgNpc.knowledge.filter(function(k){if(String(k).toLowerCase().indexOf(fgWhat)<0)return true;memArchive().npcForgotten.push({npc:fgName,fact:String(k),turn:worldState.turn,cause:fgp[2].trim()});return false;});fgRem+=fgkb-fgNpc.knowledge.length;}if(fgNpc.events){var fgeb=fgNpc.events.length;fgNpc.events=fgNpc.events.filter(function(e){var _fgN=String(e&&e.note!==undefined?e.note:e);if(_fgN.toLowerCase().indexOf(fgWhat)<0)return true;memArchive().npcForgotten.push({npc:fgName,fact:_fgN,turn:worldState.turn,cause:fgp[2].trim()});return false;});fgRem+=fgeb-fgNpc.events.length;}/* #136④ RULING: Oubliate keeps its BREADTH (everything matching is the spell's contract — narrowing would change a shipped ability); the fix is the tombstone. npcForgotten is never injected anywhere, so the fiction still forgets; the operator can recover. */R.muts.push(fgName+" forgets: "+fgp[2].trim()+(fgRem?" ("+fgRem+")":""));}}},
// #57 leg B: turn-time supersession — commits a reveal THE TURN it lands instead of waiting for
// the next summarize window. knowledge[] ONLY (events are turn-stamped history, true at their
// time — scrubbing history is NPC_FORGET/Oubliate's domain); retired lines ARCHIVE, never vanish
// (the P12 discipline). The new fact records even when nothing matched — the reveal is canon
// whether or not the hedge ever made it to file (a no-match scrub warns for attribution).
{t:"NPC_SUPERSEDE",apply:function(text,R){__tagNearMiss(text,R,"NPC_SUPERSEDE","^\\[NPC_SUPERSEDE:[^|\\]]*\\S[^|\\]]*\\|[^|\\]]*\\S[^|\\]]*\\|[^|\\]]*\\S[^|\\]]*\\]$","[NPC_SUPERSEDE:name|outdated|truth] — three non-blank fields");var sups=text.match(/\[NPC_SUPERSEDE:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var spi;for(spi=0;spi<sups.length;spi++){var spp=sups[spi].match(/\[NPC_SUPERSEDE:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!spp)continue;var spName=resolveNpcName(spp[1].trim()),spOld=spp[2].trim(),spNew=spp[3].trim();if(!spOld||!spNew)continue;
  if(!memory.npcs[spName])memory.npcs[spName]={attitude:"unknown",knowledge:[],events:[],aliases:[]};
  var spNpc=memory.npcs[spName],spLow=spOld.toLowerCase(),spRet=[];
  if(spNpc.knowledge){spNpc.knowledge=spNpc.knowledge.filter(function(k){if(String(k).toLowerCase().indexOf(spLow)>=0){spRet.push(k);return false;}return true;});}
  if(spRet.length){var spA=memArchive(),spj;for(spj=0;spj<spRet.length;spj++)spA.superseded.push({npc:spName,fact:spRet[spj],turn:R.turn,replacedBy:spNew});}
  else if(typeof console!=="undefined")console.warn("[tags] NPC_SUPERSEDE: no on-file fact on "+spName+" matched \""+spOld+"\" — recording the new fact anyway");
  fileNpcKnowledge(spName,spNew,R.turn,true);/* #269①: preferNew supersession mode — and this site's old cap shift went to the VOID (the one knowledge write outside #144A); the helper archives it */
  R.muts.push(spName+": superseded"+(spRet.length?" ("+spRet.length+")":"")+" — "+spNew);}}},
{t:"NPC_PRONOUN",apply:function(text,R){var nprons=text.match(/\[NPC_PRONOUN:([^|\]]+)\|([^\]]+)\]/g)||[];for(var pni=0;pni<nprons.length;pni++){var pnp=nprons[pni].match(/\[NPC_PRONOUN:([^|\]]+)\|([^\]]+)\]/);if(pnp){var pname=resolveNpcName(pnp[1]),ppron=pnp[2],_pnN=wsNpcByName(pname);/* #7: shared lookup */if(_pnN)_pnN.pronouns=ppron;else worldState.npcs.push({name:pname,status:"unknown",rel:"unknown",pronouns:ppron,met:R.turn,partyMember:false,portrait:null,aliases:[]});if(memory.npcs[pname])memory.npcs[pname].pronouns=ppron;else memory.npcs[pname]={attitude:"unknown",knowledge:[],events:[],aliases:[],pronouns:ppron};R.muts.push("Pronouns: "+pname+" ("+ppron+")");}}}},
{t:"NPC_LINK",apply:function(text,R){var npcLinks=text.match(/\[NPC_LINK:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var nli;for(nli=0;nli<npcLinks.length;nli++){var nlp=npcLinks[nli].match(/\[NPC_LINK:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!nlp)continue;var _plName=(worldState.character&&worldState.character.name)||"player";var _plMap=function(n){return /^player$/i.test(n)?_plName:n;};var nlA=resolveNpcName(_plMap(nlp[1].trim())),nlB=resolveNpcName(_plMap(nlp[2].trim())),nlRel=nlp[3].trim();npcLinkUpsert(nlA,nlB,nlRel);R.muts.push("Link: "+nlA+" ↔ "+nlB+" ("+nlRel+")");}}},
{t:"FACTION",apply:function(text,R){var facTags=text.match(/\[FACTION:([^|\]]+)\|([^\]]+)\]/g)||[];var fti;for(fti=0;fti<facTags.length;fti++){var ftp=facTags[fti].match(/\[FACTION:([^|\]]+)\|([^\]]+)\]/);if(!ftp)continue;factionUpsert(ftp[1].trim(),ftp[2].trim());R.muts.push("Faction: "+ftp[1].trim());}}},
{t:"NPC_FACTION",apply:function(text,R){var nfTags=text.match(/\[NPC_FACTION:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var nfti;for(nfti=0;nfti<nfTags.length;nfti++){var nfp=nfTags[nfti].match(/\[NPC_FACTION:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!nfp)continue;npcFactionSet(resolveNpcName(nfp[1].trim()),nfp[2].trim(),nfp[3].trim());R.muts.push(nfp[1].trim()+": "+nfp[2].trim()+" ["+nfp[3].trim()+"]");}}},
{t:"FACTION_REL",apply:function(text,R){var frTags=text.match(/\[FACTION_REL:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var frti;for(frti=0;frti<frTags.length;frti++){var frp2=frTags[frti].match(/\[FACTION_REL:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!frp2)continue;factionLinkUpsert(frp2[1].trim(),frp2[2].trim(),frp2[3].trim());R.muts.push("FactionRel: "+frp2[1].trim()+" ↔ "+frp2[2].trim()+" ("+frp2[3].trim()+")");}}},
{t:"PARTY_MEMBER",apply:function(text,R){var pmTags=text.match(/\[PARTY_MEMBER:([^|\]]+)\|([^\]]+)\]/g)||[];var pmi;for(pmi=0;pmi<pmTags.length;pmi++){var pmp=pmTags[pmi].match(/\[PARTY_MEMBER:([^|\]]+)\|([^\]]+)\]/);if(!pmp)continue;var pmName=resolveNpcName(pmp[1].trim()),pmVal=pmp[2].trim().toLowerCase()==="true",pmN=wsNpcByName(pmName);/* #7: shared lookup (object ref replaces the old index) */
  if(pmVal&&!(pmN&&pmN.partyMember)&&partyCompanionCount()>=partyCompanionCap()){
    if(!pmN){worldState.npcs.push({name:pmName,status:"",statusTurn:0,rel:"ally",met:R.turn,partyMember:false,portrait:null,aliases:[]});}/* v1.439 (F4): empty mood seed, matching [NPC:] — "unknown" is not a mood and the heal clears it */
    else pmN.partyMember=false;
    if(!memory.npcs[pmName])memory.npcs[pmName]={attitude:"",knowledge:[],events:[],aliases:[],partyMember:false};
    if(typeof showToast==="function")showToast("Party full (max "+PARTY_MAX+") — "+pmName+" can't join until someone leaves.");
    R.muts.push("Party full: "+pmName+" not added");continue;
  }
  if(pmN){pmN.partyMember=pmVal;}else{pmN={name:pmName,status:"",statusTurn:0,rel:"unknown",met:R.turn,partyMember:pmVal,portrait:null,aliases:[]};worldState.npcs.push(pmN);}/* v1.439 (F4): empty mood seed */
  if(pmVal&&!pmN.charSheet)pmN.sheetPending=true;
  else if(!pmVal)delete pmN.sheetPending;
  if(memory.npcs[pmName])memory.npcs[pmName].partyMember=pmVal;else memory.npcs[pmName]={attitude:"",knowledge:[],events:[],aliases:[],partyMember:pmVal};if(pmVal&&!memory.npcs[pmName].firstEncounter)memory.npcs[pmName].firstEncounter=R.feGet();R.muts.push(pmVal?"Party: +"+pmName:"Party: -"+pmName);}}},
{t:"SKILL_SUCCESS",apply:function(text,R){var skSuccs=text.match(/\[SKILL_SUCCESS:([^\]]+)\]/g)||[];var sski;for(sski=0;sski<skSuccs.length;sski++){var sskp=skSuccs[sski].match(/\[SKILL_SUCCESS:([^\]]+)\]/);if(!sskp)continue;var sskid=sskp[1].trim();if(!worldState.character.skills)worldState.character.skills=initSkills();
  if(typeof worldState.character.skills[sskid]!=="number"){var _skl=sskid.toLowerCase(),_ski;for(_ski=0;_ski<SKILLS.length;_ski++){if(SKILLS[_ski].id.toLowerCase()===_skl){sskid=SKILLS[_ski].id;break;}}}
  if(typeof worldState.character.skills[sskid]==="number"){var prevLvl=skillLevel(worldState.character.skills[sskid]);worldState.character.skills[sskid]++;var newLvl=skillLevel(worldState.character.skills[sskid]);if(newLvl>prevLvl){R.muts.push(sskid+": "+SKILL_LEVELS[newLvl]);showToast(sskid+": "+SKILL_LEVELS[newLvl]);}else R.muts.push(sskid+" +1");}else if(typeof console!=="undefined")console.warn("[tags] SKILL_SUCCESS: unknown skill id '"+sskid+"' — no increment (#136③)");}}},
// #46 Phase B (v1.267): 3rd arg = cause (provenance). The duration group narrows [^\]]+ →
// [^|\]]+ so the optional cause splits at the pipe — no known duration uses one, and a
// pipe-bearing duration now lands its tail in cause (visible on the sheet, not lost).
{t:"CONDITION",apply:function(text,R){var condTags=text.match(/\[CONDITION:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var condi;for(condi=0;condi<condTags.length;condi++){var condp=condTags[condi].match(/\[CONDITION:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/);if(!condp)continue;if(!worldState.character.conditions)worldState.character.conditions=[];var cnm=condp[1].trim(),cdur=condp[2].trim(),ccause=condp[3]?condp[3].trim():"",calready=false,condj;
  for(condj=0;condj<worldState.character.conditions.length;condj++){if(worldState.character.conditions[condj].name.toLowerCase()===cnm.toLowerCase()){
    worldState.character.conditions[condj].duration=cdur;
    // cause is PROVENANCE — the affliction's origin. First writer wins (same spirit as the
    // onset turn-stamp surviving duration updates); a re-emission never rewrites history.
    if(ccause&&!worldState.character.conditions[condj].cause)worldState.character.conditions[condj].cause=ccause;
    calready=true;break;}}
  if(!calready){var newCond={name:cnm,duration:cdur};if(ccause)newCond.cause=ccause;worldState.character.conditions.push(newCond);R.muts.push("Condition: "+cnm);}}}},
{t:"CONDITION_REMOVED",apply:function(text,R){var condRems=text.match(/\[CONDITION_REMOVED:([^\]]+)\]/g)||[];var cri2;for(cri2=0;cri2<condRems.length;cri2++){var crp2=condRems[cri2].match(/\[CONDITION_REMOVED:([^\]]+)\]/);if(!crp2)continue;if(!worldState.character.conditions)continue;var cbef=worldState.character.conditions.length,_crn=crp2[1].trim().toLowerCase();worldState.character.conditions=worldState.character.conditions.filter(function(x){return x.name.toLowerCase()!==_crn;});if(worldState.character.conditions.length<cbef)R.muts.push("Cured: "+crp2[1].trim());else if(typeof console!=="undefined")console.warn("[tags] CONDITION_REMOVED: '"+crp2[1].trim()+"' is not on the sheet — nothing cured (#136⑤)");}}},
{t:"RELATIONSHIP",apply:function(text,R){var tags=text.match(/\[RELATIONSHIP:([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[RELATIONSHIP:([^|\]]+)\|([^\]]+)\]/);if(m)relationshipLegacyProposal(null,m[1].trim(),m[2].trim(),"legacy-write",R);}}},
{t:"RELATIONSHIP_REMOVED",apply:function(text,R){var tags=text.match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/);if(m)relationshipLegacyProposal(null,m[1].trim(),"","legacy-remove",R);}}},
{t:"RELATIONSHIP_BOND",apply:function(text,R){var tags=text.match(/\[RELATIONSHIP_BOND:([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[RELATIONSHIP_BOND:([^|\]]+)\|([^\]]+)\]/);if(m)relationshipWrite(null,m[1].trim(),"bond",m[2].trim(),R);}}},
{t:"RELATIONSHIP_BOND_REMOVED",apply:function(text,R){var tags=text.match(/\[RELATIONSHIP_BOND_REMOVED:([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[RELATIONSHIP_BOND_REMOVED:([^\]]+)\]/);if(m)relationshipWrite(null,m[1].trim(),"bond","",R);}}},
{t:"RELATIONSHIP_DYNAMIC",apply:function(text,R){var tags=text.match(/\[RELATIONSHIP_DYNAMIC:([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[RELATIONSHIP_DYNAMIC:([^|\]]+)\|([^\]]+)\]/);if(m)relationshipWrite(null,m[1].trim(),"dynamic",m[2].trim(),R);}}},
{t:"RELATIONSHIP_DYNAMIC_REMOVED",apply:function(text,R){var tags=text.match(/\[RELATIONSHIP_DYNAMIC_REMOVED:([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[RELATIONSHIP_DYNAMIC_REMOVED:([^\]]+)\]/);if(m)relationshipWrite(null,m[1].trim(),"dynamic","",R);}}},
{t:"RELATIONSHIP_PAIR_REMOVED",apply:function(text,R){var tags=text.match(/\[RELATIONSHIP_PAIR_REMOVED:([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[RELATIONSHIP_PAIR_REMOVED:([^\]]+)\]/);if(m)relationshipWrite(null,m[1].trim(),"pair","",R);}}},
{t:"SAVE_MOD",apply:function(text,R){var saveTags=text.match(/\[SAVE_MOD:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var smi2;for(smi2=0;smi2<saveTags.length;smi2++){var smp2=saveTags[smi2].match(/\[SAVE_MOD:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!smp2)continue;if(!worldState.character.saveModifiers)worldState.character.saveModifiers=[];var ssrc=smp2[1].trim(),stype=smp2[2].trim(),sval=parseInt(smp2[3]);if(isNaN(sval))continue;var sfound=false,smj;for(smj=0;smj<worldState.character.saveModifiers.length;smj++){if(worldState.character.saveModifiers[smj].source===ssrc){worldState.character.saveModifiers[smj].type=stype;worldState.character.saveModifiers[smj].amount=sval;sfound=true;break;}}if(!sfound)worldState.character.saveModifiers.push({source:ssrc,type:stype,amount:sval});var svalStr=sval>=0?"+"+sval:""+sval;R.muts.push("Save "+svalStr+" vs "+stype+" ["+ssrc+"]");}}},
{t:"SAVE_MOD_REMOVED",apply:function(text,R){var saveRemTags=text.match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/g)||[];var smri2;for(smri2=0;smri2<saveRemTags.length;smri2++){var smrp2=saveRemTags[smri2].match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/);if(!smrp2)continue;if(!worldState.character.saveModifiers)continue;var _srn=smrp2[1].trim().toLowerCase(),_srB=worldState.character.saveModifiers.length;worldState.character.saveModifiers=worldState.character.saveModifiers.filter(function(x){return x.source.toLowerCase()!==_srn;});if(worldState.character.saveModifiers.length===_srB&&typeof console!=="undefined")console.warn("[tags] SAVE_MOD_REMOVED: no modifier from '"+smrp2[1].trim()+"' on file (#136③)");}}},
{t:"LANGUAGE",apply:function(text,R){var langTags=text.match(/\[LANGUAGE:([^|\]]+)\|([^\]]+)\]/g)||[];var lni2;for(lni2=0;lni2<langTags.length;lni2++){var lnp2=langTags[lni2].match(/\[LANGUAGE:([^|\]]+)\|([^\]]+)\]/);if(!lnp2)continue;if(!worldState.character.languages)worldState.character.languages=[];var lname=lnp2[1].trim(),lbroken=lnp2[2].trim().toLowerCase()==="broken",lfound=false,lj2;for(lj2=0;lj2<worldState.character.languages.length;lj2++){if(worldState.character.languages[lj2].name.toLowerCase()===lname.toLowerCase()){worldState.character.languages[lj2].broken=lbroken;lfound=true;break;}}if(!lfound){worldState.character.languages.push({name:lname,broken:lbroken});R.muts.push((lbroken?"Broken ":"")+"Language: "+lname);}}}},
{t:"STORY_BEAT",apply:function(text,R){var beatTags=text.match(/\[STORY_BEAT:([^\]]+)\]/g)||[];var bti2;for(bti2=0;bti2<beatTags.length;bti2++){var btp2=beatTags[bti2].match(/\[STORY_BEAT:([^\]]+)\]/);if(!btp2)continue;if(!worldState.character.storyBeats)worldState.character.storyBeats=[];worldState.character.storyBeats.push({text:btp2[1],turn:R.turn,camp:worldState.campName||""});/* #130: campaign stamp (the fileCoreMemory pattern) — beats ride imports, and a foreign beat's turn number is meaningless here */fileDecision(R.turn,"[Story Beat] "+btp2[1]);}}},
// #40 GM tag (deferred at v1.243, built v1.307): the enrichment layer on top of the engine
// triggers — moments the engine CANNOT detect (revelations, weddings, vows; the #57/UA40 class).
// ONE write path: routes through game.js fileCoreMemory (witnessed-by-all fan-out, per-sheet
// cap+archive, toast) — nothing re-implemented here. The (turn,kind,who) dedupe inside
// fileCoreMemory doubles as spam control: one GM moment per subject per turn. Text is clamped
// to one-sentence length LOUDLY (entries cost prompt tokens every turn, forever).
{t:"CORE_MEMORY",apply:function(text,R){var cmTags=text.match(/\[CORE_MEMORY:([^|\]]+)\|([^\]]+)\]/g)||[];var cmi;for(cmi=0;cmi<cmTags.length;cmi++){var cmp=cmTags[cmi].match(/\[CORE_MEMORY:([^|\]]+)\|([^\]]+)\]/);if(!cmp)continue;
  if(typeof fileCoreMemory!=="function")continue;/* satellite/partial-load contexts */
  var cmWho=resolveNpcName(cmp[1].trim()),cmTxt=cmp[2].trim();if(!cmTxt)continue;
  if(cmTxt.length>200){var cmCut=cmTxt.lastIndexOf(" ",199);if(cmCut<80)cmCut=199;var cmFull=cmTxt;cmTxt=cmTxt.slice(0,cmCut).replace(/[,;:\s]+$/,"")+"…";if(typeof console!=="undefined")console.warn("[core-memory] GM moment clamped to one-sentence length: \""+cmFull.slice(0,60)+"…\"");}
  if(fileCoreMemory("gm",cmWho,cmTxt))R.muts.push("★ Defining moment ("+cmWho+")");
  else if(typeof console!=="undefined")console.warn("[core-memory] GM moment for "+cmWho+" not filed (duplicate this turn, or no character loaded)");}}},
{t:"ARC_COMPLETE",apply:function(text,R){var arcTags=text.match(/\[ARC_COMPLETE:([^\]]+)\]/g)||[];
  if(arcTags.length&&worldState.skeleton){
    var _sk=worldState.skeleton,_si,_sj,_ti;
    /* #233: snapshot the arcs ACTIVE before ANY close in this response. A title outside this set is
       either a #136① miss (never active) or a CHAIN-close — naming the arc an earlier tag in this
       same response just activated — and both refuse loudly. Distinct titles that WERE live all
       close (the old first-match parse silently swallowed a parallel act's second sweep). */
    var _pre={};
    for(_si=0;_si<_sk.acts.length;_si++){if(_sk.acts[_si].status!=="active")continue;var _pa=_sk.acts[_si].arcs||[];for(_sj=0;_sj<_pa.length;_sj++){if(_pa[_sj].status==="active"&&_pa[_sj].title)_pre[_pa[_sj].title.toLowerCase()]=1;}}
    var _seen={};
    for(_ti=0;_ti<arcTags.length;_ti++){
    var _atm=arcTags[_ti].match(/\[ARC_COMPLETE:([^\]]+)\]/);if(!_atm)continue;
    var _ad=_atm[1].trim(),_adk=_ad.toLowerCase(),_any=false;
    if(_seen[_adk])continue;/* #233: a duplicated title closes once — no double sweep, no double advance */
    _seen[_adk]=1;
    if(!_pre[_adk]){
      var _nowLive=false;
      for(_si=0;_si<_sk.acts.length;_si++){if(_sk.acts[_si].status!=="active")continue;var _ca=_sk.acts[_si].arcs||[];for(_sj=0;_sj<_ca.length;_sj++){if(_ca[_sj].status==="active"&&_ca[_sj].title&&_ca[_sj].title.toLowerCase()===_adk)_nowLive=true;}}
      if(typeof console!=="undefined")console.warn(_nowLive
        ?"[tags] ARC_COMPLETE: \""+_ad+"\" was activated by an earlier tag in this SAME response — chain-close refused (#233); close it in a later response if its story is truly done"
        :"[tags] ARC_COMPLETE: \""+_ad+"\" matches no ACTIVE arc — ignored, nothing closed (#136①)");
      continue;}
    for(_si=0;_si<_sk.acts.length;_si++){
      if(_sk.acts[_si].status!=="active")continue;
      var _act=_sk.acts[_si],_matched=false;
      for(_sj=0;_sj<_act.arcs.length;_sj++){
        if(_act.arcs[_sj].status!=="active")continue;
        if(_act.arcs[_sj].title.toLowerCase()!==_ad.toLowerCase())continue;/* #136① RULING (oversight, not design): the title is validated for SEQUENTIAL acts too — the old parallel-only guard let a hallucinated/misspelled title close the running arc silently (Sol's probe closed "True Arc" via "Totally Wrong"), while the strict sibling ARC_CONTINUE proves the intended discipline. The #127 escalation machinery re-demands the fork if the arc is genuinely finished under another name. */
        _act.arcs[_sj].status="completed";_matched=true;
        R.muts.push("Arc complete: "+_act.arcs[_sj].title);
        /* #231 THE ARC WALL (owner ruling 2026-08-24, hard wall — no promotion path). Field
           evidence: the closed-eye thread reached 18 quests (1.8x the entire 10-arc spine) and
           spanned 63% of the campaign because it outlived its parent arc by ~1000 turns across
           ~8 arc boundaries, unnoticed. An emergent thread now dies with the arc that bore it:
           live progeny archive as "abandoned" — the #229 status, so the reopen guard blocks a
           force-reactivation while a fresh [QUEST:|offered] may still bring it back if the story
           genuinely re-raises it. Only STAMPED EMERGENT quests are ever touched. */
        var _wallArc=_act.arcs[_sj].title,_wk,_walled=[];
        for(_wk=worldState.questLog.length-1;_wk>=0;_wk--){
          var _wq=worldState.questLog[_wk];
          if(!_wq.bornArc||String(_wq.bornArc).toLowerCase()!==String(_wallArc).toLowerCase())continue;
          if(_wq.status!=="active"&&_wq.status!=="offered")continue;
          if(!memory.quests)memory.quests={};
          /* #235: by:"wall" — the wall is the author, not the player. wasOffered marks the third
             semantic that used to hide under the same label: a hook the player never accepted,
             which lapsed rather than being dropped. Read by questArchiveWording (helpers.js). */
          memory.quests[_wq.title]={title:_wq.title,desc:_wq.desc||"",objectives:_wq.objectives||[],status:"abandoned",turn:R.turn,by:"wall",wasOffered:_wq.status==="offered"};
          worldState.questLog.splice(_wk,1);
          _walled.push(_wq.title);
        }
        if(_walled.length){
          _walled.reverse();
          if(!worldState.recentWallSweep)worldState.recentWallSweep=[];/* #234: arm the post-sweep channel — the crisis line otherwise demands re-registration of the very threads the wall just closed, and the blocked |active re-creation is silent to the GM */
          worldState.recentWallSweep.push({arc:_wallArc,titles:_walled.slice(0,8),turn:R.turn});
          R.muts.push("Arc wall: "+_walled.length+" side thread"+(_walled.length>1?"s":"")+" closed with the arc — "+_walled.join(", "));
          if(typeof showToast==="function")showToast("⧉ "+_walled.length+" side thread"+(_walled.length>1?"s":"")+" closed with the arc");
          if(typeof addMsg==="function")addMsg("system","Closed with the arc: "+_walled.join(", ")+" — side threads do not outlive the arc that began them.");
          if(typeof console!=="undefined")console.warn("[quest] #231 arc wall — \""+_wallArc+"\" closed, sweeping its emergent progeny: "+_walled.join(", "));
        }
        if(!_act.parallel){for(var _nk=_sj+1;_nk<_act.arcs.length;_nk++){if(_act.arcs[_nk].status!=="pending")continue;/* #233: only a PENDING arc activates — the old unconditional _sj+1 write RESURRECTED an already-completed arc, which now also wedges the act door */_act.arcs[_nk].status="active";_act.arcs[_nk].startTurn=worldState.turn;/* #23 per-arc pacing clock starts now */R.muts.push("New arc: "+_act.arcs[_nk].title);break;}}
        break;
      }
      if(_matched){_any=true;break;}
    }
    if(!_any&&typeof console!=="undefined")console.warn("[tags] ARC_COMPLETE: \""+_ad+"\" matches no ACTIVE arc — ignored, nothing closed (#136①)");
    }
  }}},
{t:"ARC_CONTINUE",apply:function(text,R){var arcCont=text.match(/\[ARC_CONTINUE:([^\]|]+)(?:\|([^\]]*))?\]/);
  // #127: the GM's explicit "this arc is legitimately still open" answer to an ARC DRIFT CHECK.
  // Resets that arc's drift clock AND count (the escalation starts over), records the stated
  // reason on the arc (informational — the GM's own justification, re-readable later). ACTIVE
  // arcs only: confirming a pending/completed arc "open" is a no-op with a loud warn.
  if(arcCont&&worldState.skeleton){
    var _ct=arcCont[1].trim(),_cr=(arcCont[2]||"").trim(),_ci,_cj,_ck,_cfound=false;
    for(_ci=0;_ci<worldState.skeleton.acts.length&&!_cfound;_ci++){
      var _carcs=worldState.skeleton.acts[_ci].arcs||[];
      for(_cj=0;_cj<_carcs.length;_cj++){
        if(_carcs[_cj].status!=="active"||_carcs[_cj].title.toLowerCase()!==_ct.toLowerCase())continue;
        _cfound=true;
        if(_cr)_carcs[_cj].continueReason=_cr;
        if(worldState.arcDriftNudged){for(_ck in worldState.arcDriftNudged){if(_ck.toLowerCase().indexOf(_ct.toLowerCase()+"|")===0)worldState.arcDriftNudged[_ck]={t:worldState.turn,n:0};}}
        R.muts.push("Arc continues: "+_carcs[_cj].title+(_cr?" — "+_cr:""));
        break;
      }
    }
    if(!_cfound)console.warn("[tags] ARC_CONTINUE: no ACTIVE arc titled '"+_ct+"' — no-op (typo, or the arc already completed?)");
  }}},
{t:"ACT_COMPLETE",apply:function(text,R){var actDone=text.match(/\[ACT_COMPLETE:([^\]]+)\]/);
  if(actDone&&worldState.skeleton){
    var _sk2=worldState.skeleton,_si2,_at=actDone[1].trim();
    for(_si2=0;_si2<_sk2.acts.length;_si2++){
      if(_sk2.acts[_si2].status!=="active")continue;
      var _cAct=_sk2.acts[_si2];
      /* #233 ① the operand is VALIDATED (#136① parity): this handler used to ignore its title
         entirely, so a hallucinated act name closed the running act silently (Sol's joint-review
         probe: "[ACT_COMPLETE:Totally Wrong]"). A titled act demands a case-insensitive match; a
         title-less act (malformed skeleton) closes with a warn rather than wedging progression. */
      if(_cAct.title&&_cAct.title.toLowerCase()!==_at.toLowerCase()){
        if(typeof console!=="undefined")console.warn("[tags] ACT_COMPLETE: \""+_at+"\" does not match the ACTIVE act \""+_cAct.title+"\" — ignored, nothing closed (#233)");
        break;}
      if(!_cAct.title&&typeof console!=="undefined")console.warn("[tags] ACT_COMPLETE: the active act has no title — closing on \""+_at+"\" unverified (#233 fail-open)");
      /* #233 ② no completed act may ever contain a live arc — the open door that orphaned #231
         progeny (ARC_COMPLETE searches ACTIVE acts only, so a stranded arc could never sweep and
         its stamped side threads became permanently immune — the exact sprawl the wall kills).
         The close REFUSES until every arc resolves; [ARC_COMPLETE:] runs BEFORE this handler in
         table order, so the valid same-response arc-then-act close (battery D) still lands. */
      var _live=[],_lj,_larcs=_cAct.arcs||[];
      for(_lj=0;_lj<_larcs.length;_lj++){if(_larcs[_lj].status==="active")_live.push(_larcs[_lj].title);}
      if(_live.length){
        R.muts.push("⚠ Act close refused: \""+(_cAct.title||_at)+"\" still has "+(_live.length>1?"live arcs":"a live arc")+" — "+_live.join(", ")+". Close each with [ARC_COMPLETE:title] first; if an arc is legitimately still running, the act has not reached its turning point yet ([ARC_CONTINUE:title]).");
        if(typeof showToast==="function")showToast("⚠ Act close refused — live arc: "+_live.join(", "));
        if(typeof console!=="undefined")console.warn("[tags] ACT_COMPLETE refused over live arc(s): "+_live.join(", ")+" (#233)");
        break;}
      _cAct.status="completed";
      _cAct.completedTurn=worldState.turn;/* #148 Phase 2: era boundaries prefer act completions — additive stamp, nothing else reads it before eraNextSources */
      R.muts.push("Act complete: "+_cAct.title);
      awardMilestoneXp("act",_cAct.title,R);/* #302 */
      worldState.checkpointDue="act: "+(_cAct.title||"");/* #300: an act close is a camp */
      if(_si2+1<_sk2.acts.length){
        _sk2.acts[_si2+1].status="active";
        worldState.actStartTurn=worldState.turn;
        var _fa=_sk2.acts[_si2+1].arcs,_isP=!!_sk2.acts[_si2+1].parallel;
        if(_fa&&_fa.length){for(var _fj=0;_fj<_fa.length;_fj++){if(_isP||_fj===0){_fa[_fj].status="active";_fa[_fj].startTurn=worldState.turn;/* #23 per-arc pacing clock starts now */}}}
        R.muts.push("New act: "+_sk2.acts[_si2+1].title);
      }else{R.muts.push("Campaign complete!");worldState.spineComplete={turn:worldState.turn,act:_cAct.title||""};/* #325: the authored tale is told — the ENDING is offered on the fourth button, never forced */if(typeof showToast==="function")showToast("\u2605 The tale is told \u2014 the ending is yours to call, whenever you like",8000);}
      break;
    }
  }}},
/* TODO #1 P5 (D11, F1–F4 ratified 2026-07-18): hard splits. A party member (companion OR
   non-hero PC) gains their own thread via charSheet.splitLoc; |rejoin folds them back. The
   HERO can never split (the hero IS the primary thread — bare [LOCATION:] is their move).
   Map bookkeeping is ADDITIVE only: destination node filed, edge from their previous
   effective location, lastSeenAt stamped — lastArrivalFrom and primary visits are camera
   instruments and stay untouched (F2). Dead/unknown/non-party names are loud no-ops. */
{t:"PARTY_SPLIT",apply:function(text,R){var psTags=text.match(/\[PARTY_SPLIT:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var psi;for(psi=0;psi<psTags.length;psi++){var psm=psTags[psi].match(/\[PARTY_SPLIT:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/);if(!psm)continue;
  var psName=resolveNpcName(psm[1].trim()),psArg=locResolve(normalizeEndpointPair(psm[2].trim())),psSub=psm[3]?psm[3].trim():null;/* #156: split destinations get the same route-name canonicalization as [LOCATION:]; #156B: and identity resolution */
  /* #189ⓒ (t2095-2097, the camera-omission split): the GM writes interiors PARENTHETICALLY into
     the location field — "Magnimar (Wyla Ashvane's shop)" — which reads as a distinct name-born
     key, so buildSplitAudit's same-world waiver never saw the target IS the party's own city and
     the misuse aged out unaudited. Normalize at the write boundary when the OUTER name resolves
     to a KNOWN WORLD node and no explicit sublocation was given — an identity split, not a timer
     (the 2026-08-09 lesson). Unknown outers stay untouched: never guess. */
  if(!psSub){var psPar=psArg.match(/^(.+?)\s*\(([^()]+)\)\s*$/);if(psPar){var psOuter=locResolve(normalizeEndpointPair(psPar[1].trim()));var psONode=(typeof memory!=="undefined"&&memory.map&&memory.map.nodes)?memory.map.nodes[psOuter]:null;if(psONode&&!psONode.parent){if(typeof console!=="undefined")console.info("[multiplayer] split target '"+psm[2].trim()+"' normalized to "+psOuter+" | "+psPar[2].trim()+" (#189c)");psArg=psOuter;psSub=psPar[2].trim();}}}
  if(worldState.character&&psName===worldState.character.name){if(typeof console!=="undefined")console.warn("[multiplayer] [PARTY_SPLIT:"+psName+"] ignored — the hero IS the primary thread (bare [LOCATION:] moves them)");continue;}
  var psN=wsNpcByName(psName);
  if(!psN||!psN.partyMember||!psN.charSheet){if(typeof console!=="undefined")console.warn("[multiplayer] [PARTY_SPLIT:"+psName+"] ignored — not a party member with a character sheet");continue;}
  if(npcIsDead(psN)){if(typeof console!=="undefined")console.warn("[multiplayer] [PARTY_SPLIT:"+psName+"] ignored — they are dead");continue;}/* B3: flag, not status regex */
  if(/^rejoin$/i.test(psArg)){
    if(psN.charSheet.splitLoc){delete psN.charSheet.splitLoc;if(memory.npcs[psName]){memory.npcs[psName].lastSeenAt=currentNodeKey();memory.npcs[psName].lastSeenTurn=R.turn;memory.npcs[psName].lastSeenSrc="arrive";/* #175bR: every lastSeenAt write is turn-stamped; #194: and sourced */}if(typeof guestbookStamp==="function")guestbookStamp(currentNodeKey(),psName,R.turn,"arrive");/* #173: rejoining IS arriving where the party stands (#194: sourced) */R.muts.push(psName+" rejoins the party");if(typeof showToast==="function")showToast("⇠ "+psName+" rejoins the party");/* #189: transitions are LOUD — the muts line alone was invisible at the moment it mattered */}
    else if(typeof console!=="undefined")console.warn("[multiplayer] [PARTY_SPLIT:"+psName+"|rejoin] ignored — they are not split");
    continue;}
  var psPrev=pcEffectiveLoc(psN.charSheet).location;
  var psWas=psN.charSheet.splitLoc;/* #189b transition gate: the GM legally RE-AFFIRMS a split every turn (refreshing the audit clock) — only the not-split→split edge or a changed away-location is toast-worthy news (t1835-1837 field: a toast per re-affirm) */
  /* #271② (f34): sameness is NORMALIZED, never raw-string — the w2HandleKey discipline (#201) at
     this boundary. locResolve is exact-string/case-sensitive, so "rusty dragon" vs "The Rusty
     Dragon" (or "the docks" vs "The Docks" on the LOCATION operand) used to defeat the #228
     no-op and re-take the full write path: split record re-minted (audit due again next turn),
     phantom #194 witnessed-grade arrival evidence, phantom guestbook stamps — on EVERY wording
     flip. The stored display stays as-emitted at the first real write. */
  var psNameKey=function(v){return String(v==null?"":v).toLowerCase().replace(/[-_\s]+/g," ").trim().replace(/^(?:the|a|an)\s+/,"");};
  var psToastWorthy=!psWas||psNameKey(psWas.location)!==psNameKey(psArg)||psNameKey(psWas.sublocation)!==psNameKey(psSub);
  /* #228 (t2320-t2324, the live re-affirm loop; owner ruling 2026-08-24 ⓒ): an identical
     re-affirm of an ALREADY-STAMPED split is a NO-OP. buildSplitAudit's same-world waiver makes
     a split inside the party's OWN world node due every turn; its note asks the GM to re-affirm;
     the re-mint below destroyed .audited, so the audit fired again next turn — a closed loop with
     the engine on BOTH ends. Each pass also stamped a phantom guestbook "arrival" at a place
     nobody moved to (filling GB_TURN_CAP with re-affirm noise and folding real visits into the
     agg) and re-witnessed #194 presence evidence for characters standing still.
     Only the re-STAMPS are suppressed — _freshSplits is still granted, because a same-node split
     is LEGITIMATE (owner ruling ⓑ: "you three stay here, I'll scout ahead" must not be dissolved
     by the #133b fold on the very next response). An UNSTAMPED legacy record deliberately falls
     through and gets stamped: refusing it would leave the #133 legacy shape auditing forever
     with no way to become fresh. A changed location OR sublocation is a real move and also falls
     through — the audit note explicitly asks the GM to ADD a sublocation it previously omitted. */
  if(psWas&&psWas.turn!=null&&!psToastWorthy){
    if(!R._freshSplits)R._freshSplits={};
    R._freshSplits[psName]=1;/* ruling B: the stay-behind keeps its #133b grace */
    if(typeof console!=="undefined")console.info("[multiplayer] [PARTY_SPLIT:"+psName+"] re-affirmed unchanged at "+psArg+(psSub?" ("+psSub+")":"")+" — no-op (#228): split turn "+psWas.turn+" and the audit cooldown stand");
    continue;
  }
  /* #133: stamp the split's turn at write — buildSplitAudit ages from it. #228 (f32 comment
     repair 2026-08-29): only a CHANGED or legacy-unstamped split reaches this line — the
     identical re-affirm no-ops above, preserving turn + .audited ("the reset IS the write" was
     the superseded pre-#228 contract). Legacy splits without .turn read as infinitely old, so
     stale pre-#133 splits audit immediately and their first re-affirm heals the stamp here. */
  psN.charSheet.splitLoc={location:psArg,sublocation:psSub,turn:R.turn};
  /* #135: mark the split as written THIS response — the #133b co-location sweep grants it one
     response of grace. The natural stay-behind order is "Daeris stays at the inn" now, the
     party departs NEXT response; an age-blind sweep deleted that record in this very pass
     (died at birth). Per-RESPONSE scratch, not a turn stamp — turn does not advance between
     applyMuts calls, so a turn gate would also spare genuinely stale same-turn records. */
  if(!R._freshSplits)R._freshSplits={};
  R._freshSplits[psName]=1;
  if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
  if(!memory.map.nodes[psArg])memory.map.nodes[psArg]={firstVisit:R.turn,visits:0,description:null,parent:null,npcs:[],items:[],size:null,travelMins:null};
  if(psPrev&&psPrev!==psArg){var psEx=false,psEi;for(psEi=0;psEi<memory.map.edges.length;psEi++){var psE=memory.map.edges[psEi];if((psE.from===psPrev&&psE.to===psArg)||(psE.from===psArg&&psE.to===psPrev)){psEx=true;break;}}if(!psEx)memory.map.edges.push({from:psPrev,to:psArg,turn:R.turn});}
  if(memory.map.nodes[psArg].npcs.indexOf(psName)<0)memory.map.nodes[psArg].npcs.push(psName);
  if(memory.npcs[psName]){memory.npcs[psName].lastSeenAt=(psSub?psArg+"|"+psSub:psArg);memory.npcs[psName].lastSeenTurn=R.turn;memory.npcs[psName].lastSeenSrc="arrive";/* #175bR; #194 sourced */}
  /* #173: the split member's own arrival is recorded evidence — this handler is the ONE writer
     with settled knowledge of where they went (brief A). World node always (just ensured above);
     the child only if it already exists — a split does not mint child nodes. */
  if(typeof guestbookStamp==="function"){
    guestbookStamp(psArg,psName,R.turn,"arrive");
    if(psSub){var _gbSk=psArg+"|"+psSub;if(memory.map.nodes[typeof locResolve==="function"?locResolve(_gbSk):_gbSk])guestbookStamp(_gbSk,psName,R.turn,"arrive");}
  }
  R.muts.push(psName+" splits off to "+psArg+(psSub?" ("+psSub+")":""));
  if(psToastWorthy&&typeof showToast==="function")showToast("⇢ "+psName+" splits from the party — "+psArg+(psSub?" · "+psSub:""));/* #189 — transition-gated */
}}},
{t:"COMPANION_HP",apply:function(text,R){var cHpTags=text.match(/\[COMPANION_HP:([^|\]]+)\|\s*([+-]?\d+)[^\]]*\]/g)||[];var cHpi;for(cHpi=0;cHpi<cHpTags.length;cHpi++){var cHpm=cHpTags[cHpi].match(/\[COMPANION_HP:([^|\]]+)\|\s*([+-]?\d+)[^\]]*\]/);if(!cHpm)continue;var cHpCs=findCompanionChar(cHpm[1]);if(!cHpCs){if(typeof console!=="undefined")console.warn("[tags] no party member matches '"+cHpm[1].trim()+"' — companion tag dropped (#136③)");continue;}var cHpdv=parseInt(cHpm[2]);cHpCs.hp=Math.min(cHpCs.maxHp||cHpCs.hp,Math.max(0,cHpCs.hp+cHpdv));R.muts.push(cHpm[1].trim()+(cHpdv>0?" healed ":" took ")+Math.abs(cHpdv)+" HP");}}},
{t:"COMPANION_ITEM_GAINED",apply:function(text,R){var cIgTags=text.match(/\[COMPANION_ITEM_GAINED:([^|\]]+)\|([^\]]+)\]/g)||[],cIgCounts={},cIgi;for(cIgi=0;cIgi<cIgTags.length;cIgi++){var c0=cIgTags[cIgi].match(/\[COMPANION_ITEM_GAINED:([^|\]]+)\|([^\]]+)\]/);if(c0){var ck0=c0[1].trim()+"|"+itemBaseName(c0[2]);cIgCounts[ck0]=(cIgCounts[ck0]||0)+1;}}for(cIgi=0;cIgi<cIgTags.length;cIgi++){var cIgm=cIgTags[cIgi].match(/\[COMPANION_ITEM_GAINED:([^|\]]+)\|([^\]]+)\]/);if(!cIgm)continue;var cOwner=cIgm[1].trim(),cIgCs=findCompanionChar(cOwner);if(!cIgCs){if(typeof console!=="undefined")console.warn("[tags] no party member matches '"+cOwner+"' — companion tag dropped (#136③)");continue;}if(!cIgCs.inventory)cIgCs.inventory=[];duplicateItemGrantWarning(cIgCs.inventory,cIgm[2].trim(),cIgCounts[cOwner+"|"+itemBaseName(cIgm[2])],cOwner,R,text);addInventoryItem(cIgCs.inventory,cIgm[2].trim());R.muts.push(cOwner+": +"+cIgm[2].trim());}}},
{t:"COMPANION_ITEM_LOST",apply:function(text,R){var cIlTags=text.match(/\[COMPANION_ITEM_LOST:([^|\]]+)\|([^\]]+)\]/g)||[];var cIli;for(cIli=0;cIli<cIlTags.length;cIli++){var cIlm=cIlTags[cIli].match(/\[COMPANION_ITEM_LOST:([^|\]]+)\|([^\]]+)\]/);if(!cIlm)continue;var cIlCs=findCompanionChar(cIlm[1]);if(!cIlCs||!cIlCs.inventory){if(typeof console!=="undefined")console.warn("[tags] no party member (with inventory) matches '"+cIlm[1].trim()+"' — companion tag dropped (#136③)");continue;}if(removeInventoryItem(cIlCs.inventory,cIlm[2].trim())){R.muts.push(cIlm[1].trim()+": -"+cIlm[2].trim());_clearConsumablePending(cIlm[1].trim(),cIlm[2].trim());}else if(typeof console!=="undefined")console.warn("[tags] COMPANION_ITEM_LOST: '"+cIlm[2].trim()+"' not in "+cIlm[1].trim()+"'s inventory — no receipt (#136⑤)");}}},
// #60b: companion form of ITEM_KEPT — same confirmed-negative latch, keyed by owner.
/* #176: the companion twin of ITEM_RENAMED — same relabel semantics on the named member's sheet. */
{t:"COMPANION_ITEM_RENAMED",apply:function(text,R){var crTags=text.match(/\[COMPANION_ITEM_RENAMED:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/g)||[];var cri;for(cri=0;cri<crTags.length;cri++){var crm=crTags[cri].match(/\[COMPANION_ITEM_RENAMED:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/);if(!crm)continue;var crOwner=crm[1].trim(),crCs=findCompanionChar(crOwner);if(!crCs){if(typeof console!=="undefined")console.warn("[tags] no party member matches '"+crOwner+"' — companion tag dropped (#136③)");continue;}if(!crCs.inventory)crCs.inventory=[];renameInventoryItem(crCs.inventory,crm[2].trim(),crm[3].trim(),R,crOwner);}}},
{t:"COMPANION_ITEM_KEPT",apply:function(text,R){var cIkTags=text.match(/\[COMPANION_ITEM_KEPT:([^|\]]+)\|([^\]]+)\]/g)||[];var cIki;for(cIki=0;cIki<cIkTags.length;cIki++){var cIkm=cIkTags[cIki].match(/\[COMPANION_ITEM_KEPT:([^|\]]+)\|([^\]]+)\]/);if(!cIkm)continue;var cIkCs=findCompanionChar(cIkm[1]);if(!cIkCs){console.warn("[COMPANION_ITEM_KEPT] no party member named '"+cIkm[1].trim()+"' — latch not written");continue;}_stampItemKept(cIkm[1].trim(),cIkCs.inventory,cIkm[2].trim());}}},
{t:"COMPANION_XP",apply:function(text,R){var cXpTags=text.match(/\[COMPANION_XP:([^|\]]+)\|\s*\+?(\d+)[^\]]*\]/g)||[];var cXpi;for(cXpi=0;cXpi<cXpTags.length;cXpi++){var cXpm=cXpTags[cXpi].match(/\[COMPANION_XP:([^|\]]+)\|\s*\+?(\d+)[^\]]*\]/);if(!cXpm)continue;var cXpNpc=findCompanionNpc(cXpm[1]);if(!cXpNpc||!cXpNpc.charSheet)continue;
  /* user ruling 2026-07-16 (AUDIT_FABLE_07_16 #6): dead companions get NOTHING — an individual XP
     award at a dead companion is refused loudly (findCompanionNpc still routes OTHER companion tags
     to dead sheets on purpose: the death turn's own [COMPANION_HP:]/[COMPANION_CONDITION:] land
     after the [NPC:|dead] status in table order and must not be dropped) */
  if(npcIsDead(cXpNpc)){if(typeof console!=="undefined")console.warn("[tags] COMPANION_XP at DEAD companion "+cXpNpc.name+" — refused (dead companions get nothing)");R.muts.push(cXpNpc.name+": XP refused (dead)");continue;}/* B3: flag, not status regex */
  var cXpCs=cXpNpc.charSheet;if(typeof cXpCs.xp!=="number")cXpCs.xp=0;cXpCs.xp+=parseInt(cXpm[2]);R.muts.push(cXpm[1].trim()+": +"+cXpm[2]+" XP");checkCompanionLevelUp(cXpCs);}}},
// #46 Phase B: 4th arg = cause, mirror of the player handler (same first-writer-wins upsert).
{t:"COMPANION_CONDITION",apply:function(text,R){var cCondTags=text.match(/\[COMPANION_CONDITION:([^|\]]+)\|([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var cCondi;for(cCondi=0;cCondi<cCondTags.length;cCondi++){var cCondp=cCondTags[cCondi].match(/\[COMPANION_CONDITION:([^|\]]+)\|([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/);if(!cCondp)continue;var cCondCs=findCompanionChar(cCondp[1]);if(!cCondCs){if(typeof console!=="undefined")console.warn("[tags] no party member matches '"+cCondp[1].trim()+"' — companion tag dropped (#136③)");continue;}if(!cCondCs.conditions)cCondCs.conditions=[];var cCnm=cCondp[2].trim(),cCdur=cCondp[3].trim(),cCcause=cCondp[4]?cCondp[4].trim():"",cCalready=false,cCondj;
  for(cCondj=0;cCondj<cCondCs.conditions.length;cCondj++){if(cCondCs.conditions[cCondj].name===cCnm){
    cCondCs.conditions[cCondj].duration=cCdur;
    if(cCcause&&!cCondCs.conditions[cCondj].cause)cCondCs.conditions[cCondj].cause=cCcause;
    cCalready=true;break;}}
  if(!cCalready){var cNewCond={name:cCnm,duration:cCdur};if(cCcause)cNewCond.cause=cCcause;cCondCs.conditions.push(cNewCond);R.muts.push(cCondp[1].trim()+": "+cCnm);}}}},
{t:"COMPANION_CONDITION_REMOVED",apply:function(text,R){var cCrTags=text.match(/\[COMPANION_CONDITION_REMOVED:([^|\]]+)\|([^\]]+)\]/g)||[];var cCri;for(cCri=0;cCri<cCrTags.length;cCri++){var cCrp=cCrTags[cCri].match(/\[COMPANION_CONDITION_REMOVED:([^|\]]+)\|([^\]]+)\]/);if(!cCrp)continue;var cCrCs=findCompanionChar(cCrp[1]);if(!cCrCs||!cCrCs.conditions){if(typeof console!=="undefined")console.warn("[tags] no party member (with conditions) matches '"+cCrp[1].trim()+"' — companion tag dropped (#136③)");continue;}var cCrB=cCrCs.conditions.length;cCrCs.conditions=cCrCs.conditions.filter(function(x){return x.name!==cCrp[2].trim();});if(cCrCs.conditions.length<cCrB)R.muts.push(cCrp[1].trim()+": cured "+cCrp[2].trim());else if(typeof console!=="undefined")console.warn("[tags] COMPANION_CONDITION_REMOVED: '"+cCrp[2].trim()+"' not on "+cCrp[1].trim()+" (#136⑤)");}}},
{t:"COMPANION_RELATIONSHIP",apply:function(text,R){var tags=text.match(/\[COMPANION_RELATIONSHIP:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[COMPANION_RELATIONSHIP:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/);if(m)relationshipLegacyProposal(m[1].trim(),m[2].trim(),m[3].trim(),"legacy-write",R);}}},
{t:"COMPANION_RELATIONSHIP_REMOVED",apply:function(text,R){var tags=text.match(/\[COMPANION_RELATIONSHIP_REMOVED:([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[COMPANION_RELATIONSHIP_REMOVED:([^|\]]+)\|([^\]]+)\]/);if(m)relationshipLegacyProposal(m[1].trim(),m[2].trim(),"","legacy-remove",R);}}},
{t:"COMPANION_RELATIONSHIP_BOND",apply:function(text,R){var tags=text.match(/\[COMPANION_RELATIONSHIP_BOND:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[COMPANION_RELATIONSHIP_BOND:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/);if(m)relationshipWrite(m[1].trim(),m[2].trim(),"bond",m[3].trim(),R);}}},
{t:"COMPANION_RELATIONSHIP_BOND_REMOVED",apply:function(text,R){var tags=text.match(/\[COMPANION_RELATIONSHIP_BOND_REMOVED:([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[COMPANION_RELATIONSHIP_BOND_REMOVED:([^|\]]+)\|([^\]]+)\]/);if(m)relationshipWrite(m[1].trim(),m[2].trim(),"bond","",R);}}},
{t:"COMPANION_RELATIONSHIP_DYNAMIC",apply:function(text,R){var tags=text.match(/\[COMPANION_RELATIONSHIP_DYNAMIC:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[COMPANION_RELATIONSHIP_DYNAMIC:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/);if(m)relationshipWrite(m[1].trim(),m[2].trim(),"dynamic",m[3].trim(),R);}}},
{t:"COMPANION_RELATIONSHIP_DYNAMIC_REMOVED",apply:function(text,R){var tags=text.match(/\[COMPANION_RELATIONSHIP_DYNAMIC_REMOVED:([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[COMPANION_RELATIONSHIP_DYNAMIC_REMOVED:([^|\]]+)\|([^\]]+)\]/);if(m)relationshipWrite(m[1].trim(),m[2].trim(),"dynamic","",R);}}},
{t:"COMPANION_RELATIONSHIP_PAIR_REMOVED",apply:function(text,R){var tags=text.match(/\[COMPANION_RELATIONSHIP_PAIR_REMOVED:([^|\]]+)\|([^\]]+)\]/g)||[],i;for(i=0;i<tags.length;i++){var m=tags[i].match(/\[COMPANION_RELATIONSHIP_PAIR_REMOVED:([^|\]]+)\|([^\]]+)\]/);if(m)relationshipWrite(m[1].trim(),m[2].trim(),"pair","",R);}}},
{t:"COMPANION_ABILITY",apply:function(text,R){var cAbTags=text.match(/\[COMPANION_ABILITY:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cAbi;for(cAbi=0;cAbi<cAbTags.length;cAbi++){var cAbp=cAbTags[cAbi].match(/\[COMPANION_ABILITY:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!cAbp)continue;var cAbCs=findCompanionChar(cAbp[1]);if(!cAbCs){if(typeof console!=="undefined")console.warn("[tags] no party member matches '"+cAbp[1].trim()+"' — companion tag dropped (#136③)");continue;}if(!cAbCs.abilities)cAbCs.abilities=[];var cAnm=cAbp[2].trim(),cAalready=false,cAbj;for(cAbj=0;cAbj<cAbCs.abilities.length;cAbj++){if(cAbCs.abilities[cAbj].nm===cAnm){cAalready=true;break;}}if(!cAalready){cAbCs.abilities.push({nm:cAnm,ds:cAbp[3].trim(),gained:R.turn});R.muts.push(cAbp[1].trim()+": ability "+cAnm);}}}},
{t:"COMPANION_ALIGNMENT",apply:function(text,R){var cAlTags=text.match(/\[COMPANION_ALIGNMENT:([^|\]]+)\|(law|good)([+-]\d+)\]/gi)||[];var cAli;for(cAli=0;cAli<cAlTags.length;cAli++){var cAlp=cAlTags[cAli].match(/\[COMPANION_ALIGNMENT:([^|\]]+)\|(law|good)([+-]\d+)\]/i);if(!cAlp)continue;var cAlCs=findCompanionChar(cAlp[1]);if(!cAlCs){if(typeof console!=="undefined")console.warn("[tags] no party member matches '"+cAlp[1].trim()+"' — companion tag dropped (#136③)");continue;}if(!cAlCs.alignLaw)cAlCs.alignLaw=0;if(!cAlCs.alignGood)cAlCs.alignGood=0;if(cAlp[2].toLowerCase()==="law")cAlCs.alignLaw=Math.max(-3,Math.min(3,cAlCs.alignLaw+parseInt(cAlp[3])));else cAlCs.alignGood=Math.max(-3,Math.min(3,cAlCs.alignGood+parseInt(cAlp[3])));var cNewAl=alignLabel(cAlCs.alignLaw,cAlCs.alignGood);if(cNewAl!==cAlCs.actualAlignment){R.muts.push(cAlp[1].trim()+": align "+cNewAl);cAlCs.actualAlignment=cNewAl;}}}}
];

// ── The table-driven parser — THE sole applyMuts body since the v1.261 cutover close ───────────
function applyMutsTable(text,opts){
  var R={muts:[],turn:worldState.turn,text:text};
  _sheetlessWarned={};
  if(typeof guestbookBeginResponse==="function")guestbookBeginResponse();/* #173: arrivals QUEUE during the parse; the attendance snapshot commits at the post-handler seam below (amendment ③) */
  var feSnip=null;
  R.feGet=function(){if(feSnip===null){var ft=cleanTxt(text).replace(/\*You could[\s\S]*$/,"").trim().slice(0,280);var fb=Math.max(ft.lastIndexOf(". "),ft.lastIndexOf("! "),ft.lastIndexOf("? "));if(fb>60)ft=ft.slice(0,fb+1);feSnip=ft;}return feSnip;};
  // Audit #8: combatStartPositions(text) is pure over the fixed response text, but was
  // recomputed by each of the 4 combat-attribute handlers — lazy-cache it once per response,
  // the exact R.feGet pattern above.
  var csPos=null;
  R.combatStarts=function(){if(csPos===null)csPos=combatStartPositions(text);return csPos;};
  R._xpMirror=function(n){
    // #178 (owner ruling 2026-08-13): the shared [XP:] mirror is ADDITIVE with [COMPANION_XP:].
    // Every living companion receives every shared award; an individual bonus lands ON TOP.
    // The old _xpSkip supersede scan silently cost a doc-obeying GM's companion the shared
    // award (the STATE TAGS doc always said "bonus one companion earns alone" — Frizwick's
    // 14,600 XP gap was this conflict). The double-count guard is the doc's bonus-only clause,
    // not an engine skip.
    var _pi2,_shared=0,_xmParty=livingPartyCompanions();/* user ruling 2026-07-16 (AUDIT_FABLE_07_16 #6): dead companions get NOTHING — the shared [XP:] mirror skips them */
    for(_pi2=0;_pi2<_xmParty.length;_pi2++){var _pn2=_xmParty[_pi2];
      if(typeof _pn2.charSheet.xp!=="number")_pn2.charSheet.xp=0;
      _pn2.charSheet.xp+=n;_shared++;checkCompanionLevelUp(_pn2.charSheet);
    }
    if(_shared)R.muts.push("party +"+n+" XP");
  };
  R.errors=[];
  for(var i=0;i<TAG_TABLE.length;i++){
    try{
      // UA27 (v1.259): a combat-dependent tag arriving with NO active combat silently no-ops —
      // the v1.224 C1 class (premature COMBAT_END, then dropped follow-up tags). Warn loudly,
      // never block (the entry still runs — its own guards keep it a no-op). Checked per entry
      // IN ORDER, so a same-response COMBAT_START has already opened the fight by the time its
      // companion tags are checked.
      if(TAG_TABLE[i].nc&&!worldState.combat&&(text.indexOf("["+TAG_TABLE[i].t+":")>=0||text.indexOf("["+TAG_TABLE[i].t+"]")>=0)){/* #266/f55: bare forms ([ENEMY_SURRENDERS] — the GM-taught mass surrender) used to slip both tripwires */__tagNoCombatWarns++;if(!R._orphanNc)R._orphanNc=[];if(R._orphanNc.indexOf(TAG_TABLE[i].t)<0)R._orphanNc.push(TAG_TABLE[i].t);/* #225: collected per response, settled at the post-handler seam */console.warn("[tags] "+TAG_TABLE[i].t+" arrived with NO active combat — no-op (premature [COMBAT_END:] earlier? the v1.224 C1 class / UA27)");}
      TAG_TABLE[i].apply(text,R);
    }
    catch(e){R.errors.push(TAG_TABLE[i].t+": "+(e&&e.message));console.warn("[tags] table handler "+TAG_TABLE[i].t+" threw:",e&&e.message);}
  }
  stampQuestCompletion();
  // #131: reconcile the clock to the GM's declared time-of-day AFTER every tag handler has run —
  // a same-response [TIME_ADVANCE:]/[REST:long] lands first, so a consistent pair no-ops via the
  // phase band and only a genuine desync gets topped up (forward-only; see clockReconcilePhase).
  if(R.timeText&&typeof clockReconcilePhase==="function"){
    var _trAdd=clockReconcilePhase(R.timeText);
    if(_trAdd>0)R.muts.push("Clock reconciled to '"+R.timeText+"' +"+_trAdd+"m → "+((typeof clockStamp==="function")?clockStamp():""));
    else if(worldState.reconcileSkip&&worldState.reconcileSkip.turn===R.turn)R.muts.push("Clock reconcile SKIPPED — '"+R.timeText+"' crosses dawn ("+Math.round(worldState.reconcileSkip.delta/60)+"h); mislabel presumed, heal note queued (#142)");
  }
  // #133b (the church scenario): a split member whose recorded splitLoc IS the party's current
  // node is a contradiction in terms — "split off at the place you are". Fold them back
  // deterministically and LOUDLY, after all tags land (so a same-response [LOCATION:] arrival
  // counts). Exact loc+subloc match ONLY — a world-only match is a granularity gap and goes to
  // buildSplitAudit's waived age gate instead (GM decides, never the record).
  if(typeof partySplitMembers==="function"){
    var _crj=partySplitMembers(),_crji;
    for(_crji=0;_crji<_crj.length;_crji++){
      var _crm=_crj[_crji],_crl=_crm.charSheet.splitLoc;
      /* #135: a split WRITTEN this response is a stay-behind ahead of the party's departure —
         one response of grace. If the party genuinely goes nowhere, the NEXT response's sweep
         folds them back (deterministic, no GM judgment). The church class (a record written on
         an EARLIER response) still folds right here on arrival. */
      if(R._freshSplits&&R._freshSplits[_crm.name])continue;
      var _crEff=_crl.sublocation?_crl.location+"|"+_crl.sublocation:_crl.location;/* #156B: compare EFFECTIVE nodes through the identity table — a split recorded at the current node's merged alias is the same place (the #133b co-location contract survives repairs) */
      if(locSame(_crEff,currentNodeKey())){
        /* #164 (the Frizwick t1658 class): bare==bare at a node with KNOWN interiors is a
           granularity gap, not co-location — "somewhere in Sandpoint" is not "with the party"
           when the town has a Rusty Dragon to be inside. No fold; buildSplitAudit's waived
           age gate fires the same turn and the GM decides. Interior-less nodes (a camp, the
           church) and exact Loc|Sub matches still fold — genuinely the same place. */
        if(!_crl.sublocation&&!worldState.world.sublocation&&typeof locHasInteriors==="function"&&locHasInteriors(worldState.world.location)){
          if(typeof console!=="undefined")console.info("[multiplayer] "+_crm.name+" is split at the party's own node but the node has interiors — granularity gap, audit (not auto-rejoin) decides (#164)");
          continue;
        }
        delete _crm.charSheet.splitLoc;
        if(memory.npcs[_crm.name]){memory.npcs[_crm.name].lastSeenAt=currentNodeKey();memory.npcs[_crm.name].lastSeenTurn=R.turn;memory.npcs[_crm.name].lastSeenSrc="arrive";/* #175bR; #194 sourced */}
        /* #164: the fold's NARRATIVE half — stamp the reunion so buildReunionNote demands the
           story acknowledge it next turn (the silent-materialize class). One stamp per response;
           multiple folds append names. */
        if(!worldState.pendingReunion||worldState.pendingReunion.turn!==R.turn)worldState.pendingReunion={names:[],node:currentNodeKey(),turn:R.turn};
        if(worldState.pendingReunion.names.indexOf(_crm.name)<0)worldState.pendingReunion.names.push(_crm.name);
        R.muts.push(_crm.name+" rejoins the party (the split record pointed at the party's own location)");
        if(typeof showToast==="function")showToast("⇠ "+_crm.name+" rejoins the party");/* #189: the auto-fold is the transition most likely to pass unnoticed */
        if(typeof console!=="undefined")console.warn("[multiplayer] auto-rejoined "+_crm.name+" — splitLoc matched the party's current node exactly (#133b co-location)");
        if(typeof guestbookStamp==="function")guestbookStamp(currentNodeKey(),_crm.name,R.turn,"arrive");/* #173: the fold IS an arrival — they are physically here now (#194: sourced) */
      }
    }
  }
  // #260: the DEFERRED location combat-clear settles. The [LOCATION:] handler held its clear so
  // this response's outcome tags could reach the fight they describe (table order made that
  // impossible in-handler). If a close already landed (COMBAT_END, or all-foes-down auto-close),
  // there is nothing left to do; otherwise the fight ends the way the original clear ended it —
  // loudly — sparing any foe a same-response [COMBAT_START:] introduced (they are the NEW fight,
  // the #258 pattern; their tracker survives the old fight's teardown).
  if(R._deferCombatClear&&worldState.combat){
    var _dcStarts=R.combatStarts(),_dcNew={},_dcq;
    for(_dcq=0;_dcq<_dcStarts.length;_dcq++)_dcNew[String(_dcStarts[_dcq].name||"").toLowerCase()]=1;
    var _dcKeep=[],_dcRest=[],_dcf,_dcFoes=worldState.combat.foes||[];
    for(_dcf=0;_dcf<_dcFoes.length;_dcf++){
      if(_dcNew[String(_dcFoes[_dcf].name||"").toLowerCase()])_dcKeep.push(_dcFoes[_dcf]);
      else _dcRest.push(_dcFoes[_dcf]);
    }
    var _dcStale=_dcRest.map(function(f){return f.name;}).join(", ")||"?";
    worldState.combat.foes=_dcRest;
    propagateSlainFoes(R);/* B3: the old fight's slain still get their durable stamp */
    if(_dcKeep.length){
      worldState.combat={round:1,engaged:null,foes:_dcKeep,node:(typeof currentNodeKey==="function"?locResolve(currentNodeKey()):null)};
    }else{
      worldState.combat=null;
      R.muts.push("Combat ended (left the area)");
      if(typeof console!=="undefined")console.warn("[combat] auto-cleared stale combat ("+_dcStale+") on move to "+R._deferCombatClear.to+" — GM emitted no [COMBAT_END:] (#260 deferred)");
    }
  }
  // #265① (Fable f1): the DEFERRED bornArc stamp — after every ARC_COMPLETE/ACT_COMPLETE has
  // settled, a quest born this response is stamped with the arc that NOW stands. Same-response
  // "close the arc, offer the sequel" — a natural transition beat — used to bind the sequel to
  // the corpse. Re-checked emergent here (cheap, and the spine set is transition-independent);
  // ambiguity (parallel act, act boundary with no successor) stays unstamped = immune.
  if(R._newQuests&&R._newQuests.length&&typeof questIsEmergent==="function"&&typeof currentArcTitle==="function"){
    var _nqArc=currentArcTitle(),_nqi,_nqj;
    if(_nqArc)for(_nqi=0;_nqi<R._newQuests.length;_nqi++){
      for(_nqj=0;_nqj<worldState.questLog.length;_nqj++){
        var _nqRow=worldState.questLog[_nqj];
        if(_nqRow.title===R._newQuests[_nqi]&&!_nqRow.bornArc){_nqRow.bornArc=_nqArc;break;}/* the emergent gate lives at QUEUE time — one gate, not two half-gates a mutation can slip between */
      }
    }
  }
  // #173: the guestbook arrival commit — THE post-handler attendance seam (pinned amendment ③).
  // [LOCATION:] runs before [PARTY_SPLIT:] in TABLE order regardless of textual order, so "who
  // was actually along" can only be read after every split/rejoin (including the #133b auto-fold
  // above) has settled. fileLocation/fileSubLocation only QUEUE arrivals; this drain stamps the
  // hero + every living UNSPLIT party member at each queued node. Split members' own arrivals
  // are stamped directly by the PARTY_SPLIT handler — the one writer with settled knowledge.
  if(typeof guestbookCommitArrivals==="function")guestbookCommitArrivals();
  // #194: the DERIVED-PRESENCE pass — same amendment-③ discipline as the arrival drain above:
  // [SAY:] speakers, combat-named rostered NPCs, and [SCENE_CAST:] members commit presence only
  // after every split/rejoin/fold has settled, so the #137 guard reads settled records and each
  // observation lands at the effective node. Tags only, never prose; refuse-and-warn, never
  // create. This is the recall floor that replaced the [NPC:] mention stamp.
  if(typeof derivePresenceFromResponse==="function")derivePresenceFromResponse(text,R);
  downedObserve(text,R);/* #300: unresolved downed turns count here; the engine rules the death at DOWNED_MAX_TURNS; fallen MP companions park */
  // #225: the orphan-combat settle. Combat-scoped tags no-opped against a null tracker this
  // response (collected at the UA27 warn site above) and combat is STILL closed after every
  // handler ran — a same-response [COMBAT_START:] would have opened it before its companions
  // were checked (table order) and nothing would be collected. The field shape (t2228-2231,
  // the Bronze Bell Warden): [COMBAT_END:fled], then FOUR turns of ghost fight, every blow a
  // console-only no-op while the GM narrated an hp bar that existed nowhere. One toast per gap
  // (not per response — a stubborn model re-orphans every turn), and the note builder delivers
  // the recovery next turn.
  if(R._orphanNc&&R._orphanNc.length&&!worldState.combat){
    var _ocPrior=worldState.orphanCombat;
    if(_ocPrior&&!_ocPrior.delivered){var _oi;for(_oi=0;_oi<R._orphanNc.length;_oi++)if(_ocPrior.tags.indexOf(R._orphanNc[_oi])<0)_ocPrior.tags.push(R._orphanNc[_oi]);_ocPrior.turn=R.turn;}
    else{
      worldState.orphanCombat={turn:R.turn,tags:R._orphanNc.slice()};
      if(typeof showToast==="function")showToast("\u2694 The story kept fighting after the tracker closed \u2014 those blows were not recorded. Asking the GM to re-open the encounter.",8000);
    }
    R.muts.push("\u26a0 combat tags with no open encounter: "+R._orphanNc.join(", "));
  }
  // #214②: stamp combat-tag ACTIVITY on the open encounter. One place, measuring exactly what
  // buildCombatStaleNudge asks about — did the GM tag this fight at all — rather than a prose
  // scan for "the fight is over", which is the non-deterministic instrument #175b rejected.
  if(worldState.combat&&/\[(?:COMBAT_START|COMBAT_ROUND|COMBAT_STATS|COMBAT_IMMUNE|COMBAT_RESIST|COMBAT_VULN|ENEMY_HP|ENEMY_SLAIN|ENEMY_SURRENDERS):/.test(text))worldState.combat.lastTouch=R.turn;
  // #129: deterministic expiry for schedule entries the GM never resolved — runs on every real
  // turn so a rest/TIME_ADVANCE that jumps past SCHEDULE_EXPIRE_MIN retires the entry that same
  // response. Loudness (warn/toast/archive) lives in the sweep; the muts line makes it visible
  // in the system message like every other state change.
  var _swExp=scheduleSweepExpired(),_swi;
  for(_swi=0;_swi<_swExp.length;_swi++)R.muts.push("Event expired unresolved: "+_swExp[_swi].label);
  if(!(opts&&opts.deferCommit)){
    if(R.muts.length)addMsg("system",escHtml(R.muts.join(" | ")));
    syncUI();saveAll();
  }
  return R;
}
// (v1.261: the shadow/parity machinery that lived here — __tagCloneWS, __tagShadowRun,
// __tagDeepDiff, __tagShadowDiff and their counters — was deleted with the legacy parser.
// The two surviving counters/tripwires below are independent of it.)
var __tagNoCombatWarns=0; // UA27: count of combat-tag-without-combat warns (testable, page-inspectable)
// Unknown-tag detector: any [NAME:...] whose NAME isn't in the strip registry is either a GM
// invention or a vocabulary gap — both worth a loud line (the phantom-tag class, inverted).
var __TAG_KNOWN=null;
function __tagUnknownScan(text){
  if(!__TAG_KNOWN){__TAG_KNOWN={};var i;for(i=0;i<TAG_STRIP_NAMES.length;i++)__TAG_KNOWN[TAG_STRIP_NAMES[i]]=1;for(i=0;i<TAG_STRIP_BARE.length;i++)__TAG_KNOWN[TAG_STRIP_BARE[i]]=1;}
  var ms=text.match(/\[([A-Z][A-Z_]{1,}):/g)||[],seen={},i;
  for(i=0;i<ms.length;i++){var nm=ms[i].slice(1,-1);if(__TAG_KNOWN[nm]||seen[nm])continue;seen[nm]=1;
    console.warn("[tags] UNKNOWN tag ["+nm+":…] in GM response — not parsed, not stripped (vocabulary gap or GM invention)");}
}
