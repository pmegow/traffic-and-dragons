# Classic d6 — #688

Date: 2026-11-05. Host: v1.1348. Dice: 0.91.0 / dde169c, copied by the committed-source publisher.

A checkbox labelled Classic d6 sits on the Numbers font label line in the roller. It defaults off and changes only d6 markings to conventional dots. Other dice retain their selected font. The dots use the existing number color, opaque ink and engraving mask; physics, face values, camera and sound are unchanged.

The optional classicD6 style flag follows saved looks, presets and mixed bags. Older presets default false; invalid saved flags are named and refused. The existing DiceSim.presetStyle API carries the flag into embedded looks without a new game settings control. Pip masks have their own cache key and cannot be overwritten by a delayed font load.

Upstream docs/CLASSIC_D6_2026-11-05.md records failing-first style tests, all 409 passing Node tests, and rendered checks at 390px/320px phone widths and desktop. The real checkbox is exercised, all six atlas face dot counts match physical values, d20 mask pixels and dice poses stay unchanged, toggling off restores numerals, changing/loading fonts retains dots, and presets survive reload. Mixed dotted/numbered d6s work together. All three corrected browser fixtures pass without page errors.

Host commit and push hooks run the required full gates. Live file hashes and the production feature check are recorded upstream after deployment. Physical-device accessibility and owner visual acceptance remain outstanding. Prior hosted CI 42120545187 failed the existing #679 Melt-dismiss timeout; that separate test and abandoned animation refinement are unchanged.
