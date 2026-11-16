# Blueprint text limits — Designer v0.78 / engine v1.1446

The owner requested a further fivefold increase on November 16, 2026. The
Designer warning, runtime import clamp, assistant write validation and assistant
instructions already share `IMPORT_CAPS`; changing that registry keeps them aligned.
The custom-rule prompt bound also reads it. No other runtime logic changes.

| Blueprint field | Previous cap | Current cap |
| --- | ---: | ---: |
| Ordinary text field | 4,000 | 20,000 |
| Premise | 12,500 | 62,500 |
| Individual rule | 6,000 | 30,000 |
| Habitat | 400 | 2,000 |

Character backstory retains its separate 2,500-character bound.

Before implementation, the boundary assertion failed with premise 12,500 versus
62,500. Three 20,000-character fields produced [the old warning](before/773-limits-desktop.png).
The same draft is accepted after the change on [desktop](after/773-limits-desktop.png)
and [phone](after/773-limits-phone.png). One extra character still warns and blocks
publication. A runtime import retains every accepted boundary character.

Local verification:

- 153 engine checks in `class bible (#72)` and three rule-boundary checks pass.
  A 30,000-character rule reaches the prompt intact; short-rule prompts remain
  byte-identical under the old and new caps.
- All 18 assistant checks pass, including accepted boundaries, rejected overflow
  and model instructions stating the same caps.
- The full Designer browser suite passes: warning, publication refusal, authoring,
  AI revision, file reload, autosave/reopen and phone layout. Every model/image or
  catalog operation uses synthetic responses; no real requests are made.
- Existing overflow fixtures derive their lengths from the active cap. An initial
  fixture-only reload error was corrected by keeping the full expected text in the
  test process across page reload; the test now compares the entire saved text.

The repository's full pre-commit, browser and affected mutation gates run for this
release. Live verification follows publication.
