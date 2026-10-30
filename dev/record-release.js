// Append a production receipt. Never substitute a commit date for a deployment date.
const fs=require('fs'),cp=require('child_process');
function validate(entry){
 if(!entry||!/^v\d+\.\d+$/.test(entry.version)||!Array.isArray(entry.actions)||!entry.actions.length||!entry.actions.every(s=>typeof s==='string'&&s.trim()&&s.trim().split(/\s+/).length<25))throw Error('Release actions must each contain fewer than 25 words, with a version.');
 return entry;
}
function append(ledger,entry,commit,checks){
 validate(entry);
 if(ledger.releases.some(r=>r.commit===commit))return false;
 const check=checks.filter(c=>c.name==='Cloudflare Pages: traffic-and-dragons'&&c.app&&c.app.slug==='cloudflare-workers-and-pages'&&c.status==='completed'&&c.conclusion==='success'&&typeof c.completed_at==='string'&&isFinite(Date.parse(c.completed_at))).sort((a,b)=>Date.parse(b.completed_at)-Date.parse(a.completed_at))[0];
 if(!check)throw Error('No successful production deployment receipt for '+commit);
 ledger.releases.unshift({...entry,commit,releasedAt:check.completed_at});return true;
}
function git(args){return cp.execFileSync('git',args,{encoding:'utf8'}).trim();}
async function main(){
 const head=process.argv[2]||'HEAD',commit=git(['log','-1','--format=%H',head,'--','release-next.json']);
 const ledger=JSON.parse(fs.readFileSync('release-notes.json','utf8'));
 if(ledger.releases.some(r=>r.commit===commit)){console.log('Release already recorded.');return;}
 const entry=validate(JSON.parse(git(['show',commit+':release-next.json'])));
 const version=git(['show',commit+':globals.js']).match(/var APP_VERSION="([^"]+)"/)[1];
 if(entry.version!==version)throw Error('Release metadata must match APP_VERSION');
 const headers={Accept:'application/vnd.github+json','User-Agent':'TnD-release-ledger'};
 if(process.env.GITHUB_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_TOKEN;
 const r=await fetch('https://api.github.com/repos/pmegow/traffic-and-dragons/commits/'+commit+'/check-runs',{headers});
 if(!r.ok)throw Error('GitHub checks HTTP '+r.status);
 const checks=(await r.json()).check_runs;
 if(append(ledger,entry,commit,checks)){fs.writeFileSync('release-notes.json',JSON.stringify(ledger,null,2)+'\n');console.log('Recorded '+entry.version+' at '+ledger.releases[0].releasedAt);}
}
module.exports={validate,append};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
