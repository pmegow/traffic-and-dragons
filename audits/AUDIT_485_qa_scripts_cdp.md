# #485 — the ten manual-QA browser scripts run on `dev/cdp-browser.js` (2026-10-03)

**TLDR:** the ten `dev/qa-*.js` scripts that needed a local Playwright (`PLAYWRIGHT_PATH`) now drive system Chrome through
the repo's own zero-dependency `dev/cdp-browser.js`, exactly as the batteries do (#472). All ten ran green on this machine
against the repo served at `http://localhost:8123` (`AMBIENT_QA_URL`) or their own fixture servers. This page is the citing
audit for the four that had none.

## What the port needed from cdp-browser

| Added | Why |
|---|---|
| `launch({args})` honoured | the audio scripts pass `--autoplay-policy=…` |
| `page.on("console")` → `{type(), text()}` | the transitions script reads the ambience log |
| `context.setOffline(bool)` | the audio-cache script reloads offline |
| route patterns: an exact URL or a `*`/`**` glob, newest first, non-matching falls through | the speechify stub route beside the everything-route |
| `page.on("request")` while intercepting | hearth and noctina count asset requests |
| **real clicks** — CDP mouse events at the element's centre (fallback `el.click()` for a box-less element); `tap()` via touch events; `check()` | Chrome's autoplay gate and the ambience "tap anywhere" unlock accept only a trusted gesture; the in-page `el.click()` under `userGesture` did not satisfy them |

## The ten, and what each run found

| Script | Result | Notes |
|---|---|---|
| `qa-407-shop` | SHOP BROWSER GREEN | fixture purse → copper (#598) |
| `qa-6-stash` | STASH BROWSER GREEN | the row key is `stashKey` (`old boot`, #481 D2); clicks land on `.shop-name` (the row's centre is the clear-badge once marked); the #558 eye glyph stripped before `^Rope$` |
| `qa-413-ways` | WAYS BROWSER GREEN | unchanged |
| `qa-l7-ambient` | BROWSER … GREEN | the day bed's label is "Daytime birds and insects" now |
| `qa-l7-reload` | PASS ×3 (autoplay allowed / click required / **tap required**) | **found a product defect** — see below |
| `qa-l7-transitions` | ROLLOUT BROWSER GREEN | needed the per-URL route and console events |
| `qa-audio-cache` | REAL AUDIO CACHE GREEN | needed `setOffline` |
| `qa-general-audio` | GENERAL AUDIO BROWSER GREEN | unchanged |
| `qa-hearth` | HEARTH BROWSER GREEN | isolated copy of a local save, verified byte-identical after |
| `qa-noctina` | NOCTINA BROWSER GREEN | the last step set `clock.min = 23*60`, which is 05:00 (the clock counts from dawn); it now moves to minute-of-day 1380 and expects the night bed, which runs 21:00–05:00 since the Nox beds |

## The defect the tap branch found (fixed in the same commit)

`ui-ambient.js` unlocked the ambience on **`pointerdown`**. On a touch tap the browser grants user activation at
`pointerup`/`touchend`, not at `pointerdown` (probed: `navigator.userActivation.isActive` is false in the pointerdown
handler of a CDP touch and true at pointerup), so the unlock asked the AudioContext to wake before any activation
existed and Chrome refused — a phone's first tap could never start the ambience; "Tap anywhere to start ambience" stayed.
The unlock listens on `pointerup` now (mouse and touch alike carry the activation there); the engine fixture that drove
`events.pointerdown()` is re-pinned to `pointerup` and refuses a `pointerdown` listener.

## How to run

```bash
cd C:\Projects\traffic-and-dragons; $env:AMBIENT_QA_URL="http://localhost:8123"; node dev/qa-407-shop.js
```

Each script needs Chrome (`CHROME_PATH` or the default install). The seven that read `AMBIENT_QA_URL` need the repo served;
`qa-l7-ambient`, `qa-hearth` and `qa-noctina` start their own servers. Receipts and screenshots land in `QA_OUT`.
