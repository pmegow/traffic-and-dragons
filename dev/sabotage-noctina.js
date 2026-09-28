var sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'audio-scenes.js',command:['node',['dev/run-tests.js','L7 tavern binding']],cases:[
 {label:'Noctina allowed into general ambience pool',mustFail:'L7 Noctina stays in the village night slot',find:'Object.assign({},asset,{bind:seed.bind,accents:seed.accents||[]})',replace:'Object.assign({},asset,{bind:seed.bind,accents:seed.accents||[],seedOnly:false})'},
 {label:'Noctina night slot points to prior cricket asset',mustFail:'night bed must be the owner-selected Noctina mix',find:'return Object.assign({},asset,{bind:seed.bind,accents:seed.accents||[]});',replace:'if(seed.id==="village-night")asset=Object.assign({},asset,{bed:Object.assign({},asset.bed,{url:"sfx/village-night-v3.mp3"})}); return Object.assign({},asset,{bind:seed.bind,accents:seed.accents||[]});'}
]}));
