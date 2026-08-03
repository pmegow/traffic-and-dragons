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
// DESC/SIZE (E9), NPC_ALIAS/NPC_MERGE before NPC (same-turn alias resolution), COMPANION_XP
// scanned inside the XP mirror, stampQuestCompletion LAST. Never reorder without a diff-mode soak.
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
var TAG_STRIP_NAMES=["HP","GOLD","ITEM_GAINED","ITEM_LOST","ITEM_KEPT","LOCATION","NPC","XP","QUEST_STEP","QUEST","DICE","COMBAT_START","COMBAT_END","COMBAT_ROUND","ENEMY_HP","ENEMY_SLAIN","ENEMY_SURRENDERS","ABILITY_GAINED","ALIGNMENT","LORE","DECISION","FUTURE_EVENT_RESOLVED","FUTURE_EVENT","NPC_NOTE","NPC_FORGET","NPC_SUPERSEDE","NPC_PRONOUN","SPELL_USED","SPELL_DEF","SKILL_SUCCESS","CONDITION","CONDITION_REMOVED","RELATIONSHIP","RELATIONSHIP_REMOVED","SAVE_MOD","SAVE_MOD_REMOVED","LANGUAGE","STORY_BEAT","CORE_MEMORY","PARTY_MEMBER","PARTY_SPLIT","COMBAT_STATS","COMBAT_IMMUNE","COMBAT_RESIST","COMBAT_VULN","LOCATION_DESC","LOCATION_SIZE","SUBLOCATION","TIME","TIME_ADVANCE","SCHEDULE","SCHEDULE_RESOLVED","SCHEDULE_CANCEL","WEATHER","REST","LOCATION_ITEM","LOCATION_STATE","NPC_ALIAS","NPC_MERGE","NPC_LINK","FACTION","NPC_FACTION","FACTION_REL","COMPANION_HP","COMPANION_ITEM_GAINED","COMPANION_ITEM_LOST","COMPANION_ITEM_KEPT","COMPANION_SPELL_USED","COMPANION_XP","COMPANION_CONDITION","COMPANION_CONDITION_REMOVED","COMPANION_RELATIONSHIP","COMPANION_RELATIONSHIP_REMOVED","COMPANION_ABILITY","COMPANION_ALIGNMENT","ARC_COMPLETE","ARC_CONTINUE","ACT_COMPLETE","SAY","ACTIONS","RETCON"];
var TAG_STRIP_BARE=["ENEMY_SURRENDERS","ENEMY_SLAIN","SUBLOCATION_LEAVE"];/* bare ENEMY_SLAIN is UNSUPPORTED (warn, no-op) but must still strip — an unstripped bare tag leaks to the story */
// Stripped/known names that DELIBERATELY have no applyMuts handler — each with its reason.
// DICE: display-only, rendered by diceTxt. ACTIONS: legacy pre-v1.110 format, replay-only.
// RETCON: consumed at logTranscript time (RAG de-index), not a state mutation.
// SAY: dialogue attribution (#96) — consumed by deriveSpeakerMapFromTags (game.js) at narration
// time from the RAW response; display strips it, state never sees it.
// (ENEMY_SURRENDERS graduated OUT of this list at v1.264 — the UA2 phantom is now a real
// handler, implemented with multi-enemy combat per MULTI_ENEMY_COMBAT.md §3.)
var TAG_NO_HANDLER=["DICE","ACTIONS","RETCON","SAY"];
function buildCtTags(){return new RegExp("\\[("+TAG_STRIP_NAMES.join("|")+"):[^\\]]+\\]","g");}
function buildCtBare(){return new RegExp("\\[("+TAG_STRIP_BARE.join("|")+")\\]","g");}

// ── Doc registry (derives the STATE TAGS block in buildSysPrompt's STABLE half) ─────────────────
// BYTE-IDENTITY IS THE CONTRACT: buildStateTagsDoc() must reproduce the battle-tested prompt text
// exactly (engine-tested against a frozen golden + a pre/post stable-half capture). Wording
// changes are their own deliberate, A/B-tested commits — never bundled with mechanics.
var TAG_DOC_LINES=[
"STATE TAGS (use in responses, never shown to player):\n",
"[HP:+/-X] [GOLD:+/-X gp -- ALWAYS in gold pieces; 10sp=1gp, 100cp=1gp; convert before tagging] [ITEM_GAINED:name] [ITEM_LOST:name] [LOCATION:name] [XP:N]\n",
"ITEM TAG FORMAT: emit the tag once per item with the bare item name -- never bake quantities into the name (no 'Torch x3'); to grant three torches, emit [ITEM_GAINED:Torch] three times.\n",
"CONSUMABLES ARE SPENT: the moment a consumable is used -- a potion drunk, a charge detonated, ammunition fired, a scroll read -- emit [ITEM_LOST:name] in that SAME response; narrated consumption without the tag leaves a ghost item on the sheet forever\n",
"TAKING IS TAGGED: whenever the party gains possession of an item -- picked up, retrieved, looted, bought, gifted, handed over -- emit [ITEM_GAINED:name] in that SAME response; a narrated acquisition without the tag never reaches the sheet\n",
"AN ITEM IS A DISCRETE PORTABLE OBJECT: [ITEM_GAINED:] takes a thing the character could set down on a table and pick up again -- a blade, a letter, a corked vial of blood. It is NOT a substance on their hands ('blood'), NOT an observation or status note ('confirmed loft position clear'), NOT a wound, condition or state, and NEVER a person or creature; if it fails the set-it-down test, narrate it instead of tagging it\n",
"GOLD IS PHYSICS TOO: every narrated payment -- a room, a meal, a bribe, a toll, a purchase -- MUST emit [GOLD:-N] in the same response, and every earning (wages, a sale, a reward) emits [GOLD:+N]; narrated coin without the tag desyncs the sheet\n",
"QUEST GOLD: completed work of real stakes SHOULD pay gold alongside XP -- guideline roughly 10x character level in gp for minor jobs, 50x for major contracts; emit it with the completion tags\n",
"LOOT SELLS: merchants are a faucet -- when the player offers loot to a merchant, state a concrete buy price and close an accepted sale with [GOLD:+N] [ITEM_LOST:name]\n",
"TRAVEL MOVES THE MAP: any journey that ends somewhere else -- another town, a waystation, a camp on the road -- MUST emit [LOCATION:name] on arrival; [TIME:] and [WEATHER:] alone do NOT move the party, and narrating a new place while the tracker still shows the old one corrupts the geography canon\n",
"ITEM NAMES CARRY PROVENANCE: name items so their origin stays recoverable ('Vial of basilisk blood', 'Signet ring (from Sheriff Hemlock)') -- never a bare noun like 'blood'; the name is the ONLY thing the sheet keeps, so where or whom it came from must live in it\n",
"[NPC:name|status|relation] -- status=current mood/condition in 2-4 WORDS (a label like 'wary, bargaining' -- never a sentence; scene detail belongs in prose or [NPC_NOTE:]), relation=how they relate to the player (ally/enemy/acquaintance/rival/etc.); NEVER put pronouns in these fields -- pronouns go ONLY in [NPC_PRONOUN:]. [PARTY_MEMBER:name|true/false] [QUEST:title|status] [ABILITY_GAINED:Name|Desc]\n",
"NPC DEATH IS PERMANENT CANON: when a named character dies -- killed in combat, executed, assassinated, lost to any cause -- emit [NPC:name|dead|relation] in that SAME response; the engine records the death permanently (they leave the living roster and join the DECEASED line) and refuses later status writes. A dead character can return ONLY through an explicit in-story resurrection, tagged [NPC:name|resurrected|relation]. Never quietly reintroduce a dead character as alive.\n",
"REWARDS ARE PAID EXACTLY ONCE, when a quest first closes: if you correct or re-state an already-completed or failed quest (e.g. alongside a [RETCON:]), NEVER re-emit its [XP:]/[GOLD:]/[ITEM_GAINED:] -- they are already banked and a re-emission pays the player twice\n",
"[LOCATION_DESC:text] -- canonical description of this location; emit ONCE on first visit ONLY; stored permanently and never overwritten. ALWAYS name every visible exit and where each leads -- exits are canon: a way in or out that the description never mentioned does not exist\n",
"[LOCATION_SIZE:scale|travelMins] -- size of current location; scale=tiny/small/medium/large/vast; travelMins=estimated minutes to cross on foot (e.g. [LOCATION_SIZE:large|45]); emit once on first visit alongside LOCATION_DESC\n",
"[SUBLOCATION:name] -- player enters a named area within current world location (e.g. tavern common room, thieves' guild hall)\n",
"[SUBLOCATION_LEAVE] -- player exits the sub-location back to the parent world location\n",
"[TIME:time of day] -- update whenever time meaningfully advances (e.g. [TIME:dawn], [TIME:late night]); the world clock does NOT move on its own, so a night's camp, a long journey, or a rest all need this tag or the prompt keeps reporting the old time\n",
"[WEATHER:description] -- update when the weather changes (e.g. [WEATHER:heavy rain], [WEATHER:clear and cold])\n",
"[TIME_ADVANCE:N] -- EVERY turn, estimate how much time the turn COVERED and emit it so the campaign clock advances. Unit-suffixed: [TIME_ADVANCE:2h], [TIME_ADVANCE:30m], [TIME_ADVANCE:1d 6h]; a bare number is minutes. Minimum one minute. CHARGE THE WHOLE SCENE, not just the words on the page: a turn covers everything between the previous beat and this one -- getting there, waiting, the work itself, and the aftermath before the next scene begins. Two lines of dialogue in a shop are not two minutes of that character's day; they walked over, waited to be served, haggled, and left. Reference (scene-inclusive, so estimates stay consistent): a blow-by-blow combat round ~1 min; a word in passing 5-10 min; a real conversation, interrogation, or negotiation 20-45 min; searching a room or reading a scene 30-60 min; an errand, a shop visit, or asking around town 1-2 h; travel between places = hours, judge by distance. When the narration itself implies a gap ('later that evening', 'by the time you get there', the party settling in), charge the gap the story implies, not the sentence that describes it. EXCEPTION -- a full overnight sleep: do NOT estimate its duration; emit [REST:long] instead and the engine rolls the clock forward to dawn itself (any [TIME_ADVANCE:] in the same response is ignored). You only ESTIMATE durations -- the engine does all the arithmetic and every countdown; never compute or state elapsed totals or 'days remaining' yourself.\n",
"[SCHEDULE:label|when] -- register a future event at now+when (e.g. [SCHEDULE:Winter solstice|11d], [SCHEDULE:Poison wears off|10m]); 'when' is a duration (11d/3h/10m). The engine stores the target and COMPUTES the time remaining every turn -- set it ONCE and never restate the number. [SCHEDULE_RESOLVED:label] when it happens / is dealt with; [SCHEDULE_CANCEL:label] if it will no longer occur. When the CAMPAIGN CLOCK block shows an event under HAPPENING NOW, narrate it (a long-elapsed one already happened during a rest/timeskip -- narrate it as already having occurred) and emit any consequent tag, then [SCHEDULE_RESOLVED:] it.\n",
"[LOCATION_ITEM:name|placed] -- item left or hidden here (pair with [ITEM_LOST:]); [LOCATION_ITEM:name|taken] -- item removed by NPC/event (player pickup auto-handled by [ITEM_GAINED:])\n",
"[LOCATION_STATE:what changed] -- emit when the CURRENT location is MATERIALLY and durably changed (a structure collapsed or destroyed, burned, flooded, sealed, ruined by battle): the engine keeps a permanent change record per location and serves it back every turn, so the place is never again described as it was before. One short factual clause per change; never re-emit a change already on the record; transient scene dressing (weather, a mess soon cleared) does NOT qualify\n",
"[COMBAT_START:name|hp|ac|atkbonus|dmgdie|morale] -- emitting it DURING an active fight adds ANOTHER enemy to the same encounter (one tag per distinct foe; a faceless group can be one pooled entry like 'Goblin pack'). [ENEMY_HP:-X] or [ENEMY_HP:Name|-X] -- use the named form whenever more than one enemy is up. [ENEMY_SLAIN:Name] -- when your narration kills a foe OUTRIGHT (stealth kill, execution, coup de grace, environmental death), assert it with this tag; the engine zeroes them. Never invent a damage number to 'cover' a narrated kill -- [ENEMY_HP:] is for dice damage, which may leave the foe standing; a foe the engine still shows alive whom your prose declared dead is a desync. [COMBAT_ROUND:N] [COMBAT_END:victory/defeat/fled]\n",
"[COMBAT_STATS:STR:N|DEX:N|CON:N|INT:N|WIS:N|CHA:N|CR:N] -- always emit alongside COMBAT_START; use official D&D stats\n",
"[COMBAT_IMMUNE:fire,poison] [COMBAT_RESIST:cold,lightning] [COMBAT_VULN:thunder] -- omit entirely if none; comma-separated damage types only\n",
"CLOSE EVERY FIGHT: emit [COMBAT_END:...] the moment combat ends by ANY means -- not only a kill. Use [COMBAT_END:fled] when the enemy breaks off or is driven away, [COMBAT_END:truce] on a parley/surrender, [COMBAT_END:disengaged] when the party leaves the fight. A fight left unclosed sits stale in the tracker.\n",
"[ENEMY_SURRENDERS] (all remaining enemies yield) or [ENEMY_SURRENDERS:Name] (one enemy yields) -- the fight ends for that foe but they LIVE; when a surrendered foe is a speaking character, register them with [NPC:name|status|relation] in the same response so they enter the world properly\n",
"[ALIGNMENT:law+1] [ALIGNMENT:good-1] (use on morally significant choices only)\n",
"[SPELL_USED:spellname] -- emit on EVERY leveled cast (cantrips are free and never expend; use the exact spell name). MANA: casting spends mana equal to the spell's tier -- the sheet shows Mana current/max; never narrate a cast the pool cannot cover. ONE exception: a NECROMANCER may cast beyond an empty pool, and the engine automatically pays their blood price per missing point -- NEVER emit [HP:] for that price (it would double-charge). Racial 1/day spells spend no mana and recharge at dawn.\n",
"SPELL RANGES ARE PHYSICS: before any cast resolves, judge the distance CONCRETELY against the spell's listed range using the GEOGRAPHY block's location size -- a target in another building, street, or district, or whose current location is unknown, is BEYOND any short-range spell (~120ft or less) no matter how urgent the player's intent; narrate the failed reach and offer what the listed range actually allows\n",
"[SPELL_DEF:Name|range=X|targets=Y|duration=Z|effect=...|cost=slot|tier=1|category=arcane,divine|magical=yes] -- ONLY when a spell is cast that is NOT already in the CANONICAL SPELL RULES list (one you invented or a homebrew): define its canon ONCE so the engine pins it and it can never drift. '=' per field, '|' between fields; category is a comma-separated tradition list (arcane/divine/primal/necromantic/martial); keep effect free of '|' and ']'. Recorded once, re-injected forever -- do not redefine a spell already listed.\n",
"[REST:long] when the party completes a full/long rest (a night's sleep) -- refills every party member's MANA pool and restores 1/day racial spells, and rolls the campaign clock forward to DAWN of the next day (days run dawn to dawn -- never emit [TIME_ADVANCE:] for the sleep itself); also emit [TIME:dawn] so the scene time matches, and narrate HP recovery with [HP:+N] as usual\n",
"[FUTURE_EVENT_RESOLVED:what] (when a pending future event occurs)\n",
"[LORE:fact] [DECISION:description] [FUTURE_EVENT:what|when] [NPC_NOTE:name|note] [NPC_PRONOUN:name|she/her]\n",
"[NPC_FORGET:name|person or event] -- erase one specific memory from an NPC (emit when the Oubliate spell is cast and the WIS save fails); the engine scrubs that fact from what the NPC knows so it cannot resurface\n",
"[NPC_SUPERSEDE:name|outdated fact|current truth] -- when a revelation makes something on an NPC's record WRONG (an identity confirmed, a lie exposed, a belief corrected): the engine retires the outdated fact and records the truth so the two are never served side by side. If the reveal shows two known NPCs are the SAME person, also emit [NPC_MERGE:canonical|duplicate]\n",
"[RETCON:what was corrected] -- emit whenever you correct, rewind, or retract something you previously narrated (including after an out-of-character correction from the player); the engine de-indexes the superseded narration from episodic memory so the wrong version can never resurface as truth\n",
"[NPC_ALIAS:canonical_name|alias] -- when a character is given a new name or title; links alias to canonical; prevents duplicate entries; emit alongside the NPC tag that introduces the alias. If the named character is the PLAYER or a party member, the alias is recorded as a TITLE/EPITHET on their character sheet ('Butcher of Ashfen') -- epithets are YOURS to grant, only at dramatic moments the story has earned: NEVER emit one because the player asks for, invents, or declares a title for themselves (deflect self-titling in prose -- names are given by the world, not taken); the player may reject a granted epithet from their sheet\n",
"[NPC_MERGE:canonical_name|duplicate_name] -- when two NPC entries turn out to be the same person; absorbs events/knowledge from duplicate into canonical and removes duplicate\n",
"[NPC_LINK:name1|name2|relationship] -- relationship between two named characters (NPC↔NPC or NPC↔player); emit when establishing or changing how two characters relate (e.g. [NPC_LINK:Zarith|Guard Captain|employer/employee], [NPC_LINK:Borin|player|old debt]); updates existing link if already set\n",
"[FACTION:name|desc] -- register or update a faction, guild, order, or organisation (e.g. [FACTION:The Black Hand|criminal thieves guild controlling the docks]); use on first mention\n",
"[NPC_FACTION:npcName|factionName|role] -- assign an NPC to a faction with their role (e.g. [NPC_FACTION:Zarith|The Black Hand|enforcer]); auto-registers the faction if unknown\n",
"[FACTION_REL:faction1|faction2|relationship] -- relationship between two factions (e.g. [FACTION_REL:The Black Hand|City Watch|bitter enemies], [FACTION_REL:Merchant Guild|City Watch|uneasy allies])\n",
"[SKILL_SUCCESS:skill_id] -- on a successful skilled action (exact ids: Jumping, Sprinting, Lifting, Grappling, Climbing, Swimming, Distance Running, Riding, Hold Breath, Endure Pain, Tolerate Alcohol/Drugs, Foraging, Cooking, Survival, Animal Handling, Navigation, Tracking, Arcana, Lore, Investigation, Nature, First Aid, Alchemy, Smithing, Handcraft, Persuasion, Deception, Intimidation, Performance, Trading, Stealth, Sleight of Hand, Lockpicking, Gambling, Perception, Insight)\n",
"[SKILL_SUCCESS:Tracking] covers both wilderness tracking (following prey or people by physical signs) and urban tailing (shadowing a mark through crowds, alleys, or city streets). Use WIS for reading the environment, INT for anticipating movement patterns.\n",
"[CONDITION:name|duration|cause] [CONDITION_REMOVED:name] -- duration is descriptive (e.g. 'until antidote', 'saving throw each hour CON DC 15'); cause = what inflicted it (e.g. 'Reaper Spider bite') -- ALWAYS name the cause so the sheet carries the why\n",
"[RELATIONSHIP:entity|descriptor] [RELATIONSHIP_REMOVED:entity] -- entity=NPC or faction; descriptor=Allied/Rival/Wanted/Hunted/Indebted/Marked/Feared/etc.\n",
"[SAVE_MOD:source|type|amount] [SAVE_MOD_REMOVED:source] -- type=stat (CON/DEX/etc.) or threat (Poison/Fire/Cold/Lightning/Fear/Charm/Psionic/Holy/Shadow/Disease/Magic/Other); amount=integer\n",
"[LANGUAGE:name|fluent] or [LANGUAGE:name|broken] -- when character learns or improves a language\n",
"[STORY_BEAT:one sentence] -- major narrative milestone; use sparingly for truly significant moments only. Concrete triggers, one beat per such moment: a companion joins or leaves the party, an oath or bargain is struck, a major revelation lands, first blood is drawn in a significant conflict, a quest completes\n",
"[CORE_MEMORY:subject|one sentence] -- a PERMANENT defining moment filed onto every present party member's sheet and kept in front of you forever. Use RARELY -- only for moments that must never be forgotten: a wedding, a sworn vow, a betrayal, a life-changing revelation. The engine already auto-files near-death, party joins/leaves, deaths, and weighty bond changes -- never duplicate those. subject = the character the moment is about; name BOTH parties in the sentence so it reads true on every sheet\n",
"[SAY:Character Name] -- VOICE ATTRIBUTION: place immediately BEFORE every line of spoken dialogue, naming its speaker, e.g. [SAY:Frizwick]\"Don't jinx it,\" Frizwick mutters. Tag EVERY quoted line -- including the player character's own lines (use their character NAME, never 'you'). Use the speaker's exact registered name; omit the tag only for unnamed incidental speakers. The tag is invisible to the player and tells the narrator engine which voice performs the line -- an untagged line is read in the narrator's voice.\n",
"[ARC_COMPLETE:arc title] -- emit when the current arc's objective is fulfilled; advances to the next arc\n",
"[ARC_CONTINUE:arc title|why it remains open] -- the OTHER answer to an ARC DRIFT CHECK: the arc is genuinely unfinished. Records your reason and resets the check timer. Every drift check must be answered with this or [ARC_COMPLETE:] -- never left unanswered\n",
"[ACT_COMPLETE:act title] -- emit when the act's turning point occurs; advances to the next act\n",
"COMPANION SHEET TAGS — use these (not the player tags) when the event affects a named party member, not the player:\n",
"[COMPANION_HP:Name|+/-N] [COMPANION_ITEM_GAINED:Name|item] [COMPANION_ITEM_LOST:Name|item] [COMPANION_XP:Name|N]\n",
"[COMPANION_CONDITION:Name|condName|duration|cause] [COMPANION_CONDITION_REMOVED:Name|condName]\n",
"[COMPANION_RELATIONSHIP:Name|entity|descriptor] [COMPANION_RELATIONSHIP_REMOVED:Name|entity]\n",
"[COMPANION_ABILITY:Name|abilityName|desc] [COMPANION_ALIGNMENT:Name|law+1]\n",
"[COMPANION_SPELL_USED:Name|spellname] -- when a PARTY MEMBER casts a leveled spell (cantrips never expend; use the exact spell name). Same mana economy, spent from THEIR own pool (shown on their party sheet). The player's own casts keep [SPELL_USED:].\n",
"[PARTY_SPLIT:Name|Location] or [PARTY_SPLIT:Name|Location|Sublocation] -- a party member strikes out on their OWN: they are at that location, away from the party, until you emit [PARTY_SPLIT:Name|rejoin] when they return. Split members move ONLY via this tag -- bare [LOCATION:] moves the main party and NEVER touches them. The player character cannot split (the story camera follows them).\n",
"Use the companion's exact name as it appears in the party list. Apply the same upkeep rules as for the player.\n",
"THE MOMENT an NPC agrees to travel with the party — even conditionally or provisionally — you MUST emit [PARTY_MEMBER:name|true] in that same response; never narrate a joining without the tag.\n",
"XP IS SHARED AUTOMATICALLY: every [XP:N] you award is mirrored by the engine to all party members. Use [COMPANION_XP:Name|N] ONLY for a bonus one companion earns alone — never re-emit a shared award with it.\n\n"
];
function buildStateTagsDoc(){return TAG_DOC_LINES.join("");}

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
    var cn=resolveNpcName(String(f[i].name||"").trim());
    var w=wsNpcByName(cn);
    if(!w||npcIsDead(w))continue;
    w.dead=R.turn;w.status="slain";
    if(memory.npcs[cn]&&!memory.npcs[cn].dead)memory.npcs[cn].dead=R.turn;
    R.muts.push(w.name+": dead (combat, t"+R.turn+")");
    if(typeof console!=="undefined")console.warn("[combat] slain foe "+w.name+" is a registered NPC — DECEASED stamped (B3)");
  }
}
function combatFoeByName(nm){
  var f=(worldState.combat&&worldState.combat.foes)||[],i,t=String(nm||"").toLowerCase().trim();
  for(i=0;i<f.length;i++){if(f[i].name.toLowerCase()===t)return f[i];}
  for(i=0;i<f.length;i++){var fn=f[i].name.toLowerCase();if(fn.indexOf(t)>=0||t.indexOf(fn)>=0)return f[i];}
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
var TAG_TABLE=[
{t:"HP",apply:function(text,R){var hpTags=text.match(/\[HP:\s*([+-]?\d+)[^\]]*\]/g)||[];if(!hpTags.length)return;
  // UA8: a save that escaped migration can carry non-finite hp/maxHp — the clamp math below
  // would then poison hp to NaN permanently. Heal with migrateWorldState's exact semantics
  // (maxHp FIRST — audit E71), loudly.
  var hpc=worldState.character;
  if(typeof hpc.maxHp!=="number"||!isFinite(hpc.maxHp)){console.warn("[tags] non-finite maxHp ("+hpc.maxHp+") healed before [HP:] apply (UA8)");hpc.maxHp=(typeof hpc.hp==="number"&&isFinite(hpc.hp)&&hpc.hp>0)?hpc.hp:8;}
  if(typeof hpc.hp!=="number"||!isFinite(hpc.hp)){console.warn("[tags] non-finite hp ("+hpc.hp+") healed before [HP:] apply (UA8)");hpc.hp=hpc.maxHp||8;}
  var hpi;for(hpi=0;hpi<hpTags.length;hpi++){var hpm=hpTags[hpi].match(/\[HP:\s*([+-]?\d+)[^\]]*\]/);if(!hpm)continue;var dv=parseInt(hpm[1]);worldState.character.hp=Math.min(worldState.character.maxHp,Math.max(0,worldState.character.hp+dv));R.muts.push(dv>0?"Healed "+dv+" HP":"Took "+Math.abs(dv)+" damage");}}},
{t:"GOLD",apply:function(text,R){var goldTags=text.match(/\[GOLD:\s*([+-]?\d+)[^\]]*\]/g)||[];var gli;for(gli=0;gli<goldTags.length;gli++){var glm=goldTags[gli].match(/\[GOLD:\s*([+-]?\d+)[^\]]*\]/);if(!glm)continue;var dg=parseInt(glm[1]);worldState.character.gold=Math.max(0,worldState.character.gold+dg);R.muts.push(dg>0?"+"+dg+" gp":dg+" gp");}}},
{t:"ITEM_GAINED",apply:function(text,R){var igTags=text.match(/\[ITEM_GAINED:([^\]]+)\]/g)||[];var igi;for(igi=0;igi<igTags.length;igi++){var igm=igTags[igi].match(/\[ITEM_GAINED:([^\]]+)\]/);if(!igm)continue;var igq=_qtyParse(igm[1]),igqi;for(igqi=0;igqi<igq.n;igqi++)addInventoryItem(worldState.character.inventory,igq.base);R.muts.push("+"+igq.base+(igq.n>1?" x"+igq.n:""));autoTakeLocationItem(igq.base);}}},
{t:"ITEM_LOST",apply:function(text,R){var ilTags=text.match(/\[ITEM_LOST:([^\]]+)\]/g)||[];var ili;for(ili=0;ili<ilTags.length;ili++){var ilm=ilTags[ili].match(/\[ITEM_LOST:([^\]]+)\]/);if(!ilm)continue;var ilq=_qtyParse(ilm[1]),ilqi;for(ilqi=0;ilqi<ilq.n;ilqi++)removeInventoryItem(worldState.character.inventory,ilq.base);R.muts.push("-"+ilq.base+(ilq.n>1?" x"+ilq.n:""));}}},
// #60b: the CONSUMABLE CHECK's negative answer. Not a sheet mutation — it records that the GM
// confirmed "not spent" at the item's current count, so the check stops re-asking (see
// _stampItemKept, api.js, for the feedback loop this closes). Ordered AFTER ITEM_LOST so the
// latched count reflects any spend applied in the same response. No R.muts push: nothing changed
// on the sheet, and a "kept" line in the mutation summary would be noise.
{t:"ITEM_KEPT",apply:function(text,R){var ikTags=text.match(/\[ITEM_KEPT:([^\]]+)\]/g)||[];var iki;for(iki=0;iki<ikTags.length;iki++){var ikm=ikTags[iki].match(/\[ITEM_KEPT:([^\]]+)\]/);if(!ikm)continue;_stampItemKept(null,worldState.character.inventory,ikm[1].trim());}}},
{t:"LOCATION",apply:function(text,R){var loc=text.match(/\[LOCATION:([^\]]+)\]/);if(loc){var _lname=loc[1].trim();var _prevLoc=worldState.world.location;fileLocation(_lname,"",R.turn);worldState.world.location=_lname;worldState.world.sublocation=null;R.muts.push("-> "+_lname);
  // F2 (v1.216) generalized for multi-foe (v1.264): a WORLD-location change means the whole
  // encounter is over — the party traveled away. The old exemption relied on COMBAT_START
  // OVERWRITING; under add-a-foe semantics skipping the clear would leak the old location's
  // foes into the new fight, so the clear now runs UNCONDITIONALLY on a real move — silently
  // (no stale-warn, no muts line) when the same response opens a fresh fight, since the new
  // COMBAT_START immediately rebuilds the tracker (preserves v1.216's observable behavior).
  if(worldState.combat&&_lname!==_prevLoc){
    var _freshFight=/\[COMBAT_START:/.test(text);
    var _staleFoe=(worldState.combat.foes||[]).map(function(f){return f.name;}).join(", ")||"?";
    propagateSlainFoes(R);/* B3: foes already slain before the party moved on still get their durable stamp */
    worldState.combat=null;
    if(!_freshFight){R.muts.push("Combat ended (left the area)");if(typeof console!=="undefined")console.warn("[combat] auto-cleared stale combat ("+_staleFoe+") on move to "+_lname+" — GM emitted no [COMBAT_END:]");}}}}},
{t:"SUBLOCATION",apply:function(text,R){var sloctag=text.match(/\[SUBLOCATION:([^\]]+)\]/);if(sloctag){worldState.world.sublocation=sloctag[1].trim();fileSubLocation(sloctag[1].trim(),R.turn);R.muts.push("Sub: "+sloctag[1].trim());}}},
{t:"SUBLOCATION_LEAVE",apply:function(text,R){if(/\[SUBLOCATION_LEAVE\]/.test(text)){worldState.world.sublocation=null;R.muts.push("Left sub-location");}}},
{t:"TIME",apply:function(text,R){var timeTag=text.match(/\[TIME:([^\]]+)\]/);if(timeTag){worldState.world.time=timeTag[1].trim();R.muts.push("Time: "+timeTag[1].trim());}}},
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
{t:"SCHEDULE",apply:function(text,R){var ss=text.match(/\[SCHEDULE:([^\]]+)\]/g)||[],i;for(i=0;i<ss.length;i++){var m=ss[i].match(/\[SCHEDULE:([^|\]]+)\|([^\]]+)\]/);if(!m)continue;var ev=scheduleAdd(m[1],m[2]);if(ev)R.muts.push("Scheduled: "+ev.label+" ("+fmtGap(ev.dueMin-clockNow())+")");}}},
{t:"SCHEDULE_RESOLVED",apply:function(text,R){var ss=text.match(/\[SCHEDULE_RESOLVED:([^\]]+)\]/g)||[],i;for(i=0;i<ss.length;i++){var m=ss[i].match(/\[SCHEDULE_RESOLVED:([^\]]+)\]/);if(m&&scheduleRemove(m[1]))R.muts.push("Event resolved: "+m[1].trim());}}},
{t:"SCHEDULE_CANCEL",apply:function(text,R){var ss=text.match(/\[SCHEDULE_CANCEL:([^\]]+)\]/g)||[],i;for(i=0;i<ss.length;i++){var m=ss[i].match(/\[SCHEDULE_CANCEL:([^\]]+)\]/);if(m&&scheduleRemove(m[1]))R.muts.push("Event cancelled: "+m[1].trim());}}},
{t:"LOCATION_DESC",apply:function(text,R){var ldesc=text.match(/\[LOCATION_DESC:([^\]]+)\]/);if(ldesc)fileLocationDesc(ldesc[1]);}},
{t:"LOCATION_SIZE",apply:function(text,R){var lsize=text.match(/\[LOCATION_SIZE:([^|]+)\|([^\]]+)\]/);if(lsize){var lsKey=currentNodeKey();/* UA9 */if(memory.map&&memory.map.nodes[lsKey]){memory.map.nodes[lsKey].size=lsize[1].trim();memory.map.nodes[lsKey].travelMins=parseInt(lsize[2])||null;}}}},
{t:"LOCATION_ITEM",apply:function(text,R){var locItms=text.match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/g)||[];var lii;for(lii=0;lii<locItms.length;lii++){var lip=locItms[lii].match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/);if(!lip)continue;fileLocationItem(lip[1].trim(),lip[2],R.turn);R.muts.push(lip[2]==="placed"?"Left: "+lip[1].trim():"Taken: "+lip[1].trim());}}},
// #105 (B17): the durable state-change record — a place the party materially changed must never
// again be served as intact. Append-only via fileLocationState (memory.js; the write-once
// description is untouched); read back by buildGeoBlock (current node, beside the frozen
// description) and buildChangedLocationsBlock (the always-present remote roll-up, api.js).
// Ordered AFTER LOCATION so a move + a state note in one response land on the NEW node.
{t:"LOCATION_STATE",apply:function(text,R){var lsTags=text.match(/\[LOCATION_STATE:([^\]]+)\]/g)||[];var lsi;for(lsi=0;lsi<lsTags.length;lsi++){var lsm=lsTags[lsi].match(/\[LOCATION_STATE:([^\]]+)\]/);if(!lsm)continue;if(fileLocationState(lsm[1].trim(),R.turn))R.muts.push("Location changed: "+lsm[1].trim().slice(0,60));}}},
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
  if(!memory.npcs[alCanon])memory.npcs[alCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[alCanon].aliases)memory.npcs[alCanon].aliases=[];if(memory.npcs[alCanon].aliases.indexOf(alAlias)<0)memory.npcs[alCanon].aliases.push(alAlias);var _alWs=wsNpcByName(alCanon);if(_alWs){if(!_alWs.aliases)_alWs.aliases=[];if(_alWs.aliases.indexOf(alAlias)<0)_alWs.aliases.push(alAlias);}R.muts.push("Alias: "+alAlias+" -> "+alCanon);}}},
{t:"NPC_MERGE",apply:function(text,R){var npcMergeTags=text.match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/g)||[];var mgii;for(mgii=0;mgii<npcMergeTags.length;mgii++){var mgp=npcMergeTags[mgii].match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/);if(!mgp)continue;var mgCanon=mgp[1].trim(),mgDupe=mgp[2].trim();if(memory.npcs[mgDupe]){if(!memory.npcs[mgCanon])memory.npcs[mgCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[mgCanon].aliases)memory.npcs[mgCanon].aliases=[];if(memory.npcs[mgCanon].aliases.indexOf(mgDupe)<0)memory.npcs[mgCanon].aliases.push(mgDupe);var mgevs=memory.npcs[mgDupe].events||[],mgevi;for(mgevi=0;mgevi<mgevs.length;mgevi++)memory.npcs[mgCanon].events.push(mgevs[mgevi]);var mgkns=memory.npcs[mgDupe].knowledge||[],mgkni;for(mgkni=0;mgkni<mgkns.length;mgkni++){if(memory.npcs[mgCanon].knowledge.indexOf(mgkns[mgkni])<0)memory.npcs[mgCanon].knowledge.push(mgkns[mgkni]);}if(memory.npcs[mgCanon].knowledge.length>12)memory.npcs[mgCanon].knowledge=memory.npcs[mgCanon].knowledge.slice(-12);/* TODO#69: re-slice to the write-site cap after a merge concat (E50 parallel) — the shift-based cap at the write sites only sheds 1/write, so an overfill would otherwise feed memoryNpcDetail oversized for a long time */if(memory.npcs[mgDupe].aliases){var mgals=memory.npcs[mgDupe].aliases,mgali;for(mgali=0;mgali<mgals.length;mgali++){if(memory.npcs[mgCanon].aliases.indexOf(mgals[mgali])<0)memory.npcs[mgCanon].aliases.push(mgals[mgali]);}}if(!memory.npcs[mgCanon].firstEncounter&&memory.npcs[mgDupe].firstEncounter)memory.npcs[mgCanon].firstEncounter=memory.npcs[mgDupe].firstEncounter;if(memory.npcs[mgDupe].dead&&!memory.npcs[mgCanon].dead)memory.npcs[mgCanon].dead=memory.npcs[mgDupe].dead;/* B3: a merge must not lose the dupe's death */delete memory.npcs[mgDupe];}
  var _mgDupN=wsNpcByName(mgDupe),_mgCanN=wsNpcByName(mgCanon);/* #7: shared lookup (degenerate X|X merge still nets to entry removed, same as the old single-pass else-if) */
  if(_mgDupN){
    if(!_mgCanN){_mgCanN={name:mgCanon,status:_mgDupN.status||"unknown",rel:_mgDupN.rel||"unknown",met:_mgDupN.met||R.turn,partyMember:false,portrait:null,aliases:[]};worldState.npcs.push(_mgCanN);}
    if(_mgDupN.partyMember)_mgCanN.partyMember=true;
    if(_mgDupN.charSheet&&!_mgCanN.charSheet)_mgCanN.charSheet=_mgDupN.charSheet;
    if(_mgDupN.portrait&&!_mgCanN.portrait)_mgCanN.portrait=_mgDupN.portrait;
    if(_mgDupN.portraitOffset&&!_mgCanN.portraitOffset)_mgCanN.portraitOffset=_mgDupN.portraitOffset;
    if(_mgDupN.pronouns&&!_mgCanN.pronouns)_mgCanN.pronouns=_mgDupN.pronouns;
    if(_mgDupN.dead&&!_mgCanN.dead)_mgCanN.dead=_mgDupN.dead;/* B3: a merge must not lose the dupe's death */
    if((!_mgCanN.status||_mgCanN.status==="unknown")&&_mgDupN.status)_mgCanN.status=_mgDupN.status;
    if((!_mgCanN.rel||_mgCanN.rel==="unknown")&&_mgDupN.rel)_mgCanN.rel=_mgDupN.rel;
    if(typeof _mgDupN.met==="number"&&(typeof _mgCanN.met!=="number"||_mgDupN.met<_mgCanN.met))_mgCanN.met=_mgDupN.met;
  }
  worldState.npcs=worldState.npcs.filter(function(n){return n.name!==mgDupe;});
  if(memory.npcGraph){var _mge=memory.npcGraph.edges||[],_mgei;for(_mgei=0;_mgei<_mge.length;_mgei++){if(_mge[_mgei].a===mgDupe)_mge[_mgei].a=mgCanon;if(_mge[_mgei].b===mgDupe)_mge[_mgei].b=mgCanon;}var _mgnf=memory.npcGraph.npcFactions;if(_mgnf&&_mgnf[mgDupe]){if(!_mgnf[mgCanon])_mgnf[mgCanon]=_mgnf[mgDupe];else _mgnf[mgCanon]=_mgnf[mgCanon].concat(_mgnf[mgDupe]);delete _mgnf[mgDupe];}}if(worldState.character.relationships){var rgj,newRels2=[],seenRel={};for(rgj=0;rgj<worldState.character.relationships.length;rgj++){var rent=worldState.character.relationships[rgj].entity;if(rent===mgDupe)worldState.character.relationships[rgj].entity=mgCanon;var rkey=worldState.character.relationships[rgj].entity;if(!seenRel[rkey]){seenRel[rkey]=true;newRels2.push(worldState.character.relationships[rgj]);}}worldState.character.relationships=newRels2;}R.muts.push("Merged: "+mgDupe+" -> "+mgCanon);}}},
// MOOD/RELATION SEPARATION (v1.372): the status and relation slots accept EMPTY (`*` not `+`) so
// the GM can update one field without restating the other — `[NPC:Name||ally]` sets the relation
// and leaves the mood alone. Before this, an empty slot failed the whole regex and the tag was
// dropped SILENTLY (both fields lost, no warn) — so the format's only options were "invent a value
// for every slot" or "lose the write", and inventing is what put relation words like "acquaintance"
// into mood fields. The write path below ALREADY had the right semantics (`if(npStatus)` = leave
// unchanged); only the parse couldn't express it.
{t:"NPC",apply:function(text,R){var npcs=text.match(/\[NPC:([^|\]]+)\|([^|\]]*)(?:\|([^|\]]*))?\]/g)||[];var ni;for(ni=0;ni<npcs.length;ni++){var np=npcs[ni].match(/\[NPC:([^|\]]+)\|([^|\]]*)(?:\|([^|\]]*))?\]/);if(!np)continue;var npName=resolveNpcName(np[1].trim());
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
    if(npStatus&&!_npN.dead&&npcDeadStatus(npStatus)){_npN.dead=R.turn;R.muts.push(npName+": dead (t"+R.turn+")");}}
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
  if(!memory.npcs[npName])memory.npcs[npName]={attitude:"",knowledge:[],events:[],aliases:[]};if(_npN&&_npN.dead&&!memory.npcs[npName].dead)memory.npcs[npName].dead=_npN.dead;/* B3: mirror the stamp */if(!memory.npcs[npName].firstEncounter)memory.npcs[npName].firstEncounter=R.feGet();if(npPron)memory.npcs[npName].pronouns=npPron;if(!_npWasDead)mapNpcLocation(npName);/* B3: a re-mention must not drag a dead NPC's last-seen node to the party's location — the dead don't travel */R.muts.push("NPC: "+npName);}}},
{t:"XP",apply:function(text,R){var xpTags=text.match(/\[XP:\s*\+?(\d+)[^\]]*\]/g)||[];var xpi;for(xpi=0;xpi<xpTags.length;xpi++){var xpm=xpTags[xpi].match(/\[XP:\s*\+?(\d+)[^\]]*\]/);if(!xpm)continue;worldState.character.xp+=parseInt(xpm[1]);R.muts.push("+"+xpm[1]+" XP");checkLevelUp();R._xpMirror(parseInt(xpm[1]));}}},
{t:"QUEST",apply:function(text,R){var quests=text.match(/\[QUEST:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var qi;for(qi=0;qi<quests.length;qi++){var qp=quests[qi].match(/\[QUEST:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/);if(!qp)continue;var qTitle=qp[1].trim(),qStat=qp[2].trim().toLowerCase(),qDesc=qp[3]?qp[3].trim():"";if(qStat==="complete"||qStat==="done"||qStat==="finished")qStat="completed";else if(qStat==="abandoned"||qStat==="dropped")qStat="failed";else if(qStat==="accepted")qStat="active";else if(qStat==="declined")qStat="failed";var qIdx=-1,qj;for(qj=0;qj<worldState.questLog.length;qj++){if(worldState.questLog[qj].title.toLowerCase()===qTitle.toLowerCase()){qIdx=qj;break;}}
  // UA42/F3: a title already ARCHIVED as completed/failed must not silently resurrect via a
  // bare upsert (Playtest 2: 'Chapel in the Mud' completed t7, re-created by [QUEST:x|active]
  // at t9 and t60 — archived AND live at once, rewards payable twice). Loud skip — a genuine
  // follow-up quest needs a NEW title. Case-insensitive scan mirrors the live-log matching
  // above (memory.quests is keyed by original-case title — no direct key hit).
  if(qIdx<0&&memory.quests){var _ak=Object.keys(memory.quests),_ai,_arch=null;
    for(_ai=0;_ai<_ak.length;_ai++){if(_ak[_ai].toLowerCase()===qTitle.toLowerCase()){_arch=memory.quests[_ak[_ai]];break;}}
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
  if(qIdx<0){worldState.questLog.push({title:qTitle,status:qStat,desc:qDesc,objectives:[],started:R.turn});if(qStat==="offered"){if(typeof Sound!=="undefined")Sound.play("click_glass");/* TODO #7: side-effect only — never touches parse/mutation flow. BEFORE the toast so it claims the playIfQuiet window and the toast-level poke steps aside */if(typeof showToast==="function")showToast("⚑ Quest opportunity: "+qTitle);R.muts.push("Quest offered: "+qTitle);}else R.muts.push("Quest: "+qTitle+" ("+qStat+")");}else{var qq=worldState.questLog[qIdx];qq.status=qStat;if(qDesc)qq.desc=qDesc;R.muts.push("Quest "+qTitle+": "+qStat);}
  if(qStat==="completed"||qStat==="failed"){
    // UA42: player-visible closure — the toast names the same-response rewards so a close never
    // again passes in silence (two Playtest-2 completions had ZERO feedback). Positive gold only:
    // a same-response deduction is not a reward.
    var _rw=[],_rx=text.match(/\[XP:\s*\+?(\d+)/);if(_rx)_rw.push("+"+_rx[1]+" XP");
    var _rg=text.match(/\[GOLD:\s*\+?(\d+)/);if(_rg)_rw.push("+"+_rg[1]+" gp");/* \+?(\d+) cannot match a minus — deductions never read as rewards */
    var _ri=(text.match(/\[ITEM_GAINED:[^\]]+\]/g)||[]).length;if(_ri)_rw.push(_ri+" item"+(_ri>1?"s":""));
    if(typeof showToast==="function")showToast((qStat==="completed"?"✓ Quest completed: ":"✗ Quest failed: ")+qTitle+(_rw.length?" — "+_rw.join(", "):""));
    archiveQuest(qTitle,qStat);
    // P3-F2: record what this close paid (reusing the UA42 parse above) so the reopen guard
    // can recognize a reward re-emission later. Case-insensitive key scan mirrors the guard's.
    if(_rx||_rg){var _pk=Object.keys(memory.quests||{}),_pi;for(_pi=0;_pi<_pk.length;_pi++){
      if(_pk[_pi].toLowerCase()===qTitle.toLowerCase()){memory.quests[_pk[_pi]].paid={xp:_rx?parseInt(_rx[1]):0,gold:_rg?parseInt(_rg[1]):0};break;}}}}}}},
{t:"QUEST_STEP",apply:function(text,R){var qsteps=text.match(/\[QUEST_STEP:([^|\]]+)\|([^|\]]+)\|?([^\]]*)\]/g)||[];var qsi;for(qsi=0;qsi<qsteps.length;qsi++){var qsp=qsteps[qsi].match(/\[QUEST_STEP:([^|\]]+)\|([^|\]]+)\|?([^\]]*)\]/);if(!qsp)continue;var qsTitle=qsp[1].trim(),qsObj=qsp[2].trim(),qsDone=/^(true|done|1|yes|x)$/i.test((qsp[3]||"").trim());var qsq=null,qk;for(qk=0;qk<worldState.questLog.length;qk++){if(worldState.questLog[qk].title.toLowerCase()===qsTitle.toLowerCase()){qsq=worldState.questLog[qk];break;}}if(!qsq)continue;if(qsq.status==="offered")continue;if(!qsq.objectives)qsq.objectives=[];var ofound=false,oj2;for(oj2=0;oj2<qsq.objectives.length;oj2++){if(qsq.objectives[oj2].text.toLowerCase()===qsObj.toLowerCase()){qsq.objectives[oj2].done=qsDone;ofound=true;break;}}if(!ofound)qsq.objectives.push({text:qsObj,done:qsDone});R.muts.push(qsTitle+(qsDone?" ✓ ":" + ")+qsObj);}}},
// UA26: multi-match g-loop (legacy matched only the FIRST tag — the H2 class: 18/150 Haiku turns
// emitted a second COMBAT_START during a fight and it was silently lost). No combat → start the
// encounter; combat active → ADD a foe; duplicate living name → re-emission, ignored + warn;
// 9th foe → runaway-model guard (cap 8, ratified decision 4).
{t:"COMBAT_START",apply:function(text,R){
  var csTags=text.match(/\[COMBAT_START:([^|\]]+)\|(\d+)\|(\d+)\|([+-]?\d+)\|([^|]+)\|([^\]]+)\]/g)||[];var csi;
  for(csi=0;csi<csTags.length;csi++){
    var cs2=csTags[csi].match(/\[COMBAT_START:([^|\]]+)\|(\d+)\|(\d+)\|([+-]?\d+)\|([^|]+)\|([^\]]+)\]/);if(!cs2)continue;
    var foe={name:cs2[1].trim(),hp:parseInt(cs2[2]),maxHp:parseInt(cs2[2]),ac:parseInt(cs2[3]),atk:parseInt(cs2[4]),dmg:cs2[5].trim(),morale:cs2[6].trim()};
    if(!worldState.combat){worldState.combat={round:1,engaged:null,foes:[foe]};R.muts.push("Combat: "+foe.name);continue;}
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
    if(foe.hp<=0){foe.down="slain";worldState.combat.engaged=null;}
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
    kfoe.hp=0;kfoe.down="slain";R.muts.push(kfoe.name+" slain");
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
  if(ce){propagateSlainFoes(R);/* B3: stamp registered-NPC kills BEFORE the tracker vanishes */worldState.combat=null;R.muts.push("Combat: "+ce[1].trim());return;}
  if(!worldState.combat)return;
  var f=worldState.combat.foes,i,anyUp=false,surr=false,names=[];
  for(i=0;i<f.length;i++){if(!f[i].down&&f[i].hp>0){anyUp=true;break;}
    if(f[i].down==="surrendered")surr=true;names.push(f[i].name);}
  if(anyUp||!f.length)return;
  propagateSlainFoes(R);/* B3: auto-close path — same stamp */
  worldState.combat=null;
  R.muts.push(surr?"Combat: surrender ("+names.join(", ")+")":"Combat: victory ("+names.join(", ")+")");}},
{t:"ABILITY_GAINED",apply:function(text,R){var abs=text.match(/\[ABILITY_GAINED:([^|\]]+)\|([^\]]+)\]/g)||[];var abi;for(abi=0;abi<abs.length;abi++){var abp=abs[abi].match(/\[ABILITY_GAINED:([^|\]]+)\|([^\]]+)\]/);if(!abp)continue;if(!worldState.character.abilities)worldState.character.abilities=[];var already=false,abj;for(abj=0;abj<worldState.character.abilities.length;abj++){if(worldState.character.abilities[abj].nm===abp[1]){already=true;break;}}if(!already){worldState.character.abilities.push({nm:abp[1],ds:abp[2],gained:R.turn});R.muts.push("Ability: "+abp[1]);}}}},
{t:"ALIGNMENT",apply:function(text,R){var alms=text.match(/\[ALIGNMENT:(law|good)([+-]\d+)\]/gi)||[];var ali;for(ali=0;ali<alms.length;ali++){var ap=alms[ali].match(/\[ALIGNMENT:(law|good)([+-]\d+)\]/i);if(ap){if(!worldState.character.alignLaw)worldState.character.alignLaw=0;if(!worldState.character.alignGood)worldState.character.alignGood=0;if(ap[1].toLowerCase()==="law")worldState.character.alignLaw=Math.max(-3,Math.min(3,worldState.character.alignLaw+parseInt(ap[2])));else worldState.character.alignGood=Math.max(-3,Math.min(3,worldState.character.alignGood+parseInt(ap[2])));var newAl=alignLabel(worldState.character.alignLaw,worldState.character.alignGood);if(newAl!==worldState.character.actualAlignment){R.muts.push("Align: "+newAl);worldState.character.actualAlignment=newAl;}}}}},
{t:"SPELL_USED",apply:function(text,R){var spellUsed=text.match(/\[SPELL_USED:([^\]]+)\]/g)||[];var sui;for(sui=0;sui<spellUsed.length;sui++){var sup=spellUsed[sui].match(/\[SPELL_USED:([^\]]+)\]/);if(sup&&worldState.character.spells){var spNm=sup[1].toLowerCase().trim(),spj;for(spj=0;spj<worldState.character.spells.length;spj++){var sp=worldState.character.spells[spj];if(sp.lvl===0)continue;
var spBase=sp.nm.replace(/\s*\(.*\)/,"").toLowerCase().trim();if(spBase===spNm||sp.nm.toLowerCase()===spNm){manaPayCast(worldState.character,sp,"",R);break;}}}}}},
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
{t:"SPELL_DEF",apply:function(text,R){var spellDefs=text.match(/\[SPELL_DEF:([^\]]+)\]/g)||[];var sdi;for(sdi=0;sdi<spellDefs.length;sdi++){
  var sdm=spellDefs[sdi].match(/\[SPELL_DEF:([^\]]+)\]/);if(!sdm)continue;
  var sdParts=sdm[1].split("|"),sdName=(sdParts[0]||"").trim();if(!sdName||typeof capBaseName!=="function")continue;
  var sdKey=capBaseName(sdName);if(!worldState.capabilityBible)worldState.capabilityBible={};
  if(worldState.capabilityBible[sdKey])continue;
  var sdEntry={kind:"spell",tier:0,cost:"at-will",isMagical:true,category:[],range:"",targets:"",duration:"",effect:""},sdp;
  for(sdp=1;sdp<sdParts.length;sdp++){var kv=sdParts[sdp].split("=");if(kv.length<2)continue;var kk=kv[0].trim().toLowerCase(),vv=kv.slice(1).join("=").trim();
    if(kk==="range")sdEntry.range=vv;else if(kk==="targets"||kk==="target")sdEntry.targets=vv;else if(kk==="duration")sdEntry.duration=vv;else if(kk==="effect")sdEntry.effect=vv;else if(kk==="cost")sdEntry.cost=vv;else if(kk==="tier")sdEntry.tier=parseInt(vv)||0;else if(kk==="save")sdEntry.save=vv;else if(kk==="dice")sdEntry.dice=vv;else if(kk==="category")sdEntry.category=vv.split(",").map(function(x){return x.trim().toLowerCase();}).filter(Boolean);else if(kk==="magical")sdEntry.isMagical=/^\s*(y|t|1|true)/i.test(vv);}
  worldState.capabilityBible[sdKey]=sdEntry;R.muts.push("Spell canon defined: "+sdName);
}}},
{t:"REST",apply:function(text,R){if(/\[REST:\s*long\b[^\]]*\]/i.test(text)&&typeof restSpells==="function"){var _slept=restSpells();/* #89: restSpells owns the dawn roll — one site, both paths (button + tag) */R.muts.push("Rest: spell slots restored"+(_slept?"; slept until dawn (+"+_slept+"m, "+clockFmt()+")":""));}}},
{t:"LORE",apply:function(text,R){var lores=text.match(/\[LORE:([^\]]+)\]/g)||[];for(var li=0;li<lores.length;li++){var lp=lores[li].match(/\[LORE:([^\]]+)\]/);if(lp)fileLore(lp[1]);}}},
{t:"DECISION",apply:function(text,R){var decs=text.match(/\[DECISION:([^\]]+)\]/g)||[];for(var di=0;di<decs.length;di++){var dp=decs[di].match(/\[DECISION:([^\]]+)\]/);if(dp)fileDecision(R.turn,dp[1]);}}},
{t:"FUTURE_EVENT",apply:function(text,R){var fes=text.match(/\[FUTURE_EVENT:([^|]+)\|([^\]]+)\]/g)||[];for(var fi=0;fi<fes.length;fi++){var fp=fes[fi].match(/\[FUTURE_EVENT:([^|]+)\|([^\]]+)\]/);if(fp)fileFutureEvent(fp[2],"",fp[1],R.turn);}}},
{t:"FUTURE_EVENT_RESOLVED",apply:function(text,R){var fres=text.match(/\[FUTURE_EVENT_RESOLVED:([^\]]+)\]/g)||[];var fri;for(fri=0;fri<fres.length;fri++){var frp=fres[fri].match(/\[FUTURE_EVENT_RESOLVED:([^\]]+)\]/);if(frp)resolveFutureEvent(frp[1]);}}},
{t:"NPC_NOTE",apply:function(text,R){var nns=text.match(/\[NPC_NOTE:([^|\]]+)\|([^\]]+)\]/g)||[];for(var nni=0;nni<nns.length;nni++){var nnp=nns[nni].match(/\[NPC_NOTE:([^|\]]+)\|([^\]]+)\]/);if(nnp)fileNpcEvent(nnp[1],nnp[2],R.turn);}}},
{t:"NPC_FORGET",apply:function(text,R){var forgets=text.match(/\[NPC_FORGET:([^|\]]+)\|([^\]]+)\]/g)||[];var fgi;for(fgi=0;fgi<forgets.length;fgi++){var fgp=forgets[fgi].match(/\[NPC_FORGET:([^|\]]+)\|([^\]]+)\]/);if(!fgp)continue;var fgName=resolveNpcName(fgp[1].trim()),fgWhat=fgp[2].trim().toLowerCase();var fgNpc=memory.npcs[fgName];if(!fgNpc)continue;var fgRem=0;if(fgNpc.knowledge){var fgkb=fgNpc.knowledge.length;fgNpc.knowledge=fgNpc.knowledge.filter(function(k){return String(k).toLowerCase().indexOf(fgWhat)<0;});fgRem+=fgkb-fgNpc.knowledge.length;}if(fgNpc.events){var fgeb=fgNpc.events.length;fgNpc.events=fgNpc.events.filter(function(e){return String(e&&e.note!==undefined?e.note:e).toLowerCase().indexOf(fgWhat)<0;});fgRem+=fgeb-fgNpc.events.length;}R.muts.push(fgName+" forgets: "+fgp[2].trim()+(fgRem?" ("+fgRem+")":""));}}},
// #57 leg B: turn-time supersession — commits a reveal THE TURN it lands instead of waiting for
// the next summarize window. knowledge[] ONLY (events are turn-stamped history, true at their
// time — scrubbing history is NPC_FORGET/Oubliate's domain); retired lines ARCHIVE, never vanish
// (the P12 discipline). The new fact records even when nothing matched — the reveal is canon
// whether or not the hedge ever made it to file (a no-match scrub warns for attribution).
{t:"NPC_SUPERSEDE",apply:function(text,R){var sups=text.match(/\[NPC_SUPERSEDE:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var spi;for(spi=0;spi<sups.length;spi++){var spp=sups[spi].match(/\[NPC_SUPERSEDE:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!spp)continue;var spName=resolveNpcName(spp[1].trim()),spOld=spp[2].trim(),spNew=spp[3].trim();if(!spOld||!spNew)continue;
  if(!memory.npcs[spName])memory.npcs[spName]={attitude:"unknown",knowledge:[],events:[],aliases:[]};
  var spNpc=memory.npcs[spName],spLow=spOld.toLowerCase(),spRet=[];
  if(spNpc.knowledge){spNpc.knowledge=spNpc.knowledge.filter(function(k){if(String(k).toLowerCase().indexOf(spLow)>=0){spRet.push(k);return false;}return true;});}
  if(spRet.length){var spA=memArchive(),spj;for(spj=0;spj<spRet.length;spj++)spA.superseded.push({npc:spName,fact:spRet[spj],turn:R.turn,replacedBy:spNew});}
  else if(typeof console!=="undefined")console.warn("[tags] NPC_SUPERSEDE: no on-file fact on "+spName+" matched \""+spOld+"\" — recording the new fact anyway");
  if(!spNpc.knowledge)spNpc.knowledge=[];
  if(spNpc.knowledge.indexOf(spNew)<0){spNpc.knowledge.push(spNew);if(spNpc.knowledge.length>12)spNpc.knowledge.shift();}
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
  if(typeof worldState.character.skills[sskid]==="number"){var prevLvl=skillLevel(worldState.character.skills[sskid]);worldState.character.skills[sskid]++;var newLvl=skillLevel(worldState.character.skills[sskid]);if(newLvl>prevLvl){R.muts.push(sskid+": "+SKILL_LEVELS[newLvl]);showToast(sskid+": "+SKILL_LEVELS[newLvl]);}else R.muts.push(sskid+" +1");}}}},
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
{t:"CONDITION_REMOVED",apply:function(text,R){var condRems=text.match(/\[CONDITION_REMOVED:([^\]]+)\]/g)||[];var cri2;for(cri2=0;cri2<condRems.length;cri2++){var crp2=condRems[cri2].match(/\[CONDITION_REMOVED:([^\]]+)\]/);if(!crp2)continue;if(!worldState.character.conditions)continue;var cbef=worldState.character.conditions.length,_crn=crp2[1].trim().toLowerCase();worldState.character.conditions=worldState.character.conditions.filter(function(x){return x.name.toLowerCase()!==_crn;});if(worldState.character.conditions.length<cbef)R.muts.push("Cured: "+crp2[1].trim());}}},
{t:"RELATIONSHIP",apply:function(text,R){var relTags=text.match(/\[RELATIONSHIP:([^|\]]+)\|([^\]]+)\]/g)||[];var reli;for(reli=0;reli<relTags.length;reli++){var relp=relTags[reli].match(/\[RELATIONSHIP:([^|\]]+)\|([^\]]+)\]/);if(!relp)continue;if(!worldState.character.relationships)worldState.character.relationships=[];var rnm=resolveNpcName(relp[1].trim()),rdsc=relp[2].trim(),rfound=false,relj;for(relj=0;relj<worldState.character.relationships.length;relj++){if(worldState.character.relationships[relj].entity===rnm){var prevRdsc=worldState.character.relationships[relj].descriptor;worldState.character.relationships[relj].descriptor=rdsc;rfound=true;if(prevRdsc!==rdsc)bondToast(null,rnm,rdsc,"updated");break;}}if(!rfound){worldState.character.relationships.push({entity:rnm,descriptor:rdsc});R.muts.push("Rel: "+rnm+" ("+rdsc+")");bondToast(null,rnm,rdsc,"new");}}}},
{t:"RELATIONSHIP_REMOVED",apply:function(text,R){var relRems=text.match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/g)||[];var rri2;for(rri2=0;rri2<relRems.length;rri2++){var rrp2=relRems[rri2].match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/);if(!rrp2)continue;if(!worldState.character.relationships)continue;var rrName=resolveNpcName(rrp2[1].trim());worldState.character.relationships=worldState.character.relationships.filter(function(x){return x.entity!==rrName;});R.muts.push("Rel removed: "+rrName);bondToast(null,rrName,null,"ended");}}},
{t:"SAVE_MOD",apply:function(text,R){var saveTags=text.match(/\[SAVE_MOD:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var smi2;for(smi2=0;smi2<saveTags.length;smi2++){var smp2=saveTags[smi2].match(/\[SAVE_MOD:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!smp2)continue;if(!worldState.character.saveModifiers)worldState.character.saveModifiers=[];var ssrc=smp2[1].trim(),stype=smp2[2].trim(),sval=parseInt(smp2[3]);if(isNaN(sval))continue;var sfound=false,smj;for(smj=0;smj<worldState.character.saveModifiers.length;smj++){if(worldState.character.saveModifiers[smj].source===ssrc){worldState.character.saveModifiers[smj].type=stype;worldState.character.saveModifiers[smj].amount=sval;sfound=true;break;}}if(!sfound)worldState.character.saveModifiers.push({source:ssrc,type:stype,amount:sval});var svalStr=sval>=0?"+"+sval:""+sval;R.muts.push("Save "+svalStr+" vs "+stype+" ["+ssrc+"]");}}},
{t:"SAVE_MOD_REMOVED",apply:function(text,R){var saveRemTags=text.match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/g)||[];var smri2;for(smri2=0;smri2<saveRemTags.length;smri2++){var smrp2=saveRemTags[smri2].match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/);if(!smrp2)continue;if(!worldState.character.saveModifiers)continue;var _srn=smrp2[1].trim().toLowerCase();worldState.character.saveModifiers=worldState.character.saveModifiers.filter(function(x){return x.source.toLowerCase()!==_srn;});}}},
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
{t:"ARC_COMPLETE",apply:function(text,R){var arcDone=text.match(/\[ARC_COMPLETE:([^\]]+)\]/);
  if(arcDone&&worldState.skeleton){
    var _sk=worldState.skeleton,_ad=arcDone[1].trim(),_si,_sj;
    for(_si=0;_si<_sk.acts.length;_si++){
      if(_sk.acts[_si].status!=="active")continue;
      var _act=_sk.acts[_si],_matched=false;
      for(_sj=0;_sj<_act.arcs.length;_sj++){
        if(_act.arcs[_sj].status!=="active")continue;
        if(_act.parallel&&_act.arcs[_sj].title.toLowerCase()!==_ad.toLowerCase())continue;
        _act.arcs[_sj].status="completed";_matched=true;
        R.muts.push("Arc complete: "+_act.arcs[_sj].title);
        if(!_act.parallel&&_sj+1<_act.arcs.length){_act.arcs[_sj+1].status="active";_act.arcs[_sj+1].startTurn=worldState.turn;/* #23 per-arc pacing clock starts now */R.muts.push("New arc: "+_act.arcs[_sj+1].title);}
        break;
      }
      if(_matched)break;
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
    var _sk2=worldState.skeleton,_si2;
    for(_si2=0;_si2<_sk2.acts.length;_si2++){
      if(_sk2.acts[_si2].status!=="active")continue;
      _sk2.acts[_si2].status="completed";
      R.muts.push("Act complete: "+_sk2.acts[_si2].title);
      if(_si2+1<_sk2.acts.length){
        _sk2.acts[_si2+1].status="active";
        worldState.actStartTurn=worldState.turn;
        var _fa=_sk2.acts[_si2+1].arcs,_isP=!!_sk2.acts[_si2+1].parallel;
        if(_fa&&_fa.length){for(var _fj=0;_fj<_fa.length;_fj++){if(_isP||_fj===0){_fa[_fj].status="active";_fa[_fj].startTurn=worldState.turn;/* #23 per-arc pacing clock starts now */}}}
        R.muts.push("New act: "+_sk2.acts[_si2+1].title);
      }else{R.muts.push("Campaign complete!");}
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
  var psName=resolveNpcName(psm[1].trim()),psArg=psm[2].trim(),psSub=psm[3]?psm[3].trim():null;
  if(worldState.character&&psName===worldState.character.name){if(typeof console!=="undefined")console.warn("[multiplayer] [PARTY_SPLIT:"+psName+"] ignored — the hero IS the primary thread (bare [LOCATION:] moves them)");continue;}
  var psN=wsNpcByName(psName);
  if(!psN||!psN.partyMember||!psN.charSheet){if(typeof console!=="undefined")console.warn("[multiplayer] [PARTY_SPLIT:"+psName+"] ignored — not a party member with a character sheet");continue;}
  if(npcIsDead(psN)){if(typeof console!=="undefined")console.warn("[multiplayer] [PARTY_SPLIT:"+psName+"] ignored — they are dead");continue;}/* B3: flag, not status regex */
  if(/^rejoin$/i.test(psArg)){
    if(psN.charSheet.splitLoc){delete psN.charSheet.splitLoc;if(memory.npcs[psName])memory.npcs[psName].lastSeenAt=currentNodeKey();R.muts.push(psName+" rejoins the party");}
    else if(typeof console!=="undefined")console.warn("[multiplayer] [PARTY_SPLIT:"+psName+"|rejoin] ignored — they are not split");
    continue;}
  var psPrev=pcEffectiveLoc(psN.charSheet).location;
  psN.charSheet.splitLoc={location:psArg,sublocation:psSub};
  if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
  if(!memory.map.nodes[psArg])memory.map.nodes[psArg]={firstVisit:R.turn,visits:0,description:null,parent:null,npcs:[],items:[],size:null,travelMins:null};
  if(psPrev&&psPrev!==psArg){var psEx=false,psEi;for(psEi=0;psEi<memory.map.edges.length;psEi++){var psE=memory.map.edges[psEi];if((psE.from===psPrev&&psE.to===psArg)||(psE.from===psArg&&psE.to===psPrev)){psEx=true;break;}}if(!psEx)memory.map.edges.push({from:psPrev,to:psArg,turn:R.turn});}
  if(memory.map.nodes[psArg].npcs.indexOf(psName)<0)memory.map.nodes[psArg].npcs.push(psName);
  if(memory.npcs[psName])memory.npcs[psName].lastSeenAt=(psSub?psArg+"|"+psSub:psArg);
  R.muts.push(psName+" splits off to "+psArg+(psSub?" ("+psSub+")":""));
}}},
{t:"COMPANION_HP",apply:function(text,R){var cHpTags=text.match(/\[COMPANION_HP:([^|\]]+)\|\s*([+-]?\d+)[^\]]*\]/g)||[];var cHpi;for(cHpi=0;cHpi<cHpTags.length;cHpi++){var cHpm=cHpTags[cHpi].match(/\[COMPANION_HP:([^|\]]+)\|\s*([+-]?\d+)[^\]]*\]/);if(!cHpm)continue;var cHpCs=findCompanionChar(cHpm[1]);if(!cHpCs)continue;var cHpdv=parseInt(cHpm[2]);cHpCs.hp=Math.min(cHpCs.maxHp||cHpCs.hp,Math.max(0,cHpCs.hp+cHpdv));R.muts.push(cHpm[1].trim()+(cHpdv>0?" healed ":" took ")+Math.abs(cHpdv)+" HP");}}},
{t:"COMPANION_ITEM_GAINED",apply:function(text,R){var cIgTags=text.match(/\[COMPANION_ITEM_GAINED:([^|\]]+)\|([^\]]+)\]/g)||[];var cIgi;for(cIgi=0;cIgi<cIgTags.length;cIgi++){var cIgm=cIgTags[cIgi].match(/\[COMPANION_ITEM_GAINED:([^|\]]+)\|([^\]]+)\]/);if(!cIgm)continue;var cIgCs=findCompanionChar(cIgm[1]);if(!cIgCs)continue;if(!cIgCs.inventory)cIgCs.inventory=[];addInventoryItem(cIgCs.inventory,cIgm[2].trim());R.muts.push(cIgm[1].trim()+": +"+cIgm[2].trim());}}},
{t:"COMPANION_ITEM_LOST",apply:function(text,R){var cIlTags=text.match(/\[COMPANION_ITEM_LOST:([^|\]]+)\|([^\]]+)\]/g)||[];var cIli;for(cIli=0;cIli<cIlTags.length;cIli++){var cIlm=cIlTags[cIli].match(/\[COMPANION_ITEM_LOST:([^|\]]+)\|([^\]]+)\]/);if(!cIlm)continue;var cIlCs=findCompanionChar(cIlm[1]);if(!cIlCs||!cIlCs.inventory)continue;removeInventoryItem(cIlCs.inventory,cIlm[2].trim());R.muts.push(cIlm[1].trim()+": -"+cIlm[2].trim());}}},
// #60b: companion form of ITEM_KEPT — same confirmed-negative latch, keyed by owner.
{t:"COMPANION_ITEM_KEPT",apply:function(text,R){var cIkTags=text.match(/\[COMPANION_ITEM_KEPT:([^|\]]+)\|([^\]]+)\]/g)||[];var cIki;for(cIki=0;cIki<cIkTags.length;cIki++){var cIkm=cIkTags[cIki].match(/\[COMPANION_ITEM_KEPT:([^|\]]+)\|([^\]]+)\]/);if(!cIkm)continue;var cIkCs=findCompanionChar(cIkm[1]);if(!cIkCs){console.warn("[COMPANION_ITEM_KEPT] no party member named '"+cIkm[1].trim()+"' — latch not written");continue;}_stampItemKept(cIkm[1].trim(),cIkCs.inventory,cIkm[2].trim());}}},
{t:"COMPANION_XP",apply:function(text,R){var cXpTags=text.match(/\[COMPANION_XP:([^|\]]+)\|\s*\+?(\d+)[^\]]*\]/g)||[];var cXpi;for(cXpi=0;cXpi<cXpTags.length;cXpi++){var cXpm=cXpTags[cXpi].match(/\[COMPANION_XP:([^|\]]+)\|\s*\+?(\d+)[^\]]*\]/);if(!cXpm)continue;var cXpNpc=findCompanionNpc(cXpm[1]);if(!cXpNpc||!cXpNpc.charSheet)continue;
  /* user ruling 2026-07-16 (AUDIT_FABLE_07_16 #6): dead companions get NOTHING — an individual XP
     award at a dead companion is refused loudly (findCompanionNpc still routes OTHER companion tags
     to dead sheets on purpose: the death turn's own [COMPANION_HP:]/[COMPANION_CONDITION:] land
     after the [NPC:|dead] status in table order and must not be dropped) */
  if(npcIsDead(cXpNpc)){if(typeof console!=="undefined")console.warn("[tags] COMPANION_XP at DEAD companion "+cXpNpc.name+" — refused (dead companions get nothing)");R.muts.push(cXpNpc.name+": XP refused (dead)");continue;}/* B3: flag, not status regex */
  var cXpCs=cXpNpc.charSheet;if(typeof cXpCs.xp!=="number")cXpCs.xp=0;cXpCs.xp+=parseInt(cXpm[2]);R.muts.push(cXpm[1].trim()+": +"+cXpm[2]+" XP");checkCompanionLevelUp(cXpCs);}}},
// #46 Phase B: 4th arg = cause, mirror of the player handler (same first-writer-wins upsert).
{t:"COMPANION_CONDITION",apply:function(text,R){var cCondTags=text.match(/\[COMPANION_CONDITION:([^|\]]+)\|([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var cCondi;for(cCondi=0;cCondi<cCondTags.length;cCondi++){var cCondp=cCondTags[cCondi].match(/\[COMPANION_CONDITION:([^|\]]+)\|([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/);if(!cCondp)continue;var cCondCs=findCompanionChar(cCondp[1]);if(!cCondCs)continue;if(!cCondCs.conditions)cCondCs.conditions=[];var cCnm=cCondp[2].trim(),cCdur=cCondp[3].trim(),cCcause=cCondp[4]?cCondp[4].trim():"",cCalready=false,cCondj;
  for(cCondj=0;cCondj<cCondCs.conditions.length;cCondj++){if(cCondCs.conditions[cCondj].name===cCnm){
    cCondCs.conditions[cCondj].duration=cCdur;
    if(cCcause&&!cCondCs.conditions[cCondj].cause)cCondCs.conditions[cCondj].cause=cCcause;
    cCalready=true;break;}}
  if(!cCalready){var cNewCond={name:cCnm,duration:cCdur};if(cCcause)cNewCond.cause=cCcause;cCondCs.conditions.push(cNewCond);R.muts.push(cCondp[1].trim()+": "+cCnm);}}}},
{t:"COMPANION_CONDITION_REMOVED",apply:function(text,R){var cCrTags=text.match(/\[COMPANION_CONDITION_REMOVED:([^|\]]+)\|([^\]]+)\]/g)||[];var cCri;for(cCri=0;cCri<cCrTags.length;cCri++){var cCrp=cCrTags[cCri].match(/\[COMPANION_CONDITION_REMOVED:([^|\]]+)\|([^\]]+)\]/);if(!cCrp)continue;var cCrCs=findCompanionChar(cCrp[1]);if(!cCrCs||!cCrCs.conditions)continue;cCrCs.conditions=cCrCs.conditions.filter(function(x){return x.name!==cCrp[2].trim();});R.muts.push(cCrp[1].trim()+": cured "+cCrp[2].trim());}}},
{t:"COMPANION_RELATIONSHIP",apply:function(text,R){var cRelTags=text.match(/\[COMPANION_RELATIONSHIP:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cReli;for(cReli=0;cReli<cRelTags.length;cReli++){var cRelp=cRelTags[cReli].match(/\[COMPANION_RELATIONSHIP:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!cRelp)continue;var cRelCs=findCompanionChar(cRelp[1]);if(!cRelCs)continue;if(!cRelCs.relationships)cRelCs.relationships=[];var cRnm=resolveNpcName(cRelp[2].trim()),cRdsc=cRelp[3].trim(),cRfound=false,cRelj;for(cRelj=0;cRelj<cRelCs.relationships.length;cRelj++){if(cRelCs.relationships[cRelj].entity===cRnm){var prevCRdsc=cRelCs.relationships[cRelj].descriptor;cRelCs.relationships[cRelj].descriptor=cRdsc;cRfound=true;if(prevCRdsc!==cRdsc)bondToast(cRelp[1].trim(),cRnm,cRdsc,"updated");break;}}if(!cRfound){cRelCs.relationships.push({entity:cRnm,descriptor:cRdsc});R.muts.push(cRelp[1].trim()+": rel "+cRnm+" ("+cRdsc+")");bondToast(cRelp[1].trim(),cRnm,cRdsc,"new");}}}},
{t:"COMPANION_RELATIONSHIP_REMOVED",apply:function(text,R){var cRrTags=text.match(/\[COMPANION_RELATIONSHIP_REMOVED:([^|\]]+)\|([^\]]+)\]/g)||[];var cRri;for(cRri=0;cRri<cRrTags.length;cRri++){var cRrp=cRrTags[cRri].match(/\[COMPANION_RELATIONSHIP_REMOVED:([^|\]]+)\|([^\]]+)\]/);if(!cRrp)continue;var cRrCs=findCompanionChar(cRrp[1]);if(!cRrCs||!cRrCs.relationships)continue;var cRrNm=resolveNpcName(cRrp[2].trim());cRrCs.relationships=cRrCs.relationships.filter(function(x){return x.entity!==cRrNm;});R.muts.push(cRrp[1].trim()+": rel removed "+cRrNm);bondToast(cRrp[1].trim(),cRrNm,null,"ended");}}},
{t:"COMPANION_ABILITY",apply:function(text,R){var cAbTags=text.match(/\[COMPANION_ABILITY:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cAbi;for(cAbi=0;cAbi<cAbTags.length;cAbi++){var cAbp=cAbTags[cAbi].match(/\[COMPANION_ABILITY:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!cAbp)continue;var cAbCs=findCompanionChar(cAbp[1]);if(!cAbCs)continue;if(!cAbCs.abilities)cAbCs.abilities=[];var cAnm=cAbp[2].trim(),cAalready=false,cAbj;for(cAbj=0;cAbj<cAbCs.abilities.length;cAbj++){if(cAbCs.abilities[cAbj].nm===cAnm){cAalready=true;break;}}if(!cAalready){cAbCs.abilities.push({nm:cAnm,ds:cAbp[3].trim(),gained:R.turn});R.muts.push(cAbp[1].trim()+": ability "+cAnm);}}}},
{t:"COMPANION_ALIGNMENT",apply:function(text,R){var cAlTags=text.match(/\[COMPANION_ALIGNMENT:([^|\]]+)\|(law|good)([+-]\d+)\]/gi)||[];var cAli;for(cAli=0;cAli<cAlTags.length;cAli++){var cAlp=cAlTags[cAli].match(/\[COMPANION_ALIGNMENT:([^|\]]+)\|(law|good)([+-]\d+)\]/i);if(!cAlp)continue;var cAlCs=findCompanionChar(cAlp[1]);if(!cAlCs)continue;if(!cAlCs.alignLaw)cAlCs.alignLaw=0;if(!cAlCs.alignGood)cAlCs.alignGood=0;if(cAlp[2].toLowerCase()==="law")cAlCs.alignLaw=Math.max(-3,Math.min(3,cAlCs.alignLaw+parseInt(cAlp[3])));else cAlCs.alignGood=Math.max(-3,Math.min(3,cAlCs.alignGood+parseInt(cAlp[3])));var cNewAl=alignLabel(cAlCs.alignLaw,cAlCs.alignGood);if(cNewAl!==cAlCs.actualAlignment){R.muts.push(cAlp[1].trim()+": align "+cNewAl);cAlCs.actualAlignment=cNewAl;}}}}
];

// ── The table-driven parser — THE sole applyMuts body since the v1.261 cutover close ───────────
function applyMutsTable(text){
  var R={muts:[],turn:worldState.turn,text:text};
  _sheetlessWarned={};
  var feSnip=null;
  R.feGet=function(){if(feSnip===null){var ft=cleanTxt(text).replace(/\*You could[\s\S]*$/,"").trim().slice(0,280);var fb=Math.max(ft.lastIndexOf(". "),ft.lastIndexOf("! "),ft.lastIndexOf("? "));if(fb>60)ft=ft.slice(0,fb+1);feSnip=ft;}return feSnip;};
  // Audit #8: combatStartPositions(text) is pure over the fixed response text, but was
  // recomputed by each of the 4 combat-attribute handlers — lazy-cache it once per response,
  // the exact R.feGet pattern above.
  var csPos=null;
  R.combatStarts=function(){if(csPos===null)csPos=combatStartPositions(text);return csPos;};
  var _xpSkip=null;
  R._xpMirror=function(n){
    // UA7: the skip list is keyed by canonical NPC NAME, not charSheet object identity — the
    // list outlives one mirror call ([XP:] can repeat) and checkCompanionLevelUp runs in
    // between; any path that regenerates a sheet object would silently break identity keying
    // and double-award the individually-paid companion.
    if(_xpSkip===null){_xpSkip=[];var _mt=text.match(/\[COMPANION_XP:([^|\]]+)\|/g)||[],_mi;for(_mi=0;_mi<_mt.length;_mi++){var _mm=_mt[_mi].match(/\[COMPANION_XP:([^|\]]+)\|/);if(_mm){var _mn=findCompanionNpc(_mm[1].trim());if(_mn)_xpSkip.push(_mn.name.toLowerCase());}}}
    var _pi2,_shared=0,_xmParty=livingPartyCompanions();/* user ruling 2026-07-16 (AUDIT_FABLE_07_16 #6): dead companions get NOTHING — the shared [XP:] mirror skips them */
    for(_pi2=0;_pi2<_xmParty.length;_pi2++){var _pn2=_xmParty[_pi2];
      if(_xpSkip.indexOf(_pn2.name.toLowerCase())>=0)continue;
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
      if(TAG_TABLE[i].nc&&!worldState.combat&&text.indexOf("["+TAG_TABLE[i].t+":")>=0){__tagNoCombatWarns++;console.warn("[tags] "+TAG_TABLE[i].t+" arrived with NO active combat — no-op (premature [COMBAT_END:] earlier? the v1.224 C1 class / UA27)");}
      TAG_TABLE[i].apply(text,R);
    }
    catch(e){R.errors.push(TAG_TABLE[i].t+": "+(e&&e.message));console.warn("[tags] table handler "+TAG_TABLE[i].t+" threw:",e&&e.message);}
  }
  stampQuestCompletion();
  // #129: deterministic expiry for schedule entries the GM never resolved — runs on every real
  // turn so a rest/TIME_ADVANCE that jumps past SCHEDULE_EXPIRE_MIN retires the entry that same
  // response. Loudness (warn/toast/archive) lives in the sweep; the muts line makes it visible
  // in the system message like every other state change.
  var _swExp=scheduleSweepExpired(),_swi;
  for(_swi=0;_swi<_swExp.length;_swi++)R.muts.push("Event expired unresolved: "+_swExp[_swi].label);
  if(R.muts.length)addMsg("system",escHtml(R.muts.join(" | ")));
  syncUI();saveAll();
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
  var ms=text.match(/\[([A-Z][A-Z_]{2,}):/g)||[],seen={},i;
  for(i=0;i<ms.length;i++){var nm=ms[i].slice(1,-1);if(__TAG_KNOWN[nm]||seen[nm])continue;seen[nm]=1;
    console.warn("[tags] UNKNOWN tag ["+nm+":…] in GM response — not parsed, not stripped (vocabulary gap or GM invention)");}
}
