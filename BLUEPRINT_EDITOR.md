# Blueprint Editor — Handoff / Planning Doc

**Status:** Requirements drafted, nothing built. This is the pre-implementation handoff.
**Reference fixture:** `rise_of_the_runelords.blueprint` (hand-authored, complete example).
**Related shipped work:** Remedy A (v1.137) — per-arc `dnaHint` anti-drift. See §6.4.
**Related TODO:** #23 (Blueprint cloud library — partly built), #5 (Campaign Designer — different feature, AI-generated).

---

## 1. Purpose & scope

A UI to **create, edit, and save campaign blueprints** without hand-writing JSON.

A blueprint is the campaign *authoring package* — skeleton (3-act spine + arcs), seeded NPCs,
locations, custom rules, and metadata. It is **NOT** a save file: no player character, no HP/XP/gold,
no combat, no transcript. A blueprint + a fresh character = a new campaign.

---

## 2. Current machinery (what already exists — reuse, don't rebuild)

| Piece | Location | Role |
|---|---|---|
| `applyBlueprint(bp)` | `game.js:278` | Consumes a blueprint at campaign start — stamps skeleton act/arc status, seeds `worldState.npcs` + `memory.npcs`, seeds `memory.locations` + `memory.map.nodes`, appends `customRules`, sets region + location + `proseAuthor`. |
| `_applyBlueprint(bp)` | `ui.js:710` | Char-creation-flow entry: sets `pendingBlueprint`, shows banner, jumps to step 2. **HAS A STALE BUG — see §6.2.** |
| `buildBlueprintFromGame()` | `ui.js:601` | Packages the active campaign into a blueprint (strips run state, resets act/arc status to pending). The editor's "edit from active game" path feeds from this. |
| `exportBlueprint()` | `ui.js:640` | File menu → download/cloud-save the active game as a blueprint. |
| `showBlueprintBrowser()` | `ui.js:723` | Local `.blueprint` file import + cloud library tabs. Editor likely launches from here + from the creation flow. |
| `_showBlueprintExport…` | `ui.js:~650` | Export modal (name + voice + counts). Good UX pattern to mirror. |
| Server library | `storage-adapter.js:384` | `listBlueprintLibrary` / `saveBlueprintToLibrary` / `deleteBlueprintFromLibrary`. Server table `(user_id, slug, name, blueprint_data, updated_at)`. |

---

## 3. The schema (canonical reference — from the Runelords fixture)

```jsonc
{
  "format": "tnd-campaign-v1",          // SEE §6.1 — two format strings exist in the wild
  "name": "Rise of the Runelords",
  "proseAuthor": "abercrombie",          // AUTHORS id, or "" — constrained dropdown
  "author": "Paizo (adapted…)",          // human credit string (free text)
  "tone": "high_fantasy",                // SEE §6.3 — INVALID id in the fixture; valid: high/gritty/swords/dark/politic/custom
  "startingLocation": "Sandpoint",
  "startingRegion": "Varisia",
  "premise": "One paragraph…",
  "acts": [
    {
      "title": "The Skinsaw Murders",
      "goal": "…",
      "turningPoint": "…",
      "parallel": false,
      "arcs": [
        { "title": "Festival of Fire", "objective": "…", "type": "combat" }
        // type ∈ combat | investigation | exploration | social
        // NOTE: no "dnaHint" in blueprints today — SEE §6.4
      ]
    }
  ],
  "npcs": [
    { "name": "Ameiko Kaijitsu", "role": "ally", "pronouns": "she/her", "notes": "…" }
    // role ∈ ally | enemy | neutral | … (freeform today)
  ],
  "locations": [
    { "name": "Sandpoint", "description": "…" }
  ],
  "rules": [ "string", "string" ]
}
```

**Divergence from export-from-game shape** (`buildBlueprintFromGame`, `ui.js:627`):
- Emits `format: "tnd-blueprint-v1"` (different string!)
- Has **no** `author`, **no** `tone`
- NPC `notes` only captures `memory.npcs[name].knowledge[0]` (lossy)

---

## 4. Requirements

### Entry points
- **R2.1** New blueprint from scratch (empty editor).
- **R2.2** Edit an existing `.blueprint` file (loaded from device).
- **R2.3** Edit a blueprint from the cloud library.
- **R2.4** Edit the active game as a blueprint (feed from `buildBlueprintFromGame()`), review/clean, then save.

### Fields to manage
- **Metadata:** `name`, `author` (free text), `proseAuthor` (dropdown), `tone` (dropdown), `startingLocation`, `startingRegion`, `premise` (textarea).
- **Acts (1–N):** `title`, `goal`, `turningPoint`, `parallel` (bool). Add / remove / reorder.
- **Arcs (per act):** `title`, `objective`, `type` (dropdown enum), `dnaHint` (see R6.4). Add / remove / reorder within act.
- **NPCs:** `name`, `role`, `pronouns`, `notes`. Add / remove / reorder.
- **Locations:** `name`, `description`. Add / remove / reorder.
- **Rules:** string list. Add / remove / reorder.

### Validation
- **R4.1** `tone` constrained to live `TONES` ids; migrate bad legacy values (e.g. `high_fantasy`→`high`) on load.
- **R4.2** `proseAuthor` constrained to `AUTHORS` ids or empty; warn (not block) on unknown.
- **R4.3** `type` constrained to the arc-type enum.
- **R4.4** ≥1 act per blueprint, ≥1 arc per act, `name` + `premise` required to save.
- **R4.5** Inline validation; block save on hard errors, warn on soft.

### I/O & round-trip
- **R5.1** Load accepts **both** `tnd-campaign-v1` and `tnd-blueprint-v1`; normalize to one canonical shape.
- **R5.2** Save to `.blueprint` file (download) + cloud library. Decide overwrite-in-place vs. always-new.
- **R5.3** Lossless round-trip: load Runelords → save unchanged → schema-equivalent output (don't drop `author`).

### UX
- **R7.1** Collapsible act cards with arcs nested inside (the nesting is the hard UI problem).
- **R7.2** Reorder (drag or up/down) for acts, arcs, NPCs, locations, rules.
- **R7.3** Live counts summary (reuse the export modal's pattern).
- **R7.4** Unsaved-changes guard on close.

---

## 5. Findings / bugs to fix as part of this work

### 6.1 — Canonicalize the schema  *(PREREQUISITE — gates everything)*
Two format strings for the same artifact (`tnd-campaign-v1` hand-authored vs `tnd-blueprint-v1`
export-from-game), with divergent fields. Pick ONE canonical schema + version string, write a
normalizer that upgrades both legacy shapes on load. Do this first.

### 6.2 — Stale tone-apply bug
`_applyBlueprint()` (`ui.js:712`) targets `#tone-grid .card`, which **no longer exists** since the
Campaign DNA dropdown swap (v1.133). Blueprint tone has silently not applied since then. The tone
select is now `#tone-sel` (value = tone id). Fix while in this surface.

### 6.3 — Bad fixture value
`rise_of_the_runelords.blueprint` has `"tone": "high_fantasy"` — not a valid `TONES` id
(valid: `high`). Correct the file, or rely on the R4.1 migrator.

### 6.4 — dnaHint authoring  *(ties to Remedy A, v1.137)*
Blueprint arcs have **no `dnaHint`**, so a blueprint campaign gets the generic type-hint fallback
instead of the author-specific anti-drift directive. Decision:
- **(a)** Let authors hand-write per-arc `dnaHint` in the editor. *(Recommended for v1.)*
- **(b)** A "generate dnaHints" button that runs the DNA pass against the blueprint's `proseAuthor`.
  *(Nicety — mirrors the `generateSkeleton` dnaHint request; could reuse that prompt.)*

### 6.5 — Lossy NPC export
`buildBlueprintFromGame` only pulls `knowledge[0]` into NPC `notes`. If the editor round-trips a
game-exported blueprint, expect thin NPC notes. Consider richer capture when exporting.

---

## 7. Out of scope for v1
- Public/community sharing (server table reportedly has room for a `public` flag — leave it).
- AI full-blueprint generation → that's the Campaign Designer, TODO #5.
- Editing a blueprint that's already mid-play (blueprints are pre-play artifacts).

---

## 8. Open decisions needed before implementation
1. **§6.1** — the canonical schema + version string. Blocks everything.
2. **§6.4** — does the editor author dnaHints (a), auto-generate (b), or both?
3. **R5.2** — cloud save: overwrite-by-slug vs. always-new-slot.
4. Where the editor launches from — extend `showBlueprintBrowser` with an "Edit / New" button, a
   separate File-menu item, or both.
