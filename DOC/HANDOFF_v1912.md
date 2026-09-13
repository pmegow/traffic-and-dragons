# Handoff — Fable session 2026-09-11/12 → next window

**Read this when** picking up TODO #6 (THE VILLAGE) or the day's loose ends. Ephemeral per the trackers rule: open
items live in TODO.md; this file archives as DOC/HANDOFF_v<ver>.md when superseded.

## State

- **Live:** v1.912 (`APP_VERSION`, `sw.js` CACHE `tnd-v3-20260912c`), master pushed, tree clean except the owner's
  untracked files (DOC_TTS_2026_9_11.html, DOC/Research/tabletop_vs_traffic_and_dragons.html, audits/FeatureUsage_*.html,
  testRuns/*). Never stage those.
- **Suite:** 2124 engine assertions + 33 standalone suites green; every sabotage battery caught (6-village-shape 10/10,
  6-village-mode 18/18); applicability 100 %.
- **Owner's play:** the Silas Morne campaign (t121+) is the live save; the default save folder is
  `C:\Projects\traffic-and-dragons\Campaigns\<slug>\saves\` (gitignored — look there first).

## What shipped this session (all pushed)

| Ver | What |
|---|---|
| v1.897 | Removed the "a described face is a shown face" render clause; rebased over Codex's PRs 6–10 |
| v1.898 | #369b deadline observer: sentence windows, "if" is not a hypothetical |
| v1.899 | #305c fourth-button consumable rung answers the need; rotates |
| v1.900 | #110b mana pool grows with the max (rest-landed level no longer strands it) |
| v1.907 | Fable review entry 34 of Astra's voice release (#401/#402): four defects fixed, residues #403–#405 |
| v1.908 | Voice Settings dev-only (owner ruling) |
| v1.909 | #301b denouement frame gets Render + replay buttons |
| v1.910 | **#6 phase A** — CAMPAIGN_KINDS registry, residents outside the party, free hero swap, library write-back, samples/village.blueprint |
| v1.911 | **#6 phase B** — the prompt mode: village DRIVE rule in the adventure rule's slot, preamble variant, ONE note-mode gate, whispers from residents, combat refused loudly, montage/wildcard off, chapter clause |
| v1.912 | **#6 Pax** — symmetric no-harm (harm tags + death envelopes refused, registry copy); whispers about anyone here |

Also: #77, #374, #384, #388, #389, #391 archived ✅; Known issue #22 dropped; #397 (composition lesson) and #400
(render engine + model sheet + two-tier studio) filed; the nine-lens and Panel of Players reviews of the village
(`DOC/panel/reviews/village/`), the Panel of Players itself (`DOC/panel/players/`), and `audits/RECORD_6_village_design.md`.

## THE VILLAGE — where it stands

Design ratified 2026-09-12 (both panels endorsed). Full record: `audits/RECORD_6_village_design.md`; the TODO #6 row is
the column summary. **Built:** A (shape), B (prompt mode) incl. Pax and the whispers re-aim. **Not built:** C (arrival and
return greeting, Car Mode recap, one change per return), D (residents refuse — acceptance test; village rung on the
fourth button ABOVE buy; residents roam the commons; two-resident exchange), E (houses/stash: owner, quantity keys,
loud refusals, ITEM_GAINED gate, node merge, stash rendered in the panel + house description, HOME block as data,
Car Mode undo), F (shops: wares per sub-location + per-shop cap + loud eviction, clock restock, pinned prices,
**buy/sell only in a shop sub-location and every transaction names the player and the NPC** — owner rule 2026-09-12),
G (Hall v1), H (rewards), I (the pre-build failing-test list for E/F), J sequencing: E, F → C, D → G → H.

**Not yet live-played** — the declared evidence hole. First live check: sign in, create a campaign from
`samples/village.blueprint`; the library moves in before the opening scene (loud toast if signed out). Expect the
village DRIVE rule, no combat, Pax refusals in the mutation log, whispers from residents.

**Mechanics the next window must know:**
- Every kind-aware site dispatches through `kindDef()` (helpers.js) reading `CAMPAIGN_KINDS` (data.js). Adventure has
  no overrides; its rules block, preamble and STATE TAGS doc are pinned byte-identical.
- The note registry rows all carry `village:"fires"|"silent"`; the gate is one line in `buildEngineNotes` on the kind
  name; a skipped note never runs (latch untouched).
- Residents: `partyMember:false, resident:true, rel:"resident"`, house node `"<village>|<Name>'s house"` with `owner`.
  The swap core is `swapPlayerCharacter` (game.js); `_switchPlayerCharacter` (ui-sheets.js) is the shell.
- Death in the village: the W2 envelope gate (`w2PrepareResponse`, identity.js) refuses `npc-death` claims with
  "the peace of Pax: …" (registry + copy). Loose HP/COMPANION_HP losses and NPC_DEATH_REPORTED go through
  `__villageHarmRefused` (tag_table.js). A loose SCENE_DEATH is already dropped by the pre-pass — no handler gate.

## Loose ends filed, not done

- #403 cloud-fallback routing + local Piper composite ceiling; #404 provider-table conditionals, actor catalog in
  localStorage, monotonic residues; #405 coverage residues (+ the pre-existing MISSED #396 sabotage case, logged).
- #397 waits on the owner's composition lesson; #400 render engine phase A ready on the owner's word.
- The 2026-09-15 scheduled playtest (Known issue #22 dropped, but the playtest cadence stands per #22's row history).

## Session rules learned (already in memory)

Bash heredocs mangle backslashes and `\n` (the tool layer unescapes) — write scripts with the Write tool and run them.
Test-first is honoured: every fix above went red before green, and every new guard has a sabotage case on a disposable
clone (never in-tree). Speechify audio is owner-validated; only Inworld audio and iOS pickers remain untested, by choice.
