var sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'ambient.js',also:['dev/tests-l7-transitions.js'],command:['node',['dev/tests-l7-transitions.js']],cases:[
{label:'forge exit cuts instead of fading',mustFail:'FAIL exterior forge exit overlaps',find:'driver.fade(record.voice, 0, AMBIENT_FADE_SECONDS);',replace:'driver.stop(record.voice);'},
{label:'microphone misses the outgoing voice',mustFail:'FAIL exterior microphone silences BOTH',find:'if (outgoing) driver.gain(outgoing.voice, ambientGain(snapshot, outgoing.scene));',replace:''},
{label:'retirement never releases the outgoing buffer',mustFail:'FAIL exterior forge exit overlaps',find:'outgoing = null; driver.stop(record.voice);',replace:'driver.stop(record.voice);'},
{label:'clock end boundary becomes inclusive',mustFail:'FAIL exterior clock bands cover midnight',find:'m >= bind.from && m < bind.to',replace:'m >= bind.from && m <= bind.to'},
{label:'unrecorded interior becomes exterior',mustFail:'FAIL exterior clock bands cover midnight',find:'s.exterior !== true || ',replace:''},
{label:'rapid return cuts the reused voice',mustFail:'FAIL exterior rapid reentry reverses',find:'outgoing = null; cancelRetirement(returning);',replace:'outgoing = null; driver.stop(returning.voice);'}
]}));
