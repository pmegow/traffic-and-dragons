var sabotage = require('./sabotage.js');
process.exit(sabotage.prove({file:'ambient.js', command:['node',['dev/run-tests.js','L7 named exterior locations']], cases:[
  {label:'named outdoor commons excluded',mustFail:'L7 the saved square and yard are outdoors',find:'if (resolve(worldKey + "|" + commons[i]) === key) return true;',replace:'if (resolve(worldKey + "|" + commons[i]) === key) return false;'},
  {label:'unregistered interiors become outdoors',mustFail:'L7 the saved square and yard are outdoors',find:'if (!node.parent || resolve(node.parent) !== world) return false;',replace:'if (node.parent) return true;'},
  {label:'renamed commons lose canonical identity',mustFail:'L7 exterior binding follows canonical identity',find:'resolve(worldKey + "|" + commons[i]) === key',replace:'worldKey + "|" + commons[i] === key'}
]}));
