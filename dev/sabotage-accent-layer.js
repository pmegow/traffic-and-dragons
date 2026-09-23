// Mutation proof for the accent layer (Proposal_general_audio.html §21): every rule below must turn a named test red.
const sabotage=require('./sabotage.js');let rc=0;
const also=['index.html','sw.js','ui-ambient.js','audio-scenes.js','audio-cache.js','dev/engine-manifest.js',
 'dev/audio-delivery.json','dev/build-audio-catalog.js','sfx/accent-footsteps-wood-v1.mp3'];   /* the standalone suite reads these by path */
const engine=['node',['dev/run-tests.js','L7 accent']],standalone=['node',['dev/tests-accent-layer.js']];
rc|=sabotage.prove({also,file:'audio-accents.js',command:engine,cases:[
 {label:'accents play over narration',mustFail:'L7 accent scheduler',find:'var quiet = !env.speaking && now - env.quietSince >= ACCENT_SETTLE_MS',replace:'var quiet = true'},
 {label:'a set due during speech is saved up for afterwards',mustFail:'L7 accent scheduler',find:'{ st.due[set.id] = now + accentGapMs(set, rng); return; }',replace:'return;'},
 {label:'footsteps play on under rain',mustFail:'L7 accent scheduler',find:'(env.raining && set.rain === "stop")',replace:'false'},
 {label:'two accents inside 30 s',mustFail:'L7 accent scheduler',find:'if (now - st.lastPlay < ACCENT_SPACING_MS)',replace:'if (false)'},
 {label:'arrival is not quiet',mustFail:'L7 accent scheduler',find:'now + ACCENT_ARRIVAL_QUIET_MS + rng()',replace:'now + rng()'},
 {label:'the same step twice running',mustFail:'L7 accent burst',find:'if (n > 1 && pick === cut)',replace:'if (false)'},
 {label:'footsteps in an empty room',mustFail:'L7 accent selection',find:'(!(a.needsAny || []).length || a.needsAny.some(heard))',replace:'true'},
 {label:'an unheard mix plays',mustFail:'L7 accent selection',find:'ok.contents && ok.mix;',replace:'ok.contents;'},
 {label:'every walk plays at one fixed level',mustFail:'L7 accent scheduler',find:'return g[0] + rng() * (g[1] - g[0]);',replace:'return g[1];'},
 {label:'a sprite shorter than its cuts is kept',mustFail:'L7 accent sprite admission',find:'c[1] <= buffer.duration',replace:'true'}
]});
rc|=sabotage.prove({also,file:'audio-profile.js',command:engine,cases:[
 {label:'the bed selector picks an accent set',mustFail:'L7 accent selection',find:'return a.role!=="accent"&&!a.seedOnly',replace:'return !a.seedOnly'}
]});
rc|=sabotage.prove({also,file:'audio-accents.js',command:standalone,cases:[
 {label:'the mic leaves accents scheduled',mustFail:'the mic cancels the schedule',find:'clearTimer(); hush(0); st = null; return;',replace:'return;'},
 {label:'leaving a place keeps its buffers',mustFail:'leaving releases the buffer',find:'releaseAll(); st = null; failed = {}; key = nextKey;',replace:'st = null; failed = {}; key = nextKey;'},
 {label:'accents race the bed decode',mustFail:'accents never load while the bed is still decoding',find:'if ((driver.bedPending && driver.bedPending()) || !driver.idle()) return true;',replace:'if (!driver.idle()) return true;'},
 {label:'a load deferred behind the bed waits forever',mustFail:'a deferred accent load retries once the bed settles',find:'if (waiting) timer = driver.later(tick, ACCENT_RETRY_MS);',replace:''},
 {label:'a memory refusal raises a failure toast',mustFail:'a memory refusal is logged',find:'if (/budget/.test(e && e.message)) driver.warn(',replace:'if (false) driver.warn('}
]});
rc|=sabotage.prove({also,file:'dev/build-audio-catalog.js',command:standalone,cases:[
 {label:'the builder accepts a broken accent set',mustFail:'builder accepted a broken accent set',find:"if (asset.sprite) validateAccent(asset);",replace:''}
]});
process.exit(rc);
