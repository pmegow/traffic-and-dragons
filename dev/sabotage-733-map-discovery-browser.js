'use strict';
// Browser clauses use dev/cdp-browser.js; absent Chrome is an explicit skipped verdict.
// file: 'dev/tests-733-map-discovery-browser.js'
const sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome();
const command=['node',['dev/tests-733-map-discovery-browser.js']],only='FAIL #733 discovery browser ';let rc=0;
if(!chrome.path){verdict.reportSkip('733 discovery browser',5,chrome.why);process.exit(verdict.SKIP_EXIT);}
rc|=sabotage.prove({file:'game.js',command,only,cases:[
 {label:'normal action bypasses source extraction',find:'var _mapDiscoveries=(typeof atlasDiscoveryRequest==="function")?await atlasDiscoveryRequest(resp):null;',replace:'var _mapDiscoveries=null;',mustFail:only+'normal stationary action extracts a quoted landmark and saves one story turn'},
 {label:'opening bypasses source extraction',find:'var _openingDiscoveries=(typeof atlasDiscoveryRequest==="function")?await atlasDiscoveryRequest(resp):null;',replace:'var _openingDiscoveries=null;',mustFail:only+'opening uses the same extraction seam without advancing the starting turn'},
 {label:'obsolete extraction falls through to replacement input and latch writes',find:'if(typeof atlasDiscoveryDiscard==="function"&&atlasDiscoveryDiscard(e,_committed?null:_mapTurnContext)){busy=false;document.getElementById("sendbtn").disabled=false;return;}',replace:'',mustFail:only+'replacement campaign survives an obsolete extraction with no catch-side writes'},
 {label:'first narration request has no original campaign context',find:'var _mapTurnContext=(!isTT&&typeof atlasDiscoveryContext==="function"&&atlasKnowledgeActive())?atlasDiscoveryContext():null;',replace:'var _mapTurnContext=null;',mustFail:only+'campaign switch during the first GM call aborts obsolete narration'}
]});
rc|=sabotage.prove({file:'atlas-discovery.js',command,only,cases:[
 {label:'same-valued replacement references pass the stale-context guard',find:'context.world===worldState&&context.memory===memory&&',replace:'',mustFail:only+'identical-valued world replacement during extraction aborts obsolete narration'}
]});
process.exit(rc?1:0);
