// Every mutation must name the OpenAI contract it breaks; existing guards stay intact.
var sabotage=require('./sabotage.js');
var selection=[
 {label:'a saved key alone turns on paid OpenAI speech',find:'return _openaiEnabled() && !!_openaiKey()',replace:'return !!_openaiKey()',mustFail:'#398 OpenAI requires opt-in and a key'},
 {label:'an OpenAI failure can bill Google',find:'if (_openaiEnabled() || !geminiTtsEnabled()) return false;',replace:'if (!geminiTtsEnabled()) return false;',mustFail:'#398 OpenAI requires opt-in and a key'},
 {label:'invalid narrator goes to the API',find:'return OPENAI_VOICES.indexOf(v) >= 0 ? v : "marin";',replace:'return v;',mustFail:'#398 OpenAI narrator is validated'},
 {label:'OpenAI loses the speaker map',find:'return _geminiGroupUnits(units, voiceId, voices, forceVoice, _openaiVoiceFor);',replace:'return _geminiGroupUnits(units, voiceId, null, forceVoice, _openaiVoiceFor);',mustFail:'#398 OpenAI grouping preserves words'}
];
var transport=[
 {label:'speech uses the wrong model',find:'model: "gpt-4o-mini-tts", input: g.text',replace:'model: "wrong-model", input: g.text',mustFail:'#398 request uses speech model'},
 {label:'body deadline depends solely on a cooperating fetch',find:'var bytes = new Uint8Array(await response.arrayBuffer());',replace:'clearTimeout(timer); var bytes = new Uint8Array(await response.arrayBuffer());',mustFail:'#398 deadline aborts stalled body'},
 {label:'Stop leaves paid requests running',find:'if (_cloudAbort) _cloudAbort();',replace:'/* cancellation removed */',mustFail:'#398 Stop aborts every prefetched request'},
 {label:'quota responses are treated as audio',find:'if (!response.ok) return { fail: "HTTP "',replace:'if (false) return { fail: "HTTP "',mustFail:'#398 rejected or malformed audio'},
 {label:'PCM plays at the wrong rate',find:'return { bytes: bytes, rate: 24000 };',replace:'return { bytes: bytes, rate: 22050 };',mustFail:'#398 request uses speech model'}
];
var a=sabotage.prove({file:'tts.js',command:['node',['dev/run-tests.js','#398']],cases:selection});
var b=sabotage.prove({file:'tts.js',command:['node',['dev/tests-398-openai.js']],cases:transport});
process.exit(a||b);
