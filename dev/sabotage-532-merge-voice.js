var sabotage=require("./sabotage.js"),code=0;
function prove(file,cases){if(!code)code=sabotage.prove({file:file,command:["node",["dev/run-tests.js","#532"]],cases:cases});}
prove("tag_table.js",[
{label:"fold drops voice",find:'_mgVn=voicePinsFill(_mgVo,[_mgVoiceRow,_mgDupN.charSheet||_mgDupN],voicePinFitsGender(speakerSubjectOfRow(_mgCanN,mgCanon).char.gender));',replace:'_mgVn=0;',mustFail:"#532 the repro"},
{label:"sheet owner ignored",find:'var _mgVo=_mgCanN.charSheet||_mgCanN,',replace:'var _mgVo=_mgCanN,',mustFail:"#532 a sheet owns"},
{label:"stale survivor resurrects",find:'var _mgVoiceRow=_mgCanN.charSheet?null:_mgCanN;',replace:'var _mgVoiceRow=_mgCanN;',mustFail:"#532 sheet ownership"},
{label:"stale duplicate resurrects",find:'[_mgVoiceRow,_mgDupN.charSheet||_mgDupN]',replace:'[_mgVoiceRow,_mgDupN.charSheet,_mgDupN]',mustFail:"#532 sheet ownership"},
{label:"known mismatch carried",find:',voicePinFitsGender(speakerSubjectOfRow(_mgCanN,mgCanon).char.gender));',replace:');',mustFail:"#532 gender fit"},
{label:"stale copies retained",find:'if(_mgCanN.charSheet)releaseRowVoicePins(_mgCanN);',replace:'',mustFail:"#532 sheet ownership"}
]);
prove("helpers.js",[
{label:"overwrite owner",find:'    if(owner[f[i]])continue;\n',replace:'',mustFail:"#532 a sheet owns"},
{label:"omit direction and rate",find:'var f=["voiceDirection","voiceRate"],s,i,k;',replace:'var f=[],s,i,k;',mustFail:"#532 the repro"},
{label:"offline cloud fields lost",find:'  for(i=0;i<(objs||[]).length;i++)for(k in (objs[i]||{}))if(k.length>7&&k.slice(-7)==="VoiceId"&&f.indexOf(k)<0)f.push(k);\n',replace:'',mustFail:"#532 offline merge"}
]);
prove("game.js",[{label:"renamed sheet lookup lost",find:'(ns[i].name===nm||(_spc&&ns[i].charSheet===_spc))',replace:'(ns[i].name===nm)',mustFail:"#532 renamed companion"}]);
process.exit(code?1:0);
