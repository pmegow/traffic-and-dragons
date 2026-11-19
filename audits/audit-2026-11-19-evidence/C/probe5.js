var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();try{L.makeTestWorld();}catch(e){}
var g=global;
var cs={name:"Bram"};
g.agendaFile(cs,"Find his brother","peaceful","gm",1);
for(var i=0;i<50;i++)g.agendaFile(cs,"Avenge the mill","violent","gm",2+i);
console.log("agenda active:",cs.agenda.want,"| queue length after the same want filed 50 times:",cs.agendaQueue.length);
console.log("sheet html rows:",(g.agendaSheetHtml(cs).match(/cs-list-row/g)||[]).length);
process.exit(0);
