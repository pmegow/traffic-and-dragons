// engine-tests.js — the shared test suites for TODO #14 (DEV TOOL, not loaded by index.html).
// Consumed two ways, against the SAME engine files (globals→data→helpers→state→memory→api→game):
//   1. test.html          — browser view, red/green rows
//   2. dev/run-tests.js   — headless node runner, wired into .git/hooks/pre-commit so every
//                           commit is gated on ALL GREEN ("run tests at the end of every build")
// Everything here is deliberately DOM-free: UI functions are stubbed with plain objects so the
// node runner needs no document at all. ES5 throughout, same as the engine.

function runEngineTests(R){
  var section=R.section,t=R.t;

  // ── UI + persistence stubs (reassign the engine's globals; DOM-free) ─────────
  var __toasts=[];
  function __stubEl(){return {appendChild:function(){},style:{},remove:function(){},textContent:"",innerHTML:"",className:""};}
  addMsg=function(){return __stubEl();};
  showToast=function(m){__toasts.push(String(m));};
  syncUI=function(){};
  updateAbPanel=function(){};
  updateSpPanel=function(){};
  showArchetypeModal=function(){};
  showStatBumpModal=function(){};
  saveAll=function(){};saveCore=function(){};saveMem=function(){};
  if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};

  function eq(got,want,label){if(got===want)return true;return (label||"")+" expected "+JSON.stringify(want)+" got "+JSON.stringify(got);}

  // Fresh minimal world for state tests — mirrors the harness character shape.
  function makeWorld(){
    memory=blankMemory();sessionLog=[];__toasts.length=0;
    worldState={ver:10,campId:null,campName:"Test",legacyCharsUsed:[],pendingLegacy:null,
      character:{name:"Tess",gender:"F",age:"30",appear:"",mark:"",backstory:"",ancestry:"Human",subrace:"northlander",subraceNm:"Northlander",heritageVariant:"",
        cls:"Warrior",stats:{STR:15,DEX:12,CON:14,INT:10,WIS:10,CHA:10},hp:14,maxHp:14,gold:25,
        inventory:["Longsword","Travel ration"],level:1,xp:0,abilities:[],spells:[{nm:"Faerie Fire (racial, 1/day)",lvl:1,used:false}],
        archetype:"",archetypeNm:"",statedAlignment:"True Neutral",actualAlignment:"True Neutral",alignLaw:0,alignGood:0,deity:"",
        trait:"",flaw:"",motivation:"",languages:[{name:"Common",broken:false}],skills:initSkills(),
        conditions:[],relationships:[],saveModifiers:[],portrait:null,storyBeats:[],partyMember:true},
      world:{location:"Ashfen",region:"The Reach",time:"dusk",weather:"rain",threat:"low",sublocation:null},
      npcs:[],questLog:[],eventHistory:[],combat:null,turn:5,transcript:[],ragMemory:false};
    // RAG defaults ON in production (v1.230); tests pin it OFF here for a deterministic baseline and
    // opt in explicitly. The default-on semantics are covered by their own unit test below.
  }

  // ── 1. Model-output JSON repair (the generateSkeleton/summarize failure class) ──
  section("repairModelJson / stripCodeFences");
  t("fenced object parses",function(){var o=JSON.parse(repairModelJson("```json\n{\"a\":1}\n```"));return eq(o.a,1);});
  t("preamble + postamble prose stripped",function(){var o=JSON.parse(repairModelJson("Here is your JSON:\n{\"a\":1}\nHope that helps!"));return eq(o.a,1);});
  t("trailing commas repaired",function(){var o=JSON.parse(repairModelJson('{"a":[1,2,],"b":{"c":3,},}'));return eq(o.a.length,2)===true?eq(o.b.c,3):"array len wrong";});
  t("literal newline inside a string value repaired",function(){var o=JSON.parse(repairModelJson('{"a":"line1\nline2"}'));return o.a.indexOf("line1")===0?true:"value mangled: "+o.a;});
  t("all four failure classes at once",function(){var o=JSON.parse(repairModelJson("Sure!\n```json\n{\"premise\":\"a\nb\",\"acts\":[1,2,],}\n```\nEnjoy."));return eq(o.acts.length,2);});
  t("stripCodeFences leaves arrays intact (action suggestions)",function(){var a=JSON.parse(stripCodeFences("```json\n[\"Draw steel\",\"Run\",\"Talk\"]\n```"));return eq(a.length,3);});

  // ── 2. Pure helpers ──────────────────────────────────────────────────────────
  section("helpers");
  t("skillLevel thresholds",function(){var w=[[0,0],[1,1],[4,1],[5,2],[11,2],[12,3],[25,4],[49,4],[50,5]];for(var i=0;i<w.length;i++){if(skillLevel(w[i][0])!==w[i][1])return "successes "+w[i][0]+" → "+skillLevel(w[i][0])+" want "+w[i][1];}return true;});
  t("getLvl boundaries",function(){var w=[[0,1],[299,1],[300,2],[899,2],[900,3],[64000,10],[999999,10]];for(var i=0;i<w.length;i++){if(getLvl(w[i][0])!==w[i][1])return "xp "+w[i][0]+" → "+getLvl(w[i][0])+" want "+w[i][1];}return true;});
  t("alignLabel 9-grid corners + center",function(){return eq(alignLabel(0,0),"True Neutral")===true&&eq(alignLabel(2,2),"Lawful Good")===true&&eq(alignLabel(-2,-2),"Chaotic Evil")===true&&eq(alignLabel(0,2),"Neutral Good")===true?eq(alignLabel(2,0),"Lawful Neutral"):"corner mismatch";});
  t("toFirstPerson: possessive",function(){return eq(toFirstPerson("Gather your belongings"),"Gather my belongings");});
  t("toFirstPerson: subject you",function(){return eq(toFirstPerson("You draw your sword"),"I draw my sword");});
  t("toFirstPerson: contraction",function(){return eq(toFirstPerson("You're ready"),"I'm ready");});
  t("toFirstPerson: reflexive",function(){return eq(toFirstPerson("Defend yourself"),"Defend myself");});
  t("toFirstPerson: object you after verb",function(){return eq(toFirstPerson("Let the guard follow you"),"Let the guard follow me");});
  t("pronounsForGender",function(){return eq(pronounsForGender("F"),"she/her")===true&&eq(pronounsForGender("NB"),"they/them")===true?eq(pronounsForGender("M"),"he/him"):"NB/F wrong";});
  t("escProse escapes markup but keeps *em* and paragraph breaks (E11)",function(){
    var h=escProse("<img src=x onerror=alert(1)> and *bold* text\n\nnext para");
    if(h.indexOf("<img")>=0)return "raw <img leaked into story DOM: "+h;
    if(h.indexOf("&lt;img")<0)return "markup not escaped";
    if(h.indexOf("<em>bold</em>")<0)return "emphasis transform lost";
    return h.indexOf("</p><p>")>=0?true:"paragraph break lost";
  });
  t("inventory stacking: case+plural stack to x2",function(){var inv=["Travel ration"];addInventoryItem(inv,"travel rations");return eq(inv.length,1)===true?eq(inv[0],"Travel ration x2"):"did not stack: "+JSON.stringify(inv);});
  t("inventory stacking: parenthetical qualifiers stay separate",function(){var inv=["Sword (rusty)"];addInventoryItem(inv,"Sword (enchanted)");return eq(inv.length,2);});
  t("inventory removal: decrements and drops suffix at 1",function(){var inv=["Arrow x2"];removeInventoryItem(inv,"Arrow");if(inv[0]!=="Arrow")return "want bare Arrow got "+inv[0];removeInventoryItem(inv,"arrow");return eq(inv.length,0);});

  section("capcapability_bible (TODO #10)");
  t("capBaseName strips the display parenthetical and lowercases",function(){return eq(capBaseName("Fire Bolt (d10 fire, 120ft)"),"fire bolt");});
  t("lookup resolves a full SPELLS display string to its canonical entry",function(){var e=capabilityLookup("Fire Bolt (d10 fire, 120ft)");return e&&e.range==="120ft"&&e.tier===0?true:"got "+JSON.stringify(e);});
  t("lookup is case-insensitive on the bare name",function(){var e=capabilityLookup("MESSAGE");return e&&e.range==="120ft"?true:"message not resolved: "+JSON.stringify(e);});
  t("Message canon pins the range (the drift case)",function(){var e=capabilityLookup("message");return e&&e.range==="120ft"&&/does not reach beyond 120ft/i.test(e.effect)?true:"drift guard missing: "+JSON.stringify(e&&e.effect);});
  t("Hunter's Mark canon states the one-at-a-time exclusivity (P10)",function(){var e=capabilityLookup("Hunter's Mark (d6 bonus damage, track target)");return e&&/exclusive/i.test(e.effect)&&/only one/i.test(e.effect)?true:"exclusivity note missing";});
  t("unknown spell returns null",function(){return eq(capabilityLookup("Bogus Nonexistent Cantrip"),null);});
  t("every capability entry has kind/cost/isMagical/effect (spells also tier+range)",function(){var bad=[];for(var k in CAPABILITY_BIBLE){var e=CAPABILITY_BIBLE[k];var ok=(e.kind==="spell"||e.kind==="ability")&&!!e.cost&&typeof e.isMagical==="boolean"&&!!e.effect&&(e.kind!=="spell"||(typeof e.tier==="number"&&!!e.range));if(!ok)bad.push(k);}return bad.length?"malformed: "+bad.join(", "):true;});
  t("emergent overlay (worldState.capabilityBible) wins over the static base",function(){makeWorld();worldState.capabilityBible={"message":{kind:"spell",tier:0,cost:"at-will",isMagical:true,range:"1 mile",targets:"1 creature",duration:"1 round",effect:"campaign-custom sending stone"}};var e=capabilityLookup("Message (whisper 120ft, target replies)");return e&&e.range==="1 mile"?true:"overlay did not win: "+JSON.stringify(e);});
  t("buildSpellBibleBlock renders canon for known spells, skips unknowns/dupes",function(){makeWorld();worldState.character.spells=[{nm:"Fire Bolt (d10 fire, 120ft)",lvl:0,used:false},{nm:"Fire Bolt (d10 fire, 120ft)",lvl:0,used:false},{nm:"Totally Made Up Spell",lvl:1,used:false}];var b=buildSpellBibleBlock();if(b.indexOf("CANONICAL SPELL RULES")<0)return "header missing";if(b.indexOf("Totally Made Up Spell")>=0)return "unknown spell leaked in";return (b.split("- Fire Bolt").length-1)===1?true:"expected one Fire Bolt line (dedupe), got "+(b.split("- Fire Bolt").length-1);});
  t("buildSpellBibleBlock is empty for a non-caster (no known spells)",function(){makeWorld();worldState.character.spells=[];return eq(buildSpellBibleBlock(),"");});
  t("spell canon lands in the VOLATILE half, never the cached stable half",function(){makeWorld();worldState.character.spells=[{nm:"Message (whisper 120ft, target replies)",lvl:0,used:false}];var s=buildSysPrompt();var MARK="CANONICAL SPELL RULES (authoritative";/* block header, distinct from the SPELL_DEF instruction that names the block */if(s.stable.indexOf(MARK)>=0)return "spell canon block leaked into stable — kills the cache";return s.volatile.indexOf(MARK)>=0?true:"canon missing from volatile";});
  t("[SPELL_DEF:] files a GM-invented spell into the overlay; lookup returns it",function(){makeWorld();applyMuts("[SPELL_DEF:Frost Lance|range=60ft|targets=1 creature|duration=instantaneous|effect=a lance of ice; DEX save or 2d8 cold and slowed|cost=slot|tier=1|magical=yes]");var e=capabilityLookup("Frost Lance");return e&&e.range==="60ft"&&e.cost==="slot"&&e.tier===1&&e.isMagical===true&&/lance of ice/.test(e.effect)?true:"bad overlay entry: "+JSON.stringify(e);});
  t("[SPELL_DEF:] is write-once — a second definition does not overwrite",function(){makeWorld();applyMuts("[SPELL_DEF:Frost Lance|range=60ft|effect=original]");applyMuts("[SPELL_DEF:Frost Lance|range=1 mile|effect=drifted]");var e=capabilityLookup("Frost Lance");return e&&e.range==="60ft"?true:"write-once failed, got range "+(e&&e.range);});
  t("[SPELL_DEF:] magical=no sets isMagical false",function(){makeWorld();applyMuts("[SPELL_DEF:Mundane Trick|effect=sleight of hand|magical=no]");var e=capabilityLookup("Mundane Trick");return e&&e.isMagical===false?true:"isMagical not false: "+JSON.stringify(e);});
  t("cleanTxt strips [SPELL_DEF:] from displayed prose",function(){return eq(cleanTxt("You weave a new working, and the air chills. [SPELL_DEF:Frost Lance|range=60ft|effect=ice]"),"You weave a new working, and the air chills.");});
  t("capability_bible: martial ability resolves and is isMagical:false",function(){var e=capabilityLookup("Power Strike");return e&&e.kind==="ability"&&e.isMagical===false?true:"bad: "+JSON.stringify(e);});
  t("capability_bible: arcane ability is isMagical:true",function(){var e=capabilityLookup("Arcane Bolt");return e&&e.isMagical===true?true:"arcane bolt not magical";});
  t("CAPABILITY_BIBLE holds both kinds (spells + abilities merged, v1.222)",function(){var sp=0,ab=0;for(var k in CAPABILITY_BIBLE){if(CAPABILITY_BIBLE[k].kind==="spell")sp++;else if(CAPABILITY_BIBLE[k].kind==="ability")ab++;}return sp>=15&&ab>=15?true:"unexpected split sp="+sp+" ab="+ab;});
  t("full spell coverage — every SPELLS/ARCH_SPELLS entry has a bible key (v1.225)",function(){function base(s){return String(s).replace(/\s*\(.*\)/,"").toLowerCase().trim();}var miss=[];function scan(SRC){for(var cls in SRC)for(var t in SRC[cls])SRC[cls][t].forEach(function(s){var b=base(s);if(!CAPABILITY_BIBLE[b])miss.push(b);});}scan(SPELLS);scan(ARCH_SPELLS);return miss.length?"uncovered ("+miss.length+"): "+miss.slice(0,8).join(", "):true;});
  t("every entry has a non-empty category list drawn from the tradition vocabulary (v1.223; +racial v1.226)",function(){var vocab={arcane:1,divine:1,primal:1,necromantic:1,martial:1,racial:1},bad=[];for(var k in CAPABILITY_BIBLE){var c=CAPABILITY_BIBLE[k].category;if(!c||!c.length||c.some(function(x){return !vocab[x];}))bad.push(k);}return bad.length?"bad category: "+bad.join(", "):true;});
  t("Turn Undead is both divine and necromantic (multi-tradition)",function(){var c=capabilityLookup("turn undead").category;return c.indexOf("divine")>=0&&c.indexOf("necromantic")>=0?true:"got "+JSON.stringify(c);});
  t("capabilitiesByCategory('divine') gates the cleric menu (incl Turn Undead, excl martial)",function(){var d=capabilitiesByCategory("divine").map(function(x){return x.name;});return d.indexOf("turn undead")>=0&&d.indexOf("sacred flame")>=0&&d.indexOf("power strike")<0?true:"divine menu wrong: "+d.join(", ");});
  t("racial coverage — every ANCS racial_caps key resolves in the bible (single-source guard, v1.226)",function(){function base(s){return String(s).replace(/\s*\(.*\)/,"").toLowerCase().trim();}var miss=[];function chk(list){if(!list)return;list.forEach(function(it){var nm=typeof it==="string"?it:it.cap;if(!CAPABILITY_BIBLE[base(nm)])miss.push(nm);});}ANCS.forEach(function(a){chk(a.racial_caps);(a.subraces||[]).forEach(function(s){chk(s.racial_caps);(s.lineages||[]).forEach(function(l){chk(l.racial_caps);});});});return miss.length?"racial_caps with no bible entry: "+miss.join(", "):true;});
  t("racial category is drawn by no caster tradition (heritage stays out of enemy caster menus, v1.226)",function(){var rac=capabilitiesByCategory("racial").map(function(x){return x.name;}),arc=capabilitiesByCategory("arcane").map(function(x){return x.name;}),div=capabilitiesByCategory("divine").map(function(x){return x.name;});return rac.indexOf("darkvision")>=0&&arc.indexOf("darkvision")<0&&div.indexOf("darkvision")<0?true:"darkvision leaked into a tradition menu";});
  t("a racial cap resolves to its bible canon (Superior Darkvision 120ft; Camouflage is an ability, v1.226)",function(){var sd=capabilityLookup("Superior Darkvision"),cam=capabilityLookup("Camouflage");return sd&&sd.range==="120ft"&&cam&&cam.kind==="ability"?true:"bad: "+JSON.stringify([sd&&sd.range,cam&&cam.kind]);});
  t("[SPELL_DEF:] parses a comma-separated category into the overlay",function(){makeWorld();applyMuts("[SPELL_DEF:Grave Bolt|effect=a bolt of grave-cold|category=arcane,necromantic]");var e=capabilityLookup("Grave Bolt");return e&&e.category.length===2&&e.category.indexOf("necromantic")>=0?true:"bad category parse: "+JSON.stringify(e&&e.category);});
  t("bibleCardHTML renders the category chips",function(){var h=bibleCardHTML("Turn Undead",capabilityLookup("turn undead"));return h.indexOf(">divine<")>=0&&h.indexOf(">necromantic<")>=0?true:"category chips missing";});
  t("every entry carries the full fixed attribute set (cost/range/targets/duration/save/dice, v1.224)",function(){var need=["cost","range","targets","duration","save","dice"],bad=[];for(var k in CAPABILITY_BIBLE){var e=CAPABILITY_BIBLE[k];need.forEach(function(f){if(e[f]==null||e[f]==="")bad.push(k+"."+f);});}return bad.length?"missing/empty: "+bad.slice(0,6).join(", "):true;});
  t("card shows exactly 6 attribute rows, N/A-filled (no variance)",function(){var h=bibleCardHTML("Death Sight",capabilityLookup("death sight"));var rows=(h.match(/<tr>/g)||[]).length;return rows===6&&h.indexOf("N/A")>=0&&h.indexOf("Duration")>=0?true:"rows="+rows;});
  t("injection line is labeled + complete — a no-duration ability still states duration: N/A",function(){makeWorld();worldState.character.abilities=[{nm:"Death Sight",ds:"x"}];var b=buildAbilityBibleBlock();return /Death Sight —/.test(b)&&/duration: N\/A/.test(b)&&/damage: N\/A/.test(b)?true:"incomplete line: "+b.slice(0,200);});
  t("capabilityLookup resolves an ability-that-is-a-spell via capcapability_bible (no dup canon)",function(){var e=capabilityLookup("Sacred Flame");return e&&e.kind==="spell"?true:"Sacred Flame should resolve as the spell entry, got "+JSON.stringify(e&&e.kind);});
  t("capabilityLookup falls back to capability_bible for a pure ability",function(){var e=capabilityLookup("Trackless Step");return e&&e.kind==="ability"?true:"trackless step not resolved as ability";});
  t("buildAbilityBibleBlock renders canon for known abilities, skips unknowns",function(){makeWorld();worldState.character.abilities=[{nm:"Power Strike",ds:"x"},{nm:"Totally Fake Ability",ds:"y"}];var b=buildAbilityBibleBlock();if(b.indexOf("CANONICAL ABILITY RULES")<0)return "header missing";if(b.indexOf("Totally Fake Ability")>=0)return "unknown ability leaked";return b.indexOf("- Power Strike")>=0?true:"power strike canon missing";});
  t("ability canon lands in VOLATILE, never stable",function(){makeWorld();worldState.character.abilities=[{nm:"Power Strike",ds:"x"}];var s=buildSysPrompt();if(s.stable.indexOf("CANONICAL ABILITY RULES")>=0)return "ability canon leaked into stable";return s.volatile.indexOf("CANONICAL ABILITY RULES")>=0?true:"ability canon missing from volatile";});
  t("bibleCardHTML (shared render) shows name, fields, and the magical badge",function(){var h=bibleCardHTML("Message",capabilityLookup("message"));return h.indexOf("Message")>=0&&h.indexOf("magical")>=0&&h.indexOf("120ft")>=0?true:"card missing bits";});
  t("bibleCardHTML marks a mundane ability as mundane, not magical",function(){var h=bibleCardHTML("Power Strike",capabilityLookup("power strike"));return h.indexOf("mundane")>=0&&h.indexOf("&#10022; magical")<0?true:"mundane badge wrong";});
  t("bibleCardHTML handles a null entry gracefully",function(){return bibleCardHTML("Unknown",null).indexOf("No canonical entry")>=0?true:"null card not handled";});
  t("bibleCardHTML escapes an apostrophe name (no attr break)",function(){var h=bibleCardHTML("Hunter's Mark",capabilityLookup("Hunter's Mark"));return h.indexOf("Hunter&#39;s Mark")>=0?true:"apostrophe not escaped";});

  // ── 3. NPC name resolution (the v1.143 anti-fork engine) ─────────────────────
  section("resolveNpcName");
  t("parenthetical variant resolves to canonical",function(){memory=blankMemory();memory.npcs["Morwen Zethran"]={attitude:"ally",knowledge:[],events:[],aliases:[]};return eq(resolveNpcName("Morwen (Ammut's wife)"),"Morwen Zethran");});
  t("honorific + surname resolves",function(){memory=blankMemory();memory.npcs["Sheriff Belor Hemlock"]={attitude:"neutral",knowledge:[],events:[],aliases:[]};return eq(resolveNpcName("Hemlock"),"Sheriff Belor Hemlock");});
  t("shared-surname siblings do NOT merge",function(){memory=blankMemory();memory.npcs["Ameiko Kaijitsu"]={attitude:"ally",knowledge:[],events:[],aliases:[]};memory.npcs["Tsuto Kaijitsu"]={attitude:"enemy",knowledge:[],events:[],aliases:[]};return eq(resolveNpcName("Kaijitsu"),"Kaijitsu");});
  t("role-only names are unmergeable",function(){memory=blankMemory();memory.npcs["Barkeep (Rusty Dragon)"]={attitude:"neutral",knowledge:[],events:[],aliases:[]};return eq(resolveNpcName("The Innkeeper"),"The Innkeeper");});
  t("registered alias wins before token matching",function(){memory=blankMemory();memory.npcs["Veyra"]={attitude:"ally",knowledge:[],events:[],aliases:["The Grey Blade"]};return eq(resolveNpcName("The Grey Blade"),"Veyra");});

  // ── 4. cleanTxt / diceTxt / parseActions ─────────────────────────────────────
  section("cleanTxt / diceTxt / parseActions");
  t("cleanTxt strips a kitchen sink of tags, keeps prose",function(){
    var raw="The blade falls. [HP:-3][GOLD:-5 gp][ITEM_GAINED:Rope][XP:+25][NPC:Bram|wary|ally][QUEST:Test|offered|desc][QUEST_STEP:Test|obj|false][COMBAT_START:Wolf|9|12|+2|d6|low][ENEMY_HP:-4][COMBAT_END:victory][CONDITION:Bleeding|1 hour][RELATIONSHIP:Bram|Ally][SAVE_MOD:Ward|Fear|2][LANGUAGE:Elvish|broken][STORY_BEAT:It begins][FUTURE_EVENT:doom|soon][FUTURE_EVENT_RESOLVED:doom][NPC_PRONOUN:Bram|he/him][NPC_ALIAS:Bram|The Quiet][SUBLOCATION_LEAVE][TIME:dawn][WEATHER:river mist][REST:long][COMPANION_HP:Lyra|-2][ACTIONS:a|b|c][SKILL_SUCCESS:Climbing][LOCATION_DESC:A dark room][ARC_COMPLETE:First Blood] You survive.";
    var c=cleanTxt(raw);
    if(c.indexOf("[")>=0)return "tag survived: …"+c.slice(Math.max(0,c.indexOf("[")-10),c.indexOf("[")+30)+"…";
    return c.indexOf("The blade falls.")===0&&c.indexOf("You survive.")>0?true:"prose damaged: "+c;
  });
  t("cleanTxt converts em-dashes and collapses blank runs",function(){var c=cleanTxt("A — B\n\n\n\nC");return eq(c,"A, B\n\nC");});
  t("diceTxt renders a dice block",function(){var h=diceTxt("[DICE:Strength check|14|success]");return h.indexOf("dice-block")>0&&h.indexOf("14")>0?true:"bad html: "+h;});
  t("parseActions: [ACTIONS:] tag",function(){var r=parseActions("prose","prose [ACTIONS:Fight|Flee|Parley]");return (r.btns.match(/data-action/g)||[]).length===3?true:"btns: "+r.btns;});
  t("parseActions: bare pipe-bracket (non-Claude)",function(){var r=parseActions("prose [Fight|Flee|Parley]","prose [Fight|Flee|Parley]");return (r.btns.match(/data-action/g)||[]).length===3&&r.clean==="prose"?true:"clean/btns wrong: "+JSON.stringify(r.clean);});
  t("parseActions: legacy *You could…* line",function(){var r=parseActions("Something happens. *You could fight; flee; or parley*","");return (r.btns.match(/data-action/g)||[]).length===3?true:"btns: "+r.btns;});
  t("parseActions: none → no buttons",function(){var r=parseActions("Just prose.","Just prose.");return eq(r.btns,"");});

  // ── 5. applyMuts — the state-tag engine ──────────────────────────────────────
  section("applyMuts");
  t("HP clamps to [0,maxHp]",function(){makeWorld();applyMuts("[HP:-99]");if(worldState.character.hp!==0)return "floor failed: "+worldState.character.hp;applyMuts("[HP:+99]");return eq(worldState.character.hp,14,"ceiling");});
  t("GOLD parses '-5 gp' variant and floors at 0",function(){makeWorld();applyMuts("[GOLD:-5 gp]");if(worldState.character.gold!==20)return "got "+worldState.character.gold;applyMuts("[GOLD:-999]");return eq(worldState.character.gold,0,"floor");});
  t("signed [XP:+25] parses (v1.144 regression)",function(){makeWorld();applyMuts("[XP:+25]");return eq(worldState.character.xp,25);});
  t("XP level-up applies HP gain",function(){makeWorld();applyMuts("[XP:400]");return eq(worldState.character.level,2)===true?(worldState.character.maxHp>14?true:"maxHp not raised"):"level "+worldState.character.level;});
  t("ITEM_GAINED duplicate stacks to x2",function(){makeWorld();applyMuts("[ITEM_GAINED:Longsword]");var f=worldState.character.inventory.filter(function(x){return x.indexOf("Longsword")===0;});return eq(f.length,1)===true?eq(f[0],"Longsword x2"):"dup entries: "+JSON.stringify(f);});
  t("NPC registers; pronoun in relation slot rerouted",function(){makeWorld();applyMuts("[NPC:Bram|wary|he/him]");var n=worldState.npcs[0];return n&&n.name==="Bram"&&n.pronouns==="he/him"&&n.rel!=="he/him"?true:"npc: "+JSON.stringify(n);});
  t("NPC_ALIAS keeps one memory entry across variants",function(){makeWorld();applyMuts("[NPC:Veyra|calm|ally][NPC_ALIAS:Veyra|The Grey Blade]");applyMuts("[NPC_NOTE:The Grey Blade|paid her debt]");var k=Object.keys(memory.npcs);return eq(k.length,1)===true?(memory.npcs["Veyra"].events.length===1?true:"note misfiled"):"forked: "+k.join(",");});
  t("offered quest: QUEST_STEP is ignored (v1.144 gate)",function(){makeWorld();applyMuts("[QUEST:The Toll|offered|pay or fight][QUEST_STEP:The Toll|Refuse to pay|false]");return eq(worldState.questLog[0].objectives.length,0);});
  t("TIME / WEATHER tags advance the world clock (audit R2)",function(){makeWorld();applyMuts("[TIME:dawn][WEATHER:cold drizzle]");return worldState.world.time==="dawn"&&worldState.world.weather==="cold drizzle"?true:"time="+worldState.world.time+" weather="+worldState.world.weather;});
  t("active quest: QUEST_STEP adds + completes objectives",function(){makeWorld();applyMuts("[QUEST:Hunt|active|kill the wolf][QUEST_STEP:Hunt|Track the wolf|false]");applyMuts("[QUEST_STEP:Hunt|Track the wolf|true]");var o=worldState.questLog[0].objectives;return eq(o.length,1)===true?(o[0].done===true?true:"not done"):"objs: "+o.length;});
  t("quest status 'complete' normalizes and archives",function(){makeWorld();applyMuts("[QUEST:Hunt|active|d]");applyMuts("[QUEST:Hunt|complete]");return eq(worldState.questLog.length,0,"live log")===true?(memory.quests["Hunt"]&&memory.quests["Hunt"].status==="completed"?true:"archive: "+JSON.stringify(memory.quests)):"still live";});
  t("combat auto-clears at 0 enemy HP (v1.140 net)",function(){makeWorld();applyMuts("[COMBAT_START:Wolf|9|12|+2|d6|low]");applyMuts("[ENEMY_HP:-9]");return eq(worldState.combat,null);});
  t("F2: a world-location change clears stale combat (enemy fled, no COMBAT_END)",function(){makeWorld();applyMuts("[COMBAT_START:Pterafolk|14|13|+4|2d6|low]");if(!worldState.combat)return "combat did not start";applyMuts("We flee downriver. [LOCATION:Tiryki River]");return eq(worldState.combat,null);});
  t("F2: location change does NOT clear when the same response opens a fresh fight",function(){makeWorld();applyMuts("[COMBAT_START:Wolf|9|12|+2|d6|low]");applyMuts("[LOCATION:Dark Wood][COMBAT_START:Bear|20|13|+5|2d8|high]");return worldState.combat&&worldState.combat.name==="Bear"?true:"expected the new Bear fight, got "+JSON.stringify(worldState.combat);});
  t("condition add, duration update, remove",function(){makeWorld();applyMuts("[CONDITION:Bleeding|1 hour]");applyMuts("[CONDITION:Bleeding|until bandaged]");if(worldState.character.conditions.length!==1)return "dup condition";if(worldState.character.conditions[0].duration!=="until bandaged")return "duration not updated";applyMuts("[CONDITION_REMOVED:Bleeding]");return eq(worldState.character.conditions.length,0);});
  t("SKILL_SUCCESS increments a known skill only",function(){makeWorld();applyMuts("[SKILL_SUCCESS:Climbing][SKILL_SUCCESS:Made Up Skill]");return eq(worldState.character.skills["Climbing"],1)===true?eq(worldState.character.skills["Made Up Skill"],undefined,"unknown skill"):"climb "+worldState.character.skills["Climbing"];});
  t("PARTY_MEMBER cap blocks a 4th companion",function(){makeWorld();worldState.npcs=[{name:"A",status:"ally",rel:"c",partyMember:true},{name:"B",status:"ally",rel:"c",partyMember:true},{name:"C",status:"ally",rel:"c",partyMember:true}];applyMuts("[PARTY_MEMBER:Newbie|true]");var n=worldState.npcs.filter(function(x){return x.name==="Newbie";})[0];return n&&n.partyMember===false&&__toasts.join(" ").indexOf("Party full")>=0?true:"cap failed: "+JSON.stringify(n);});
  t("COMPANION_HP hits the companion sheet, not the player",function(){makeWorld();worldState.npcs=[{name:"Lyra",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Lyra",hp:10,maxHp:10}}];applyMuts("[COMPANION_HP:Lyra|-4]");return eq(worldState.npcs[0].charSheet.hp,6)===true?eq(worldState.character.hp,14,"player untouched"):"companion hp wrong";});
  t("LOCATION travel records a map edge",function(){makeWorld();applyMuts("[LOCATION:Greyford]");var e=memory.map.edges[0];return worldState.world.location==="Greyford"&&e&&e.from==="Ashfen"&&e.to==="Greyford"?true:"edge: "+JSON.stringify(memory.map.edges);});
  t("blueprint-shaped location entry does not crash (v1.144 regression)",function(){makeWorld();memory.locations["Seeded"]={notes:["from blueprint"]};applyMuts("[LOCATION:Seeded]");return memory.locations["Seeded"].visited.length===1?true:"visited not healed";});
  t("FUTURE_EVENT files, dedupes, resolves",function(){makeWorld();applyMuts("[FUTURE_EVENT:the debt comes due|soon]");applyMuts("[FUTURE_EVENT:the debt comes due|soon]");if(memory.futureEvents.length!==1)return "dedupe failed: "+memory.futureEvents.length;applyMuts("[FUTURE_EVENT_RESOLVED:the debt comes due]");return eq(memory.futureEvents.length,0);});
  t("ALIGNMENT clamps at ±3 and relabels",function(){makeWorld();applyMuts("[ALIGNMENT:good+1][ALIGNMENT:good+1][ALIGNMENT:good+1][ALIGNMENT:good+1]");return eq(worldState.character.alignGood,3)===true?eq(worldState.character.actualAlignment,"Neutral Good"):"good="+worldState.character.alignGood;});
  t("SAVE_MOD upserts by source; REMOVED filters",function(){makeWorld();applyMuts("[SAVE_MOD:Ward|Fear|2]");applyMuts("[SAVE_MOD:Ward|Fear|3]");if(worldState.character.saveModifiers.length!==1)return "dup";if(worldState.character.saveModifiers[0].amount!==3)return "not updated";applyMuts("[SAVE_MOD_REMOVED:Ward]");return eq(worldState.character.saveModifiers.length,0);});
  t("RELATIONSHIP upsert + REMOVED resolve through aliases",function(){makeWorld();applyMuts("[NPC:Veyra|calm|ally][NPC_ALIAS:Veyra|The Grey Blade]");applyMuts("[RELATIONSHIP:The Grey Blade|Sworn ally]");if(!worldState.character.relationships.length||worldState.character.relationships[0].entity!=="Veyra")return "not resolved: "+JSON.stringify(worldState.character.relationships);applyMuts("[RELATIONSHIP_REMOVED:The Grey Blade]");return eq(worldState.character.relationships.length,0);});
  t("SPELL_USED matches base name through the racial parenthetical",function(){makeWorld();applyMuts("[SPELL_USED:Faerie Fire]");return eq(worldState.character.spells[0].used,true);});
  // ── tag capture bounding (audit E8/E18/E42/E52) ──
  t("QUEST_STEP 2-field form doesn't over-capture across a later tag (E8)",function(){
    makeWorld();
    applyMuts("[QUEST:Hunt|active|kill the beast][QUEST_STEP:Hunt|Track the beast into the fens] The trail is fresh. [DICE:Survival check|14|success]");
    var o=worldState.questLog[0].objectives;
    if(o.length!==1)return "objectives: "+o.length;
    return o[0].text==="Track the beast into the fens"?true:"objective over-captured: "+JSON.stringify(o[0].text);
  });
  t("a pipeless [QUEST:] doesn't stitch through prose into a later tag (E18)",function(){
    makeWorld();
    applyMuts("[QUEST:Save the town] and then [NPC:Bram|wary|neutral] appears.");
    // Malformed QUEST (no status pipe) must NOT create a quest titled with the stitched prose.
    var badTitle=worldState.questLog.filter(function(q){return q.title.indexOf("town")>=0&&q.title.length>20;});
    if(badTitle.length)return "stitched garbage quest: "+JSON.stringify(badTitle[0].title);
    return worldState.npcs.some(function(n){return n.name==="Bram";})?true:"the following NPC tag was eaten by the stitch";
  });
  t("[NPC:name|status] two-field form registers (E42)",function(){
    makeWorld();applyMuts("[NPC:Talia|nervous]");
    var n=worldState.npcs.filter(function(x){return x.name==="Talia";})[0];
    return n&&n.status==="nervous"?true:"2-field NPC dropped: "+JSON.stringify(n);
  });
  t("[LOCATION:] with a leading space is trimmed, not forked (E52)",function(){
    makeWorld();applyMuts("[LOCATION: Ashfen]");
    return worldState.world.location==="Ashfen"?true:"not trimmed: "+JSON.stringify(worldState.world.location);
  });
  // ── format-drift tolerance (audit E17/E29/E30/E10) ──
  t("COMBAT_START tolerates a multi-word morale (E17)",function(){
    makeWorld();applyMuts("[COMBAT_START:Dire Wolf|18|13|+4|2d6|fights to the death]");
    return worldState.combat&&worldState.combat.name==="Dire Wolf"&&worldState.combat.morale.indexOf("death")>=0?true:"combat not started: "+JSON.stringify(worldState.combat);
  });
  t("COMBAT_END tolerates a multi-word outcome; ENEMY_HP tolerates trailing text (E17)",function(){
    makeWorld();applyMuts("[COMBAT_START:Wolf|20|12|+2|d6|low]");
    applyMuts("[ENEMY_HP:-8 slashing]");
    if(!worldState.combat||worldState.combat.hp!==12)return "ENEMY_HP not applied: "+(worldState.combat&&worldState.combat.hp);
    applyMuts("[COMBAT_END:the enemy flees]");
    return eq(worldState.combat,null);
  });
  t("CONDITION_REMOVED matches case-insensitively (E29)",function(){
    makeWorld();applyMuts("[CONDITION:Poisoned|1 hour]");applyMuts("[CONDITION_REMOVED:poisoned]");
    return eq(worldState.character.conditions.length,0);
  });
  t("SKILL_SUCCESS resolves a lowercased skill id (E29)",function(){
    makeWorld();applyMuts("[SKILL_SUCCESS:stealth]");
    return eq(worldState.character.skills["Stealth"],1);
  });
  t("QUEST status 'accepted' normalizes to active (E30)",function(){
    makeWorld();applyMuts("[QUEST:Deliver the seal|offered|carry it north]");applyMuts("[QUEST:Deliver the seal|accepted]");
    var q=worldState.questLog[0];
    return q&&q.status==="active"?true:"status: "+(q&&q.status);
  });
  t("diceTxt renders every DICE tag, not just the first (E41)",function(){
    var h=diceTxt("[DICE:Strength check|14|success] and later [DICE:Dexterity check|8|failed]");
    var n=(h.match(/dice-block/g)||[]).length;
    return n===2?true:"rendered "+n+" dice block(s), want 2";
  });
  // ── ordering + companion/merge (audit E9/E16/E10/E31) ──
  t("first-visit SUBLOCATION desc files to the sub-node, not the parent (E9)",function(){
    makeWorld();
    memory.map.nodes["Ashfen"]={firstVisit:5,visits:1,description:null,parent:null,npcs:[],items:[],size:null,travelMins:null};
    applyMuts("[SUBLOCATION:The Rusty Flagon][LOCATION_DESC:A smoky common room thick with pipe smoke.]");
    if(memory.map.nodes["Ashfen"].description)return "parent poisoned with sub desc: "+memory.map.nodes["Ashfen"].description;
    var sub=memory.map.nodes["Ashfen|The Rusty Flagon"];
    return sub&&sub.description&&sub.description.indexOf("common room")>=0?true:"sub desc missing: "+JSON.stringify(sub&&sub.description);
  });
  t("findCompanionChar resolves an alias/short name (E16)",function(){
    makeWorld();
    memory.npcs["Sheriff Belor Hemlock"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    worldState.npcs=[{name:"Sheriff Belor Hemlock",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Sheriff Belor Hemlock",hp:10,maxHp:10}}];
    applyMuts("[COMPANION_HP:Hemlock|-4]"); // short form
    return worldState.npcs[0].charSheet.hp===6?true:"companion by alias not resolved: "+worldState.npcs[0].charSheet.hp;
  });
  t("NPC_MERGE grafts the dupe's charSheet/partyMember onto canonical (E10)",function(){
    makeWorld();
    worldState.npcs=[{name:"Hemlock",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Hemlock",cls:"Warrior",level:2,hp:15,maxHp:15}}];
    memory.npcs["Hemlock"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    memory.npcs["Sheriff Belor Hemlock"]={attitude:"neutral",knowledge:[],events:[],aliases:[]};
    applyMuts("[NPC_MERGE:Sheriff Belor Hemlock|Hemlock]");
    if(worldState.npcs.filter(function(n){return n.name==="Hemlock";}).length)return "dupe still in roster";
    var canon=worldState.npcs.filter(function(n){return n.name==="Sheriff Belor Hemlock";})[0];
    if(!canon)return "canonical missing from roster (companion silently dropped)";
    return canon.partyMember&&canon.charSheet&&canon.charSheet.level===2?true:"charSheet/partyMember not grafted: "+JSON.stringify(canon);
  });
  t("NPC_MERGE re-keys npcGraph edges from the dupe (E31)",function(){
    makeWorld();
    memory.npcs["Hemlock"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    memory.npcs["Sheriff Belor Hemlock"]={attitude:"neutral",knowledge:[],events:[],aliases:[]};
    memory.npcGraph.edges=[{a:"Hemlock",b:"Zarith",rel:"employer",turn:3}];
    applyMuts("[NPC_MERGE:Sheriff Belor Hemlock|Hemlock]");
    var e=memory.npcGraph.edges[0];
    return e&&e.a==="Sheriff Belor Hemlock"&&e.b==="Zarith"?true:"edge not re-keyed: "+JSON.stringify(e);
  });

  // ── 5b. Companion sheet generation (audit P2) ────────────────────────────────
  section("companion sheets (audit P2)");
  t("PARTY_MEMBER join without a sheet sets sheetPending",function(){
    makeWorld();applyMuts("[NPC:Ekene|wary|guide][PARTY_MEMBER:Ekene|true]");
    var n=worldState.npcs.filter(function(x){return x.name==="Ekene";})[0];
    return n&&n.partyMember===true&&n.sheetPending===true?true:"flag not set: "+JSON.stringify(n);
  });
  t("PARTY_MEMBER join with an existing charSheet does NOT flag",function(){
    makeWorld();worldState.npcs=[{name:"Lyra",status:"ally",rel:"companion",partyMember:false,charSheet:{name:"Lyra",hp:10,maxHp:10}}];
    applyMuts("[PARTY_MEMBER:Lyra|true]");
    return worldState.npcs[0].sheetPending?"flagged despite existing sheet":true;
  });
  t("PARTY_MEMBER|false clears a stale pending flag",function(){
    makeWorld();worldState.npcs=[{name:"Ekene",status:"ally",rel:"guide",partyMember:true,sheetPending:true}];
    applyMuts("[PARTY_MEMBER:Ekene|false]");
    return worldState.npcs[0].sheetPending?"flag survived departure":true;
  });
  t("buildCompanionSheetStub: valid v10 shape at the player's level",function(){
    makeWorld();worldState.character.level=4;
    worldState.npcs=[{name:"Ekene",status:"ally",rel:"wandering hunter",partyMember:true,sheetPending:true,pronouns:"she/her"}];
    var s=buildCompanionSheetStub("Ekene");
    if(s.level!==4)return "level "+s.level+" want 4";
    if(s.cls!=="Ranger")return "class guess: "+s.cls+" want Ranger (from 'hunter')";
    if(s.gender!=="F")return "gender from pronouns: "+s.gender;
    if(s.hp!==s.maxHp||s.hp<1)return "hp insane: "+s.hp+"/"+s.maxHp;
    if(s.xp!==XP_LEVELS[3])return "xp not seeded at band floor: "+s.xp;
    if(Object.keys(s.skills).length!==SKILLS.length)return "skills map incomplete";
    var arrs=["inventory","abilities","spells","conditions","relationships","saveModifiers","languages","storyBeats"],i;
    for(i=0;i<arrs.length;i++){if(!s[arrs[i]]||typeof s[arrs[i]].length!=="number")return arrs[i]+" missing";}
    return s.partyMember===true?true:"partyMember not set";
  });
  t("stub hp follows the class hit-die formula",function(){
    makeWorld();worldState.character.level=4;
    worldState.npcs=[{name:"Ekene",status:"ally",rel:"hunter",partyMember:true}];
    var s=buildCompanionSheetStub("Ekene"); // Ranger hd 10, conMod 0: 10 + 3*(5+1) = 28
    return s.maxHp===28?true:"maxHp "+s.maxHp+" want 28";
  });
  t("normalizeCompanionSheet: level forced to player, insane hp clamped, cls case-healed",function(){
    makeWorld();worldState.character.level=3;
    worldState.npcs=[{name:"Ekene",status:"ally",rel:"guide",partyMember:true,sheetPending:true}];
    var s=normalizeCompanionSheet({name:"Ekene",cls:"warrior",level:9,maxHp:999,stats:{STR:14,DEX:12,CON:14,INT:99,WIS:10,CHA:10}},"Ekene");
    if(s.level!==3)return "level not forced: "+s.level;
    if(s.cls!=="Warrior")return "cls not healed: "+s.cls;
    if(s.stats.INT!==20)return "stat not clamped: "+s.stats.INT;
    var want=companionBaselineHp("Warrior",3,2); // conMod from CON 14
    return s.maxHp===want&&s.hp===want?true:"hp not clamped to baseline: "+s.maxHp+" want "+want;
  });
  t("parseCompanionSheet survives fenced JSON; returns null on garbage",function(){
    makeWorld();worldState.npcs=[{name:"Ekene",status:"ally",rel:"guide",partyMember:true}];
    var s=parseCompanionSheet("```json\n{\"name\":\"Ekene\",\"cls\":\"Rogue\",\"gender\":\"F\",\"maxHp\":8,\"stats\":{\"STR\":10,\"DEX\":15,\"CON\":10,\"INT\":12,\"WIS\":10,\"CHA\":12}}\n```","Ekene");
    if(!s||s.cls!=="Rogue"||s.gender!=="F")return "fenced sheet not parsed: "+JSON.stringify(s&&{cls:s.cls,gender:s.gender});
    return parseCompanionSheet("I am sorry, I cannot do that.","Ekene")===null?true:"garbage did not return null";
  });
  t("buildCompanionSheetPrompt includes player level+class and truncates knowledge",function(){
    makeWorld();worldState.character.level=5;
    worldState.npcs=[{name:"Ekene",status:"steady",rel:"guide",partyMember:true}];
    var big="";while(big.length<5000)big+="Ekene grew up on the marsh roads. ";
    memory.npcs["Ekene"]={attitude:"warm",knowledge:[big],events:["saved the party at the ford"],aliases:[]};
    var p=buildCompanionSheetPrompt("Ekene");
    if(p.msg.indexOf("level 5 Warrior")<0)return "player level/class missing";
    if(p.msg.indexOf("MUST be exactly 5")<0)return "level demand missing";
    if(p.msg.indexOf(big)>=0)return "knowledge not truncated";
    return p.msg.indexOf("saved the party at the ford")>=0?true:"events missing";
  });
  t("COMPANION_HP on a sheet-less party member warns instead of silently dropping",function(){
    makeWorld();worldState.npcs=[{name:"Ekene",status:"ally",rel:"guide",partyMember:true,sheetPending:true}];
    applyMuts("[COMPANION_HP:Ekene|-4]");
    return __toasts.join(" ").indexOf("no character sheet")>=0?true:"no warning toast: "+JSON.stringify(__toasts);
  });
  t("attachCompanionSheet clears the flag and makes findCompanionChar resolve",function(){
    makeWorld();worldState.npcs=[{name:"Ekene",status:"ally",rel:"guide",partyMember:true,sheetPending:true}];
    memory.npcs["Ekene"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    attachCompanionSheet("Ekene",buildCompanionSheetStub("Ekene"));
    var n=worldState.npcs[0];
    if(!n.charSheet)return "sheet not attached";
    if(n.sheetPending)return "pending flag not cleared";
    if(!findCompanionChar("Ekene"))return "findCompanionChar still misses";
    applyMuts("[COMPANION_HP:Ekene|-3]");
    return n.charSheet.hp===n.charSheet.maxHp-3?true:"COMPANION_HP still no-ops: "+n.charSheet.hp;
  });
  t("XP mirror reaches a companion once the sheet is attached",function(){
    makeWorld();worldState.npcs=[{name:"Ekene",status:"ally",rel:"guide",partyMember:true,sheetPending:true}];
    attachCompanionSheet("Ekene",buildCompanionSheetStub("Ekene"));
    var before=worldState.npcs[0].charSheet.xp;
    applyMuts("[XP:50]");
    return worldState.npcs[0].charSheet.xp===before+50?true:"mirror missed: "+worldState.npcs[0].charSheet.xp;
  });

  // ── 6. migrateWorldState (save-import battery) ───────────────────────────────
  section("migrateWorldState");
  t("fills every v10 field on a bare old save",function(){
    memory=blankMemory();
    worldState={character:{name:"Old",cls:"Rogue",stats:{STR:8,DEX:15,CON:10,INT:12,WIS:10,CHA:13},maxHp:8},world:{location:"Somewhere"},questLog:[{title:"Q"}]};
    migrateWorldState();
    var c=worldState.character;
    if(typeof c.level!=="number"||typeof c.hp!=="number"||typeof c.gold!=="number")return "numerics missing";
    if(!worldState.npcs||!worldState.eventHistory||!worldState.transcript||!worldState.legacyCharsUsed)return "arrays missing";
    if(worldState.pendingLegacy!==null)return "pendingLegacy";
    if(!worldState.campName)return "campName";
    if(!worldState.questLog[0].objectives||worldState.questLog[0].desc===undefined)return "quest fields";
    return true;
  });
  t("blankMemory carries the full shape (audit #22)",function(){var m=blankMemory();var need=["npcs","locations","quests","lore","keyDecisions","futureEvents","chapters","usedNames","nameIdx","map","npcGraph"];for(var i=0;i<need.length;i++){if(!(need[i] in m))return "missing "+need[i];}return m.npcGraph.factions?true:"npcGraph incomplete";});
  t("getNameSuggestions peek mode never mutates the cursor",function(){memory=blankMemory();var a=getNameSuggestions(5,true).join("|"),b=getNameSuggestions(5,true).join("|");return a===b&&memory.nameIdx===0?true:"cursor moved: "+memory.nameIdx;});
  t("migrateWorldState adds a usage accumulator to old saves (TODO #21)",function(){memory=blankMemory();worldState={character:{name:"Old",cls:"Rogue",stats:{},maxHp:8},world:{location:"X"}};migrateWorldState();var u=worldState.usage;return u&&u.calls===0&&u.byKind&&typeof u.costUSD==="number"?true:"usage: "+JSON.stringify(u);});
  t("portrait dedupe (#3): npc.portrait moves into charSheet and the duplicate is dropped",function(){
    memory=blankMemory();
    worldState={character:{name:"P",cls:"Rogue",stats:{},maxHp:8},world:{location:"X"},
      npcs:[
        {name:"BothSet",partyMember:true,portrait:"NPC_COPY",charSheet:{name:"BothSet",portrait:"SHEET_COPY"}},
        {name:"NpcOnly",partyMember:true,portrait:"OLD_IMG",charSheet:{name:"NpcOnly",portrait:null}},
        {name:"Sheetless",portrait:"KEEP_ME"}
      ]};
    migrateWorldState();
    var n=worldState.npcs;
    if(n[0].portrait!==null)return "both-set: duplicate kept";
    if(n[0].charSheet.portrait!=="SHEET_COPY")return "both-set: sheet copy overwritten";
    if(n[1].portrait!==null)return "npc-only: not cleared";
    if(n[1].charSheet.portrait!=="OLD_IMG")return "npc-only: not moved into sheet";
    return n[2].portrait==="KEEP_ME"?true:"sheet-less NPC portrait touched";
  });
  t("xp floor: level-ahead-of-xp sheets are floored to the level threshold (the Morwen full-bar lie)",function(){
    memory=blankMemory();
    worldState={character:{name:"P",cls:"Rogue",stats:{},maxHp:8,level:7,xp:21000},world:{location:"X"},
      npcs:[
        {name:"Morwen",partyMember:true,charSheet:{name:"Morwen",level:7,xp:21000}},
        {name:"Fine",partyMember:true,charSheet:{name:"Fine",level:7,xp:25000}},
        {name:"Fresh",partyMember:true,charSheet:{name:"Fresh",level:1,xp:0}}
      ]};
    migrateWorldState();
    if(worldState.character.xp!==23000)return "player not floored: "+worldState.character.xp;
    if(worldState.npcs[0].charSheet.xp!==23000)return "companion not floored: "+worldState.npcs[0].charSheet.xp;
    if(worldState.npcs[1].charSheet.xp!==25000)return "above-floor xp touched";
    return worldState.npcs[2].charSheet.xp===0?true:"level-1 xp touched";
  });
  t("npcPortrait reads charSheet first, falls back to npc.portrait, null-safe",function(){
    if(npcPortrait({charSheet:{portrait:"A"},portrait:"B"})!=="A")return "charSheet not preferred";
    if(npcPortrait({charSheet:{portrait:null},portrait:"B"})!=="B")return "pre-migration fallback broken";
    if(npcPortrait({name:"x"})!==null)return "portrait-less not null";
    return npcPortrait(null)===null?true:"null npc not handled";
  });
  t("fillPortraitsFromBlob lands blob-borne portraits at equal turn, fill-only (v1.170)",function(){
    makeWorld();
    worldState.npcs=[
      {name:"Friz",partyMember:true,portrait:null,charSheet:{name:"Friz",portrait:null}},
      {name:"Morwen",partyMember:true,portrait:null,charSheet:{name:"Morwen",portrait:"LOCAL_EDIT"}},
      {name:"Sheetless",portrait:"HAS_OWN"}
    ];
    var blob={character:{name:"Tess",portrait:"PC_IMG"},npcs:[
      {name:"Friz",charSheet:{portrait:"SERVER_FRIZ"}},
      {name:"Morwen",charSheet:{portrait:"SERVER_MORWEN"}},
      {name:"Sheetless",charSheet:null}
    ]};
    var changed=storageAdapter.fillPortraitsFromBlob(blob);
    if(!changed)return "reported no change";
    if(worldState.npcs[0].charSheet.portrait!=="SERVER_FRIZ")return "missing portrait not filled";
    if(worldState.npcs[1].charSheet.portrait!=="LOCAL_EDIT")return "local image overwritten";
    if(worldState.character.portrait!=="PC_IMG")return "player fill-only missed";
    var again=storageAdapter.fillPortraitsFromBlob(blob);
    return again===false?true:"second pass not a no-op";
  });
  t("fillPortraitsFromBlob never fills the PC portrait from a DIFFERENT character (E79)",function(){
    makeWorld();worldState.character.portrait=null;
    storageAdapter.fillPortraitsFromBlob({character:{name:"SomeoneElse",portrait:"WRONG_FACE"},npcs:[]});
    if(worldState.character.portrait)return "filled the wrong character's portrait: "+worldState.character.portrait;
    storageAdapter.fillPortraitsFromBlob({character:{name:"Tess",portrait:"RIGHT_FACE"},npcs:[]}); // same name DOES fill
    return worldState.character.portrait==="RIGHT_FACE"?true:"same-name fill failed: "+worldState.character.portrait;
  });

  // ── store fallback coherence (audit E5/E6) ───────────────────────────────────
  section("store quota fallback (E5/E6)");
  t("quota-failed set rethrows (so saveCore can toast) AND get serves _m, not stale disk",function(){
    var had=("localStorage" in global),real=had?global.localStorage:undefined;
    var backing={"tnd_test_q":"STALE_DISK"};
    global.localStorage={
      getItem:function(k){return (k in backing)?backing[k]:null;},
      setItem:function(){var e=new Error("quota");e.name="QuotaExceededError";throw e;},
      removeItem:function(k){delete backing[k];}
    };
    var threw=false;
    try{store.set("tnd_test_q","FRESH");}catch(e){threw=true;}
    var got=store.get("tnd_test_q");
    if(had)global.localStorage=real;else delete global.localStorage;
    delete _m["tnd_test_q"];delete _mKeys["tnd_test_q"]; // clean module state
    if(!threw)return "quota set did not rethrow (saveCore's 'storage full' toast stays dead code)";
    return got==="FRESH"?true:"get returned "+JSON.stringify(got)+" — stale disk shadowed the _m fallback";
  });
  t("privacy-mode denial (non-quota) stays silent and round-trips via _m",function(){
    var had=("localStorage" in global),real=had?global.localStorage:undefined;
    global.localStorage={
      getItem:function(){var e=new Error("denied");e.name="SecurityError";throw e;},
      setItem:function(){var e=new Error("denied");e.name="SecurityError";throw e;},
      removeItem:function(){}
    };
    var threw=false;
    try{store.set("tnd_test_p","V");}catch(e){threw=true;}
    var got=store.get("tnd_test_p");
    if(had)global.localStorage=real;else delete global.localStorage;
    delete _m["tnd_test_p"];delete _mKeys["tnd_test_p"];
    if(threw)return "privacy-mode denial should NOT throw (silent fallback intended)";
    return got==="V"?true:"round-trip via _m failed: "+JSON.stringify(got);
  });

  t("loadState: a migrate-triggered save persists the LOADED session log, not the stale global (E36)",function(){
    var savedSL=null,realSave=saveCore;
    saveCore=function(){savedSL=sessionLog.slice();}; // capture what would hit disk during the migrate
    // worldState missing v10 arrays → migrateWorldState returns true → saveCore fires mid-load.
    var wsMissing={ver:10,character:{name:"X",cls:"Warrior",level:3,xp:900,stats:{CON:10}},world:{location:"Y"},turn:1};
    store.set(WSK,JSON.stringify(wsMissing));
    store.set(SLK,JSON.stringify([{role:"user",content:"INCOMING"}]));
    store.del(MEM_KEY);
    sessionLog=[{role:"user",content:"STALE_PREVIOUS"}]; // the outgoing campaign's global, still resident
    loadState();
    saveCore=realSave;store.del(WSK);store.del(SLK);
    if(!savedSL)return "migrate did not trigger saveCore — adjust the test's un-migrated worldState";
    return (savedSL.length===1&&savedSL[0].content==="INCOMING")?true:"saveCore persisted "+JSON.stringify(savedSL)+" — the stale log clobbered SLK";
  });

  t("switchToCampaign rolls back to the current campaign when the target slot is corrupt (E35)",function(){
    makeWorld(); // current campaign "A" (character Tess)
    setActiveCampId("A");worldState.campId="A";
    store.set(WSK,JSON.stringify(worldState));store.set(SLK,JSON.stringify(sessionLog));store.set(MEM_KEY,JSON.stringify(memory));
    store.set("tnd_camp_B_ws","{not valid json");store.set("tnd_camp_B_sl","[]");store.set("tnd_camp_B_mem","{}"); // corrupt target
    var ok=switchToCampaign("B");
    var rolledBack=(ok===false)&&getActiveCampId()==="A"&&worldState&&worldState.character&&worldState.character.name==="Tess";
    store.del("tnd_camp_B_ws");store.del("tnd_camp_B_sl");store.del("tnd_camp_B_mem");
    store.del(WSK);store.del(SLK);store.del(MEM_KEY);setActiveCampId(null);
    return rolledBack?true:"ok="+ok+" active="+getActiveCampId()+" char="+(worldState&&worldState.character?worldState.character.name:"none");
  });

  t("healMemory fills shape defaults on an old/foreign blob (E14 server-adopt path)",function(){
    memory={npcs:{},locations:{}}; // minimal blob missing map/npcGraph/futureEvents/nameIdx/...
    healMemory();
    if(!memory.map||!memory.map.nodes||!memory.map.edges)return "map not healed";
    if(!memory.npcGraph||!memory.npcGraph.factions||!memory.npcGraph.npcFactions||!memory.npcGraph.factionEdges)return "npcGraph not healed";
    if(!Array.isArray(memory.futureEvents)||!Array.isArray(memory.usedNames))return "arrays not healed";
    return typeof memory.nameIdx==="number"?true:"nameIdx not healed";
  });

  // ── Transcript compression (Known issue #3, v1.227) ──────────────────────────
  section("transcript compression (Known issue #3)");
  t("LZ round-trips ascii + unicode/emoji/em-dash exactly",function(){
    var s="Vyrindra — the drow — cast Faerie Fire 🔥 at 120ft. café résumé "+new Array(200).join("repeat ");
    return LZ.decompressFromUTF16(LZ.compressToUTF16(s))===s?true:"LZ round-trip mismatch";
  });
  t("serializeWorldState compresses the transcript to {__lz} and shrinks the blob",function(){
    makeWorld();worldState.transcript=[];for(var i=0;i<200;i++)worldState.transcript.push({t:i,r:i%2?"gm":"pc",x:"The party moves through the ashen ruins, torches guttering, and something watches from the dark. Turn "+i});
    var blob=serializeWorldState(),probe=JSON.parse(blob);
    if(!(probe.transcript&&probe.transcript.__lz))return "transcript not compressed to {__lz}";
    return blob.length<JSON.stringify(worldState).length?true:"compressed blob not smaller than plain";
  });
  t("parseWorldState inflates a compressed transcript back to the exact array",function(){
    makeWorld();worldState.transcript=[{t:1,r:"gm",x:"alpha",e:{n:["Vyra"],l:"Sandpoint"}},{t:2,r:"pc",x:"beta — with an em dash"}];
    var before=JSON.stringify(worldState.transcript),round=parseWorldState(serializeWorldState());
    return JSON.stringify(round.transcript)===before?true:"transcript not preserved: "+JSON.stringify(round.transcript);
  });
  t("parseWorldState is tolerant of a plain-array (uncompressed) blob — server/export/legacy",function(){
    var o=parseWorldState(JSON.stringify({character:{name:"Kael"},transcript:[{t:1,r:"gm",x:"legacy entry"}]}));
    return (o.transcript instanceof Array)&&o.transcript.length===1&&o.transcript[0].x==="legacy entry"?true:"plain-array not passed through";
  });
  t("top-level character stays readable in a compressed blob (picker/preview sites unaffected)",function(){
    makeWorld();worldState.transcript=[{t:1,r:"gm",x:"scene"}];worldState.character.name="Ammut";
    var probe=JSON.parse(serializeWorldState());
    return probe.character&&probe.character.name==="Ammut"?true:"character not readable at top level";
  });

  // ── 7. Usage/cost telemetry (TODO #21) ───────────────────────────────────────
  section("usage telemetry");
  t("anthropic parseUsage maps all four token fields",function(){
    var u=PROVIDERS.anthropic.parseUsage({usage:{input_tokens:1200,output_tokens:340,cache_read_input_tokens:5000,cache_creation_input_tokens:800}});
    return u.in===1200&&u.out===340&&u.cacheRead===5000&&u.cacheWrite===800?true:JSON.stringify(u);
  });
  t("anthropic parseUsage: missing usage → null; missing cache fields → 0",function(){
    if(PROVIDERS.anthropic.parseUsage({content:[]})!==null)return "no-usage should be null";
    var u=PROVIDERS.anthropic.parseUsage({usage:{input_tokens:10,output_tokens:5}});
    return u.cacheRead===0&&u.cacheWrite===0?true:JSON.stringify(u);
  });
  t("openai-compatible parseUsage maps prompt/completion + cached_tokens",function(){
    var u=PROVIDERS.openai.parseUsage({usage:{prompt_tokens:900,completion_tokens:120,prompt_tokens_details:{cached_tokens:600}}});
    return u.in===900&&u.out===120&&u.cacheRead===600&&u.cacheWrite===0?true:JSON.stringify(u);
  });
  t("gemini parseUsage maps usageMetadata",function(){
    var u=PROVIDERS.gemini.parseUsage({usageMetadata:{promptTokenCount:700,candidatesTokenCount:200,cachedContentTokenCount:100}});
    return u.in===700&&u.out===200&&u.cacheRead===100?true:JSON.stringify(u);
  });
  t("recordUsage accumulates totals, calls, and per-kind buckets",function(){
    makeWorld();
    recordUsage({in:1000,out:200,cacheRead:0,cacheWrite:0},"turn","claude-sonnet-4-6");
    recordUsage({in:500,out:100,cacheRead:0,cacheWrite:0},"turn","claude-sonnet-4-6");
    recordUsage({in:300,out:50,cacheRead:0,cacheWrite:0},"actions","claude-sonnet-4-6");
    var t2=worldState.usage;
    if(t2.in!==1800||t2.out!==350||t2.calls!==3)return "totals: "+JSON.stringify(t2);
    if(!t2.byKind.turn||t2.byKind.turn.calls!==2||t2.byKind.turn.in!==1500)return "turn bucket: "+JSON.stringify(t2.byKind.turn);
    return t2.byKind.actions&&t2.byKind.actions.in===300?true:"actions bucket missing";
  });
  t("usageCost prices Sonnet 4.6 correctly incl. cache rates",function(){
    // 1M in @$3 + 1M out @$15 + 1M cacheRead @$0.30 + 1M cacheWrite @$3.75 = $22.05
    var c=usageCost({in:1000000,out:1000000,cacheRead:1000000,cacheWrite:1000000},"claude-sonnet-4-6");
    return Math.abs(c-22.05)<1e-9?true:"got $"+c;
  });
  t("usageCost prefix-matches the dated Haiku ID; unknown model → $0",function(){
    if(usageCost({in:1000000,out:0,cacheRead:0,cacheWrite:0},"claude-haiku-4-5-20251001")!==1)return "haiku prefix match failed";
    return usageCost({in:1000000,out:0,cacheRead:0,cacheWrite:0},"gpt-4o")===0?true:"unknown model priced";
  });
  t("recordUsage survives a null worldState (pre-game utility calls)",function(){
    worldState=null;
    recordUsage({in:100,out:10,cacheRead:0,cacheWrite:0},"other","claude-sonnet-4-6"); // must not throw
    makeWorld();return true;
  });

  // ── 8. Prompt-caching stable/volatile split (TODO #11) ───────────────────────
  section("prompt caching split");
  t("buildSysPrompt returns {stable, volatile} with the right content in each half",function(){
    makeWorld();var s=buildSysPrompt();
    if(typeof s.stable!=="string"||typeof s.volatile!=="string")return "not an object: "+typeof s;
    if(s.stable.indexOf("STATE TAGS")<0||s.stable.indexOf("NARRATIVE RULES")<0)return "stable missing rules/tags";
    if(s.volatile.indexOf("STYLE:")<0||s.volatile.indexOf("CHARACTER: Tess")<0)return "volatile missing style/sheet";
    if(s.stable.indexOf("Tess")>=0)return "player name leaked into stable — cache would key on the character";
    return s.volatile.lastIndexOf("STYLE:")>s.volatile.lastIndexOf("CHARACTER:")?true:"STYLE not at the end";
  });
  t("stable half is byte-identical across per-turn state mutations (the cache invariant)",function(){
    makeWorld();var a=buildSysPrompt().stable;
    worldState.turn++;worldState.character.hp-=3;worldState.character.gold+=17;worldState.character.xp+=50;
    worldState.npcs.push({name:"Newcomer",status:"wary",rel:"stranger"});
    memory.chapters.push({turn:worldState.turn,summary:"Things happened."});
    worldState.world.time="midnight";worldState.combat={name:"Wolf",hp:9,maxHp:9,ac:12,atk:2,dmg:"d6",morale:"low",round:1};
    var b=buildSysPrompt().stable;
    return a===b?true:"stable changed after volatile-state mutations (len "+a.length+" vs "+b.length+")";
  });
  t("stable half clears the Sonnet 4.6 min cacheable prefix (~2048 tokens)",function(){
    makeWorld();var s=buildSysPrompt().stable;
    // chars/4 is a rough floor for token count; below 8500 chars the block risks silently not caching
    return s.length>=8500?true:"stable only "+s.length+" chars (~"+Math.round(s.length/4)+" tok) — under the 2048-token cache minimum";
  });
  t("anthropic buildBody: object sys → two system blocks, breakpoint on the stable one",function(){
    var b=PROVIDERS.anthropic.buildBody([{role:"user",content:"hi"}],{stable:"S",volatile:"V"},100,"claude-sonnet-4-6");
    if(!Array.isArray(b.system)||b.system.length!==2)return "system: "+JSON.stringify(b.system);
    if(b.system[0].text!=="S"||!b.system[0].cache_control||b.system[0].cache_control.type!=="ephemeral")return "stable block wrong";
    return b.system[1].text==="V"&&!b.system[1].cache_control?true:"volatile block wrong";
  });
  t("anthropic buildBody: string sys (sysOverride) stays a plain system string",function(){
    var b=PROVIDERS.anthropic.buildBody([],"plain override",100,"m");
    return b.system==="plain override"?true:JSON.stringify(b.system);
  });
  t("openai-compatible + gemini flatten {stable, volatile} via sysJoin",function(){
    if(sysJoin("x")!=="x")return "string passthrough broken";
    var o=PROVIDERS.openai.buildBody([{role:"user",content:"hi"}],{stable:"S",volatile:"V"},100,"gpt-4o");
    if(o.messages[0].role!=="system"||o.messages[0].content!=="SV")return "openai: "+JSON.stringify(o.messages[0]);
    var g=PROVIDERS.gemini.buildBody([{role:"user",content:"hi"}],{stable:"S",volatile:"V"},100,"gemini-3.5-flash");
    return g.systemInstruction.parts[0].text==="SV"?true:"gemini: "+JSON.stringify(g.systemInstruction);
  });

  // ── 9. Storage adapter sync health (TODO #24) ────────────────────────────────
  section("sync health");
  t("syncStatus: safe defaults when not connected to a server",function(){
    var st=storageAdapter.syncStatus();
    if(st.serverMode!==false&&st.serverMode!==true)return "serverMode not boolean";
    if(typeof st.unsynced!=="number"||typeof st.failCount!=="number")return "counters not numeric";
    return (!st.serverMode&&st.unsynced===0)?true:"local mode should report 0 unsynced (got "+st.unsynced+", serverMode "+st.serverMode+")";
  });
  t("adapter exposes the #24 surface (syncStatus + syncNow + syncToServer)",function(){
    return (typeof storageAdapter.syncStatus==="function"&&typeof storageAdapter.syncNow==="function"&&typeof storageAdapter.syncToServer==="function")?true:"missing API";
  });

  // ── 11. Blueprint normalizer + export (Blueprint Designer §5.1/D1/§5.5) ──────
  section("blueprint normalizer");
  t("normalizeToneId: valid ids pass through untouched",function(){
    return normalizeToneId("swords")==="swords"&&normalizeToneId("horror")==="horror"?true:"valid id mangled";
  });
  t("normalizeToneId: repairs legacy variants",function(){
    var w=[["high_fantasy","high"],["High Fantasy","high"],["dark","horror"],["dark_horror","horror"],["political intrigue","politic"],["utter garbage",""],["",""]];
    for(var i=0;i<w.length;i++){var got=normalizeToneId(w[i][0]);if(got!==w[i][1])return JSON.stringify(w[i][0])+" → "+JSON.stringify(got)+" want "+JSON.stringify(w[i][1]);}
    return true;
  });
  t("normalizeBlueprint: upgrades legacy format, fills author/tone/collections",function(){
    var bp=normalizeBlueprint({format:"tnd-campaign-v1",name:"Legacy",tone:"high_fantasy",premise:"p",acts:[{title:"A",goal:"g",arcs:[{title:"a",objective:"o"}]}]});
    if(bp.format!=="tnd-blueprint-v1")return "format: "+bp.format;
    if(bp.author!=="")return "author not defaulted";
    if(bp.tone!=="high")return "tone: "+bp.tone;
    if(!Array.isArray(bp.npcs)||!Array.isArray(bp.locations)||!Array.isArray(bp.rules))return "collections not defaulted";
    return validateBlueprint(bp)===null?true:"normalized blueprint fails validate: "+validateBlueprint(bp);
  });
  t("normalizeBlueprint: canonical-but-sparse (planescape shape) gains tone/author as empty",function(){
    var bp=normalizeBlueprint({format:"tnd-blueprint-v1",name:"P",premise:"p",acts:[{title:"A",goal:"g",arcs:[{title:"a",objective:"o"}]}]});
    return bp.tone===""&&bp.author===""&&bp.proseAuthor===""?true:JSON.stringify({tone:bp.tone,author:bp.author});
  });
  t("normalizeBlueprint is idempotent",function(){
    var a=normalizeBlueprint({format:"tnd-campaign-v1",name:"X",tone:"high_fantasy",premise:"p"});
    var one=JSON.stringify(a);
    return JSON.stringify(normalizeBlueprint(a))===one?true:"second pass changed output";
  });
  t("buildBlueprintFromGame: emits canonical format + author + reverse-mapped tone (D1)",function(){
    makeWorld();worldState.tone={name:"Sword and Sorcery",voice:"x"};
    worldState.skeleton={premise:"pr",acts:[{title:"A",goal:"g",status:"active",arcs:[{title:"a",objective:"o",status:"active",dnaHint:"hint!"}]}]};
    var bp=buildBlueprintFromGame();
    if(bp.format!=="tnd-blueprint-v1")return "format: "+bp.format;
    if(bp.author!=="")return "author missing";
    if(bp.tone!=="swords")return "tone: "+JSON.stringify(bp.tone);
    if(bp.acts[0].status!=="pending"||bp.acts[0].arcs[0].status!=="pending")return "statuses not reset";
    return bp.acts[0].arcs[0].dnaHint==="hint!"?true:"dnaHint dropped in export";
  });
  t("buildBlueprintFromGame: NPC notes carry the full knowledge list (§5.5)",function(){
    makeWorld();worldState.tone={name:"High Fantasy",voice:""};
    worldState.npcs=[{name:"Ameiko",status:"ally",rel:"ally",pronouns:"she/her"}];
    memory.npcs["Ameiko"]={attitude:"ally",knowledge:["Owns the Rusty Dragon","Estranged from her father","Half-sister to Tsuto"],events:[],aliases:[]};
    var bp=buildBlueprintFromGame();
    var notes=bp.npcs[0].notes;
    if(notes.indexOf("Rusty Dragon")<0)return "first fact missing";
    return notes.indexOf("Half-sister to Tsuto")>=0?true:"later knowledge still dropped: "+notes;
  });
  t("creatures (v1.176): normalize defaults, validate names, apply seeds worldState.bestiary",function(){
    var bp=normalizeBlueprint({format:"tnd-blueprint-v1",name:"C",premise:"p",acts:[{title:"A",goal:"g",arcs:[{title:"a",objective:"o"}]}]});
    if(!Array.isArray(bp.creatures))return "creatures not defaulted";
    bp.creatures=[{name:"",kind:"undead",threat:"deadly",notes:"x"}];
    if(validateBlueprint(bp)===null)return "nameless creature passed validation";
    bp.creatures=[{name:"Chasm Spawn",kind:"aberration",threat:"deadly",notes:"hunts by soul-scent; hollow where muscle should be"}];
    if(validateBlueprint(bp)!==null)return "valid creature rejected: "+validateBlueprint(bp);
    makeWorld();
    applyBlueprint(bp);
    if(!worldState.bestiary||worldState.bestiary[0].name!=="Chasm Spawn")return "bestiary not seeded";
    return true;
  });
  t("bestiary renders in the STABLE prompt half, byte-identical across builds",function(){
    makeWorld();
    worldState.bestiary=[{name:"Chasm Spawn",kind:"aberration",threat:"deadly",notes:"hunts by soul-scent"}];
    var s1=buildSysPrompt(),s2=buildSysPrompt();
    if(s1.stable.indexOf("BESTIARY")<0)return "bestiary missing from stable";
    if(s1.stable.indexOf("Chasm Spawn (aberration, threat: deadly)")<0)return "creature line malformed";
    if(s1.stable!==s2.stable)return "stable no longer byte-identical with a bestiary";
    if(s1.volatile.indexOf("BESTIARY")>=0)return "bestiary leaked into volatile";
    delete worldState.bestiary;
    return buildSysPrompt().stable.indexOf("BESTIARY")<0?true:"bestiary block present without creatures";
  });
  t("arc reward (v1.176): rendered on the ACTIVE arc with the grant-on-complete instruction",function(){
    makeWorld();
    worldState.skeleton={premise:"p",acts:[{title:"A",goal:"g",turningPoint:"tp",status:"active",arcs:[
      {title:"First",objective:"o1",status:"active",reward:"the Bone Key — opens the crypt in Act 2"},
      {title:"Second",objective:"o2",status:"pending",reward:"a pile of gold"}
    ]}]};
    var b=buildSkeletonBlock();
    if(b.indexOf("ARC REWARD")<0)return "reward instruction missing";
    if(b.indexOf("the Bone Key")<0)return "active arc's reward text missing";
    if(b.indexOf("a pile of gold")>=0)return "pending arc's reward leaked (spoiler-budget: active only)";
    return b.indexOf("[ARC_COMPLETE:First]")>=0?true:"grant not tied to the completing emission";
  });
  t("act reward (v1.178): rendered on the ACTIVE act, tied to [ACT_COMPLETE:], pending acts stay unspoiled",function(){
    makeWorld();
    worldState.skeleton={premise:"p",acts:[
      {title:"First Act",goal:"g",turningPoint:"tp",status:"active",reward:"a deed to the Rusty Flagon",arcs:[{title:"a",objective:"o",status:"active"}]},
      {title:"Second Act",goal:"g2",turningPoint:"tp2",status:"pending",reward:"a duchy",arcs:[{title:"b",objective:"o2",status:"pending"}]}
    ]};
    var b=buildSkeletonBlock();
    if(b.indexOf("ACT REWARD")<0)return "act reward instruction missing";
    if(b.indexOf("deed to the Rusty Flagon")<0)return "active act's reward text missing";
    if(b.indexOf("[ACT_COMPLETE:First Act]")<0)return "grant not tied to the completing emission";
    return b.indexOf("a duchy")<0?true:"pending act's reward leaked";
  });
  t("F3: all-arcs-complete active act gets the [ACT_COMPLETE:] close nudge",function(){
    makeWorld();
    worldState.skeleton={premise:"p",acts:[
      {title:"Port of Last Hope",goal:"g",turningPoint:"tp",status:"active",arcs:[
        {title:"a1",objective:"o",status:"completed"},{title:"a2",objective:"o",status:"completed"}
      ]},
      {title:"Next Act",goal:"g2",turningPoint:"tp2",status:"pending",arcs:[{title:"b",objective:"o2",status:"pending"}]}
    ]};
    var b=buildSkeletonBlock();
    if(b.indexOf("ALL ARCS COMPLETE")<0)return "close-the-act nudge missing";
    return b.indexOf("[ACT_COMPLETE:Port of Last Hope]")>=0?true:"nudge did not name the [ACT_COMPLETE:] emission";
  });
  t("F3: nudge is ABSENT while any arc of the active act is still open",function(){
    makeWorld();
    worldState.skeleton={premise:"p",acts:[{title:"A",goal:"g",turningPoint:"tp",status:"active",arcs:[
      {title:"a1",objective:"o",status:"completed"},{title:"a2",objective:"o",status:"active"}
    ]}]};
    return buildSkeletonBlock().indexOf("ALL ARCS COMPLETE")<0?true:"nudge fired with an arc still active";
  });
  section("arc steering — blueprint fidelity + act pacing (#23/#43, v1.231)");
  t("blueprint-fidelity line appears ONLY when worldState.blueprintName is set",function(){
    makeWorld();
    worldState.skeleton={premise:"p",acts:[{title:"A",goal:"g",turningPoint:"tp",status:"active",arcs:[{title:"a",objective:"o",status:"active"}]}]};
    if(buildSkeletonBlock().indexOf("AUTHORED CAMPAIGN")>=0)return "authored line leaked into a non-blueprint campaign";
    worldState.blueprintName="Rise of the Runelords";
    var b=buildSkeletonBlock();
    return b.indexOf("AUTHORED CAMPAIGN")>=0&&b.indexOf("Rise of the Runelords")>=0&&b.indexOf("COLOR those beats")>=0?true:"authored-campaign fidelity line missing/incomplete";
  });
  t("act pacing nudge fires only once the active act exceeds ACT_TURN_BUDGET (+ carries the anti-over-rail guard)",function(){
    makeWorld();
    worldState.skeleton={premise:"p",acts:[{title:"The Long Act",goal:"g",turningPoint:"tp",status:"active",arcs:[{title:"a",objective:"o",status:"active"}]}]};
    worldState.actStartTurn=0;worldState.turn=5;
    if(buildSkeletonBlock().indexOf("soft target")>=0)return "pacing nudge fired early (act only 5 turns in)";
    worldState.turn=ACT_TURN_BUDGET+50;
    var b=buildSkeletonBlock();
    if(b.indexOf("has run "+(ACT_TURN_BUDGET+50)+" turns")<0)return "pacing nudge missing when over budget";
    return /do NOT skip an active crisis/i.test(b)?true:"anti-over-rail guard missing from pacing nudge";
  });
  t("pacing measures from actStartTurn, not turn 0 — a young act deep in the campaign is NOT over budget",function(){
    makeWorld();
    worldState.skeleton={premise:"p",acts:[{title:"Act Two",goal:"g",turningPoint:"tp",status:"active",arcs:[{title:"a",objective:"o",status:"active"}]}]};
    worldState.turn=ACT_TURN_BUDGET+120;worldState.actStartTurn=ACT_TURN_BUDGET+100; // this act only 20 turns old
    return buildSkeletonBlock().indexOf("soft target")<0?true:"nudge fired on a young act (measured from turn 0, not actStartTurn)";
  });
  t("[ACT_COMPLETE:] resets actStartTurn to the current turn (the new act's pacing clock)",function(){
    makeWorld();worldState.turn=137;
    worldState.skeleton={premise:"p",acts:[
      {title:"A1",goal:"g",turningPoint:"tp",status:"active",arcs:[{title:"a",objective:"o",status:"completed"}]},
      {title:"A2",goal:"g2",turningPoint:"tp2",status:"pending",arcs:[{title:"b",objective:"o2",status:"pending"}]}
    ]};
    applyMuts("[ACT_COMPLETE:A1]");
    return worldState.skeleton.acts[1].status==="active"&&worldState.actStartTurn===137?true:"actStartTurn not reset on act advance (got "+worldState.actStartTurn+")";
  });
  t("blueprint review/CBB section is INVISIBLE to the engine but persists in the file (#39)",function(){
    makeWorld();
    var bp=normalizeBlueprint({format:"tnd-blueprint-v1",name:"R",premise:"p",tone:"swords",
      acts:[{title:"A",goal:"g",turningPoint:"tp",arcs:[{title:"a",objective:"o"}]}],
      review:{verdict:"CANARY-VERDICT",findings:[{sev:"HIGH",section:"npcs",issue:"CANARY-ISSUE",fix:"CANARY-FIX",status:""}]}});
    if(validateBlueprint(bp)!==null)return "review broke validation: "+validateBlueprint(bp);
    applyBlueprint(bp);
    var s=buildSysPrompt();
    if((s.stable+s.volatile).indexOf("CANARY")>=0)return "review leaked into the prompt";
    if(buildSkeletonBlock().indexOf("CANARY")>=0)return "review leaked into the skeleton block";
    return JSON.stringify(normalizeBlueprint(bp)).indexOf("CANARY-VERDICT")>=0?true:"normalize stripped the review (must persist as the CBB trail)";
  });
  t("buildBlueprintFromGame round-trips the bestiary",function(){
    makeWorld();worldState.tone={name:"High Fantasy",voice:""};
    worldState.bestiary=[{name:"King of Feathers",kind:"beast",threat:"apex",notes:"tyrannosaurus; swallows foes whole"}];
    var bp=buildBlueprintFromGame();
    return bp.creatures&&bp.creatures.length===1&&bp.creatures[0].name==="King of Feathers"?true:"creatures not exported";
  });

  // ── 9b. Blueprint import hygiene (audit P7/P8/P9) ────────────────────────────
  section("blueprint import hygiene (P7/P8/P9)");
  t("P7: blueprint location text is single-homed on the map node",function(){
    makeWorld();
    applyBlueprint(normalizeBlueprint({format:"tnd-blueprint-v1",name:"T",premise:"p",acts:[],
      locations:[{name:"Omu",description:"A ruined city swallowed by jungle."}]}));
    if(!memory.map.nodes["Omu"]||memory.map.nodes["Omu"].description!=="A ruined city swallowed by jungle.")return "map node description missing";
    if(!memory.locations["Omu"])return "locations metadata entry missing";
    return memory.locations["Omu"].notes.length===0?true:"description duplicated into locations notes: "+JSON.stringify(memory.locations["Omu"].notes);
  });
  t("P7: healMemory drops a pre-fix duplicated location note, keeps real event notes",function(){
    makeWorld();
    memory.locations["Omu"]={visited:[],notes:["A ruined city swallowed by jungle.","the party burned the east gate"]};
    memory.map.nodes["Omu"]={firstVisit:null,visits:0,description:"A ruined city swallowed by jungle.",parent:null,npcs:[],items:[]};
    healMemory();
    var notes=memory.locations["Omu"].notes;
    return notes.length===1&&notes[0]==="the party burned the east gate"?true:"notes after heal: "+JSON.stringify(notes);
  });
  t("P8: NPC bio with a STATISTICS block splits — narrative stays, mechanics go to bestiary",function(){
    makeWorld();
    var bio="Azaka is a weretiger guide who wants her mask back. She distrusts outsiders but honors debts.\nHUMAN FORM STATISTICS: AC 14 (leather armour), 52 HP. Actions: Shortbow (attack +5, 1d6+3 piercing).";
    applyBlueprint(normalizeBlueprint({format:"tnd-blueprint-v1",name:"T",premise:"p",acts:[],
      npcs:[{name:"Azaka",role:"ally",notes:bio}]}));
    var k=memory.npcs["Azaka"].knowledge[0];
    if(k.indexOf("STATISTICS")>=0)return "stat block left in knowledge";
    if(k.indexOf("wants her mask back")<0)return "narrative mangled: "+k;
    var b=(worldState.bestiary||[]).filter(function(x){return x.name==="Azaka";})[0];
    if(!b)return "no bestiary entry created";
    return b.notes.indexOf("AC 14")>=0&&b.notes.indexOf("Shortbow")>=0?true:"mechanics missing from bestiary: "+b.notes;
  });
  t("P8: bare AC/HP line (no STATISTICS header) also splits",function(){
    makeWorld();
    var bio="A river pirate captain feared along the Soshenstar; she keeps her crew loyal with shares and fear.\nAC 12, 33 HP. Actions: Scimitar +4, 1d6+2 slashing.";
    applyBlueprint(normalizeBlueprint({format:"tnd-blueprint-v1",name:"T",premise:"p",acts:[],
      npcs:[{name:"Zara",role:"enemy",notes:bio}]}));
    var k=memory.npcs["Zara"].knowledge[0];
    if(k.indexOf("AC 12")>=0)return "stat line left in knowledge: "+k;
    var b=(worldState.bestiary||[]).filter(function(x){return x.name==="Zara";})[0];
    return b&&b.notes.indexOf("AC 12")>=0?true:"mechanics not moved to bestiary";
  });
  t("P8: ambiguous bio is left intact (no markers / marker without narrative lead-in)",function(){
    makeWorld();
    var plain="A grizzled captain of the harbour guard. Statistics bore him; he trusts his gut and his axe.";
    var allStats="STATISTICS: AC 12, 9 HP. Actions: club +2.";
    applyBlueprint(normalizeBlueprint({format:"tnd-blueprint-v1",name:"T",premise:"p",acts:[],
      npcs:[{name:"Captain",role:"neutral",notes:plain},{name:"Guard",role:"neutral",notes:allStats}]}));
    if(memory.npcs["Captain"].knowledge[0]!==plain)return "prose bio was mangled: "+memory.npcs["Captain"].knowledge[0];
    if(memory.npcs["Guard"].knowledge[0]!==allStats)return "all-stats bio (no lead-in) was split: "+memory.npcs["Guard"].knowledge[0];
    return (worldState.bestiary||[]).length===0?true:"bestiary entry created from an ambiguous bio";
  });
  t("P8: author-provided bestiary entry wins — same-name NPC bio stays whole",function(){
    makeWorld();
    var bio="Azaka is a weretiger guide who wants her mask back and hates the yuan-ti with a cold patience.\nHUMAN FORM STATISTICS: AC 14, 52 HP.";
    applyBlueprint(normalizeBlueprint({format:"tnd-blueprint-v1",name:"T",premise:"p",acts:[],
      npcs:[{name:"Azaka",role:"ally",notes:bio}],
      creatures:[{name:"Azaka",kind:"weretiger",threat:"deadly",notes:"canonical entry"}]}));
    if(worldState.bestiary.length!==1)return "duplicate bestiary entry: "+worldState.bestiary.length;
    if(worldState.bestiary[0].notes!=="canonical entry")return "author entry overwritten";
    return memory.npcs["Azaka"].knowledge[0]===bio?true:"bio split despite existing bestiary entry (stats would be lost)";
  });
  t("P8: memoryNpcDetail caps injected knowledge at ~2000 chars with a marker",function(){
    makeWorld();
    var huge=new Array(200).join("A very long remembered fact about this NPC. ");// ~8.7KB
    memory.npcs["Verbose"]={attitude:"ally",knowledge:[huge],events:[],aliases:[]};
    var d=memoryNpcDetail("Verbose");
    if(d.length>2300)return "detail not capped: "+d.length+" chars";
    if(d.indexOf("…[truncated]")<0)return "truncation marker missing";
    memory.npcs["Terse"]={attitude:"ally",knowledge:["knows the tides"],events:[],aliases:[]};
    return memoryNpcDetail("Terse").indexOf("…[truncated]")<0?true:"short knowledge got a truncation marker";
  });
  t("P9: unvisited blueprint locations render as KNOWN OF, visited + legacy stay VISITED",function(){
    makeWorld();
    applyBlueprint(normalizeBlueprint({format:"tnd-blueprint-v1",name:"T",premise:"p",acts:[],
      locations:[{name:"Port Nyanzaru",description:"harbour city"},{name:"Omu",description:"ruined city"}]}));
    applyMuts("[LOCATION:Port Nyanzaru]"); // actually travel there → node.visits 1
    memory.locations["Legacy Town"]={visited:[3],notes:[]}; // pre-map save shape: no map node
    var toc=memoryTOC(),tl=toc.split("\n"),visLine="",knownLine="",i;
    for(i=0;i<tl.length;i++){if(tl[i].indexOf("VISITED: ")===0)visLine=tl[i];if(tl[i].indexOf("KNOWN OF (not yet visited): ")===0)knownLine=tl[i];}
    if(!visLine)return "VISITED line missing";
    if(visLine.indexOf("Port Nyanzaru")<0)return "actually-visited location not under VISITED: "+visLine;
    if(visLine.indexOf("Legacy Town")<0)return "legacy no-node location dropped from VISITED: "+visLine;
    if(visLine.indexOf("Omu")>=0)return "unvisited blueprint location still lies under VISITED: "+visLine;
    return knownLine.indexOf("Omu")>=0?true:"unvisited location missing from KNOWN OF: "+knownLine;
  });

  // ── 10. RAG episodic memory (#27 Phase 1 — RAG_MEMORY.md) ────────────────────
  section("RAG episodic memory");
  t("RAG defaults ON when the flag is unset (v1.230) — every existing save + new campaign, no migration",function(){
    makeWorld();delete worldState.ragMemory; // simulate a save that never touched the flag
    if(!ragEnabled())return "unset flag should read ON";
    worldState.ragMemory=false; if(ragEnabled())return "explicit false should disable";
    worldState.ragMemory=true;  if(!ragEnabled())return "explicit true should enable";
    return true;
  });
  t("logTranscript indexes GM entries at write time (tags + location + quest)",function(){
    makeWorld();
    logTranscript("player","I greet the stranger");
    logTranscript("gm","Bram nods.","Bram nods. [NPC:Bram|wary|ally][QUEST:The Toll|offered|pay up]");
    var en=worldState.transcript[1];
    if(!en.e)return "no index on gm entry";
    if(worldState.transcript[0].e)return "player entry got an index";
    if(en.e.n.indexOf("Bram")<0)return "npc missing: "+JSON.stringify(en.e.n);
    if(en.e.l!=="Ashfen")return "location: "+en.e.l;
    return en.e.q[0]==="The Toll"?true:"quest: "+JSON.stringify(en.e.q);
  });
  t("flag off → ragRetrieve returns the empty string",function(){
    makeWorld();worldState.turn=40;
    worldState.transcript=[{t:2,r:"player",x:"hi"},{t:3,r:"gm",x:"Bram waves.",e:{n:["Bram"],l:"Ashfen",q:[]}},{t:4,r:"gm",x:"a"},{t:5,r:"gm",x:"b"},{t:6,r:"gm",x:"c"},{t:7,r:"gm",x:"d"}];
    return ragRetrieve("I ask Bram")===""?true:"retrieved with flag off";
  });
  t("retrieval finds an old scene by NPC, skips the sessionLog-covered window, frames + budgets",function(){
    makeWorld();worldState.turn=40;memory.npcs["Bram"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    // sessionLog 16 entries (~8 turns) → skip window covers t32+ — t36-39 must not serve.
    sessionLog=[];for(var si=0;si<16;si++)sessionLog.push({role:si%2?"assistant":"user",content:"x"});
    worldState.transcript=[
      {t:2,r:"player",x:"I ask Bram about the toll"},
      {t:3,r:"gm",x:"Bram promises you safe passage for a year and a day.",e:{n:["Bram"],l:"Greyford",q:[]}},
      {t:36,r:"player",x:"I wave at Bram"},
      {t:37,r:"gm",x:"Bram waves back cheerfully from the recent past.",e:{n:["Bram"],l:"Ashfen",q:[]}},
      {t:38,r:"gm",x:"filler",e:{n:[],l:"Ashfen",q:[]}},
      {t:39,r:"gm",x:"filler2",e:{n:[],l:"Ashfen",q:[]}}
    ];
    worldState.ragMemory=true;
    var b=ragRetrieve("I ask Bram to honor his promise");
    worldState.ragMemory=false;sessionLog=[];
    if(b.indexOf("safe passage")<0)return "old scene not retrieved: "+b.slice(0,120);
    if(b.indexOf("recent past")>=0)return "sessionLog-covered entry leaked in";
    if(b.indexOf("override")<0)return "subordination framing missing";
    if(b.indexOf("Player: I ask Bram about the toll")<0)return "player half of the turn pair missing";
    return b.length<3200?true:"over budget: "+b.length;
  });
  t("dead zone closed: shallow sessionLog exposes 4-turn-old scenes (t165 Frizwick failure)",function(){
    makeWorld();worldState.turn=40;memory.npcs["Frizwick"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    sessionLog=[{role:"user",content:"x"},{role:"assistant",content:"y"}]; // ~1 turn of live context
    worldState.transcript=[
      {t:2,r:"player",x:"hello"},
      {t:3,r:"gm",x:"An uneventful morning.",e:{n:[],l:"Ashfen",q:[]}},
      {t:35,r:"player",x:"Frizwick, why are you outside?"},
      {t:36,r:"gm",x:"Perimeter check, Frizwick says flat. Road is too quiet.",e:{n:["Frizwick"],l:"Glassworks",q:[]}},
      {t:39,r:"gm",x:"You walk west.",e:{n:[],l:"Coast",q:[]}},
      {t:39,r:"gm",x:"The cottage is cold.",e:{n:[],l:"Coast",q:[]}}
    ];
    worldState.ragMemory=true;
    var b=ragRetrieve("GM: why was Frizwick outside?");
    worldState.ragMemory=false;sessionLog=[];
    return b.indexOf("Perimeter check")>=0?true:"4-turn-old scene still in the dead zone: "+b.slice(0,140);
  });
  t("lazy backfill indexes pre-Phase-1 entries by known-NPC name scan",function(){
    makeWorld();worldState.turn=40;memory.npcs["Veyra"]={attitude:"ally",knowledge:[],events:[],aliases:["The Grey Blade"]};
    worldState.transcript=[
      {t:4,r:"player",x:"I confront the mercenary"},
      {t:5,r:"gm",x:"Veyra swears she will repay the debt before midwinter."},
      {t:6,r:"gm",x:"nothing here"},{t:7,r:"gm",x:"nothing"},{t:8,r:"gm",x:"still nothing"},{t:9,r:"gm",x:"quiet"}
    ];
    worldState.ragMemory=true;
    var b=ragRetrieve("I remind Veyra of her debt");
    worldState.ragMemory=false;
    if(!worldState.transcript[1].e||worldState.transcript[1].e.n.indexOf("Veyra")<0)return "backfill missing: "+JSON.stringify(worldState.transcript[1].e);
    return b.indexOf("repay the debt")>=0?true:"not retrieved: "+b.slice(0,120);
  });
  t("lexical boost routes a quiz to the topically-matching scene (t162 pin failure)",function(){
    makeWorld();worldState.turn=40;memory.npcs["Daeris"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    worldState.npcs=[{name:"Morwen",status:"ally",rel:"c",partyMember:true},{name:"Daeris",status:"ally",rel:"c",partyMember:true}];
    // Same entities in every entry (the party problem) — only the words differ.
    worldState.transcript=[
      {t:10,r:"player",x:"Grab the clasp pin with mage hand"},
      {t:11,r:"gm",x:"The clasp pin rises off the altar and lands in your palm. Morwen watches. Daeris is below.",e:{n:["Morwen","Daeris"],l:"Glassworks",q:[]}},
      {t:13,r:"gm",x:"Morwen and Daeris follow you through the dark passage.",e:{n:["Morwen","Daeris"],l:"Glassworks",q:[]}},
      {t:16,r:"gm",x:"Daeris sleeps. Morwen keeps watch by the fire.",e:{n:["Morwen","Daeris"],l:"Coast",q:[]}},
      {t:19,r:"gm",x:"Morwen argues with Daeris about the road ahead.",e:{n:["Morwen","Daeris"],l:"Coast",q:[]}},
      {t:22,r:"gm",x:"filler with the same faces. Morwen. Daeris.",e:{n:["Morwen","Daeris"],l:"Coast",q:[]}}
    ];
    worldState.ragMemory=true;
    var b=ragRetrieve("GM: where did I get Daeris' clasp pin?");
    worldState.ragMemory=false;
    if(b.indexOf("rises off the altar")<0)return "topical scene not retrieved: "+b.slice(0,200);
    return b.indexOf("[Turn 11")>=0?true:"wrong turn stamp";
  });
  t("party members are weak signal; input-named outsiders win",function(){
    makeWorld();worldState.turn=40;
    memory.npcs["Bram"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    worldState.npcs=[{name:"Morwen",status:"ally",rel:"c",partyMember:true}];
    worldState.transcript=[
      {t:5,r:"player",x:"talk to the stranger"},
      {t:6,r:"gm",x:"Bram tells you about the toll road and the debt owed.",e:{n:["Bram"],l:"Greyford",q:[]}},
      {t:20,r:"gm",x:"Morwen sharpens her blade in silence.",e:{n:["Morwen"],l:"Coast",q:[]}},
      {t:24,r:"gm",x:"Morwen cooks. Nothing happens.",e:{n:["Morwen"],l:"Coast",q:[]}},
      {t:28,r:"gm",x:"Morwen hums an old tune.",e:{n:["Morwen"],l:"Coast",q:[]}},
      {t:29,r:"gm",x:"The fire burns low.",e:{n:[],l:"Coast",q:[]}}
    ];
    worldState.ragMemory=true;
    var b=ragRetrieve("GM: what did Bram say about the toll?");
    worldState.ragMemory=false;
    return b.indexOf("toll road")>=0?true:"input-named outsider lost to party filler: "+b.slice(0,160);
  });
  t("near-par adjacent turns both survive the proximity dedupe (Q&A spans turns)",function(){
    makeWorld();worldState.turn=40;memory.npcs["Hemlock"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    worldState.transcript=[
      {t:10,r:"player",x:"Ask Hemlock about the broadsheet"},
      {t:11,r:"gm",x:"Hemlock explains the broadsheet slowly.",e:{n:["Hemlock"],l:"Sandpoint",q:[]}},
      {t:12,r:"player",x:"Ask for the broadsheet itself"},
      {t:12,r:"gm",x:"Hemlock hands over the broadsheet. Kept it because it seemed mad, he says.",e:{n:["Hemlock"],l:"Sandpoint",q:[]}},
      {t:20,r:"gm",x:"quiet filler",e:{n:[],l:"Coast",q:[]}},
      {t:24,r:"gm",x:"more filler",e:{n:[],l:"Coast",q:[]}}
    ];
    worldState.ragMemory=true;
    var b=ragRetrieve("GM: why did Hemlock keep the broadsheet?");
    worldState.ragMemory=false;
    if(b.indexOf("explains the broadsheet")<0)return "first half missing: "+b.slice(0,160);
    return b.indexOf("seemed mad")>=0?true:"adjacent near-par half excluded again";
  });
  t("duplicate NPC keys collapse to one scan identity (no dupe score inflation)",function(){
    makeWorld();
    memory.npcs["Hemlock"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    memory.npcs["Sheriff Hemlock"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    memory.npcs["Sheriff Belor Hemlock"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    var names=ragKnownNames();
    var hem=names.filter(function(n){return n.toks.indexOf("hemlock")>=0;});
    if(hem.length!==1)return "expected 1 hemlock identity, got "+hem.length;
    return hem[0].others.length===2?true:"others: "+JSON.stringify(hem[0].others);
  });
  t("meta exchanges ('GM:'-prefixed player turns) are excluded from retrieval (quiz-echo displacement)",function(){
    makeWorld();worldState.turn=40;memory.npcs["Hemlock"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    worldState.transcript=[
      {t:5,r:"player",x:"Ask Hemlock about the broadsheet"},
      {t:6,r:"gm",x:"Hemlock kept the broadsheet because it seemed mad. The origin scene.",e:{n:["Hemlock"],l:"Sandpoint",q:[]}},
      {t:20,r:"player",x:"GM: why did Hemlock keep the broadsheet?"},
      {t:21,r:"gm",x:"Hemlock kept the broadsheet because of the mechanisms, a confabulated echo.",e:{n:["Hemlock"],l:"Sandpoint",q:[]}},
      {t:30,r:"gm",x:"filler",e:{n:[],l:"Coast",q:[]}},
      {t:31,r:"gm",x:"filler2",e:{n:[],l:"Coast",q:[]}}
    ];
    worldState.ragMemory=true;
    var b=ragRetrieve("GM: why did Hemlock keep the broadsheet?");
    worldState.ragMemory=false;
    if(b.indexOf("confabulated echo")>=0)return "quiz echo served";
    return b.indexOf("origin scene")>=0?true:"origin scene not served: "+b.slice(0,160);
  });
  t("[RETCON:] marks the correcting entry AND the preceding GM entry; both excluded from retrieval",function(){
    makeWorld();worldState.turn=40;memory.npcs["Daeris"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    logTranscript("player","I climb down to the platform");
    logTranscript("gm","You pull the iron pin from the singing platform. Daeris gasps. The true scene.","You pull the iron pin from the singing platform. Daeris gasps. The true scene. [NPC:Daeris|shaken|ally]");
    logTranscript("player","that's wrong, I used mage hand");
    logTranscript("gm","You are right. You grabbed Daeris' pin with mage hand from the chain. A false correction.","You are right. You grabbed Daeris' pin with mage hand from the chain. A false correction. [RETCON:pin retrieval corrected]");
    var tr=worldState.transcript;
    if(!tr[3].rc)return "correcting entry not marked";
    if(!tr[1].rc)return "preceding GM entry not marked";
    // Both marked entries must be invisible to retrieval; pad with servable filler.
    tr[0].t=5;tr[1].t=6;tr[2].t=8;tr[3].t=8;
    worldState.transcript=tr.concat([
      {t:10,r:"player",x:"Ask Daeris about the pin"},
      {t:11,r:"gm",x:"Daeris turns the iron pin over. Her anchor, she says.",e:{n:["Daeris"],l:"Ashfen",q:[]}},
      {t:30,r:"gm",x:"filler",e:{n:[],l:"Coast",q:[]}},{t:31,r:"gm",x:"filler2",e:{n:[],l:"Coast",q:[]}}
    ]);
    worldState.ragMemory=true;
    var b=ragRetrieve("where did Daeris' iron pin come from?");
    worldState.ragMemory=false;
    if(b.indexOf("false correction")>=0)return "retconned correction served";
    if(b.indexOf("true scene")>=0)return "superseded predecessor served (marked rc)";
    return b.indexOf("Her anchor")>=0?true:"clean scene not served: "+b.slice(0,160);
  });
  t("write-time index names orphaned by a later NPC_MERGE still score (alias bridge)",function(){
    makeWorld();worldState.turn=40;
    // Post-merge state: only the canonical key exists, the old short key rides as an alias —
    // but this entry was indexed BEFORE the merge, under the deleted key.
    memory.npcs["Sheriff Belor Hemlock"]={attitude:"ally",knowledge:[],events:[],aliases:["Hemlock"]};
    worldState.transcript=[
      {t:5,r:"player",x:"Ask about the broadsheet"},
      {t:6,r:"gm",x:"He kept the broadsheet because it seemed mad. Origin scene.",e:{n:["Hemlock"],l:"Sandpoint",q:[]}},
      {t:20,r:"gm",x:"filler",e:{n:[],l:"Coast",q:[]}},{t:24,r:"gm",x:"filler2",e:{n:[],l:"Coast",q:[]}},
      {t:28,r:"gm",x:"filler3",e:{n:[],l:"Coast",q:[]}},{t:29,r:"gm",x:"filler4",e:{n:[],l:"Coast",q:[]}}
    ];
    worldState.ragMemory=true;
    var b=ragRetrieve("why did Hemlock keep the broadsheet?");
    worldState.ragMemory=false;
    return b.indexOf("Origin scene")>=0?true:"orphaned index name not resolved: "+b.slice(0,140);
  });
  t("cleanTxt strips [RETCON:]",function(){
    return eq(cleanTxt("You are right. The record stands corrected. [RETCON:pin retrieval]"),"You are right. The record stands corrected.");
  });
  t("TOC diet: flag-off output is byte-identical after a round trip",function(){
    makeWorld();lastAction="";
    for(var li=0;li<20;li++)memory.lore.push("Fact number "+li+" about distant Elsewhere");
    memory.lore.push("Ashfen was built on a barrow");
    memory.chapters.push({turn:1,summary:"Chapter one happened."});
    var off1=memoryTOC();
    worldState.ragMemory=true;var on=memoryTOC();
    worldState.ragMemory=false;var off2=memoryTOC();
    if(off1!==off2)return "flag round-trip changed the flag-off TOC";
    if(on===off1)return "diet did nothing";
    if(on.indexOf("CHAPTER SUMMARIES")>=0)return "diet kept chapter summaries";
    if(off1.indexOf("CHAPTER SUMMARIES")<0)return "flag-off lost chapter summaries";
    if(on.indexOf("Ashfen was built on a barrow")<0)return "scene-relevant lore dropped";
    return on.indexOf("Fact number 3 ")<0?true:"old irrelevant lore kept";
  });
  t("stable half is unaffected by the rag flag (cache invariant)",function(){
    makeWorld();var a=buildSysPrompt().stable;
    worldState.ragMemory=true;var b=buildSysPrompt().stable;
    worldState.ragMemory=false;
    return a===b?true:"stable changed with the rag flag";
  });
  t("rag block lands in the volatile half only, and only with the flag on",function(){
    makeWorld();worldState.turn=40;lastAction="I ask Bram about his promise";
    memory.npcs["Bram"]={attitude:"ally",knowledge:[],events:[],aliases:[]};
    worldState.transcript=[{t:2,r:"player",x:"I ask Bram"},{t:3,r:"gm",x:"Bram promises safe passage.",e:{n:["Bram"],l:"Ashfen",q:[]}},{t:6,r:"gm",x:"a"},{t:7,r:"gm",x:"b"},{t:8,r:"gm",x:"c"},{t:9,r:"gm",x:"d"}];
    var offV=buildSysPrompt().volatile;
    if(offV.indexOf("PAST SCENE EXCERPTS")>=0)return "excerpts present with flag off";
    worldState.ragMemory=true;
    var s=buildSysPrompt();
    worldState.ragMemory=false;lastAction=null;
    if(s.stable.indexOf("PAST SCENE EXCERPTS")>=0)return "excerpts leaked into stable";
    return s.volatile.indexOf("PAST SCENE EXCERPTS")>=0?true:"excerpts missing from volatile";
  });

  // ── 12. Summarize-tail retention (#28) — the amnesia-cliff fix ───────────────
  section("summarize-tail retention (#28)");
  function pair(u,g){sessionLog.push({role:"user",content:u},{role:"assistant",content:g});}
  var big=new Array(1001).join("x"); // 1000 chars ≈ 250 tok
  t("retainSessionTail keeps the newest 3 exchanges and sets the marker",function(){
    makeWorld();
    pair("a1","g1");pair("a2","g2");pair("a3","g3");pair("a4","g4");pair("a5","g5");
    retainSessionTail();
    if(sessionLog.length!==6)return "kept "+sessionLog.length+" messages, want 6";
    if(sessionLog[0].content!=="a3")return "oldest kept is "+sessionLog[0].content+", want a3";
    if(sessionLog[5].content!=="g5")return "newest lost";
    return worldState.sessKept===6?true:"marker "+worldState.sessKept+", want 6";
  });
  t("token cap trims older exchanges; the newest survives even alone over budget",function(){
    makeWorld();
    var huge=big+big+big+big; // 4000 chars ≈ 1000 tok per message
    pair(huge,huge);pair(huge,huge);pair(huge,huge); // 2000 tok/pair — 2nd pair would push past SUMMARY_KEEP_TOK
    retainSessionTail();
    if(sessionLog.length!==2)return "budget kept "+(sessionLog.length/2)+" pairs, want 1";
    makeWorld();
    pair(huge+huge,huge+huge); // one pair ≈ 4000 tok, over budget by itself
    retainSessionTail();
    return sessionLog.length===2?true:"huge newest pair was dropped";
  });
  t("mature-campaign prose sizes retain 2-3 exchanges (the #28 spec target)",function(){
    makeWorld();
    var gm=big+big; // 2000 chars — mid-range t198 GM turn
    pair("act 1",gm);pair("act 2",gm);pair("act 3",gm);pair("act 4",gm);pair("act 5",gm);
    retainSessionTail();
    var kept=sessionLog.length/2;
    return kept>=2&&kept<=3?true:"kept "+kept+" exchanges at ~500 tok each, want 2-3";
  });
  t("retained tail can't re-trip SUMMARIZE_AT: sessionTokens counts only past the marker",function(){
    makeWorld();
    pair(big,big);pair(big,big);
    retainSessionTail();
    if(sessionTokens()!==0)return "retained tail still counts: "+sessionTokens();
    pair("new question",big);
    var want=Math.ceil(("new question".length+big.length)/4);
    return sessionTokens()===want?true:"new-exchange count "+sessionTokens()+", want "+want;
  });
  t("stale marker fails safe: sessKept beyond the log recounts everything",function(){
    makeWorld();
    pair("q",big);
    worldState.sessKept=10; // e.g. log replaced by an import
    var want=Math.ceil(("q".length+big.length)/4);
    return sessionTokens()===want?true:"counted "+sessionTokens()+", want "+want;
  });
  t("empty log: retention is a no-op, marker zero",function(){
    makeWorld();
    retainSessionTail();
    return sessionLog.length===0&&worldState.sessKept===0?true:"len "+sessionLog.length+" marker "+worldState.sessKept;
  });

  // ── Companion XP parity + quest lifecycle teeth (v1.172) ─────────────────────
  section("companion XP parity / quest teeth (#20)");
  function partyWorld(){
    makeWorld();
    worldState.npcs=[
      {name:"Lyra",partyMember:true,status:"ally",rel:"c",charSheet:{name:"Lyra",cls:"Sorcerer",level:1,xp:0,hp:8,maxHp:8,stats:{CON:10}}},
      {name:"Bram",partyMember:true,status:"ally",rel:"c",charSheet:{name:"Bram",cls:"Warrior",level:1,xp:0,hp:12,maxHp:12,stats:{CON:12}}},
      {name:"Vex",partyMember:false,status:"ally",rel:"a",charSheet:{name:"Vex",cls:"Rogue",level:1,xp:0}}
    ];
  }
  t("[XP:N] mirrors to every party companion (not non-party allies)",function(){
    partyWorld();
    applyMuts("You did it. [XP:120]");
    if(worldState.character.xp!==120)return "player xp "+worldState.character.xp;
    if(worldState.npcs[0].charSheet.xp!==120)return "Lyra not mirrored: "+worldState.npcs[0].charSheet.xp;
    if(worldState.npcs[1].charSheet.xp!==120)return "Bram not mirrored";
    return worldState.npcs[2].charSheet.xp===0?true:"non-party ally received XP";
  });
  t("COMPANION_XP in the same response supersedes the mirror for that companion",function(){
    partyWorld();
    applyMuts("Lyra's solo kill. [XP:100][COMPANION_XP:Lyra|250]");
    if(worldState.npcs[0].charSheet.xp!==250)return "Lyra got "+worldState.npcs[0].charSheet.xp+", want 250 (no double award)";
    return worldState.npcs[1].charSheet.xp===100?true:"Bram mirror lost: "+worldState.npcs[1].charSheet.xp;
  });
  t("mirrored XP levels companions up",function(){
    partyWorld();
    applyMuts("A mighty deed. [XP:350]");
    return worldState.npcs[0].charSheet.level===2?true:"Lyra level "+worldState.npcs[0].charSheet.level+" at 350 xp";
  });

  // ── checkLevelUp multi-level jump (audit E1) ──────────────────────────────────
  section("checkLevelUp multi-level jump (E1)");
  t("a single big XP award loops HP and features across every level crossed",function(){
    makeWorld(); // Warrior, CON 14 (+2 mod), hd 12 → per-level +9 HP; maxHp starts 14
    // Jump level 1 → 5 in one award (6500 XP = level 5). Player path must match the
    // companion path: 4 levels of HP (not 1), and BOTH Lv2 + Lv5 features (not just Lv5).
    applyMuts("Ages pass in an instant. [XP:6500]");
    var c=worldState.character;
    if(c.level!==5)return "level "+c.level+" want 5";
    if(c.maxHp!==14+9*4)return "maxHp "+c.maxHp+" want "+(14+36)+" (9/level x4)";
    if(c.hp!==14+9*4)return "hp "+c.hp+" want "+(14+36);
    var has=function(nm){for(var i=0;i<c.abilities.length;i++)if(c.abilities[i].nm===nm)return true;return false;};
    if(!has("Lv2"))return "Lv2 feature (Action Surge) skipped by the jump";
    return has("Lv5")?true:"Lv5 feature (Extra Attack) missing";
  });
  t("quest block: all-objectives-done quest gets the close-or-extend instruction",function(){
    makeWorld();
    worldState.questLog=[
      {title:"Clear the mine",status:"active",desc:"",objectives:[{text:"a",done:true},{text:"b",done:true}]},
      {title:"Find the heir",status:"active",desc:"",objectives:[{text:"c",done:true},{text:"d",done:false}]}
    ];
    var b=buildQuestBlock();
    if(b.indexOf("ALL OBJECTIVES COMPLETE")<0)return "close instruction missing";
    if(b.indexOf("[QUEST:Clear the mine|completed]")<0)return "close instruction not quest-specific";
    if(b.indexOf("[QUEST:Find the heir|completed]")>=0)return "close instruction on an unfinished quest";
    return b.indexOf("Active crises ARE quests")>=0?true:"crisis reminder missing";
  });
  t("quest block: objective-less active quest never gets the close nudge; empty log keeps the crisis line",function(){
    makeWorld();
    worldState.questLog=[{title:"Vague errand",status:"active",desc:"",objectives:[]}];
    var b=buildQuestBlock();
    if(b.indexOf("ALL OBJECTIVES COMPLETE")>=0)return "nudge fired on objective-less quest";
    worldState.questLog=[];
    var b2=buildQuestBlock();
    return b2.indexOf("Active crises ARE quests")>=0?true:"crisis line missing on empty log";
  });

  // ── GM-compliance teeth (audit P3/P14) ────────────────────────────────────────
  section("GM-compliance teeth (P3/P14)");
  t("allDoneSince stamps when objectives complete, stays sticky, clears on a new objective",function(){
    makeWorld();worldState.turn=10;
    applyMuts("[QUEST:Hunt|active|kill the wolf][QUEST_STEP:Hunt|Track the wolf|false]");
    var q=worldState.questLog[0];
    if(q.allDoneSince!=null)return "stamped with an open objective";
    worldState.turn=12;applyMuts("[QUEST_STEP:Hunt|Track the wolf|true]");
    if(q.allDoneSince!==12)return "not stamped at completion: "+q.allDoneSince;
    worldState.turn=14;applyMuts("no tags this turn");
    if(q.allDoneSince!==12)return "stamp not sticky across turns: "+q.allDoneSince;
    applyMuts("[QUEST_STEP:Hunt|Skin the wolf|false]");
    return q.allDoneSince==null?true:"stamp not cleared by a new objective";
  });
  t("allDoneSince clears when the quest leaves active status",function(){
    makeWorld();worldState.turn=10;
    worldState.questLog=[{title:"Hunt",status:"active",desc:"",objectives:[{text:"a",done:true}],allDoneSince:8}];
    applyMuts("[QUEST:Hunt|failed]");
    // failed → archived out of the live log entirely; nothing left to escalate on
    return worldState.questLog.length===0?true:"quest not archived: "+JSON.stringify(worldState.questLog);
  });
  t("buildQuestEscalation: fires only at >=3 stale turns and picks the stalest quest",function(){
    makeWorld();worldState.turn=20;
    worldState.questLog=[
      {title:"Fresh",status:"active",desc:"",objectives:[{text:"a",done:true}],allDoneSince:17},
      {title:"Old",status:"active",desc:"",objectives:[{text:"b",done:true}],allDoneSince:14},
      {title:"Oldest",status:"active",desc:"",objectives:[{text:"c",done:true}],allDoneSince:10}
    ];
    var n=buildQuestEscalation();
    if(n.indexOf("Quest 'Oldest'")<0)return "did not pick the stalest: "+n;
    if(n.indexOf("[QUEST:Oldest|completed]")<0)return "missing close instruction: "+n;
    if(n.indexOf("[QUEST_STEP:Oldest|")<0)return "missing extend instruction: "+n;
    if(n.indexOf("ENGINE NOTE")<0)return "not marked as an engine note";
    worldState.questLog=[{title:"Fresh",status:"active",desc:"",objectives:[{text:"a",done:true}],allDoneSince:18}];
    return buildQuestEscalation()===""?true:"fired at only 2 stale turns";
  });
  t("buildQuestEscalation: silent during combat, resumes after",function(){
    makeWorld();worldState.turn=20;
    worldState.questLog=[{title:"Stuck",status:"active",desc:"",objectives:[{text:"a",done:true}],allDoneSince:10}];
    worldState.combat={name:"Wolf",hp:9,maxHp:9,ac:12,atk:2,dmg:"d6",morale:"low",round:1};
    if(buildQuestEscalation()!=="")return "escalated mid-combat";
    worldState.combat=null;
    return buildQuestEscalation().indexOf("Stuck")>=0?true:"did not resume after combat";
  });
  t("ITEM_GAINED 'Rope x3' stores quantity 3 of 'Rope' (P14)",function(){
    makeWorld();applyMuts("[ITEM_GAINED:Rope x3]");
    var f=worldState.character.inventory.filter(function(x){return _invNorm(x)==="rope";});
    if(f.length!==1)return "entries: "+JSON.stringify(worldState.character.inventory);
    return _invBase(f[0])==="Rope"&&_invCount(f[0])===3?true:"stored as: "+f[0];
  });
  t("ITEM_GAINED 'Rope x3' onto an existing Rope yields 4, not 2 (the xN-as-name bug)",function(){
    makeWorld();worldState.character.inventory.push("Rope");
    applyMuts("[ITEM_GAINED:Rope x3]");
    var f=worldState.character.inventory.filter(function(x){return _invNorm(x)==="rope";});
    return f.length===1&&f[0]==="Rope x4"?true:"got "+JSON.stringify(f);
  });
  t("ITEM_LOST 'Rope x2' removes two copies (P14)",function(){
    makeWorld();worldState.character.inventory.push("Rope x3");
    applyMuts("[ITEM_LOST:Rope x2]");
    var f=worldState.character.inventory.filter(function(x){return _invNorm(x)==="rope";});
    if(!(f.length===1&&f[0]==="Rope"))return "got "+JSON.stringify(f);
    applyMuts("[ITEM_LOST:Rope x2]"); // over-remove: takes the last one, no crash, no negatives
    return worldState.character.inventory.filter(function(x){return _invNorm(x)==="rope";}).length===0?true:"over-remove left residue";
  });
  t("names where x is not a separate quantity token are left intact ('Potion of Hex')",function(){
    makeWorld();applyMuts("[ITEM_GAINED:Potion of Hex][ITEM_GAINED:Elixir of Styx]");
    if(worldState.character.inventory.indexOf("Potion of Hex")<0)return "Potion of Hex mangled: "+JSON.stringify(worldState.character.inventory);
    return worldState.character.inventory.indexOf("Elixir of Styx")>=0?true:"Elixir of Styx mangled: "+JSON.stringify(worldState.character.inventory);
  });

  // ── 13. futureEvents hygiene (#29) ────────────────────────────────────────────
  section("futureEvents hygiene (#29)");
  t("near-duplicate events collapse onto the existing entry, refreshing its age (the 7-Shalelu spam)",function(){
    makeWorld();
    fileFutureEvent("soon","","Find Shalelu the hunter in the hinterlands",10);
    fileFutureEvent("soon","","Party travels north to find Shalelu in the field",20);
    fileFutureEvent("soon","","Finding Shalelu in the forest north",25);
    if(memory.futureEvents.length!==1)return "filed "+memory.futureEvents.length+" entries, want 1";
    if(memory.futureEvents[0].what.indexOf("hunter in the hinterlands")<0)return "original entry replaced";
    return memory.futureEvents[0].setTurn===25?true:"age not refreshed: "+memory.futureEvents[0].setTurn;
  });
  t("same NPC, different business survives the dedupe (Hemlock broadsheet vs mechanism)",function(){
    makeWorld();
    fileFutureEvent("soon","","Confront Hemlock about what he knows regarding Thassilon and the broadsheet",10);
    fileFutureEvent("soon","","Understand what mechanism Hemlock was calculating from the seven-sin taxonomy",12);
    return memory.futureEvents.length===2?true:"distinct events merged: "+memory.futureEvents.length;
  });
  t("expiry sweeps unresolved events older than FUTURE_EXPIRE_TURNS; grandfathers unstamped",function(){
    makeWorld();worldState.turn=100;
    memory.futureEvents=[
      {when:"soon",who:"",what:"ancient stale plan",setTurn:50,resolved:false},
      {when:"soon",who:"",what:"fresh goal",setTurn:90,resolved:false},
      {when:"soon",who:"",what:"pre-stamp save entry",resolved:false}
    ];
    expireFutureEvents();
    if(memory.futureEvents.length!==2)return "kept "+memory.futureEvents.length+", want 2";
    if(memory.futureEvents[0].what!=="fresh goal")return "wrong survivor: "+memory.futureEvents[0].what;
    return memory.futureEvents[1].setTurn===100?true:"unstamped entry not grandfathered";
  });
  t("applySummaryExtract: extractor-echoed resolvedEvents clear pending items",function(){
    makeWorld();worldState.turn=30;
    fileFutureEvent("soon","","Find Shalelu the hunter in the hinterlands",10);
    fileFutureEvent("soon","","The mechanism beneath the glassworks continues its work",12);
    applySummaryExtract({resolvedEvents:["Find Shalelu the hunter in the hinterlands"]});
    if(memory.futureEvents.length!==1)return "kept "+memory.futureEvents.length+", want 1";
    return memory.futureEvents[0].what.indexOf("mechanism")>=0?true:"wrong event resolved";
  });
  t("applySummaryExtract: set-and-finished-in-one-window nets out removed (file then resolve)",function(){
    makeWorld();worldState.turn=30;
    applySummaryExtract({
      futureEvents:[{what:"Rescue the miller from the well",when:"tonight"}],
      resolvedEvents:["Rescue the miller from the well"]
    });
    return memory.futureEvents.length===0?true:"same-window event left pending: "+JSON.stringify(memory.futureEvents);
  });
  t("restSpells restores party companions' expended spells too (E84)",function(){
    makeWorld();
    worldState.character.spells=[{nm:"Fireball",lvl:3,used:true},{nm:"Light",lvl:0,used:false}];
    worldState.npcs=[{name:"Lyra",partyMember:true,charSheet:{spells:[{nm:"Shield",lvl:1,used:true}]}}];
    restSpells();
    return worldState.character.spells[0].used===false&&worldState.npcs[0].charSheet.spells[0].used===false?true:"companion spell not restored";
  });
  t("[REST:long] tag restores expended spell slots party-wide (P10 tail)",function(){
    makeWorld();
    worldState.character.spells=[{nm:"Hunter's Mark (d6 bonus)",lvl:1,used:true},{nm:"Light",lvl:0,used:false}];
    worldState.npcs=[{name:"Ekene",partyMember:true,charSheet:{spells:[{nm:"Cure Wounds",lvl:1,used:true}]}}];
    applyMuts("They sleep the night through. [REST:long]");
    if(worldState.character.spells[0].used!==false)return "player 1/day spell not restored on [REST:long]";
    if(worldState.character.spells[1].used!==false)return "cantrip flag disturbed";
    return worldState.npcs[0].charSheet.spells[0].used===false?true:"companion spell not restored on [REST:long]";
  });
  t("[REST:short] does not restore slots (only long rest resets)",function(){
    makeWorld();
    worldState.character.spells=[{nm:"Hunter's Mark",lvl:1,used:true}];
    applyMuts("A brief breather. [REST:short]");
    return worldState.character.spells[0].used===true?true:"short rest wrongly restored a 1/day slot";
  });
  t("migrateWorldState heals a missing maxHp before hp (E71)",function(){
    makeWorld();delete worldState.character.maxHp;worldState.character.hp=12;
    migrateWorldState();
    return (typeof worldState.character.maxHp==="number"&&worldState.character.maxHp>0)?true:"maxHp not healed: "+worldState.character.maxHp;
  });
  t("loadState keeps a good worldState when the memory key is corrupt (E73)",function(){
    makeWorld();
    store.set(WSK,JSON.stringify(worldState));store.set(SLK,"[]");store.set(MEM_KEY,"{bad json");
    var ok=loadState();
    store.del(WSK);store.del(SLK);store.del(MEM_KEY);
    if(!ok)return "returned false despite a good worldState";
    return (worldState&&worldState.character&&worldState.character.name==="Tess")?true:"good worldState discarded on corrupt memory";
  });
  // ── blueprint apply hardening (audit E19/E20) ──
  t("normalizeBlueprint defaults each act's arcs so applyBlueprint can't crash (E19)",function(){
    var bp=normalizeBlueprint({format:"tnd-blueprint-v1",name:"X",acts:[{title:"A1",goal:"g"}]});
    return Array.isArray(bp.acts[0].arcs)?true:"arcs not defaulted";
  });
  t("applyBlueprint keeps the wizard voice when the blueprint voice is empty (E20)",function(){
    makeWorld();worldState.proseAuthor="howard";
    applyBlueprint({proseAuthor:"",acts:[],npcs:[],locations:[],rules:[]});
    return worldState.proseAuthor==="howard"?true:"wizard voice clobbered: "+JSON.stringify(worldState.proseAuthor);
  });
  // ── memory robustness (audit E43/E44/E45/E46/E50/E51) ──
  t("applySummaryExtract ignores non-array extractor fields (E43)",function(){
    makeWorld();worldState.turn=10;var loreBefore=memory.lore.length,decBefore=memory.keyDecisions.length;
    applySummaryExtract({loreDiscovered:"a single string not an array",decisionsMade:"also a string",resolvedEvents:"str",npcUpdates:"nope",futureEvents:"nope"});
    if(memory.lore.length!==loreBefore)return "string iterated into lore: "+JSON.stringify(memory.lore.slice(-3));
    return memory.keyDecisions.length===decBefore?true:"string iterated into decisions";
  });
  t("fileFutureEvent coerces a non-string what; resolveFutureEvent tolerates it (E44)",function(){
    makeWorld();
    fileFutureEvent("soon","",{unexpected:"object"},5); // must not throw
    resolveFutureEvent("does not exist");                // must not throw on the coerced entry
    return true;
  });
  t("resolveFutureEvent('') does not delete the oldest pending event (E45)",function(){
    makeWorld();fileFutureEvent("soon","","first event",5);fileFutureEvent("soon","","second event",6);
    resolveFutureEvent("");resolveFutureEvent("   ");
    return memory.futureEvents.length===2?true:"empty needle deleted an event: "+memory.futureEvents.length;
  });
  t("applySummaryExtract files the chapter (E46 reorder didn't drop it)",function(){
    makeWorld();worldState.turn=10;
    applySummaryExtract({chapterSummary:"A chapter.",npcUpdates:[{name:"Bram",attitude:"warm"}]});
    return memory.chapters.length===1&&memory.chapters[0].summary==="A chapter."&&memory.npcs["Bram"]?true:"chapter/npc not filed";
  });
  t("fileNpcEvent caps events at 8 even after an overfill (E50)",function(){
    makeWorld();memory.npcs["X"]={attitude:"",knowledge:[],events:[],aliases:[]};
    for(var k=0;k<12;k++)memory.npcs["X"].events.push({turn:k,note:"e"+k});
    fileNpcEvent("X","new note",13);
    return memory.npcs["X"].events.length<=8?true:"events not capped: "+memory.npcs["X"].events.length;
  });
  t("[NPC_LINK:...|player|...] links to the PC name, not a phantom 'player' (E48)",function(){
    makeWorld(); // character.name = "Tess"
    applyMuts("[NPC_LINK:Borin|player|old debt]");
    var edges=memory.npcGraph.edges;
    if(edges.filter(function(e){return e.a==="player"||e.b==="player";}).length)return "phantom 'player' node created";
    return edges.filter(function(e){return e.a==="Tess"||e.b==="Tess";}).length===1?true:"link not to PC: "+JSON.stringify(edges);
  });
  t("applySummaryExtract dedupes NPC knowledge (E51)",function(){
    makeWorld();worldState.turn=10;
    applySummaryExtract({npcUpdates:[{name:"Bram",knowledgeGained:"knows the toll"}]});
    applySummaryExtract({npcUpdates:[{name:"Bram",knowledgeGained:"knows the toll"}]});
    return memory.npcs["Bram"].knowledge.filter(function(k){return k==="knows the toll";}).length===1?true:"duplicated knowledge";
  });
  t("applySummaryExtract still files chapters/lore/npcs (refactor didn't drop behavior)",function(){
    makeWorld();worldState.turn=30;
    applySummaryExtract({
      chapterSummary:"A chapter happened.",
      npcUpdates:[{name:"Bram",attitude:"warm",knowledgeGained:"knows the toll"}],
      loreDiscovered:["The barrow predates the town"],
      decisionsMade:["Spared the bandit"],
      futureEvents:[{what:"Bram expects repayment",when:"midwinter"}]
    });
    if(memory.chapters.length!==1||memory.chapters[0].summary!=="A chapter happened.")return "chapter missing";
    if(!memory.npcs["Bram"]||memory.npcs["Bram"].attitude!=="warm")return "npc update missing";
    if(memory.lore.indexOf("The barrow predates the town")<0)return "lore missing";
    if(memory.keyDecisions.length!==1)return "decision missing";
    return memory.futureEvents.length===1?true:"future event missing";
  });

  // ── NPC mood clamp + eviction archive (audit P6/P12) ──
  section("mood clamp + eviction archive (P6/P12)");
  t("clampNpcMood leaves short labels untouched (P6)",function(){
    return eq(clampNpcMood("wary, bargaining"),"wary, bargaining");
  });
  t("clampNpcMood cuts sentence-length prose at a word boundary (P6)",function(){
    var long="exhausted but precise, has given Varek everything she knows";
    var out=clampNpcMood(long);
    if(out.length>49)return "not clamped: "+out.length+" chars";
    if(out.slice(-1)!=="…")return "no ellipsis: "+out;
    return out.indexOf("exhausted but precise")===0?true:"lost the head of the label: "+out;
  });
  t("[NPC:] tag with prose status stores the clamped label (P6)",function(){
    makeWorld();
    applyMuts("[NPC:Zephyr|exhausted but precise, has given the party everything she knows tonight|ally]");
    var n=worldState.npcs.filter(function(x){return x.name==="Zephyr";})[0];
    if(!n)return "npc not filed";
    return n.status.length<=49?true:"status not clamped: "+n.status;
  });
  t("extractor attitude prose is clamped on write (P6)",function(){
    makeWorld();worldState.turn=10;
    applySummaryExtract({npcUpdates:[{name:"Ekene",attitude:"Committed and direct, speaking with a healer's flat authority rather than supplication"}]});
    return memory.npcs["Ekene"].attitude.length<=49?true:"attitude not clamped: "+memory.npcs["Ekene"].attitude;
  });
  t("fileLore eviction compacts into memory.archive.lore, not the void (P12)",function(){
    makeWorld();
    for(var i=0;i<31;i++)fileLore("lore fact "+i);
    if(memory.lore.length!==30)return "live cap broken: "+memory.lore.length;
    if(memory.archive.lore.length!==1)return "evicted lore not archived: "+memory.archive.lore.length;
    return eq(memory.archive.lore[0],"lore fact 0","oldest should archive first:");
  });
  t("fileDecision eviction compacts into memory.archive.decisions (P12)",function(){
    makeWorld();
    for(var i=0;i<31;i++)fileDecision(i,"decision "+i);
    if(memory.keyDecisions.length!==30)return "live cap broken";
    if(memory.archive.decisions.length!==1)return "evicted decision not archived";
    return eq(memory.archive.decisions[0].desc,"decision 0","oldest decision:");
  });
  t("chapter eviction compacts into memory.archive.chapters (P12)",function(){
    makeWorld();
    for(var i=0;i<11;i++){worldState.turn=i*7;applySummaryExtract({chapterSummary:"chapter "+i});}
    if(memory.chapters.length!==10)return "live chapter cap broken: "+memory.chapters.length;
    if(memory.archive.chapters.length!==1)return "evicted chapter not archived";
    return eq(memory.archive.chapters[0].summary,"chapter 0","oldest chapter:");
  });
  t("migrateWorldState retro-clamps a long stored NPC status; healMemory clamps stored attitudes (P6)",function(){
    makeWorld();
    worldState.npcs.push({name:"Zephyr",status:"exhausted but precise, has given the party everything she knows tonight",rel:"ally",met:5,partyMember:false});
    memory.npcs["Zephyr"]={attitude:"Committed and direct, speaking with a healer's flat authority rather than supplication",knowledge:[],events:[],aliases:[]};
    migrateWorldState();healMemory();
    if(worldState.npcs[0].status.length>49)return "worldState status not retro-clamped: "+worldState.npcs[0].status.length;
    return memory.npcs["Zephyr"].attitude.length<=49?true:"memory attitude not retro-clamped: "+memory.npcs["Zephyr"].attitude.length;
  });
  t("healMemory adds the archive to pre-P12 saves; memArchive self-heals (P12)",function(){
    memory={npcs:{},locations:{}}; // legacy blob, no archive
    healMemory();
    if(!memory.archive||!memory.archive.lore)return "healMemory did not add archive";
    memory=blankMemory();delete memory.archive; // worst case: something stripped it at runtime
    fileLore("x");for(var i=0;i<30;i++)fileLore("filler "+i);
    return memory.archive&&memory.archive.lore.length===1?true:"memArchive did not self-heal on eviction";
  });

  // ═══ UA1: tag table — derivations frozen, coverage guards, full-vocabulary parity ═══
  // NOTE: with TAG_SHADOW on, EVERY applyMuts call in the suites above already ran the table
  // against cloned state and diffed — the zero-diff gate at the very end of this file is the
  // aggregate parity assertion over the whole suite. The battery below adds the rare tags.
  section("tag table (UA1): derivations + coverage");
  function __djb2(s){var h=5381,i;for(i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return h;}
  t("derived cleanTxt strip regex is byte-identical to the pre-refactor literal (frozen)",function(){
    // Frozen from the v1.240 literals (verified against git HEAD during the refactor). A registry
    // edit that changes stripping MUST consciously update these numbers.
    if(__djb2(_CT_TAGS.source)!==1892048388||_CT_TAGS.source.length!==840)return "_CT_TAGS diverged from the frozen literal";
    return _CT_BARE.source==="\\[(ENEMY_SURRENDERS|SUBLOCATION_LEAVE)\\]"?true:"_CT_BARE diverged";
  });
  t("derived STATE TAGS doc block frozen (the money-tested prompt text, byte-level)",function(){
    var d=buildStateTagsDoc();
    return (__djb2(d)===1563084037&&d.length===8237)?true:"doc block diverged (hash "+__djb2(d)+", len "+d.length+") — prompt-text changes must be deliberate commits";
  });
  t("coverage: every handler stripped; every stripped name handled or exempt-with-reason",function(){
    var have={},i;for(i=0;i<TAG_TABLE.length;i++)have[TAG_TABLE[i].t]=1;
    var stripped={};for(i=0;i<TAG_STRIP_NAMES.length;i++)stripped[TAG_STRIP_NAMES[i]]=1;for(i=0;i<TAG_STRIP_BARE.length;i++)stripped[TAG_STRIP_BARE[i]]=1;
    var exempt={};for(i=0;i<TAG_NO_HANDLER.length;i++)exempt[TAG_NO_HANDLER[i]]=1;
    for(var t2 in have){if(t2==="SUBLOCATION_LEAVE")continue;if(!stripped[t2])return "handler "+t2+" is NOT stripped (would leak to the player)";}
    if(!stripped["SUBLOCATION_LEAVE"])return "bare tag SUBLOCATION_LEAVE not stripped";
    for(var s2 in stripped){if(!have[s2]&&!exempt[s2])return "stripped tag "+s2+" has NO handler and NO documented exemption (the phantom class)";}
    return true;
  });

  section("tag table (UA1): full-vocabulary parity battery");
  t("parity A: fresh-world mega-response (core + world + npc + combat-open tags)",function(){
    makeWorld();var d0=__tagDiffCount;
    applyMuts("The road bends east.\n[HP:-3][GOLD:+10][ITEM_GAINED:Torch][ITEM_GAINED:Torch][ITEM_GAINED:Rope x3][ITEM_LOST:Travel ration][XP:50]"
      +"[LOCATION:Duskmere][LOCATION_DESC:A drowned town on stilts.][LOCATION_SIZE:small|10][SUBLOCATION:The Eel's Rest][LOCATION_ITEM:Rusted key|placed]"
      +"[TIME:midnight][WEATHER:fog]"
      +"[NPC:Borin Stonehand|gruff, wary|acquaintance][NPC:Mira|she/her][NPC_PRONOUN:Borin Stonehand|he/him][NPC_ALIAS:Borin Stonehand|The Smith]"
      +"[LORE:Duskmere floods every spring tide.][DECISION:Spared the smuggler.][FUTURE_EVENT:The spring tide arrives|three days]"
      +"[NPC_NOTE:Borin Stonehand|Sold the party a lantern.][SKILL_SUCCESS:stealth][CONDITION:Chilled|until warmed][RELATIONSHIP:Borin Stonehand|Indebted]"
      +"[SAVE_MOD:Blessing of the Eel|Cold|2][LANGUAGE:Marsh-cant|broken][STORY_BEAT:First sight of the drowned town.][ABILITY_GAINED:Mudwalk|Move over marsh without sinking.]"
      +"[QUEST:The Drowned Bell|offered|Raise the bell from the deep.][QUEST:Eel Debts|active][QUEST_STEP:Eel Debts|Meet Borin at the forge|true]"
      +"[ALIGNMENT:good+1][SPELL_USED:Faerie Fire][SPELL_DEF:Marsh Light|range=60ft|targets=one point|duration=10 min|effect=A bobbing witch-light|cost=at-will|magical=yes]"
      +"[COMBAT_START:Marsh Wight|18|13|+4|d8+2|fights until dawn][COMBAT_STATS:STR:14|DEX:12|CON:16|INT:6|WIS:10|CHA:8|CR:2][COMBAT_IMMUNE:poison][COMBAT_RESIST:cold, necrotic][COMBAT_VULN:fire][ENEMY_HP:-5 slashing][COMBAT_ROUND:2]");
    if(__tagDiffCount!==d0)return (__tagDiffCount-d0)+" shadow diff(s) on mega-response — see console";
    if(worldState.character.hp!==11||worldState.character.gold!==35)return "sanity: core muts wrong";
    return worldState.combat&&worldState.combat.hp===13?true:"sanity: combat state wrong";
  });
  t("parity B: closures, removals, merge, factions, rest, party join",function(){
    var d0=__tagDiffCount; // CONTINUES the parity-A world (combat live, condition/rel/save/lang set)
    applyMuts("It ends at the water line.\n[COMBAT_END:fled][SUBLOCATION_LEAVE][CONDITION_REMOVED:Chilled][RELATIONSHIP_REMOVED:Borin Stonehand]"
      +"[SAVE_MOD_REMOVED:Blessing of the Eel][FUTURE_EVENT_RESOLVED:The spring tide arrives][NPC_FORGET:Borin Stonehand|lantern]"
      +"[QUEST:Eel Debts|completed][REST:long][NPC:Old Borin|weathered|ally][NPC_MERGE:Borin Stonehand|Old Borin]"
      +"[NPC_LINK:Borin Stonehand|player|reluctant respect][FACTION:Tidewardens|keepers of the flood-bells][NPC_FACTION:Borin Stonehand|Tidewardens|bellsmith]"
      +"[FACTION_REL:Tidewardens|Salt Guild|old rivals][PARTY_MEMBER:Borin Stonehand|true]");
    if(__tagDiffCount!==d0)return (__tagDiffCount-d0)+" shadow diff(s) on closures/merge — see console";
    if(worldState.combat!==null)return "sanity: combat not closed";
    var b=null,i;for(i=0;i<worldState.npcs.length;i++)if(worldState.npcs[i].name==="Borin Stonehand")b=worldState.npcs[i];
    return b&&b.partyMember?true:"sanity: merge/join wrong";
  });
  t("parity C: companion tags + shared-XP mirror + COMPANION_XP supersede",function(){
    makeWorld();var d0=__tagDiffCount;
    worldState.npcs.push({name:"Lyra",status:"steady",rel:"ally",met:1,partyMember:true,charSheet:{name:"Lyra",cls:"Cleric",level:2,hp:12,maxHp:12,xp:400,stats:{},abilities:[],inventory:[],spells:[],conditions:[],relationships:[],alignLaw:0,alignGood:0,actualAlignment:"True Neutral"}});
    worldState.npcs.push({name:"Bram",status:"dour",rel:"ally",met:1,partyMember:true,charSheet:{name:"Bram",cls:"Warrior",level:2,hp:16,maxHp:16,xp:400,stats:{},abilities:[],inventory:[],spells:[],conditions:[],relationships:[],alignLaw:0,alignGood:0,actualAlignment:"True Neutral"}});
    applyMuts("[COMPANION_HP:Lyra|-4][COMPANION_ITEM_GAINED:Lyra|Silver censer][COMPANION_ITEM_LOST:Bram|Shield]"
      +"[COMPANION_CONDITION:Bram|Poisoned|until dawn][COMPANION_CONDITION_REMOVED:Bram|Poisoned]"
      +"[COMPANION_RELATIONSHIP:Lyra|Borin|Suspicious][COMPANION_RELATIONSHIP_REMOVED:Lyra|Borin]"
      +"[COMPANION_ABILITY:Bram|Shield Wall|Adjacent allies gain +1 AC.][COMPANION_ALIGNMENT:Lyra|good+1]"
      +"[XP:100][COMPANION_XP:Lyra|50]");
    if(__tagDiffCount!==d0)return (__tagDiffCount-d0)+" shadow diff(s) on companion tags — see console";
    var lyra=worldState.npcs[0].charSheet,bram=worldState.npcs[1].charSheet;
    if(lyra.hp!==8||lyra.xp!==450)return "sanity: Lyra hp/xp wrong ("+lyra.hp+"/"+lyra.xp+")";
    return bram.xp===500?true:"sanity: Bram mirror wrong ("+bram.xp+")";
  });
  t("parity D: skeleton arc + act advancement",function(){
    makeWorld();var d0=__tagDiffCount;
    worldState.skeleton={premise:"x",acts:[
      {title:"Act One",status:"active",parallel:false,arcs:[{title:"First Arc",status:"active"},{title:"Second Arc",status:"pending"}]},
      {title:"Act Two",status:"pending",parallel:true,arcs:[{title:"Left Path",status:"pending"},{title:"Right Path",status:"pending"}]}]};
    applyMuts("[ARC_COMPLETE:First Arc]");
    applyMuts("[ARC_COMPLETE:Second Arc][ACT_COMPLETE:Act One]");
    if(__tagDiffCount!==d0)return (__tagDiffCount-d0)+" shadow diff(s) on skeleton tags — see console";
    var sk=worldState.skeleton;
    if(sk.acts[0].status!=="completed"||sk.acts[1].status!=="active")return "sanity: act advance wrong";
    return (sk.acts[1].arcs[0].status==="active"&&sk.acts[1].arcs[1].status==="active")?true:"sanity: parallel arcs not activated";
  });
  t("ZERO shadow diffs across the ENTIRE suite (every applyMuts above ran the table in parallel)",function(){
    if(typeof __tagParityRuns==="undefined"||__tagParityRuns<20)return "shadow barely ran ("+__tagParityRuns+" runs) — TAG_SHADOW wiring broken?";
    return __tagDiffCount===0?true:__tagDiffCount+" diff(s) across "+__tagParityRuns+" parity runs — see console [tag-shadow] lines";
  });

  section("transcript rescue (UA3)");
  t("corrupt __lz preserves a rescue blob and yields an empty array (no silent loss, no throw)",function(){
    makeWorld();
    var _rk=TRANSCRIPT_RESCUE_K+"c_ua3a";store.del(_rk);
    var o=parseWorldState(JSON.stringify({campId:"c_ua3a",character:{name:"K"},transcript:{__lz:"@@corrupt@@"}}));
    if(!(o.transcript instanceof Array)||o.transcript.length)return "transcript not emptied cleanly";
    var v=store.get(_rk);store.del(_rk);
    return v==="@@corrupt@@"?true:"rescue not written";
  });
  t("LZ absent: {__lz} no longer poisons the transcript as a non-array; rescue preserved",function(){
    var _LZ=LZ;LZ=undefined;
    var _rk=TRANSCRIPT_RESCUE_K+"c_ua3b";store.del(_rk);
    var good=_LZ.compressToUTF16(JSON.stringify([{t:1,r:"gm",x:"old"}]));
    var o=parseWorldState(JSON.stringify({campId:"c_ua3b",transcript:{__lz:good}}));
    LZ=_LZ;
    var v=store.get(_rk);store.del(_rk);
    if(!(o.transcript instanceof Array))return "transcript still a poisoned {__lz} object";
    return v===good?true:"rescue not written";
  });
  t("restoreTranscriptRescue prepends rescued entries before post-loss ones and clears the key",function(){
    makeWorld();worldState.campId="c_ua3c";
    var _rk=TRANSCRIPT_RESCUE_K+"c_ua3c";
    store.set(_rk,LZ.compressToUTF16(JSON.stringify([{t:1,r:"gm",x:"lost one"},{t:2,r:"gm",x:"lost two"}])));
    worldState.transcript=[{t:3,r:"gm",x:"fresh"}];
    if(!restoreTranscriptRescue())return "restore declined";
    if(worldState.transcript.length!==3)return "wrong length "+worldState.transcript.length;
    if(worldState.transcript[0].x!=="lost one"||worldState.transcript[2].x!=="fresh")return "order wrong";
    return store.get(_rk)?"rescue key not cleared":true;
  });
  t("restore overlap-guard: an unharmed stored blob (full duplicate) prepends nothing",function(){
    makeWorld();worldState.campId="c_ua3d";
    var entries=[{t:1,r:"gm",x:"same one"},{t:2,r:"gm",x:"same two"}];
    var _rk=TRANSCRIPT_RESCUE_K+"c_ua3d";
    store.set(_rk,LZ.compressToUTF16(JSON.stringify(entries)));
    worldState.transcript=JSON.parse(JSON.stringify(entries));
    restoreTranscriptRescue();
    return worldState.transcript.length===2?true:"entries duplicated: "+worldState.transcript.length;
  });
  t("an existing rescue is never overwritten by a later failure (oldest = longest record wins)",function(){
    var _rk=TRANSCRIPT_RESCUE_K+"c_ua3e";store.set(_rk,"FIRST");
    parseWorldState(JSON.stringify({campId:"c_ua3e",transcript:{__lz:"@@bad@@"}}));
    var v=store.get(_rk);store.del(_rk);
    return v==="FIRST"?true:"overwritten: "+v;
  });

  section("expended spells named on the sheet (playtest-F1, v1.239)");
  t("player sheet names expended spells; clause absent when none are used",function(){
    makeWorld();
    worldState.character.spells=[{nm:"Charm Person (charmed 1 hour)",lvl:1,used:true},{nm:"Message (whisper 120ft, target replies)",lvl:0,used:false}];
    var v=buildSysPrompt().volatile;
    if(!/Spells EXPENDED[^\n]*Charm Person/.test(v))return "expended clause missing";
    if(!/Spells available:[^\n]*Message/.test(v))return "available list broken";
    worldState.character.spells=[{nm:"Message (whisper 120ft, target replies)",lvl:0,used:false}];
    v=buildSysPrompt().volatile;
    return v.indexOf("Spells EXPENDED")<0?true:"clause present with nothing expended";
  });
  t("bible block leads an expended spell's canon line with the [EXPENDED] marker",function(){
    makeWorld();
    worldState.character.spells=[{nm:"Charm Person (charmed 1 hour)",lvl:1,used:true},{nm:"Message (whisper 120ft, target replies)",lvl:0,used:false}];
    var b=buildSpellBibleBlock();
    if(!/\[EXPENDED[^\]]*\] Charm Person/.test(b))return "marker missing from expended spell's line";
    if(/\[EXPENDED[^\]]*\] Message/.test(b))return "marker leaked onto an unexpended cantrip";
    if(b.indexOf("REFUSE any cast")<0)return "header refusal instruction missing";
    worldState.character.spells[0].used=false;
    return /\[EXPENDED[^\]]*\] Charm Person/.test(buildSpellBibleBlock())?"marker persists after rest":true;
  });
  t("companion sheet names expended spells too",function(){
    makeWorld();
    worldState.npcs.push({name:"Lyra",status:"steady",rel:"ally",partyMember:true,charSheet:{name:"Lyra",cls:"Cleric",level:2,hp:10,maxHp:10,stats:{STR:10,DEX:10,CON:10,INT:10,WIS:14,CHA:10},abilities:[],inventory:[],spells:[{nm:"Cure Wounds (d8+WIS heal)",lvl:1,used:true},{nm:"Bless (allies +d4)",lvl:1,used:false}]}});
    var v=buildSysPrompt().volatile;
    if(!/Spells EXPENDED[^\n]*Cure Wounds/.test(v))return "companion expended clause missing";
    return /Spells available:[^\n]*Bless/.test(v)?true:"companion available list broken";
  });

  section("stable-purity tripwire (UA5)");
  t("mid-campaign stable change warns; identical stable stays quiet; campaign switch resets",function(){
    makeWorld();worldState.campId="c_ua5";
    var warns=[];var _w=console.warn;console.warn=function(m){warns.push(String(m));};
    _stableHash=null;_stableHashCamp=null;_stableWarned=true; // toast path exercised in preview
    _checkStablePurity("STABLE A");
    _checkStablePurity("STABLE A");
    var afterSame=warns.length;
    _checkStablePurity("STABLE B");
    var afterChange=warns.length;
    worldState.campId="c_ua5_other"; // first call on a new campaign must NOT warn
    _checkStablePurity("STABLE C");
    console.warn=_w;
    if(afterSame!==0)return "warned on identical stable";
    if(afterChange!==1)return "no warn on changed stable";
    return warns.length===1?true:"warned across campaign switch";
  });

  section("re-roll marker safety (UA4 pin)");
  t("re-roll's pop-push pattern keeps the sessKept marker valid on both paths",function(){
    makeWorld();
    sessionLog=[{role:"user",content:"a"},{role:"assistant",content:"b"},{role:"user",content:"c"},{role:"assistant",content:"d"}];
    worldState.sessKept=2; // first pair already extracted
    // success path (rerollLast): pop the last exchange, push the swapped pair
    var pa=sessionLog.pop(),pu=sessionLog.pop();
    sessionLog.push({role:"user",content:pu.content},{role:"assistant",content:"re-rolled"});
    if(sessKeptStart()!==2)return "marker invalidated on success path: "+sessKeptStart();
    // failure path: pop, then restore the originals
    pa=sessionLog.pop();pu=sessionLog.pop();sessionLog.push(pu,pa);
    return sessKeptStart()===2?true:"marker invalidated on failure path: "+sessKeptStart();
  });

  section("img2imgStrength (#42)");
  function __rm(id){var i;for(i=0;i<RENDER_MODELS.length;i++){if(RENDER_MODELS[i].id===id)return RENDER_MODELS[i];}return null;}
  t("model default when no override",function(){
    renderStrength={};
    return eq(img2imgStrength(__rm("fal-ai/flux/dev")),0.6);
  });
  t("per-model user override wins",function(){
    renderStrength={"fal-ai/flux/dev":0.35};
    var r=eq(img2imgStrength(__rm("fal-ai/flux/dev")),0.35);
    renderStrength={};return r;
  });
  t("override on one model doesn't leak to another",function(){
    renderStrength={"fal-ai/flux/dev":0.35};
    var r=eq(img2imgStrength(__rm("fal-ai/qwen-image-2512")),0.9);
    renderStrength={};return r;
  });
  t("null for a model with no strength knob (nano-banana edit)",function(){
    renderStrength={};
    return eq(img2imgStrength(__rm("fal-ai/nano-banana-2")),null);
  });
  t("strength flows into the img2img request body",function(){
    var b=__rm("fal-ai/flux/dev").img2img.body("a scene","data:img",0.45);
    return eq(b.strength,0.45);
  });

  // ── UA1 CUTOVER (v1.258): table authoritative, legacy as reverse shadow ──────
  section("tag-authority cutover (UA1)");
  t("authority defaults to TABLE; dispatcher mutates via the table with the reverse shadow armed",function(){
    if(TAG_AUTHORITY!=="table")return "default authority is "+TAG_AUTHORITY;
    makeWorld();var p0=__tagParityRuns,d0=__tagDiffCount;
    applyMuts("[GOLD:+10][HP:-3]");
    if(worldState.character.gold!==35)return "gold not applied: "+worldState.character.gold;
    if(worldState.character.hp!==11)return "hp not applied: "+worldState.character.hp;
    if(__tagParityRuns!==p0+1)return "reverse shadow did not run";
    return __tagDiffCount===d0?true:"reverse shadow DIFFED on a simple burst";
  });
  t("rollback path: TAG_AUTHORITY='legacy' restores the pre-cutover arrangement",function(){
    TAG_AUTHORITY="legacy";
    makeWorld();var p0=__tagParityRuns,d0=__tagDiffCount;
    applyMuts("[GOLD:+10][NPC:Bram|wary|neutral]");
    var ok=worldState.character.gold===35&&worldState.npcs.length===1;
    var parity=(__tagParityRuns===p0+1)&&(__tagDiffCount===d0);
    TAG_AUTHORITY="table";
    if(!ok)return "legacy authority did not mutate";
    return parity?true:"table shadow did not run cleanly under legacy authority";
  });
  t("cutover burst: complex multi-tag response under table authority, zero reverse diffs",function(){
    makeWorld();var d0=__tagDiffCount;
    applyMuts("The fight turns. [COMBAT_START:Wolf|9|12|+2|d6|low][COMBAT_STATS:STR:12|DEX:14|CON:11|INT:3|WIS:12|CHA:6|CR:1]");
    applyMuts("[ENEMY_HP:-9] It drops. [XP:50][ITEM_GAINED:Wolf pelt][QUEST:Hunt|active|kill the wolf][QUEST_STEP:Hunt|Kill the wolf|true][LOCATION:Greyford][CONDITION:Winded|1 hour]");
    if(worldState.combat!==null)return "combat not auto-cleared";
    if(worldState.world.location!=="Greyford")return "location not applied";
    return __tagDiffCount===d0?true:"reverse shadow diffed on the burst";
  });

  // ── UA27 no-combat warn + UA9 currentNodeKey (v1.259) ────────────────────────
  section("UA27 / UA9 (cutover follow-ups)");
  t("UA27: combat tag with NO combat warns loudly and stays a no-op",function(){
    makeWorld();var w0=__tagNoCombatWarns;
    applyMuts("[ENEMY_HP:-5][COMBAT_ROUND:3]");
    if(__tagNoCombatWarns!==w0+2)return "expected 2 warns, got "+(__tagNoCombatWarns-w0);
    if(worldState.combat!==null)return "combat materialized from nothing";
    var w1=__tagNoCombatWarns;
    applyMuts("[COMBAT_START:Wolf|9|12|+2|d6|low][COMBAT_STATS:STR:12|DEX:14|CON:11|INT:3|WIS:12|CHA:6|CR:1][ENEMY_HP:-3]");
    return __tagNoCombatWarns===w1?true:"warned during a LIVE fight (same-response START not honored in order)";
  });
  t("UA9: currentNodeKey — world, sublocation, and no-world shapes",function(){
    makeWorld();
    if(currentNodeKey()!=="Ashfen")return "world key: "+currentNodeKey();
    worldState.world.sublocation="The Flagon";
    if(currentNodeKey()!=="Ashfen|The Flagon")return "subloc key: "+currentNodeKey();
    var sv=worldState;worldState=null;var r=currentNodeKey();worldState=sv;
    return r===null?true:"no-world should be null: "+r;
  });
  t("UA9: LOCATION_SIZE still lands on the keyed node through the helper (parity-guarded)",function(){
    makeWorld();applyMuts("[SUBLOCATION:The Flagon][LOCATION_DESC:A smoky room.][LOCATION_SIZE:small|5]");
    var n=memory.map.nodes["Ashfen|The Flagon"];
    return n&&n.size==="small"&&n.travelMins===5?true:"node: "+JSON.stringify(n);
  });

  // ── UA28: model-conditional reinforce (Haiku nudges) ─────────────────────────
  section("resolveReinforce (UA28)");
  t("Sonnet and Opus resolve to EMPTY — the money-tested prompt is untouched",function(){
    if(resolveReinforce(PROVIDERS.anthropic,"claude-sonnet-4-6")!=="")return "sonnet got a reinforce block";
    return eq(resolveReinforce(PROVIDERS.anthropic,"claude-opus-4-8"),"");
  });
  t("Haiku ids (incl. dated) resolve to the nudge block",function(){
    var a=resolveReinforce(PROVIDERS.anthropic,"claude-haiku-4-5-20251001");
    if(a!==ANTHROPIC_HAIKU_REINFORCE)return "dated haiku id missed";
    return eq(resolveReinforce(PROVIDERS.anthropic,"claude-haiku-4-5"),ANTHROPIC_HAIKU_REINFORCE);
  });
  t("Sonnet stable half is BYTE-IDENTICAL after the reinforce append (cache invariant)",function(){
    makeWorld();var s=buildSysPrompt(),before=s.stable;
    s.stable+=resolveReinforce(PROVIDERS.anthropic,"claude-sonnet-4-6");
    return s.stable===before?true:"stable half changed for Sonnet — every existing campaign's cache would invalidate";
  });
  t("Haiku block lands at the stable TAIL; volatile untouched; STYLE still ends volatile",function(){
    makeWorld();var s=buildSysPrompt(),vol=s.volatile;
    s.stable+=resolveReinforce(PROVIDERS.anthropic,"claude-haiku-4-5-20251001");
    if(s.stable.indexOf("STATE DISCIPLINE")<0)return "block missing from stable";
    if(s.stable.slice(-ANTHROPIC_HAIKU_REINFORCE.length)!==ANTHROPIC_HAIKU_REINFORCE)return "block not at the stable tail";
    if(s.volatile!==vol)return "volatile perturbed";
    return s.volatile.lastIndexOf("STYLE:")>s.volatile.lastIndexOf("REMINDER")?true:"STYLE no longer ends the volatile half";
  });
  t("Haiku block pins all three discipline items (HP, location, spell canon — t361)",function(){
    var b=ANTHROPIC_HAIKU_REINFORCE;
    if(b.indexOf("HP RECOVERY")<0)return "item 1 missing";
    if(b.indexOf("LOCATION")<0)return "item 2 missing";
    return b.indexOf("SPELL CANON")>=0&&/hard physics/.test(b)?true:"item 3 (spell canon) missing";
  });
  t("every provider resolves to a string (function shape breaks nobody)",function(){
    var ks=Object.keys(PROVIDERS),i;
    for(i=0;i<ks.length;i++){if(typeof resolveReinforce(PROVIDERS[ks[i]],PROVIDERS[ks[i]].defaultModel)!=="string")return ks[i]+" resolved to non-string";}
    return eq(resolveReinforce(PROVIDERS.openai,"gpt-4o"),TAG_REINFORCE,"openai keeps TAG_REINFORCE");
  });

  // ── Core Memory (#40): engine-detected defining moments ──────────────────────
  section("Core Memory (#40)");
  function __cmWorld(){makeWorld();worldState.coreMemories=[];worldState.character.maxHp=20;worldState.character.hp=20;}
  function __cmTurn(muts){var pre=coreMemorySnapshot();applyMuts(muts);detectCoreMoments(pre);}
  t("HP crossing below 10% files ONE near-death; hovering low does not re-file",function(){
    __cmWorld();// maxHp 20 → threshold 2
    __cmTurn("[HP:-18]");// 20→2: crossing
    if(worldState.coreMemories.length!==1)return "crossing not filed: "+worldState.coreMemories.length;
    worldState.turn++;__cmTurn("[HP:-1]");// 2→1: already below — hysteresis
    return eq(worldState.coreMemories.length,1,"re-filed while hovering");
  });
  t("exact boundary: pre=threshold does NOT file (was already at/below)",function(){
    __cmWorld();worldState.character.hp=2;// exactly at threshold
    __cmTurn("[HP:-1]");
    return eq(worldState.coreMemories.length,0);
  });
  t("heal above threshold then drop again files a SECOND moment (new turn)",function(){
    __cmWorld();__cmTurn("[HP:-18]");
    worldState.turn++;__cmTurn("[HP:+15]");// back to 17
    worldState.turn++;__cmTurn("[HP:-16]");// 17→1: second crossing
    return eq(worldState.coreMemories.length,2);
  });
  t("same-turn duplicate (same kind+who) files once",function(){
    __cmWorld();
    var pre=coreMemorySnapshot();applyMuts("[HP:-18]");detectCoreMoments(pre);detectCoreMoments(pre);
    return eq(worldState.coreMemories.length,1);
  });
  t("companion HP crossing files with the companion's name",function(){
    __cmWorld();worldState.npcs=[{name:"Lyra",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Lyra",hp:30,maxHp:30}}];
    __cmTurn("[COMPANION_HP:Lyra|-28]");// 30→2, threshold 3
    return worldState.coreMemories.length===1&&worldState.coreMemories[0].who==="Lyra"&&worldState.coreMemories[0].kind==="near-death"?true:JSON.stringify(worldState.coreMemories);
  });
  t("companion join and leave each file a party moment",function(){
    __cmWorld();
    __cmTurn("[NPC:Ekene|wary|guide][PARTY_MEMBER:Ekene|true]");
    if(worldState.coreMemories.length!==1||worldState.coreMemories[0].kind!=="party")return "join not filed: "+JSON.stringify(worldState.coreMemories);
    worldState.turn++;__cmTurn("[PARTY_MEMBER:Ekene|false]");
    return worldState.coreMemories.length===2&&/parted ways/.test(worldState.coreMemories[1].text)?true:"leave not filed: "+JSON.stringify(worldState.coreMemories);
  });
  t("cap-blocked 4th companion does NOT file a false join",function(){
    __cmWorld();worldState.npcs=[{name:"A",status:"ally",rel:"c",partyMember:true},{name:"B",status:"ally",rel:"c",partyMember:true},{name:"C",status:"ally",rel:"c",partyMember:true}];
    __cmTurn("[PARTY_MEMBER:Newbie|true]");// cap forces partyMember=false
    var i;for(i=0;i<worldState.coreMemories.length;i++){if(worldState.coreMemories[i].who==="Newbie")return "false join filed";}
    return true;
  });
  t("party-member death files a death moment",function(){
    __cmWorld();worldState.npcs=[{name:"Bram",status:"ally",rel:"companion",partyMember:true}];
    __cmTurn("[NPC:Bram|dead|companion]");
    return worldState.coreMemories.length===1&&worldState.coreMemories[0].kind==="death"?true:JSON.stringify(worldState.coreMemories);
  });
  t("weighty relationship files; mundane one does not; unchanged weighty does not re-file",function(){
    __cmWorld();
    __cmTurn("[RELATIONSHIP:Morwen|Sworn ally]");
    if(worldState.coreMemories.length!==1)return "weighty not filed";
    worldState.turn++;__cmTurn("[RELATIONSHIP:Barkeep|acquaintance]");
    if(worldState.coreMemories.length!==1)return "mundane filed";
    worldState.turn++;__cmTurn("no tags this turn");
    return eq(worldState.coreMemories.length,1,"unchanged weighty re-filed");
  });
  t("over-cap eviction goes to memory.archive with the oldest near-death first",function(){
    __cmWorld();var i;
    for(i=0;i<CORE_MEMORY_CAP;i++)worldState.coreMemories.push({text:"m"+i,turn:i,kind:i===0?"near-death":"bond",who:"w"+i});
    fileCoreMemory("party","New","New joined the party.");
    if(worldState.coreMemories.length!==CORE_MEMORY_CAP)return "cap not enforced: "+worldState.coreMemories.length;
    if(!memory.archive.coreMemories.length||memory.archive.coreMemories[0].text!=="m0")return "oldest near-death not archived: "+JSON.stringify(memory.archive.coreMemories);
    return worldState.coreMemories[worldState.coreMemories.length-1].who==="New"?true:"new entry lost";
  });
  t("DEFINING MOMENTS injects into the VOLATILE half only",function(){
    __cmWorld();worldState.coreMemories.push({text:"Tess was nearly slain.",turn:3,kind:"near-death",who:"Tess"});
    var s=buildSysPrompt();
    if(s.stable.indexOf("DEFINING MOMENTS")>=0)return "leaked into stable";
    if(s.volatile.indexOf("Tess was nearly slain.")<0)return "missing from volatile";
    return s.volatile.lastIndexOf("STYLE:")>s.volatile.lastIndexOf("DEFINING MOMENTS")?true:"block displaced STYLE from the end";
  });
  t("empty coreMemories renders NOTHING — prompt byte-identical to a pre-#40 save",function(){
    makeWorld();delete worldState.coreMemories;// pre-#40 save shape
    var a=buildSysPrompt();
    worldState.coreMemories=[];// post-migration shape, still empty
    var b=buildSysPrompt();
    return a.stable===b.stable&&a.volatile===b.volatile?true:"empty list changed the prompt";
  });
  t("migrateWorldState adds coreMemories:[] and is idempotent",function(){
    makeWorld();delete worldState.coreMemories;
    if(!migrateWorldState())return "migration reported no change";
    if(!(worldState.coreMemories instanceof Array))return "field not added";
    worldState.coreMemories.push({text:"x",turn:1,kind:"bond",who:"y"});
    migrateWorldState();
    return eq(worldState.coreMemories.length,1,"second migrate clobbered data");
  });

  // ── Suggestion grounding (UA38 ②③ + UA39 ①) ─────────────────────────────────
  section("suggestion grounding (UA38/UA39)");
  t("spell list carries canon limits — Message annotated with its 120ft range (the t355 class)",function(){
    makeWorld();worldState.character.spells=[{nm:"Message",lvl:0,used:false}];
    var sp=suggestionSpellList(worldState.character);
    return /^Message \(range 120/.test(sp[0])?true:"no canon annotation: "+JSON.stringify(sp);
  });
  t("used spells excluded; racial parenthetical stripped before lookup",function(){
    makeWorld();// Faerie Fire (racial, 1/day) unused + a spent slot
    worldState.character.spells.push({nm:"Charm Person",lvl:1,used:true});
    var sp=suggestionSpellList(worldState.character);
    if(sp.length!==1)return "used spell leaked: "+JSON.stringify(sp);
    return sp[0].indexOf("Faerie Fire")===0&&sp[0].indexOf("(racial")<0?true:"parenthetical not stripped: "+sp[0];
  });
  t("unknown spell (no bible canon) stays a bare name",function(){
    makeWorld();worldState.character.spells=[{nm:"Homebrew Zap",lvl:1,used:false}];
    return eq(suggestionSpellList(worldState.character)[0],"Homebrew Zap");
  });
  t("geo line serves the sublocation node's desc over the world node's",function(){
    makeWorld();
    memory.map.nodes["Ashfen"]={description:"A grey town."};
    memory.map.nodes["Ashfen|The Flagon"]={description:"A smoky common room with one door to the street."};
    worldState.world.sublocation="The Flagon";
    if(suggestionGeoLine().indexOf("smoky common room")<0)return "subloc desc not served";
    worldState.world.sublocation=null;
    if(suggestionGeoLine().indexOf("grey town")<0)return "world desc not served";
    memory.map.nodes={};
    return eq(suggestionGeoLine(),"","no-desc should be empty");
  });
  t("upgradeModelFor: escalates per provider, honors the toggle (UA39 t371)",function(){
    var savedUp=allowModelUpgrade,savedProv=activeProvider;
    allowModelUpgrade=true;activeProvider="anthropic";
    if(upgradeModelFor()!=="claude-sonnet-4-6")return "anthropic escalation wrong: "+upgradeModelFor();
    activeProvider="openai";
    if(upgradeModelFor()!==PROVIDERS.openai.upgradeModel)return "provider-specific upgrade not used";
    allowModelUpgrade=false;
    var off=upgradeModelFor();
    allowModelUpgrade=savedUp;activeProvider=savedProv;
    return off===null?true:"toggle OFF still escalated: "+off;
  });
  t("scene slice keeps the TAIL — the ending survives an over-length message (UA38 ③)",function(){
    var head="THE-BEGINNING ",body=new Array(3000).join("x"),tail=" THE-ENDING";
    var out=suggestionSceneTail(head+body+tail);
    if(out.length!==2400)return "wrong length: "+out.length;
    if(out.indexOf("THE-ENDING")<0)return "ending lost — still head-slicing";
    return out.indexOf("THE-BEGINNING")<0?true:"beginning retained on an over-length message?";
  });

  // ── Per-turn model attribution (#45) ─────────────────────────────────────────
  section("model stamp (#45)");
  t("GM entry stamped with the turn's model; player entry never stamped",function(){
    makeWorld();_lastTurnModel="claude-haiku-4-5-20251001";
    logTranscript("player","I open the door.");
    logTranscript("gm","The door opens.","The door opens.");
    var tr=worldState.transcript;
    if(tr[0].m)return "player entry stamped";
    if(tr[1].m!=="claude-haiku-4-5-20251001")return "gm entry not stamped: "+JSON.stringify(tr[1]);
    _lastTurnModel=null;return true;
  });
  t("no model known (pre-turn / old session) → entry shape identical to pre-#45",function(){
    makeWorld();_lastTurnModel=null;
    logTranscript("gm","A scene.","A scene.");
    return "m" in worldState.transcript[0]?"m present when unknown":true;
  });
  t("RETCON marking still lands on stamped entries",function(){
    makeWorld();_lastTurnModel="claude-sonnet-4-6";
    logTranscript("gm","Wrong version.","Wrong version.");
    logTranscript("gm","Corrected. [RETCON:fixed]","Corrected. [RETCON:fixed]");
    var tr=worldState.transcript;
    _lastTurnModel=null;
    return tr[0].rc===1&&tr[1].rc===1&&tr[1].m==="claude-sonnet-4-6"?true:"rc/m interaction broke: "+JSON.stringify(tr);
  });
  t("model stamp survives the LZ serialize/parse round-trip",function(){
    makeWorld();_lastTurnModel="claude-haiku-4-5-20251001";
    logTranscript("gm","Stamped scene.","Stamped scene.");
    _lastTurnModel=null;
    var back=parseWorldState(serializeWorldState(worldState));
    return back.transcript[0].m==="claude-haiku-4-5-20251001"?true:"stamp lost in round-trip";
  });
  t("#45b: gm entries carry the engine version; player entries don't",function(){
    makeWorld();
    logTranscript("player","I look around.");
    logTranscript("gm","You see things.","You see things.");
    var tr=worldState.transcript;
    if(tr[0].v)return "player entry versioned";
    return tr[1].v===APP_VERSION?true:"gm entry version wrong: "+tr[1].v;
  });

  // ── Condition turn-stamps + injection (#46 Phase A) ──────────────────────────
  section("condition stamps (#46)");
  function __cnTurn(muts){var pre=conditionSnapshot();applyMuts(muts);stampNewConditions(pre);}
  t("new condition gets the turn stamp",function(){
    makeWorld();worldState.turn=42;
    __cnTurn("[CONDITION:Poisoned|CON save each hour]");
    return eq(worldState.character.conditions[0].turn,42);
  });
  t("duration update does NOT re-stamp — the onset turn survives",function(){
    makeWorld();worldState.turn=42;
    __cnTurn("[CONDITION:Poisoned|1 hour]");
    worldState.turn=50;__cnTurn("[CONDITION:Poisoned|until antidote]");
    var cd=worldState.character.conditions[0];
    return cd.duration==="until antidote"&&cd.turn===42?true:"onset lost: "+JSON.stringify(cd);
  });
  t("removed then re-applied gets a FRESH stamp",function(){
    makeWorld();worldState.turn=42;
    __cnTurn("[CONDITION:Bleeding|until bandaged]");
    worldState.turn=44;__cnTurn("[CONDITION_REMOVED:Bleeding]");
    worldState.turn=48;__cnTurn("[CONDITION:Bleeding|until bandaged]");
    return eq(worldState.character.conditions[0].turn,48);
  });
  t("companion condition stamped via the party snapshot (the Daeris class)",function(){
    makeWorld();worldState.turn=155;
    worldState.npcs=[{name:"Daeris",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Daeris",hp:38,maxHp:38,conditions:[]}}];
    __cnTurn("[COMPANION_CONDITION:Daeris|Unconscious|until awakened]");
    return eq(worldState.npcs[0].charSheet.conditions[0].turn,155);
  });
  t("condition add and removal both TOAST (v1.256 — the Daeris 'no toast' note)",function(){
    makeWorld();worldState.turn=42;__toasts.length=0;
    worldState.npcs=[{name:"Daeris",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Daeris",hp:38,maxHp:38,conditions:[{name:"Unconscious",duration:"until awakened"}]}}];
    __cnTurn("[CONDITION:Bloodied Nose|until treated][COMPANION_CONDITION_REMOVED:Daeris|Unconscious]");
    var all=__toasts.join(" | ");
    if(all.indexOf("Condition: Tess — Bloodied Nose")<0)return "add toast missing: "+all;
    if(all.indexOf("Condition lifted: Daeris — Unconscious")<0)return "removal toast missing: "+all;
    __toasts.length=0;
    __cnTurn("no tags this turn");
    return __toasts.length===0?true:"toasted with no change: "+__toasts.join(" | ");
  });
  t("player condStr injects age + cleanup instruction; legacy unstamped renders plain",function(){
    makeWorld();
    worldState.character.conditions=[{name:"Unconscious",duration:"until awakened",turn:155},{name:"Old Curse",duration:"lingering"}];
    var v=buildSysPrompt().volatile;
    if(v.indexOf("Unconscious (until awakened; since t155)")<0)return "age missing from injection";
    if(v.indexOf("Old Curse (lingering)")<0)return "legacy condition mangled: no plain render";
    return v.indexOf("emit [CONDITION_REMOVED:name] NOW")>=0?true:"cleanup instruction missing";
  });
  t("party sheet injects companion conditions with age + REMOVED instruction in the header",function(){
    makeWorld();
    worldState.npcs=[{name:"Daeris",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Daeris",cls:"Cleric",level:7,hp:38,maxHp:38,conditions:[{name:"Unconscious",duration:"until awakened",turn:155}]}}];
    var v=buildSysPrompt().volatile;
    if(v.indexOf("Conditions: Unconscious (until awakened; since t155)")<0)return "companion conditions still invisible";
    return v.indexOf("[COMPANION_CONDITION_REMOVED:Name|condition] NOW")>=0?true:"header instruction missing";
  });
  // ── Condition audit + engine-notes registry (#46 teeth, v1.255) ──────────────
  section("condition audit / buildEngineNotes");
  t("audit fires on an old stamped condition, lists player+companion with correct REMOVED forms",function(){
    makeWorld();worldState.turn=200;
    worldState.character.conditions=[{name:"Bloodied Nose",duration:"until treated",turn:150}];
    worldState.npcs=[{name:"Daeris",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Daeris",conditions:[{name:"Unconscious",duration:"until awakened"}]}}];
    var n=buildConditionAudit();
    if(n.indexOf("Bloodied Nose")<0||n.indexOf("50 turns ago")<0)return "player line wrong: "+n;
    if(n.indexOf("long-standing, onset unknown")<0)return "legacy unstamped line wrong";
    if(n.indexOf("COMPANION_CONDITION_REMOVED:Daeris|Unconscious")<0)return "companion REMOVED form missing";
    return n.indexOf("CONDITION_REMOVED:Bloodied Nose")>=0?true:"player REMOVED form missing";
  });
  t("no fire when all conditions are young; no fire mid-combat; cooldown suppresses re-fire",function(){
    makeWorld();worldState.turn=200;
    worldState.character.conditions=[{name:"Winded",duration:"brief",turn:195}];
    if(buildConditionAudit()!=="")return "fired on a 5-turn-old condition";
    worldState.character.conditions=[{name:"Cursed",duration:"until lifted",turn:100}];
    worldState.combat={name:"Wolf",hp:9,maxHp:9,ac:12,atk:2,dmg:"d6",morale:"low",round:1};
    if(buildConditionAudit()!=="")return "fired mid-combat";
    worldState.combat=null;
    if(buildConditionAudit()==="")return "did not fire when due";
    if(buildConditionAudit()!=="")return "cooldown ignored — re-fired immediately";
    worldState.turn+=CONDITION_AUDIT_COOLDOWN;
    return buildConditionAudit()!==""?true:"did not re-fire after the cooldown window";
  });
  t("buildEngineNotes composes quest escalation + condition audit, quest first",function(){
    makeWorld();worldState.turn=200;
    worldState.questLog=[{title:"Stuck Quest",status:"active",desc:"",objectives:[{text:"a",done:true}],allDoneSince:190}];
    worldState.character.conditions=[{name:"Cursed",duration:"until lifted",turn:100}];
    var n=buildEngineNotes();
    if(n.indexOf("Stuck Quest")<0)return "quest note missing";
    if(n.indexOf("CONDITION AUDIT")<0)return "condition note missing";
    return n.indexOf("Stuck Quest")<n.indexOf("CONDITION AUDIT")?true:"registry order wrong";
  });
  t("buildEngineNotes empty when nothing fires (the common turn)",function(){
    makeWorld();worldState.turn=200;
    return eq(buildEngineNotes(),"");
  });
  t("v1.257: 'N turns/rounds' durations schedule until; free-text durations don't",function(){
    makeWorld();worldState.turn=100;
    __cnTurn("[CONDITION:Stunned|3 rounds][CONDITION:Cursed|until lifted][CONDITION:Slowed|stunned for 2 turns]");
    var c=worldState.character.conditions;
    if(c[0].until!==103)return "3 rounds → "+c[0].until;
    if("until" in c[1])return "free text scheduled: "+c[1].until;
    return c[2].until===102?true:"2 turns → "+c[2].until;
  });
  t("v1.257: the staggered scenario — Frizwick +3, Ammut +5; neither appointment lost",function(){
    makeWorld();worldState.turn=100;worldState.lastConditionAudit=100;/* cooldown ACTIVE — expiry must fire through it */
    worldState.npcs=[
      {name:"Frizwick",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Frizwick",conditions:[{name:"Stunned",duration:"3 rounds",turn:100,until:103}]}},
      {name:"Ammut2",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Ammut2",conditions:[{name:"Stunned",duration:"5 rounds",turn:100,until:105}]}}];
    worldState.turn=103;
    var n1=buildConditionAudit();
    if(n1.indexOf("Frizwick")<0||n1.indexOf("DECLARED DURATION HAS NOW ELAPSED")<0)return "t103 did not flag Frizwick: "+n1;
    if(n1.indexOf("Ammut2: Stunned")>=0&&n1.indexOf("Ammut2: Stunned (5 rounds) — its DECLARED")>=0)return "Ammut flagged expired 2 turns early";
    worldState.npcs[0].charSheet.conditions=[];/* GM unstuns Frizwick */
    worldState.turn=104;
    if(buildConditionAudit()!=="")return "t104 fired with nothing due (Ammut's appointment leaked early?)";
    worldState.turn=105;
    var n2=buildConditionAudit();
    return n2.indexOf("Ammut2")>=0&&n2.indexOf("ELAPSED")>=0?true:"t105 lost Ammut's appointment: "+n2;
  });
  t("v1.257: expiry fires mid-combat; consumed appointment doesn't re-fire next turn",function(){
    makeWorld();worldState.turn=100;
    worldState.character.conditions=[{name:"Stunned",duration:"2 rounds",turn:100,until:102}];
    worldState.combat={name:"Wolf",hp:9,maxHp:9,ac:12,atk:2,dmg:"d6",morale:"low",round:1};
    worldState.turn=102;
    if(buildConditionAudit()==="")return "expiry silent mid-combat";
    if("until" in worldState.character.conditions[0])return "appointment not consumed";
    worldState.turn=103;
    return buildConditionAudit()===""?true:"re-fired every turn on a kept condition";
  });
  t("v1.257: early organic removal takes its appointment with it (no phantom audit)",function(){
    makeWorld();worldState.turn=100;
    worldState.character.conditions=[{name:"Stunned",duration:"3 rounds",turn:100,until:103}];
    __cnTurn("[CONDITION_REMOVED:Stunned]");/* GM clears it at 101, organically */
    worldState.turn=103;
    return buildConditionAudit()===""?true:"phantom audit for a removed condition";
  });
  t("v1.257: injection shows the remaining clock (expires ~tN)",function(){
    makeWorld();
    worldState.character.conditions=[{name:"Stunned",duration:"3 rounds",turn:100,until:103}];
    var v=buildSysPrompt().volatile;
    return v.indexOf("Stunned (3 rounds; since t100; expires ~t103)")>=0?true:"clock missing from injection";
  });
  t("#47: migration adds aliases[] to player AND companion sheets, idempotent",function(){
    makeWorld();delete worldState.character.aliases;
    worldState.npcs=[{name:"Daeris",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Daeris",hp:38,maxHp:38}}];
    if(!migrateWorldState())return "migration reported no change";
    if(!(worldState.character.aliases instanceof Array))return "player aliases not added";
    if(!(worldState.npcs[0].charSheet.aliases instanceof Array))return "companion sheet aliases not added";
    worldState.character.aliases.push("Butcher of Ashfen");
    migrateWorldState();
    return eq(worldState.character.aliases.length,1,"second migrate clobbered epithets");
  });
  t("condition-less party sheet adds NO Conditions line; stable half untouched by #46",function(){
    makeWorld();
    worldState.npcs=[{name:"Bram",status:"ally",rel:"companion",partyMember:true,charSheet:{name:"Bram",cls:"Warrior",level:3,hp:20,maxHp:20,conditions:[]}}];
    var s=buildSysPrompt();
    if(s.volatile.indexOf("Bram")<0)return "party sheet missing";
    if(/Bram[\s\S]{0,400}?Conditions:/.test(s.volatile.slice(s.volatile.indexOf("PARTY MEMBER"))))return "empty Conditions line rendered";
    return s.stable.indexOf("since t")<0?true:"#46 leaked into the stable half";
  });
}
