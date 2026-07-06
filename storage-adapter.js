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

  // ── Auto-connect on page load ───────────────────────────────────────────
  // If a saved server URL + token exist in localStorage, restore server mode.

  function autoConnect() {
    try {
      var url = localStorage.getItem(SERVER_URL_KEY);
      var tok = localStorage.getItem(SERVER_TOK_KEY);
      if (url && tok) {
        _serverUrl = url;
        _token     = tok;
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

  function loginWithServer(serverUrl, onSuccess) {
    if (_popup && !_popup.closed) { _popup.focus(); return; }

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
      serverUrl + "/auth/github",
      "tnd-auth",
      "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top
    );

    // Listen for postMessage from /auth/done (works on https origins)
    // AND poll /auth/ticket/:ticket as fallback for file:// origins
    var _ticket = null;
    var _pollInterval = null;

    function onAuth(sessionId, username, avatarUrl) {
      window.removeEventListener("message", onMsg);
      if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
      if (_popup && !_popup.closed) { try { _popup.close(); } catch(x) {} }
      _popup = null;
      setServer(serverUrl, sessionId);
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
        _popup = null;
        if (_ticket) {
          fetch(serverUrl + "/auth/ticket/" + _ticket)
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(d) { if (d && d.sessionId) onAuth(d.sessionId, d.username, d.avatarUrl); else if (_popupCb) { _popupCb("Login cancelled"); _popupCb = null; } })
            .catch(function() { if (_popupCb) { _popupCb("Login failed"); _popupCb = null; } });
        }
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
  var _notified401 = false;

  // Reset the per-campaign sync bookkeeping on a campaign switch (audit E32). These are module
  // globals: after switching FROM a higher-turn campaign, _lastAckTurn stayed high so
  // syncStatus().unsynced pinned at 0 (killing the #24 foreground self-heal), and switching the
  // other way showed a false "N turns unsynced" badge. Called from loadState (init + every switch).
  function resetSyncState() {
    _lastAckTurn = -1; _failCount = 0; _notified401 = false; _portraitSyncedOnce = false;
    _updateSyncUI();
  }

  function _syncOk(turnAt) {
    _failCount = 0; _notified401 = false;
    if (turnAt > _lastAckTurn) _lastAckTurn = turnAt;
    _updateSyncUI();
  }
  function _onSyncFail(msg, status) {
    _failCount++;
    console.warn("[storage] sync failed (" + _failCount + " consecutive): " + msg);
    if (typeof showToast === "function") {
      if (status === 401 && !_notified401) {
        _notified401 = true;
        showToast("&#9729; Session expired &mdash; reconnect via Dev Mode &#9656; Connect server");
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
      unsynced:    (_serverUrl && _lastAckTurn >= 0) ? Math.max(0, t - _lastAckTurn) : 0
    };
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

  function _syncNow(beacon) {
    if (!_serverUrl || typeof worldState === "undefined" || !worldState) return;
    if (_syncing && !beacon) { _pendingSync = true; return; }
    var campId = (typeof getActiveCampId === "function") ? getActiveCampId() : null;
    if (!beacon) { _syncing = true; _pendingSync = false; }
    var turnAt   = worldState.turn || 0; // the turn this payload carries — ACKed on 2xx
    // Keep the CURRENT PC's portrait INLINE in the state blob — it must stay atomic with the
    // state turn. Splitting it into the separate /portrait request (below) let it desync: after a
    // character swap the blob said "PC=X" while the separate store still held the old PC's image,
    // so a second device loaded the wrong portrait. (Companion charSheet portraits already ride in
    // the blob unstripped — the PC being the one thing split off was the bug.) Only NPC avatar
    // portraits (n.portrait) are stripped to the separate store, since campaigns can have many.
    var wsStripped = Object.assign({}, worldState, {
      npcs: (worldState.npcs||[]).map(function(n){
        return n.portrait ? Object.assign({}, n, {portrait:null}) : n;
      })
    });
    // narrativeHtml intentionally empty (audit #18): the story pane is rebuilt from
    // worldState.transcript on load — the DOM copy was the largest payload item and fully
    // derivable. Field kept (as "") so the server never sees an undefined key.
    var payload = JSON.stringify({
      worldState:    wsStripped,
      sessionLog:    sessionLog,
      memory:        memory,
      campaignId:    campId,
      narrativeHtml: ""
    });
    if (beacon) {
      // Fire-and-forget keepalive POST — no _syncing bookkeeping, no retry (the page is going away).
      try { fetch(_serverUrl + "/api/state", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+_token }, body:payload, keepalive:true }); } catch(e) {}
      return;
    }
    _tFetch(_serverUrl + "/api/state", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + _token },
      body:    payload
    }, SYNC_TIMEOUT_MS).then(function(r) {
      _syncing = false;
      if (!r.ok) { _onSyncFail("server returned " + r.status, r.status); }
      else {
        _syncOk(turnAt);
        if (_portraitDirty || !_portraitSyncedOnce) {
          _portraitSyncedOnce = true;
          syncPortrait(campId);
        }
      }
      if (_pendingSync) _syncNow();
    }).catch(function(e) {
      _syncing = false;
      _onSyncFail(e && e.name === "AbortError" ? "timed out after " + (SYNC_TIMEOUT_MS / 1000) + "s" : ((e && e.message) || "network error"), 0);
      if (_pendingSync) _syncNow();
    });
  }

  // ── Campaign list sync ──────────────────────────────────────────────────────

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
      // Merge server list into local: server wins on ID conflicts, local-only kept
      var local = [];
      try { var raw = localStorage.getItem("tnd_camps_v1"); if (raw) local = JSON.parse(raw); } catch(e) {}
      var merged = local.slice(), i, j, found;
      for (i = 0; i < serverList.length; i++) {
        serverList[i].onServer = true;
        found = false;
        for (j = 0; j < merged.length; j++) {
          if (merged[j].id === serverList[i].id) { merged[j] = Object.assign({}, merged[j], serverList[i], {onServer:true}); found = true; break; }
        }
        if (!found) merged.push(serverList[i]);
      }
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
      // Campaign-identity guard (audit E4): GET /api/state returns the user's most-recent state for
      // ANY campaign. If a DIFFERENT campaign is active locally, adopting this blob would silently
      // switch campaigns and stomp the active one. Reconcile only the SAME campaign; a fresh device
      // (no local active campaign / no server campId) still adopts, which is the intended first load.
      var _localActive = (typeof getActiveCampId === "function") ? getActiveCampId() : null;
      var _serverCamp  = data.campaignId || data.worldState.campId || null;
      if (_localActive && _serverCamp && _serverCamp !== _localActive) { syncCampaignList(null); return; }
      var serverTurn = data.worldState.turn || 0;
      var localTurn  = (worldState && worldState.turn) || 0;
      // The server provably holds serverTurn — seed the ACK baseline (#24). If local is
      // AHEAD (the dead-host scenario), unsynced = localTurn - serverTurn shows immediately.
      if (serverTurn > _lastAckTurn) _lastAckTurn = serverTurn;
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
        // record. Old blobs without a transcript fall back to their stored narrativeHtml.
        var _rebuilt = false;
        try { if (typeof rebuildNarrativeFromTranscript === "function") _rebuilt = rebuildNarrativeFromTranscript(20, true); } catch(e) {}
        if (!_rebuilt && data.narrativeHtml) {
          try {
            var _ne2 = document.getElementById("story-narrative");
            if (_ne2) { _ne2.innerHTML = data.narrativeHtml; _ne2.scrollTop = _ne2.scrollHeight; }
          } catch(e) {}
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

  // ── Character library ────────────────────────────────────────────────────

  function listCharLibrary(cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    // _tFetch (audit E77): a dead/waking host used to hang these modals for minutes — the #24 mode.
    _tFetch(_serverUrl + "/api/characters", {
      headers: { "Authorization": "Bearer " + _token }
    }, SYNC_TIMEOUT_MS).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  function saveCharToLibrary(char, cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    _tFetch(_serverUrl + "/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + _token },
      body: JSON.stringify({ character: char })
    }, SYNC_TIMEOUT_MS).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  function deleteCharFromLibrary(slug, cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    _tFetch(_serverUrl + "/api/characters/" + encodeURIComponent(slug), {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + _token }
    }, SYNC_TIMEOUT_MS).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  // ── Blueprint library ────────────────────────────────────────────────────

  function listBlueprintLibrary(cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    _tFetch(_serverUrl + "/api/blueprints", {
      headers: { "Authorization": "Bearer " + _token }
    }, SYNC_TIMEOUT_MS).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  function saveBlueprintToLibrary(bp, cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    _tFetch(_serverUrl + "/api/blueprints", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + _token },
      body: JSON.stringify({ blueprint: bp })
    }, SYNC_TIMEOUT_MS).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  function deleteBlueprintFromLibrary(slug, cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    _tFetch(_serverUrl + "/api/blueprints/" + encodeURIComponent(slug), {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + _token }
    }, SYNC_TIMEOUT_MS).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  function deleteCampaignFromServer(id, cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    _tFetch(_serverUrl + "/api/campaigns/" + encodeURIComponent(id), {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + _token }
    }, SYNC_TIMEOUT_MS).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { console.warn("[storage] campaign delete failed:", e.message); if (cb) cb(e.message); });
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
    resetSyncState:        resetSyncState,
    syncCampaignList:      syncCampaignList,
    markPortraitDirty:     markPortraitDirty,
    fillPortraitsFromBlob: fillPortraitsFromBlob, // exposed for the engine tests (v1.170)
    listCharLibrary:            listCharLibrary,
    saveCharToLibrary:          saveCharToLibrary,
    deleteCharFromLibrary:      deleteCharFromLibrary,
    listBlueprintLibrary:       listBlueprintLibrary,
    saveBlueprintToLibrary:     saveBlueprintToLibrary,
    deleteBlueprintFromLibrary: deleteBlueprintFromLibrary,
    deleteCampaignFromServer:   deleteCampaignFromServer
  };

})();
