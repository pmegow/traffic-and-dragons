// tag_table.js — THE tag registry (UA1, session A). ⛨ DRIFT SURFACE.
// One ordered table drives what used to live in three hand-synced places: the applyMuts parsers,
// the cleanTxt strip regexes, and the STATE TAGS prompt docs. Divergence between those three was
// silent in both directions (the [ENEMY_SURRENDERS] phantom); here it is structurally impossible —
// coverage guards in dev/engine-tests.js fail the commit instead.
//
// SHADOW MODE (this commit): applyMuts (api.js) remains the AUTHORITATIVE parser. Every response
// is ALSO run through applyMutsTable against deep-cloned state, and any mutation difference is
// logged loudly + persisted (localStorage tnd_tagdiff_v1). Cutover to the table is a separate
// later commit, gated on a clean diff log across harness corpora AND real play sessions.
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
//   R._xpMirror(n) — party XP mirror with the COMPANION_XP supersede scan
// Handlers reference worldState/memory/helpers as GLOBALS, exactly like the originals — this is
// what lets shadow mode run them against clones by swapping the globals, and what makes cutover
// a body-swap instead of a refactor.

// ── Strip registry (derives cleanTxt's _CT_TAGS/_CT_BARE — order preserved from the originals) ──
var TAG_STRIP_NAMES=["HP","GOLD","ITEM_GAINED","ITEM_LOST","LOCATION","NPC","XP","QUEST_STEP","QUEST","DICE","COMBAT_START","COMBAT_END","COMBAT_ROUND","ENEMY_HP","ENEMY_SURRENDERS","ABILITY_GAINED","ALIGNMENT","LORE","DECISION","FUTURE_EVENT_RESOLVED","FUTURE_EVENT","NPC_NOTE","NPC_FORGET","NPC_PRONOUN","SPELL_USED","SPELL_DEF","SKILL_SUCCESS","CONDITION","CONDITION_REMOVED","RELATIONSHIP","RELATIONSHIP_REMOVED","SAVE_MOD","SAVE_MOD_REMOVED","LANGUAGE","STORY_BEAT","PARTY_MEMBER","COMBAT_STATS","COMBAT_IMMUNE","COMBAT_RESIST","COMBAT_VULN","LOCATION_DESC","LOCATION_SIZE","SUBLOCATION","TIME","WEATHER","REST","LOCATION_ITEM","NPC_ALIAS","NPC_MERGE","NPC_LINK","FACTION","NPC_FACTION","FACTION_REL","COMPANION_HP","COMPANION_ITEM_GAINED","COMPANION_ITEM_LOST","COMPANION_XP","COMPANION_CONDITION","COMPANION_CONDITION_REMOVED","COMPANION_RELATIONSHIP","COMPANION_RELATIONSHIP_REMOVED","COMPANION_ABILITY","COMPANION_ALIGNMENT","ARC_COMPLETE","ACT_COMPLETE","ACTIONS","RETCON"];
var TAG_STRIP_BARE=["ENEMY_SURRENDERS","SUBLOCATION_LEAVE"];
// Stripped/known names that DELIBERATELY have no applyMuts handler — each with its reason.
// DICE: display-only, rendered by diceTxt. ACTIONS: legacy pre-v1.110 format, replay-only.
// RETCON: consumed at logTranscript time (RAG de-index), not a state mutation.
// ENEMY_SURRENDERS: ⚠ UA2 PHANTOM — stripped but inert since inception; decision pending
// (implement a surrender mutation or delete from the strip lists). Kept here so the coverage
// guard documents it instead of letting it hide.
var TAG_NO_HANDLER=["DICE","ACTIONS","RETCON","ENEMY_SURRENDERS"];
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
"[NPC:name|status|relation] -- status=current mood/condition in 2-4 WORDS (a label like 'wary, bargaining' -- never a sentence; scene detail belongs in prose or [NPC_NOTE:]), relation=how they relate to the player (ally/enemy/acquaintance/rival/etc.); NEVER put pronouns in these fields -- pronouns go ONLY in [NPC_PRONOUN:]. [PARTY_MEMBER:name|true/false] [QUEST:title|status] [ABILITY_GAINED:Name|Desc]\n",
"[LOCATION_DESC:text] -- canonical description of this location; emit ONCE on first visit ONLY; stored permanently and never overwritten\n",
"[LOCATION_SIZE:scale|travelMins] -- size of current location; scale=tiny/small/medium/large/vast; travelMins=estimated minutes to cross on foot (e.g. [LOCATION_SIZE:large|45]); emit once on first visit alongside LOCATION_DESC\n",
"[SUBLOCATION:name] -- player enters a named area within current world location (e.g. tavern common room, thieves' guild hall)\n",
"[SUBLOCATION_LEAVE] -- player exits the sub-location back to the parent world location\n",
"[TIME:time of day] -- update whenever time meaningfully advances (e.g. [TIME:dawn], [TIME:late night]); the world clock does NOT move on its own, so a night's camp, a long journey, or a rest all need this tag or the prompt keeps reporting the old time\n",
"[WEATHER:description] -- update when the weather changes (e.g. [WEATHER:heavy rain], [WEATHER:clear and cold])\n",
"[LOCATION_ITEM:name|placed] -- item left or hidden here (pair with [ITEM_LOST:]); [LOCATION_ITEM:name|taken] -- item removed by NPC/event (player pickup auto-handled by [ITEM_GAINED:])\n",
"[COMBAT_START:name|hp|ac|atkbonus|dmgdie|morale] [ENEMY_HP:-X] [COMBAT_ROUND:N] [COMBAT_END:victory/defeat/fled]\n",
"[COMBAT_STATS:STR:N|DEX:N|CON:N|INT:N|WIS:N|CHA:N|CR:N] -- always emit alongside COMBAT_START; use official D&D stats\n",
"[COMBAT_IMMUNE:fire,poison] [COMBAT_RESIST:cold,lightning] [COMBAT_VULN:thunder] -- omit entirely if none; comma-separated damage types only\n",
"CLOSE EVERY FIGHT: emit [COMBAT_END:...] the moment combat ends by ANY means -- not only a kill. Use [COMBAT_END:fled] when the enemy breaks off or is driven away, [COMBAT_END:truce] on a parley/surrender, [COMBAT_END:disengaged] when the party leaves the fight. A fight left unclosed sits stale in the tracker.\n",
"[ALIGNMENT:law+1] [ALIGNMENT:good-1] (use on morally significant choices only)\n",
"[SPELL_USED:spellname] (leveled spells only -- cantrips never expend; use exact spell name)\n",
"[SPELL_DEF:Name|range=X|targets=Y|duration=Z|effect=...|cost=slot|tier=1|category=arcane,divine|magical=yes] -- ONLY when a spell is cast that is NOT already in the CANONICAL SPELL RULES list (one you invented or a homebrew): define its canon ONCE so the engine pins it and it can never drift. '=' per field, '|' between fields; category is a comma-separated tradition list (arcane/divine/primal/necromantic/martial); keep effect free of '|' and ']'. Recorded once, re-injected forever -- do not redefine a spell already listed.\n",
"[REST:long] when the party completes a full/long rest (a night's sleep) -- restores every expended spell slot for the whole party so 1/day spells can be cast again; narrate HP recovery with [HP:+N] as usual\n",
"[FUTURE_EVENT_RESOLVED:what] (when a pending future event occurs)\n",
"[LORE:fact] [DECISION:description] [FUTURE_EVENT:what|when] [NPC_NOTE:name|note] [NPC_PRONOUN:name|she/her]\n",
"[NPC_FORGET:name|person or event] -- erase one specific memory from an NPC (emit when the Oubliate spell is cast and the WIS save fails); the engine scrubs that fact from what the NPC knows so it cannot resurface\n",
"[RETCON:what was corrected] -- emit whenever you correct, rewind, or retract something you previously narrated (including after an out-of-character correction from the player); the engine de-indexes the superseded narration from episodic memory so the wrong version can never resurface as truth\n",
"[NPC_ALIAS:canonical_name|alias] -- when an NPC is given a new name or title; links alias to canonical; prevents duplicate entries; emit alongside the NPC tag that introduces the alias\n",
"[NPC_MERGE:canonical_name|duplicate_name] -- when two NPC entries turn out to be the same person; absorbs events/knowledge from duplicate into canonical and removes duplicate\n",
"[NPC_LINK:name1|name2|relationship] -- relationship between two named characters (NPC↔NPC or NPC↔player); emit when establishing or changing how two characters relate (e.g. [NPC_LINK:Zarith|Guard Captain|employer/employee], [NPC_LINK:Borin|player|old debt]); updates existing link if already set\n",
"[FACTION:name|desc] -- register or update a faction, guild, order, or organisation (e.g. [FACTION:The Black Hand|criminal thieves guild controlling the docks]); use on first mention\n",
"[NPC_FACTION:npcName|factionName|role] -- assign an NPC to a faction with their role (e.g. [NPC_FACTION:Zarith|The Black Hand|enforcer]); auto-registers the faction if unknown\n",
"[FACTION_REL:faction1|faction2|relationship] -- relationship between two factions (e.g. [FACTION_REL:The Black Hand|City Watch|bitter enemies], [FACTION_REL:Merchant Guild|City Watch|uneasy allies])\n",
"[SKILL_SUCCESS:skill_id] -- on a successful skilled action (exact ids: Jumping, Sprinting, Lifting, Grappling, Climbing, Swimming, Distance Running, Riding, Hold Breath, Endure Pain, Tolerate Alcohol/Drugs, Foraging, Cooking, Survival, Animal Handling, Navigation, Tracking, Arcana, Lore, Investigation, Nature, First Aid, Alchemy, Smithing, Handcraft, Persuasion, Deception, Intimidation, Performance, Trading, Stealth, Sleight of Hand, Lockpicking, Gambling, Perception, Insight)\n",
"[SKILL_SUCCESS:Tracking] covers both wilderness tracking (following prey or people by physical signs) and urban tailing (shadowing a mark through crowds, alleys, or city streets). Use WIS for reading the environment, INT for anticipating movement patterns.\n",
"[CONDITION:name|duration] [CONDITION_REMOVED:name] -- duration is descriptive (e.g. 'until antidote', 'saving throw each hour CON DC 15')\n",
"[RELATIONSHIP:entity|descriptor] [RELATIONSHIP_REMOVED:entity] -- entity=NPC or faction; descriptor=Allied/Rival/Wanted/Hunted/Indebted/Marked/Feared/etc.\n",
"[SAVE_MOD:source|type|amount] [SAVE_MOD_REMOVED:source] -- type=stat (CON/DEX/etc.) or threat (Poison/Fire/Cold/Lightning/Fear/Charm/Psionic/Holy/Shadow/Disease/Magic/Other); amount=integer\n",
"[LANGUAGE:name|fluent] or [LANGUAGE:name|broken] -- when character learns or improves a language\n",
"[STORY_BEAT:one sentence] -- major narrative milestone; use sparingly for truly significant moments only. Concrete triggers, one beat per such moment: a companion joins or leaves the party, an oath or bargain is struck, a major revelation lands, first blood is drawn in a significant conflict, a quest completes\n",
"[ARC_COMPLETE:arc title] -- emit when the current arc's objective is fulfilled; advances to the next arc\n",
"[ACT_COMPLETE:act title] -- emit when the act's turning point occurs; advances to the next act\n",
"COMPANION SHEET TAGS — use these (not the player tags) when the event affects a named party member, not the player:\n",
"[COMPANION_HP:Name|+/-N] [COMPANION_ITEM_GAINED:Name|item] [COMPANION_ITEM_LOST:Name|item] [COMPANION_XP:Name|N]\n",
"[COMPANION_CONDITION:Name|condName|duration] [COMPANION_CONDITION_REMOVED:Name|condName]\n",
"[COMPANION_RELATIONSHIP:Name|entity|descriptor] [COMPANION_RELATIONSHIP_REMOVED:Name|entity]\n",
"[COMPANION_ABILITY:Name|abilityName|desc] [COMPANION_ALIGNMENT:Name|law+1]\n",
"Use the companion's exact name as it appears in the party list. Apply the same upkeep rules as for the player.\n",
"THE MOMENT an NPC agrees to travel with the party — even conditionally or provisionally — you MUST emit [PARTY_MEMBER:name|true] in that same response; never narrate a joining without the tag.\n",
"XP IS SHARED AUTOMATICALLY: every [XP:N] you award is mirrored by the engine to all party members. Use [COMPANION_XP:Name|N] ONLY for a bonus one companion earns alone — never re-emit a shared award with it.\n\n"
];
function buildStateTagsDoc(){return TAG_DOC_LINES.join("");}

// ── THE TABLE — ordered handler registry. Bodies are 1:1 transcriptions of the applyMuts blocks
// (only `muts`→R.muts, `turn`→R.turn, `feGet`→R.feGet, `_xpMirror`→R._xpMirror renamed). ──────────
var TAG_TABLE=[
{t:"HP",apply:function(text,R){var hpTags=text.match(/\[HP:\s*([+-]?\d+)[^\]]*\]/g)||[];var hpi;for(hpi=0;hpi<hpTags.length;hpi++){var hpm=hpTags[hpi].match(/\[HP:\s*([+-]?\d+)[^\]]*\]/);if(!hpm)continue;var dv=parseInt(hpm[1]);worldState.character.hp=Math.min(worldState.character.maxHp,Math.max(0,worldState.character.hp+dv));R.muts.push(dv>0?"Healed "+dv+" HP":"Took "+Math.abs(dv)+" damage");}}},
{t:"GOLD",apply:function(text,R){var goldTags=text.match(/\[GOLD:\s*([+-]?\d+)[^\]]*\]/g)||[];var gli;for(gli=0;gli<goldTags.length;gli++){var glm=goldTags[gli].match(/\[GOLD:\s*([+-]?\d+)[^\]]*\]/);if(!glm)continue;var dg=parseInt(glm[1]);worldState.character.gold=Math.max(0,worldState.character.gold+dg);R.muts.push(dg>0?"+"+dg+" gp":dg+" gp");}}},
{t:"ITEM_GAINED",apply:function(text,R){var igTags=text.match(/\[ITEM_GAINED:([^\]]+)\]/g)||[];var igi;for(igi=0;igi<igTags.length;igi++){var igm=igTags[igi].match(/\[ITEM_GAINED:([^\]]+)\]/);if(!igm)continue;var igq=_qtyParse(igm[1]),igqi;for(igqi=0;igqi<igq.n;igqi++)addInventoryItem(worldState.character.inventory,igq.base);R.muts.push("+"+igq.base+(igq.n>1?" x"+igq.n:""));autoTakeLocationItem(igq.base);}}},
{t:"ITEM_LOST",apply:function(text,R){var ilTags=text.match(/\[ITEM_LOST:([^\]]+)\]/g)||[];var ili;for(ili=0;ili<ilTags.length;ili++){var ilm=ilTags[ili].match(/\[ITEM_LOST:([^\]]+)\]/);if(!ilm)continue;var ilq=_qtyParse(ilm[1]),ilqi;for(ilqi=0;ilqi<ilq.n;ilqi++)removeInventoryItem(worldState.character.inventory,ilq.base);R.muts.push("-"+ilq.base+(ilq.n>1?" x"+ilq.n:""));}}},
{t:"LOCATION",apply:function(text,R){var loc=text.match(/\[LOCATION:([^\]]+)\]/);if(loc){var _lname=loc[1].trim();var _prevLoc=worldState.world.location;fileLocation(_lname,"",R.turn);worldState.world.location=_lname;worldState.world.sublocation=null;R.muts.push("-> "+_lname);
  if(worldState.combat&&_lname!==_prevLoc&&!/\[COMBAT_START:/.test(text)){var _staleFoe=worldState.combat.name;worldState.combat=null;R.muts.push("Combat ended (left the area)");if(typeof console!=="undefined")console.warn("[combat] auto-cleared stale combat ("+_staleFoe+") on move to "+_lname+" — GM emitted no [COMBAT_END:]");}}}},
{t:"SUBLOCATION",apply:function(text,R){var sloctag=text.match(/\[SUBLOCATION:([^\]]+)\]/);if(sloctag){worldState.world.sublocation=sloctag[1].trim();fileSubLocation(sloctag[1].trim(),R.turn);R.muts.push("Sub: "+sloctag[1].trim());}}},
{t:"SUBLOCATION_LEAVE",apply:function(text,R){if(/\[SUBLOCATION_LEAVE\]/.test(text)){worldState.world.sublocation=null;R.muts.push("Left sub-location");}}},
{t:"TIME",apply:function(text,R){var timeTag=text.match(/\[TIME:([^\]]+)\]/);if(timeTag){worldState.world.time=timeTag[1].trim();R.muts.push("Time: "+timeTag[1].trim());}}},
{t:"WEATHER",apply:function(text,R){var wxTag=text.match(/\[WEATHER:([^\]]+)\]/);if(wxTag){worldState.world.weather=wxTag[1].trim();R.muts.push("Weather: "+wxTag[1].trim());}}},
{t:"LOCATION_DESC",apply:function(text,R){var ldesc=text.match(/\[LOCATION_DESC:([^\]]+)\]/);if(ldesc)fileLocationDesc(ldesc[1]);}},
{t:"LOCATION_SIZE",apply:function(text,R){var lsize=text.match(/\[LOCATION_SIZE:([^|]+)\|([^\]]+)\]/);if(lsize){var lsKey=worldState.world.sublocation?worldState.world.location+"|"+worldState.world.sublocation:worldState.world.location;if(memory.map&&memory.map.nodes[lsKey]){memory.map.nodes[lsKey].size=lsize[1].trim();memory.map.nodes[lsKey].travelMins=parseInt(lsize[2])||null;}}}},
{t:"LOCATION_ITEM",apply:function(text,R){var locItms=text.match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/g)||[];var lii;for(lii=0;lii<locItms.length;lii++){var lip=locItms[lii].match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/);if(!lip)continue;fileLocationItem(lip[1].trim(),lip[2],R.turn);R.muts.push(lip[2]==="placed"?"Left: "+lip[1].trim():"Taken: "+lip[1].trim());}}},
{t:"NPC_ALIAS",apply:function(text,R){var npcAliasTags=text.match(/\[NPC_ALIAS:([^|\]]+)\|([^\]]+)\]/g)||[];var alii;for(alii=0;alii<npcAliasTags.length;alii++){var alp=npcAliasTags[alii].match(/\[NPC_ALIAS:([^|\]]+)\|([^\]]+)\]/);if(!alp)continue;var alCanon=alp[1].trim(),alAlias=alp[2].trim();if(!memory.npcs[alCanon])memory.npcs[alCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[alCanon].aliases)memory.npcs[alCanon].aliases=[];if(memory.npcs[alCanon].aliases.indexOf(alAlias)<0)memory.npcs[alCanon].aliases.push(alAlias);var wsali;for(wsali=0;wsali<worldState.npcs.length;wsali++){if(worldState.npcs[wsali].name===alCanon){if(!worldState.npcs[wsali].aliases)worldState.npcs[wsali].aliases=[];if(worldState.npcs[wsali].aliases.indexOf(alAlias)<0)worldState.npcs[wsali].aliases.push(alAlias);break;}}R.muts.push("Alias: "+alAlias+" -> "+alCanon);}}},
{t:"NPC_MERGE",apply:function(text,R){var npcMergeTags=text.match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/g)||[];var mgii;for(mgii=0;mgii<npcMergeTags.length;mgii++){var mgp=npcMergeTags[mgii].match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/);if(!mgp)continue;var mgCanon=mgp[1].trim(),mgDupe=mgp[2].trim();if(memory.npcs[mgDupe]){if(!memory.npcs[mgCanon])memory.npcs[mgCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[mgCanon].aliases)memory.npcs[mgCanon].aliases=[];if(memory.npcs[mgCanon].aliases.indexOf(mgDupe)<0)memory.npcs[mgCanon].aliases.push(mgDupe);var mgevs=memory.npcs[mgDupe].events||[],mgevi;for(mgevi=0;mgevi<mgevs.length;mgevi++)memory.npcs[mgCanon].events.push(mgevs[mgevi]);var mgkns=memory.npcs[mgDupe].knowledge||[],mgkni;for(mgkni=0;mgkni<mgkns.length;mgkni++){if(memory.npcs[mgCanon].knowledge.indexOf(mgkns[mgkni])<0)memory.npcs[mgCanon].knowledge.push(mgkns[mgkni]);}if(memory.npcs[mgDupe].aliases){var mgals=memory.npcs[mgDupe].aliases,mgali;for(mgali=0;mgali<mgals.length;mgali++){if(memory.npcs[mgCanon].aliases.indexOf(mgals[mgali])<0)memory.npcs[mgCanon].aliases.push(mgals[mgali]);}}if(!memory.npcs[mgCanon].firstEncounter&&memory.npcs[mgDupe].firstEncounter)memory.npcs[mgCanon].firstEncounter=memory.npcs[mgDupe].firstEncounter;delete memory.npcs[mgDupe];}
  var _mgDupN=null,_mgCanN=null,_mgi;for(_mgi=0;_mgi<worldState.npcs.length;_mgi++){if(worldState.npcs[_mgi].name===mgDupe)_mgDupN=worldState.npcs[_mgi];else if(worldState.npcs[_mgi].name===mgCanon)_mgCanN=worldState.npcs[_mgi];}
  if(_mgDupN){
    if(!_mgCanN){_mgCanN={name:mgCanon,status:_mgDupN.status||"unknown",rel:_mgDupN.rel||"unknown",met:_mgDupN.met||R.turn,partyMember:false,portrait:null,aliases:[]};worldState.npcs.push(_mgCanN);}
    if(_mgDupN.partyMember)_mgCanN.partyMember=true;
    if(_mgDupN.charSheet&&!_mgCanN.charSheet)_mgCanN.charSheet=_mgDupN.charSheet;
    if(_mgDupN.portrait&&!_mgCanN.portrait)_mgCanN.portrait=_mgDupN.portrait;
    if(_mgDupN.portraitOffset&&!_mgCanN.portraitOffset)_mgCanN.portraitOffset=_mgDupN.portraitOffset;
    if(_mgDupN.pronouns&&!_mgCanN.pronouns)_mgCanN.pronouns=_mgDupN.pronouns;
    if((!_mgCanN.status||_mgCanN.status==="unknown")&&_mgDupN.status)_mgCanN.status=_mgDupN.status;
    if((!_mgCanN.rel||_mgCanN.rel==="unknown")&&_mgDupN.rel)_mgCanN.rel=_mgDupN.rel;
    if(typeof _mgDupN.met==="number"&&(typeof _mgCanN.met!=="number"||_mgDupN.met<_mgCanN.met))_mgCanN.met=_mgDupN.met;
  }
  worldState.npcs=worldState.npcs.filter(function(n){return n.name!==mgDupe;});
  if(memory.npcGraph){var _mge=memory.npcGraph.edges||[],_mgei;for(_mgei=0;_mgei<_mge.length;_mgei++){if(_mge[_mgei].a===mgDupe)_mge[_mgei].a=mgCanon;if(_mge[_mgei].b===mgDupe)_mge[_mgei].b=mgCanon;}var _mgnf=memory.npcGraph.npcFactions;if(_mgnf&&_mgnf[mgDupe]){if(!_mgnf[mgCanon])_mgnf[mgCanon]=_mgnf[mgDupe];else _mgnf[mgCanon]=_mgnf[mgCanon].concat(_mgnf[mgDupe]);delete _mgnf[mgDupe];}}if(worldState.character.relationships){var rgj,newRels2=[],seenRel={};for(rgj=0;rgj<worldState.character.relationships.length;rgj++){var rent=worldState.character.relationships[rgj].entity;if(rent===mgDupe)worldState.character.relationships[rgj].entity=mgCanon;var rkey=worldState.character.relationships[rgj].entity;if(!seenRel[rkey]){seenRel[rkey]=true;newRels2.push(worldState.character.relationships[rgj]);}}worldState.character.relationships=newRels2;}R.muts.push("Merged: "+mgDupe+" -> "+mgCanon);}}},
{t:"NPC",apply:function(text,R){var npcs=text.match(/\[NPC:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var ni;for(ni=0;ni<npcs.length;ni++){var np=npcs[ni].match(/\[NPC:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/);if(!np)continue;var npName=resolveNpcName(np[1].trim());
  var npStatus=clampNpcMood((np[2]||"").trim()),npRel=clampNpcMood((np[3]||"").trim()),npPron="";
  if(isPronounStr(npRel)){npPron=npRel;npRel="";}
  if(isPronounStr(npStatus)){if(!npPron)npPron=npStatus;npStatus="";}
  var found=false,nj;for(nj=0;nj<worldState.npcs.length;nj++){if(worldState.npcs[nj].name===npName){if(npStatus)worldState.npcs[nj].status=npStatus;if(npRel)worldState.npcs[nj].rel=npRel;if(npPron)worldState.npcs[nj].pronouns=npPron;found=true;break;}}
  if(!found){worldState.npcs.push({name:npName,status:npStatus||"unknown",rel:npRel||"unknown",pronouns:npPron||null,met:R.turn,partyMember:false,portrait:null,aliases:[]});if(typeof checkLegacyCharacter==="function")checkLegacyCharacter();}
  if(!memory.npcs[npName])memory.npcs[npName]={attitude:npRel||"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[npName].firstEncounter)memory.npcs[npName].firstEncounter=R.feGet();if(npRel)memory.npcs[npName].attitude=npRel;if(npPron)memory.npcs[npName].pronouns=npPron;mapNpcLocation(npName);R.muts.push("NPC: "+npName);}}},
{t:"XP",apply:function(text,R){var xpTags=text.match(/\[XP:\s*\+?(\d+)[^\]]*\]/g)||[];var xpi;for(xpi=0;xpi<xpTags.length;xpi++){var xpm=xpTags[xpi].match(/\[XP:\s*\+?(\d+)[^\]]*\]/);if(!xpm)continue;worldState.character.xp+=parseInt(xpm[1]);R.muts.push("+"+xpm[1]+" XP");checkLevelUp();R._xpMirror(parseInt(xpm[1]));}}},
{t:"QUEST",apply:function(text,R){var quests=text.match(/\[QUEST:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var qi;for(qi=0;qi<quests.length;qi++){var qp=quests[qi].match(/\[QUEST:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/);if(!qp)continue;var qTitle=qp[1].trim(),qStat=qp[2].trim().toLowerCase(),qDesc=qp[3]?qp[3].trim():"";if(qStat==="complete"||qStat==="done"||qStat==="finished")qStat="completed";else if(qStat==="abandoned"||qStat==="dropped")qStat="failed";else if(qStat==="accepted")qStat="active";else if(qStat==="declined")qStat="failed";var qIdx=-1,qj;for(qj=0;qj<worldState.questLog.length;qj++){if(worldState.questLog[qj].title.toLowerCase()===qTitle.toLowerCase()){qIdx=qj;break;}}if(qIdx<0){worldState.questLog.push({title:qTitle,status:qStat,desc:qDesc,objectives:[],started:R.turn});if(qStat==="offered"){if(typeof showToast==="function")showToast("⚑ Quest opportunity: "+qTitle);R.muts.push("Quest offered: "+qTitle);}else R.muts.push("Quest: "+qTitle+" ("+qStat+")");}else{var qq=worldState.questLog[qIdx];qq.status=qStat;if(qDesc)qq.desc=qDesc;R.muts.push("Quest "+qTitle+": "+qStat);}if(qStat==="completed"||qStat==="failed")archiveQuest(qTitle,qStat);}}},
{t:"QUEST_STEP",apply:function(text,R){var qsteps=text.match(/\[QUEST_STEP:([^|\]]+)\|([^|\]]+)\|?([^\]]*)\]/g)||[];var qsi;for(qsi=0;qsi<qsteps.length;qsi++){var qsp=qsteps[qsi].match(/\[QUEST_STEP:([^|\]]+)\|([^|\]]+)\|?([^\]]*)\]/);if(!qsp)continue;var qsTitle=qsp[1].trim(),qsObj=qsp[2].trim(),qsDone=/^(true|done|1|yes|x)$/i.test((qsp[3]||"").trim());var qsq=null,qk;for(qk=0;qk<worldState.questLog.length;qk++){if(worldState.questLog[qk].title.toLowerCase()===qsTitle.toLowerCase()){qsq=worldState.questLog[qk];break;}}if(!qsq)continue;if(qsq.status==="offered")continue;if(!qsq.objectives)qsq.objectives=[];var ofound=false,oj2;for(oj2=0;oj2<qsq.objectives.length;oj2++){if(qsq.objectives[oj2].text.toLowerCase()===qsObj.toLowerCase()){qsq.objectives[oj2].done=qsDone;ofound=true;break;}}if(!ofound)qsq.objectives.push({text:qsObj,done:qsDone});R.muts.push(qsTitle+(qsDone?" ✓ ":" + ")+qsObj);}}},
{t:"COMBAT_START",apply:function(text,R){var cs2=text.match(/\[COMBAT_START:([^|\]]+)\|(\d+)\|(\d+)\|([+-]?\d+)\|([^|]+)\|([^\]]+)\]/);if(cs2){worldState.combat={name:cs2[1].trim(),hp:parseInt(cs2[2]),maxHp:parseInt(cs2[2]),ac:parseInt(cs2[3]),atk:parseInt(cs2[4]),dmg:cs2[5].trim(),morale:cs2[6].trim(),round:1};R.muts.push("Combat: "+cs2[1].trim());}}},
{t:"COMBAT_STATS",apply:function(text,R){var cstats=text.match(/\[COMBAT_STATS:STR:(\d+)\|DEX:(\d+)\|CON:(\d+)\|INT:(\d+)\|WIS:(\d+)\|CHA:(\d+)\|CR:([0-9.\/]+)\]/);if(cstats&&worldState.combat){worldState.combat.stats={STR:+cstats[1],DEX:+cstats[2],CON:+cstats[3],INT:+cstats[4],WIS:+cstats[5],CHA:+cstats[6],CR:cstats[7]};}}},
{t:"COMBAT_IMMUNE",apply:function(text,R){var cimm=text.match(/\[COMBAT_IMMUNE:([^\]]+)\]/);if(cimm&&worldState.combat){worldState.combat.immune=cimm[1].split(",").map(function(s){return s.trim();}).filter(function(s){return s&&s.toLowerCase()!=="none";});}}},
{t:"COMBAT_RESIST",apply:function(text,R){var cresist=text.match(/\[COMBAT_RESIST:([^\]]+)\]/);if(cresist&&worldState.combat){worldState.combat.resist=cresist[1].split(",").map(function(s){return s.trim();}).filter(function(s){return s&&s.toLowerCase()!=="none";});}}},
{t:"COMBAT_VULN",apply:function(text,R){var cvuln=text.match(/\[COMBAT_VULN:([^\]]+)\]/);if(cvuln&&worldState.combat){worldState.combat.vuln=cvuln[1].split(",").map(function(s){return s.trim();}).filter(function(s){return s&&s.toLowerCase()!=="none";});}}},
{t:"ENEMY_HP",apply:function(text,R){var ehp=text.match(/\[ENEMY_HP:\s*([+-]?\d+)[^\]]*\]/);if(ehp&&worldState.combat){worldState.combat.hp=Math.max(0,worldState.combat.hp+parseInt(ehp[1]));}}},
{t:"COMBAT_ROUND",apply:function(text,R){var cr=text.match(/\[COMBAT_ROUND:(\d+)\]/);if(cr&&worldState.combat)worldState.combat.round=parseInt(cr[1]);}},
{t:"COMBAT_END",apply:function(text,R){var ce=text.match(/\[COMBAT_END:([^\]]+)\]/);if(ce){worldState.combat=null;R.muts.push("Combat: "+ce[1].trim());}
  else if(worldState.combat&&worldState.combat.hp<=0){var deadName=worldState.combat.name;worldState.combat=null;R.muts.push("Combat: victory ("+deadName+")");}}},
{t:"ABILITY_GAINED",apply:function(text,R){var abs=text.match(/\[ABILITY_GAINED:([^|\]]+)\|([^\]]+)\]/g)||[];var abi;for(abi=0;abi<abs.length;abi++){var abp=abs[abi].match(/\[ABILITY_GAINED:([^|\]]+)\|([^\]]+)\]/);if(!abp)continue;if(!worldState.character.abilities)worldState.character.abilities=[];var already=false,abj;for(abj=0;abj<worldState.character.abilities.length;abj++){if(worldState.character.abilities[abj].nm===abp[1]){already=true;break;}}if(!already){worldState.character.abilities.push({nm:abp[1],ds:abp[2],gained:R.turn});R.muts.push("Ability: "+abp[1]);}}}},
{t:"ALIGNMENT",apply:function(text,R){var alms=text.match(/\[ALIGNMENT:(law|good)([+-]\d+)\]/gi)||[];var ali;for(ali=0;ali<alms.length;ali++){var ap=alms[ali].match(/\[ALIGNMENT:(law|good)([+-]\d+)\]/i);if(ap){if(!worldState.character.alignLaw)worldState.character.alignLaw=0;if(!worldState.character.alignGood)worldState.character.alignGood=0;if(ap[1].toLowerCase()==="law")worldState.character.alignLaw=Math.max(-3,Math.min(3,worldState.character.alignLaw+parseInt(ap[2])));else worldState.character.alignGood=Math.max(-3,Math.min(3,worldState.character.alignGood+parseInt(ap[2])));var newAl=alignLabel(worldState.character.alignLaw,worldState.character.alignGood);if(newAl!==worldState.character.actualAlignment){R.muts.push("Align: "+newAl);worldState.character.actualAlignment=newAl;}}}}},
{t:"SPELL_USED",apply:function(text,R){var spellUsed=text.match(/\[SPELL_USED:([^\]]+)\]/g)||[];var sui;for(sui=0;sui<spellUsed.length;sui++){var sup=spellUsed[sui].match(/\[SPELL_USED:([^\]]+)\]/);if(sup&&worldState.character.spells){var spNm=sup[1].toLowerCase().trim(),spj;for(spj=0;spj<worldState.character.spells.length;spj++){var sp=worldState.character.spells[spj];if(sp.lvl===0)continue;
var spBase=sp.nm.replace(/\s*\(.*\)/,"").toLowerCase().trim();if(spBase===spNm||sp.nm.toLowerCase()===spNm){sp.used=true;R.muts.push("Spell used: "+sp.nm);break;}}}}}},
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
{t:"REST",apply:function(text,R){if(/\[REST:\s*long\b[^\]]*\]/i.test(text)&&typeof restSpells==="function"){restSpells();R.muts.push("Rest: spell slots restored");}}},
{t:"LORE",apply:function(text,R){var lores=text.match(/\[LORE:([^\]]+)\]/g)||[];for(var li=0;li<lores.length;li++){var lp=lores[li].match(/\[LORE:([^\]]+)\]/);if(lp)fileLore(lp[1]);}}},
{t:"DECISION",apply:function(text,R){var decs=text.match(/\[DECISION:([^\]]+)\]/g)||[];for(var di=0;di<decs.length;di++){var dp=decs[di].match(/\[DECISION:([^\]]+)\]/);if(dp)fileDecision(R.turn,dp[1]);}}},
{t:"FUTURE_EVENT",apply:function(text,R){var fes=text.match(/\[FUTURE_EVENT:([^|]+)\|([^\]]+)\]/g)||[];for(var fi=0;fi<fes.length;fi++){var fp=fes[fi].match(/\[FUTURE_EVENT:([^|]+)\|([^\]]+)\]/);if(fp)fileFutureEvent(fp[2],"",fp[1],R.turn);}}},
{t:"FUTURE_EVENT_RESOLVED",apply:function(text,R){var fres=text.match(/\[FUTURE_EVENT_RESOLVED:([^\]]+)\]/g)||[];var fri;for(fri=0;fri<fres.length;fri++){var frp=fres[fri].match(/\[FUTURE_EVENT_RESOLVED:([^\]]+)\]/);if(frp)resolveFutureEvent(frp[1]);}}},
{t:"NPC_NOTE",apply:function(text,R){var nns=text.match(/\[NPC_NOTE:([^|\]]+)\|([^\]]+)\]/g)||[];for(var nni=0;nni<nns.length;nni++){var nnp=nns[nni].match(/\[NPC_NOTE:([^|\]]+)\|([^\]]+)\]/);if(nnp)fileNpcEvent(nnp[1],nnp[2],R.turn);}}},
{t:"NPC_FORGET",apply:function(text,R){var forgets=text.match(/\[NPC_FORGET:([^|\]]+)\|([^\]]+)\]/g)||[];var fgi;for(fgi=0;fgi<forgets.length;fgi++){var fgp=forgets[fgi].match(/\[NPC_FORGET:([^|\]]+)\|([^\]]+)\]/);if(!fgp)continue;var fgName=resolveNpcName(fgp[1].trim()),fgWhat=fgp[2].trim().toLowerCase();var fgNpc=memory.npcs[fgName];if(!fgNpc)continue;var fgRem=0;if(fgNpc.knowledge){var fgkb=fgNpc.knowledge.length;fgNpc.knowledge=fgNpc.knowledge.filter(function(k){return String(k).toLowerCase().indexOf(fgWhat)<0;});fgRem+=fgkb-fgNpc.knowledge.length;}if(fgNpc.events){var fgeb=fgNpc.events.length;fgNpc.events=fgNpc.events.filter(function(e){return String(e&&e.note!==undefined?e.note:e).toLowerCase().indexOf(fgWhat)<0;});fgRem+=fgeb-fgNpc.events.length;}R.muts.push(fgName+" forgets: "+fgp[2].trim()+(fgRem?" ("+fgRem+")":""));}}},
{t:"NPC_PRONOUN",apply:function(text,R){var nprons=text.match(/\[NPC_PRONOUN:([^|\]]+)\|([^\]]+)\]/g)||[];for(var pni=0;pni<nprons.length;pni++){var pnp=nprons[pni].match(/\[NPC_PRONOUN:([^|\]]+)\|([^\]]+)\]/);if(pnp){var pname=resolveNpcName(pnp[1]),ppron=pnp[2],pfound=false,pnj;for(pnj=0;pnj<worldState.npcs.length;pnj++){if(worldState.npcs[pnj].name===pname){worldState.npcs[pnj].pronouns=ppron;pfound=true;break;}}if(!pfound)worldState.npcs.push({name:pname,status:"unknown",rel:"unknown",pronouns:ppron,met:R.turn,partyMember:false,portrait:null,aliases:[]});if(memory.npcs[pname])memory.npcs[pname].pronouns=ppron;else memory.npcs[pname]={attitude:"unknown",knowledge:[],events:[],aliases:[],pronouns:ppron};R.muts.push("Pronouns: "+pname+" ("+ppron+")");}}}},
{t:"NPC_LINK",apply:function(text,R){var npcLinks=text.match(/\[NPC_LINK:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var nli;for(nli=0;nli<npcLinks.length;nli++){var nlp=npcLinks[nli].match(/\[NPC_LINK:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!nlp)continue;var _plName=(worldState.character&&worldState.character.name)||"player";var _plMap=function(n){return /^player$/i.test(n)?_plName:n;};var nlA=resolveNpcName(_plMap(nlp[1].trim())),nlB=resolveNpcName(_plMap(nlp[2].trim())),nlRel=nlp[3].trim();npcLinkUpsert(nlA,nlB,nlRel);R.muts.push("Link: "+nlA+" ↔ "+nlB+" ("+nlRel+")");}}},
{t:"FACTION",apply:function(text,R){var facTags=text.match(/\[FACTION:([^|\]]+)\|([^\]]+)\]/g)||[];var fti;for(fti=0;fti<facTags.length;fti++){var ftp=facTags[fti].match(/\[FACTION:([^|\]]+)\|([^\]]+)\]/);if(!ftp)continue;factionUpsert(ftp[1].trim(),ftp[2].trim());R.muts.push("Faction: "+ftp[1].trim());}}},
{t:"NPC_FACTION",apply:function(text,R){var nfTags=text.match(/\[NPC_FACTION:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var nfti;for(nfti=0;nfti<nfTags.length;nfti++){var nfp=nfTags[nfti].match(/\[NPC_FACTION:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!nfp)continue;npcFactionSet(resolveNpcName(nfp[1].trim()),nfp[2].trim(),nfp[3].trim());R.muts.push(nfp[1].trim()+": "+nfp[2].trim()+" ["+nfp[3].trim()+"]");}}},
{t:"FACTION_REL",apply:function(text,R){var frTags=text.match(/\[FACTION_REL:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var frti;for(frti=0;frti<frTags.length;frti++){var frp2=frTags[frti].match(/\[FACTION_REL:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!frp2)continue;factionLinkUpsert(frp2[1].trim(),frp2[2].trim(),frp2[3].trim());R.muts.push("FactionRel: "+frp2[1].trim()+" ↔ "+frp2[2].trim()+" ("+frp2[3].trim()+")");}}},
{t:"PARTY_MEMBER",apply:function(text,R){var pmTags=text.match(/\[PARTY_MEMBER:([^|\]]+)\|([^\]]+)\]/g)||[];var pmi;for(pmi=0;pmi<pmTags.length;pmi++){var pmp=pmTags[pmi].match(/\[PARTY_MEMBER:([^|\]]+)\|([^\]]+)\]/);if(!pmp)continue;var pmName=resolveNpcName(pmp[1].trim()),pmVal=pmp[2].trim().toLowerCase()==="true",pmFoundIdx=-1,pmk;for(pmk=0;pmk<worldState.npcs.length;pmk++){if(worldState.npcs[pmk].name===pmName){pmFoundIdx=pmk;break;}}
  if(pmVal&&!(pmFoundIdx>=0&&worldState.npcs[pmFoundIdx].partyMember)&&partyCompanionCount()>=partyCompanionCap()){
    if(pmFoundIdx<0){worldState.npcs.push({name:pmName,status:"unknown",rel:"ally",met:R.turn,partyMember:false,portrait:null,aliases:[]});}
    else worldState.npcs[pmFoundIdx].partyMember=false;
    if(!memory.npcs[pmName])memory.npcs[pmName]={attitude:"unknown",knowledge:[],events:[],aliases:[],partyMember:false};
    if(typeof showToast==="function")showToast("Party full (max "+PARTY_MAX+") — "+pmName+" can't join until someone leaves.");
    R.muts.push("Party full: "+pmName+" not added");continue;
  }
  if(pmFoundIdx>=0){worldState.npcs[pmFoundIdx].partyMember=pmVal;}else{worldState.npcs.push({name:pmName,status:"unknown",rel:"unknown",met:R.turn,partyMember:pmVal,portrait:null,aliases:[]});pmFoundIdx=worldState.npcs.length-1;}
  if(pmVal&&!worldState.npcs[pmFoundIdx].charSheet)worldState.npcs[pmFoundIdx].sheetPending=true;
  else if(!pmVal)delete worldState.npcs[pmFoundIdx].sheetPending;
  if(memory.npcs[pmName])memory.npcs[pmName].partyMember=pmVal;else memory.npcs[pmName]={attitude:"unknown",knowledge:[],events:[],aliases:[],partyMember:pmVal};if(pmVal&&!memory.npcs[pmName].firstEncounter)memory.npcs[pmName].firstEncounter=R.feGet();R.muts.push(pmVal?"Party: +"+pmName:"Party: -"+pmName);}}},
{t:"SKILL_SUCCESS",apply:function(text,R){var skSuccs=text.match(/\[SKILL_SUCCESS:([^\]]+)\]/g)||[];var sski;for(sski=0;sski<skSuccs.length;sski++){var sskp=skSuccs[sski].match(/\[SKILL_SUCCESS:([^\]]+)\]/);if(!sskp)continue;var sskid=sskp[1].trim();if(!worldState.character.skills)worldState.character.skills=initSkills();
  if(typeof worldState.character.skills[sskid]!=="number"){var _skl=sskid.toLowerCase(),_ski;for(_ski=0;_ski<SKILLS.length;_ski++){if(SKILLS[_ski].id.toLowerCase()===_skl){sskid=SKILLS[_ski].id;break;}}}
  if(typeof worldState.character.skills[sskid]==="number"){var prevLvl=skillLevel(worldState.character.skills[sskid]);worldState.character.skills[sskid]++;var newLvl=skillLevel(worldState.character.skills[sskid]);if(newLvl>prevLvl){R.muts.push(sskid+": "+SKILL_LEVELS[newLvl]);showToast(sskid+": "+SKILL_LEVELS[newLvl]);}else R.muts.push(sskid+" +1");}}}},
{t:"CONDITION",apply:function(text,R){var condTags=text.match(/\[CONDITION:([^|\]]+)\|([^\]]+)\]/g)||[];var condi;for(condi=0;condi<condTags.length;condi++){var condp=condTags[condi].match(/\[CONDITION:([^|\]]+)\|([^\]]+)\]/);if(!condp)continue;if(!worldState.character.conditions)worldState.character.conditions=[];var cnm=condp[1].trim(),cdur=condp[2].trim(),calready=false,condj;for(condj=0;condj<worldState.character.conditions.length;condj++){if(worldState.character.conditions[condj].name.toLowerCase()===cnm.toLowerCase()){worldState.character.conditions[condj].duration=cdur;calready=true;break;}}if(!calready){worldState.character.conditions.push({name:cnm,duration:cdur});R.muts.push("Condition: "+cnm);}}}},
{t:"CONDITION_REMOVED",apply:function(text,R){var condRems=text.match(/\[CONDITION_REMOVED:([^\]]+)\]/g)||[];var cri2;for(cri2=0;cri2<condRems.length;cri2++){var crp2=condRems[cri2].match(/\[CONDITION_REMOVED:([^\]]+)\]/);if(!crp2)continue;if(!worldState.character.conditions)continue;var cbef=worldState.character.conditions.length,_crn=crp2[1].trim().toLowerCase();worldState.character.conditions=worldState.character.conditions.filter(function(x){return x.name.toLowerCase()!==_crn;});if(worldState.character.conditions.length<cbef)R.muts.push("Cured: "+crp2[1].trim());}}},
{t:"RELATIONSHIP",apply:function(text,R){var relTags=text.match(/\[RELATIONSHIP:([^|\]]+)\|([^\]]+)\]/g)||[];var reli;for(reli=0;reli<relTags.length;reli++){var relp=relTags[reli].match(/\[RELATIONSHIP:([^|\]]+)\|([^\]]+)\]/);if(!relp)continue;if(!worldState.character.relationships)worldState.character.relationships=[];var rnm=resolveNpcName(relp[1].trim()),rdsc=relp[2].trim(),rfound=false,relj;for(relj=0;relj<worldState.character.relationships.length;relj++){if(worldState.character.relationships[relj].entity===rnm){var prevRdsc=worldState.character.relationships[relj].descriptor;worldState.character.relationships[relj].descriptor=rdsc;rfound=true;if(prevRdsc!==rdsc)bondToast(null,rnm,rdsc,"updated");break;}}if(!rfound){worldState.character.relationships.push({entity:rnm,descriptor:rdsc});R.muts.push("Rel: "+rnm+" ("+rdsc+")");bondToast(null,rnm,rdsc,"new");}}}},
{t:"RELATIONSHIP_REMOVED",apply:function(text,R){var relRems=text.match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/g)||[];var rri2;for(rri2=0;rri2<relRems.length;rri2++){var rrp2=relRems[rri2].match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/);if(!rrp2)continue;if(!worldState.character.relationships)continue;var rrName=resolveNpcName(rrp2[1].trim());worldState.character.relationships=worldState.character.relationships.filter(function(x){return x.entity!==rrName;});R.muts.push("Rel removed: "+rrName);bondToast(null,rrName,null,"ended");}}},
{t:"SAVE_MOD",apply:function(text,R){var saveTags=text.match(/\[SAVE_MOD:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var smi2;for(smi2=0;smi2<saveTags.length;smi2++){var smp2=saveTags[smi2].match(/\[SAVE_MOD:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!smp2)continue;if(!worldState.character.saveModifiers)worldState.character.saveModifiers=[];var ssrc=smp2[1].trim(),stype=smp2[2].trim(),sval=parseInt(smp2[3]);if(isNaN(sval))continue;var sfound=false,smj;for(smj=0;smj<worldState.character.saveModifiers.length;smj++){if(worldState.character.saveModifiers[smj].source===ssrc){worldState.character.saveModifiers[smj].type=stype;worldState.character.saveModifiers[smj].amount=sval;sfound=true;break;}}if(!sfound)worldState.character.saveModifiers.push({source:ssrc,type:stype,amount:sval});var svalStr=sval>=0?"+"+sval:""+sval;R.muts.push("Save "+svalStr+" vs "+stype+" ["+ssrc+"]");}}},
{t:"SAVE_MOD_REMOVED",apply:function(text,R){var saveRemTags=text.match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/g)||[];var smri2;for(smri2=0;smri2<saveRemTags.length;smri2++){var smrp2=saveRemTags[smri2].match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/);if(!smrp2)continue;if(!worldState.character.saveModifiers)continue;var _srn=smrp2[1].trim().toLowerCase();worldState.character.saveModifiers=worldState.character.saveModifiers.filter(function(x){return x.source.toLowerCase()!==_srn;});}}},
{t:"LANGUAGE",apply:function(text,R){var langTags=text.match(/\[LANGUAGE:([^|\]]+)\|([^\]]+)\]/g)||[];var lni2;for(lni2=0;lni2<langTags.length;lni2++){var lnp2=langTags[lni2].match(/\[LANGUAGE:([^|\]]+)\|([^\]]+)\]/);if(!lnp2)continue;if(!worldState.character.languages)worldState.character.languages=[];var lname=lnp2[1].trim(),lbroken=lnp2[2].trim().toLowerCase()==="broken",lfound=false,lj2;for(lj2=0;lj2<worldState.character.languages.length;lj2++){if(worldState.character.languages[lj2].name.toLowerCase()===lname.toLowerCase()){worldState.character.languages[lj2].broken=lbroken;lfound=true;break;}}if(!lfound){worldState.character.languages.push({name:lname,broken:lbroken});R.muts.push((lbroken?"Broken ":"")+"Language: "+lname);}}}},
{t:"STORY_BEAT",apply:function(text,R){var beatTags=text.match(/\[STORY_BEAT:([^\]]+)\]/g)||[];var bti2;for(bti2=0;bti2<beatTags.length;bti2++){var btp2=beatTags[bti2].match(/\[STORY_BEAT:([^\]]+)\]/);if(!btp2)continue;if(!worldState.character.storyBeats)worldState.character.storyBeats=[];worldState.character.storyBeats.push({text:btp2[1],turn:R.turn});fileDecision(R.turn,"[Story Beat] "+btp2[1]);}}},
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
        if(!_act.parallel&&_sj+1<_act.arcs.length){_act.arcs[_sj+1].status="active";R.muts.push("New arc: "+_act.arcs[_sj+1].title);}
        break;
      }
      if(_matched)break;
    }
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
        if(_fa&&_fa.length){for(var _fj=0;_fj<_fa.length;_fj++){if(_isP||_fj===0)_fa[_fj].status="active";}}
        R.muts.push("New act: "+_sk2.acts[_si2+1].title);
      }else{R.muts.push("Campaign complete!");}
      break;
    }
  }}},
{t:"COMPANION_HP",apply:function(text,R){var cHpTags=text.match(/\[COMPANION_HP:([^|\]]+)\|\s*([+-]?\d+)[^\]]*\]/g)||[];var cHpi;for(cHpi=0;cHpi<cHpTags.length;cHpi++){var cHpm=cHpTags[cHpi].match(/\[COMPANION_HP:([^|\]]+)\|\s*([+-]?\d+)[^\]]*\]/);if(!cHpm)continue;var cHpCs=findCompanionChar(cHpm[1]);if(!cHpCs)continue;var cHpdv=parseInt(cHpm[2]);cHpCs.hp=Math.min(cHpCs.maxHp||cHpCs.hp,Math.max(0,cHpCs.hp+cHpdv));R.muts.push(cHpm[1].trim()+(cHpdv>0?" healed ":" took ")+Math.abs(cHpdv)+" HP");}}},
{t:"COMPANION_ITEM_GAINED",apply:function(text,R){var cIgTags=text.match(/\[COMPANION_ITEM_GAINED:([^|\]]+)\|([^\]]+)\]/g)||[];var cIgi;for(cIgi=0;cIgi<cIgTags.length;cIgi++){var cIgm=cIgTags[cIgi].match(/\[COMPANION_ITEM_GAINED:([^|\]]+)\|([^\]]+)\]/);if(!cIgm)continue;var cIgCs=findCompanionChar(cIgm[1]);if(!cIgCs)continue;if(!cIgCs.inventory)cIgCs.inventory=[];addInventoryItem(cIgCs.inventory,cIgm[2].trim());R.muts.push(cIgm[1].trim()+": +"+cIgm[2].trim());}}},
{t:"COMPANION_ITEM_LOST",apply:function(text,R){var cIlTags=text.match(/\[COMPANION_ITEM_LOST:([^|\]]+)\|([^\]]+)\]/g)||[];var cIli;for(cIli=0;cIli<cIlTags.length;cIli++){var cIlm=cIlTags[cIli].match(/\[COMPANION_ITEM_LOST:([^|\]]+)\|([^\]]+)\]/);if(!cIlm)continue;var cIlCs=findCompanionChar(cIlm[1]);if(!cIlCs||!cIlCs.inventory)continue;removeInventoryItem(cIlCs.inventory,cIlm[2].trim());R.muts.push(cIlm[1].trim()+": -"+cIlm[2].trim());}}},
{t:"COMPANION_XP",apply:function(text,R){var cXpTags=text.match(/\[COMPANION_XP:([^|\]]+)\|\s*\+?(\d+)[^\]]*\]/g)||[];var cXpi;for(cXpi=0;cXpi<cXpTags.length;cXpi++){var cXpm=cXpTags[cXpi].match(/\[COMPANION_XP:([^|\]]+)\|\s*\+?(\d+)[^\]]*\]/);if(!cXpm)continue;var cXpCs=findCompanionChar(cXpm[1]);if(!cXpCs)continue;if(typeof cXpCs.xp!=="number")cXpCs.xp=0;cXpCs.xp+=parseInt(cXpm[2]);R.muts.push(cXpm[1].trim()+": +"+cXpm[2]+" XP");checkCompanionLevelUp(cXpCs);}}},
{t:"COMPANION_CONDITION",apply:function(text,R){var cCondTags=text.match(/\[COMPANION_CONDITION:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cCondi;for(cCondi=0;cCondi<cCondTags.length;cCondi++){var cCondp=cCondTags[cCondi].match(/\[COMPANION_CONDITION:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!cCondp)continue;var cCondCs=findCompanionChar(cCondp[1]);if(!cCondCs)continue;if(!cCondCs.conditions)cCondCs.conditions=[];var cCnm=cCondp[2].trim(),cCdur=cCondp[3].trim(),cCalready=false,cCondj;for(cCondj=0;cCondj<cCondCs.conditions.length;cCondj++){if(cCondCs.conditions[cCondj].name===cCnm){cCondCs.conditions[cCondj].duration=cCdur;cCalready=true;break;}}if(!cCalready){cCondCs.conditions.push({name:cCnm,duration:cCdur});R.muts.push(cCondp[1].trim()+": "+cCnm);}}}},
{t:"COMPANION_CONDITION_REMOVED",apply:function(text,R){var cCrTags=text.match(/\[COMPANION_CONDITION_REMOVED:([^|\]]+)\|([^\]]+)\]/g)||[];var cCri;for(cCri=0;cCri<cCrTags.length;cCri++){var cCrp=cCrTags[cCri].match(/\[COMPANION_CONDITION_REMOVED:([^|\]]+)\|([^\]]+)\]/);if(!cCrp)continue;var cCrCs=findCompanionChar(cCrp[1]);if(!cCrCs||!cCrCs.conditions)continue;cCrCs.conditions=cCrCs.conditions.filter(function(x){return x.name!==cCrp[2].trim();});R.muts.push(cCrp[1].trim()+": cured "+cCrp[2].trim());}}},
{t:"COMPANION_RELATIONSHIP",apply:function(text,R){var cRelTags=text.match(/\[COMPANION_RELATIONSHIP:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cReli;for(cReli=0;cReli<cRelTags.length;cReli++){var cRelp=cRelTags[cReli].match(/\[COMPANION_RELATIONSHIP:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!cRelp)continue;var cRelCs=findCompanionChar(cRelp[1]);if(!cRelCs)continue;if(!cRelCs.relationships)cRelCs.relationships=[];var cRnm=resolveNpcName(cRelp[2].trim()),cRdsc=cRelp[3].trim(),cRfound=false,cRelj;for(cRelj=0;cRelj<cRelCs.relationships.length;cRelj++){if(cRelCs.relationships[cRelj].entity===cRnm){var prevCRdsc=cRelCs.relationships[cRelj].descriptor;cRelCs.relationships[cRelj].descriptor=cRdsc;cRfound=true;if(prevCRdsc!==cRdsc)bondToast(cRelp[1].trim(),cRnm,cRdsc,"updated");break;}}if(!cRfound){cRelCs.relationships.push({entity:cRnm,descriptor:cRdsc});R.muts.push(cRelp[1].trim()+": rel "+cRnm+" ("+cRdsc+")");bondToast(cRelp[1].trim(),cRnm,cRdsc,"new");}}}},
{t:"COMPANION_RELATIONSHIP_REMOVED",apply:function(text,R){var cRrTags=text.match(/\[COMPANION_RELATIONSHIP_REMOVED:([^|\]]+)\|([^\]]+)\]/g)||[];var cRri;for(cRri=0;cRri<cRrTags.length;cRri++){var cRrp=cRrTags[cRri].match(/\[COMPANION_RELATIONSHIP_REMOVED:([^|\]]+)\|([^\]]+)\]/);if(!cRrp)continue;var cRrCs=findCompanionChar(cRrp[1]);if(!cRrCs||!cRrCs.relationships)continue;var cRrNm=resolveNpcName(cRrp[2].trim());cRrCs.relationships=cRrCs.relationships.filter(function(x){return x.entity!==cRrNm;});R.muts.push(cRrp[1].trim()+": rel removed "+cRrNm);bondToast(cRrp[1].trim(),cRrNm,null,"ended");}}},
{t:"COMPANION_ABILITY",apply:function(text,R){var cAbTags=text.match(/\[COMPANION_ABILITY:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cAbi;for(cAbi=0;cAbi<cAbTags.length;cAbi++){var cAbp=cAbTags[cAbi].match(/\[COMPANION_ABILITY:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!cAbp)continue;var cAbCs=findCompanionChar(cAbp[1]);if(!cAbCs)continue;if(!cAbCs.abilities)cAbCs.abilities=[];var cAnm=cAbp[2].trim(),cAalready=false,cAbj;for(cAbj=0;cAbj<cAbCs.abilities.length;cAbj++){if(cAbCs.abilities[cAbj].nm===cAnm){cAalready=true;break;}}if(!cAalready){cAbCs.abilities.push({nm:cAnm,ds:cAbp[3].trim(),gained:R.turn});R.muts.push(cAbp[1].trim()+": ability "+cAnm);}}}},
{t:"COMPANION_ALIGNMENT",apply:function(text,R){var cAlTags=text.match(/\[COMPANION_ALIGNMENT:([^|\]]+)\|(law|good)([+-]\d+)\]/gi)||[];var cAli;for(cAli=0;cAli<cAlTags.length;cAli++){var cAlp=cAlTags[cAli].match(/\[COMPANION_ALIGNMENT:([^|\]]+)\|(law|good)([+-]\d+)\]/i);if(!cAlp)continue;var cAlCs=findCompanionChar(cAlp[1]);if(!cAlCs)continue;if(!cAlCs.alignLaw)cAlCs.alignLaw=0;if(!cAlCs.alignGood)cAlCs.alignGood=0;if(cAlp[2].toLowerCase()==="law")cAlCs.alignLaw=Math.max(-3,Math.min(3,cAlCs.alignLaw+parseInt(cAlp[3])));else cAlCs.alignGood=Math.max(-3,Math.min(3,cAlCs.alignGood+parseInt(cAlp[3])));var cNewAl=alignLabel(cAlCs.alignLaw,cAlCs.alignGood);if(cNewAl!==cAlCs.actualAlignment){R.muts.push(cAlp[1].trim()+": align "+cNewAl);cAlCs.actualAlignment=cNewAl;}}}}
];

// ── The table-driven parser (the future applyMuts body; shadow-only until cutover) ─────────────
function applyMutsTable(text){
  var R={muts:[],turn:worldState.turn,text:text};
  _sheetlessWarned={};
  var feSnip=null;
  R.feGet=function(){if(feSnip===null){var ft=cleanTxt(text).replace(/\*You could[\s\S]*$/,"").trim().slice(0,280);var fb=Math.max(ft.lastIndexOf(". "),ft.lastIndexOf("! "),ft.lastIndexOf("? "));if(fb>60)ft=ft.slice(0,fb+1);feSnip=ft;}return feSnip;};
  var _xpSkip=null;
  R._xpMirror=function(n){
    if(_xpSkip===null){_xpSkip=[];var _mt=text.match(/\[COMPANION_XP:([^|\]]+)\|/g)||[],_mi;for(_mi=0;_mi<_mt.length;_mi++){var _mm=_mt[_mi].match(/\[COMPANION_XP:([^|\]]+)\|/);if(_mm){var _mcs=findCompanionChar(_mm[1].trim());if(_mcs)_xpSkip.push(_mcs);}}}
    var _pi2,_shared=0;
    for(_pi2=0;_pi2<worldState.npcs.length;_pi2++){var _pn2=worldState.npcs[_pi2];
      if(!_pn2.partyMember||!_pn2.charSheet)continue;
      if(_xpSkip.indexOf(_pn2.charSheet)>=0)continue;
      if(typeof _pn2.charSheet.xp!=="number")_pn2.charSheet.xp=0;
      _pn2.charSheet.xp+=n;_shared++;checkCompanionLevelUp(_pn2.charSheet);
    }
    if(_shared)R.muts.push("party +"+n+" XP");
  };
  R.errors=[];
  for(var i=0;i<TAG_TABLE.length;i++){
    try{TAG_TABLE[i].apply(text,R);}
    catch(e){R.errors.push(TAG_TABLE[i].t+": "+(e&&e.message));console.warn("[tags] table handler "+TAG_TABLE[i].t+" threw:",e&&e.message);}
  }
  stampQuestCompletion();
  if(R.muts.length)addMsg("system",escHtml(R.muts.join(" | ")));
  syncUI();saveAll();
  return R;
}

// ── Shadow mode: run the table against CLONES by swapping the state globals + stubbing UI ───────
function __tagCloneWS(ws){var t=ws.transcript;ws.transcript=null;var c;try{c=JSON.parse(JSON.stringify(ws));}finally{ws.transcript=t;}c.transcript=[];return c;}
function __tagShadowRun(text){
  var realWS=worldState,realMem=memory;
  // Save every UI/persistence surface the handlers (or their callees — checkLevelUp,
  // checkCompanionLevelUp, archiveQuest…) can reach, then make them inert for the clone run.
  // checkLegacyCharacter is stubbed because it rolls Math.random — the one non-deterministic
  // callee; its live-side effects (pendingLegacy/legacyCharsUsed) are diff-skipped below.
  var sToast=typeof showToast!=="undefined"?showToast:undefined,
      sMsg=typeof addMsg!=="undefined"?addMsg:undefined,
      sSync=typeof syncUI!=="undefined"?syncUI:undefined,
      sAll=typeof saveAll!=="undefined"?saveAll:undefined,
      sCore=typeof saveCore!=="undefined"?saveCore:undefined,
      sMem=typeof saveMem!=="undefined"?saveMem:undefined,
      sMeta=typeof updateCampMeta!=="undefined"?updateCampMeta:undefined,
      sBond=typeof bondToast!=="undefined"?bondToast:undefined,
      sArch=typeof showArchetypeModal!=="undefined"?showArchetypeModal:undefined,
      sBump=typeof showStatBumpModal!=="undefined"?showStatBumpModal:undefined,
      sLeg=typeof checkLegacyCharacter!=="undefined"?checkLegacyCharacter:undefined,
      sBumps=typeof _levelBumpsOwed!=="undefined"?_levelBumpsOwed:null;
  var elStub={appendChild:function(){},remove:function(){},style:{},textContent:"",innerHTML:""};
  showToast=function(){};addMsg=function(){return elStub;};syncUI=function(){};saveAll=function(){};
  saveCore=function(){};saveMem=function(){};updateCampMeta=function(){};bondToast=function(){};
  showArchetypeModal=function(){};showStatBumpModal=function(){};checkLegacyCharacter=function(){};
  worldState=__tagCloneWS(realWS);memory=JSON.parse(JSON.stringify(realMem));
  var out={err:null,R:null};
  try{out.R=applyMutsTable(text);}catch(e){out.err=e;}
  out.ws=worldState;out.mem=memory;
  worldState=realWS;memory=realMem;
  if(sToast!==undefined)showToast=sToast;if(sMsg!==undefined)addMsg=sMsg;if(sSync!==undefined)syncUI=sSync;
  if(sAll!==undefined)saveAll=sAll;if(sCore!==undefined)saveCore=sCore;if(sMem!==undefined)saveMem=sMem;
  if(sMeta!==undefined)updateCampMeta=sMeta;if(sBond!==undefined)bondToast=sBond;
  if(sArch!==undefined)showArchetypeModal=sArch;if(sBump!==undefined)showStatBumpModal=sBump;
  if(sLeg!==undefined)checkLegacyCharacter=sLeg;
  if(sBumps!==null)_levelBumpsOwed=sBumps;
  return out;
}
// Deep structural diff. Skips functions; treats missing-vs-undefined as equal; path-prefix skips
// cover the fields applyMuts never owns or that are non-deterministic by design:
//   ws.transcript (not cloned) · ws.pendingLegacy / ws.legacyCharsUsed (checkLegacyCharacter rolls
//   Math.random live but is stubbed in shadow) · ws.usage (telemetry) · ws.lastActions (async).
var __TAG_DIFF_SKIP=["ws.transcript","ws.pendingLegacy","ws.legacyCharsUsed","ws.usage","ws.lastActions"];
function __tagDeepDiff(a,b,path,out){
  if(out.length>=50)return;
  for(var k=0;k<__TAG_DIFF_SKIP.length;k++){if(path===__TAG_DIFF_SKIP[k])return;}
  if(a===b)return;
  var ta=typeof a,tb=typeof b;
  if(ta==="function"||tb==="function")return;
  if(a===null||b===null||ta!=="object"||tb!=="object"){
    if(!(a===undefined&&b===undefined))out.push(path+": "+JSON.stringify(a)+" ≠ "+JSON.stringify(b));
    return;
  }
  var keys={},k2;for(k2 in a)keys[k2]=1;for(k2 in b)keys[k2]=1;
  for(k2 in keys)__tagDeepDiff(a[k2],b[k2],path+"."+k2,out);
}
// Called from applyMuts (old parser) AFTER its mutations: compares the shadow clone's end state
// against the real end state. Zero diffs = parity. LOUD on any difference (no-silent-failures)
// and durable: a ring buffer persists to localStorage so a soak survives closed tabs.
var __tagShadowToastShown=false;
var __tagParityRuns=0,__tagDiffCount=0; // module globals — readable from the page or node alike
function __tagShadowDiff(sh){
  __tagParityRuns++;
  var diffs=[];
  if(sh.err)diffs.push("TABLE THREW: "+(sh.err&&sh.err.message));
  if(sh.R&&sh.R.errors&&sh.R.errors.length)diffs.push("handler errors: "+sh.R.errors.join("; "));
  __tagDeepDiff(sh.ws,worldState,"ws",diffs);
  __tagDeepDiff(sh.mem,memory,"mem",diffs);
  if(!diffs.length)return;
  __tagDiffCount++;
  console.warn("[tag-shadow] MUTATION DIFF (old parser vs table) — "+diffs.length+" path(s):");
  for(var i=0;i<Math.min(diffs.length,10);i++)console.warn("  ✗ "+diffs[i]);
  try{
    var log=JSON.parse((typeof store!=="undefined"?store.get("tnd_tagdiff_v1"):null)||"[]");
    log.push({t:Date.now(),turn:worldState.turn,camp:worldState.campId||null,diffs:diffs.slice(0,10)});
    if(log.length>25)log=log.slice(-25);
    if(typeof store!=="undefined")store.set("tnd_tagdiff_v1",JSON.stringify(log));
  }catch(e){}
  if(!__tagShadowToastShown&&typeof showToast==="function"){__tagShadowToastShown=true;showToast("⚠ tag-shadow diff detected — see console (soak evidence recorded)");}
}
// Unknown-tag detector: any [NAME:...] whose NAME isn't in the strip registry is either a GM
// invention or a vocabulary gap — both worth a loud line (the phantom-tag class, inverted).
var __TAG_KNOWN=null;
function __tagUnknownScan(text){
  if(!__TAG_KNOWN){__TAG_KNOWN={};var i;for(i=0;i<TAG_STRIP_NAMES.length;i++)__TAG_KNOWN[TAG_STRIP_NAMES[i]]=1;for(i=0;i<TAG_STRIP_BARE.length;i++)__TAG_KNOWN[TAG_STRIP_BARE[i]]=1;}
  var ms=text.match(/\[([A-Z][A-Z_]{2,}):/g)||[],seen={},i;
  for(i=0;i<ms.length;i++){var nm=ms[i].slice(1,-1);if(__TAG_KNOWN[nm]||seen[nm])continue;seen[nm]=1;
    console.warn("[tags] UNKNOWN tag ["+nm+":…] in GM response — not parsed, not stripped (vocabulary gap or GM invention)");}
}
