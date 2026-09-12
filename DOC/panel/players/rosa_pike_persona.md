# Rosa Pike — the Commuter

**Read this when** Car Mode, TTS voices, the "previously on" recap, turn length, the fourth button, voice
input, interruption and resume, or anything the player must consume without looking wants a second opinion
from the player whose hands are on a steering wheel.

**What this is.** A COMPOSITE persona, assembled from patterns repeated across public forum threads,
accessibility communities and audio-listening discussion. Rosa is not a person and never was. Every position
below is a pattern seen in at least two sources, or one source plus a named product behaviour, with the
sources cited. **What this is not:** a user interview, a survey, or a claim about how common this player is.
Confidence legend: ● a thread read directly · ◐ secondary, aggregated, vendor-authored or summary-only ·
○ inferred, no source read.

---

## Identity

Forty-five minutes of driving a day that used to be radio. She wants those minutes to be a story she is
inside of, and she has exactly one free channel: her ears and her voice.

## Play habits

- **Session shape:** two sessions a day, 20–25 minutes each, bounded by a car park at both ends. Sessions end
  mid-scene, always. She never once chooses when to stop.
- **Solo or group:** solo, necessarily. She has never played at a table.
- **Text or audio:** audio out, voice in, with a phone in a cradle she is not supposed to look at.
- **Device:** phone, mobile data, bluetooth car audio. Sometimes the same session continues on headphones
  while she walks the dog.
- **Tell:** she asks "what was I doing?" out loud, to the car, before she has asked the game anything.

## What she wants from a home village

The village is, for her, the best-shaped content the product has ever had — **because nothing in it needs a
decision made at a junction.** A shop, a conversation, a walk to the blacksmith: all of these survive being
interrupted by a merge. A fight does not. She wants short spoken turns, a spoken recap on resume, and the
ability to say a plain sentence and get one paragraph back. She would happily spend a whole week of commutes
doing nothing but talking to the tavern keeper, provided the tavern keeper is different each time.

What she does not want is to be told about things she cannot act on. A spoken paragraph describing a
noticeboard she cannot read is dead air (Lane OWN O5 ●, the "witnessing things just for flavour... can
quickly become boring" warning, which is sharper in audio than on screen).

## What she hoards / sells / never touches

She hoards by **neglect**, not by strategy. Inventory management is effectively unreachable by voice: she
cannot scan a list, cannot compare two items, cannot remember what the third one was by the time the sixth is
read out. So she never sells and she never uses a consumable, and her bag fills up for months. This is the
same end state as Bert Kovac's and a completely different cause, which matters: a fix aimed at the hoarding
reflex will not touch Rosa at all.

The only inventory action that works for her is one the GM offers her in a sentence she can accept with one
word.

## How she feels about retired characters

She likes hearing that they exist. She wants to be *told*, not shown a list — "the old soldier from the
mountain campaign has the house by the mill" is worth a lot to her, and a roster screen is worth nothing. Her
risk is voices: if every resident is read in the same synthetic voice she loses track of who is speaking, and
if they all get distinct voices she may find it theatrical. The community is genuinely split on exactly this
and there is no safe default (Lane E #7 ●).

## Trust: what breaks it with an AI GM

- **Junk read aloud.** A tag, a bracket, a stray asterisk, a UI string. On screen it is noise; in the car it
  is the illusion collapsing. The single substantive request in a TTS reader thread was automatic stripping
  of footnotes, headers and pagination — the thing that ruins listening is the reader speaking non-content
  (Lane OWN O14 ●). A blind player asked a game to stop "constantly reminding" him of controls he already
  knew (Lane E #3 ●).
- **Contradiction she cannot check.** She has no scrollback. When the GM says the smith is a woman today and
  a man on Thursday, she cannot go and verify, so the doubt stays. The memory failure that a desk player
  corrects with a scroll is, for her, permanent.
- **Being made to look.** Anything that requires reading, choosing from a numbered list she must see, or
  confirming on screen, ends the session. Real-world hands-free systems fail exactly here: confirmations
  force a glance anyway, and people go back to physical controls because they are lower cognitive load
  (Lane E #9 ●).
- **A turn that will not end.** She has a fixed budget of attention per stretch of road.

## Positions

| # | Position | Evidence | The question it asks of the village design |
|---|---|---|---|
| R1 | The recap is a feature, not a courtesy. A listener who comes back after a gap needs the thread handed to them or they do not re-enter. | Spotify Newsroom, "Audiobook Recaps beta", 2025-11-13 — an "audio bookmark that speaks", explicitly modelled on television's "previously on" ◐ (company source, product framing). Podcast-industry retention write-ups: roughly a third of listeners leave in the first five minutes ◐ (vendor data, unaudited). Lane C #6 ● — "not knowing what to do next" is the named killer of solo campaigns. | Car Mode already speaks `carRecapText` on resume past a threshold. Is the recap *state* (who is here, what I own, where I am) or *story* (what happened last)? In a village with no plot, the story recap has nothing to say and the state recap is the whole content. |
| R2 | Redundant spoken narration is punished faster than bad prose. Verbosity is the audio-native sin. | AppleVis, "VoiceOver is too Verbose in Voice Dream Reader", 2015-05-22 — a formatting artefact read aloud as "dot" ●. AppleVis, "The Inquisitor Audiogame Adventure", 2013-02-25 — a request to stop re-reading known controls ●. Hacker News, "Show HN: Lue – Terminal eBook Reader with TTS", 2025-08-16 — the valued feature is stripping headers and pagination ●. | The owner's standing rule that prose length is never a positive is the same finding from the other side. In the village, what is the *shortest legal turn*? If a shop visit costs three paragraphs, Rosa gets four shops per commute. |
| R3 | The interruption is not an edge case; for this player it is every session boundary. | Spotify Community, podcast playback stepped on by car navigation prompts ◐ (secondhand, page would not load). Mudlet forums, "TTS text to speech demo", 2021 — a skip function was added specifically so a player could interrupt a long block being read aloud ●. | Car Mode's bookends handle resume. What handles *stop*? Can she say "stop" or "hold" mid-paragraph, and does the engine know where she was — or does the turn complete into an empty car? |
| R4 | Voice input fails often enough that the design must survive being misheard. | TheAutopian comments, "In-Car Voice Commands May Be the Most Useless Modern Car Feature", 2025-12-12 — misheard basics, proprietary phrasing required, confirmations forcing a screen glance ●. Hacker News, "Show HN: D&D meets Siri", 2024-08-23 — speech recognition mishearing selected an unintended action ●. | An unintended action in a dungeon is a death. In the village it is a wasted minute — which is an argument that the village is the *right* place to harden voice input, not a reason to skip it. Is there an undo she can speak? |
| R5 | A no-danger setting is the one that fits driving, because nothing in it needs a decision under time pressure. | Inferred from R3+R4 and the village's own shape ○ — no source read states this. Adjacent: Hacker News, "Cozy video games can quell stress and anxiety", 2025-04-19 — low-stakes play as recovery from high-alert attention ●. | This is the strongest product argument in the whole panel and it is the least sourced. Worth stating as a hypothesis and testing, not asserting. |
| R6 | Audio-first players want depth, not merely access. A narrated menu is not a game. | AppleVis, "Seeking feedback and suggestions from blind gamers", 2015 — RPG named the most wanted and most underserved genre; fatigue with shallow "choose the link" storybook games ●. intfiction.org, "Accessible interactive fiction", 2023-04 — parser/command-line interfaces are far friendlier to screen readers than choice-based GUI tools ●. | The suggestion buttons are a choice-link interface. In Car Mode, are they read as four options — and if so, is that the shallow storybook shape these players named? Typed/spoken free input is the accessible shape. |
| R7 | Character voices are a real split: full cast buys immersion and risks theatre; one narrator needs range. | Goodreads discussion, "Audiobooks with full cast or single narrator", 2014 — both camps argued; one weak voice in a full cast "ruins everything" ●. | The product filters voices by character gender (#402). Does the village — which is *all* conversation with residents — become the place where the voice bank either proves itself or exposes itself? |
| R8 | A self-voicing app that ignores the listener's own speech-rate setting feels jarring. | AppleVis, "Speeding up voice for self-voicing games", 2025-05/2023 ● — switching between a game's built-in voice and the system voice at a different rate was the complaint. | Does Car Mode expose rate, and does it persist? Rosa listens to podcasts at 1.4×. |
| R9 | Synthetic voice is accepted for information and resented as a replacement for performance. | Hacker News, "AI is going great for the blind", 2025-09-03 — AI narration called slop by some, defended by others as the only access route for ~30% of titles that have no human narrator ●. | The GM's narration is performance, not information. This predicts Rosa forgives a plain voice for shop stock and does not forgive it for a death scene — which the village conveniently does not have. |
| R10 | Inventory is unusable by ear, so an audio player's bag only ever grows. | Inferred ○ from R2 (list-reading intolerance) plus Lane B #4 ● (hoarding persists even when actively painful). No source read describes voice-driven inventory management. | If the village's purpose is to let a player unload, can unloading be done in one spoken sentence — "sell everything I'm not wearing" — with the GM reading back a total, not a list? |

## Gaps

- **forum.audiogames.net, the single most relevant community for this persona, was unreachable** — Cloudflare
  blocked every attempt, by fetcher and by browser. The accessibility evidence here comes from AppleVis and
  intfiction.org instead, which skew toward iOS users and interactive-fiction players respectively.
- **No first-person account was found of someone playing a text RPG while driving.** R5, the load-bearing
  claim that the village suits the car, is ○ inferred. It is the highest-value thing to validate with a real
  listener before building for it.
- **No evidence on "repeat that" / state read-back** in an audio RPG. Inferred from adjacent accessibility
  threads only.
- **Podcast retention numbers are vendor-published and unaudited** (O15 ◐). Use them as direction, never as a
  threshold.
- **Reddit is absent** — the commuting, audiobook and driving communities there are hard-blocked. A car-blog
  comment thread stands in for the voice-command complaint, which is a real sampling compromise.
