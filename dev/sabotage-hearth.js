var sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'ambient.js',command:['node',['dev/run-tests.js','Interior hearth defaults']],cases:[
 {label:'profile-first bypass silences saved tavern',mustFail:'Hearth saved tavern profile selects chatter',find:'if (ambientAuthoredProfileMatches(s, scene)) {',replace:'if (false) {'},
 {label:'unclassified homes lose their default',mustFail:'Hearth defaults serve classified interiors',find:'if (!classified && !s.habitable) return null;',replace:'if (!classified) return null;'},
 {label:'unclassified unknown places acquire fire',mustFail:'Hearth defaults preserve silence',find:'if (!classified && !s.habitable) return null;',replace:''},
 {label:'default ignores profile constraints',mustFail:'Hearth defaults preserve silence',find:'if (classified && !ambientProfileCompatible(s, scene)) continue;',replace:''},
 {label:'closed tavern retains chatter',mustFail:'Hearth tavern chatter obeys opening hours',find:'s.open === true && bind.common === s.common',replace:'bind.common === s.common'}
]}));
