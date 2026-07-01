# Blueprint Designer — Handoff / Planning Doc

**Status:** Requirements drafted, decisions locked, nothing built. Pre-implementation handoff.
**Reference fixture:** `rise_of_the_runelords.blueprint` (hand-authored, complete example).
**Related shipped work:** Remedy A (v1.137) — per-arc `dnaHint` anti-drift. See §5.4.
**Absorbs:** TODO #5 (Campaign Designer / guided AI generation) — now the "Generate" path of this feature.
**Related TODO:** #23 (Blueprint cloud library — partly built).

> **Naming:** the feature is the **Blueprint Designer** — one surface with three creation modes
> (manual edit, AI-guided generation, edit-existing). This file keeps its `BLUEPRINT_EDITOR.md`
> name to preserve the committed reference.

---

## 1. Purpose & scope

A UI to **create, edit, and save campaign blueprints** — by hand, with AI assistance, or by
cleaning up an exported game — without touching JSON.

A blueprint is the campaign *authoring package* — skeleton (3-act spine + arcs), seeded NPCs,
locations, custom rules, and metadata. It is **NOT** a save file: no player character, no HP/XP/gold,
no combat, no transcript. A blueprint + a fresh character = a new campaign.

### Three creation modes (one shared editor surface)
1. **Manual** — author every field by hand (empty editor).
2. **Generate (absorbs TODO #5)** — guided prompts ("What is the central threat?", "What does the
   protagonist want?", "Who stands in the way?", "How should it end? — or surprise me") feed the LLM,
   which returns a full blueprint (premise + 3-act/arc skeleton, optionally seed NPCs/locations). The
   result **drops into the same editor** for review and hand-tuning before save. Reuses the
   `generateSkeleton()` machinery — same `worldState.skeleton` shape, same `buildSkeletonBlock()`
   injection. Player provides the *what*; the LLM provides the *how it unfolds*.
3. **Edit existing** — load a `.blueprint` file, a cloud-library blueprint, or the active game
   (via `buildBlueprintFromGame()`), then edit.

All three converge on the same editor and the same save paths.

---

## 2. Decisions — LOCKED

| # | Decision | Resolution |
|---|---|---|
| **D1** | Canonical schema fields | **Keep `author` (human credit) + `tone`** in the canonical shape. Export-from-game must start emitting both. |
| **D1b** | Canonical format string | Canonical = **`tnd-blueprint-v1`** (matches feature name + newest producer). Normalizer accepts legacy **`tnd-campaign-v1`** on load. |
| **D2** | dnaHint authoring | **Do both** — arcs get a hand-editable `dnaHint` field AND a per-blueprint "Generate dnaHints" button that runs the DNA pass against the selected `proseAuthor` (reuses the `generateSkeleton` dnaHint prompt). |
| **D3** | TODO #5 (Campaign Designer) | **Absorbed** — becomes the Generate mode (§1, mode 2). No longer a separate backlog item. |
| **D4** | Cloud save behavior | **Overwrite-by-slug** (name-slug is the key), mirroring the character library. Re-saving a same-named blueprint replaces it. |
| **D5** | Launch point | **Stand-alone surface** — the designer is its own first-class destination (own screen + File-menu entry), NOT a tab/button embedded inside `showBlueprintBrowser`. The blueprint browser remains the *pick-to-play* surface; the designer is the *author* surface. They may cross-link (browser → "Edit in Designer") but are distinct. |

*(All decisions resolved — none open.)*

---

## 3. The canonical schema (post-D1)

```jsonc
{
  "format": "tnd-blueprint-v1",          // canonical; normalizer also accepts "tnd-campaign-v1"
  "name": "Rise of the Runelords",
  "author": "Paizo (adapted…)",          // human credit string (free text) — KEPT (D1)
  "proseAuthor": "abercrombie",          // AUTHORS id, or "" — constrained dropdown
  "tone": "high",                        // TONES id — KEPT (D1); valid: high/gritty/swords/dark/politic/custom
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
        {
          "title": "Festival of Fire",
          "objective": "…",
          "type": "combat",              // combat | investigation | exploration | social
          "dnaHint": "…"                 // NEW (D2) — optional; hand-authored or generated
        }
      ]
    }
  ],
  "npcs": [
    { "name": "Ameiko Kaijitsu", "role": "ally", "pronouns": "she/her", "notes": "…" }
  ],
  "locations": [
    { "name": "Sandpoint", "description": "…" }
  ],
  "rules": [ "string", "string" ]
}
```

**Normalizer must handle** (load-time upgrade to canonical):
- `format: "tnd-campaign-v1"` → `"tnd-blueprint-v1"`.
- Missing `author` → `""`. Missing `tone` → best-effort or `""` (see §5.2 migration).
- Invalid `tone` id (e.g. `"high_fantasy"`) → mapped/blanked (see §5.3).
- Arcs without `dnaHint` → left absent (falls back to generic type-hint at play time; that's fine).

---

## 4. Current machinery (reuse, don't rebuild)

| Piece | Location | Role |
|---|---|---|
| `applyBlueprint(bp)` | `game.js:278` | Consumes a blueprint at campaign start — stamps skeleton act/arc status, seeds `worldState.npcs` + `memory.npcs`, seeds `memory.locations` + `memory.map.nodes`, appends `customRules`, sets region + location + `proseAuthor`. |
| `_applyBlueprint(bp)` | `ui.js:710` | Char-creation-flow entry: sets `pendingBlueprint`, shows banner, jumps to step 2. **HAS A STALE BUG — see §5.2.** |
| `buildBlueprintFromGame()` | `ui.js:601` | Packages the active campaign into a blueprint (strips run state). **Must add `author` + `tone` per D1.** |
| `exportBlueprint()` | `ui.js:640` | File menu → download/cloud-save active game as a blueprint. |
| `showBlueprintBrowser()` | `ui.js:723` | Local `.blueprint` import + cloud library tabs — the *pick-to-play* surface. Stays separate from the designer (D5); may cross-link to it ("Edit in Designer"). |
| `generateSkeleton()` | `game.js:328` | 3-act skeleton generator incl. the `dnaHint` request (v1.137). **Reuse for Generate mode + the dnaHint button (D2).** |
| Server library | `storage-adapter.js:384` | `listBlueprintLibrary` / `saveBlueprintToLibrary` / `deleteBlueprintFromLibrary`. Table `(user_id, slug, name, blueprint_data, updated_at)`. |

---

## 5. Requirements

### Entry points
- **R2.1** New blueprint from scratch (empty editor).
- **R2.2** Generate mode — guided prompts → LLM → editor (absorbs TODO #5).
- **R2.3** Edit an existing `.blueprint` file.
- **R2.4** Edit a cloud-library blueprint.
- **R2.5** Edit the active game as a blueprint (feed from `buildBlueprintFromGame()`), review, save.

### Fields to manage
- **Metadata:** `name`, `author` (free text), `proseAuthor` (dropdown), `tone` (dropdown),
  `startingLocation`, `startingRegion`, `premise` (textarea).
- **Acts (1–N):** `title`, `goal`, `turningPoint`, `parallel` (bool). Add / remove / reorder.
- **Arcs (per act):** `title`, `objective`, `type` (dropdown enum), `dnaHint` (textarea, optional).
  Add / remove / reorder within act.
- **NPCs:** `name`, `role`, `pronouns`, `notes`. Add / remove / reorder.
- **Locations:** `name`, `description`. Add / remove / reorder.
- **Rules:** string list. Add / remove / reorder.

### Generate mode (R-GEN, absorbs TODO #5)
- **RG.1** Guided prompt form: central conflict/threat, protagonist want, opposition, desired ending
  (with "surprise me").
- **RG.2** Feed answers + selected `tone`/`proseAuthor` into the skeleton generator; produce premise +
  acts/arcs (+ dnaHints when an author is set).
- **RG.3** Optionally generate seed NPCs + locations from the premise (decide depth — could be v1.1).
- **RG.4** Result lands in the editor for review/edit — never auto-saves blind.

### dnaHint (R-DNA, D2)
- **RD.1** Each arc has a hand-editable `dnaHint` textarea.
- **RD.2** A "Generate dnaHints" action fills empty (or all, with confirm) arc dnaHints from the
  blueprint's `proseAuthor` using the `generateSkeleton` dnaHint prompt.
- **RD.3** dnaHint is optional; blank is valid (generic fallback at play time).

### Validation
- **R4.1** `tone` constrained to live `TONES` ids; migrate bad legacy values on load.
- **R4.2** `proseAuthor` constrained to `AUTHORS` ids or empty; warn (not block) on unknown.
- **R4.3** `type` constrained to the arc-type enum.
- **R4.4** ≥1 act per blueprint, ≥1 arc per act, `name` + `premise` required to save.
- **R4.5** Inline validation; block save on hard errors, warn on soft.

### I/O & round-trip
- **R5.1** Load accepts both `tnd-blueprint-v1` and `tnd-campaign-v1`; normalize to canonical.
- **R5.2** Save to `.blueprint` file (download) + cloud library (**overwrite-by-slug**, D4).
- **R5.3** Lossless round-trip: load Runelords → save unchanged → schema-equivalent (keeps `author`,
  valid `tone`).

### UX
- **R7.1** Collapsible act cards with arcs nested inside (the nesting is the hard UI problem).
- **R7.2** Reorder (drag or up/down) for acts, arcs, NPCs, locations, rules.
- **R7.3** Live counts summary (reuse the export modal's pattern).
- **R7.4** Unsaved-changes guard on close.

---

## 5. Findings / bugs to fix as part of this work

### 5.1 — Canonicalize the schema  *(RESOLVED by D1/D1b — implement the normalizer)*
One canonical shape (`tnd-blueprint-v1`, keeps `author`+`tone`); load-time normalizer upgrades
`tnd-campaign-v1` and fills/repairs missing fields. Build this first — it gates load + round-trip.

### 5.2 — Stale tone-apply bug
`_applyBlueprint()` (`ui.js:712`) targets `#tone-grid .card`, which **no longer exists** since the
Campaign DNA dropdown swap (v1.133). Blueprint tone has silently not applied since then. The tone
select is now `#tone-sel` (value = tone id). Fix while in this surface.

### 5.3 — Bad fixture value
`rise_of_the_runelords.blueprint` has `"tone": "high_fantasy"` — not a valid `TONES` id
(valid: `high`). Correct the file, or rely on the R4.1 migrator.

### 5.4 — dnaHint authoring  *(RESOLVED by D2 — build both paths)*
Hand-editable field (RD.1) + generate button (RD.2). Blueprint campaigns previously fell back to the
generic type-hint (losing Remedy A's anti-drift); this closes that gap.

### 5.5 — Lossy NPC export
`buildBlueprintFromGame` only pulls `knowledge[0]` into NPC `notes`. Round-tripping a game-exported
blueprint yields thin NPC notes. Consider richer capture when exporting.

---

## 6. Out of scope for v1
- Public/community sharing (server table reportedly has room for a `public` flag — leave it).
- Editing a blueprint that's already mid-play (blueprints are pre-play artifacts).
- Module system / alternative-worlds presets (the far end of old TODO #5 — revisit post-v1).
