# Noctina - village night, v1

Owner-selected and authorized for game integration, 2026-09-27. Village exterior night (21:00-05:00), seed-only; excluded from unrelated campaigns' general ambience pool.

Music: Noctina, owner Suno account highdefinitionbuttons823. Song ID ff0a52f1-8590-4ba6-9c19-11ee87414f54; embedded creation 2026-09-28T01:02:19Z. Original official download preserved in Audio/Music/Village-Night/sources/Noctina.mp3; SHA-256 in dev/audio-delivery.json. Prior session establishes Pro as the intended plan; billing evidence is not in this repository. The music is not CC0: its rights derive from the owner's applicable Suno paid-plan grant.

Effects (CC0 1.0; source-page licenses verified 2026-09-27):

- Owl Hoot, Breviceps: https://freesound.org/people/Breviceps/sounds/465697/ (public HQ MP3 preview).
- Coyotes howling, SamsterBirdies: https://freesound.org/people/SamsterBirdies/sounds/640059/ (public HQ MP3 preview).
- Flight Bird #1, Joseph SARDIN / BigSoundBank: https://bigsoundbank.com/flight-bird-1-s2891.html (WAV wing foley).
- Ambiance_Nature_Night_Cricket_Calm_Loop_Stereo, Nox_Sound: https://freesound.org/s/637083/ (existing project WAV).

Source-page HTML for the three new effects is retained locally. CC0 permits editing and commercial reuse; credits are retained for provenance.

84.15-second loop candidate. Music trimmed to 1.05-89.20 seconds, 4-second tail/head crossfade. Quiet continuous crickets; sparse owl calls, one flutter and one filtered distant-coyote passage. Delivery: mono, 44.1 kHz, 128 kbps MP3 with gapless header. Previous cricket delivery retained for rollback. Sources, separate layers and build.py are in Audio/Music/Village-Night (gitignored). The existing ambience controller supplies volume, narration ducking, mic silence, pause, scene fades and resource limits. No new audio context, timer or state/prompt behavior.

Musical loop quality and balance need owner listening; automated checks are not a listening review.

## Dusk variant and saved-profile selection (2026-09-28)

Owner selected Noctina at dusk with crickets, without owl or wing sounds. The dusk delivery also omits coyotes: `sfx/village-dusk-noctina-v1.mp3`, 18:00–21:00. It sums only the preserved music and cricket WAV layers at unity gain, folds to mono, and encodes with the same gapless MP3 settings. Receipt: Audio/Music/Village-Night/dusk-mix.json. The full night mix remains unchanged from 21:00–05:00.

The original turn-202 save has a valid hushed soundscape profile whose observed allows list contains voices, water and wind. Profile-first matching previously bypassed seed-only soundtracks. These two owner-authored village bindings now explicitly supply their chosen palette; observed allows does not erase that choice. Explicit forbidden content, silence, stale/invalid profiles, physical setting limits, other campaigns, interiors and playback gates still prevent playback. General ambience matching is unchanged. The save is not edited.
