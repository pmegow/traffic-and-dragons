# Author voice → attribute space (de-branding the prose-voice feature)

**Problem (user, 2026-07-29):** when the game ships, references to living authors must come out
of `AUTHORS` (data.js) — but the prose-voice feature is one of the game's most valuable. Can each
author's voice be decomposed into a **common set of rated attributes**, adjusted from a baseline,
that re-creates the voice without naming the author?

## Verdict: the assertion HAS MERIT — validated with one refinement

Reading all 13 shipped `vc` directives side by side, the evidence is strong: **the directives are
already written mostly in parameter language.** "Short, hard sentences — most under twelve words"
(Abercrombie) and "flowing, romantic sentences" (Rice) are opposite ends of ONE dial. "UNDERSTATE
everything" (Cook) and "bold and a little grandiose" (Howard) are one dial. "No similes" 
(Abercrombie ×3) and "ONE quiet extended metaphor" (Le Guin) are one dial. Roughly 80% of every
directive's content maps onto a shared scalar space.

**The refinement: it's a two-layer model, not a pure scalar space.**

- **Layer 1 — 12 shared scalar attributes (1–10).** Carries the bulk of every voice. This is the
  slider space and what ships.
- **Layer 2 — signature devices.** The residue that scalars cannot express: Gaiman's *one uncanny
  image stated flatly*, Wells's *parenthetical asides / never name the emotion*, Muir's
  *sublime-profane register collision*, Dinniman's *system-snark at the game's own stat lines*,
  Poe's *repetition and mounting cadence*, Lovecraft's *describe-by-implication*. Each author needs
  0–2 of these, expressible as short generic device clauses (no author name needed — "undercut
  every dramatic beat with a joke" is not a trademark).

Prediction to test in the lab: sliders alone will land recognizably close for the
parameter-heavy voices (Abercrombie, Cook, Clines, Rice, Howard) and will *miss the signature* on
device-heavy voices (Muir, Dinniman, Gaiman, Wells) until layer 2 is added. If that prediction
holds, the shipping design is: **attribute vector + device clauses, no names anywhere.**

## Layer 1 — the 12 attributes

| # | Attribute | 1 means | 10 means |
|---|---|---|---|
| 1 | **Cadence** | very short, clipped, fragments welcome | long, flowing, musical sentences |
| 2 | **Ornament** | plain transparent diction | baroque, lush, ornate diction |
| 3 | **Formality** | modern, conversational, slangy | antiquarian, formal, elevated |
| 4 | **Momentum** | contemplative, unhurried | breakneck, propulsive |
| 5 | **Darkness** | warm, hopeful | bleak, dread-soaked |
| 6 | **Humor** | none — fully severe | joke-dense, comedy-first |
| 7 | **Irony** | earnest, sincere | cynical, sardonic, undercutting |
| 8 | **Interiority** | external camera-eye | deep, obsessive inner voice |
| 9 | **Sensory** | spare, abstract | saturated concrete sensory detail |
| 10 | **Figuration** | no similes/metaphor | metaphor-rich |
| 11 | **Grandeur** | flat affect, understated | theatrical, grandiose |
| 12 | **Grit** | clean, bloodless | visceral — blood, mud, ugliness |

Attribute independence is imperfect by design (Ornament and Formality correlate; so do Darkness
and Grit) — but the pairs split real authors: Muir is high-Ornament/low-Formality (gothic diction,
anachronistic register), Abnett is high-Grit/low-Ornament. That's why both dials exist.

## Baseline ratings (1–10)

Rated from each author's shipped `vc` directive first, general knowledge of the prose second.
These are the lab's starting positions, expected to be tuned by ear.

| Author | Cad | Orn | For | Mom | Dark | Hum | Iro | Int | Sen | Fig | Gra | Grit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gaiman | 4 | 3 | 5 | 4 | 6 | 4 | 3 | 5 | 4 | 3 | 2 | 3 |
| Abercrombie | 1 | 1 | 3 | 8 | 9 | 6 | 9 | 7 | 5 | 1 | 1 | 9 |
| Dinniman | 2 | 2 | 1 | 10 | 5 | 10 | 8 | 6 | 4 | 3 | 4 | 6 |
| Clines | 3 | 1 | 3 | 9 | 4 | 3 | 3 | 4 | 5 | 2 | 2 | 4 |
| Le Guin | 6 | 3 | 8 | 2 | 4 | 2 | 1 | 6 | 5 | 6 | 3 | 2 |
| Howard | 5 | 5 | 6 | 9 | 6 | 1 | 1 | 2 | 9 | 6 | 8 | 8 |
| Cook | 2 | 1 | 3 | 5 | 7 | 4 | 7 | 5 | 3 | 1 | 1 | 6 |
| Wells | 3 | 2 | 2 | 6 | 3 | 6 | 6 | 10 | 3 | 2 | 1 | 3 |
| Muir | 8 | 9 | 4 | 6 | 7 | 8 | 8 | 6 | 8 | 8 | 9 | 7 |
| Abnett | 2 | 2 | 4 | 9 | 7 | 2 | 3 | 3 | 7 | 2 | 3 | 8 |
| Rice | 9 | 9 | 6 | 2 | 6 | 1 | 1 | 9 | 10 | 8 | 8 | 5 |
| Poe | 9 | 9 | 9 | 3 | 10 | 1 | 2 | 10 | 7 | 7 | 7 | 5 |
| Lovecraft | 8 | 8 | 10 | 2 | 10 | 1 | 1 | 7 | 5 | 5 | 6 | 4 |
| Moorcock | 7 | 7 | 8 | 6 | 8 | 1 | 3 | 6 | 7 | 6 | 8 | 6 |

## Layer 2 — signature devices per author

| Author | Devices (generic clauses, no name needed) |
|---|---|
| Gaiman | one uncanny image per scene; state the impossible as flatly as the ordinary |
| Abercrombie | deliberate sentence fragments; a bleak joke at the grimmest moment |
| Dinniman | undercut EVERY dramatic beat with a wisecrack; snark at the game's own stats and rules |
| Clines | reveal the strange one piece at a time; end on a small urgent hook |
| Le Guin | ONE quiet extended metaphor developed across the whole scene |
| Howard | one vivid image per sentence; strong concrete verbs of motion |
| Cook | report horror and sorcery like a bored veteran who has seen worse |
| Wells | wry parenthetical asides; convey feeling by observation, never by naming the emotion |
| Muir | slam the sublime and the profane together in one breath; a sudden anachronistic joke inside a gothic sentence |
| Abnett | track space precisely — distances, angles, who moves where |
| Rice | confessional intimacy; describe beauty and horror with the same reverence |
| Poe | repetition and mounting cadence; the narrator rationalizes while unraveling |
| Lovecraft | describe by implication — the thing glimpsed, never shown; one archaic weird adjective per beat, never stacked |
| Moorcock | every triumph carries the visible seed of its price; feverish dreamlike intensity at sorcery |

## The test instrument

**`author_voice_lab.html`** (root satellite, network-first in sw.js). Per author row (collapsible):
a static flavor-reference passage (original text, authored for this doc — same cellar scene per
author so comparison is direct), the 12 attribute sliders at baseline, and three test conditions:

1. **Test prose** — rewrites the shared neutral passage using a style directive built ONLY from
   the slider values (no author name anywhere in the prompt). The hypothesis test.
2. **+ devices checkbox** — appends the layer-2 device clauses (still no name). Tests the
   two-layer refinement.
3. **Author-name control** — rewrites using the real shipped `vc` directive. The control arm.

Judge by comparing 1 (and 1+2) against the flavor reference and the control. Slider tweaks
persist per author in `tnd_voicelab_v1`; Reset returns to baseline. `?stub=1` (or `#stub`) fakes
the model call for UI testing without a key. A final **Custom** row starts all dials at 5 with no
target — move one dial at a time to learn what each attribute does (dial-rewrite only; no
control arm, since there is no author to control against). Slider labels are spelled out in full
and every slider/label tooltip shows the current band's meaning live (user calls 2026-07-30:
clarity over brevity; tooltips on all actions).

Moorcock added 2026-07-30 (user request) — rated like the rest, entry appended to `AUTHORS`.

**Note on content DNA:** `AUTHORS` also carries `contentDNA` (story-shape directives — arc
structure, NPC texture, ending flavor). That is a SEPARATE de-branding problem: contentDNA text
is already author-name-free prose and can ship almost as-is under neutral labels ("Grimdark",
"Quiet Myth", "System Crawl"…). Only the `vc`/name/blurb layer needs the attribute treatment.

**Not done yet (deliberate):** no engine changes — `AUTHORS`, `proseBlock`, and `buildSysPrompt`
are untouched (drift surface). The lab is read-only against data.js. Shipping integration
(replacing `vc` strings with generated directives + neutral display names) is a follow-up
decision AFTER the lab validates the attribute vectors by ear.
