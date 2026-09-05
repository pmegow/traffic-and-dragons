# The Gygax lens — a sourced review rubric for Traffic and Dragons

**Read this when** a class, XP, item, clock, death or companion change wants a second opinion from the game's
procedural ancestor, or before wiring the panel review skill (TODO #338). Research deliverable of the
TTRPG panel project (owner ruling 2026-09-05: research only, no skill yet).

**What this is.** A rubric of Gary Gygax's *documented* design positions, each with a source, a confidence
grade and the review question it asks of this game. **What this is not:** an impersonation. A review that
uses this file speaks as "the Gygax lens", never as Gygax, and cites the entry it is applying. Any claim
not in this file is not a Gygax position for our purposes.

**Evidence base.** Three research briefs in [`sources/`](sources/), one per lane: his own design writing
([A](sources/gygax_brief_A_design_writing.md)), his columns and public Q&A
([B](sources/gygax_brief_B_columns_qa.md)), and the historical and critical record
([C](sources/gygax_brief_C_historical_critical.md)). Quotes are capped at fifteen words. Entry references
below are `A:<heading>`, `B:<n>`, `C:<n>`.

**Confidence legend.** ● primary (his own words, verified) · ◐ secondary (attributed by a reliable source,
or read through a compilation) · ○ uncertain or contested. A ○ entry may inform a question, never a
verdict.

---

## 0. Cautions — read before applying anything below

1. **He would probably not call this product an RPG.** He defined the form as a live, cooperative group
   experience ("Pen-and-paper role-playing is live theater and computer games are television", B:17 ●;
   "There is no intimacy; it's not live", B:18 ●) and excluded storytelling and diceless games from it
   outright (B:13 ◐). An AI narrator running a solo player is, in his taxonomy, a computer game. The lens is
   therefore a **dissenting voice by construction**. Use it where his procedural craft applies (§1 to §7),
   and read §8 as the argument he would make against the product's core, not as a defect list.
2. **His rulebook voice is not his table.** He said he ignored his own rules when the game called for it
   (B:2 ●), ran "seat of the pants" (B:3 ◐), rolled 4d6-drop-lowest and allowed re-rolls (B:32 ◐), and
   neither he nor Arneson played OD&D as written (C:13 ◐). Where the 1979 DMG and his practice differ,
   **this lens weights the practice and the through-lines that survive both.**
3. **"Gygaxian" is not Gygax.** "Rulings, not rules" is Matt Finch's 2008 synthesis (C:18); "Gygaxian
   naturalism" is James Maliszewski's 2008 coinage (C:17). Both name real patterns in his work; neither is
   his doctrine. The OSR picture of a fixed dungeon-crawl practice is contested by historians inside that
   scene (C:19 ○).
4. **He is not an authority on players or inclusion.** On-record 1975 statements ("Damn right I am a
   sexist", EUROPA 1975, C:20 ●) and gendered design choices in early TSR material (C:21 ●) are part of the
   record. Nothing in this lens touches player experience, table culture or who the game is for.
5. **Several famous lines are unverified.** "The worthy GM never purposely kills players' PCs" could not be
   traced to a book (A: misattributions); "Role-playing isn't storytelling…" traces only to a 2008 Wired
   obituary with no original occasion (B:16 ○). The lens does not lean on either.
6. **Some positions are 1970s wargaming artifacts.** Player-skill scoring, tournament meat-grinders and
   multi-party clock logistics answered problems a convention hall had (C: cautions). Ask whether a
   position solves a problem *this* game has before importing it.

---

## 1. Time and the campaign clock

| # | Position | Evidence | The question it asks |
|---|---|---|---|
| 1.1 | A campaign is not meaningful without strict time records. | "YOU CAN NOT HAVE A MEANINGFUL CAMPAIGN IF STRICT TIME RECORDS ARE NOT KEPT" — DMG 1979 p.37 (A ●) | The campaign clock (`clock.js`, #73) is the direct descendant. Does every turn move it, and is a zero-advance turn recorded rather than inferred (`.ta` stamping)? |
| 1.2 | Time exists to make specific systems bite: healing, travel, item manufacture. | "Failure to keep careful track... will result in many anomalies" — DMG p.37 (A ●) | What in this game actually *costs* time? Rest, travel, spell recovery, scheduled futureEvents. A clock nothing consults is bookkeeping. |
| 1.3 | The clock's home rationale was several parties sharing one world. | C:26 ◐ (secondary reading of the DMG chapter) | Weak fit: one player, one party. The analog is NPC schedules and the futureEvents ledger colliding with the party's choices. |
| 1.4 | The campaign is connected episodes with no planned end. | "I assumed no campaign with an end but connected episodes" — EN World 2003 (B:30 ◐) | Do chapters and eras (memory tiers) read as a continuing world, or does the story compiler impose an arc the play never had? |

## 2. Class progression and XP pacing

| # | Position | Evidence | The question it asks |
|---|---|---|---|
| 2.1 | Too-rapid advancement puts the game beyond the referee's control; AD&D existed partly to slow it. | "D&D tends to allow too rapid growth of player-characters" — The Dragon #28, 1979 (A ◐) | Against the XP curve that landed 2026-09-05 (`classXpLevels()`, `class_bible.js`): how many *sessions of play*, not turns, separate levels at 1–5, 5–10, 10+? A refresh that jumps a whole party a level is the failure he named. |
| 2.2 | Excess treasure or XP is a named failure mode, not generosity. | "Monty Haul" defined in the DMG glossary (A ●); "not... some mad Midas" — DMG p.92 (A ●) | The per-response GM XP clamp (`GM_XP_CAP_PER_LEVEL`, #302) is the right instinct. Is the clamp per response the right unit, or can a chatty turn sequence still Monty-Haul? |
| 2.3 | XP for treasure scales with the risk taken to win it; easy gold is worth less. | "5 g.p. to 4 x.p., 3 to 2, 2 to 1..." — DMG pp.79–86 (A ●) | Milestone and quest XP (quests.md) reward outcomes. Is there any risk weighting, or does a talked-past danger pay the same as a survived one? |
| 2.4 | Sharply distinct class archetypes and group cooperation over individual combat power. | "bastardized the class-based system" — GameSpy 2004 on 3e (B:7 ●) | Do the class bible's features keep classes *feeling* different at the same level, or do archetype picks converge on the same combat verbs? |
| 2.5 | Class rigidity was, per an insider, deliberate difficulty. | Tim Kask, "Gary's fiendish wit" (C:27 ◐) | Where the class bible gates a capability behind level or archetype, is the gate a design choice with a stated reason, or a fill-phase accident? |
| 2.6 | Rule complexity works against adventure design and play speed. | "The more rules one must pay close attention to, the more difficult" — EN World (B:4 ◐) | Every bible entry the GM must honour is prompt weight. Which class features are never referenced by the prompt or the parser, and why do they exist? |

## 3. Items, gold and the resource economy

| # | Position | Evidence | The question it asks |
|---|---|---|---|
| 3.1 | Magic items and treasure should be scarce; flooding the game with wealth undermines it. | DMG p.92, Monty Haul glossary (A ●) | Item bible pricing and the wares economy (#81): can the GM be talked into gifting items, and does the parser refuse un-priced acquisitions? |
| 3.2 | Vancian casting was chosen for dungeon pacing: memorize, expend, run dry. | "memorize then fire and forget... seemed perfect" — Strategic Review #6, 1976 (A ●) | Spell slots and `restSpells`: does running dry actually happen in play, and does the GM narrate scarcity or quietly ignore it? |
| 3.3 | The low-level caster is a one- or two-shot weapon by design. | "The low-level magic-user is mainly a one- or two-shot weapon" — EN World 2002 (B:22 ◐) | Does the capability bible's cost axis make early casters *feel* like this, or do cheap cantrips erase the choice? |
| 3.4 | Henchmen decide success or failure in the long view, and let play continue without the main PC. | "They usually spell the difference between failure and success" — DMG p.34 (A ●) | Companions are the analog. Are they mechanically load-bearing (their own sheets, XP, death) or narrative furniture? The companion level-up and death propagation paths are the test. |

## 4. Lethality and death

| # | Position | Evidence | The question it asks |
|---|---|---|---|
| 4.1 | Stakes require a real threat of death, level loss or lost treasure. | "How I detest namby-pamby whiners that expect to play... without threat of character death" — EN World ~2005 (B:20 ◐, page unverified) | Can the player character die in this game at all, and what does the GM prompt say about it? If death is impossible, every risk tag is theatre. |
| 4.2 | But he did not enjoy killing PCs, and a careful player's freak-roll death may be softened to a lesser consequence. | "The answer is definitely not" (B:20 ◐); "the freakish roll of the dice will kill the character" — DMG p.110 (A ●) | The reckless-wildcard button and combat close: is there a graded consequence ladder (maimed, captured, indebted) between "fine" and "dead", and does the GM reach for it? |
| 4.3 | One roll is never fudged: resurrection's system shock. Failure is forever. | "One die roll that you should NEVER tamper with is the SYSTEM SHOCK ROLL" — DMG p.110 (A ●) | The W2 death gating and `npcDeathCorrections`: when the engine records a death, how hard is it to walk back, and is a retraction a *ruling* with a receipt or a quiet edit? |
| 4.4 | Fairness cuts both ways: give the monster an even break. | "ALWAYS GIVE A MONSTER AN EVEN BREAK!" — DMG p.110 (A ●) | Combat tracker and foe routing: do foes get their tactics and morale, or does narration steer every fight to a PC win? |
| 4.5 | Later in life he advised tuning campaigns so PCs mostly survive. | "at least a 95% chance of surviving" — Master of the Game 1989 (A ◐, not verified against the text) | The two positions bracket the design space: death possible, death rare, death earned. Which does this game actually deliver over a hundred turns? |
| 4.6 | Module lethality was budgeted against stated party strength, not sadism. | Party of "5 or more", level "at least the 9th" (C:28 ◐) | Does the GM see a challenge budget (party level, size, resources) when it sets a foe, or does the foe's threat float on prose? |

## 5. Rulings, rules and the referee

| # | Position | Evidence | The question it asks |
|---|---|---|---|
| 5.1 | The spirit of the game over the letter of the rules. | "IT IS THE SPIRIT OF THE GAME, NOT THE LETTER OF THE RULES" — DMG p.230 (A ●) | Engine notes and refusal paths are rulings. When a tag is refused, does the GM get the *reason* so it can rule in spirit, or only a rejection? |
| 5.2 | The referee is the final arbiter, not an interpreter; no rules lawyer overrides them. | "final arbiter, rather than the interpreter of the rules" — DMG preface (A ●); "Rules lawyers are unmentionable" (B:5 ◐) | Who is the arbiter here: the GM model, the parser, or the player's Sync button? Table Talk answers rules questions. Can the player use it to overrule the GM, and should they? |
| 5.3 | But uniformity matters: divergence past a point stops being the same game. | "it must have some degree of uniformity" — DMG preface (A ●); Dragon #26 on grey areas (B:26 ●) | The bibles are the uniformity contract. When the GM invents a capability not in the bible, is that a ruling to record or drift to correct? |
| 5.4 | The referee may overrule the dice, except where the rules say never. | "You have every right to overrule the dice at any time" — DMG p.110 (A ●) | `diceTxt` and roll tags: are rolls binding on the GM, advisory, or decorative? The answer should be one rule, stated in the prompt. |
| 5.5 | Rules serve fun; rule lookup that interrupts play has inverted the priority. | "the rules for an RPG should facilitate the enjoyment" — EN World 2002 (B:1 ◐) | Every bible clause the GM must recall mid-scene is a lookup. Which ones earn their place in a turn's prompt? |
| 5.6 | Secondary skills deliberately left un-mechanized; personality is the player's, not the dice's. | A: secondary skills (◐); A: player-decided personality (◐) | The skills bible ladder mechanizes what he left to judgment. That is a legitimate choice, not an error, but it should be owned as one. Disposition dials for the GM are consistent with him; dice-rolled PC personality would not be. |

## 6. Alignment

| # | Position | Evidence | The question it asks |
|---|---|---|---|
| 6.1 | Alignment shapes behaviour; it is a commitment, not a label. | "must certainly affect, if not dictate, much of the actual behavior" — DMG (A ●, wording near-verified) | `statedAlignment` versus `actualAlignment` with drift is exactly this. Does drift feed back into the GM's reading of the character, or only the sheet? |
| 6.2 | Alignment is a private compass for player and referee, not announced at the table. | He "shuddered" at players announcing alignment (B:23 ◐) | Is the *actual* alignment ever shown to the player in-fiction? His position argues for whispers and consequences, not a readout. |
| 6.3 | Two independent axes, because chaos is not evil and law is not good. | "chaotic does not necessarily mean evil nor lawful equate to good" — Strategic Review 1976 (A ●) | `alignLaw` and `alignGood` are two axes. Do the drift rules move them independently, or does one act collapse both? |
| 6.4 | Some class gates on alignment are strict. | "The Paladin is Lawful Good — period" (B:25 ◐, garbled compilation) | Do any class-bible archetypes carry an alignment gate, and if not, is that a deliberate departure? |

## 7. Prose, narration and world

| # | Position | Evidence | The question it asks |
|---|---|---|---|
| 7.1 | The referee is "nature": the source of all sensory data. | "He is nature. He provides sensory data" — Role-Playing Mastery 1987 (A ●) | The prose-voice directive and STYLE block: is the GM feeding senses (sight, sound, smell) or summarising events? |
| 7.2 | A dungeon needs game logic and verisimilitude first. | "The first quality a dungeon needs is game logic and verisimilitude" — EN World 2003 (B:29 ◐) | The location graph and map cleanup (#154, #156): do places have reasons, exits and inhabitants that persist, or does each scene spawn geography? |
| 7.3 | AD&D is a game for fun and imagination, not a simulation. | "It does not stress any realism" — DMG p.9 (A ●) | A caution against over-mechanizing. The clock, economy and skills should serve play, not model a world for its own sake. |
| 7.4 | Named literary debts: Leiber, Vance, Howard, de Camp and Pratt, Lovecraft, Merritt. | Appendix N (A ●) | The game calls itself sword and sorcery. Leiber is on the author panel for exactly this; the Gygax lens seconds the nomination. |
| 7.5 | Story is an adjunct to the adventure the PCs experience, not the goal. | "As for a story, that's an adjunct to the 'adventure'" — Dragonsfoot 2005 (B:15 ◐) | Chapter summaries, the montage and the wrap-up note compile a story *after* play. That is consistent with him. A skeleton that steers play toward its beats is not. |

---

## 8. Where he would fight the product

These are the positions that argue against Traffic and Dragons' validated core. They are here so a review
can state the dissent honestly and then say why the product disagrees, not so the dissent wins by default.

- **Storytelling games are not RPGs; a directed game is not a game** (B:13 ◐, B:16 ○). The campaign
  skeleton, secret gates and disposition dials are direction. The product's answer is that the player still
  chooses, and the drift stack exists to make consequences stick. The lens should ask, per feature, whether
  the player's choice still changes the outcome.
- **Computer play is television** (B:17 ●). Car Mode is passive listening by design. The lens has nothing
  useful to say about Car Mode and should recuse itself there.
- **The DM as entertainer is a degradation** (B:6 ●, said of 3e). Prose voices and author DNA are
  entertainment craft. The lens will call this a shift from referee to performer. The product's answer is
  that with one player and no table, performance *is* the medium; the check is whether performance ever
  overrides a rule.
- **Time strictness for its own sake** (1.3). His rationale was multi-party logistics. If the clock ever
  costs the player fun without costing the character anything, he would drop it too (7.3).
- **He did not consider himself a storyteller** (B:14 ◐). The story compiler and mementos are exactly the
  artifact he refused to aim for. The product treats them as a by-product, which is his own word (7.5).

## 9. Things the lens must never say

Drawn from the three briefs' misattribution sections. A review that asserts any of these is misusing the
lens.

- That he wanted XP mainly for kills. Treasure was the engineered channel (A).
- That he ran, or preached, an adversarial kill-the-players game. He denied enjoying it and wrote fairness
  both ways (A, B:20). Tomb of Horrors was a tournament test for expert players (C:7).
- That he opposed house rules. He opposed *published, sold* variants that unbalanced the game (B:27 ●) while
  house-ruling his own table (B:32).
- That he thought "true" roleplaying is dice-free. He called chance-free play improvisational theatre, not
  an RPG (B:12 ◐).
- That "rulings not rules" or "Gygaxian naturalism" are his phrases (C:17, C:18).
- That he ran strictly by his own books (B:2 ●).
- That Rule 0 is unbounded. The same book pairs discretion with a uniformity duty (A).

## 10. Positions that moved, and how the lens weights them

| Topic | Early | Late | Lens weighting |
|---|---|---|---|
| Rules as guidelines vs standard | 1974 "guidelines... altered" (A ●) | 1979 uniformity duty (A ●); 1982 "serious players... official material" (B:28 ◐) | Read the 1979–82 hardening as a TSR business posture as much as conviction (C:16 ○). Weight his stated practice (B:2) and the 1974 framing. |
| Alignment axes | one axis (Law–Chaos) | two axes from 1976 (A ●) | Use the two-axis position; it is the settled one and matches the game. |
| Lethality | 1979: fairness, one unfudgeable roll (A ●) | 1989: design for ~95% survival (A ◐) | Treat as a bracket, not a contradiction: death possible, rare, earned. |
| Complexity | AD&D rules-dense | 1999 Lejendary Adventure simplification (A ○) | Too weakly sourced to carry a verdict. Use 2.6 and 5.5 instead. |

## 11. Open verification gaps

Carried from the briefs so a later pass knows where to dig.

- Dragonsfoot Q&A pages returned 403; every Dragonsfoot quote came through a compilation (B).
- EN World thread page numbers in circulating compilations do not match the live thread (B:20 spot-check).
- GameSpy 2004 original pages are dead; quotes rest on Wikiquote's dated citations (B:6–8).
- Master of the Game "95% survival" and the "Seven Serious Flaws" wording not verified against the book (A).
- No Gygax statement on AI or a computer acting as referee exists; his computer remarks are about CRPGs as a
  medium (B: sourcing notes). Do not invent one.
- OD&D 1974 foreword, Mythus and Lejendary Adventure prefaces not read first-hand (A).
- No hard statistic on his own table's mortality rate (C).

## 12. How a review would use this file (for #338, not yet built)

A panel review names the member, the surface under review, and the entries applied. For each applied entry
it states the question, the finding against the actual code or prompt text, and the verdict, in the
AUDIT_FABLE shape (finding, remedy, living status, validation). Dissent from §8 is stated as dissent. The
review's first line carries the lens's own caveat: this is a rubric of documented positions, not the man.
