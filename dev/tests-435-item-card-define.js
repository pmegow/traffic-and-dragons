const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.join(__dirname,'..');
let failed=0;
function test(name,fn){try{fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
function setup(){
  const nodes={}, calls=[], toasts=[];
  const c={worldState:{character:{inventory:[]}},busy:false,console,
    itemLookup:()=>null,itemDefEligible:()=>true,itemCardHTML:()=>'<div>Item details</div>',
    showToast:m=>toasts.push(m),defineItemFromStory:(raw,ev)=>calls.push({raw,ev,closed:!nodes['item-card-modal']}),
    document:{getElementById:id=>nodes[id]||null},
    modalShell:(id,html)=>{const m={html,remove(){delete nodes[id];}};nodes[id]=m;
      if(html.includes('id="item-card-define"'))nodes['item-card-define']={addEventListener:(type,fn)=>{nodes['item-card-define'][type]=fn;}};
      return m;}};
  vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'ui-sheets.js'),'utf8'),c);
  return {c,nodes,calls,toasts};
}
test('canon-less card offers story review and passes the exact raw item',()=>{
  const s=setup(),raw='Matched runic daggers "<&> x2';s.c.showItemCard(raw);
  assert(s.nodes['item-card-define'],'missing story review button');
  assert(s.nodes['item-card-modal'].html.includes('Consult story &amp; define'));
  const ev={};s.nodes['item-card-define'].click(ev);
  assert.strictEqual(s.calls.length,1);assert.strictEqual(s.calls[0].raw,raw);assert.strictEqual(s.calls[0].ev,ev);
  assert(s.calls[0].closed,'stale card covers definition confirmation');
});
test('busy click refuses loudly and stays usable after the turn',()=>{
  const s=setup();s.c.busy=true;s.c.showItemCard('Matched runic daggers');
  assert(s.nodes['item-card-define'],'button frozen by paint-time busy');s.nodes['item-card-define'].click({});
  assert.strictEqual(s.calls.length,0);assert(s.toasts.some(m=>m.includes('Wait')));assert(s.nodes['item-card-modal']);
  s.c.busy=false;s.nodes['item-card-define'].click({});assert.strictEqual(s.calls.length,1);
});
test('canon and non-campaign cards have no definition action',()=>{
  const s=setup();s.c.itemDefEligible=()=>false;s.c.showItemCard('Known item');assert(!s.nodes['item-card-define']);
  const n=setup();n.c.worldState=null;n.c.showItemCard('Unknown');assert(!n.nodes['item-card-define']);
});
test('classification-only items share eligibility and preserve the underlying sheet',()=>{
  const s=setup();s.c.itemLookup=()=>({effect:'N/A'});s.nodes['cs-modal']={};s.c.showItemCard('Unclassified tool');
  assert(s.nodes['item-card-define']);s.nodes['item-card-define'].click({});assert(s.nodes['cs-modal']);assert.strictEqual(s.calls.length,1);
});
test('missing review function reports failure and keeps the card',()=>{
  const s=setup();s.c.defineItemFromStory=undefined;s.c.showItemCard('Matched runic daggers');
  assert(s.nodes['item-card-define']);s.nodes['item-card-define'].click({});assert(s.toasts.length);assert(s.nodes['item-card-modal']);
});
if(failed)process.exit(1);console.log('ALL GREEN — item-card story review');
