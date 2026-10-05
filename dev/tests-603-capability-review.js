const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'tnd-review-'));
try{
const html=fs.readFileSync(path.join(root,'audits/capability_vulnerabilities.html'),'utf8'),manifest=JSON.parse(html.match(/<script id="audit-data" type="application\/json">([\s\S]*?)<\/script>/)[1]),box={};
require('vm').runInNewContext(html.match(/<script id="review-core">([\s\S]*?)<\/script>/)[1],box);
const core=box.CapabilityReview,reviews=core.initial(manifest);
assert.equal(core.progress(reviews,manifest).required,90);assert.equal(core.progress(reviews,manifest).optional,417);
reviews.forEach((r,i)=>{if(manifest.rows[i].level!=='unflagged')r.decision='keep';});
assert.equal(core.progress(reviews,manifest).complete,true,'untouched unflagged entries must not block completion');
assert.equal(reviews.filter(r=>r.decision==='pending').length,417,'completion must not silently approve optional entries');
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
