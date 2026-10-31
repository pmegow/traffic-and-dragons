# Bug review — 2026-10-31

Document version 1.0. Work follows the owner's request to investigate and fix what can be confirmed after the bug sync.

## Outcomes

| Reports | Outcome |
|---|---|
| B56 | Fixed the shared Node engine loader enabling production bug reports before fixture isolation. |
| B54, B55 | Legacy video/audio requests from older clients after their assets were removed; archived as superseded. |
| B50, B51 | Older reports against the same retired video implementation; archived as stale. |
| B29 | Closed on the owner's existing October 4 acceptance of TODO #526. |
| B35 | Corrected to B19's malformed-JSON class and archived as a duplicate; existing failure/retry policy retained. |
| B52 | Missing helper reproduced by blocking its request; original iPhone loading cause remains unconfirmed. Kept open. |
| B44 | Existing voice-settings fix remains ready for the tester's check. |
| B45–B48 | Existing story/prompt fixes retain their recorded live-play verification requirements. |

## Implemented fix

The development loader evaluates the real engine and reporter. Node supplies a real fetch, so early fixture failures could POST to the production endpoint before reporter-specific tests substituted a fake transport. Ten such artifacts were in the preceding sync.

The loader now disables the endpoint immediately after evaluating error-report.js, including partial loads. Reporter tests explicitly configure fake URLs and transports. Browser reporting and memory guards are unchanged.

The regression was written first and failed with one network attempt instead of zero. It covers crash and user reports, full and partial loads, and a positive explicit fake-transport case. Two attributed mutation proofs pass. The complete local gate passed 3,196 engine assertions and 130 standalone suites. Fix commit: 6819f7ae. Development-only code requires no app/CACHE bump.

## Deployed and failure-condition checks

On production v1.1332, both retired media URLs return HTTP 200 with the HTML app shell. That explains how an older client can receive undecodable bytes after asset removal, but the October 26 response bodies were not recorded; the historical cause remains probable, not proven.

A fresh 390×844 Chromium session rendered the current live d20 on its requested face 19 without page exceptions. Both current audio banks passed receipt verification and decoded: clicks 6.2724375 seconds, exits 11.67 seconds. The rendered result was inspected. This does not substitute for Android/iPhone hardware playback or listening.

A separate browser session deliberately returned HTTP 503 for helpers.js. It reproduced keyedDict missing, seven dependent initialization errors, and a sign-in screen without a startup-failure explanation. The original iPhone incident still needs the helper response/parse evidence and worker identity. No fallback or cache-clearing workaround was applied.

All browser POSTs were intercepted during verification. Tests used fake report transports; no verification email/report was intentionally delivered.

## Remaining work

B52 needs original-device evidence before a cause-specific fix. Resource-load diagnostics and an explicit failed-boot screen are a possible separate change; they must preserve the real error rather than silently supplying missing globals.

Previously fixed story and voice issues retain their existing human verification steps. No parser salvage, memory rewrite, new prompt rule or unrelated dice work was included.

Individual findings, original evidence and action logs remain in [the bug tracker](BUGS.md).
