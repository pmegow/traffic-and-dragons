const assert=require('assert/strict');
const A=require('../designer-acts.js');
let failures=0,count=0;
function test(name,fn){try{fn();count++;console.log('PASS #723 '+name);}catch(e){failures++;console.error('FAIL #723 '+name+': '+e.message);}}
function acts(){return [{title:'Forest'},{title:'Fen'},{title:'Mine'}];}
test('checkbox views preserve absent and legacy fields',()=>{
 const as=acts(),all={},late={revealAct:2},none={availableActs:[]};
 assert.deepEqual(A.selection(all,as),[1,2,3]);assert.deepEqual(all,{});
 assert.deepEqual(A.selection(late,as),[2,3]);assert.deepEqual(late,{revealAct:2});assert.deepEqual(A.selection(none,as),[]);
 A.choose(late,[1,3],as);assert.deepEqual(late,{availableActs:[1,3]});A.choose(late,[1,2,3],as);assert.deepEqual(late,{});
});
test('invalid checkbox data is refused rather than widened',()=>{
 const as=acts();for(const availableActs of [null,1,[0],[4],[1,1],['1']])assert.throws(()=>A.selection({availableActs},as),/act/i);
 assert.throws(()=>A.selection({availableActs:[1],revealAct:2},as),/both|conflict/i);
});
test('reorder follows act identity for creatures secrets and armor',()=>{
 const b={acts:acts(),creatures:[{name:'Scout',availableActs:[1,3]},{name:'Raider',revealAct:2},{name:'Hare'}],npcs:[{name:'Guide',secret:'Truth',revealAct:2,armor:3}]};
 A.restructure(b,[b.acts[2],b.acts[0],b.acts[1]]);
 assert.deepEqual(b.creatures[0].availableActs,[1,2]);assert.deepEqual(b.creatures[1].availableActs,[1,3]);assert.equal(b.creatures[1].revealAct,undefined);assert.equal(b.creatures[2].availableActs,undefined);
 assert.equal(b.npcs[0].revealAct,3);assert.equal(b.npcs[0].armor,1);
});
test('new acts default on only for unrestricted creatures',()=>{
 const b={acts:acts(),creatures:[{name:'All'},{name:'Some',availableActs:[1]}],npcs:[]};A.restructure(b,b.acts.concat({title:'Return'}));
 assert.deepEqual(A.selection(b.creatures[0],b.acts),[1,2,3,4]);assert.deepEqual(A.selection(b.creatures[1],b.acts),[1]);
});
test('structural edits preserve explicit restrictions across deletion and later insertion',()=>{
 const b={acts:acts().slice(0,2),creatures:[{availableActs:[2]},{availableActs:[]}]};
 A.restructure(b,[b.acts[1]]);assert.deepEqual(b.creatures[0].availableActs,[1]);assert.deepEqual(b.creatures[1].availableActs,[]);
 A.restructure(b,b.acts.concat({title:'New'}));assert.deepEqual(A.selection(b.creatures[0],b.acts),[1]);
 A.restructure(b,[]);assert.deepEqual(b.creatures[0].availableActs,[]);
 A.restructure(b,[{title:'Return'}]);assert.deepEqual(A.selection(b.creatures[0],b.acts),[]);
});
test('padded numeric armor follows its act and protects deletion',()=>{
 const b={acts:acts(),creatures:[],npcs:[{name:'Guide',armor:' 2 '}]};
 A.restructure(b,[b.acts[1],b.acts[0],b.acts[2]]);assert.equal(b.npcs[0].armor,1);
 assert.throws(()=>A.restructure(b,b.acts.slice(1)),/Guide/);
 assert(A.problem([NaN],b.acts));
});
test('deletion never retargets a secret and refusal is atomic',()=>{
 const b={acts:acts(),creatures:[{availableActs:[1,3]}],npcs:[{name:'Guide',secret:'Truth',revealAct:2}]},before=JSON.stringify(b);
 assert.throws(()=>A.restructure(b,[b.acts[0],b.acts[2]]),/Guide.*act|act.*Guide/i);assert.equal(JSON.stringify(b),before);
 delete b.npcs[0].revealAct;delete b.npcs[0].secret;A.restructure(b,[b.acts[1]]);assert.deepEqual(b.creatures[0].availableActs,[]);
});
console.log('#723 act controls: '+count+' passed, '+failures+' failed');process.exitCode=failures?1:0;
