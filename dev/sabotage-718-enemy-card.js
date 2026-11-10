var sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'ui-mobile.js',command:['node',['dev/tests-718-enemy-card.js']],cases:[
 {label:'raw bestiary notes return to the player card',find:'{key:"desc",label:"Description"}',replace:'{key:"desc",label:"Description"},{key:"notes",label:"Creature notes"}',mustFail:'#718 enemy card never renders GM notes'}
]})?1:0);
