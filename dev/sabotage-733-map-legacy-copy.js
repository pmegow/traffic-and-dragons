// Due-selection inputs consumed by dev/battery-targets.js:
// file: 'dev/tests-733-map-legacy-copy.js'
// file: 'dev/tests-733-map-legacy-browser.js'
// file: 'dev/fixtures/map-733-kaelon-evidence.json'
'use strict';
const sabotage=require('./sabotage.js'),command=['node',['dev/tests-733-map-legacy-copy.js']],only='FAIL #733 legacy copy ';let rc=0;
rc|=sabotage.prove({file:'dev/map-legacy-copy.js',command,only,cases:[
{label:'changed original bytes bypass the reviewed source pin',find:'if(sourceHash!==manifest.source.sha256)return fail("original source fingerprint changed; no copy was created");',replace:'',mustFail:only+'source byte drift refuses the entire proposal'},
{label:'dead or refused public history becomes authority',find:'||row.db||row.dead||row.rf||row.bk',replace:'',mustFail:only+'dead refused bookkeeping and player sources cannot certify a fact'},
{label:'changed public text reuses a stale reviewed quote',find:'||row.x!==s.text',replace:'',mustFail:only+'changed source text and shifted transcript identity refuse'},
{label:'a reviewed source leaks into another containing place',find:'if(primary.location!==f.container)return fail("fact "+i+" primary scope differs from its public source");',replace:'',mustFail:only+'quote bounds and primary scope are checked before admission'},
{label:'bearing becomes known without reviewed directional evidence',find:'(!refs.length&&(k!=="bearing"||f.bearing!=="unknown"))',replace:'false',mustFail:only+'known bearing needs reviewed per-attribute source evidence'},
{label:'duplicate proof identities silently merge',find:'if(own(labels,labelKey))return fail("duplicate reviewed label in "+f.container);',replace:'',mustFail:only+'duplicate reviewed labels cannot silently coalesce different proof records'},
{label:'idempotent migration accepts a missing atlas backup',find:'if(!obj(A.legacyAtlas)||services.hash(JSON.stringify(A.legacyAtlas))!==manifest.source.atlasSHA256)return fail("original atlas backup is absent or changed");',replace:'',mustFail:only+'idempotence requires the original atlas backup and coherent proof stamp'},
{label:'idempotent migration accepts rewritten proof metadata',find:'if(JSON.stringify(stamp.admitted)!==JSON.stringify(admitted))return fail("migration proof declarations changed");',replace:'',mustFail:only+'idempotence requires the original atlas backup and coherent proof stamp'},
{label:'unbounded report lists accumulate in the copy',find:'if(manifest.withheld.length>128||manifest.limitations.length>32)return fail("report collection exceeds its bounded capacity");',replace:'',mustFail:only+'report collections are bounded and contain only explicit strings'},
{label:'unhandled source checkpoint ownership survives the clone',find:'if(p)return fail("unhandled source owner stamp at "+p+"; checkpoint or archive needs explicit migration");',replace:'',mustFail:only+'unhandled source ownership in checkpoint snapshots refuses the copy'},
{label:'shared restamp changes public transcript without refusal',find:'return fail("shared restamp changed a non-ownership field: "+edit.path);',replace:'{}',mustFail:only+'a restamp helper cannot alter non-ownership history'}
]});
rc|=sabotage.prove({file:'dev/migrate-733-map-copy.js',command,only,cases:[
{label:'importable copy is published before the original backup',find:'// The complete preimage must exist and verify before an importable copy is published.',replace:'writeOnce(path.join(out,"Kaelon_t7_public_map_copy.tnd"),JSON.stringify(candidate,null,2),io);',mustFail:only+'failed backup write never publishes an importable copy'},
{label:'retained differing artifacts silently count as success',find:"throw Error('Refusing to overwrite differing retained artifact: '+file);",replace:'return false;',mustFail:only+'published artifacts are repeatable and differing retained bytes are never overwritten'},
{label:'memento depends again on calendar day and runtime version',find:"return html.replace(footer,'<footer style=\"overflow-wrap:anywhere\">Chronicled by Traffic and Dragons &middot; Legacy source turn '+esc(world.turn)+' &middot; SHA-256 '+esc(sourceHash)+'</footer>');",replace:'return html;',mustFail:only+'memento provenance is stable across calendar days and application versions'}
]});process.exit(rc?1:0);
