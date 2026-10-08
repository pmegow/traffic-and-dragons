Evidence brief B — reference/runtime/spec separated
Baseline 8715997f6ce1837c032867d4de8477d718dc5b64; tree 3aa32e6c4cb53220ca3efb46eee03d3400829474. No implementation or overall design verdict.

Census reconciliation (NO GAP in these observed totals)
| Mode | Saves | Sheets | Entries | Counted | Equipped lines/order changes | Exit |
|---|---:|---:|---:|---:|---:|---:|
| Latest | 10 | 45 | 1102 | 176 | 13/4 | 0 |
| Owner --all | 77 | 507 | 11490 | 1887 | 56/29 | 0 |
| testRuns --all | 43 | 125 | 3638 | 873 | 1/0 | 0 |

All 120 before/final SHA-256 values match. census.json records each selected path/mtime: newest by filesystem mtime in each directory, not embedded campaign identity or turn; latest excludes 67 older owner files. Traversed sheets: worldState.character (77/43), worldState.npcs[*].charSheet (430/82), optional worldState.pendingLegacy (0/0). No unreadable, missing-world, nonarray, missing inventory or additional object-tree inventory paths occurred. This does not inspect serialized objects inside strings or prove every import shape.

The tool exits from textMismatch+unitMismatch alone (dev/census-inventory-rows.js:103). Duplicate folding skips text comparison (:85); original-unit measurement filters to strings (:75).
| Synthetic census | Exit | Observed limitation |
|---|---:|---|
| junk-only | 0 | Diagnostic does not enter exit failure predicate |
| unmatched-worn | 0 | Diagnostic does not enter exit failure predicate |
| duplicate-fold | 0 | Folding skips text comparison |
| nonarray | 0 | Diagnostic does not enter exit failure predicate |
| no-world | 0 | Diagnostic does not enter exit failure predicate |
| rows | 1 | Existing valid qty2 row measured against zero original string units |
| x0 | 1 | 0 current units versus1 reference unit; mismatch counted twice |
| x01 | 0 | Literal-name grammar accepted, current key still strips suffix |
| unreadable | 0 | Diagnostic does not enter exit failure predicate |

Reference invariant matrix (committed functions unchanged in VM, census:24–45; spec §2/§5.2)
| Rule | Evidence | Factual status |
|---|---|---|
| I1 finite positive whole qty | missing/0/negative/NaN→1;2.9→2; string3→3; Infinity and310-digit count→Infinity | GAP for Infinity; safe upper bound UNDETERMINED |
| I2 first key/order/spelling + sum | Torch x2 + TORCH qty3→Torch qty5; equipped OR;43 cases retain unique keys | NO GAP observed |
| I3 count-free row name | {name:'Arrow x3',qty:2} retains Arrow x3 | GAP in reference |
| I4 boolean/whole row | flags become boolean; string 'false' becomes true; repeated worn only sets one flag | NO GAP in boolean shape; semantic string policy UNDETERMINED |
| I5 unknown own fields | slot object/custom/__proto__ dropped, even without a duplicate | GAP in reference |
| Conflicting extras | both equal and conflicting extras disappear | preservation GAP; conflict policy UNDETERMINED |
| Source ownership |43/43 inputs unchanged; rows fresh, junk object borrowed | NO GAP for nonmutation during call |
| Nonarray/junk | 'Rope' list becomes four character rows; object/number container→[]; entry null/number/nameless→junk | container policy UNDETERMINED |
| API/idempotence | returns {rows,junk,wornUnmatched}; invRows(result.rows).rows stable; invRows(result)→empty wrapper | factual wrapper/list API mismatch; not shipped API |
| Qty precision |9007199254740992+1 stores9007199254740992 | numeric policy bound UNDETERMINED |

Current match table: Y means same/matched; proposed pack parses stored suffix once then applies §2.2 without count stripping; proposed base additionally uses itemBaseName. This is a model, not shipped #599 code.
| Pair | Pack/stash | Pair | Worn/latch | Want | Catalog | Place fold | Proposed pack/base |
|---|---|---|---|---|---|---|---|
|Wolf pelt / Wolf pelts|Y/Y|Y|Y/Y|N|N|N|Y/Y|
|Torch / TORCH|Y/Y|Y|Y/Y|Y|Y|Y|Y/Y|
|Chaos / Chao|Y/Y|Y|Y/Y|N|N|N|Y/Y|
|Glass / Glasses|N/N|N|N/N|N|N|N|N/N|
|Iron‑Key / iron-key|Y/Y|Y|Y/Y|N|N|N|Y/Y|
|Iron - Key / iron-key|Y/Y|N|Y/Y|N|N|N|Y/N|
|Silver  ring / silver ring|Y/Y|Y|Y/Y|Y|Y|N|Y/Y|
|Rope (spare) / Rope|N/N|Y|N/N|Y|Y|N|N/Y|
|Rope (from Ada) / Rope (from Bea)|N/N|Y|N/N|Y|N|N|N/Y|
|Rope — from Ada / Rope|N/N|Y|N/N|Y|Y|N|N/Y|
|Arrow x2 / Arrow|Y/Y|Y|Y/Y|Y|Y|N|Y/Y|
|Model x0 / Model|Y/Y|Y|Y/Y|Y|Y|N|N/Y|
|Model x01 / Model|Y/Y|Y|Y/Y|Y|Y|N|N/Y|
|Arrow x1000 / Arrow|Y/Y|Y|Y/Y|Y|Y|N|Y/Y|
|Modelx3 / Model|Y/Y|Y|Y/Y|N|Y|N|N/N|
|__proto__ / __PROTO__|Y/Y|Y|Y/Y|Y|Y|Y|Y/Y|
|constructor / Constructor|Y/Y|Y|Y/Y|Y|Y|Y|Y/Y|
|toString / tostring|Y/Y|Y|Y/Y|Y|Y|Y|Y/Y|
|Sword / Shield|N/N|N|N/N|N|N|N|N/N|
|Torch    / Torch|Y/Y|Y|Y/Y|Y|Y|N|Y/Y|

Provenance variants are intentional: pack/chest retain them, pair/wants may remove them. Actual add/remove/rename, chest take/heal/place-fold, wants/catalog, pair consumption and latch states/receipts are in matches.json. All20 catalog contexts opened successfully. Removing ambiguous Rope from two provenanced rows refuses; current rename selects the first. Actual tag receipts show x1000 clamped999, x0/x01 literal operands stacking onto Arrow, and equipped rename preserving count/position/worn (tag-writes.json). References: api.js:3178,3215,3273,3309,3335,3343,3347; helpers.js:1960,3398; memory.js:797,967; identity.js:350; game.js:2305.

Reference-only roundtrip
| Measure | Pass1 | Pass1000 |
|---|---|---|
| Units |8|8|
| Exact pack text |Arrow x5; Shield x2; Torch|identical|
| Equipped pack order |Shield; Torch|identical|
| Original worn order |Torch; Shield; Shield; Missing|not persisted in modeled rows|
| Rows bytes |126|126|
| Retained junk count/bytes |3/11|3/11|
| Unknown fields |already absent|absent|

This modeled adapter retains initial junk separately and passes rows through JSON each cycle. It does not demonstrate a shipped migration, I5 preservation, or stale-device safety. Source is unchanged; row identities are newly allocated and junk initially shares its source object. Infinity cases change to qty1 after JSON null serialization. Duration 5ms; no campaign/device persistence.

Run from any cwd:
node C:/Users/hannu/AppData/Local/Temp/tnd-entry39-B/census.js
node C:/Users/hannu/AppData/Local/Temp/tnd-entry39-B/census-negatives.js
node C:/Users/hannu/AppData/Local/Temp/tnd-entry39-B/reference.js
node C:/Users/hannu/AppData/Local/Temp/tnd-entry39-B/matches.js
node C:/Users/hannu/AppData/Local/Temp/tnd-entry39-B/tag-writes.js

Metrics: see metrics.json; UTC 2026-10-08T23:08:35Z–2026-10-08T23:18:32.589Z, 597.589s.43 reference cases,20 pair cases,3 consumable cases,1 ambiguity case,10 tag cases,9 synthetic census cases,1000 roundtrips; no skipped fixtures. Reference observational outputs include the stated invariant gaps; two synthetic census runs exit1 (rows/x0), seven exit0. No test-suite pass claim. Tokens unavailable. No source edits, recommendations, external calls or personal-save writes. Phase3 awaits root.
