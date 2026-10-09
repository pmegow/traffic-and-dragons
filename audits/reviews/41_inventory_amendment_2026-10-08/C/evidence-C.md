# Evidence brief C — entry 41: row preservation and monotonic resources

Evidence only, no verdict. Repo C:/Projects/traffic-and-dragons. Read AGENTS.md, CLAUDE.md, entry41 (todo_checkWithFable.md:527), design, entry39 audit and receipt #design599. No repository edits. Actual engine reports invRows/invHealSheet/invFind all undefined. Proposed-contract hazards below are not shipped row-runtime bugs. Probes load actual dev/load-engine.js; catalogs are synthetic projections of proposed conflicting rows.

Relaxed I2 preserves different extras but itemKey then cannot identify a row. Design §4.1 still says catalogs map directly because rows are unique; §4.3 uses key-only delete marks; §2.4 specifies exact-key-first invFind. Current catalogs aggregate to unique keys (helpers.js:3398,3458); direct mapping removes that protection. Two Torch rows with qty2/3 and slot left/right produce duplicate ledger keys. One mark acts twice. The actual resolver returns the first exact key and checks ambiguity only on provenance-free fallback (api.js:3326). Existing delete marks retain index+name (helpers.js:2488–2524); key-only marks discard that discriminator. A selection/ambiguity contract is missing for find/add/remove/rename/equip/count, deletes and trades.

Literal counted names have a second ambiguity: {name:'Torch x2',qty:1} and {name:'Torch',qty:2} both project to 'Torch x2'. Sync reconstructs from lines and replaces inventory (ui-modals.js:222–243); design §4.3 promises only equipped preservation by key, not extras. A no-op text roundtrip needs a retained metadata/identity contract. I3 and §2.2's assumption that stored names never contain counts also conflict with the receipt's explicit literal-name answer.

I5 says every write, but proposed invAdd/removal interfaces carry names/counts, and §4.5 keeps chest/move shapes. ledgerApply sends name/count to fileLocationItem and stashMoveRecord (game.js:392–393). The latter stores pack:{name,units} (memory.js:948–954); undo/replay reconstruct by name (game.js:1809,1837). These paths have no extras channel. Whether transfer intentionally ends metadata ownership is unspecified. Preserving extras during fold does not demonstrate preservation through transfer/undo.

| Proposed contract | Evidence / gap status |
|---|---|
| qty1–9999; overflow refusal | Gap: healing explicitly covers nonfinite/noninteger stored counts but not finite0/negative/>9999, string-count overflow, or two valid rows overflowing during fold. Existing QTY_MAX999/_qtyParse clamp versus add/fold10000 establish compatibility baselines only. |
| equipped true only for true | No coercion ambiguity in the rule. Invalid former value retention/diagnostic remains unspecified; it is a known-field normalization, distinct from unknown-field I5. |
| deep-equal extras only fold | Preservation intent covers JSON extras; downstream duplicate identity and equality value domain remain gaps. |
| invRows list; invHealSheet junk | Gap: diagnostics channel from list-only return to owner unspecified. Non-array original retention conceptually lossless for JSON; malformed existing inventoryJunk/collision policy unspecified. |
| JSON deep-copy ownership | No alias gap on tested JSON nested extras. Outside JSON domain undefined keys disappear, NaN→null, -0→0, Infinity qty→null. Capture malformed-count evidence before copying or specify canonical domain. |

| Actual probe | Output |
|---|---|
| Ledger keys, both builders | ['torch','torch'] |
| One shop torch:1 mark | Two qty1 lines, sellCp20, ok:true |
| One stash torch:1 mark | Two qty1 lines, stowed2, ok:true |
| Exact / fallback ambiguity | index0 / -1 with two candidates |
| Existing index+name delete mark | Only index1 selected |
| Slice decrement | Live qty3→2 |
| JSON deep-copy nested mutation | Live socket stays2 |
| 10,000 copy operations | Source stays64 bytes; no heap/GC assertion |

'Keyed by row' does not define stable identity after reorder/fold/rename or preserved duplicates. 'Per sheet per load' does not say whether reload appends another durable note. Conflict warnings could repeat each prompt unless bounded separately. Fixed-input heal/load loops cannot yet be measured because the API is absent.

| Accumulation scope | Evidence and outstanding ownership |
|---|---|
| Call | Fresh lists, deep copies, equality/key maps, diagnostics: transient O(input bytes). No new retained row cache specified. |
| Turn | Repeated prompt/admission heal, snapshots/preflights, pair maps and warnings. Junk/warning non-growth needs actual loop tests. |
| Session | Delete marks reset by campaign/owner/modal lifecycle (ui-sheets.js:36–80); ledger marks close/reset (ui-modals.js:39–84). Existing _invCatWarned/_coinValueCache grow with distinct keys/values (helpers.js:1995,2218); alias index replaced. |
| Campaign | Rows/extras/junk/stamps, latches, histories/preimages, rings. Consumable kept/pending prune live keys (game.js:2351–2359); move cap200, tag/note cap40. Conflicting rows intentionally retained; junk lifecycle remains unspecified. |
| Device | Campaign/checkpoint/library/export copies; single editor draft slot; SW caches. Retained bytes multiply through copies, no per-heal key proposed. No inventory wasm instance; unrelated existing audio wasm not soaked. |

Probe timing recorded in probes-output.txt. Agent elapsed/tokens unavailable. Eleven functions.exec calls through durable report creation. One exploratory command had missing engine-context.js/invalid Windows glob; corrected to load-engine.js. One report save failed because sandbox TEMP changed between calls; durable escalated TEMP then used. No full suite run by this agent (parent reports2809 passing); no browser render/device rollout. Pure-engine evidence is not visual verification.
