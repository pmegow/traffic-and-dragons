// Runs the designer's actual save boundary without a browser or network.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),page=fs.readFileSync(path.join(root,'blueprint-designer.html'),'utf8');
let callback,posts=0,notices=[],savedDraft;
const buttons={'btn-publish':{addEventListener:(event,fn)=>buttons.publish=fn}};
const ctx={BlueprintEdition:require('../blueprint-edition.js'),BP_DESIGNER_VERSION:'test',editionBaseline:null,editionSaving:false,dirty:false,
  document:{getElementById:id=>buttons[id]||null},console,saveDraft:()=>{savedDraft=JSON.stringify({bp:ctx.bp,editionBaseline:ctx.editionBaseline,dirty:ctx.dirty});},
  setStatus:(s)=>notices.push(s),markDirty:()=>{ctx.dirty=true;},cloudReady:()=>true,designerValidate:()=>null,
  storageAdapter:{saveBlueprintToLibrary:(snapshot,cb)=>{posts++;callback=cb;}}};
vm.createContext(ctx);
function slice(start,end){const a=page.indexOf(start),b=page.indexOf(end,a);assert(a>=0&&b>a);return page.slice(a,b);}
vm.runInContext(slice('function stripView(', '// File output'),ctx);
vm.runInContext(slice('function fileOut(', 'function collapseAll('),ctx);
vm.runInContext(slice('document.getElementById("btn-publish").addEventListener', 'function updateCatalogAccess('),ctx);
function load(version='0.01',status='draft'){ctx.bp={name:'A',version,releaseStatus:status};ctx.editionBaseline=ctx.BlueprintEdition.baseline(ctx.bp);ctx.editionSaving=false;ctx.dirty=false;}
load();ctx.bp.name='B';buttons.publish();assert.equal(ctx.fileOut().version,'0.02');
callback('offline');assert.equal(ctx.editionBaseline.version,'0.01');assert.equal(ctx.fileOut().version,'0.02');assert(notices.some(s=>s.includes('offline')));
buttons.publish();ctx.bp.name='C';callback(null);assert.equal(ctx.editionBaseline.version,'0.02');assert.equal(ctx.fileOut().version,'0.03');assert.equal(ctx.dirty,true);
buttons.publish();callback(null);assert.equal(ctx.dirty,false);assert.equal(ctx.fileOut().version,'0.03');
const restored=JSON.parse(savedDraft);ctx.bp=restored.bp;ctx.editionBaseline=restored.editionBaseline;assert.equal(ctx.fileOut().version,'0.03');
load();ctx.bp.name='B';buttons.publish();const before=posts;buttons.publish();assert.equal(posts,before,'overlapping saves blocked');
ctx.chooseReleaseStatus('release-candidate');callback(null);assert.equal(ctx.fileOut().version,'1.0','late save preserves promotion');assert.equal(ctx.fileOut().releaseStatus,'release-candidate');assert.equal(ctx.dirty,true);
load();ctx.bp.name='B';buttons.publish();const replacement={name:'Replacement',version:'0.01',releaseStatus:'draft'};ctx.bp=replacement;ctx.editionBaseline=null;callback(null);assert.equal(ctx.bp,replacement);assert.equal(ctx.editionBaseline,null,'late save cannot stamp another draft');
load('1.0','release-candidate');ctx.chooseReleaseStatus('released');assert.equal(ctx.fileOut().releaseStatus,'released');assert.equal(ctx.fileOut().version,'1.0');
ctx.bp.name='changed';assert.equal(ctx.fileOut().version,'1.01');assert.equal(ctx.fileOut().releaseStatus,'release-candidate');ctx.chooseReleaseStatus('released');assert.equal(ctx.fileOut().releaseStatus,'release-candidate','edited edition cannot skip candidate save');
console.log('PASS blueprint designer editions: failed saves, edits during save, repeated saves, persisted baseline, overlapping saves, pending promotion, replaced draft and release gate');
