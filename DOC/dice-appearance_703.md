# Dice appearance update — #703

TnD v1.1368 publishes Dice 0.99.4 from source commit
6d7f29e through the upstream publisher and its 85-file hash receipt.
The owner explicitly authorized site publication on 2026-11-07, lifting the earlier hold.

Classic d6 dots are larger. Numerals retain their per-die proportions and default
to 1.65 times their original size; the standalone Large Numbers checkbox restores
the original size when unchecked. The size choice follows saved looks and presets,
existing dice and future rolls. Font changes repaint both cached sizes; dot masks
are independent. Teal Glass and title-cased built-in preset names are included.

Upstream verification at 0.99.4: 440 tests, four rendered viewport layouts,
keyboard controls, preset save/select/reload, all six numbered shapes, bounded
mask caching, font repaint (including an exiting die), font import/fallback,
and matching 84-file iOS/Android asset copies. Evidence lives in the upstream
`docs/large-numbers-toggle-0.99.4/` directory. Native assets are not device builds.

This host change contains only the published roller copy, application/cache
markers and release records. Game logic, drift surfaces and test policies are
unchanged. The installed pre-commit and pre-push hooks run the full host gates;
final deployment, live asset hashes, update behavior and UI checks are recorded
in the upstream TODO_RELEASE.md after publication.
