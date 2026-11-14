var sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'ui-mobile.js',command:['node',['dev/tests-718-enemy-card.js']],cases:[
 {label:'raw bestiary notes return to the player card',find:'row("Description",view.desc);',replace:'row("Description",view.desc);row("Creature notes",record.notes);',mustFail:'#718 enemy card never renders GM notes'}
]})?1:0);
