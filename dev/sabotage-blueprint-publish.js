var sabotage=require('./sabotage.js');
var common=['blueprint-designer.html','home.html','storage-adapter.js','samples/catalog.json','samples/the_silence_between_leaves.blueprint'];
var failed=0;
failed+=sabotage.prove({file:'blueprint-designer.html',also:common,command:['node',['dev/tests-blueprint-publish-browser.js']],cases:[
 {label:'Catalog tab is admin only',find:'if(account&&account.isAdmin===true){',replace:'if(account){',mustFail:'Non-admin library has no Catalog tab'},
 {label:'Source changes invalidate late catalog reads',find:'return stamp===view&&document.getElementById("lib-modal")===wrap;',replace:'return document.getElementById("lib-modal")===wrap;',mustFail:'Late catalog response cannot overwrite My Library'},
 {label:'Blank author reaches public publication',find:'blurb:pitch,blueprint:snapshot}',replace:'blurb:pitch,blueprint:Object.assign({},snapshot,{author:"OLD BYLINE"})}',mustFail:'Blank byline reaches publication API'}
]});
failed+=sabotage.prove({file:'sw.js',command:['node',['dev/tests-blueprint-catalog-cache.js']],cases:[
 {label:'Online samples bypass stale cached contents',find:'|\\/samples\\/',replace:'',mustFail:'Online sample refresh must replace stale cached byline'}
]});
process.exit(failed?1:0);
