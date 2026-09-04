var sabotage=require("./sabotage.js"),rc=0;
var command=["node",["dev/run-tests.js","#333 — act-gated NPC secrets"]];
var also=["blueprint-designer.html","samples/the_iron_meridian.blueprint"];
rc|=sabotage.prove({file:"memory.js",command:command,also:also,cases:[
  {label:"pending act leaks its secret",mustFail:"secret is withheld before the act opens",find:'a.status==="active"||a.status==="completed"',replace:'true'},
  {label:"active act never releases its secret",mustFail:"active and completed reveal acts unlock",find:'out.push(s.text);',replace:'void 0;'},
  {label:"export discards the closed secret",mustFail:"closed secrets survive blueprint export",find:'return texts.length?{secret:texts.join("\\n"),revealAct:bad?null:gate}:null;',replace:'return null;'},
  {label:"export advances a merged secret gate",mustFail:"merge retains each secret's independent act gate",find:'gate=Math.max(gate,s.revealAct)',replace:'gate=Math.min(gate||s.revealAct,s.revealAct)'}
]});
rc|=sabotage.prove({file:"game.js",command:command,also:also,cases:[
  {label:"validation admits malformed revealAct",mustFail:"invalid reveal gates are refused",find:'typeof ns.secret!=="string"||!validRevealAct(ns.revealAct,bp.acts)',replace:'false'},
  {label:"secret-only seed lost",mustFail:"secret-only NPC seeds",find:'if(_seed.secret){fileNpcSecret',replace:'if(_seed.secret&&_seed.notes){fileNpcSecret'}
]});
rc|=sabotage.prove({file:"tag_table.js",command:command,also:also,cases:[
  {label:"identity merge drops gated secrets",mustFail:"merge retains each secret's independent act gate",find:'fileNpcSecret(memory.npcs[mgCanon],_mgS.text,_mgS.revealAct);',replace:'void 0;'}
]});
rc|=sabotage.prove({file:"blueprint-designer.html",command:command,also:also,cases:[
  {label:"designer reveal input remains a string",mustFail:"#333 reveal-act editing must produce a number",find:'o[k]=/^\\d+$/.test(String(v).trim())?Number(v):v;',replace:'o[k]=v;'},
  {label:"designer secret input disappears",mustFail:"#333 designer secret fields: missing secret control",find:/"npc",i,0,"secret"/g,replace:'"npc",i,0,"ignoredSecret"'}
]});
process.exit(rc?1:0);
