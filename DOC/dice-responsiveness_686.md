# Dice responsiveness — #686

Date: 2026-11-05. Host: v1.1346. Dice: 0.89.0 from 01d6f0c, published by the committed-source release tool into roller/.

Short sweeps lost their final pointer position, could lack a recent anchor after holding, and were rejected by a world-speed threshold at close zoom. Dice 0.88.0 retains press/coalesced/release input and recognizes screen-space motion, with a 0.5 m/s minimum fling, existing boost and ceiling. Real touch/mouse pointer-handler tests fail six short-sweep cases on 0.87.0 and pass all twelve fling/drop cases after.

Transparent glass and quartz also render a full-viewport multisampled refraction buffer. Dice 0.89.0 halves its width/height, cutting offscreen pixels by 75%, while front faces and numerals stay at full canvas resolution. Three-die software-rendered phone dimensions measured 36-39% less total rendering time. This is not a physical-phone FPS claim; far-side refracted detail is softer. Camera distance stays unchanged, with the owner's screenshot retained as a fallback after phone feedback.

Upstream evidence: docs/TOSS_2026-11-05.md and docs/TRANSMISSION_2026-11-05.md in dice-sim. 404 Node tests pass. Browser comparisons cover phone and desktop, actual gesture release states and playback, unchanged main canvas resolution, and glass/quartz renders. Physical-phone performance/feel remain VERIFY.

The host changes only the vendored release, required markers, release notes and task records. The commit and push hooks run the complete host engine, verifier and browser gates. Deployment and live-file checks are recorded upstream after publication. Previous hosted CI 42113197837 failed the existing #679 Melt-dismiss timeout; this task does not alter that test or reopen the abandoned animation work.
