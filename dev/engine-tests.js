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
      npcs:[],questLog:[],eventHistory:[],combat:null,turn:5,transcript:[]};
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
  t("inventory stacking: case+plural stack to x2",function(){var inv=["Travel ration"];addInventoryItem(inv,"travel rations");return eq(inv.length,1)===true?eq(inv[0],"Travel ration x2"):"did not stack: "+JSON.stringify(inv);});
  t("inventory stacking: parenthetical qualifiers stay separate",function(){var inv=["Sword (rusty)"];addInventoryItem(inv,"Sword (enchanted)");return eq(inv.length,2);});
  t("inventory removal: decrements and drops suffix at 1",function(){var inv=["Arrow x2"];removeInventoryItem(inv,"Arrow");if(inv[0]!=="Arrow")return "want bare Arrow got "+inv[0];removeInventoryItem(inv,"arrow");return eq(inv.length,0);});

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
    var raw="The blade falls. [HP:-3][GOLD:-5 gp][ITEM_GAINED:Rope][XP:+25][NPC:Bram|wary|ally][QUEST:Test|offered|desc][QUEST_STEP:Test|obj|false][COMBAT_START:Wolf|9|12|+2|d6|low][ENEMY_HP:-4][COMBAT_END:victory][CONDITION:Bleeding|1 hour][RELATIONSHIP:Bram|Ally][SAVE_MOD:Ward|Fear|2][LANGUAGE:Elvish|broken][STORY_BEAT:It begins][FUTURE_EVENT:doom|soon][FUTURE_EVENT_RESOLVED:doom][NPC_PRONOUN:Bram|he/him][NPC_ALIAS:Bram|The Quiet][SUBLOCATION_LEAVE][COMPANION_HP:Lyra|-2][ACTIONS:a|b|c][SKILL_SUCCESS:Climbing][LOCATION_DESC:A dark room][ARC_COMPLETE:First Blood] You survive.";
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
  t("active quest: QUEST_STEP adds + completes objectives",function(){makeWorld();applyMuts("[QUEST:Hunt|active|kill the wolf][QUEST_STEP:Hunt|Track the wolf|false]");applyMuts("[QUEST_STEP:Hunt|Track the wolf|true]");var o=worldState.questLog[0].objectives;return eq(o.length,1)===true?(o[0].done===true?true:"not done"):"objs: "+o.length;});
  t("quest status 'complete' normalizes and archives",function(){makeWorld();applyMuts("[QUEST:Hunt|active|d]");applyMuts("[QUEST:Hunt|complete]");return eq(worldState.questLog.length,0,"live log")===true?(memory.quests["Hunt"]&&memory.quests["Hunt"].status==="completed"?true:"archive: "+JSON.stringify(memory.quests)):"still live";});
  t("combat auto-clears at 0 enemy HP (v1.140 net)",function(){makeWorld();applyMuts("[COMBAT_START:Wolf|9|12|+2|d6|low]");applyMuts("[ENEMY_HP:-9]");return eq(worldState.combat,null);});
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

  // ── 10. RAG episodic memory (#27 Phase 1 — RAG_MEMORY.md) ────────────────────
  section("RAG episodic memory");
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
    delete worldState.ragMemory;sessionLog=[];
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
    delete worldState.ragMemory;sessionLog=[];
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
    delete worldState.ragMemory;
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
    delete worldState.ragMemory;
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
    delete worldState.ragMemory;
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
    delete worldState.ragMemory;
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
  t("TOC diet: flag-off output is byte-identical after a round trip",function(){
    makeWorld();lastAction="";
    for(var li=0;li<20;li++)memory.lore.push("Fact number "+li+" about distant Elsewhere");
    memory.lore.push("Ashfen was built on a barrow");
    memory.chapters.push({turn:1,summary:"Chapter one happened."});
    var off1=memoryTOC();
    worldState.ragMemory=true;var on=memoryTOC();
    delete worldState.ragMemory;var off2=memoryTOC();
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
    delete worldState.ragMemory;
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
    delete worldState.ragMemory;lastAction=null;
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
}
