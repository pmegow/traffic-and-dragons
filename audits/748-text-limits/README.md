# Blueprint text limits — Designer v0.77 / engine v1.1423

The reported warning reads caps from `blueprintTextFields`, also used by runtime
normalization. Increasing only the warning threshold would let accepted drafts
lose text when imported. The shared registry now sets ordinary fields to 4,000,
premises to 12,500, individual rules to 6,000 and habitats to 400 characters.
All four are five times their former value. The character backstory cap stays 2,500.
The assistant uses the registry for both explicit writes and model instructions.

Before editing, the new engine assertion failed on premise 2,500 versus 12,500.
[The reproduced three-field warning](before/748-limits-desktop.png) used three
4,000-character NPC fields. [Desktop](after/748-limits-desktop.png) and
[phone](after/748-limits-phone.png) now show no warning at that boundary.
One additional character still produces a warning and blocks publication.

Verification:

- 153 focused engine assertions pass: every accepted boundary survives runtime
  import exactly; oversized input still clamps, authoring preserves originals.
- 18 assistant checks and 9 abilities checks pass, including explicit writes at
  and beyond the new boundary and model instructions matching the registry.
- [Full Designer browser suite](browser.txt) passes; no real model or catalog
  writes. Existing overflow fixtures were enlarged to remain over the new cap.
- [Prose mutation battery](sabotage-prose.txt): 13/13 named clauses caught.
- [Assistant mutation battery](sabotage-assistant.txt): 20/20 named clauses caught.
- [Rule mutation battery](sabotage-rules.txt): 2/2 named clauses caught, including
  complete rule endings in the prompt at 6,000 characters. Short-rule prompts stay
  byte-identical. Nine focused abilities engine assertions pass.

The first mutation run caught a stale fixture: its imported note no longer exceeded
the new cap, so shortening unrelated text went undetected. Enlarging that fixture
restored the failure condition; the unchanged protection catches the mutation.
The normal full engine/standalone and pre-push browser gates run on this checkpoint.
