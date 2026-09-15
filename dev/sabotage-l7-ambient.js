var sabotage = require("./sabotage.js"), rc = 0;
var also = ["index.html","sw.js","blueprint-designer.html","ui-ambient.js","ui-boot.js","ui-panels.js","ui-shell.js","stt.js","dev/engine-manifest.js","dev/tests-l7-ambient.js","sfx/smithy-fire-v2.mp3"];

rc |= sabotage.prove({also:also,file:"ambient.js",command:["node",["dev/run-tests.js","L7 ambient scene policy"]],cases:[
 {label:"disabled preferences can start a fire",mustFail:"L7 fire needs enabled",find:"!s.enabled || ",replace:""},
 {label:"closed or missing hours can start a fire",mustFail:"L7 fire needs enabled",find:"s.open === true && ",replace:""},
 {label:"microphone no longer silences the fire",mustFail:"L7 fire needs enabled",find:"s.capturing ? 0 : ",replace:""},
 {label:"pause intent no longer suppresses ambience",mustFail:"L7 fire needs enabled",find:"s.held || ",replace:""},
 {label:"hidden narration loses its room",mustFail:"L7 fire needs enabled",find:"(s.hidden && !s.speaking)",replace:"s.hidden"}
]});
rc |= sabotage.prove({also:also,file:"ambient.js",command:["node",["dev/tests-l7-ambient.js"]],cases:[
 {label:"same-scene source is recreated on every UI sync",mustFail:"FAIL L7 same scene reuses one source",find:"!desired.scene || source || pending",replace:"!desired.scene || pending"},
 {label:"stale decoded audio is admitted after leaving",mustFail:"FAIL L7 leave during load",find:"!disposed && !job.cancelled && job.epoch === epoch) {",replace:"!disposed) {"},
 {label:"audio failure retries on every UI update",mustFail:"FAIL L7 failure is visible once",find:"pending || failedKey === key",replace:"pending"},
 {label:"decoded memory cap is removed",mustFail:"FAIL L7 buffer admission",find:"buffer.length * buffer.numberOfChannels * 4 > bed.maxDecodedBytes ||",replace:""}
]});
rc |= sabotage.prove({also:also,file:"stt.js",command:["node",["dev/tests-l7-ambient.js"]],cases:[
 {label:"native microphone starts before silence",mustFail:"FAIL L7 native microphone",find:'_capture(true);\n      _rec.start();',replace:'_rec.start();\n      _capture(true);'},
 {label:"cloud microphone starts without silence",mustFail:"FAIL L7 cloud microphone",find:'    _capture(true);\n    navigator.mediaDevices.getUserMedia',replace:'    navigator.mediaDevices.getUserMedia'}
]});
process.exit(rc);
