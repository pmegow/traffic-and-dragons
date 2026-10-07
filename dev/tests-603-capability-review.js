const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'tnd-review-'));
try{
const html=fs.readFileSync(path.join(root,'audits/capability_vulnerabilities.html'),'utf8'),manifest=JSON.parse(html.match(/<script id="audit-data" type="application\/json">([\s\S]*?)<\/script>/)[1]),box={};
require('vm').runInNewContext(html.match(/<script id="review-core">([\s\S]*?)<\/script>/)[1],box);
const core=box.CapabilityReview,reviews=core.initial(manifest);
const retained=manifest.rows.find(r=>r.key==='wall of  thorns'),retired=manifest.rows.find(r=>r.key==='wall of thorns');
assert.equal(core.isActive(retained),true,'keep the earlier reviewed 2d6/STR entry');
assert.equal(core.isActive(retired),false,'remove the later 7d8/DEX entry from active review');
assert.equal(manifest.rows.filter(core.isActive).length,506);
const retirementRoundTrip=core.read(core.pack(reviews,manifest),manifest);
assert.equal(retirementRoundTrip.length,507,'retain archived row data for existing browser drafts');
assert.equal(core.progress(retirementRoundTrip,manifest).optional,447,'retired entries must not count as optional');

const durationKeys=['a call to arms','aura of life','bleed','blind','booming blade','chill touch','confusion','cunning action','divine sense','dominate beast','dread','fear','flash','fleeting vitality','grave touch','guidance','guiding bolt','hold person','ice storm','intimidating presence','moonbeam','ray of frost','ray of sickness','reckless attack','rot','shield','shield wall','slow','staggering smite','the wild run','turn undead'];
for(const key of durationKeys){const row=manifest.rows.find(r=>r.key===key);assert.equal(row.level,'unflagged','duration flag remains: '+key);assert.equal(row.evidence.length,0);assert.ok(row.excludedEvidence.length>0,'excluded evidence must remain traceable');}
for(const key of ['augury','charm person','comprehend languages','invisibility','redirect element','shadow blade'])assert.notEqual(manifest.rows.find(r=>r.key===key).level,'unflagged','non-duration concern was removed: '+key);
for(const key of ['charm person','invisibility'])assert.ok(!manifest.rows.find(r=>r.key===key).evidence.some(e=>/until/.test(e.phrase)),'timing evidence remains in mixed finding: '+key);
const prior=fs.readFileSync(path.join(root,'audits/capability_vulnerabilities.json'),'utf8');assert.equal(core.pack(core.read(prior,manifest),manifest),JSON.stringify(JSON.parse(prior),null,2),'existing saved decisions must survive reclassification unchanged');

assert.equal(core.progress(reviews,manifest).required,59);assert.equal(core.progress(reviews,manifest).optional,447);
reviews.forEach((r,i)=>{if(manifest.rows[i].level!=='unflagged')r.decision='keep';});
assert.equal(core.progress(reviews,manifest).complete,true,'untouched unflagged entries must not block completion');
assert.equal(reviews.filter(r=>r.decision==='pending').length,448,'completion must not silently approve optional entries');
reviews[0].decision='pending';assert.equal(core.progress(reviews,manifest).remaining,1);
reviews[0].decision='rewrite';reviews[0].replacement='   ';assert.equal(core.progress(reviews,manifest).complete,false,'a blank flagged rewrite must still need a decision');
reviews[0].replacement='A reviewed replacement';assert.equal(core.progress(reviews,manifest).complete,true);
const optional=manifest.rows.findIndex(r=>r.level==='unflagged');assert.equal(core.needsDecision(manifest.rows[optional],reviews[optional]),false);
assert.equal(core.progress(core.read(core.pack(reviews,manifest),manifest),manifest).complete,true,'saved reviews must retain completion without optional decisions');
console.log('PASS #603 only flagged entries require decisions; optional entries, blanks and round trips');
fs.mkdirSync(path.join(scratch,'audits'));
for(const f of ['audits/capability_vulnerabilities.html','audits/capability_vulnerabilities.json'])fs.copyFileSync(path.join(root,f),path.join(scratch,f));
const store=require('./capability-review-store.js').createStore(scratch),before=store.read(),doc=JSON.parse(before.text);
assert.equal(doc.reviews.length,507);doc.reviews[0].replacement='A deliberately unfinished revision';doc.reviews[0].decision='rewrite';
const saved=store.write({revision:before.revision,text:JSON.stringify(doc)});assert.equal(JSON.parse(saved.text).reviews[0].replacement,doc.reviews[0].replacement);
assert.throws(()=>store.write({revision:before.revision,text:JSON.stringify(doc)}),/changed on disk/,'stale review must be refused');
for(const change of [d=>d.reviews.pop(),d=>d.reviews[1].key=d.reviews[0].key,d=>d.reviews[0].decision='approved',d=>d.reviews[0].replacement=5,d=>d.audit='stale',d=>d.reviews[0].decision='keep']){
 const invalid=JSON.parse(saved.text);change(invalid);assert.throws(()=>store.write({revision:saved.revision,text:JSON.stringify(invalid)}));assert.equal(store.read().text,saved.text);
}
const rejected=JSON.parse(saved.text);rejected.reviews[0].replacement='Wording that must not reach disk';
const rename=fs.renameSync;try{fs.renameSync=()=>{throw Error('disk full');};assert.throws(()=>store.write({revision:saved.revision,text:JSON.stringify(rejected)}),/disk full/);}finally{fs.renameSync=rename;}
assert.equal(store.read().text,saved.text,'failed replacement must preserve previous review');assert.equal(fs.readdirSync(path.join(scratch,'audits')).filter(f=>f.endsWith('.tmp')).length,0);
console.log('PASS #603 description review: complete draft round trip, invalid/stale refusal, atomic failure preservation');
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
