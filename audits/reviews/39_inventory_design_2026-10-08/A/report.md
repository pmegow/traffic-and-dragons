# Evidence brief A — entry 39 / #599 admission and persistence

Baseline: `8715997f6ce1837c032867d4de8477d718dc5b64`; tree `3aa32e6c4cb53220ca3efb46eee03d3400829474`. All citations below are relative to `C:/Projects/traffic-and-dragons` unless prefixed SERVER. This is factual evidence for senior review, without an adjudication or implementation recommendation. #599 and its version gate are **not shipped**. All ten owner rulings in design §9 are held fixed.

## Hop matrix — current code

`W` means worldState.ver, `S` means character.sheetVer, `C` means checkpoint envelope v. “No version refusal” describes current code, not permission to adopt future data. Runtime probes and source-only paths are distinguished.

| Hop / producer → consumer | Envelope and exact order | First relevant side effect; refusal / rollback | Evidence / coverage |
|---|---|---|---|
| Local startup | W; ui-boot init → adapter.load → loadState → parseWorldState/inflate → memory heal → migration → optional saveCore → initState | sessionLog assigned before world parse; transcript inflater can rescue-write; migration writes live core/log. Parse/migration catch nulls world, not an atomic global rollback | ui-boot.js:460,405; storage-adapter.js:809; state.js:265,840. Actual W10/11/missing/string/null |
| Local campaign switch | slot triple → remove target slot → snapshot outgoing → write live triple → set active id → loadState | target slot deletion precedes admission; storage/load failure restores prior triple/id and target slot | state.js:1204,1235–1252; ui-campaigns.js:260,292. Actual W11 switch |
| .tnd file import | {worldState,sessionLog,memory}, W inside; FileReader → importSaveData | portrait sanitation mutates input before validation; outgoing snapshot before global assignment; active id set, migration, saveAll. No general rollback after global adoption | ui-files.js:665; state.js:1045,1060–1067,1101–1104. Actual five W profiles; accepted import mutates parsed input and attempts sync |
| Manual cloud pull / downloaded Load | API object → _applyPulledCampaign → serialize → writeLiveKeys or writeCampaignSlot → loadState/switch | packet campId assigned first; active triple written before loadState. Storage quota rollback exists; active loadState false does not make this wrapper return false | ui-campaigns.js:299,324,390; state.js:1194. Actual five W profiles; scratch late-refusal interception |
| Automatic cloud adoption | adapter.load(local first) → reconcile GET → transcript-form check → inflate → identity/turn checks → globals → migrate/heal → save | ACK/conflict bookkeeping before adoption; active id/global assignment before migration. Unknown transcript and foreign campaign refuse; no W/S refusal | storage-adapter.js:809,888–1036. Actual intercepted GET/adopt W10 and W11; seven store writes each |
| Checkpoint capture / transport holder | C=1, ws/sl/mem JSON strings; capture → IndexedDB + server checkpoint; restore holder tries IDB then server | capture stamps world.checkpoint and in-memory holder; holder checks C and campaign only | globals.js:173; state.js:760,771,783; game.js:3986,3995; storage-adapter.js:1055. Actual C2 refusal, C1/W11 acceptance |
| Checkpoint restore | C check → JSON parse all three → graft live transcript/turn/id → globals → healMemory → death/camp updates | detached validation before globals; heal exception rolls globals back; no migrateWorldState call; caller later saveAll | state.js:800–839; game.js:4056,4074. Actual five W profiles, no writes within restore |
| .char import | {ver:10,type:character,character}; FileReader extracts character → relationship migration/defaults → preview → wizard/Play/companion | parsed sheet healed before preview; envelope ver discarded; callbacks determine later writes | ui-browsers.js:704–722,482,533. Actual envelope10/11/missing/string/null; nested S11; future envelope→portable→adopt |
| .char / library export | _doExportChar wraps portableSheet in ver10; manual library saves send bare portableSheet; party uploader same boundary | portableSheet clones, attaches item definitions/persona; no new S stamp; file/folder or API write follows confirmation | helpers.js:2235; ui-browsers.js:537,748,770,808; storage-adapter.js:1168. Actual portable absent S stays absent, existing S11 preserved |
| Library read / explicit replace / Village refresh | API list entries {character,updatedAt}; ancestry migration on read; libReplaceApply or timestamp refresh → adopters | identity admission before adopter writes; cloned sheet relationship/scene/item processing; global hero or NPC sheet replacement, stash replay; caller saves | storage-adapter.js:1160; game.js:1589,1608,1634,1642. Actual hero five S profiles, companion S11 |
| Village resident import | bare sheet or {character,updatedAt} → identity check → clone/migrate/scene/item → roster/memory/house | village map/container preparation before per-sheet check; duplicate/identity refusal per row; shell saveAll | game.js:1549–1569; ui-browsers.js:639–650. Actual S11 added; source unchanged |
| Fallen companion rejoin | world.mpFallen[].sheet → roster charSheet | shifts fallen queue; revives NPC and installs sheet directly, voice mirror/HP/core memory; no version/migration gate | game.js:4155–4169. Actual S11 rejoined, input sheet mutated |
| Wizard hero / pending companions | class gear comma text → new bare sheet; pending import sheets → startGame | startGame mutates gender/voices/defaults before id/global world construction; pending companions admitted on identity then inserted; relationshipMigrateWorld later | char-creation.js:324; game.js:10–38; ui-browsers.js:924. Actual S11 pending accepted; startGame source traced |
| Imported Play as new campaign | preview callback → setup modal → snapshot → delete live keys → new id → reset globals → startGame | destructive live-key reset precedes startGame; snapshot failure aborts before reset | ui-browsers.js:592,623–635. Source traced |
| Imported companion | preview → identity/cap/busy checks → clone → item/scene adoption → roster+memory+graph → saveAll → sendAction | first canon effect may be item definitions, then roster; no version check; narration occurs after save | ui-browsers.js:675–701. Actual S11; transport/narration intercepted |
| Home / QuickStart | sample .char envelope → Home extracts character → local handoff {char,bp,at}; game validates payload → snapshot → consume → clamp → delete/reset → startGame | Home drops .char envelope at extraction; handoff consumed before new game admission; busy/snapshot refusal retains handoff | home.html:158–166; ui-browsers.js:34–60. Source traced |
| Blueprint / custom class gear | blueprint format/edition, customClasses[].gear text; normalize → applyBlueprint | pending blueprint assignment; normalize mutates document; apply copies named NPC metadata, not supplied charSheet/inventory. Gear coerced String then wizard splits | game.js:3142,3219–3223,3325,3346–3355; char-creation.js:324. No sheet transport found in implemented NPC seed path; unknown extra JSON properties can exist but are not adopted there |
| Generated sheets | model JSON → normalizeCompanionSheet stub or generateNpcSheet JSON/default/sanitize → relationship migration → sheet install | generated regeneration clears roster portrait before final sheet install; saveAll after installation; model parse errors toast/fallback | game.js:1471–1493; ui-sheets.js:450,483–515. Source only; no model calls |
| Legacy / internal hero swap | pendingLegacy → portable relationship migration; swap promotes existing charSheet/demotes hero | selected in-world objects become live; relationship migration follows ownership change | game.js:1100–1122,1855–1876; identity.js:705–709. World relationship walk includes hero/NPC sheets/pendingLegacy, not mpFallen |
| Character editor file/library/draft | file wrapper or bare object → loadObject → healChar clone → render; draft {ch,dirty,at}; export wrapper ver10; library bare ch | local editor ch assignment; edits debounce localStorage draft; Save downloads or posts. No envelope/S check | character_editor.html:136,313–330,345–357. Source traced, no browser/editor execution |
| Map cleanup | .tnd load directly assigns globals → migration; Live calls loadState; apply exports file or saveAll after confirms | globals before migration; live load may migrate-save before user applies repairs; .tnd apply retains enclosing file | map_cleanup.html:91–110,169–173. Source traced |
| Read-only campaign/sheet viewers | loadCampaignCharacter extracts sheet from live key, slot, or GET; preview/viewer receives bare sheet | no storage write in loader; envelope lost before a later adoption callback | ui-browsers.js:148–158,482. Code-level no loader write found; UI display tolerance unprobed |
| Read-only map/story | independent JSON readers; no state.js | map drops transcript in parsed copy; story exports derived HTML, no campaign writeback | map_viewer.html:145–172; story_compiler.html:131,183. Source traced |
| NPC merge studio tool | .tnd JSON → direct global assignment → approved edits → exported file | bypasses loadState; validates world/memory/character presence only | dev/npc-merge-studio.html:142–153. Source traced; not a read-only viewer |

## Persistence and loader evidence

| Direction | Representation / authority | Evidence |
|---|---|---|
| Live local → POST | tnd_core_v10 JSON via serializeWorldState; sync takes current globals, strips NPC portrait side channel, compresses transcript via wireWorldStateSnapshot; {campaignId,worldState,sessionLog,memory,narrativeHtml,baseTurn} | state.js:324,342; storage-adapter.js:575–595; separate stored-campaign push at1233 |
| Server write → read → adopt | SQLite campaigns.world_state/session_log/memory TEXT; JSON.stringify on write, JSON.parse on GET; ownership, quota, turn-CAS and metadata are inspected. Inventory rows and W/S are not inspected in these handlers | SERVER db.js:75; index.js:574–633,698–707; adapter.js:932–971; manual path ui-campaigns.js:324 |
| Sheet library → server → adopter | POST {character}; characters.char_data TEXT; separate name/level/class/ancestry columns; GET returns bare character in entry; timestamp selects Village refresh | SERVER db.js:109; index.js:728–776; client storage-adapter.js:1160–1168; game.js:1589 |
| Checkpoint | snapshot JSON TEXT containing nested ws JSON string; C independent of W | SERVER index.js:540,557; state.js:760,786 |
| Static direct state.js hosts requiring proposed inventory module before it | index.html503/504; character_editor.html102/103; map_cleanup.html75/76; home.html98/99; blueprint-designer.html141/142; admin_console.html34/35; mementos.html32/33 | All seven currently load helpers immediately before state; inventory.js does not exist |
| Generated loaders / app shell | dev/engine-manifest.js27/28 feeds dev/load-engine.js, test.html40, dev/npc-merge-studio.html124; sw.js27/28 caches helper/state | Proposed loader addition affects manifest consumers and SW list; map/story readers do not load state.js |

The local SERVER checkout is revision `025877aca0249d960266e90dd56c393209ecda41`. Its handlers parse JSON and inspect metadata, so the design's literal “parses neither” statement is not code-accurate. No inventory or save-schema conversion was found in the inspected persistence handlers. Deployment parity is UNDETERMINED: no server execution or network request was made.

## Actual observations and nonproduction simulations

| Evidence class | Result / gap status |
|---|---|
| CURRENT: five versions through six representative doors | W/S/envelope 10,11,missing,"future",null accepted through local load, .tnd, checkpoint world, manual pull, hero adopter and .char preview. Code-level future-version gate gap found, consistent with proposal not shipped |
| CURRENT: nested/secondary sheets | W10/S11 hero, companion, resident, pending companion and fallen sheet admitted; S11 .char preview accepted. No future-sheet refusal found |
| CURRENT: automatic adapter | Intercepted actual adapter.load GET adopted W10 and W11 at turn6, seven store writes each; zero real network. Source packet mutation reflects inflation/migration |
| CURRENT: old reader/writer with future row | [{name:Torch,qty:3,equipped:true}] joins as [object Object]; addInventoryItem appends string Torch beside row. This is actual pre-gate behavior, not a #599 repair test |
| SIMULATION: profiles | Hypothetical early >max check: pre-gate accepts10/11; gate-only max10 refuses11 with zero writes/sync and unchanged source; future-row-profile max11 accepts11. Profile names indicate admission policy only: no future inventory implementation is simulated |
| SIMULATION: late loadState guard | Manual cloud wrapper still returns true, writes four times and replaces live core when loadState is intercepted to return false. Reachable pre-admission write gap located in caller order |
| SIMULATION: world-only guard | W10 containing S11 imports and attempts one sync; nested-sheet coverage gap demonstrated |
| SIMULATION: rejection then later save | Refusing incoming W11 alone does not disable saveAll on retained W10; four local writes and one intercepted sync attempt. This does not establish what a future gate implementation will do |
| SIMULATION: update/retry | Early refusal preserves source; changing supported maximum to11 makes the same source eligible. Actual updated-build/UI retry behavior UNDETERMINED |
| CURRENT: .char envelope lifecycle | W-style file ver11 disappears at character extraction; portableSheet adds no S; bare adopter accepts it. Stamp retention holds only if S already exists |
| CURRENT: checkpoint negative | C2 refused with no writes; C1/W11 accepted. No gap in the existing outer-version check found; it is independent of the proposed world gate |
| DOCUMENTED / UNCERTAIN | Missing/malformed-version admission policy is not specified in §5.4; current tolerance is measured. No policy inferred here |
| SW / old open tab | sw.js103–115 skipWaiting/claim changes controlling worker, not already-evaluated page functions; cache-first shell at205. Navigation/update discovery is not evidence that an old open tab now runs the gate. Verified updated runtime was not exercised; no rollout action taken |

## Commands, receipt and limits

Run from this TEMP directory:

```powershell
node ./probe-extended.cjs   # actual entry probes + explicitly labelled simulations
node ./adapter-probe.cjs   # actual adapter; fetch fully intercepted
node ./extra-probe.cjs     # future row, envelope loss, post-refusal save
node ./verify.cjs          # recorded-result assertions + tracked source hashes
```

Results retain before/after global hashes, active id, live-key hash/key list, source-input hash equality, write sequence, sync attempts, events and return/error in `extended-probes.json`, `adapter-probes.json`, and `extra-probes.json`. Scripts use `dev/load-engine.js` and `makeTestWorld`, disposable stores and intercepted UI/network callbacks. No personal saves, provider/server calls, credentials, repo edits, staging or commits occurred.

The matrix is a code census, not end-to-end browser coverage of every door. Editor, wizard start, QuickStart, cleanup, generated-sheet and viewer paths are source-traced only; their future-gate behavior is UNDETERMINED. No #599 migration-losslessness claim is made. No storage-key, release-order, WORN-duration or other owner decision was reopened.

Initial adapter harness failed because the disposable DOM lacked addEventListener; after adding that inert stub both actual adapter cases passed. An initial unquoted PowerShell Git tree expression was corrected. Neither failure was a product finding.

Measured start: 2026-10-08T23:08:26.4250531Z (initial documentation read preceded this stamp). End/wall and final hashes are in `final-receipt.json`. Tokens: UNAVAILABLE. Source check covers 1,014 tracked JS/HTML/Markdown files; unchanged. SERVER index/db SHA-256 values are in `receipt-data.json`. No scope expansion. Monotonic resources: finite per-case fixtures/results only; test timers bounded, no production listeners or persisted registries added.
