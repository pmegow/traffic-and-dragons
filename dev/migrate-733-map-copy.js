'use strict';
// Explicit one-time copy tool. Nothing here is loaded by the game or changes an active campaign.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function load(){if(typeof buildNarrativeHtml==='undefined')vm.runInThisContext(fs.readFileSync(path.join(root,'ui-files.js'),'utf8'),{filename:'ui-files.js'});if(typeof MapKnowledge==='undefined')require('./load-engine.js').loadEngine();if(typeof MapLegacyCopy==='undefined')vm.runInThisContext(fs.readFileSync(path.join(__dirname,'map-legacy-copy.js'),'utf8'),{filename:'dev/map-legacy-copy.js'});}
function verifyImport(candidate,sourceId){
  const e=require('./load-engine.js'),local=Object.create(null),syncIds=[],notices=[],oldLog={warn:console.warn,info:console.info,error:console.error};
  global.localStorage={getItem:k=>Object.prototype.hasOwnProperty.call(local,k)?local[k]:null,setItem:(k,v)=>{local[k]=String(v);},removeItem:k=>{delete local[k];}};
  global._m={};global._mKeys={};global.showToast=m=>notices.push(String(m));global.audioScenePublish=()=>{};global.fetch=()=>{throw Error('Network is forbidden during legacy-copy verification');};
  global.storageAdapter={syncToServer:()=>syncIds.push(worldState.campId),resetSyncState:()=>{},flushDirtyTurn:()=>null,markFlushDirty:()=>{},clearFlushDirty:()=>{}};
  console.warn=console.info=console.error=(...v)=>notices.push(v.join(' '));
  try{
    e.makeTestWorld();worldState=null;memory=null;sessionLog=[];
    const sourceKeys=['ws','sl','mem'].map(part=>campSlotKey(sourceId,part));sourceKeys.forEach((k,i)=>local[k]='ORIGINAL_OWNER_SLOT_'+i);setCampMeta([{id:sourceId,campName:'original owner sentinel'}]);
    const expected={geography:JSON.stringify(candidate.memory.map.geography),nodes:JSON.stringify(candidate.memory.map.nodes),edges:JSON.stringify(candidate.memory.map.edges),identity:JSON.stringify(candidate.memory.map.identity||null),transcript:JSON.stringify(candidate.worldState.transcript),notes:JSON.stringify(candidate.worldState.atlas.notes||null),backup:JSON.stringify(candidate.worldState.atlas.legacyAtlas),session:JSON.stringify(candidate.sessionLog)};
    const imported=importSaveData(JSON.parse(JSON.stringify(candidate)));assert(imported.reminted);assert.notEqual(worldState.campId,sourceId);assert.equal(memory.campId,worldState.campId);
    function verify(){assert.equal(worldState.turn,candidate.worldState.turn);assert.equal(JSON.stringify(memory.map.geography),expected.geography);assert.equal(JSON.stringify(memory.map.nodes),expected.nodes);assert.equal(JSON.stringify(memory.map.edges),expected.edges);assert.equal(JSON.stringify(memory.map.identity||null),expected.identity);assert.equal(JSON.stringify(worldState.transcript),expected.transcript);assert.equal(JSON.stringify(worldState.atlas.notes||null),expected.notes);assert.equal(JSON.stringify(worldState.atlas.legacyAtlas),expected.backup);assert.equal(JSON.stringify(sessionLog),expected.session);assert.equal(memory.campId,worldState.campId);}
    verify();assert(saveLocal());assert(loadState());verify();assert(!syncIds.includes(sourceId));sourceKeys.forEach((k,i)=>assert.equal(local[k],'ORIGINAL_OWNER_SLOT_'+i));assert.deepEqual(getCampMeta().find(x=>x.id===sourceId),{id:sourceId,campName:'original owner sentinel'});
    const publicNow=atlasKnowledgeProjection().features.map(f=>f.label);assert(!JSON.stringify(publicNow).includes('Stalgind'));
    return {ok:true,normalImportReminted:true,worldAndMemoryOwnersMatch:true,originalLocalSlotsUnchanged:true,originalMetaUnchanged:true,noOriginalCloudTarget:true,networkRequests:0,geographyNodesEdgesIdentityTranscriptNotesBackupSessionExact:true,saveLoadExact:true,currentFeatures:publicNow,expectedImportNotes:['The normal importer assigns a new isolated ID and follows stamped records.','Existing general migrations may add presence metadata; public history and location records remain exact.']};
  }finally{Object.assign(console,oldLog);}
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function htmlReport(r){return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kaelon turn7 public-map copy</title><style>body{margin:0;background:#f5f2e9;color:#22352b;font:16px/1.6 system-ui}main{max-width:1100px;margin:auto;padding:36px 24px}h1,h2{font-family:Georgia,serif}table{border-collapse:collapse;width:100%;background:#fffdf7}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #ccd6cb;padding:12px}code{overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere}blockquote{margin:8px 0;color:#526158}a{color:#246047}.scroll{overflow:auto}</style><main><h1>A conservative public-map copy</h1><p>The original turn7 save is preserved unchanged. This separate campaign recovers six explicitly reviewed geographic facts; it does not infer discoveries from procedural names or private descriptions.</p><p><a href="Kaelon_t7_public_map_copy.tnd">Importable copy</a> · <a href="original-t7.tnd">Exact original backup</a> · <a href="Kaelon_t7_memento.html">Original public story</a> · <a href="migration-report.json">Full evidence report</a></p><p><strong>Stalgind’s Hut remains withheld.</strong> Bear Spring, Boar Tree, the procedural Green, building footprints and other unsupported legacy objects stay in the recoverable atlas backup.</p><h2>Admitted facts</h2><div class="scroll"><table><tr><th>Public feature</th><th>Containing place</th><th>Knowledge</th><th>Source and interpretation</th></tr>'+r.admitted.map(f=>'<tr><td>'+esc(f.label)+'</td><td>'+esc(f.container)+'</td><td>'+esc(f.mode)+'<br>'+esc(f.bearing==='unknown'?'Position not established':f.bearing)+'</td><td><blockquote>'+esc(f.quote)+'</blockquote>'+esc(f.rationale)+'<br><small>Transcript '+f.sources.map(s=>s.index+' (turn '+s.turn+')').join(', ')+'</small></td></tr>').join('')+'</table></div><h2>Preservation and limits</h2><p>Turn, public transcript, session log, location nodes, visits, edges, notes and identity data are preserved. The copy has a separate campaign ID and name; current-campaign ownership stamps follow it through the shared helpers. A normal import and local save/reload were checked without network access.</p><p>This manifest is a human-reviewed semantic decision with exact source validation. It is not a general natural-language discovery detector. Unavailable earlier checkpoint contents are not reconstructed.</p><p>Original SHA-256: <code>'+esc(r.sourceSHA256)+'</code></p><h2>Intentional ownership changes</h2><pre>'+esc(JSON.stringify(r.identityEdits,null,2))+'</pre></main></html>';}
function stableMemento(world,sourceHash){
  if(typeof buildNarrativeHtml==='undefined')load();
  const html=buildNarrativeHtml(world),footer=/<footer>Chronicled by Traffic and Dragons[^<]*<\/footer>/g,matches=html.match(footer);
  if(!matches||matches.length!==1)throw Error('Canonical memento footer changed; stable provenance could not be applied');
  return html.replace(footer,'<footer style="overflow-wrap:anywhere">Chronicled by Traffic and Dragons &middot; Legacy source turn '+esc(world.turn)+' &middot; SHA-256 '+esc(sourceHash)+'</footer>');
}
function writeOnce(file,data,io=fs){
  const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);if(io.existsSync(file)){if(io.readFileSync(file).equals(bytes))return false;throw Error('Refusing to overwrite differing retained artifact: '+file);}
  const pending=file+'.pending';io.writeFileSync(pending,bytes,{flag:'wx'});if(!io.readFileSync(pending).equals(bytes))throw Error('Artifact write verification failed: '+pending);
  io.linkSync(pending,file);io.unlinkSync(pending);return true;
}
function writeArtifacts(out,sourceBytes,candidate,report,manifest,memento,io=fs){
  io.mkdirSync(out,{recursive:true});
  // The complete preimage must exist and verify before an importable copy is published.
  writeOnce(path.join(out,'original-t7.tnd'),sourceBytes,io);assert.equal(hash(io.readFileSync(path.join(out,'original-t7.tnd'))),report.sourceSHA256);
  writeOnce(path.join(out,'reviewed-evidence.json'),JSON.stringify(manifest,null,2),io);
  writeOnce(path.join(out,'migration-report.json'),JSON.stringify(report,null,2),io);
  writeOnce(path.join(out,'Migration_Review.html'),htmlReport(report),io);
  writeOnce(path.join(out,'Kaelon_t7_memento.html'),memento,io);
  writeOnce(path.join(out,'Kaelon_t7_public_map_copy.tnd'),JSON.stringify(candidate,null,2),io);
}
function run(options){
  load();const source=path.resolve(options.source),manifestPath=path.resolve(options.manifest||path.join(__dirname,'fixtures/map-733-kaelon-evidence.json')),out=path.resolve(options.out||path.join(root,'testRuns/map-migration-733'));
  if(out===path.dirname(source)||path.join(out,'original-t7.tnd')===source||path.join(out,'Kaelon_t7_public_map_copy.tnd')===source)throw Error('Output must be separate from the original save directory');
  const sourceBytes=fs.readFileSync(source),raw=sourceBytes.toString('utf8'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8')),result=MapLegacyCopy.plan(raw,manifest,{hash,restampId:campRestampId,restampName:campRestamp});if(!result.ok)throw Error(result.reason);
  const backup=result.candidate.worldState.atlas.legacyAtlas;assert.equal(hash(JSON.stringify(backup)),manifest.source.atlasSHA256);
  const verification=verifyImport(result.candidate,manifest.source.campId),memento=stableMemento(result.candidate.worldState,manifest.source.sha256),report=Object.assign({},result.report,{mode:options.write?'written-copy':'dry-run',sourceFile:source,sourceBytes:sourceBytes.length,copyCampaignId:result.candidate.worldState.campId,copyCampaignName:result.candidate.worldState.campName,originalAtlasSHA256:manifest.source.atlasSHA256,backupMatchesOriginalAtlas:true,verification,changedRuntimeDefault:false,paidCalls:0});
  if(options.write)writeArtifacts(out,sourceBytes,result.candidate,report,manifest,memento);
  assert(fs.readFileSync(source).equals(sourceBytes),'Original source changed during copy');
  return {ok:true,written:!!options.write,out:options.write?out:null,sourceSHA256:report.sourceSHA256,originalBytesUnchanged:true,facts:report.admitted.map(f=>({id:f.featureId,label:f.label,container:f.container,bearing:f.bearing,mode:f.mode})),identityEdits:report.identityEdits,verification};
}
module.exports={run,verifyImport,writeArtifacts,writeOnce,stableMemento};
if(require.main===module){try{const args=process.argv.slice(2),opts={};for(let i=0;i<args.length;i++){const a=args[i];if(a==='--write')opts.write=true;else if(['--source','--manifest','--out'].includes(a)){if(!args[i+1])throw Error('Missing '+a+' value');opts[a.slice(2)]=args[++i];}else throw Error('Unknown argument '+a);}if(!opts.source)throw Error('Usage: node dev/migrate-733-map-copy.js --source <original.tnd> [--manifest reviewed.json] [--out directory] [--write]');console.log(JSON.stringify(run(opts),null,2));}catch(e){console.error('LEGACY MAP COPY REFUSED: '+e.message);process.exitCode=1;}}

