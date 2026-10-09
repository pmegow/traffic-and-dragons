// #528: a green helper test is insufficient if the caller silently stops using the gate.
const sabotage=require('./sabotage.js');let failed=0;const command=['node',['dev/tests-528-portrait-boundaries.js']];
for(const [file,cases] of [
 ['state.js',[{label:'save import skips portrait sanitization',find:'if(data&&data.worldState&&typeof portraitsSanitizeWorld==="function"){',replace:'if(false){',mustFail:'save import: crafted portrait crossed the boundary'}]],
 ['helpers.js',[
  {label:'save hero bypasses the gate',find:'n+=portraitAdmit(ws.character,"save");',replace:'',mustFail:'save import: crafted portrait crossed the boundary'},
  {label:'save NPC wrapper bypasses the gate',find:'n+=portraitAdmit(np[i],"save");',replace:'',mustFail:'save import: crafted portrait crossed the boundary'},
  {label:'save NPC sheet bypasses the gate',find:'n+=portraitAdmit(np[i]&&np[i].charSheet,"save");',replace:'',mustFail:'save import: crafted portrait crossed the boundary'}]],
 ['admission.js',[/* #599 (b): the four doors run the registry's portrait entry; each mutation lets ONE door's context past it */
  {label:'hero library adoption skips the gate',find:'{name:"portrait",phase:"prepare",applies:function(){return true;},',replace:'{name:"portrait",phase:"prepare",applies:function(ctx){return ctx.door!=="library hero";},',mustFail:'hero library adoption: crafted portrait crossed the boundary'},
  {label:'companion library adoption skips the gate',find:'{name:"portrait",phase:"prepare",applies:function(){return true;},',replace:'{name:"portrait",phase:"prepare",applies:function(ctx){return ctx.door.indexOf("library companion")!==0;},',mustFail:'companion library adoption: crafted portrait crossed the boundary'},
  {label:'character import skips the gate',find:'{name:"portrait",phase:"prepare",applies:function(){return true;},',replace:'{name:"portrait",phase:"prepare",applies:function(ctx){return ctx.door!=="character import";},',mustFail:'character preview: crafted portrait crossed the boundary'},
  {label:'quick start skips the gate',find:'{name:"portrait",phase:"prepare",applies:function(){return true;},',replace:'{name:"portrait",phase:"prepare",applies:function(ctx){return ctx.door!=="quick start";},',mustFail:'quick start: crafted portrait crossed the boundary'}]]
])failed+=sabotage.prove({file,command,cases});process.exitCode=failed?1:0;
