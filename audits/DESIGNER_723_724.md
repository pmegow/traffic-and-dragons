# Blueprint Designer: habitats, act selection, and author assistance

## #723 — creature generation and encounter selection

Root cause: the generator had no habitat input; a single unlock act cannot express Act I and III while excluding II. Authoring reorder/delete paths treated numeric references as positions, so they could point at a different story act.

- Optional `environment` is descriptive habitat guidance; it is not a per-location prompt filter.
- Optional `availableActs` is an exact whitelist. Absent is unrestricted; [] is disabled. Existing `revealAct` retains its available-from behavior. Both fields together, invalid numbers and duplicate acts are refused.
- Checkboxes default to every authored act. Legacy gates display their existing tail without migrating on render. Manual edits replace the legacy gate. Explicit All is unrestricted; structural edits preserve restriction intent even when deleting acts leaves every remaining box checked. New acts enable only unrestricted creatures.
- Act reorder/delete follows object identity and remaps creature selections, NPC secrets and numeric plot armor. Referenced NPC act deletion is refused atomically, including whitespace-padded numeric armor.
- **Intentional cache contract extension:** exact selections follow all active acts, or the highest completed act if no act is active. They may update stable BESTIARY at act opening **or completion**, never during ordinary turns/location/combat changes. This resolves the real executor transition with two active acts where completion need not open a new act. Legacy gates are unchanged.

Independent Astra pre-review chose this policy. Post-review found restriction widening after deletion, padded-armor remapping, and contradictory no-act generation instructions. Each was reproduced with a failing assertion, fixed and re-reviewed. Whitelist-only private notes also retain the explicit GM-only label.

Proof (local ignored artifacts under `testRuns/designer-723-724`): failure-first engine (initially 4 failures), generator, act-control and real-browser checks; review regression failures preserved. Engine coverage exercises I/III selection, multiple active acts through actual ARC_COMPLETE/ACT_COMPLETE, final coda, malformed/empty selections, save/import, public/private formatting and stable bytes. Seven act-control and 23 creature-helper checks cover references, defaults, preservation and late response rejection. Browser fixture confirms Forest + I/III through generation, text edits, save/reload, portraits and phone layout. Original and updated screenshots are under `%TEMP%/tnd-creature-designer`.

Before/after `dev/capture-prompt.js` on the untouched Silence t7 save and reconstructed v1.01 opening: **no changed hunks in either half**. SHA prefixes: t7 stable `4eaa1d72b0ae`, volatile `4a3212fda7c2`; opening stable `e354973ffe78`, volatile `ca2a7fac74a7`. Existing campaigns without the optional fields are byte-compatible and need no restart.

No frozen hash or golden baseline was changed. The old numeric creature editor source assertion was replaced with the requested checkbox-editor assertion, retaining typed legacy setter tests and adding behavioral coverage. The #508 stale-draft sabotage anchor was retargeted to the strengthened full-context stamp without changing its expected failure. A first cache sabotage survived because the fixture had only an eligible creature; adding an ineligible creature exposed the failure and made the guard meaningful. One mutation attribution typo was corrected.

No paid model/image calls, account writes, or catalog content changes. TnD_Maps was not touched.
