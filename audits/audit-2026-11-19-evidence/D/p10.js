var H=require('./h.js'),log=H.log;
var names=TAG_TABLE.map(function(e){return e.t;});
log("TAG_TABLE.length",names.length);
var notStripped=names.filter(function(n){return TAG_STRIP_NAMES.indexOf(n)<0&&TAG_STRIP_BARE.indexOf(n)<0;});
log("handlers not in strip list",JSON.stringify(notStripped));
var noHandler=TAG_STRIP_NAMES.filter(function(n){return names.indexOf(n)<0&&TAG_NO_HANDLER.indexOf(n)<0;});
log("stripped names with no handler and not in TAG_NO_HANDLER",JSON.stringify(noHandler));
