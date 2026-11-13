'use strict';
// file: 'dev/tests-733-map-usage.js'
const sabotage=require('./sabotage.js'),command=['node',['dev/tests-733-map-usage.js']],only='FAIL #733 usage ';
const rc=sabotage.prove({file:'api.js',command,only,cases:[
 {label:'completed request bills the current campaign again',find:'recordUsage(_u,_kind,model,_retries,_tp.server,_usageWorld);',replace:'recordUsage(_u,_kind,model,_retries,_tp.server);',mustFail:only+'atlas completion bills its captured campaign after replacement'},
 {label:'explicit null target falls back to a replacement world',find:'var usageWorld=arguments.length>5?targetWorld:worldState;',replace:'var usageWorld=targetWorld||worldState;',mustFail:only+'explicit null usage target never falls through to a replacement world'},
 {label:'story health ring is created on the replacement campaign',find:'if(!usageWorld.healthLog)usageWorld.healthLog=[];',replace:'if(!worldState.healthLog)worldState.healthLog=[];',mustFail:only+'story completion keeps usage and health on its captured campaign'},
 {label:'billed request loses its captured world',find:'var _usageWorld=worldState;',replace:'var _usageWorld=null;',mustFail:only+'billed empty response stays attributed before parser refusal'},
 {label:'legacy unbound usage callers stop recording their active campaign',find:'var usageWorld=arguments.length>5?targetWorld:worldState;',replace:'var usageWorld=arguments.length>5?targetWorld:null;',mustFail:only+'legacy usage callers still default to the active world'}
]});process.exit(rc?1:0);
