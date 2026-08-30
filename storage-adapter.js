// storage-adapter.js
// Thin adapter between game state and storage backend.
//
// LOCAL mode (default): synchronous localStorage — identical to existing behaviour.
// SERVER mode: local-first with async write-through to the Fly.io Hono server.
//
// Auth flow:
//   storageAdapter.loginWithServer(serverUrl, onSuccess)
//     Opens a GitHub OAuth popup → server postMessages the session ID back →
//     adapter stores it in localStorage and enables server mode.
//
// All game code continues to call saveAll() unchanged.

var storageAdapter = (function() {

  var SERVER_URL_KEY = "tnd_server_url_v1";
  var SERVER_TOK_KEY = "tnd_server_tok_v1";

  var _serverUrl           = null;   // null = local mode
  var _token               = null;
  var _syncing             = false;
  var _pendingSync         = false;  // retry after current sync completes
  var _portraitDirty       = false;
  var _portraitSyncedOnce  = false;  // upload portrait on first sync of session
  var _popup               = null;
  var _popupCb             = null;
  var _syncSizeWarned      = false;  // #67: warn once per page session, not once per oversized POST
  var _bootPushToast       = false;  // JP0-11: one "final turns synced" toast per page load

  // ── JP0-11 (Fable f68): the page-hide flush is SIZE-BOUNDED ──────────────────────────────
  // The unload / page-hide flush rides fetch(keepalive:true) because a plain fetch is abandoned
  // on unload (audit E34). The Fetch spec caps the TOTAL in-flight keepalive request BODY at
  // 64 KiB; over that the browser rejects the request outright — and that rejection landed in the
  // beacon path's swallowing .catch, so nothing surfaced: no console line, no badge, no toast.
  // The documented "closing/backgrounding can't drop the final turn" guarantee was therefore dead
  // for MOST saves, not merely mature ones — the PC's base64 portrait rides INLINE by design (see
  // _stripNpcPortraits), and a 40-100KB data URL clears 64 KiB on its own from roughly turn 1.
  //
  // The fix does NOT attempt the doomed request and does NOT chunk. Over the margin the flush
  // marks this campaign DIRTY — the TURN NUMBER only; the state itself is already on disk — and
  // the next load() for that campaign PUSHES before it will consider adopting any server copy.
  // The CAS turn guard is untouched: it still arbitrates a genuine two-device conflict (loudly);
  // this only guarantees the local final turns are on the table when it does.
  var FLUSH_KEEPALIVE_MAX = 56 * 1024;          // BYTES — the safety margin under the spec's 64 KiB
  var SYNC_DIRTY_K        = "tnd_sync_dirty_v1";
  var SYNC_DIRTY_CAP      = 8;                  // campaigns tracked at once (monotonic-resources rule)

  // The keepalive cap is measured in BYTES; payload.length is a CHARACTER count. The compressed
  // transcript (#92, {__lz} UTF-16 code units) encodes to up to 3 UTF-8 bytes per character, so
  // the char count is a systematic UNDER-estimate exactly where the payload is heaviest — using it
  // as the gate would let genuinely-over-cap bodies through. TextEncoder gives the true number;
  // without it we fall back to the char count, which is a lower bound (never an over-report).
  function _payloadBytes(s) {
    s = s || "";
    try { if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s).length; } catch (e) {}
    return s.length;
  }
  // Pure gate (exposed for the engine tests): is this payload too big to flush on keepalive?
  function flushTooBigForKeepalive(payload) { return _payloadBytes(payload) > FLUSH_KEEPALIVE_MAX; }

  // ONE campaign-key resolver for both ends of the marker's life — the flush writes it and a later
  // boot reads it, and a disagreement between the two would strand the marker forever (the flush
  // happens with the campaign active; so does the boot).
  function _dirtyKey(explicit) {
    if (explicit) return explicit;
    var a = (typeof getActiveCampId === "function") ? getActiveCampId() : null;
    var b = (typeof worldState !== "undefined" && worldState) ? worldState.campId : null;
    return a || b || "default";
  }
  // The marker lives in the `store` wrapper, NOT raw localStorage: store keeps the value in memory
  // when the disk write fails, so a quota-stressed device still remembers the unsynced turn for the
  // rest of the session (the same reasoning as syncSizeWarnOnce).
  function _dirtyRead() {
    try {
      var raw = (typeof store !== "undefined") ? store.get(SYNC_DIRTY_K) : null;
      var o = raw ? JSON.parse(raw) : null;
      return (o && typeof o === "object" && Object.prototype.toString.call(o) !== "[object Array]") ? o : {};
    } catch (e) { return {}; }
  }
  function _dirtyWrite(map) {
    try { if (typeof store !== "undefined") store.set(SYNC_DIRTY_K, JSON.stringify(map)); }
    catch (e) { console.warn("[storage] could not persist the unsynced-flush marker (" + (e && e.message) + ") — the final turns stay local until the next successful sync"); }
  }
  function markFlushDirty(campId, turn) {
    var id = _dirtyKey(campId), map = _dirtyRead(), keys = Object.keys(map);
    if (!(id in map) && keys.length >= SYNC_DIRTY_CAP) {
      console.warn("[storage] unsynced-flush markers full (" + SYNC_DIRTY_CAP + ") — dropping the oldest, campaign '" + keys[0] + "' (turn " + map[keys[0]] + "); its final turns upload on its next ordinary sync instead");
      delete map[keys[0]];
    }
    map[id] = turn;
    _dirtyWrite(map);
  }
  function flushDirtyTurn(campId) {
    var map = _dirtyRead(), v = map[_dirtyKey(campId)];
    return (typeof v === "number") ? v : null;
  }
  function clearFlushDirty(campId) {
    var id = _dirtyKey(campId), map = _dirtyRead();
    if (!(id in map)) return;
    delete map[id];
    if (Object.keys(map).length) _dirtyWrite(map);
    else { try { if (typeof store !== "undefined") store.del(SYNC_DIRTY_K); } catch (e) {} }
  }
  // Clear the marker ONLY on a confirmed 2xx push of OUR OWN payload. A 409 self-heal acks the
  // SERVER's turn, which is no proof our turns landed — the retry it fires clears it on its 200.
  function _flushAcked(turnAt) {
    var t = flushDirtyTurn();
    if (t == null) return;
    if (typeof turnAt === "number" && turnAt >= t) clearFlushDirty();
  }

  // ── Auto-connect on page load ───────────────────────────────────────────
  // If a saved server URL + token exist in localStorage, restore server mode.

  function autoConnect() {
    try {
      var url = localStorage.getItem(SERVER_URL_KEY);
      var tok = localStorage.getItem(SERVER_TOK_KEY);
      if (url && tok) {
        _serverUrl = url;
        _token     = tok;
        syncSpeakerStars(null);   // #95.5: fire-and-forget bench adopt on boot (function is hoisted)
        fetchAccount(null);       // §3 gateway: populate serverAccount so gmViaServer can route
      }
    } catch(e) {}
  }

  // ── Server configuration ────────────────────────────────────────────────

  function setServer(url, token) {
    _serverUrl = url ? url.replace(/\/$/, "") : null;
    _token     = token || null;
    try {
      if (_serverUrl && _token) {
        localStorage.setItem(SERVER_URL_KEY, _serverUrl);
        localStorage.setItem(SERVER_TOK_KEY, _token);
      } else {
        localStorage.removeItem(SERVER_URL_KEY);
        localStorage.removeItem(SERVER_TOK_KEY);
      }
    } catch(e) {}
  }

  function isServerMode() { return !!_serverUrl; }

  function getServerUrl() { return _serverUrl; }

  // ── GitHub OAuth popup login ────────────────────────────────────────────

  function loginWithServer(serverUrl, onSuccess, provider) {
    if (_popup && !_popup.closed) { _popup.focus(); return; }

    // provider: "github" (default) | "google" — same ticket flow, different first door (§5.2).
    var _authPath = provider === "google" ? "/auth/google" : "/auth/github";
    serverUrl = serverUrl.replace(/\/$/, "");
    _popupCb  = onSuccess || null;
    // Origin to accept postMessage auth from (audit E7) — the /auth/done page is served from the
    // server, so a genuine message carries this origin. Anything else is a forged token-fixation
    // attempt and is ignored. (file:// openers get a "null" origin and use the ticket-poll fallback.)
    var _authOrigin = (function(){ try { return new URL(serverUrl).origin; } catch(e) { return null; } })();

    var w = 600, h = 700;
    var left = Math.round(screen.width  / 2 - w / 2);
    var top  = Math.round(screen.height / 2 - h / 2);
    _popup = window.open(
      serverUrl + _authPath,
      "tnd-auth",
      "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top
    );
    // A blocked popup returns null (audit E75) — report it instead of failing silently.
    if (!_popup) { if (typeof _popupCb === "function") { _popupCb("Popup blocked — allow popups for this site and try again."); _popupCb = null; } return; }

    // Listen for postMessage from /auth/done (works on https origins)
    // AND poll /auth/ticket/:ticket as fallback for file:// origins
    var _ticket = null;
    var _pollInterval = null;
    // #70: an abandoned popup (user closes the tab, walks away, or the OAuth screen just sits
    // there) otherwise leaves the "message" listener + both intervals alive for the rest of the
    // page session — a leak with no completion path. 5min is generous for a manual GitHub login
    // but bounds the leak. Cleared on every completion path below (onAuth + the popup-closed branch).
    var _authGiveUpTimer = setTimeout(function() {
      window.removeEventListener("message", onMsg);
      if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
      if (_ticketPoll) { clearInterval(_ticketPoll); }
      console.warn("[storage] login abandoned — OAuth popup listener timed out after 5min");
      _popup = null; _popupCb = null;
    }, 5 * 60 * 1000);

    function onAuth(sessionId, username, avatarUrl) {
      clearTimeout(_authGiveUpTimer);
      window.removeEventListener("message", onMsg);
      if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
      if (_popup && !_popup.closed) { try { _popup.close(); } catch(x) {} }
      _popup = null;
      setServer(serverUrl, sessionId);
      syncSpeakerStars(null);   // #95.5: fresh connect — adopt (or seed) the cloud star bench
      if (typeof _popupCb === "function") {
        _popupCb(null, { username: username, avatarUrl: avatarUrl });
        _popupCb = null;
      }
    }

    function onMsg(e) {
      // Reject messages from any origin but the server (audit E7). Without this, any window with a
      // handle to this tab could post a forged {type:"tnd-auth", sessionId} and fixate the session
      // token, so campaign data would sync to the attacker's account.
      if (_authOrigin && e.origin !== _authOrigin) return;
      if (!e.data || e.data.type !== "tnd-auth") return;
      var ticket = e.data.ticket;
      if (ticket) {
        // Claim the ticket from server
        fetch(serverUrl + "/auth/ticket/" + ticket)
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(d) { if (d && d.sessionId) onAuth(d.sessionId, d.username, d.avatarUrl); })
          .catch(function() {});
      } else if (e.data.sessionId) {
        onAuth(e.data.sessionId, e.data.username, e.data.avatarUrl);
      }
    }
    window.addEventListener("message", onMsg);

    // Poll every second as fallback (for file:// where postMessage is blocked)
    _pollInterval = setInterval(function() {
      if (!_popup || _popup.closed) {
        // Popup closed — if we have a ticket try to claim it, else give up
        clearInterval(_pollInterval); _pollInterval = null;
        window.removeEventListener("message", onMsg);
        clearTimeout(_authGiveUpTimer); // #70: popup-closed is a completion path too, ticket claim below is fire-and-forget
        _popup = null;
        if (_ticket) {
          fetch(serverUrl + "/auth/ticket/" + _ticket)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(d) { if (d && d.sessionId) onAuth(d.sessionId, d.username, d.avatarUrl); else if (_popupCb) { _popupCb("Login cancelled"); _popupCb = null; } })
            .catch(function() { if (_popupCb) { _popupCb("Login failed"); _popupCb = null; } });
        } else if (_popupCb) { _popupCb("Login cancelled"); _popupCb = null; }/* closed with no ticket — was a silent no-op (audit E75) */
      }
    }, 500);

    // Intercept the popup URL to extract ticket when it lands on /auth/done
    var _ticketPoll = setInterval(function() {
      try {
        if (_popup && !_popup.closed) {
          var href = _popup.location.href;
          if (href && href.indexOf("/auth/done") >= 0) {
            var m = href.match(/ticket=([^&]+)/);
            if (m) { _ticket = m[1]; clearInterval(_ticketPoll); }
          }
        } else { clearInterval(_ticketPoll); }
      } catch(e) { /* cross-origin — can't read yet */ }
    }, 200);
  }

  // ── Log out from server ─────────────────────────────────────────────────

  function logoutFromServer(cb) {
    var url = _serverUrl, tok = _token;
    setServer(null, null);   // clear local state immediately
    // v1.462 (Fable review entry 7, brief B): the prefs rev markers are ACCOUNT-scoped state on a
    // device key. Left behind, a later login as a different account can read its cloud rev as
    // "already seen" (marker collision -> plan says none) and this device's old bench then pushes
    // into the new account's row on the next edit. Clear the markers, keep the bench itself —
    // local stars are device data; the next boot pull re-adopts whatever the account holds.
    store.del(SPEAKER_STARS_REV_KEY);
    store.del("tnd_speaker_gender_overrides_rev_v1");
    if (!url) { if (cb) cb(); return; }
    // Send the token so the server can actually invalidate the session — without the
    // Authorization header logout was client-side amnesia only (audit #25). Timed + status-checked
    // (audit E78): a failed server-side invalidation is reported to the caller instead of a clean
    // logout, so the user knows the token may still be live until it expires on its own.
    _tFetch(url + "/auth/logout", { method: "POST", headers: tok ? { "Authorization": "Bearer " + tok } : {} }, SYNC_TIMEOUT_MS)
      .then(function(r) { if (cb) cb(r && r.ok ? null : "Server session may still be active — it will expire on its own."); })
      .catch(function() { if (cb) cb("Couldn't reach the server to end the session — it will expire on its own."); });
  }

  // ── Write-through sync (fire-and-forget) ────────────────────────────────

  // Timed fetch (TODO #24): the 2026-07-03 dead-host incident produced requests that never
  // resolved — the first one left _syncing=true forever, silently killing every later sync
  // for the whole session (including the page-hide flush). Abort after SYNC_TIMEOUT_MS so
  // the catch path ALWAYS runs and _syncing always resets.
  var SYNC_TIMEOUT_MS = 20000;

  // v1.441: persisted one-toast-per-campaign gate for the 2MB payload sentinel. Returns true
  // exactly once per campaign id (recorded as |id| segments). Uses the engine's `store` wrapper,
  // NOT raw localStorage, on purpose: store falls back to its in-memory map under quota/private
  // mode, so even when persistence fails the latch holds for the session — a device with full
  // storage gets at most one toast per page load, never one per sync. (Raw localStorage +
  // fail-open was the first draft; the harness's quota-simulating stub exposed it re-firing.)
  var SYNC_SIZE_WARN_K = "tnd_sync_size_warned_v1";
  function syncSizeWarnOnce(campId) {
    var id = campId || "default";
    try {
      var seen = (typeof store !== "undefined" && store.get(SYNC_SIZE_WARN_K)) || "";
      if (seen.indexOf("|" + id + "|") >= 0) return false;
      if (typeof store !== "undefined") store.set(SYNC_SIZE_WARN_K, seen + "|" + id + "|");
      return true;
    } catch (e) { return true; }
  }

  function _tFetch(url, opts, ms) {
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    if (ctrl) opts.signal = ctrl.signal;
    var tid = ctrl ? setTimeout(function() { ctrl.abort(); }, ms || SYNC_TIMEOUT_MS) : null;
    return fetch(url, opts).then(
      function(r) { if (tid) clearTimeout(tid); return r; },
      function(e) { if (tid) clearTimeout(tid); throw e; }
    );
  }

  // Sync health (TODO #24): every failure used to be a console.warn — invisible on mobile,
  // while the File menu kept showing "Connected". Track the last server-ACKed turn and
  // consecutive failures; ui.js renders the red membar badge from syncStatus().
  var _lastAckTurn = -1;  // highest worldState.turn the server provably holds; -1 = unknown
  var _failCount   = 0;   // consecutive sync failures
  var _last401At   = 0;   // #7② (#23① sweep): 401 toast repeats every RE401_TOAST_MS while the outage persists — the one-shot latch was missed twice in the field
  var _lastFailStatus = 0; // HTTP status of the most recent sync failure; 401 here makes the badge a tap-to-reconnect
  var RE401_TOAST_MS = 300000;
  var _conflict    = null; // CAS 409 (Known issue #5): {serverTurn} — another device is ahead; auto-sync pauses until reload/switch

  // Reset the per-campaign sync bookkeeping on a campaign switch (audit E32). These are module
  // globals: after switching FROM a higher-turn campaign, _lastAckTurn stayed high so
  // syncStatus().unsynced pinned at 0 (killing the #24 foreground self-heal), and switching the
  // other way showed a false "N turns unsynced" badge. Called from loadState (init + every switch).
  function resetSyncState() {
    _lastAckTurn = -1; _failCount = 0; _last401At = 0; _lastFailStatus = 0; _portraitSyncedOnce = false; _conflict = null;
    _updateSyncUI();
  }
  // CAS conflict (Known issue #5): the server refused this write because another device's state
  // is ahead. LOUD + sticky: auto-sync pauses (a retry loop would just hammer 409s and tempt a
  // clobber) until reload/campaign-load re-reconciles — load() adopts the newer server state,
  // resetSyncState clears the flag, sync resumes. Local progress stays safe on this device.
  function _onConflict(serverTurn) {
    var localTurn = (typeof worldState !== "undefined" && worldState && worldState.turn) || 0;
    _conflict = { serverTurn: serverTurn };
    console.warn("[storage] sync CONFLICT (409): server holds turn " + serverTurn + ", this device last saw " + _lastAckTurn + " (local turn " + localTurn + "). Sync paused.");
    if (typeof showToast === "function") showToast("&#9729; Another device is ahead (turn " + (serverTurn != null ? serverTurn : "?") + "). Sync paused &mdash; reload to adopt it, or export this save first.");
    _updateSyncUI();
  }

  function _syncOk(turnAt) {
    _failCount = 0; _last401At = 0; _lastFailStatus = 0;
    if (turnAt > _lastAckTurn) _lastAckTurn = turnAt;
    _updateSyncUI();
  }
  // CAS 409 decision (2026-07-13, the Halvard turn-0 incident): pure + exposed for engine tests.
  // The 409 body carries the server's turn FOR THIS CAMPAIGN's row (per-campaign CAS, so no
  // identity ambiguity). serverTurn <= local means this device is current or ahead — the exact
  // case the reload-reconcile path already resolves as local-wins (storage-adapter load(), the
  // Known-issue-#5 re-arm) — so heal in place: ack the server turn and retry ONCE instead of
  // hard-pausing on a conflict with our own (or an older) write. serverTurn AHEAD of local, an
  // unverifiable body, or a second 409 in the same chain (loop bound) still pause exactly as
  // before — the guard's real target (another device genuinely ahead) is untouched.
  function resolveCas409(serverTurn, localTurn, alreadyHealed) {
    if (alreadyHealed) return "pause";
    if (typeof serverTurn !== "number" || typeof localTurn !== "number") return "pause";
    return serverTurn <= localTurn ? "heal" : "pause";
  }
  // B7 (cross-campaign ack contamination): the reconcile identity decision — pure, exposed for
  // engine tests. GET /api/state returns the user's MOST-RECENTLY-UPDATED campaign, not
  // necessarily the active one, so the ack seed and the adopt in load() MUST prove the blob is
  // THIS campaign before using it. The old guard only rejected when BOTH ids were readable and
  // different: a transiently unreadable local active-id (B7 in the field: a quota-stressed
  // iPhone, minutes after a test campaign became the account's most-recent) let a FOREIGN
  // campaign's turn seed _lastAckTurn — the badge showed local-turn-minus-the-OTHER-campaign's-
  // turn (815−52=763) — and, had the foreign turn been HIGHER, the adopt would have replaced the
  // live campaign wholesale. Identity now draws on BOTH local sources (the active-id key and the
  // live worldState.campId), and a POSITIVE match is required; the only permitted no-match
  // reconcile is a truly fresh device (no local identity AND no readable local save) adopting
  // its first campaign.
  function reconcileIdentityOk(localActive, wsCampId, serverCamp, localOk) {
    var localId = localActive || wsCampId || null;
    if (!localId && !localOk) return true; // fresh device — first-load adopt is the intended path
    return !!serverCamp && serverCamp === localId;
  }
  function _onSyncFail(msg, status) {
    _failCount++;
    _lastFailStatus = status || 0;
    console.warn("[storage] sync failed (" + _failCount + " consecutive): " + msg);
    if (typeof showToast === "function") {
      if (status === 401 && Date.now() - _last401At > RE401_TOAST_MS) {
        _last401At = Date.now();
        showToast("&#9729; Session expired &mdash; tap the &#9729; badge (or Dev Mode &#9656; Connect server) to reconnect");
      } else if (_failCount === 3) {
        showToast("&#9729; Sync failing &mdash; progress is saved on this device and uploads automatically when the server is back");
      }
    }
    _updateSyncUI();
  }
  function _updateSyncUI() {
    if (typeof updateSyncBadge === "function") { try { updateSyncBadge(); } catch(e) {} }
  }
  function syncStatus() {
    var t = (typeof worldState !== "undefined" && worldState) ? (worldState.turn || 0) : 0;
    return {
      serverMode:  !!_serverUrl,
      failing:     _failCount > 0,
      failCount:   _failCount,
      lastAckTurn: _lastAckTurn,
      conflict:    _conflict,
      authExpired: _lastFailStatus === 401, // #7② — the badge renders this as tap-to-reconnect
      unsynced:    (_serverUrl && _lastAckTurn >= 0) ? Math.max(0, t - _lastAckTurn) : 0
    };
  }

  // #7③ (#23① sweep) — read-only server-turn probe for the manual campaign push: lets the
  // rescue tool warn before overwriting a NEWER server copy. cb(turn|null): null means UNKNOWN
  // (offline, no server row, or the list carries no turn field) — callers must treat null as
  // "cannot judge" and proceed as before, never as turn 0.
  function getServerCampaignTurn(id, cb) {
    cb = cb || function(){};
    if (!_serverUrl || !_token) { cb(null); return; }
    _tFetch(_serverUrl + "/api/campaigns", {
      headers: { "Authorization": "Bearer " + _token }
    }, SYNC_TIMEOUT_MS).then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function(list) {
      if (!Array.isArray(list)) { cb(null); return; }
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) { cb(typeof list[i].turn === "number" ? list[i].turn : null); return; }
      }
      cb(null);
    }).catch(function(e) {
      console.warn("[storage] server-turn probe failed:", e && e.message);
      cb(null);
    });
  }

  function markPortraitDirty() {
    _portraitDirty = true;
    // #3: bump a version counter so a portrait change propagates cross-device even without a turn advance.
    if (typeof worldState !== "undefined" && worldState) worldState.portraitVer = (worldState.portraitVer || 0) + 1;
  }

  function syncPortrait(campId) {
    if (!_serverUrl || !_token || !campId) return;
    if (typeof worldState === "undefined" || !worldState) return;
    var portrait = worldState.character ? worldState.character.portrait : null;
    // Collect all NPC portraits — via npcPortrait() (v1.170): after the #3 dedupe, companion
    // portraits live on charSheet only; collecting bare n.portrait dropped them from this store,
    // which is the ONLY transport when the other device already has the current turn number.
    var npcPortraits = {};
    (worldState.npcs || []).forEach(function(n) {
      var p = (typeof npcPortrait === "function") ? npcPortrait(n) : n.portrait;
      if (p) npcPortraits[n.name] = p;
    });
    if (!portrait && !Object.keys(npcPortraits).length) return;
    _portraitDirty = false;
    _tFetch(_serverUrl + "/api/campaigns/" + encodeURIComponent(campId) + "/portrait", {
      method:  "PUT",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + _token },
      body:    JSON.stringify({ portrait: portrait, npcPortraits: npcPortraits })
    }, SYNC_TIMEOUT_MS).catch(function(e) {
      _portraitDirty = true;
      console.warn("[storage] portrait sync failed:", e.message);
    });
  }

  // Debounced write-through (audit #16). saveAll() fires 2-3x per turn (applyMuts + sendAction +
  // UI ops), and each used to POST the full state immediately — including the ENTIRE story DOM.
  // syncToServer() now just schedules; the trailing timer coalesces a turn's bursts into ONE POST
  // built from the LATEST state at fire time. syncNow() flushes immediately (beforeunload /
  // page-hide), closing the debounce window on exit.
  var _syncTimer = null;
  var SYNC_DEBOUNCE_MS = 1500;

  function syncToServer() {
    if (!_serverUrl || typeof worldState === "undefined" || !worldState) return;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(function() { _syncTimer = null; _syncNow(); }, SYNC_DEBOUNCE_MS);
  }

  // beacon=true is the page-unload / page-hide flush (audit E34): a plain fetch is abandoned by the
  // browser on unload AND the _syncing-in-flight guard would drop it, so the final turn could vanish
  // despite the documented guarantee. keepalive survives unload and — unlike navigator.sendBeacon —
  // can carry the Authorization header the server requires.
  function syncNow(beacon) {
    if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
    _syncNow(beacon);
  }

  // Keep the CURRENT PC's portrait INLINE in the state blob — it must stay atomic with the
  // state turn. Splitting it into the separate /portrait request let it desync: after a
  // character swap the blob said "PC=X" while the separate store still held the old PC's image,
  // so a second device loaded the wrong portrait. (Companion charSheet portraits already ride in
  // the blob unstripped — the PC being the one thing split off was the bug.) Only NPC avatar
  // portraits (n.portrait) are stripped to the separate store, since campaigns can have many.
  // ONE map for both POST /api/state paths (audit B9) — _syncNow and pushCampaignState; the
  // ui.js copy used to drift (the v1.240/E27 re-apply incidents).
  function _stripNpcPortraits(ws) {
    return Object.assign({}, ws, {
      npcs: (ws.npcs||[]).map(function(n){
        return n.portrait ? Object.assign({}, n, {portrait:null}) : n;
      })
    });
  }

  // `done` (optional, non-beacon only) fires ONCE when this push has settled — cb(null) on a
  // confirmed 2xx, cb(reason) otherwise. JP0-11's boot push is its only caller: it must know
  // whether the marked turns actually reached the server before the reconcile may adopt.
  function _syncNow(beacon, healedRetry, done) {
    var _doneCb = (typeof done === "function") ? done : null;
    function _fin(err) { var f = _doneCb; _doneCb = null; if (f) f(err || null); }
    if (!_serverUrl || typeof worldState === "undefined" || !worldState) { _fin("not connected"); return; }
    if (_conflict) { _fin("sync paused — another device is ahead"); return; } // CAS 409 landed — never POST over a newer device; reload/switch clears via resetSyncState
    if (_syncing && !beacon) { _pendingSync = true; _fin("a sync was already in flight"); return; }
    var campId = (typeof getActiveCampId === "function") ? getActiveCampId() : null;
    if (!beacon) { _syncing = true; _pendingSync = false; }
    var turnAt   = worldState.turn || 0; // the turn this payload carries — ACKed on 2xx
    var wsStripped = _stripNpcPortraits(worldState); // PC portrait stays inline — see _stripNpcPortraits
    // narrativeHtml intentionally empty (audit #18): the story pane is rebuilt from
    // worldState.transcript on load — the DOM copy was the largest payload item and fully
    // derivable. Field kept (as "") so the server never sees an undefined key.
    var payload = JSON.stringify({
      // #92: the transcript ships COMPRESSED ({__lz} — the same form the localStorage boundary
      // stores, so every reader of either is the same tolerant inflater). The 2MB sentinel fired
      // for real at t1130; the transcript was the payload. _stripNpcPortraits keeps the
      // transcript array by reference, so the compression memo is SHARED with saveCore — one
      // LZ pass per turn serves both boundaries. Degrade (no LZ) = today's plain payload.
      worldState:    wireWorldStateSnapshot(wsStripped),/* #272 D3: THE wire-form seam (both POST paths); at the shipped flag this IS compressWorldStateSnapshot */
      sessionLog:    sessionLog,
      memory:        memory,
      campaignId:    campId,
      narrativeHtml: "",
      // CAS turn guard (Known issue #5): the server turn this device last saw. The server 409s
      // if its stored turn is AHEAD (another device wrote since) instead of letting this blob
      // clobber it. -1 = never seen server state — also correctly refused against existing data.
      baseTurn:      _lastAckTurn
    });
    // #67/#272 D3 sync payload telemetry: REAL UTF-8 bytes via _payloadBytes (TextEncoder — the
    // JP0-11 measurer). The old .length char count under-reported the {__lz} portion ~3x, so the
    // 2MB sentinel fired at ~5.9MB actual wire bytes (f69). Mutate worldState.usage only — never
    // saveAll/saveCore here, or the save would re-enter syncToServer from inside a sync. The
    // mutation rides along on whatever save happens next.
    if (worldState.usage) {
      var _syncPayloadBytes = _payloadBytes(payload);
      worldState.usage.syncBytes     = (worldState.usage.syncBytes || 0) + _syncPayloadBytes;
      worldState.usage.syncPosts     = (worldState.usage.syncPosts || 0) + 1;
      worldState.usage.lastSyncBytes = _syncPayloadBytes;
      if (_syncPayloadBytes > 2*1024*1024 && !_syncSizeWarned) {
        _syncSizeWarned = true;
        console.warn("[storage] sync payload is " + (_syncPayloadBytes/1024/1024).toFixed(1) + " MB");
        // v1.441: the toast is a SENTINEL, not a nag. It fired for real 2026-07-24, the dev was
        // told, TODO #92 (payload compression) is filed — and a payload PERMANENTLY over the line
        // re-toasted on every reload because the latch was per page load. Now once per CAMPAIGN,
        // persisted; the console line + usage telemetry still record every session, and a
        // different campaign crossing the line later still gets its one announcement.
        if (syncSizeWarnOnce(worldState.campId) && typeof showToast === "function")
          showToast("&#9888; Cloud sync upload is " + (_syncPayloadBytes/1024/1024).toFixed(1) + " MB &mdash; mature campaign; mention it to the dev");
      }
    }
    if (beacon) {
      // JP0-11: over the keepalive body cap the request is not merely likely to fail — the browser
      // refuses it outright. Attempting it buys nothing and hides the loss, so SKIP it and mark the
      // campaign instead; load() pushes the marked turns at the next launch before any adopt.
      if (flushTooBigForKeepalive(payload)) {
        markFlushDirty(campId, turnAt);
        console.warn("[storage] page-hide flush SKIPPED — payload is " + Math.round(_payloadBytes(payload) / 1024) +
          " KB, over the " + Math.round(FLUSH_KEEPALIVE_MAX / 1024) + " KB keepalive body limit (browsers reject it). Turn " +
          turnAt + " is saved on this device and marked to upload at the next launch.");
        _updateSyncUI();
        return;
      }
      // Keepalive POST — no _syncing bookkeeping, no retry (the page may be going away). But DO
      // ack the response when the page survives (alt-tab usually does): an un-acked beacon that
      // created the campaign's first server row made the NEXT regular POST lose the CAS race
      // against our own write (the Halvard turn-0 false positive, 2026-07-13). Best-effort: if
      // the page really unloads, the .then never runs and we're no worse off than before.
      try {
        fetch(_serverUrl + "/api/state", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+_token }, body:payload, keepalive:true })
          .then(function(r){
            if (r.ok) { _syncOk(turnAt); _flushAcked(turnAt); /* JP0-11: an under-cap beacon that DID land clears any standing marker */ }
            else if (r.status === 409) r.json().then(function(d){
              var st = d && d.serverTurn;
              if (resolveCas409(st, worldState ? (worldState.turn||0) : 0, false) === "heal") { _syncOk(st); console.warn("[storage] beacon 409 self-healed: server turn " + st + " ≤ local — acked, next regular sync proceeds."); }
              else _onConflict(st);
            }).catch(function(){});
          }).catch(function(){});
      } catch(e) {}
      return;
    }
    _tFetch(_serverUrl + "/api/state", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + _token },
      body:    payload
    }, SYNC_TIMEOUT_MS).then(function(r) {
      _syncing = false;
      if (r.status === 409) {
        r.json().then(function(d){
          var st = d && d.serverTurn;
          if (resolveCas409(st, worldState ? (worldState.turn||0) : 0, !!healedRetry) === "heal") {
            // Our own (or an older) write — ack the server's turn and retry ONCE with the proof.
            // The retry OWNS the completion: it, not this attempt, decides whether the turns landed.
            _syncOk(st);
            console.warn("[storage] sync 409 self-healed: server turn " + st + " ≤ local turn " + (worldState ? (worldState.turn||0) : 0) + " — acked and retrying once.");
            var _pass = _doneCb; _doneCb = null;
            _syncNow(false, true, _pass);
          } else { _onConflict(st); _fin("another device is ahead (server turn " + st + ")"); }
        }).catch(function(){ _onConflict(null); _fin("conflict — the 409 body was unreadable"); });
      }
      else if (!r.ok) { _onSyncFail("server returned " + r.status, r.status); _fin("server returned " + r.status); }
      else {
        _syncOk(turnAt);
        _flushAcked(turnAt);   // JP0-11: the ONLY thing that clears an unsynced-flush marker
        if (_portraitDirty || !_portraitSyncedOnce) {
          _portraitSyncedOnce = true;
          syncPortrait(campId);
        }
        _fin(null);
      }
      if (_pendingSync) _syncNow();
    }).catch(function(e) {
      _syncing = false;
      var _msg = e && e.name === "AbortError" ? "timed out after " + (SYNC_TIMEOUT_MS / 1000) + "s" : ((e && e.message) || "network error");
      _onSyncFail(_msg, 0);
      _fin(_msg);
      if (_pendingSync) _syncNow();
    });
  }

  // ── Campaign list sync ──────────────────────────────────────────────────────

  // UA20 (v1.283): pure merge, extracted for engine tests. Server wins on id conflicts;
  // entries the server has NEVER tracked (no onServer flag — offline/unsynced campaigns)
  // are kept; entries the server ONCE listed (onServer:true) but no longer does were
  // deleted on another device — PRUNE the list row (loudly), else deletions resurrect
  // forever. Only the picker row goes: local snapshots/state keys are never touched here.
  function mergeCampaignLists(local, serverList) {
    var merged = local.slice(), i, j, found;
    for (i = 0; i < serverList.length; i++) {
      serverList[i].onServer = true;
      found = false;
      for (j = 0; j < merged.length; j++) {
        if (merged[j].id === serverList[i].id) { merged[j] = Object.assign({}, merged[j], serverList[i], {onServer:true}); found = true; break; }
      }
      if (!found) merged.push(serverList[i]);
    }
    var kept = [], pruned = [];
    for (j = 0; j < merged.length; j++) {
      var m = merged[j], onSrv = false;
      for (i = 0; i < serverList.length; i++) { if (serverList[i].id === m.id) { onSrv = true; break; } }
      if (m.onServer && !onSrv) pruned.push(m.id); else kept.push(m);
    }
    if (pruned.length) console.warn("[storage] campaign list: pruned " + pruned.length + " entr" + (pruned.length === 1 ? "y" : "ies") + " deleted on another device (UA20): " + pruned.join(", "));
    return kept;
  }

  function syncCampaignList(cb) {
    if (!_serverUrl || !_token) { if (cb) cb(null); return; }
    var _fired = false;
    function done(result) { if (!_fired) { _fired = true; if (cb) cb(result); } }
    // _tFetch (20s) replaces the old 60s fallback timer — a dead host held the campaign
    // picker on "Waking server up, hang tight…" for a full minute before giving up (#24).
    _tFetch(_serverUrl + "/api/campaigns", {
      headers: { "Authorization": "Bearer " + _token }
    }, SYNC_TIMEOUT_MS).then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function(serverList) {
      if (!Array.isArray(serverList)) { done(null); return; }
      var local = [];
      try { var raw = localStorage.getItem("tnd_camps_v1"); if (raw) local = JSON.parse(raw); } catch(e) {}
      var merged = mergeCampaignLists(local, serverList);
      try { localStorage.setItem("tnd_camps_v1", JSON.stringify(merged)); } catch(e) {}
      done(merged);
    }).catch(function(e) {
      console.warn("[storage] campaign list sync failed:", (e && e.name === "AbortError") ? "timed out" : e.message);
      done(null);
    });
  }

  // ── Load ────────────────────────────────────────────────────────────────

  // v1.170: land blob-borne portraits even at EQUAL turn numbers, fill-only. The #3 dedupe made
  // charSheet.portrait the companion portrait's single home — it rides the state blob, but the
  // blob is only ADOPTED when serverTurn > localTurn. A device already at the current turn never
  // adopted it, and companions no longer travel via the /portrait store unless a portrait edit
  // bumps PV — so single-home portraits stranded on the device that had them (the Frizwick/
  // Morwen mobile report, 2026-07-04). Fill-only: never overwrites an image the device already
  // has, so it can't clobber a newer local edit. Returns true if anything landed.
  function fillPortraitsFromBlob(sws) {
    if (!sws || !sws.npcs) return false;
    if (typeof worldState === "undefined" || !worldState || !worldState.npcs) return false;
    var changed = false;
    // Only fill the PC portrait from a blob for the SAME character (audit E79) — after a mid-game
    // character swap or a cross-campaign GET, the blob's PC may be a different person, and filling
    // its portrait onto the current PC would land the wrong face.
    if (sws.character && sws.character.portrait && worldState.character && !worldState.character.portrait
        && sws.character.name === worldState.character.name) {
      worldState.character.portrait = sws.character.portrait;
      changed = true;
    }
    sws.npcs.forEach(function(sn) {
      var sp = sn && sn.charSheet && sn.charSheet.portrait;
      if (!sp) return;
      for (var i = 0; i < worldState.npcs.length; i++) {
        var ln = worldState.npcs[i];
        if (ln.name !== sn.name) continue;
        if (ln.charSheet && !ln.charSheet.portrait && !ln.portrait) { ln.charSheet.portrait = sp; changed = true; }
        break;
      }
    });
    return changed;
  }

  function load(cb) {
    var localOk = loadState();

    if (!_serverUrl) {
      cb(localOk);
      return;
    }

    // Paint from local cache instantly, then reconcile with server.
    cb(localOk);

    // JP0-11: a page-hide flush too big for keepalive left this campaign's final turns local-only.
    // OFFER THEM FIRST — _reconcileFromServer can adopt a newer server copy WHOLESALE, and adopting
    // over turns the server never saw is exactly the silent loss the marker exists to close. The CAS
    // guard still decides who wins; this only puts our turns into the argument. The reconcile runs
    // either way (a failed push must never wedge the campaign offline) — it is only DEFERRED.
    var _dirtyAt = flushDirtyTurn();
    if (_dirtyAt == null) { _reconcileFromServer(localOk); return; }
    console.warn("[storage] unsynced final turns from a previous session (turn " + _dirtyAt + ", page-hide flush was over the keepalive limit) — pushing before any server adopt.");
    _syncNow(false, false, function(err) {
      if (err) console.warn("[storage] the unsynced-turn push FAILED (" + err + ") — the marker stays set and retries at the next launch.");
      else if (!_bootPushToast) {
        _bootPushToast = true;
        if (typeof showToast === "function") showToast("&#9729; Last session's final turns synced now");
      }
      _reconcileFromServer(localOk);
    });
  }

  function _reconcileFromServer(localOk) {
    // Timed (audit E76): the reconcile GET had no timeout and its failure was only console.warn'd —
    // a dead host or expired token left the user silently reading stale local state while believing
    // they were synced. _tFetch bounds it; the catch surfaces the failure through the sync badge.
    _tFetch(_serverUrl + "/api/state", {
      headers: { "Authorization": "Bearer " + _token }
    }, SYNC_TIMEOUT_MS).then(function(r) {
      if (!r.ok) { var _e = new Error("HTTP " + r.status); _e.status = r.status; throw _e; }
      return r.json();
    }).then(function(data) {
      if (!data || !data.worldState) {
        syncCampaignList(null);
        return;
      }
      // #272 D3: REFUSE to adopt a transcript form this build cannot read (a NEWER client wrote
      // it — the wire-form flip is release-gated, but a stale device one navigation behind can
      // still pull ahead-of-it data). The old path rescued-and-EMPTIED the story view, and this
      // device's next push could then adopt-race an empty transcript over the server's good copy.
      // The server copy is safe where it lives; keep local state and defer — the SW update lands
      // on the next navigation. Pure attempt, no rescue write.
      var _srvTr = data.worldState.transcript;
      if (_srvTr && !(_srvTr instanceof Array) && typeof inflateTranscriptField === "function" && inflateTranscriptField(_srvTr) === null) {
        console.error("[storage] reconcile REFUSED — the server blob's transcript is in a form this build cannot read (newer client?). Keeping local state; reload this device to update.");
        if (typeof showToast === "function") showToast("&#9729; Cloud copy was written by a newer app version &mdash; reload to update, then sync resumes");
        syncCampaignList(null);
        return;
      }
      // #92: inflate FIRST, before any consumer — the adopt below assigns this blob RAW to the
      // live worldState (never through parseWorldState — the adopt-hop lesson), and a {__lz}
      // transcript would poison every consumer ({__lz}.push throws mid-turn). Top-level fields
      // (turn/campId/character) are plain either way; inflate failure takes the UA3 rescue path.
      data.worldState = inflateWorldStateSnapshot(data.worldState);
      // Campaign-identity guard (audit E4, hardened for B7): GET /api/state returns the user's
      // most-recent state for ANY campaign. If a DIFFERENT campaign is active locally, adopting
      // this blob would silently switch campaigns and stomp the active one — and even just
      // SEEDING _lastAckTurn from it poisons the sync badge (B7: 815−52=763 "unsynced"). A
      // POSITIVE identity match is required (see reconcileIdentityOk above) — identity from the
      // active-id key OR the live worldState.campId, so a transiently unreadable key can no
      // longer bypass the guard; only a truly fresh device reconciles without a match.
      var _localActive = (typeof getActiveCampId === "function") ? getActiveCampId() : null;
      var _serverCamp  = data.campaignId || data.worldState.campId || null;
      var _wsCampId    = (typeof worldState !== "undefined" && worldState) ? worldState.campId : null;
      if (!reconcileIdentityOk(_localActive, _wsCampId, _serverCamp, localOk)) { syncCampaignList(null); return; }
      var serverTurn = data.worldState.turn || 0;
      var localTurn  = (worldState && worldState.turn) || 0;
      // The server provably holds serverTurn — seed the ACK baseline (#24). If local is
      // AHEAD (the dead-host scenario), unsynced = localTurn - serverTurn shows immediately.
      if (serverTurn > _lastAckTurn) _lastAckTurn = serverTurn;
      // CAS re-arm (Known issue #5): this device has now SEEN the server's current state, so a
      // standing 409 pause is stale — clear it. If local is ahead (dead-host recovery), the next
      // POST carries baseTurn=serverTurn and passes; without this, a pre-reconcile 409 (ack was
      // -1) would wedge sync forever on the very device whose upload should win.
      if (_conflict) { _conflict = null; if (typeof worldState !== "undefined" && worldState && (worldState.turn||0) > serverTurn) syncToServer(); }
      _updateSyncUI();
      // Don't swap worldState out from under an in-flight turn (audit E4) — skip the adopt if busy.
      if (serverTurn > localTurn && !(typeof busy !== "undefined" && busy)) {
        var wasFresh = !localOk;
        worldState = data.worldState;
        // Restore the authoritative campaign ID from the server before saveAll()
        // fires — without this, getActiveCampId() returns null and syncToServer()
        // generates a new timestamp-based ID, creating a duplicate campaign record.
        var _scid = data.campaignId || (worldState && worldState.campId);
        if (_scid) { if (typeof setActiveCampId === "function") setActiveCampId(_scid); worldState.campId = _scid; }
        sessionLog = data.sessionLog || [];
        memory     = data.memory || blankMemory();
        // Adopted an un-migrated, un-healed server blob (audit E14) — run the same battery loadState
        // and importSave (audit #15) do, so old-schema fields don't run all session and re-sync.
        if (typeof migrateWorldState === "function") migrateWorldState();
        if (typeof healMemory === "function") healMemory();
        if (data.portrait && worldState.character && !worldState.character.portrait) {
          worldState.character.portrait = data.portrait;
        }
        // #3 dedupe: restore into the portrait's single home — charSheet when the NPC has one
        // (don't resurrect the npc.portrait duplicate), npc.portrait for sheet-less NPCs.
        if (data.npcPortraits && worldState.npcs) {
          worldState.npcs.forEach(function(n) {
            if (!data.npcPortraits[n.name]) return;
            if (n.charSheet) { if (!n.charSheet.portrait) n.charSheet.portrait = data.npcPortraits[n.name]; }
            else if (!n.portrait) n.portrait = data.npcPortraits[n.name];
          });
        }
        saveAll();
        if (wasFresh && typeof showGame === "function") {
          showGame();
          if (typeof initAbilities === "function") initAbilities();
          if (typeof initSpells    === "function") initSpells();
        }
        syncUI();
        // Rebuild the story pane from the transcript (audit #18) — the canonical narrative
        // record. Old blobs without a transcript degrade to initReplaySession's ESCAPED
        // fallbacks (last exchange, else "Previously:" recap). The legacy data.narrativeHtml
        // innerHTML fallback is REMOVED (ChatGPT review 2026-08-01): it was the last sink that
        // rendered stored content unescaped, and with provider keys in localStorage an injected
        // blob is credential theft, not a visual bug. The write side has sent "" since audit #18.
        var _rebuilt = false;
        try { if (typeof rebuildNarrativeFromTranscript === "function") _rebuilt = rebuildNarrativeFromTranscript(20, true); } catch(e) { console.warn("[storage] story rebuild after server adopt THREW — pane may show stale content until reload:", e && e.message); }
        if (!_rebuilt) {
          try {
            var _ne2 = document.getElementById("story-narrative");
            if (_ne2) _ne2.innerHTML = "";
            if (typeof initReplaySession === "function") initReplaySession();
          } catch(e) { console.warn("[storage] story fallback repaint after server adopt failed:", e && e.message); }
        }
        addMsg("system", "☁ State synced from server (turn " + serverTurn + ").");
      } else if (worldState) {
        // #3: a portrait can change WITHOUT advancing the turn, so the turn-gate above skips it — a portrait
        // set on another device never propagated. Reconcile portraits via a dedicated version counter instead.
        var serverPV = data.worldState.portraitVer || 0;
        var localPV  = worldState.portraitVer || 0;
        if (serverPV > localPV) {
          // PV-newer + same character: the inline blob PC portrait is authoritative — apply it
          // INCLUDING null so a removal on another device clears it here (audit E28), without
          // resurrecting from the stale separate /portrait store. Different char → leave it alone (E79).
          var _pvSameChar = data.worldState.character && worldState.character && data.worldState.character.name === worldState.character.name;
          if (worldState.character && _pvSameChar) worldState.character.portrait = (data.worldState.character.portrait) || null;
          if (data.npcPortraits && worldState.npcs) {
            worldState.npcs.forEach(function(n) {
              if (!data.npcPortraits[n.name]) return;
              // #3 dedupe: single home — server is newer here (PV-gated), so overwrite is intended.
              if (n.charSheet) { n.charSheet.portrait = data.npcPortraits[n.name]; n.portrait = null; }
              else n.portrait = data.npcPortraits[n.name];
            });
          }
          worldState.portraitVer = serverPV;
          saveAll();
          if (typeof syncUI === "function") syncUI();
        }
      }
      // Fill-only pass runs regardless of the turn/PV gates above (no-op after a full adopt —
      // worldState IS the blob then). saveCore, not saveAll: nothing here needs re-uploading.
      if (fillPortraitsFromBlob(data.worldState)) {
        if (typeof saveCore === "function") saveCore();
        if (typeof syncUI === "function") syncUI();
      }
      syncCampaignList(null);
    }).catch(function(e) {
      // Surface the reconcile failure through the sync badge instead of a silent console.warn
      // (audit E76) — the user is reading local state and should know it isn't confirmed synced.
      _onSyncFail(e && e.name === "AbortError" ? "reconcile timed out" : ((e && e.message) || "load failed"), e && e.status);
    });
  }

  // ── Shared JSON endpoint transport (audit #13) ───────────────────────────
  // ONE truth for the token-authed JSON endpoints: connected-guard → _tFetch (audit E77:
  // a dead/waking host used to hang these modals for minutes — the #24 mode) → ok-throw →
  // json → cb(null, data) / cb("HTTP "+status | error message). bodyObj (when given) is
  // JSON.stringify'd with Content-Type set; GET requests leave opts.method unset (fetch
  // default — pinned by dev/tests-b9-transport.js). Callers own path encoding
  // (encodeURIComponent on segments) — this takes the finished path.
  function _apiJson(path, method, bodyObj, cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    var opts = { headers: { "Authorization": "Bearer " + _token } };
    if (method && method !== "GET") opts.method = method;
    if (bodyObj != null) {
      opts.headers = { "Content-Type": "application/json", "Authorization": "Bearer " + _token };
      opts.body = JSON.stringify(bodyObj);
    }
    _tFetch(_serverUrl + path, opts, SYNC_TIMEOUT_MS)
      .then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  // ── Speaker-star bench sync (#95.5) ──────────────────────────────────────
  // The star bench is per-origin localStorage (the #95.4 field bug: starred on file://,
  // invisible on pages.dev), so connected devices mirror it through the account-level
  // /api/prefs/speaker_stars blob. The GAME is a READER: it adopts the cloud bench when the
  // server rev moved past the local marker, and pushes ONLY the one-time seed when the server
  // has never been written (migrating a bench that predates the feature). All real edits come
  // from speaker_browser.html, the bench's sole editor — whole-list LWW, no tombstones.
  var SPEAKER_STARS_KEY     = "tnd_speaker_stars_v1";
  var SPEAKER_STARS_REV_KEY = "tnd_speaker_stars_rev_v1";

  // Pure decision core (engine-tested): given the local store strings and the server's
  // {value, rev}, decide adopt / seed / none. Malformed local JSON counts as "no local bench"
  // so a corrupt store can never block adopting the good cloud copy — and a rev>0 answer whose
  // value is NOT an array (a corrupt cloud row) is never adopted, so it can't blank a device.
  function speakerStarsPlan(localJson, localRevRaw, srv) {
    // Server-rev coercion (v1.462, Fable review entry 7): a numeric-STRING rev (proxy/serializer
    // drift) means the number it encodes, and a present-but-unreadable rev is an UNKNOWN server
    // state — act on nothing. Before this, any non-number rev read as "never written" and the
    // plan SEEDED, overwriting a live cloud bench. Only a genuinely absent rev may read as 0.
    var revRaw = srv ? srv.rev : 0, srvRev = 0;
    if (typeof revRaw === "number" && isFinite(revRaw)) srvRev = revRaw;
    else if (typeof revRaw === "string" && /^\s*\d+\s*$/.test(revRaw)) srvRev = parseInt(revRaw, 10);
    else if (revRaw !== undefined && revRaw !== null) return { action: "none" };
    if (srvRev < 0) srvRev = 0;
    var srvHasList = !!(srv && Object.prototype.toString.call(srv.value) === "[object Array]");
    var localRev = parseInt(localRevRaw, 10); if (isNaN(localRev) || localRev < 0) localRev = 0;
    var hasLocal = false;
    try {
      var a = JSON.parse(localJson || "[]");
      hasLocal = Object.prototype.toString.call(a) === "[object Array]" && a.length > 0;
    } catch (e) {}
    if (srvRev > 0 && !srvHasList) return { action: "none" };
    if (srvRev > 0 && srvRev !== localRev) return { action: "adopt", rev: srvRev };
    if (srvRev === 0 && hasLocal) return { action: "seed" };
    return { action: "none" };
  }

  function syncSpeakerStars(cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    _apiJson("/api/prefs/speaker_stars", "GET", null, function(e, d) {
      if (e) { console.warn("[stars] cloud bench pull failed:", e); if (cb) cb(e); return; }
      var plan = speakerStarsPlan(store.get(SPEAKER_STARS_KEY), store.get(SPEAKER_STARS_REV_KEY), d);
      if (plan.action === "adopt") {
        store.set(SPEAKER_STARS_KEY, JSON.stringify(d.value));
        store.set(SPEAKER_STARS_REV_KEY, String(plan.rev));
        console.info("[stars] adopted cloud star bench — " + d.value.length + " star(s), rev " + plan.rev);
        if (cb) cb(null, "adopted");
      } else if (plan.action === "seed") {
        var mine = [];
        try { mine = JSON.parse(store.get(SPEAKER_STARS_KEY) || "[]"); } catch (e2) { mine = []; }
        _apiJson("/api/prefs/speaker_stars", "PUT", { value: mine }, function(e3, d3) {
          if (e3) { console.warn("[stars] cloud bench seed failed:", e3); if (cb) cb(e3); return; }
          if (d3 && typeof d3.rev === "number") store.set(SPEAKER_STARS_REV_KEY, String(d3.rev));
          console.info("[stars] seeded cloud star bench — " + mine.length + " star(s)");
          if (cb) cb(null, "seeded");
        });
      } else { if (cb) cb(null, "none"); }
    });
  }

  // ── Character library ────────────────────────────────────────────────────

  function listCharacterLibrary(cb)         { _apiJson("/api/characters", "GET", null, cb); }
  function saveCharacterToLibrary(char, cb) { _apiJson("/api/characters", "POST", { character: char }, cb); }
  function deleteCharacterFromLibrary(slug, cb) { _apiJson("/api/characters/" + encodeURIComponent(slug), "DELETE", null, cb); }

  // ── Blueprint library ────────────────────────────────────────────────────

  function listBlueprintLibrary(cb)       { _apiJson("/api/blueprints", "GET", null, cb); }
  function saveBlueprintToLibrary(bp, cb) { _apiJson("/api/blueprints", "POST", { blueprint: bp }, cb); }
  function deleteBlueprintFromLibrary(slug, cb) { _apiJson("/api/blueprints/" + encodeURIComponent(slug), "DELETE", null, cb); }

  function deleteCampaignFromServer(id, cb) {
    // Local guard so the not-connected path stays warn-free (pre-#13 behavior): only real
    // transport/HTTP failures carry the console.warn this wrapper has always emitted.
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    _apiJson("/api/campaigns/" + encodeURIComponent(id), "DELETE", null, function(e, d) {
      if (e) { console.warn("[storage] campaign delete failed:", e); if (cb) cb(e); return; }
      if (cb) cb(null, d);
    });
  }

  // ── Campaign transport (audit B9) ────────────────────────────────────────
  // ui.js used to re-implement these six requests with raw fetch() — bypassing _tFetch
  // (the TODO #24 dead-host timeout, so a sleeping Fly host hung the UI forever) and
  // re-reading the private token key. PURE TRANSPORT: no live-campaign assumptions —
  // pushCampaignState ships exactly the parts it is given (connectToServer pushes
  // NON-active campaigns' snapshots through it), cb(err, data) like the library wrappers.

  function hasToken() { return !!_token; }

  // #90: the tnd-tts app (separate origin, no user DB of its own) authenticates with the SAME
  // session token by proxy-validating it against this server's /auth/me. Expose the assembled
  // HEADER, not the raw token — callers compose fetches without ever handling the secret itself.
  function authHeader() { return _token ? { "Authorization": "Bearer " + _token } : {}; }

  function whoAmI(cb)                { _apiJson("/auth/me", "GET", null, cb); }

  // §3 gateway: the account readout (tier, entitlement, turn allowance). Writes the
  // `serverAccount` global — the ONE cache gmViaServer() (api.js) and the account UI read;
  // null stays "unknown" so routing can distinguish not-yet-fetched from known-unentitled.
  function fetchAccount(cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    _apiJson("/api/account", "GET", null, function(err, data) {
      if (!err && data && typeof serverAccount !== "undefined") serverAccount = data;
      if (cb) cb(err, data);
    });
  }
  function getCampaignState(campId, cb) { _apiJson("/api/campaigns/" + encodeURIComponent(campId), "GET", null, cb); }

  // parts = {worldState, sessionLog, memory} — the EXPLICIT blob to ship; never reads the
  // live globals, so a stale snapshot pushes as-is. NPC avatar portraits are stripped via
  // the same _stripNpcPortraits the main sync path uses (PC portrait stays inline — E27);
  // they travel through putCampaignPortrait instead. No baseTurn: this is the connect-time
  // "upload a local-only campaign" path, not the CAS-guarded per-turn sync (syncToServer
  // owns that — the server row doesn't exist yet, so there is nothing to guard against).
  function pushCampaignState(campId, parts, cb) {
    _apiJson("/api/state", "POST", {
      worldState:    wireWorldStateSnapshot(_stripNpcPortraits(parts.worldState)),/* #92/#272 D3: same wire form as _syncNow — the B9 one-map rule */
      sessionLog:    parts.sessionLog,
      memory:        parts.memory,
      campaignId:    campId,
      narrativeHtml: ""
    }, cb);
  }

  // payload = {portrait, npcPortraits} — built by the caller from ITS blob (silent push
  // reads a snapshot, syncPortrait reads live state; only the transport is shared).
  function putCampaignPortrait(campId, payload, cb) {
    _apiJson("/api/campaigns/" + encodeURIComponent(campId) + "/portrait", "PUT", payload, cb);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  // Auto-connect immediately (runs on script load)
  autoConnect();

  // Self-healing retry (TODO #24): local is the source of truth, so one successful POST
  // after an outage uploads the complete current state — recovery just needs a trigger.
  // (The page-hide flush lives in ui.js; these cover network-back and app-foreground.)
  if (typeof window !== "undefined") {
    window.addEventListener("online", function() { if (_serverUrl) syncToServer(); });
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", function() {
      if (document.visibilityState === "visible" && _serverUrl && syncStatus().unsynced > 0) syncToServer();
    });
  }

  return {
    setServer:             setServer,
    isServerMode:          isServerMode,
    getServerUrl:          getServerUrl,
    loginWithServer:       loginWithServer,
    logoutFromServer:      logoutFromServer,
    load:                  load,
    syncToServer:          syncToServer,
    syncNow:               syncNow,
    syncStatus:            syncStatus,
    getServerCampaignTurn: getServerCampaignTurn,
    resetSyncState:        resetSyncState,
    syncCampaignList:      syncCampaignList,
    mergeCampaignLists:    mergeCampaignLists, // exposed for the engine tests (UA20)
    resolveCas409:         resolveCas409,      // exposed for the engine tests (CAS self-heal)
    reconcileIdentityOk:   reconcileIdentityOk, // exposed for the engine tests (B7 identity guard)
    markPortraitDirty:     markPortraitDirty,
    fillPortraitsFromBlob: fillPortraitsFromBlob, // exposed for the engine tests (v1.170)
    listCharacterLibrary:            listCharacterLibrary,
    saveCharacterToLibrary:          saveCharacterToLibrary,
    deleteCharacterFromLibrary:      deleteCharacterFromLibrary,
    hasToken:              hasToken,             // "am I connected" without touching the token key (audit B9)
    speakerStarsPlan:      speakerStarsPlan,     // #95.5: exposed for the engine tests (pure decision core)
    syncSpeakerStars:      syncSpeakerStars,     // #95.5: star-bench cloud adopt/seed
    authHeader:            authHeader,           // #90: Authorization header for the tnd-tts app (the header, never the raw token)
    syncSizeWarnOnce:      syncSizeWarnOnce,     // v1.441: exposed for the engine tests (once-per-campaign sentinel gate)
    flushTooBigForKeepalive: flushTooBigForKeepalive, // JP0-11: the pure size gate (exposed for the engine tests)
    flushDirtyTurn:        flushDirtyTurn,       // JP0-11: the unsynced-flush marker — read
    clearFlushDirty:       clearFlushDirty,      // JP0-11: the unsynced-flush marker — clear (tests + campaign teardown)
    whoAmI:                whoAmI,
    fetchAccount:          fetchAccount,         // §3 gateway: account/entitlement readout → serverAccount global
    getCampaignState:      getCampaignState,
    pushCampaignState:     pushCampaignState,
    putCampaignPortrait:   putCampaignPortrait,
    listBlueprintLibrary:       listBlueprintLibrary,
    saveBlueprintToLibrary:     saveBlueprintToLibrary,
    deleteBlueprintFromLibrary: deleteBlueprintFromLibrary,
    deleteCampaignFromServer:   deleteCampaignFromServer
  };

})();
