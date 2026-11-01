# B44 live beta verification — 2026-10-31

Document version 1.0. Verified October 31, 2026, 8:21–8:23 p.m. PDT (November 1, 03:21–03:23 UTC).

B44 is verified and closed. The earlier fix removed the developer-only flag from the Voice Settings menu row while keeping personal API-key fields hidden from non-admins. This check exercised the deployed beta permissions and real Speechify service, closing the live-verification gap in TODO #622.

## Method

Tested the public Cloudflare Pages app v1.1334 against the production Fly server 1.15.0 in a fresh Chrome profile. A dedicated temporary account received the ordinary active beta entitlement and a short-lived session. The server returned `isAdmin: false`, `entitled: true`, `tier: beta`, and a non-exempt 250,000-character narration allowance. An operator endpoint correctly returned HTTP 403.

The session was provisioned administratively for QA; no existing player's identity or session was used. Google/GitHub OAuth was not exercised. Client role, entitlement, catalog and synthesis responses were not mocked. No personal provider credentials were supplied. The server's actual CORS and authentication paths handled the browser requests.

## Results

- The real File → Settings → Audio → Voice Settings path opened during onboarding.
- The same path opened on the in-game screen with a synthetic turn-0 scene held only in the browser. No campaign was uploaded.
- Speechify was selectable, the server narration allowance was visible, and personal key fields were hidden.
- The live catalog returned HTTP 200 with 127 voices. Selected narrator: Alec (`alec`), Simba 3.2.
- One test sentence, “Beta voice check. The lantern is lit.”, returned HTTP 200 and 174,530 PCM bytes through `/api/tts/speechify`.
- The browser played 87,265 non-silent samples at 24,000 Hz: 3.636 seconds, peak 0.7762, RMS 0.08760. Its AudioContext was running and the source reached its natural `ended` event.
- The server recorded one successful Speechify TTS request and 83 metered characters, including the request's markup.
- Save and reopen preserved Speechify and the selected narrator. No page exceptions occurred.
- Desktop (1200×900) and phone-sized (390×844) Voice Settings renders were captured and visually inspected; the in-game menu was also captured and inspected.

Browser audio completion was verified programmatically in headless Chrome. Physical speaker output, the original tester's Mac, and real Android/iPhone hardware were not tested. This was a settings audition and menu-access check, not a complete campaign playthrough.

One incidental copy issue remains: Speechify's general description says “Test bills your Speechify API key” even when the active server-route and test-billing notices correctly describe included beta narration. This did not prevent selection or playback and is separate from B44's missing settings access.

## Cleanup and evidence

The recovery volume snapshot was confirmed created before provisioning (`vs_e548p5bn3BNSNZyZ7NX`, 03:16:23 UTC). After verification, the exact temporary account, session, subscription and test usage were removed. No campaigns, characters or blueprints had been created. Every user-owned table was checked for remaining rows belonging to that QA identity; none remained. The revoked session returned HTTP 401, and its temporary local credential file was deleted.

The run scripts, response/playback measurements, screenshots and captured WAV are retained locally in the ignored `testRuns/b44/` directory. No email, bug report or invitation was sent. No game or server code changed, so app/CACHE version markers remain v1.1334.
