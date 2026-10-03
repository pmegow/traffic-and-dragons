# Ledger quartet recheck — 2026-10-03

Checked **4f46eb77 / v1.1123** in C:/Projects/traffic-and-dragons. **All four rows remain partial; none archived.** The new commit fixes five specific failure cases, not the full scopes of #511/#517/#518/#519.

| Row | Verified fixed | Independently reproduced remainder |
|---|---|---|
| #511 | Same-world footer preserves the tavern; the original regression is gone. | WARES before SUBLOCATION still files Brass comb on the old trading post. |
| #517 | Two 3 sp whistles against a 1 gp rope net zero gold. “3 coppers” parses as cp and the GOLD handler refuses it visibly, leaving the purse unchanged; it does **not** charge 0.03 gp. | Three wanted-ring variants pay 120 gp; WARES Arrow x20 is pinned to 1 gp per 20 and a full purchase emits Arrow x20 x20, leaving 39 arrows; “20 for 1 gp”, “5 gp per dozen”, “1 gp 5 sp” misprice; per-five want has max=1 and cannot make its payable bundle; wrong-unit adventure coin has no tradeRefusedPing; an empty companion take still spends 2 gp and says nothing moved. |
| #518 | Forward gift conserves held units at the 1/2/3 boundary and reports short quantity. | Empty companion reverse transfer mints Torch x2; gift at home removes both pack and chest potion but gives Bram one; independent Dagger loot is removed alongside the companion's missing throw. |
| #519 | Swapping to Frizwick makes undo refuse, preserving the spear; returning to Silas permits the undo and restores it. | A GM placement without a pack half still returns ok from undo, marks the spear taken and gives nobody the spear. ui-carmode.js:190 maps this successful placed result to “is back with you”. |

## Evidence

- [Full gate](VERIFY_ledger_quartet_2026-10-03/full-gate.txt): ALL GREEN, **2,616 engine assertions + 93 standalone suites**.
- [Targeted gate](VERIFY_ledger_quartet_2026-10-03/targeted.txt): “the ledger quartet” matches one section and passes five named assertions.
- [Fresh sabotage](VERIFY_ledger_quartet_2026-10-03/sabotage.txt): **10/10**, groups 3+3+2+2, all caught by the intended named assertion; disposable scratch clones only.
- Four CI corpus --check runs match their committed baselines: v1238, v1258, v1271, v1276; logs under replay-v*.txt.
- [Independent characterization script](VERIFY_ledger_quartet_2026-10-03/probe.cjs), [raw observations](VERIFY_ledger_quartet_2026-10-03/results.json), [console output](VERIFY_ledger_quartet_2026-10-03/probe-output.txt): **16 observations = 5 repaired-case groups + 11 remaining-case groups**. Synthetic Tess/Silas fixtures at t5; no source saves, production service, library or signed-in browser used. Existing previous-pass probe also rerun unchanged; its “inspect” results were checked against exact assertions and state above, not automatically promoted to passes.

The counted-arrow probe initially inserted a raw ware object directly and correctly received 20 arrows. That bypassed the relevant price-pinning boundary. Re-running through the real [WARES:Arrow x20\|1 gp] parser path reproduced 39 arrows. The retained script uses that actual failure path.

These remaining failures are already in the four requested rows; no duplicate issue numbers added. Green regression gates establish the repaired cases only; they do not refute the independent remaining failures. Tests and mutations changed no live engine files. This is an engine recheck, not new phone/audio/listening acceptance.

Run: node audits/VERIFY_ledger_quartet_2026-10-03/probe.cjs. It reports known-broken characterization outcomes, and exits nonzero on probe errors. Game code unchanged; tracker and evidence only; local commit, no push.
