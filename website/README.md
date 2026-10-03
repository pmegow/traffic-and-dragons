# Traffic & Dragons website

Standalone public landing page, version 1.0.4. Open `index.html` to preview it locally.
No build, package installation, API keys, game files, or Codex runtime are required.

The approved design uses parchment, brick-red lettering, the coffee version of the dragon-on-Beetle
artwork, and “Add a little fantasy to your gridlock.” The cover favors portrait
8.5:11 proportions, growing vertically on small screens to keep content readable.
The surrounding background is 25% darker than the parchment (#b0a68b versus #eaddb9);
the cover retains its original paper color and highlight.
“Continue your Campaign” and “New Adventurer? Sign up” are the two entry links to the
existing game at https://traffic-and-dragons.pages.dev/, which handles play and sign-in.
There is no separate sign-in endpoint on this website.

## Live hosting

Published 2026-10-02 at **https://trafficanddragons.com/**.
The hyphenated domain https://traffic-and-dragons.com/ and both `www` aliases
permanently redirect (301) to the primary HTTPS address, retaining paths and query
strings. Plain HTTP also redirects to that address.

Cloudflare Pages project: `traffic-and-dragons-website`.
Fallback address: https://traffic-and-dragons-website.pages.dev/.
Git source: `pmegow/traffic-and-dragons`, production branch `master`, output directory
`website`, no build command. Production builds watch `website/*`; preview builds are
disabled. Future pushed changes in this folder deploy automatically.

The initial approved deployment is `dbdcc755`, source commit `8f980160`, website
version 1.0.0. A first `landing/` page (Fable, the same day) was deleted once this one
went live; `website/` is the one source for the public site. The game remains a separate Pages project at its
original address, preserving existing player storage.

Each domain has proxied CNAMEs for its apex and `www`, targeting
`traffic-and-dragons-website.pages.dev`. A Single Redirect rule in each zone handles
the canonical address; its stable rule reference is `tnd_landing_canonical`.
The primary zone redirects `www` and HTTP requests. The hyphenated zone redirects
both hostnames. Unrelated DNS records and rules are retained.

Layout verification for v1.0.1: screenshots from 320px through 1440px inspected;
artwork, revised copy, both game links, portrait letter proportions on desktop and
lack of horizontal overflow checked. Initial domain verification: Sixteen HTTP/
HTTPS checks cover the four hostnames at the root and an asset path with query
parameters. The primary page and artwork hashes match the local files. One Python
HTTP client received 403; the real browser and native curl checks passed without
disabling TLS verification or changing site security settings.

## Publishing updates

Commit and push the intended `website/` changes to `master`, then check the landing
project's deployment and live page. For a manual upload to the same project:

```powershell
npx wrangler pages deploy website --project-name traffic-and-dragons-website --branch master
```

Upload the whole folder, keeping `index.html`, `icon.svg`, and `art/` together.
No game deployment or DNS changes are required for ordinary page edits. Use a
Cloudflare login for Pages publishing; DNS/redirect administration requires separate
scoped permissions. Never store credentials in this repository.

## Editing

The layout and styles are in `index.html`; the displayed artwork is in
`art/Dragon-on-beetle_coffee.jpeg`. Update the `website-version` meta value and the matching
asset query versions whenever this website changes. No game service worker is used.
If the game's destination changes, update both ordinary anchor links together.
The illustration failure handler reports to the page and console without blocking
the entry links. This version uses one fixed illustration.
