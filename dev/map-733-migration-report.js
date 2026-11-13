// Read-only legacy map inventory. Text overlaps are review leads, never discovery receipts.
// node dev/map-733-migration-report.js <save.tnd> [--library-ref <trusted git revision>]
// No campaign import, state migration, promotion, storage write or network request is performed.
"use strict";
const fs=require("fs"),path=require("path"),crypto=require("crypto"),cp=require("child_process"),vm=require("vm");
const ROOT=path.join(__dirname,".."),args=process.argv.slice(2),refAt=args.indexOf("--library-ref");
if(!args[0]||args[0].startsWith("--")){console.error("Usage: node dev/map-733-migration-report.js <save.tnd> [--library-ref <trusted git revision>]");process.exit(1);}
const source=path.resolve(args[0]),bytes=fs.readFileSync(source),hash=b=>crypto.createHash("sha256").update(b).digest("hex"),before=hash(bytes),data=JSON.parse(bytes.toString("utf8"));
const ws=data.worldState,mem=data.memory,A=ws&&ws.atlas;
if(!A||!A.zones||!mem||!mem.map)throw new Error("Save has no inspectable atlas and location memory");
let T,libraryBytes,librarySource="working tndmaps.js";
if(refAt>=0){
 const ref=args[refAt+1];if(!ref||ref.startsWith("-"))throw new Error("Missing trusted library revision");
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith("GIT_")));
 libraryBytes=cp.execFileSync("git",["-c","safe.directory="+ROOT,"show",ref+":tndmaps.js"],{cwd:ROOT,env,maxBuffer:8*1024*1024});librarySource=ref+":tndmaps.js";
 const context=vm.createContext({module:{exports:{}}});context.global=context;vm.runInContext(libraryBytes.toString("utf8"),context,{filename:librarySource});T=context.module.exports;
}else{libraryBytes=fs.readFileSync(path.join(ROOT,"tndmaps.js"));T=require("../tndmaps.js");}
const transcript=Array.isArray(ws.transcript)?ws.transcript:[];
const liveGM=transcript.map((entry,index)=>({entry,index})).filter(x=>x.entry.r==="gm"&&!x.entry.db&&!x.entry.rf&&typeof x.entry.x==="string");
const fold=s=>String(s||"").replace(/[‘’]/g,"'").toLowerCase().replace(/\s+/g," ").trim();
function overlaps(name){const needle=fold(name);return liveGM.filter(x=>fold(x.entry.x).includes(needle)).map(x=>({turn:x.entry.t,transcriptIndex:x.index,semanticProof:false}));}
const NAMES={region:d=>[].concat(d.places||[],d.caves||[],d.features||[]),town:d=>[].concat(d.establishments||[],d.landmarks||[]),wild:d=>d.features||[],interior:d=>d.rooms||[],dungeon:d=>d.rooms||[]};
const FROM={"region>town":(d,v)=>T.town.fromRegion(d,v),"region>wild":(d,v)=>T.wild.fromRegion(d,v),"region>dungeon":(d,v)=>T.dungeon.fromRegion(d,v),"town>interior":(d,v)=>T.interior.fromTown(d,v),"town>dungeon":(d,v)=>T.dungeon.fromTown(d,v),"interior>dungeon":(d,v)=>T.dungeon.fromInterior(d,v),"dungeon>dungeon":(d,v)=>T.dungeon.fromDungeon(d,v)};
const docs=Object.create(null),walking=new Set();
function document(id){
 if(docs[id])return docs[id];if(walking.has(id)||walking.size>=64)throw new Error("Invalid recipe parent chain: "+id);walking.add(id);
 const r=A.zones[id];if(!r)throw new Error("Missing recipe: "+id);let params;
 if(!r.parent)params=JSON.parse(JSON.stringify(r.params));
 else{const parent=A.zones[r.parent],make=parent&&FROM[parent.kind+">"+r.kind];if(!make)throw new Error("Unsupported recipe relation: "+id);params=make(document(r.parent),r.via);if(r.params)params=Object.assign({},params,JSON.parse(JSON.stringify(r.params)));}
 if(params.seed!==id)throw new Error("Derived recipe identity changed: "+id);docs[id]=T.generate(r.kind,params);walking.delete(id);return docs[id];
}
function fingerprint(doc,r){const scheme=r.fpv||1,gen=doc.generator,s=JSON.stringify(doc,function(k,v){if(this===doc&&(k==="stats"||k.charAt(0)==="_"||(scheme>=2&&k==="params")))return;if(this===doc&&k==="params"&&r.params)return r.params;return this===gen&&k==="version"?r.lib:v;});return(T.hash32(s)>>>0).toString(16)+"-"+s.length.toString(36);}
const recipes=Object.entries(A.zones).map(([id,r])=>{
 const doc=document(id),read=NAMES[r.kind];if(!read)throw new Error("Unknown named-feature registry: "+r.kind);const named=read(doc),fp=fingerprint(doc,r);
 return {id,kind:r.kind,storedTitle:r.name,createdTurn:r.turn,library:r.lib,storedFingerprint:r.fp,reproducedFingerprint:fp,fingerprintMatches:fp===r.fp,namedObjectCount:named.length,explicitAuthoredCount:named.filter(f=>f.authored===true).length,portalCount:(doc.portals||[]).length,buildingFootprints:(doc.buildings||[]).length,roadCount:(doc.roads||[]).length,roomCount:(doc.rooms||[]).length,
  publicTextOverlaps:named.map(f=>({id:f.id,label:f.name,authored:f.authored===true,sources:overlaps(f.name)})).filter(f=>f.sources.length),
  motivatingHut:named.filter(f=>/stalgin/i.test(f.name||"")).map(f=>({id:f.id,label:f.name,kind:f.kind,authored:f.authored===true,x:f.x,y:f.y,publicTextOverlaps:overlaps(f.name)}))};
});
const canonical=Object.entries(mem.map.nodes||{}).map(([key,n])=>({key,parent:n.parent,visits:n.visits||0,firstVisit:n.firstVisit,lastVisit:n.lastVisit,publicTextOverlaps:overlaps(key),locationStamps:liveGM.filter(x=>x.entry.l===key).map(x=>({turn:x.entry.t,transcriptIndex:x.index}))}));
const terms=["Stalgind","Stalgin","hut","Bear Spring","Boar Tree","Waystone Arch","First Pact"];
const references=Object.fromEntries(terms.map(term=>[term,{publicLiveGM:overlaps(term),allTranscript:transcript.filter(t=>fold(t.x).includes(fold(term))).map(t=>({turn:t.t,role:t.r,dead:!!t.db,refused:!!t.rf})),assistantSessionEntries:(data.sessionLog||[]).map((e,i)=>({e,i})).filter(x=>x.e.role==="assistant"&&fold(x.e.content).includes(fold(term))).map(x=>x.i)}]));
const checkpoint=ws.checkpoint||null;
const report={purpose:"Read-only inventory; zero promotions. Text overlaps are not semantic evidence.",source:{path:source,bytes:bytes.length,sha256:before,saveVersion:ws.ver,turn:ws.turn,atlasVersion:A.v,currentLocation:ws.world&&ws.world.location},library:{version:T.VERSION,source:librarySource,sha256:hash(libraryBytes)},transcript:{records:transcript.length,liveGM:liveGM.length,players:transcript.filter(t=>t.r==="player").length,dead:transcript.filter(t=>t.db).length,refused:transcript.filter(t=>t.rf).length,GMturns:liveGM.map(x=>x.entry.t)},recipes,canonical,edges:mem.map.edges||[],atlas:{ties:A.names||{},additions:A.adds||{},classifiedPlaces:A.kinds||{},noteCount:Object.keys(A.notes||{}).length,publicNoteCount:Object.keys(A.publicNotes||{}).length,visitSheets:Object.entries(A.seen||{}).map(([id,s])=>({id,standCount:(s.at||[]).length,legCount:(s.legs||[]).length,last:s.last})),authoredRecipeEditCount:Object.values(A.zones).reduce((n,r)=>n+((r.params&&r.params.edits)||[]).length,0),hasKnowledge:Object.prototype.hasOwnProperty.call(A,"knowledge"),hasGeography:Object.prototype.hasOwnProperty.call(mem.map,"geography")},checkpoint:checkpoint?{turn:checkpoint.turn,location:checkpoint.location,reason:checkpoint.reason,hasWorldSnapshot:typeof checkpoint.ws==="string",hasMemorySnapshot:typeof checkpoint.mem==="string",hasSessionSnapshot:typeof checkpoint.sl==="string"}:null,references,promoted:0};
report.source.unchanged=hash(fs.readFileSync(source))===before;if(!report.source.unchanged)throw new Error("The source changed during the census; discard this report and retry");
console.log(JSON.stringify(report,null,2));
