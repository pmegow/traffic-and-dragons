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
}
