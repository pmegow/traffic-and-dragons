# Traffic & Dragons website

Standalone public landing page, version 1.0.0. Open `index.html` to preview it locally.
No build, package installation, API keys, game files, or Codex runtime are required.

The approved design uses parchment, brick-red lettering, the original dragon-on-Beetle
artwork, and “Add a little fantasy to your gridlock.” All three entry links open the
existing game at https://traffic-and-dragons.pages.dev/, which handles play and sign-in.
There is no separate sign-in endpoint on this website.

## Publishing later

Publish the **contents of this folder**, keeping `index.html`, `icon.svg`, and `art/`
together. For the planned separate Cloudflare Pages landing project, use `website`
as the build output directory with no build command. The previous `landing/` folder
is retained for reference; `website/` is the approved replacement source.

Attach `trafficanddragons.com` (and optionally `www.trafficanddragons.com`) to that
landing project, then verify the domain, HTTPS, artwork, and entry links. This save
does not create a deployment or change DNS. Keep the game's deployment separate;
the links deliberately retain its current origin and player storage.

## Editing

The layout and styles are in `index.html`; the original artwork is in
`art/dragon-on-beetle.webp`. Update the `website-version` meta value and the matching
asset query versions whenever this website changes. No game service worker is used.
If the game's destination changes, update the three ordinary anchor links together.
The illustration failure handler reports to the page and console without blocking
the entry links. This version uses one fixed illustration.
