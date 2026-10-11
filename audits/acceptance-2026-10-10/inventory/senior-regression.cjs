// #599 I5 acceptance regression: a refused single-unit gift must restore the original fragment.
// Run from any cwd. Optional absolute runtime root allows read-only verification of a later checkout.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=process.argv[2]?path.resolve(process.argv[2]):path.resolve(__dirname,'../../..');
const L=require(path.join(root,'dev/load-engine.js'));L.loadEngine();
for(const n of ['showToast','syncUI','saveAll','updateInvPanel','addMsg'])global[n]=()=>({});
const item={name:'Torch',qty:1,equipped:false,origin:{batch:'synthetic',marks:[1,2]}};
function setup(){L.makeTestWorld();worldState.character.inventory=[JSON.parse(JSON.stringify(item))];}
setup();worldState.npcs.push({name:'Bram',status:'here',rel:'companion',partyMember:true,charSheet:{name:'Bram',inventory:[]}});memory.npcs.Bram={knowledge:[],events:[],aliases:[],partyMember:true};
let applied=applyMuts('[ITEM_LOST:Torch][COMPANION_ITEM_GAINED:Bram|Torch]');assert.deepEqual(applied.errors,[]);assert.deepEqual(findCompanionChar('Bram').inventory,[item]);assert.deepEqual(worldState.character.inventory,[]);console.log('PASS positive control: valid receiver gets the complete fragment');
setup();const before=JSON.parse(JSON.stringify(worldState.character.inventory));applied=applyMuts('[ITEM_LOST:Torch][COMPANION_ITEM_GAINED:Absent|Torch]');console.log(JSON.stringify({version:APP_VERSION,before,after:worldState.character.inventory,muts:applied.muts,errors:applied.errors},null,2));assert.deepEqual(applied.errors,[]);assert.ok(applied.muts.some(m=>m.includes('stays in the pack')),'must reach the actual missing-recipient refusal');assert.deepEqual(worldState.character.inventory,before,'#599 I5 refused single-unit gift must restore every unknown row field');console.log('PASS #599 I5 refused single-unit gift restores the complete fragment');
