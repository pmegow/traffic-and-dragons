# #633 — Talk to your character: a spoken, in-character conversation outside the game

**Status:** design record, 2026-10-15 (Fable, autonomous run while the owner is at work). Build follows this record; deviations are written back here.

**Read this when** you touch companion-talk.js, the `hear` host row in car-session.js, the Talk door in ui-boot.js, or the pinned conversation engine (conversation.js).

## 1. What it is

The player opens "Talk to…", picks a character they travel with — their own hero first, then any party member with a sheet — and has a hands-free conversation with them in the car. The character answers in their own voice, from what they actually know: their sheet, their bonds, their core memories, the chapters so far, where the party stands right now. No GM turn runs. Nothing is written to the campaign.

Owner rulings (2026-10-15): it lives **in the game page** as a Car-Mode-shaped door; the first partner is **a character with a sheet** (the owner then named Frizwick — the hero of the Frizwick campaign — as the test personality, so the hero is a partner and the default one; companions with sheets follow in the same picker); canon is **read-only**. Car-talk (C:\Projects\car-talk) stays the audio instrument and the general conversationalist; its conversation engine is what the game reuses.

## 2. What it is not

- Not a GM turn. The story does not advance; `sendAction` is never called; `worldState.transcript`, `sessionLog`, the memory tiers and the quest log are untouched.
- Not persisted. The talk lives for the session and is shown in the Table Talk pane as it happens; a reload forgets it. (A later row may add an opt-in "remember this talk" that files ONE note — that touches memory and gets its own Fable review.)
- Not the GM's voice. The character speaks in the voice already assigned on their sheet (the cast slots); a failed model call is said in the narrator's voice, never fabricated as the character's words.

## 3. Where it sits on the seam

The loop is car-session.js, unchanged except for one new host row. A second host object, `TALK_HOST`, is installed for the duration of a talk and the game's `CAR_HOST` is restored when it closes.

```
File ▸ 🗣 Talk to…  →  picker (hero, then party members with sheets)
                    →  showTalk(name): carSessionHost(TALK_HOST) ; carSessionStart()
                    →  entryBrief: the character greets the player (their voice)
                    →  the loop opens the mic
                    →  a final transcript → carVoiceCommand(text):
                         a command (pause / resume / repeat / repeat everything) → the loop
                         otherwise → TALK_HOST.hear(text) → the conversation engine
                    →  ack earcon · "Thinking… Ns" · the reply in the character's voice · the mic reopens
                    →  × or Escape → carSessionStop() → closed(): carSessionHost(CAR_HOST)
```

**The new row — `hear(text)`.** Today a plain utterance in Car Mode is not the loop's business: stt.js hands every final transcript to `carVoiceCommand`, and when that returns false stt.js sends the text as a GM turn. A talk must take plain speech itself. So the loop gains row 22: `hear(text) → true when the host took the utterance as speech`. `carVoiceCommand` calls it after the command table and the pick grammar have declined; the game's `CAR_HOST.hear` returns false (Car Mode behaves exactly as before — stt.js sends the turn); `TALK_HOST.hear` returns true and asks the character. stt.js is not edited. Car-talk adopts the row by copying the loop (its mic.js then stops calling `act` itself).

**The voice.** `TALK_HOST.voice()` is a wrapper over `TTS` whose `speak(text)` calls `TTS.speak(text, null, map)` where `map` is built by the game's own `speakerVoiceMap({s: every unit → name, n: units}, text)` — the same resolver narration uses for `[SAY:Name]` lines: the Piper id, the cloud slot pins under `providers`, the delivery direction and the speed all ride from the sheet. No SAY tags, no `pinAutoCastVoices` (no pins written), and not `speakResponse` (which writes `worldState.lastNarration`). The wrapper keeps its own last line so ⏮ replays the character's last answer. Every other method delegates to `TTS`. `isOn()` returns false so the loop stops the read when the overlay closes.

**The model.** `callGM(rendered, personaSystem, 220, null, {noHistory: true, kind: "talk"})` — the public utility path `summarize` and the suggestion call already use: a plain-string system (no stable/volatile split, no reinforce append, no purity check), `noHistory` so the sessionLog is not sent and not touched, and a usage bucket of its own in the Usage modal. The exchanges kept by the engine are rendered into the one user message ("Earlier … Now the player says …"). The gateway, the owner's keys and the provider ladder come for free; the owner's prose preference (Gemini Flash) is whatever the campaign's GM model is.

**The engine.** `conversation.js` from car-talk stage two, copied byte-identical and pinned by SHA-256 in both repos (the library-slug pattern, #481 F5): `Conversation.create({persona, adapter, window})` → `reply(text)`, `transcript()`, `reset()`, `persona(text)`. The game's adapter is `{ask(system, messages)}` over `callGM`. The engine names nothing outside itself; the seam suite scans it as a fourth portable file.

**The persona builder.** `talkPersona(sheet, ctx)` (companion-talk.js, pure, engine-tested) → the system block. `ctx` is gathered by the host through the accessors the prompt already uses, read-only:

| section | source |
|---|---|
| Who you are | sheet: name, ancestry, class, level, age, gender, appearance (one line), trait, flaw, motivation, backstory (capped), deity, alignment, manner/voiceDirection |
| Your people | `relationshipRows(sheet)`: entity + bond + dynamic (the hero's wives, a companion's bond to the hero) |
| What you remember | the sheet's `coreMemories` (last 10, text + the campaign they came from — cross-campaign history is wanted, see the library import rule) |
| What the campaign knows of you | companions: `memoryNpcDetail(name)` (the hero's own record is the sheet; `memoryNpcDetail` returns "" for the player by design) |
| Where things stand | `worldState.world` (location, region, time, weather), the last two chapter summaries, the tail of the last GM narration (`carSceneBrief` style, 2 sentences), the campaign name |
| How you speak | in character, aloud, to the player who plays you (the hero) or travels with you (a companion); two sentences; one question at most; no narration, no stage directions, no markdown, no lists; the player is spoken to as "you" |
| What you must not do | advance the story, invent events, people or places that are not in what you were given, speak for the Game Master or other characters, break character to discuss rules or the app (say you would rather not, in character), claim the conversation changes anything in the tale |

The block is bounded (`TALK_CAP`: per-item caps and a total of 5200 characters). A trim pass makes room in a fixed order, one step per round — the older chapter, the tale's record shortened, the oldest memories down to four, the scene, the record, the last memories — and NEVER touches the rules: the "how you speak" and "must not" sections close the block whatever the campaign's size.

## 4. The door and the car

- **File ▸ 🗣 Talk to…** beside Car Mode, enabled when a game is open. It opens a picker (modalShell): the hero first, then party members with a sheet, each with their portrait or initial. One tap opens the talk.
- **The overlay** is the Car Mode overlay: the partner's portrait and name, the status line, the tap/replay/skip controls. The party dots are hidden; the vitals line reads "Talking with you · <place>". Since #636 (v1.1298) two lines under the status show the exchange — the player's last words (painted by the loop when it takes them) and the character's reply (handed through `carNotify("response", text)`, shown while it is read and kept through the next listen); the portrait shrinks to make room on a small phone.
- **Latency** is the product risk: the ack earcon at once, "Thinking… Ns" ticking, a short reply (the persona asks for two sentences; `maxTok` 220). The host's `busy()` is true across the call so the tap and the transport yield.
- **Hold** works as in Car Mode: a spoken "pause" closes the mic; a reply that arrives while held is spoken and the mic stays closed; the tap releases.
- **Errors** are loud and attributable: a rejected call → `carNotify("error", …)` (the fail earcon, the status, the tap armed to retry) and a one-line narrator-voice notice ("The line dropped. Say it again, or tap."); `retry()` re-asks the last line. The reason lands in the crumb ring (`talk-error <why>`).
- **The record:** each exchange is rendered into the Table Talk pane ("You: … / Frizwick: …") so the player can read back after the drive. It is not saved.
- **Close** restores `CAR_HOST`, clears the engine, and never sets the Car Mode reload flag (a reload must not boot into a talk).

### 4a. The frames (#639, owner 2026-10-15)

The owner, after the first live talk: the character spoke from inside the paused scene; could they instead know they are outside the game? Explored 2026-10-15: a "fellow player" frame (the character as a person at the table) was rejected by the owner — it clouds who is speaking and throws away the in-character voice; an **off-stage** frame was chosen, and chosen as the opening frame ("let's try off-stage first"), with the in-the-story frame one spoken line away.

A talk has ONE frame at a time; the frame is a row in `TALK_FRAMES` (companion-talk.js) and shapes exactly three things in the persona — the opening paragraph, the labels of the "where" section, and one must-not line — and nothing else: the knowledge sections, the voice rules and the shared must-nots are byte-identical across frames (the suite strips the frame-owned lines and compares the rest).

| frame | what the character knows | opening | "where" section | extra must-not |
|---|---|---|---|---|
| `offstage` (default) | they are a character in a told tale, off-stage between sessions; they may speak of the tale as a tale — scenes, chapters, the player's choices ("made through you"), hopes and fears — as the actor who IS the part, never stepping out of who they are | "…and you know it. Right now you are OFF-STAGE…" | WHERE THE TALE LEFT YOU · "The last scene left you: …" | never announce what the Game Master will do or what the next scene holds |
| `moment` | the pre-#639 frame: the story is paused, this is a conversation inside it | "…The story is paused; this is a conversation, not a scene." | WHERE THINGS STAND · "Now: …" | — |

The line "Break character to discuss rules, the app or being an AI — decline in character instead." closes the block in BOTH frames and is the last line the trim pass can never cut: a character who knows they are in a tale is one step from "I am a program", and that step is forbidden. The off-stage rules cost ~440 characters more; `TALK_CAP.total` rose from 5200 to 5720 so the knowledge keeps its room.

**The moves** are spoken, through the talk's own command table (`TALK_COMMANDS` = the base vocabulary + `frameIn` / `frameOut`), whole-utterance only (the false-positive rule): "step into the story", "into the story", "go back into the story", "step on stage" → in; "step out of the story", "out of the story", "go off stage" → out. `onCommand` runs `_talkSetFrame(id)`: the persona is swapped on the engine (`engine.persona(...)` — the kept exchanges stay, so the talk continues), the NARRATOR says "Frizwick steps into the story." / "…steps off-stage." (never the character's voice), the crumb `talk-frame <id>` lands, the overlay's vitals line shows the frame ("Talking with you · off-stage"; the place returns only inside the story), the Table Talk record notes the move and the way back. A repeat of the current frame is a status notice only. The opened line in the record names the frame and the switch so a player can find it.

Not done: a frame choice on the picker, and a typed switch (the parked-field path sends text to the character, as Car Mode sends it to the GM). Open: the owner's live listen in both frames; whether the default stays off-stage.

## 5. The drift-surface audit

Files edited: car-session.js (one row + the call site), ui-carmode.js (`CAR_HOST.hear` → false), companion-talk.js (new), conversation.js (new, pinned), ui-boot.js (the menu row + its click), index.html / sw.js / engine-manifest (load order, shell, manifest), docs and tests. Not edited: api.js, memory.js, tag_table.js, state.js, game.js, stt.js, tts.js, identity.js, clock.js.

Reads only, through existing accessors: `relationshipRows`, `memoryNpcDetail`, `speakerVoiceMap`, `TTS.characterVoiceId`, `TTS._textPrep.splitSentences`, `activePlayer`, `wsNpcByName`. The one call into the model path is `callGM` with a private system and `noHistory` — the summarizer's shape. Writes: none to `worldState` or `memory` (the suite serializes both before and after a full talk and asserts byte-identical), except `worldState.usage` through `recordUsage` (every model call accounts itself; bucket "talk").

## 6. Verification

1. `dev/tests-633-companion-talk.js` (standalone, registered): the persona builder (sections, caps, the must-not block, hero vs companion sources, no transcript dump); the host rows (22, both hosts complete); the talk flow headless (the loop + ui-carmode + companion-talk + conversation.js in a vm with stub TTS/STT/callGM): open → greeting in the character's voice map → mic → `hear` → `callGM` called once with `noHistory`, the persona system and the rendered exchange → the reply spoken with the character's map → the mic reopens; "two" is speech, not a pick; a rejected call → the narrator-voice notice, retry armed, retry re-asks; hold while pending; close restores `CAR_HOST`; worldState and memory byte-identical; the engine's SHA pin; the engine passes the seam scan.
2. `dev/sabotage-633-companion-talk.js`: the persona drops the must-not block; the host writes `worldState.lastNarration`; the `hear` row removed from the loop; the error notice planted in the character's voice; retry forgets the last line; the pin changed.
3. `dev/qa-633-talk-bench.js` (manual, Playwright, the CX-5 bench serving the game): the Frizwick save loaded into the page, Speechify routed to silent PCM as `tests/browser.cjs` does, the model routed to a canned reply; the greeting's Speechify request must carry `catriona` (Frizwick's assigned voice — the proof the character's own voice is used); "how do you feel about Ammut" → the model request carries the persona with the Ammut bond → the reply is spoken → the mic reopens on hands-free; pause / head-unit PLAY / tap; close; then Car Mode still opens with its own host.
4. The owner: a live talk with a real model through their key, then the car.

## 7. Found on the bench (2026-10-15)

The desk drive (`dev/qa-633-talk-bench.js`, the CX-5 bench over the Frizwick save, the model and the microphone faked) found two defects the headless suite could not see, both fixed the same day and now pinned by both suites and the battery:

- **A — the mic never reopened after the first reply.** stt.js parks every final transcript in `#action-input` before the loop hears it; a talk took the line and left the field, so after the reply the auto-mic saw a parked utterance ("Heard you — tap to send") and never opened the mic; a tap then re-asked the same question. The talk host now clears the field when it takes the line (and parks it itself only while busy). The `hear` row's why says so: a host that takes the line owns its parked field. The headless suite's stt stub now parks the transcript first, as stt.js does.
- **B — the head unit read PAUSED while the character spoke.** Narration's PLAYING comes from ui-shell's message paint (`addMsg` syncs the tap button 100 ms later); a read the loop or the talk starts itself had no sync, so `playbackState` stayed "paused" and a steering-wheel PLAY during the read was a no-op. The loop now syncs after every read it starts (the entry brief, the options, the fallback line, the recap) and the talk after every reply and after the failure notice. The entry-brief half was a pre-existing Car Mode defect.

## 8. Open questions (recorded, not blocking)

- The hero as a partner is assumed from "use Frizwick"; the picker puts the hero first. If the owner meant companions only, the hero entry is one line to remove.
- The Table Talk pane as the record is the cheapest honest place; a dedicated pane is a later polish.
- Stage-two engine features (a per-talk memory of earlier talks) wait on the "remember this talk" row.
- (Resolved 2026-10-15, #639 §4a) whether the character knows they are outside the game: yes, off-stage by default, in-the-story one spoken line away.
