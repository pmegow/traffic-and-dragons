// Execute the real card renderer; only the modal host is replaced.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const engine=require('./load-engine.js');engine.loadEngine();engine.makeTestWorld();
(0,eval)(fs.readFileSync(path.join(__dirname,'../ui-mobile.js'),'utf8'));
let html='';global.modalShell=function(id,body){assert.equal(id,'enemy-modal');html=body;};
worldState.bestiary=[{name:'Borrowed-Banner Raider',kind:'goblin fae',threat:'moderate',desc:'A reed-cloaked figure.',notes:"One of Grist's raiders wearing a glamour and stolen court insignia."}];
const foe={name:'Borrowed-Banner Raider',hp:8,maxHp:12,ac:13,morale:'wary'};
const before=JSON.stringify(worldState.bestiary);
showEnemyDetails(foe);
assert.doesNotMatch(html,/Creature notes|Grist|glamour|stolen court insignia/,'#718 enemy card never renders GM notes');
assert.match(html,/A reed-cloaked figure/,'#718 public description retained');
assert.match(html,/Armor class<\/dt><dd>13/,'#718 live combat statistics retained');
assert.equal(JSON.stringify(worldState.bestiary),before,'#718 renderer does not alter author data');
console.log('PASS #718 enemy card never renders GM notes');
