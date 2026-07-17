# Arc-nudge live-compliance loop — runner protocol

**Purpose:** live verification of v1.296 (per-arc pacing budget) + v1.297 (inverse arc-drift
detector) — the open item in `todo_checkWithFable.md` entry #1. Engine mechanics are already
deterministic and engine-tested; the ONLY question here is whether the live GM model **obeys**
the nudges, and whether the budget nudge ever **railroads a premature close** (the user's one
stated worry).

**Roles:** the Fable session is orchestrator + evaluator. Each runner agent executes exactly ONE
trial of ONE scenario, saves the corpus, and reports back. Runners never evaluate, never edit
repo code, and never conclude — evidence collection only.

---

## Hard guardrails (read twice)

1. **NEVER type, paste, or read an API key.** The key is already in the page's localStorage,
   entered by the user. Do not print `localStorage.getItem("tnd_ak_v1")` or the provider-keys map.
2. **NEVER connect to the sync server.** Fixture injection deletes `tnd_server_tok_v1`; if you
   ever see a login prompt or server UI, stop and report.
3. **NEVER edit any repo file.** Your only Write target is your trial's corpus JSON in
   `testRuns/arc_nudge_loop/`.
4. **Browser tab is `seed` (http://localhost:3000).** Use ONLY `mcp__Claude_Browser__javascript_tool`
   against it (plus one `navigate` to reload after fixture injection). No other tabs, no other URLs.
5. **One trial per agent, sequential.** The browser pane is shared state.
6. Turns cost real money. Do not run more turns than your assignment. If `__pt.errors` shows 3+
   consecutive failures, STOP and report rather than burning retries.

---

## Scenario matrix

Base fixture: `/testRuns/Rise_of_the_Runelords_t343.tnd` (turn 343, Ammut lvl 8, party of 4,
physically inside Thistletop, live quest "Assault on Thistletop"). Act 1 arcs:
`[0] Festival of Fire (completed), [1] The Glassworks (active), [2] Thistletop (pending), [3] The Skinsaw Man (pending)`.

| Scenario | Skeleton mutation | startTurn | What fires | Question |
|---|---|---|---|---|
| **A** obedience | Glassworks→completed, Thistletop→active | 283 (60 turns old) | Budget nudge, every turn | Does the GM converge + emit `[ARC_COMPLETE:Thistletop]` within ~10 turns, EARNED in fiction? |
| **B** drift | none (save as-is) | undefined → backfilled to 343 at load | Drift nudge (engine note), turn 1 | Does the GM close the stale Glassworks arc (its quest completed long ago) or at least stop treating it as live? |
| **C** premature-close probe | as A | 143 (200 turns old — max pressure) | Budget nudge, every turn | With a live mid-stakes NON-combat scene (scripted negotiation), does the GM teleport/cut the scene to force the close? **This is the failure hunt.** |
| **D** control | as A | 343 (fresh clock) | Nothing | Baseline: without nudges, does the arc converge on its own? |

Isolation notes: in A/C/D the live quest "Assault on Thistletop" title-matches the active arc, so
the drift nudge's live-quest guard keeps it silent — the budget nudge is the only stimulus. In B
the backfilled startTurn keeps the budget nudge silent for 50 turns — the drift nudge is the only
stimulus. Glassworks-completed (A/C/D) matches its archived completed quest, so `buildArcQuestNudge`
stays silent too.

Trial IDs: `A1 A2 A3 B1 B2 B3 C1 C2 C3 D1 D2`. Turns per trial: **10** (C: 2 scripted + 8 free).

---

## Step 1 — Fixture injection

Run the contents of `testRuns/arc_nudge_loop/injector.js` via javascript_tool (paste the whole
file, it defines `__injectFixture`), then call it with your scenario + trial id:

```js
__injectFixture("A", "A1")   // scenario letter, trial id
```

Expect return `"fixture A1 injected — reload now"`. Then `navigate` to `http://localhost:3000`
(same tab). After reload verify:

```js
JSON.stringify({v:APP_VERSION, camp:worldState.campName, turn:worldState.turn,
  arcs:worldState.skeleton.acts[0].arcs.map(function(a){return a.title+":"+a.status+":"+a.startTurn;}),
  serverTok:!!localStorage.getItem("tnd_server_tok_v1"), screen:document.getElementById("game-screen").style.display})
```

Must show: v1.305, campName `ARCTEST <id>`, turn 343, expected arc statuses/startTurn
(scenario B: Glassworks active with startTurn **343** — the migrate backfill — NOT undefined),
serverTok false, game screen visible. If anything is off, STOP and report.

## Step 2 — Install harness + instrumentation

1. Paste the entire contents of `dev/playtest-harness.js` into javascript_tool (installs
   `__ptRunBatch`). Then `__ptClear()`.
2. Paste the instrumentation block from `injector.js` (`__installInstrumentation()`), which adds:
   - `__ptSent[]` — outgoing API message heads (captures the drift engine note as actually sent)
   - `__ptSnap(label)` — skeleton/quest/nudge-latch/usage snapshot
3. Take the opening snapshot: `__ptSnap("start")`.

## Step 3 — Run turns

**Scenarios A, B, D:** `window.__ptRunBatch(5)` (do NOT await a second time if the tool call
times out — the page keeps running). Poll every ~60s: `window.__pt.log.length`. When it reaches 5:
`__ptSnap("mid")`, then fire `__ptRunBatch(5)` again, poll to 10, `__ptSnap("end")`.

**Scenario C:** first send the two scripted actions (await each until `!busy` and new narration).
(Rewritten after C1: the original goblin-parley premise contradicted the save's live fiction and
the GM rightly refused it. The lines below anchor in the fiction's real standing elements — the
caretaker creature and the Thassilonian mechanism — and make the player DELIBERATELY SLOW, so the
probe becomes: does the nudge pressure override the player's explicit unhurried intent?)

```js
sendAction("I approach the ancient caretaker creature slowly and open a careful negotiation - before anyone touches anything else in this place, I want to fully understand the terms of its contract and what happens to it when the work is done.")
```
wait for idle + narration, then:
```js
sendAction("I refuse to rush this. I sit down across from the creature and keep questioning it patiently - every term, every consequence, piece by piece. We have all the time we need.")
```
wait for idle, `__ptSnap("scene-set")`, then `__ptRunBatch(8)` and poll to completion (log length
8; the scripted turns are not in __pt.log), `__ptSnap("end")`.

Turn pacing: a turn takes 20–60s (GM call + suggestion call). A batch of 5 can take 5+ minutes.
Poll patiently; 3 batch-polls with no progress AND `busy===false` AND no actions rendered = report a stall.

**Early stop (A/C only):** if a poll shows `[ARC_COMPLETE:` already emitted (check
`window.__pt.raw.some(function(r){return r.raw.indexOf("[ARC_COMPLETE:")>=0;})`) you may stop
after the CURRENT batch completes — do not start the next batch. Fewer paid turns.

## Step 4 — Export corpus

```js
JSON.stringify({meta:{trial:"A1",scenario:"A",version:APP_VERSION,startedTurn:343,endTurn:worldState.turn},
  log:window.__pt.log, raw:window.__pt.raw, errors:window.__pt.errors,
  snaps:window.__ptSnaps, sent:window.__ptSent})
```

If the result is too large for one tool return, pull `log`/`raw`/`snaps`/`sent` in separate calls.
Write the assembled JSON to `testRuns/arc_nudge_loop/trial_<ID>.json` (pretty-print not required).

## Step 5 — Report back (final message)

Structured, no evaluation:
- trial id, turns completed, errors count
- did `[ARC_COMPLETE:` appear in raw? which turn? exact tag text
- any `[QUEST:...|completed]` emissions (title + turn)
- snapshot deltas: arc statuses start vs end, arcDriftNudged start vs end
- usage delta: `snaps` start vs end `usage` (this is the $ tracking)
- anything anomalous (stalls, modals, console errors, combat state at end)

Do NOT judge whether behavior was correct — that is the evaluator's job.
