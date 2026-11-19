var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
try{L.makeTestWorld();}catch(e){console.log("makeTestWorld err",e.message);}
var g=global;
function show(label,v){console.log("== "+label+": "+(typeof v==="string"?v:JSON.stringify(v)));}
var XSS='<img src=x onerror=alert(1)>';

// 1. parseCheckTag with no modifier, DC in the modifier seat
show("parseCheckTag label|DC 14",g.parseCheckTag("Stealth|DC 14"));
show("resolveCheck roll 1 vs that",g.resolveCheck(g.parseCheckTag("Stealth|DC 14"),1).note.slice(0,140));
show("parseCheckTag label|+3 (STR +1, prof +2)|DC 12",g.parseCheckTag("Attack|+3 (STR +1, prof +2)|DC 12"));
show("parseCheckTag label|-1d4|DC 12",g.parseCheckTag("Attack|-1d4|DC 12"));
show("parseCheckTag label|+5 vs DC 15",g.parseCheckTag("Attack|+5 vs DC 15"));
show("parseCheckTag label|DC 14|stake",g.parseCheckTag("Climb|DC 14|you fall into the pit"));

// 2. escapers / renderers
show("rollModalHtml xss",g.rollModalHtml({label:XSS,mod:2,dc:10,stake:XSS,dmg:{text:XSS}}).indexOf("<img")>=0);
show("bibleCardHTML tier",g.bibleCardHTML("x",{kind:"spell",tier:XSS,effect:"e"}).indexOf("<img")>=0);
show("bibleCardHTML category string",g.bibleCardHTML("x",{kind:"spell",tier:1,category:"arcane"}).match(/arcane|>a</g));
show("agendaSheetHtml since",g.agendaSheetHtml({agenda:{want:"w",kind:"peaceful",since:XSS},agendaHistory:[{want:"h",done:XSS}]}).split("<img").length-1);
show("accountDoorsHtml provider",g.accountDoorsHtml({providers:[XSS]}).indexOf("<img")>=0);
show("synopsisBlockHtml turn",g.synopsisBlockHtml({turn:5,about:"a"},[{label:"",status:"",items:[{turn:XSS,from:XSS,text:"t",era:true}],arcs:[]}],[],9).indexOf("<img")>=0);
show("consoleRowsHtml",g.consoleRowsHtml([{at:Date.now(),turn:3,msg:XSS}],0).indexOf("<img")>=0);
show("summaryLineHTML",g.summaryLineHTML(["Present: "+XSS,XSS]).indexOf("<img")>=0);
show("racialCapsHtml",g.racialCapsHtml([{cap:'a" onmouseover="alert(1)',use:"1/day"}]));
show("itemCardHTML",g.itemCardHTML(XSS,null).indexOf("<img")>=0);
show("skillCardHTML",g.skillCardHTML({id:XSS,label:XSS,cat:XSS,stats:[XSS]},{def:XSS}).indexOf("<img")>=0);
show("vitalSpanHtml",g.vitalSpanHtml("hp",XSS,10,"HP").indexOf("<img")>=0);
show("escHtml(0)",JSON.stringify(g.escHtml(0)));
show("escProse",g.escProse(XSS+" *x* \n\n y"));
show("safeImgSrc js",g.safeImgSrc("javascript:alert(1)"));
show("safeImgSrc data svg",g.safeImgSrc("data:image/svg+xml;base64,PHN2Zz4="));
show("safeImgSrc https quote",g.safeImgSrc("https://a/x' onerror='y"));
show("safeImgSrc https amp",g.safeImgSrc("https://a/x?a=1&b=2"));
show("safeImgSrc blob",g.safeImgSrc("blob:https://a/1"));
show("safeImgSrc https uppercase",g.safeImgSrc("HTTPS://a/x"));
show("foeLabel",g.foeLabel({name:XSS,count:3}));
show("formView",g.formView({portrait:"javascript:x",desc:XSS},"true"));
show("worldStateNpcRows toString",g.worldStateNpcRows([{name:"toString",status:"ok",met:1},{name:"__proto__",status:"x",met:1}],g.keyedDict(),{}));
show("worldStateNpcRows memNpcs plain",g.worldStateNpcRows([{name:"constructor"}],{},{}));
// elapsedTicker
var tk=g.elapsedTicker({innerHTML:"",isConnected:true},XSS);
show("elapsedTicker base html",tk&&"(see below)");
var el={innerHTML:"",isConnected:true};var tk2=g.elapsedTicker(el,XSS);show("ticker innerHTML",el.innerHTML);tk2.stop();tk.stop();
