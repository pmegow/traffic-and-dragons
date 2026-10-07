// #528: a green helper test is insufficient if the caller silently stops using the gate.
const sabotage=require('./sabotage.js');let failed=0;const command=['node',['dev/tests-528-portrait-boundaries.js']];
for(const [file,cases] of [
 ['state.js',[{label:'save import skips portrait sanitization',find:'if(data&&data.worldState&&typeof portraitsSanitizeWorld==="function"){',replace:'if(false){',mustFail:'save import: crafted portrait crossed the boundary'}]],
 ['helpers.js',[
  {label:'save hero bypasses the gate',find:'n+=portraitAdmit(ws.character,"save");',replace:'',mustFail:'save import: crafted portrait crossed the boundary'},
  {label:'save NPC wrapper bypasses the gate',find:'n+=portraitAdmit(np[i],"save");',replace:'',mustFail:'save import: crafted portrait crossed the boundary'},
  {label:'save NPC sheet bypasses the gate',find:'n+=portraitAdmit(np[i]&&np[i].charSheet,"save");',replace:'',mustFail:'save import: crafted portrait crossed the boundary'}]],
 ['game.js',[
  {label:'hero library adoption skips the gate',find:'portraitAdmit(hero,"library")',replace:'0',mustFail:'hero library adoption: crafted portrait crossed the boundary'},
  {label:'companion library adoption skips the gate',find:'portraitAdmit(sheet,"library")',replace:'0',mustFail:'companion library adoption: crafted portrait crossed the boundary'}]],
 ['ui-browsers.js',[
  {label:'character import skips the gate',find:'portraitAdmit(char,"character import")',replace:'0',mustFail:'character preview: crafted portrait crossed the boundary'},
  {label:'quick start skips the gate',find:'portraitAdmit(char,"quick start")',replace:'0',mustFail:'quick start: crafted portrait crossed the boundary'}]]
])failed+=sabotage.prove({file,command,cases});process.exitCode=failed?1:0;
