# Publish Dice personal fonts — #699

The owner still saw v0.94.0 after refreshing. A fresh production browser reproduced that
version and the absent font-import button. Dice source 0.97.0 had been pushed as 2366061,
but its release copy in this host had never been updated. This is a missed publication,
not evidence of a stale client cache.

TnD v1.1358 publishes the committed source using dice-sim/dev/publish-to-tnd.js. The receipt
names all 85 web assets and hashes. The host version and cache markers move together.
The native packaging directories are excluded from the web copy. No host engine, state,
prompt or parser logic changes, and no host tests are relaxed.

Upstream v0.97.0 has 426 passing tests. Its browser evidence covers actual Windows installed
fonts, a real .ttf input, local IndexedDB persistence, saved presets, a deleted font resolving
to exactly the system-font numeral mask, invalid-file rejection, reimport and three layouts.
See the upstream docs/personal-fonts-0.97.0/ evidence and TODO_RELEASE.md for the deployed
verification receipt after this commit reaches Cloudflare. Native build/device checks remain
separate; this release is the hosted web app.

The host commit must pass its normal pre-commit gate, and publication must pass its normal
browser pre-push gate. Production verification checks the served receipt, all asset hashes,
the rendered version, the new font controls, font-file import, reload and a real roll.
