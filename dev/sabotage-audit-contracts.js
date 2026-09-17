// sabotage-audit-contracts.js — retained mutation proofs for the run-tests.js source contracts
// repaired by the 2026-09-18 Fable audit (audits/audit_fable_2026_09_18.html, section G).
// Run: node dev/sabotage-audit-contracts.js
//
// WHY THIS FILE EXISTS
// -------------------
// Four clauses in that audit were VACUOUS or HALF-ARMED against current source. Each has now
// been rewritten to check the thing it claims to check; a rewritten clause with no retained
// proof is exactly the fake-coverage class dev/sabotage.js exists to kill, so each one lands
// here with a mutation that MUST redden it, attributed by `mustFail` to its own message.
//
//   G2  BIBLE EDITOR "never reachable from the game's own UI surface" — scanned the EDITOR page
//       for an id="bible-editor-link" sentinel that has never existed in this repo. It now greps
//       index.html and ui-boot.js (where the File menus are GENERATED). The proof adds a real
//       menu row.
//   G3  sw.js NETWORK-FIRST ALLOWLIST — HOME PAGE and CHARACTER EDITOR used a whole-file
//       indexOf, which sw.js's own prose roster of satellite names (the comment directly above
//       the regex) satisfies. Both now read the REGEX LITERAL through _swAllowlistHas. The proof
//       MOVES the name from the regex into that comment: a page the SW will pin stale forever,
//       with its name still in the file. The old shape passes this mutation; the new one must not.
//   G9  SOAK REV lockstep — `if (_revS && _revS !== _revT)` waved a MISSING ?tnd= anchor through,
//       which is worse than a lagging one (the permanent SW piper-cache then serves the soak a
//       stale runtime forever). A missing anchor is now its own failure.
//   G15 VOICE DELETE ⑤ — pinned one exact source spelling of the v1.419 regression instead of the
//       property. It now asserts the live shape, `rows = Math.max(PIPER_VOICE_CAP, ids.length)`.
//       That clause's own proof lives in sabotage-contract-tier.js (re-aimed in the same commit);
//       what is proven HERE is the anchor arm — a renamed _renderPiperSlots must not pass.
//
// THE GATE: `node dev/run-tests.js repairModelJson`. Source contracts run at the TOP of
// run-tests.js, unconditionally, before the engine suite and independent of the section filter,
// so the narrow filter removes the engine suite as a rival source of red and every `mustFail`
// names the contract itself. Same rationale as dev/sabotage-contract-tier.js's header.

var sabotage = require("./sabotage.js");
var rc = 0;

var GATE = ["node", ["dev/run-tests.js", "repairModelJson"]];

/* ═══ G3 — sw.js network-first allowlist (HOME PAGE + CHARACTER EDITOR) ══════════════════════
   Each mutation deletes the page from the REGEX and writes its name into the roster COMMENT
   three lines above it, so the file still contains the string. A whole-file indexOf — the shape
   both contracts used until this audit — reports green on both of these. */
rc |= sabotage.prove({
  file: "sw.js",
  command: GATE,
  cases: [
    {
      label: "G3 home.html drops out of the network-first REGEX but stays named in the roster comment",
      mustFail: "sw.js network-first REGEX lacks home.html",
      find: "  // story_compiler (#5), and everything under /DOC/. Tested against\n" +
            "  // e.request.url (the FULL URL), hence the path-fragment style.\n" +
            "  if(/\\/sfx\\//.test(new URL(e.request.url).pathname)){e.respondWith(deliveryCache.fetch(e.request));return;}\n" +
            "  if(/blueprint-designer|todo-viewer|bible_study|\\/satellite\\.css|home\\.html(?:$|[?#])|admin_console|",
      /* the comment quotes the REGEX FRAGMENT (home\.html), not the bare filename: that is the
         exact string the old whole-file indexOf looked for, so this mutation is the documentation
         edit that would have made the old pin vacuous while the SW pinned the page stale. */
      replace: "  // story_compiler (#5), the home\\.html landing page, and everything under /DOC/. Tested against\n" +
            "  // e.request.url (the FULL URL), hence the path-fragment style.\n" +
            "  if(/\\/sfx\\//.test(new URL(e.request.url).pathname)){e.respondWith(deliveryCache.fetch(e.request));return;}\n" +
            "  if(/blueprint-designer|todo-viewer|bible_study|\\/satellite\\.css|admin_console|"
    },
    {
      label: "G3 character_editor drops out of the network-first REGEX but stays named in the roster comment",
      mustFail: "sw.js network-first REGEX lacks character_editor",
      find: "  // story_compiler (#5), and everything under /DOC/. Tested against\n" +
            "  // e.request.url (the FULL URL), hence the path-fragment style.\n" +
            "  if(/\\/sfx\\//.test(new URL(e.request.url).pathname)){e.respondWith(deliveryCache.fetch(e.request));return;}\n" +
            "  if(/blueprint-designer|todo-viewer|bible_study|\\/satellite\\.css|home\\.html(?:$|[?#])|admin_console|mementos|character_editor|",
      replace: "  // story_compiler (#5), character_editor, and everything under /DOC/. Tested against\n" +
            "  // e.request.url (the FULL URL), hence the path-fragment style.\n" +
            "  if(/\\/sfx\\//.test(new URL(e.request.url).pathname)){e.respondWith(deliveryCache.fetch(e.request));return;}\n" +
            "  if(/blueprint-designer|todo-viewer|bible_study|\\/satellite\\.css|home\\.html(?:$|[?#])|admin_console|mementos|"
    },
    {
      label: "G3 the fetch handler's shape changes so the allowlist regex can no longer be located",
      mustFail: "could not locate sw.js's network-first regex",
      find: "  if(/blueprint-designer|todo-viewer|bible_study|",
      replace: "  if(SATELLITE_RE.test(e.request.url)){/* was: blueprint-designer|todo-viewer|bible_study|"
    }
  ]
});

/* ═══ G2 — the bible editor must not be reachable from the game's own UI ═════════════════════
   The File menus are GENERATED by buildFileMenus (ui-boot.js): a link to the dev authoring
   satellite lands there, never in index.html's empty mount divs. This adds exactly that row —
   the mutation the old clause (which searched bible_editor.html for a sentinel string) could
   never see. */
rc |= sabotage.prove({
  file: "ui-boot.js",
  command: GATE,
  cases: [
    {
      label: "G2 a Bible Editor row is added to the generated File-menu spec",
      mustFail: "ui-boot.js references bible_editor.html",
      find: "[[\"clearcache\",clearCacheAndReload]",
      replace: "[[\"bible-editor\",function(){location.href=\"bible_editor.html\";}],[\"clearcache\",clearCacheAndReload]"
    }
  ]
});

/* ═══ G9 — the soak harness's rev anchor ═════════════════════════════════════════════════════
   Dropping the ?tnd= query entirely used to PASS (`if (_revS && …)`), while lagging it failed.
   The permanent SW piper-cache makes the missing anchor the worse of the two. */
rc |= sabotage.prove({
  file: "piper_test.html",
  command: GATE,
  cases: [
    {
      label: "G9 the soak page imports vits-web with NO ?tnd= rev at all",
      mustFail: "SOAK REV ANCHOR MISSING",
      find: /vits-web\.js\?tnd=r\d+/,
      replace: "vits-web.js"
    }
  ]
});

/* ═══ G15 — the slot renderer's anchor arm ═══════════════════════════════════════════════════
   The property pin's catching half (cap the row count) is proven in sabotage-contract-tier.js.
   Proven here: the anchor. A renamed/moved _renderPiperSlots must report the moved anchor
   LOUDLY rather than silently skipping the row-count property with an empty slice. */
rc |= sabotage.prove({
  file: "tts.js",
  command: GATE,
  cases: [
    {
      label: "G15 _renderPiperSlots is renamed, so the row-count property can no longer be located",
      mustFail: "_renderPiperSlots not found",
      find: "  function _renderPiperSlots() {",
      replace: "  function _renderPiperSlotsV2(x) {"
    }
  ]
});

process.exit(rc);
