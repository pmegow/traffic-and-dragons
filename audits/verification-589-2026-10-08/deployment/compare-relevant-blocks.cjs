const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const root='C:/Projects/traffic-and-dragons',out=path.join(root,'audits/verification-589-2026-10-08/deployment');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const specs=[['helpers.js','function partyUploadSlug(', 'function partyUploadRun('],['helpers.js','function libUpdateDiff(', '// B3 (v1.361)'],['ui-browsers.js','function _charLibSlug(', 'function _renderCompanionSlots('],['storage-adapter.js','  function listCharacterLibrary(', '  // ── Blueprint library']];
function block(s,start,end){const a=s.indexOf(start),b=s.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Missing marker '+start+' / '+end);return s.slice(a,b);}
const receipts=specs.map(([file,start,end])=>{let a=block(read(path.join(root,file)),start,end),b=block(read(path.join(out,'deployed-'+file)),start,end);return {file,start,end,bytes:Buffer.byteLength(a),localSha256:sha(a),deployedSha256:sha(b),equal:a===b}});
fs.writeFileSync(path.join(out,'relevant-block-equivalence.json'),JSON.stringify(receipts,null,2));console.log(JSON.stringify(receipts,null,2));
for(const file of ['helpers.js','ui-browsers.js','storage-adapter.js','game.js','globals.js','sw.js']){let r=cp.spawnSync('git',['diff','--no-index','--',path.join(out,'deployed-'+file),path.join(root,file)],{cwd:root,encoding:'utf8'});if(r.status>1)throw Error(r.stderr);fs.writeFileSync(path.join(out,'diff-'+file+'.txt'),r.stdout);}
