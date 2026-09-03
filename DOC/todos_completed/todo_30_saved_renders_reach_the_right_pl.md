# TODO #30 — Saved renders reach the right place per platform, and come back after a reload.

*Full record extracted verbatim from TODO.md (Feature backlog, completed row) on 2026-09-01; the tracker row keeps the TLDR and the verdict. Table pipe escapes (`\|`) are unescaped here; `<br>` breaks became paragraphs.*

**Effort:** M · **Tier:** Any

## Task

**Saved renders reach the right place per platform, and come back after a reload.** *(Rewritten 2026-07-27 — the original ask was "renders saved on the phone should go to the Photos app; on the desktop to the Pictures folder; leave pointers so a 'clear cache and reload' can restore them; skip images that no longer exist." Two halves of that are **not reachable from a web page** and the row now says so instead of implying they are.)* 



**What a browser genuinely cannot do:** write into the iOS **Photos app** or the Windows **Pictures** folder directly. The only routes are the OS **share sheet** (Web Share Level 2 — `navigator.share({files})`, the sole path to Photos) and a **user-chosen folder / download** on desktop. And Photos is **write-only** to a web page: an image shared to the phone can never be read back, so *the phone can save but can never restore*. That asymmetry is inherent, not a shortcoming of this build. 



**Also uncovered while mapping:** scene renders were **never persisted at all** — no `worldState.renders`, no transcript record, and the fal.media URL is a temporary CDN link that expires — so "leave pointers" had nothing durable to point at; and `_campFolderHandle` was a **plain var**, so every reload silently dropped the chosen folder and the next save reverted to a download with no warning.

## Status / record

✅ **Done (v1.457, 2026-07-27).** **① Platform-correct saving:** one funnel `saveRenderImage(blob,filename,turn)` (ui-files.js) — share sheet → campaign folder → download. A **dismissed** share sheet counts as handled (`AbortError`), never falling through to a surprise download of a file the user just declined. **② The folder survives a reload:** the FSA directory handle is persisted in IndexedDB (`tnd_fs_v1`) and restored at boot. Permission deliberately is *not* re-requested at boot (no user gesture exists there) — a lapsed handle parks in `_campFolderPending` and is re-granted inside the next Save click, which is a gesture. Clearing the folder now also clears the persisted copy, or "cleared" would silently un-clear itself next reload. **③ Pointers + restore:** `worldState.renders` holds `{f,t,k}` POINTERS ONLY — never image bytes — capped at `RENDER_PTR_CAP`=60 from the front (it rides the sync blob, so it gets a bound like every other accumulator). `k` records where it went: `renders` (folder → **restorable**), `share` (Photos → never), `download` (path unknown). At boot, after the narrative rebuild, `restoreSavedRenders()` re-attaches each restorable image to the narration frame of its own turn — `addMsg` now stamps `data-turn` so that anchor is machine-readable instead of parsed out of display text. **A file deleted from disk is skipped silently** (the row's explicit requirement); so are pointers for turns not on screen. Idempotent. Blob URLs are revoked on load — no leak. **Verified:** 856 green (5 new pure-pointer tests: shape, same-file replacement, front-capping, junk tolerance, defaults) + **live in-browser** — IndexedDB round-trip; granted handle adopted; lapsed handle parked, NOT adopted, then re-granted on a gesture; all four save routes correct with the dismissed sheet producing zero downloads; restore attached the present file, skipped the deleted one, ignored the Photos-only and orphan pointers, and added nothing on a second run; zero console errors. **Untested:** a real iOS share sheet (needs a device) — the branch is feature-detected and falls back cleanly. 



**v1.458 field fix (same day) — ROUTING ORDER WAS WRONG on desktop.** Field report: "works on the phone… on the desktop I've made the campaign folder, but hitting save brings up a 'share' UI." Root cause: v1.457 tried the share sheet FIRST, and **desktop Chrome implements `navigator.share` too** (the Windows share UI) — so a user who had deliberately configured a campaign folder got a share dialog instead of their folder. **A configured folder is an explicit instruction and now always wins.** The share sheet is reserved for a browser with NO folder picker at all (`window.showDirectoryPicker` absent = iOS Safari), where it is the only route to Photos; on a desktop with no folder chosen it is a plain download plus a hint to set one. Capability check, never UA sniffing. Also: the toast now names the WHOLE path (`Saved to Runelords/renders/Runelords_Ammut_t1234.jpg`) instead of a bare `renders/…` the user had to guess at, and the extension follows the blob's real MIME type (fal returns PNG for some models; a .jpg that is really a PNG confuses the OS and the restore path). Re-verified live for all three routes: desktop+folder → folder with **zero** share sheets; desktop without a folder → download; phone → share sheet. 



✅ **FIELD-CONFIRMED BOTH PLATFORMS (user, 2026-07-27):** phone → share sheet → Photos ("works on the phone"), and desktop → campaign folder + **persistence across reload confirmed** ("render saving and persisting on the desktop confirmed"). That closes the row's last caveat — the iOS share sheet was the one branch a lab could not exercise, and the folder-survives-a-reload fix was the silent bug this work uncovered rather than something the original row asked for. Nothing outstanding.
