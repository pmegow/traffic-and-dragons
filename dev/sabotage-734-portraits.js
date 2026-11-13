var sabotage=require('./sabotage.js');
var rc=sabotage.prove({file:'game.js',command:['node',['dev/run-tests.js','#734 authored NPC portraits']],cases:[
 {label:'blueprint image is discarded',find:'_seedN.portrait=n.portrait;',replace:'_seedN.portrait=null;',mustFail:'#734 authored portrait enters the roster without changing the blueprint'},
 {label:'blueprint image admission inspects the wrong value',find:'portraitAdmit(_seedN,"blueprint NPC "+n.name)',replace:'portraitAdmit({portrait:null},"blueprint NPC "+n.name)',mustFail:'#734 malformed authored image is diagnosed and not retained'},
 {label:'automatic companion loses the row image',find:',portraitFallback:npc.portrait',replace:'',mustFail:'#734 automatic companion attachment makes the sheet the portrait owner'},
 {label:'companion keeps a duplicate roster image',find:'npc.charSheet=sheet;npc.portrait=null;delete npc.sheetPending;',replace:'npc.charSheet=sheet;delete npc.sheetPending;',mustFail:'#734 automatic companion attachment makes the sheet the portrait owner'}
]});
rc|=sabotage.prove({file:'admission.js',command:['node',['dev/run-tests.js','#734 authored NPC portraits']],cases:[
 {label:'row image overwrites a chosen sheet image',find:'if(!sheet.portrait&&ctx.portraitFallback)',replace:'if(ctx.portraitFallback)',mustFail:'#734 chosen sheet portrait wins and repeated attachment is inert'},
 {label:'invalid candidate prevents the authored fallback',find:'if(!sheet.portrait&&ctx.portraitFallback)',replace:'if(!_pd&&!sheet.portrait&&ctx.portraitFallback)',mustFail:'#734 malformed candidate cannot erase a valid roster portrait'}
]});process.exit(rc?1:0);
