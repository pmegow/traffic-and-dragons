# A/B — #667 STANCE clause on the lava-platform scene (2026-10-24)

**Question.** Does placing both feet and both hands in every pose clause (the #667 STANCE clause, plus the #208 ① body count on text-only party renders) change what Seedream 5 Pro paints for a crouching figure at a rail — the pose that came back with three boots in the owner's render that morning?

**Method.** Run in the owner's signed-in game at v1.1320 (`http://localhost:3000`, the working tree), through the engine's own functions: `buildSceneRenderRequest` built the writer brief from the hero's and the three companions' real sheets (Ammut, Frizwick, Daeris, Morwen Zethran — the Runelords save) and a scene text written from the owner's turn-107 narration (the grated platform over magma, the chained pillar of fire, Ammut crouched at the chain rail). **Control** = the brief with the STANCE clause stripped and no body count (the v1.1319 behaviour). **Stance** = the brief as shipped plus the count. One writer call per arm (`callGM`, gemini-3.8-flash, no history), then three `bytedance/seedream/v5/pro/text-to-image` renders of that arm's prompt (landscape_4_3). Six images in 110 s; about $0.41 of fal plus two writer calls.

**The writer's Ammut clause.**

- Control: *"Seen in three-quarter rear view, Ammut crouches low at the heavy chain railing, torso squared toward the bound pillar of fire, head tilted upward …"* — a crouch, nothing placed.
- Stance: *"Seen in three-quarter rear view from the left, Ammut crouches low at the iron railing with his right boot planted flat on the grate, his left knee dropped just above the metal mesh, his left gloved hand gripping the heavy iron chain railing, and his right hand braced against the grating floor for balance …"* — four contacts, each placed. Frizwick, Morwen and Daeris got the same treatment (both boots set wide; left boot forward, right braced; both boots shoulder-width, both hands on the pole).

**Result (the six frames, `c1–c3` control, `s1–s3` stance; the Ammut crops in `control_ammut.jpg` / `stance_ammut.jpg`).**

| | limbs on Ammut | bodies | Ammut's pose |
|---|---|---|---|
| c1 | 2 arms, 2 legs | 4 | crouch at the rail, one hand on the grate |
| c2 | 2 arms, 2 legs | 4 | deep lunge away from the rail |
| c3 | 2 arms, 2 legs | 4 | crouch at the rail, a hand on the hip |
| s1 | 2 arms, 2 legs | 4 | left hand on the chain, right hand on the grate, left knee down, right boot flat |
| s2 | 2 arms, 2 legs | 4 | left hand on the chain, right hand on the grate, knee down, right boot flat |
| s3 | 2 arms, 2 legs | 4 | left hand on the chain, right hand on the grate, knee down, right boot flat |

- **Limb count:** no extra limb in either arm. Three renders per arm cannot measure a failure the owner saw once in one render; this A/B is not evidence either way on the limb rate.
- **Pose fidelity — the clear effect:** the stance arm painted the written placement in 3 of 3 (the same four contacts every seed); the control's crouch was a different pose every seed (crouch, lunge, crouch). Placed contacts remove the ambiguity that an unplaced crouch leaves the painter, which is the mechanism behind the three boots.
- **Bodies:** 4 of 4 in all six (the count sentence rode the stance arm only; the control never multiplied a body at n=3).

**Verdict.** Ship as built (it is). The clause does what it is for at the level the prompt reaches — the painter gets one stance instead of a choice — and costs nothing on the other engines. The limb rate is a field question: the owner's renders over the coming turns are the sample.

**Files.** Frames downscaled to 1000 px (the originals were 2048×1536 fal JPEGs; the fal URLs are in the session, not kept here).
