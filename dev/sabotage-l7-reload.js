var sabotage = require('./sabotage.js');
process.exit(sabotage.prove({file:'ui-ambient.js',command:['node',['dev/run-tests.js','L7 ambience reload']],cases:[
 {label:'saved enablement never starts audio',mustFail:'L7 reload starts saved enabled audio',find:'sync(); if (enabled) unlock();',replace:'sync();'},
 {label:'pending autoplay blocks user activation',mustFail:'L7 reload starts saved enabled audio',find:'(gesturePending && !fromGesture)',replace:'gesturePending'},
 /* stale-target repair 2026-09-18: audit F5 added the re-subscribe to the restore handler. Same clause, same mutation — the restored page never re-unlocks. */
 {label:'page restoration remains silent',mustFail:'L7 reload starts saved enabled audio',find:'window.addEventListener("pageshow", function() { subscribe(); sync(); if (enabled && !unlocked) unlock(); });',replace:'window.addEventListener("pageshow", function() { subscribe(); sync(); });'}
]}));
