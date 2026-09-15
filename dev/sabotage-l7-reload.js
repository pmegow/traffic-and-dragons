var sabotage = require('./sabotage.js');
process.exit(sabotage.prove({file:'ui-ambient.js',command:['node',['dev/run-tests.js','L7 ambience reload']],cases:[
 {label:'saved enablement never starts audio',mustFail:'L7 reload starts saved enabled audio',find:'sync(); if (enabled) unlock();',replace:'sync();'},
 {label:'pending autoplay blocks user activation',mustFail:'L7 reload starts saved enabled audio',find:'(gesturePending && !fromGesture)',replace:'gesturePending'},
 {label:'page restoration remains silent',mustFail:'L7 reload starts saved enabled audio',find:'window.addEventListener("pageshow", function() { sync(); if (enabled && !unlocked) unlock(); });',replace:'window.addEventListener("pageshow", sync);'}
]}));
