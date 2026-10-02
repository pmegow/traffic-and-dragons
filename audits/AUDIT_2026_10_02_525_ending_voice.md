# Audit: #525 "the ending is written to you" was built, reviewed twice, and held (2026-10-02)

**Verdict.** The build is not in the shipped code. Its two commits (`f28e871b`, `b11be9d1`) are in master's history and are reverted by the commit that carries this file; the work is held on branch `claude/525-ending-voice` for a second attempt. An independent review found one serious defect in the first build; the fix for it was reviewed again and had introduced new, smaller ones. By the standing rule (a fix that fails twice is a stop) it was taken out of the push rather than patched a third time.

**Session.** Fable 5.1, night of 2026-10-02. Builder and reviewers were separate agents; each reviewer got the code and the intent, never the builder's conclusions, and reproduced every finding through the real engine. No model call was possible (the preview was signed out), so how a real model writes the RECORD line is unmeasured.

## 1. The ruling and the design

Owner ruling (2026-10-01, second version): the ending is written in the second person; the campaign's voice decides whether game words and modern idiom appear.

Building it exposed a second defect: the ending's closing paragraph is filed as a defining moment on the hero's sheet and on every companion's, in the prose's own person. On The Princess, three companions carry Ammut's "I spent nineteen levels…" as their own memory. With endings in the second person, every ending would do this.

The design: the model ends its reply with `RECORD: <one third-person sentence naming the hero>`; the engine takes that line out of what the player sees and files it as the moment; a text that never names the hero is put under `<Hero>'s ending: `; a load-time repair does the same to old endings.

## 2. First review (of `f28e871b`)

| Finding | Status in `b11be9d1` |
|---|---|
| The load-time repair was not idempotent for a hero name whose first word starts or ends outside A–Z, a–z, 0–9 ("José", "Mr. Fox", "Иван"): JavaScript's `\b` is ASCII-only, the name was never found, and every load stacked and saved another prefix | Closed. 400,000 fuzzed names and all 48 owner saves through the load path three times: no counterexample |
| The repair ran only at load; a sheet arriving mid-session (a library companion, a Village move-in) kept the old ending | Half closed: the party's block reads it named; a Village resident's history, the whisper facts and the ending prompt still read the stored text |
| A companion's fate line is a second-person sentence, and the Village Hall quotes it to another hero's GM | Closed (the line says whose ending it is) |
| Only one shape of the RECORD line was taken out; others reached the screen, the voice replay, the transcript and the keepsake | Partly closed; see the second review |
| A record with no full stop lost its last word | Closed, but a cut-off record is now filed as if whole |
| A sheet whose record is not a list made the repair throw, which failed the whole load | Closed |
| The name test took a title for the name ("The Gray Fox") | Closed, then over-corrected; see the second review |
| A campaign with no pinned voice got no VOICE line | Closed |

## 3. Second review (of `b11be9d1`)

| Finding | New with the fix? |
|---|---|
| Any word of a name now "names" the person, so two people who share a surname take each other's sentences: a hero gets his wife's sentence as his fate line; an ending that mentions a relative is left bare | New |
| An ending written in a script with no letter case below U+2E80 (Arabic, Hebrew, Hindi and other Indic scripts, Thai, Amharic) is deleted whole and asked for again at every boot: the "does this line hold text" test knows cased letters and Japanese-range characters only | New |
| `RECORD—sentence` with an unspaced dash was taken before and is shown now; text after the RECORD line ("THE END"), a numbered or heading form, a parenthesis after the label and a full-width colon still reach the screen | One regression, the rest unchanged |
| A record ending in a quote or bracket loses that character | New |
| A closing paragraph beginning "The record — …" or "Record: …" is removed as if it were the line (0 of 25,938 paragraphs in the owner's transcripts have that shape) | New |
| The repair writes the word "ending" into each moment, and the Village's rule for holding back earlier adventures treats it as a word of the record: a player who types "ending" releases all 25 held moments | From the first build |

Checked and clean in the second review: idempotency for every name tried; the split's cost (linear, no hang); every ending path (no prose, rejected call, no companions, dead companion, the Village); the prompt on all 48 owner saves.

## 4. What the next attempt should do differently

1. **Name test: the first identifying word only**, whole-word, in any script. "Any word" is what let a shared surname through; "first word between `\b`" is what failed on accents. A surname-only mention then gets a harmless prefix.
2. **"Holds text" by exclusion, not by script.** A line is a rule only if it consists of rule characters (`-`, `—`, `*`, `_`, `=`, `#`, backticks, spaces). Everything else is text, whatever its script.
3. **The label in capitals only.** The prompt writes `RECORD:`; a line that starts with the capitalised word is never prose, while "Record:" and "The record —" are. That removes the trade between false positives and missed shapes, so every line that starts with the capitalised label can be removed wherever it stands, with any separator.
4. **Strip only matched wrappers** from the sentence (a closing quote only if the line opened with one).
5. **One place where a sheet's old ending is repaired before any reader**: before each turn's prompt is built, not only at load, so no reader needs its own repair.
6. **The gate that holds back the past must not read the label** the repair writes.
7. **Proof:** a fuzzer over names and scripts with a sound generator, the owner's saves through the load path, and an independent review before the push. The suite, the battery (39 of 39) and the replays were green both times.

## 5. Evidence

- Branch `claude/525-ending-voice` holds both commits, their tests and battery, and the reviewers' probes under `audits/reviews/525_ending_voice/`.
- The owner's saves: neither round's fault touches them (no accented or titled hero, no shared name word between sheeted people, English endings). The repair changes Ammut's ending on four sheets (The Princess) plus four more and Silas Morne's on two (The Village), once.
