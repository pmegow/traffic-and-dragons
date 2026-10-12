# Combat

**Read this when** you touch the combat tracker, foe routing, COMBAT_* tags or the death propagation at a close.

Split out of CLAUDE.md on 2026-09-03 (#310); the map there links here. Version stamps and history links inside are the record as written — the contract lines are current unless a newer commit says otherwise.

## 10. Combat system

**Multi-foe (UA26)** — design + ratified decisions in [MULTI_ENEMY_COMBAT.md](../MULTI_ENEMY_COMBAT.md). Combat state lives in `worldState.combat`:

```
{ round: N,
  engaged: "name"|null,   // the foe the player last damaged — deterministic "who am I fighting" proxy for bare-tag addressing
  foes: [ { name, hp, maxHp, ac, atk, dmg, morale,
            stats?, immune?, resist?, vuln?,
            down?: "slain"|"fled"|"surrendered" } ] }
```

`[COMBAT_START:]` APPENDS a foe (cap 8; duplicate living name ignored + warn). A downed foe STAYS in `foes[]` (panel strike-through + GM aftermath context). Named `[ENEMY_HP:Name\|-X]` routes exact → contains (**#297, v1.768: reverse containment refuses a POSSESSIVE right after the foe's name — "Nolan Grimtide's raider" is a different creature — and demands word boundaries; epithets like "Kresh the Tall" still route**); bare routes single-living → engaged → first-living + warn (§7 rows). Attribute tags bind by positional adjacency to the closest preceding COMBAT_START; fallback governed by `COMBAT_ATTR_FALLBACK` (tag_table.js). **#612 (v1.1241, owner 2026-10-12): a pooled group's headcount is AUTHORED, never inferred from HP** — `[COMBAT_GROUP:N]` binds like the other attribute tags, `[COMBAT_GROUP:Name\|N]` addresses a foe by name any time (two fall → 6); N is 1..999, anything else is refused loudly and moves nothing; `foe.count` is read by ONE renderer, `foeLabel(foe)` (helpers.js: "Blight Husk Pack (8)"), which the tracker row, the prompt's `Enemy:` line and the enemy card all use; a foe with no recorded count (every older save) is its bare name; while a pack-worded foe has no count (`foeGroupUnrecorded`, the one predicate), the prompt's `Enemy:` line ASKS the GM every turn — `Headcount: unrecorded — emit [COMBAT_GROUP:Name|N] with how many are up` — and the card says "Not recorded" (v1.1242: the owner's fight declared on v1.1240 had no one asking). Proven by the `#612` engine test, the `#612` mobile-browser case and `dev/sabotage-612-group-count.js`. All foes down auto-closes the encounter even without `[COMBAT_END:]`. **#214 (v1.699): a victory-shaped `[COMBAT_END:]` RESOLVES foes still standing** — they are zeroed and marked slain *before* `propagateSlainFoes`, so a rostered foe's death still faces the same scene-evidence gate as any other named death (prose wins for rolled foes; evidence still wins for roster NPCs — that split is the whole design). Non-victory outcomes (fled/truce/disengaged/defeat) resolve nothing. Its sibling `buildCombatStaleNudge` asks when an OPEN encounter sees no combat tag for `COMBAT_STALE_TURNS`=2 — it measures tag SILENCE stamped at the post-handler seam, never prose. Legacy single-enemy saves are wrapped into the foes[] shape by `migrateWorldState`. `#cpanel` shown/hidden by `syncUI()`.
