# #538: remaining hero graph, faction and relationship boundaries

Baseline 65fbf748 / v1.1187. This closes the remaining NPC_LINK, NPC_FACTION and relationship-write legs; the earlier NPC_NOTE/PRONOUN/MERGE legs already shipped with #504. Imported epithet collisions and namesake admission remain #542, and alias-to-existing-record reveal policy remains #544. Root owns markers, TODO, full gate and shipping.

## Root cause and reviewed boundary

The NPC_LINK handler recognized only literal player while npcLinkUpsert stored arbitrary caller strings without self-edge checks. The faction writer allocated graph/membership/faction state for a hero operand. Explicit and legacy relationship writers migrated sheets and queued decisions without validating self-edges or NPC-only owners; a shadow roster sheet could receive a hero-named companion write.

personEntityKey centralizes person endpoints (current hero exact/case/alias/player becomes the current sheet name; other names retain resolveNpcName behavior). relationshipEntityKey delegates. Graph writers normalize/refuse before allocation, returning truthful results used by tag receipts. relationshipWriteTarget admits the directed write before either explicit or legacy path migrates a sheet or creates a queue. It rejects hero companion owners and canonical self-edges; legitimate companion→hero and NPC↔player relationships continue. No existing identity records are deleted, general NPC resolution is unchanged, and existing bond confirmation/preimage mechanics remain.

Independent Astra critical pre-review approved this design. Post-review APPROVE: 54 independent boundary-matrix assertions and 7 actual-swap assertions passed. Review also confirmed the pre-existing demoted-hero sheet-alias lookup gap: after promoting Bram, the former hero Tess's sheet-only Bellkeeper alias is not resolved to Tess. This is explicit follow-on acceptance for #542, not a regression or a repaired leg in this checkpoint.

## Failure-first evidence

Temporary actual-engine baseline: seven failures (hero casing and aliases in graph, normalized graph self-edge, hero faction allocation, self bond, self legacy queue, shadow hero-owned companion edge) and one valid companion→hero control passed. Display stubs were corrected before this baseline; an integration-in-progress conflict marker temporarily prevented a probe, with no tracked edits.

Tracked engine section: 5/5 failed before runtime changes; after implementation 5/5 pass. Fixtures exercise actual tags AND direct writers, exact/case/player/epithet forms, no graph allocation on refusal, no migration/queue mutation, truthful receipts, companion→hero, canonical companion self-refusal, actual hero swap and later-turn bond confirmation. Existing W7 section: 28 assertions pass.

An initial patch script had a quoting syntax error and performed no writes. A subsequent passing focused assertion run exposed the W2 refusal-copy census treating local reason assignments as transaction reasons; the unrelated relationship admission local is named why, while its messages remain directly logged and returned in mutation receipts. W2 reason registries and copy are unchanged.

New named mutations: 11/11 caught. Retained W7: 26/26 caught; retained #504 title/earlier hero boundaries: 55/55 caught. Retained #269 memory hygiene, including graph bond precedence: 10/10 caught. Total retained named proofs: 91/91, each disposable clone restored byte-identical. Retained applicability: 2709/2709 clauses across 307 batteries. No retained mutation anchors changed. No private saves changed and no live/paid calls used. Root compared three standard saved campaigns: stable and volatile prompts remain byte-identical to baseline 5751f292, with source save hashes unchanged.

## Prompt and resource effects

No prompt wording changes. Canonical graph output and refusal receipts can change only when these writes occur. This is admission at write time, not migration of existing malformed graph edges or deletion of imported records.

Per-call: scalar canonical names and short result objects only. Per-turn: rejected writes create no graph, sheet rows or review queue entries; accepted paths retain existing behavior. Per-session: no caches, listener or timer additions. Per-campaign: existing graph/relationship schema and queue caps unchanged; canonical endpoint dedupe avoids redundant spellings. Per-device: no storage keys, workers, vendor state or network changes. Direct callers receive the same protection as tags.
