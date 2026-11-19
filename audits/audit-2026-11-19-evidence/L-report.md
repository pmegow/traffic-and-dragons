# Lane L report — Car Mode, companion talk, Table Talk, sound, ambience, voice-settings shells (HEAD d7ed4ea6)

Probe scripts: `audits/audit-2026-11-19-evidence/L\`
(probe-carcmd.js, probe-talk-secret.js, probe-tt.js, probe-accent-mute.js, probe-sound-rebuild.js). Nothing in the repo was touched.

## 1. Coverage

| File | Read |
|---|---|
| car-session.js (712 lines) | whole |
| car-commands.js | whole |
| ui-carmode.js | whole |
| companion-talk.js | whole |
| conversation.js | whole |
| table-talk.js | whole |
| sound.js | whole |
| audio-events.js, audio-scenes.js, audio-cache.js, audio-loader.js | whole |
| ambient.js, audio-accents.js, audio-profile.js, ui-ambient.js | whole |
| audio-catalog.js (1021 lines) | generated data. I read the header and tail, and checked all 16 assets by script (ids unique, bytes ≤ maxBytes, every maxBytes ≤ 8 MiB, the largest decoded bed 22.9 MiB, so two beds fit the 48 MiB budget). I did not read the JSON line by line. |
| ui-voice-settings.js, ui-character-voice.js | whole |
| Contracts | tts-stt.md (the Ambience, Car Mode seam and ui-carmode.js sections), prompt.md (the table-talk.js and §14 Table Talk sections) |
| Read outside the lane to confirm a mechanism | game.js CAR_COMMANDS, sendAction's TT and error lines 2911–3066, retryLast; stt.js _applySendPolicy and the confirm flow; memory.js memoryNpcDetail, npcSecretText, memoryTOC; api.js buildQuestBlock; tts.js _voiceDraft; sw.js cache purge; ui-panels.js syncUI's _carUpdate call |

## 2. Findings

### F1. In Car Mode, a tap after a turn that already committed, or after a failed Table Talk question, sends the last story action again (a duplicate GM turn)
- **Where:** game.js `sendAction` catch, line 3058: `if(_committed){addMsg("system","Turn applied, but a display step failed: "+e.message);if(typeof carNotify==="function")carNotify("error","Turn applied, but display failed");}/* no Retry — the mutation already landed (E82) */`. Also line 3060, which runs for Table Talk too: `addMsg(isTT?"tabletalk":"system","GM error: "+e.message);if(typeof carNotify==="function")carNotify("error","Turn failed — tap to retry");`. The receiving side is car-session.js `carNotify`, line 133 (`_carRetryArmed = true` for every "error"), then `_carTap` branch (d), line 486, which calls `_carHost.retry()`. ui-carmode.js `CAR_HOST.retry` calls `retryLast()`, which is `sendAction(lastAction, …)`.
- **Failing sequence (a):** in Car Mode a story turn commits and then a display step throws. carNotify("error") arms the tap. The next idle tap (no narration playing, mic closed) runs retryLast, and the action that already committed is sent as a new turn. The comment in that same line says there must be no Retry. The car-session header says "error" is for "turn failures ONLY".
- **Failing sequence (b):** the player opens Car Mode while the Table Talk tab is active. stt.js sends `sendAction(null)`, and `isTT` comes from `activeChatTab`. A Table Talk call fails, so line 3060 arms the tap. `lastAction` is set only for story turns (line 2943: `if(!isTT)lastAction=txt`), so the tap re-sends the PREVIOUS STORY action as a fresh GM turn. The Table Talk success path never calls `carNotify("response")` (ui-shell.js line 339 resets only on "narrator"), so nothing clears the arm.
- **Evidence:** READ. I did not run it, because reproducing needs the full sendAction pipeline and a thrown display step.
- **Severity:** high when it happens (the same action is committed twice, which writes canon twice), but the triggers are rare.
- **Remedy:** line 3058 should send `carNotify("warn", …)`. For line 3060, either send "warn" when `isTT`, or make the retry row resend the failed request (`sendAction(txt,{ttRetry:true})`) instead of `retryLast`.

### F2. The companion talk persona includes the companion's GM-only authored secret and the blueprint's GM guidance
- **Where:** companion-talk.js `talkContext`, line 153: `ctx.npcDetail = memoryNpcDetail(partner.name,{omitAbilities:true})`. `memoryNpcDetail` (memory.js 2355) appends `npcSecretText(n)` ("Authored secret (act gate open; stage its discovery in the fiction): …") and `npcAuthoredText(n)` ("Authored guidance …"). `talkPersona`, line 108, puts them under "WHAT THE TALE KNOWS OF YOU". The trim pass cuts the record to 450 characters from the tail, so the secret, which comes near the top, survives.
- **Failing input:** a companion with a blueprint secret whose act is active ("Mira is secretly the Guild's spy and will betray Tess at the bridge") and an authored note ("in Act 2 Mira leads the party into the ambush"). The player opens Talk to… Mira.
- **Observed:** REPRODUCED by `probe-talk-secret.js`. Output: `persona contains secret: true  authored guidance: true`. The persona tells the character to speak from what it was given, so a two-sentence talk can say the secret out loud. The open act gate means "the GM may stage its discovery", not "the player has learned it". `omitAbilities` shows the author already meant to strip GM-only material, but stopped at abilities.
- **Severity:** medium (a spoiler, outside the story).
- **Remedy:** a memoryNpcDetail option that also omits the secret and the authored guidance, passed by talkContext. Or build the talk's record from `knowledge` and `events` only.

### F3. The Table Talk prompt names NPCs the player has not discovered, and the GM's pending future events
- **Where:** table-talk.js `ttRecallBlock`, line 225: `memoryTOC()` with no `npcFilter`. memory.js `memoryTOC` lists every `memory.npcs` key as "KNOWN NPCs" and every unresolved `memory.futureEvents` as "PENDING EVENTS".
- **Failing input:** a blueprint-seeded NPC that has never been met (`npcDiscovered` returns false, so the #740 World State panel hides it), plus a GM-filed future event.
- **Observed:** REPRODUCED by `probe-tt.js`. Output: `npcDiscovered(Vexmoor): false`, then `TT> KNOWN NPCs: Lord Vexmoor`, then `TT> PENDING EVENTS: The Ashen Cult burns Ashfen (in 3 days)`. Table Talk speaks to the player out of character, so "who's in this campaign?" or "what's coming?" can name the hidden cast and the GM's plans. The owner ruled that the player's own panel must hide undiscovered characters. The prompt does say "a RECORD of what happened", which pending events are not.
- **Severity:** medium (a spoiler, and an inconsistency with #740).
- **Remedy:** pass `memoryTOC({npcFilter: …npcDiscovered…})` from Table Talk, and leave PENDING EVENTS out (or keep only what buildClockBlock already makes public).

### F4. After a B39 context rebuild, every earcon fails silently for the rest of the page's life
- **Where:** sound.js. `_reverb(ctx)`, line 225 (`if (_verb) return _verb;`), is a singleton ConvolverNode built on the FIRST context. `_ensureCtx`, line 186, closes the doomed context and mints a new one, but never resets `_verb`. In `play`, line 349 (`bus.connect(send); send.connect(cv);`), the new context's gain is connected to the old context's convolver. WebAudio throws InvalidAccessError on that. The catch at line 362 logs only `console.debug(... "play failed")`.
- **Failing sequence:** an earcon plays (so `_verb` exists), then resume() is refused (iOS interruption), then the context is rebuilt, then the next `Sound.play`.
- **Observed:** REPRODUCED with a fake AudioContext that applies the cross-context connect rule (`probe-sound-rebuild.js`). Output: `ctx2 (rebuilt) play: false | state: running/rebuilt×1`, then `[sound] 'chime' play failed: InvalidAccessError: …different audio context`. `tests-b39-resume-observed.js` checks the rebuild but never plays on the rebuilt context. A secondary effect: `bus.connect(ctx.destination)` succeeded before the throw, and the disconnect timer is scheduled after it, so each failed play leaves one GainNode connected to the destination.
- **Severity:** medium. Every UI sound dies after the exact iOS event B39 was built for, and nobody is told (debug level only).
- **Remedy:** when `_ensureCtx` rebuilds, set `_verb = null` (and `_noiseBuf = null` to be safe). Connect the bus only after the sends are built, or disconnect it in the catch. Log a play failure as a warning.

### F5. carNotify silently drops the "downed", "ended" and "respawn" kinds its callers send
- **Where:** car-session.js `carNotify`, lines 123–147, handles error, warn, info, progress, sent and response, and has no final else. The callers that send other kinds: game.js 4250 `carNotify("ended","You have died for the last time. This story is complete.")`, game.js 4314 `carNotify("respawn", …)`, tag_table.js 516 `carNotify("downed","You are down. Struggle, or yield?")`.
- **Observed:** READ. In Car Mode those status lines never appear and nothing is logged. The header calls carNotify a cross-lane contract with exactly six kinds, so the callers break the contract and the receiver swallows it.
- **Severity:** low to medium (the driver gets no status for downed or final death. Narration may still carry it.)
- **Remedy:** either map these to "info" at the call sites, or add an else branch that warns on an unknown kind and still paints the text.

### F6. syncUI repaints the hero's name, portrait, vitals and party over an open talk; and a talk can open while a GM turn is in flight
- **Where:** ui-panels.js line 83: `if(typeof carMode!=="undefined"&&carMode&&typeof _carUpdate==="function")_carUpdate();`. It runs whatever host is installed, and `_carUpdate` (ui-carmode.js 27) writes `car-name`, the portrait, `car-vitals` and `car-party` from `activePlayer()`. `TALK_HOST.paint` (companion-talk.js 265) is not called back. Also `showTalk` (companion-talk.js 300) does not check the global `busy`.
- **Failing sequence:** open Talk to… Mira while a story turn is in flight, or while any async writer that calls syncUI is still running (a cloud pull, a post-turn settle). The turn lands, and syncUI paints the hero over Mira's overlay. With the turn in flight, ui-shell's narrator path also calls `carNotify("response")` and the narration plays inside the talk.
- **Evidence:** READ for the paint path. SUSPECTED for how often a syncUI runs during a talk. A browser drive that calls syncUI() during a talk would settle it.
- **Severity:** low (the overlay is wrong; the campaign is not touched).
- **Remedy:** route that syncUI tail through `_carHost.paint()` (a host-neutral row), and refuse `showTalk` while `busy`.

### F7. Accents keep firing while the master mute (or volume 0) is on; the contract says they do not fire
- **Where:** audio-accents.js `createAccentController`. `blocked()`, line 152, ignores `volume`, and `plan()` plays at `accentGain(snapshot, level)`, which is 0 when muted. ui-ambient.js line 24 multiplies the snapshot volume by `AudioMaster.gain()`. The contract (CLAUDE.md audio-master.js row) says "the bed ramps to 0, the accents do not fire". Only the entry cue checks `volume > 0` (lines 130 and 135).
- **Observed:** REPRODUCED by `probe-accent-mute.js` (the real controller, AUDIO_CATALOG, the tavern seed, volume 0, ten simulated minutes). Output: `plays while volume=0: 4 [{"set":"footsteps-wood","gain":0},…]`. The accent buffer also stays loaded. Nothing is audible, so this is contract drift plus wasted work (buffer sources are created and scheduled).
- **Severity:** low.
- **Remedy:** add `!(s.volume > 0)` to `blocked()`.

### F8. Bare "I pause", "I repeat", "I resume", "I stop here" and "I put it back" are taken as commands
- **Where:** car-commands.js `CAR_CMD_FILLER`, line 19. Its `i(?:ll| will| want to| wanna)?(?: take| …)?` arm lets a bare "i " be stripped, so "I pause" becomes "pause". game.js CAR_COMMANDS then matches "stop here" (wrapUp) and "put it back" (undoItem).
- **Observed:** REPRODUCED by `probe-carcmd.js`. `"I pause" → pause`, `"I repeat" → repeat`, `"I resume" → resume`, `"I stop here" → wrapUp`, `"I put it back" → undoItem` (this undoes the last item move). These short utterances are plausible in-fiction actions, and the comment at lines 30–33 treats "I pause at the door" as an action. The five sentences in the lens all correctly return null (see Affirmed). "I roll" → roll is deliberate (the game's regex has `(?:i )?roll`). Nothing in dev/ pins these cases either way (grep found none).
- **Severity:** low to medium (the turn is swallowed and replaced by a command; "I put it back" also undoes an item move).
- **Remedy:** remove bare `i` from the filler (keep "I'll", "I will", "I want to", which lead into pick verbs), or restrict it to an `i (take|pick|choose|go with)` prefix.

### F9. In a talk, "say that again" or "repeat" answers "No options to repeat yet" instead of repeating the character's line
- **Where:** car-session.js `carVoiceCommand`, line 224: `if (cmd.kind === "repeat") { if (!_carReadOptions()) { carNotify("warn", CAR_STR.noOptionsYet); } return true; }`. TALK_HOST has no menu (`options()` returns null), so `_carReadOptions` returns false. `TALK_COMMANDS` includes `CAR_CMD_REPEAT` ("repeat", "again", "say that again", "one more time").
- **Observed:** READ. The parse is REPRODUCED for the base table (`"read that again" → repeat`, `"Again." → repeat`). The line the player wanted repeated is swallowed and the overlay shows a menu warning. "repeat everything" does replay.
- **Severity:** low.
- **Remedy:** when `options()` is null, treat "repeat" as `_carDoReplay()`.

### F10. A number word is swallowed while the game's options are not ready, but passes through as an action when there are fewer options
- **Where:** car-commands.js `parseCarCommand`, line 68: `if (optionCount && n > optionCount) return null;`. With `optionCount` 0 the guard is skipped. Then car-session.js line 229 shows `noOptionsYet` and returns true, because the game's menu is `[]`, not null.
- **Observed:** REPRODUCED (parse): `"four", 3 options → null` (an action), but `"four", 0 options → pick 4`, and likewise `"Give me four"` and `"the fourth"`. While the suggestion call is in flight (`[]`), a spoken "Two!" or "Four" is eaten with a warning. With a live menu of three, "four" is sent as an action. The other boundaries are correct: `last, 0 → null`, `last, 1 → 1`, `one, 1 → 1`, `two, 1 → null`. Ordinals stop at four, so with nine options "five" and "option 5" are never picks (the game shows at most four buttons, so that is not reachable).
- **Severity:** low.
- **Remedy:** decide one rule. Either pass through when there are no options, like a host with no menu, or keep swallowing but say so for both cases.

## 3. Monotonic resources

| Resource | File | Scope | Bound | Enforced in code |
|---|---|---|---|---|
| `_carMediaCrumbAt` / `_carMediaCount` | car-session.js | page | 4 commands × 6 states keys | yes (key space is closed) |
| keydown handler `_carKbHandler` | car-session.js | overlay open | 1 (old one removed on re-entry, removed on stop) | yes |
| visibilitychange listener | car-session.js | page | 1 (top level) | yes |
| `_carOptTimer`, `_carMicTimer`, `_carStatusTick` | car-session.js | overlay | 1 each, revoked by `_carOptReset` / `_carSetStatus("")` in stop | yes |
| `_carDoReplay` 100 ms timer | car-session.js | per replay | short-lived, guarded by `carMode` | yes |
| Wake lock sentinel | car-session.js | overlay | 1; a late resolve after stop is released | yes |
| Media Session handlers | car-session.js | overlay | 4, set to null on stop (metadata is not cleared) | yes |
| Conversation `_kept` | conversation.js | talk | `window` (12) exchanges | yes (`_keep` shifts) |
| Conversation `_chain` | conversation.js | talk | settled links are garbage-collected | yes |
| Talk record lines (`_talkLine` → `addMsg("tabletalk")`) | companion-talk.js | session | not bounded here (one DOM node per heard line and reply) | **no** (depends on the TT pane's own cap in ui-shell.js, which I did not check) |
| `worldState.ttLog` | table-talk.js | campaign (saved) | 12 pairs, q 600 / a 1200 chars | yes |
| Per-play bus/send GainNodes | sound.js | per play | disconnected 2.2 s after the tail | yes, **except** a play that throws after `bus.connect(destination)` leaks the bus (F4) |
| Oscillator, noise and sample nodes | sound.js | per note | disconnected `onended` | yes |
| `_noiseBuf`, `_verb` | sound.js | context | singletons, but never reset on rebuild (F4) | partly |
| AudioContexts | sound.js | page | 1 live; a doomed one is closed before the next is made | yes |
| Audio event listeners | audio-events.js | page | the same fn deduped; `on` returns `off` | yes |
| Decoded buffers / reservations | audio-loader.js | page | 48 MiB, reserved before decode; released on stop, release, failure or abort | yes |
| One decode at a time | audio-loader.js | page | 1 (refuses while another settles) | yes |
| SW audio cache entries | audio-cache.js | device | 32 entries / 32 MiB, LRU on hit | yes |
| SW audio cache across manifest versions | sw.js line 148 | device | old `tnd-audio-*` names deleted on activate | yes |
| SW cache queue | audio-cache.js | worker | 8 queued (beyond that, a bypass to the network) | yes |
| Bed voices | ambient.js | page | source + outgoing ≤ 2; retire timer cancelled on stop | yes |
| Accent buffers | audio-accents.js | place | ≤ 2 sets + 1 entry cue; released on key change, shed or dispose | yes |
| Accent voices and timer | audio-accents.js | page | 1 voice (hush before a new play), 1 timer | yes |
| Accent sources / gain | ui-ambient.js accentDriver | per play | sources disconnect onended; gain disconnects when all end | yes |
| Ambience document/window listeners | ui-ambient.js | page | added once (`initialized` guard); voice subscriptions re-added only when `offs` is empty | yes |
| `lastError` / `lastCacheError` toasts | ui-ambient.js | page | one toast per distinct reason | yes |
| `failedKey` | ambient.js | page | a failed scene is not retried until the key changes or Enable audio is pressed | yes |
| Diagnostics `setInterval` | ui-voice-settings.js | modal | cleared in close, and self-clears when the modal is disconnected | yes |
| localStorage keys | `tnd_carmode_v1`, `tnd_ambient_enabled_v1`, `tnd_ambient_volume_v1`, `tnd_sound_v1` | device | fixed key set | yes |
| `audioPlaybackGeneration`, `_ctxRebuilds` | audio-profile.js, sound.js | page | integer counters | n/a |

## 4. Affirmed (tried to break, could not)

1. `parseCarCommand` (game table) on "I repeat my offer", "pause at the door", "roll the barrel aside", "one of them", "never mind the guard", "I resume my watch", "Repeat the ritual", "I'll take everything", "do it again": all return null, so they stay actions (probe-carcmd.js).
2. `parseConfirmCommand("no time to lose")` returns null, and `"i do"` returns null.
3. Conversation `_send` (conversation.js): an adapter that returns empty or rejects is never kept and never turned into a line. `talkAdapter` throws "empty reply". `_talkAsk`'s failure path speaks only the narrator's "The line dropped…" (no fabricated character line), and a reply that lands after close is ignored (`_talk !== t`).
4. The talk persona rules survive the trim pass even with oversize sections: REPRODUCED, a 9,647-character persona still holds "WHAT YOU MUST NOT DO" and the AI line. (Side note: the 5,720 `TALK_CAP.total` is not enforced when the non-knowledge sections, such as an absurd 3,000-character location name, exceed it. The loop breaks when no knowledge step can act. No realistic input reaches that.)
5. Nothing in companion-talk.js writes worldState or memory. `TALK_HOST.opened` sets no reload flag. `closed()` resets the engine and reinstalls `CAR_HOST`, and `carSessionStop` clears the hold, the retry arm, the confirm-pending state and the exchange lines.
6. Table Talk output does not reach applyMuts: sendAction's `isTT` branch (game.js 3023) runs only cleanTxt, ttLogExchange and addMsg. commitGmTurn runs only on the non-TT path.
7. The voice settings draft is a JSON deep copy (`_voiceDraft`, tts.js 833), so edits do not reach live settings before Save. A staged API key sits only in a password-type input and is never logged or put in a status line.
8. The ambience failure path: a failed bed load sets `failedKey`, so it is reported once (deduplicated by reason) and not retried in a loop. A campaign switch (`campaignId` or `generation` change), leaving the game screen (`visible` false), a spoken pause (`held`) and capture all hard-stop or block both the bed and the accents. Old SW audio caches are purged on activate.

## 5. Undetermined

- Whether the Table Talk pane caps its DOM nodes. The talk record (F-table row) grows one node per exchange and relies on that cap. I did not read ui-shell.js `addMsg`.
- If `carSessionStart` returns early (no `#car-overlay`) or throws after `showTalk` installed `TALK_HOST`, the talk host stays installed and a later `showCarMode` would run Car Mode on the talk host. The overlay is static in index.html, so I could not find a path that reaches this. Not reported as a finding.
- F1(b) depends on whether a player can realistically be in Car Mode with the Table Talk tab active. Nothing on entry switches the tab back to Story, as far as I read (`showCarMode` calls only closeRollModal).
- F6: how often an async syncUI lands during a talk (cloud sync pull, item-kind or atlas settles after a turn). A browser drive would settle it.
