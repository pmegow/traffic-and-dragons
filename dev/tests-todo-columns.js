// Regression coverage for the #480 prose-pipe column spill.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),vm=require('vm');
const guard=require('./check-todo-columns.js'),root=path.join(__dirname,'..'),BT=String.fromCharCode(96);
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS TODO COLUMNS '+name);}catch(e){failed++;console.error('FAIL TODO COLUMNS '+name+' — '+e.message);}}
const header='| # | Task | Effort | Tier | Status |\n|---|---|:---:|:---:|---|\n';
const damaged='| 480 | Raw spelling "The Village|The Village Hall", node "The Village|the Village Hall". | S | Opus | Open |';
const repaired=damaged.replaceAll('Village|','Village\\|');
test('raw prose pipes are rejected with row number and expected width',()=>{const errors=guard.columnErrors(header+damaged);assert.equal(errors.length,1);assert.match(errors[0],/#480/);assert.match(errors[0],/7 columns.*expected 5/);assert.match(errors[0],/escape/i);});
test('escaped and code-span pipes preserve five columns',()=>{assert.deepEqual(guard.columnErrors(header+repaired),[]);assert.deepEqual(guard.columnErrors(header+'| 1 | '+BT+'[LOCATION_ITEM:name|placed]'+BT+' plus x\\|y | S | Any | Open |'),[]);});
test('missing cell and malformed separator widths are rejected',()=>{assert.match(guard.columnErrors(header+'| 2 | missing effort | Any | Open |').join(' '),/4 columns.*expected 5/);assert.match(guard.columnErrors('| A | B |\n|---|\n| one | two |').join(' '),/1 columns.*expected 2/);});
test('empty cells remain legal and each table gets its own header width',()=>{assert.deepEqual(guard.columnErrors(header+'| 1 | Fine | | | Open |\n\n## Other\n| A | B |\n|---|---|\n| x | y |\n'),[]);});
test('completed markers do not disable column checking',()=>{assert.match(guard.columnErrors(header+'<!-- completed -->\n'+damaged).join(' '),/#480/);});
test('unclosed code span is rejected even when its pipe count looks valid',()=>{assert.match(guard.columnErrors('| A | B |\n|---|---|\n| x | y | '+BT+'unclosed').join(' '),/unclosed code span/);});
test('validator agrees with the shipped viewer cell boundaries',()=>{
 const html=fs.readFileSync(path.join(root,'todo-viewer.html'),'utf8'),start=html.indexOf('function splitCells('),end=html.indexOf('// Rejoin table rows',start);
 assert(start>=0&&end>start);const c={};vm.createContext(c);vm.runInContext(html.slice(start,end),c);
 [damaged,repaired,'| 1 | '+BT+'a|b'+BT+' and c\\|d | S | Any | Open |','| 1 | '+BT+BT+'a|b'+BT+BT+' | | | |'].forEach(line=>assert.equal(guard.measureRow(line).columns,c.splitCells(line).length-2));
});
test('current TODO table renders with the declared number of columns',()=>{assert.deepEqual(guard.columnErrors(fs.readFileSync(path.join(root,'TODO.md'),'utf8')),[]);});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tnd-todo-columns-'));
try {
 test('CLI exits nonzero on malformed file and prints the fix',()=>{
  const file=path.join(tmp,'bad.md');fs.writeFileSync(file,header+damaged);
  const r=cp.spawnSync(process.execPath,[path.join(__dirname,'check-todo-columns.js'),'--file',file],{encoding:'utf8'});
  assert.equal(r.status,1);assert.match(r.stderr,/#480/);assert.match(r.stderr,/escape/i);
 });
 test('staged guard reads the index even when the working file is repaired',()=>{
  fs.mkdirSync(path.join(tmp,'dev'));fs.copyFileSync(path.join(__dirname,'check-todo-columns.js'),path.join(tmp,'dev/check-todo-columns.js'));
  const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'};
  ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_PREFIX'].forEach(k=>delete env[k]);
  function git(args){const r=cp.spawnSync('git',args,{cwd:tmp,env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
  git(['init','-q']);fs.writeFileSync(path.join(tmp,'TODO.md'),header+damaged);git(['add','TODO.md']);fs.writeFileSync(path.join(tmp,'TODO.md'),header+repaired);
  let r=cp.spawnSync(process.execPath,['dev/check-todo-columns.js','--staged'],{cwd:tmp,env,encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/#480/);
  git(['add','TODO.md']);r=cp.spawnSync(process.execPath,['dev/check-todo-columns.js','--staged'],{cwd:tmp,env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 });
}finally{const base=path.resolve(os.tmpdir())+path.sep;if(!path.resolve(tmp).startsWith(base)||!path.basename(tmp).startsWith('tnd-todo-columns-'))throw Error('Unsafe cleanup target');fs.rmSync(tmp,{recursive:true,force:true});}
console.log('TODO COLUMNS: '+failed+' failed, '+passed+' passed');process.exitCode=failed?1:0;
