# Peaceful indoor ambience: candidate list (2026-09-22)

Owner ask (2026-09-22): peaceful ambience for indoor locations; gentle windchimes (metal or bamboo) came to mind first. Village first, since it is the campaign returned to between the others.

**Every licence below is UNVERIFIED.** This list was built from search-index snippets in a session whose network policy blocks freesound.org and itch.io. Before any file enters `Audio/CC0/`, open its page with the owner's Freesound login and confirm the licence line reads "Creative Commons 0", exactly as the 2026-09-15 pulls were checked. Snippets that mention "credit the author" mean CC BY, which the game does not use.

## Licence check and review results (2026-09-22)

Every page below was opened with the owner’s Freesound login. Keepers are filed under `Audio/CC0/` with SHA-256 provenance (`provenance_freesound.json`, `provenance_nox.json`) and rows in `Audio/CC0/README.md` and `audition.html`.

- **Phase 1 pulled (CC0 confirmed):** kyles 452516, Sadiquecat 800660, jmehlferber 370938, samarobryn 414767, Sayuri_Odin 216134, nicoproson 648529, Littleboot 147300, plus two from the Yuval room-tone pack (204843, 210097). Filed in `Interior/`.
- **Phase 1 owner review:** approved kyles (“sounds like rain on a tin roof”) and nicoproson (waits on weather). Rejected the three fires (“we have fire already”; samarobryn too spitty), both Yuval rooms, Sayuri_Odin and Littleboot (“might as well just not play audio”).
- **Wood-floor footsteps:** ten Nox_Sound `Footsteps_Wood_Walk` single steps unpacked from the Essentials zip into `Interior/` for the accent layer (owner: footsteps on wood are fine if not constant). Awaiting review.
- **Phases 2 and 3 pulled (CC0 confirmed), in `Accents/`:** Kinoton 376001 and 378431, janbezouska 266951, GoatsheadCastle 739142, inoshirodesign 271370, the_very_Real_Horst 240934 and 241197, ganiket 466652, bassimat 857912, Rudmer_Rotteveel 502504 and 502507. Awaiting review.
- **Not CC0, skipped:** hansendex 263994 and Debsound 337575 (Attribution NonCommercial 4.0); klankbeeld 171740, pfranzen 393808, InspectorJ 346641/346642 (Attribution 4.0); all twelve sounds in the Philip_Goddard pack (Attribution NonCommercial 4.0); DudeAwesome 386470, casemundy 130586, jppi_Stu 17090, AncientOracle 476871 and seven the_very_Real_Horst bowls (Attribution 4.0).
- **Accent layer rulings (owner):** accents come from the place profile first, GM-cued story sounds later; accents play only in the gaps between narration. Tracked on TODO.md L7.

## Where the engine stands

- No indoor place outside the Village pilot makes any sound today: `smithy` and `tavern` are `seedOnly`, and the tavern's loop/mix approvals are still false. A general interior bed would be the first sound most campaigns get indoors.
- The Village does fire the SOUNDSCAPE ask for its unbound interiors (`buildSoundscapeNote`, `village:"fires"`), so a general interior bed reaches houses, the Hall and the healer's once the GM classifies them.
- `AUDIO_CONTENTS` (audio-profile.js) has no `chimes` entry. Adding one changes the SOUNDSCAPE vocabulary the GM sees: drift surface, Fable tier.
- There is no mood axis. `quiet=hushed` halves gain; nothing tells a calm shrine from a tense room.
- One steady bed per place. Occasional sounds (a chime strike, a page turn) need the one-off layer L7 still lists as open. A looped chime recording will read as repetitive (the owner rejected the hull creak and the owls for exactly that).

## Phase 1 beds (work with today's matcher)

Interior, covered/sealed, biome unspecified, all hours unless noted.

### Quiet hearth room (contains: fire)
- kyles, "room tone small log cabin quiet with fire in wood stove metal clinks" · https://freesound.org/people/kyles/sounds/452516/ · the closest match to "peaceful indoor" in one recording; the metal clinks may need cutting for a loop
- Sadiquecat, "Inside fireplace (Crackling)" · https://freesound.org/people/Sadiquecat/sounds/800660/ · 2025, processed to remove clicks
- jmehlferber, "fire-crackling.wav" · https://freesound.org/people/jmehlferber/sounds/370938/
- samarobryn, "Crackling Fire" · https://freesound.org/people/samarobryn/sounds/414767/
- hansendex, "Fireplace 3 hours" · https://freesound.org/people/hansendex/sounds/263994/ · long source, good for cutting a non-repeating 60 s loop
- Already approved locally: the "cozy interior rain-and-hearth" in `Audio/CC0/` (owner comment 2026-09-15). Strongest candidate; only on the owner's machine.
- Already in the pack: Nox_Sound Essentials `Ambiance_Firecamp_Medium` is the smithy source; a quieter cut at a lower RMS target may serve a house hearth without a new download.

### Rain heard from inside (contains: rain)
- Sayuri_Odin, "INT Rainy ambience (rain heard from inside a room)" · https://freesound.org/people/Sayuri_Odin/sounds/216134/ · snippet says CC0
- nicoproson, "RAIN on glass window.wav" · https://freesound.org/people/nicoproson/sounds/648529/ · light rain, snippet says CC0
- Debsound, "Heavy Rain Loop, Indoor, Raindrops on the Window" · https://freesound.org/people/Debsound/sounds/337575/ · heavy; a storm bed, not a calm one
- InspectorJ, "Rain on Windows, Interior" A/B · https://freesound.org/people/InspectorJ/packs/19683/ · InspectorJ usually publishes CC BY; check before pulling
- Already cut: `sfx/rain-calm-v1.mp3` (unbound until the WEATHER contract)

### Near-silent room tone (contains: nothing)
- klankbeeld, "room-tone quiet 01" · https://freesound.org/people/klankbeeld/sounds/171740/ · unprocessed Sony PCM D50
- Littleboot, "Room white noise - Room Ambience" · https://freesound.org/people/Littleboot/sounds/147300/
- Yuval, "room-tone" pack · https://freesound.org/people/Yuval/packs/11729/
- pfranzen, "Windy, creaky old house ambience" · https://freesound.org/people/pfranzen/sounds/393808/ · a composed mix (made for a game), so check it is a recording the rights approval can honestly cover
- Caution: an empty `contains` list matches EVERY interior that is not `silent`, tense rooms included. Ship this one only at low gain, or wait for a mood axis.

## Phase 2 and 3: chimes and other occasional sounds

These need (a) a `chimes` content entry, Fable tier, and (b) the one-off scheduler. Until then a chime recording can only ship as a looped bed, which is the repetitive case.

### Metal chimes
- Kinoton, "Koshi Wind Chime" · https://freesound.org/people/Kinoton/sounds/376001/ · eight metal tones in a bamboo resonance tube, ORTF stereo; snippet says CC0. Warm rather than shrill; the best of both worlds for a shrine or study
- Kinoton, "Koshi Wind Chimes, Medium" · https://freesound.org/people/Kinoton/sounds/378431/ · same instrument, snippet says CC0
- janbezouska, "Metal Chimes" · https://freesound.org/people/janbezouska/sounds/266951/ · snippet says CC0
- DudeAwesome, "Best Hypnotic Wind Chimes ~ Long Nice Loop" · https://freesound.org/people/DudeAwesome/sounds/386470/ · 11 minutes, so a long non-repeating cut is possible; licence unknown
- casemundy, "Wind Chimes.wav" · https://freesound.org/people/casemundy/sounds/130586/ · back-porch recording; licence unknown
- Skip: Seidhepriest "Wind Chimes Loop" (snippet says Noncommercial); InspectorJ "Wind Chimes, A" (gift-shop extract with added reverb, likely CC BY)

### Bamboo chimes
- GoatsheadCastle, "Wooden Wind Chimes outside" · https://freesound.org/people/GoatsheadCastle/sounds/739142/ · garden, light wind, birds and a wood pigeon behind it; snippet says commercial use without permission. The birds bind it to daytime and to a window being open
- jppi_Stu, "bamboo_wind_chimes_1.wav" · https://freesound.org/people/jppi_Stu/sounds/17090/ · snippet says "credit the author": likely CC BY, skip unless the page says otherwise
- Philip_Goddard, "Wind Chimes In the Wild" pack · https://freesound.org/people/Philip_Goddard/packs/10521/ · many bamboo and metal combinations recorded outdoors in Teign Gorge; licence per sound unknown; outdoor wind and birds under every take

### Singing bowl and temple bell (one strike, long decay)
- AncientOracle, "Bowl Bell #1 (One Hit - Fade)" · https://freesound.org/people/AncientOracle/sounds/476871/
- inoshirodesign, "singing bowl strike sound" · https://freesound.org/people/inoshirodesign/sounds/271370/
- ganiket, "Indian Temple Bell" · https://freesound.org/people/ganiket/sounds/466652/
- bassimat, "Church Bell - D3" · https://freesound.org/people/bassimat/sounds/857912/ · 28 s decay; more a village exterior accent than an interior one
- the_very_Real_Horst, "Tibetan Singing Bowls" pack · https://freesound.org/people/the_very_Real_Horst/packs/12242/

### Timber creaks (one-off accents for a house at night)
- Rudmer_Rotteveel, "Wood Creak Single V2" · https://freesound.org/people/Rudmer_Rotteveel/sounds/502504/ · snippet says CC0
- Rudmer_Rotteveel, "Creaking Wood 4 Steps" · https://freesound.org/people/Rudmer_Rotteveel/sounds/502507/ · snippet says CC0

## Suggested order

1. Owner verifies licences and pulls the Phase 1 picks into `Audio/CC0/Interior/` (new region), listens, records decisions in `approved-audio-library.json` as on 2026-09-15.
2. Prepare one hearth bed and one rain-inside bed with the existing recipe (mono, DC removal, 2 s raised-cosine overlap, RMS -26 dBFS, gapless LAME header) and deliver through `dev/audio-delivery.json` → `node dev/build-audio-catalog.js`. Catalog entries are on the safe-changes list.
3. Chimes wait for the `chimes` content entry and the one-off scheduler (Fable).
