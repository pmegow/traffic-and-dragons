var sabotage=require("./sabotage.js"),rc=0;
rc|=sabotage.prove({file:"game.js",command:["node",["dev/run-tests.js","#332 — authored NPC dossiers"]],cases:[
  {label:"seed loses authored provenance",mustFail:"blueprint dossier has authored provenance",find:'fileNpcAuthored(_am,_am.knowledge[0]);',replace:'void 0;'},
  {label:"repair accepts an unrelated archived fact",mustFail:"repair requires matching blueprint evidence",find:'candidates.indexOf(archive[j].fact)>=0',replace:'true'}
]});
rc|=sabotage.prove({file:"memory.js",command:["node",["dev/run-tests.js","#332 — authored NPC dossiers"]],cases:[
  {label:"summary loses the new play fact when preserving dossier",mustFail:"summary supersession retains authored original and adds the play fact",find:'fileNpcKnowledge(sfName,String(sf["new"]),worldState.turn,true);',replace:'void 0;'},
  {label:"authored detail projection disappears",mustFail:"authored guidance is prompt-visible",find:'var _auth=npcAuthoredText(n);',replace:'var _auth="";'},
  {label:"repair duplicates an already filed original",mustFail:"repair requires matching blueprint evidence",find:'if(n.authored[i].source==="blueprint"&&n.authored[i].text===text)return false;',replace:'if(false)return false;'}
]});
rc|=sabotage.prove({file:"tag_table.js",command:["node",["dev/run-tests.js","#332 — authored NPC dossiers"]],cases:[
  {label:"merge drops duplicate authored source",mustFail:"merge preserves both authored sources",find:'fileNpcAuthored(memory.npcs[mgCanon],_mgAuth[_mgAi].text);',replace:'void 0;'}
]});
process.exit(rc?1:0);
