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
    // Authorization header logout was client-side amnesia only (audit #25).
    fetch(url + "/auth/logout", { method: "POST", headers: tok ? { "Authorization": "Bearer " + tok } : {} })
      .catch(function() {})
      .then(function() { if (cb) cb(); });
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

  function syncNow() {
    if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
    _syncNow();
  }

  function _syncNow() {
    if (!_serverUrl || typeof worldState === "undefined" || !worldState) return;
    if (_syncing) { _pendingSync = true; return; }
    var campId = (typeof getActiveCampId === "function") ? getActiveCampId() : null;
    _syncing     = true;
    _pendingSync = false;
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
    if (sws.character && sws.character.portrait && worldState.character && !worldState.character.portrait) {
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

    fetch(_serverUrl + "/api/state", {
      headers: { "Authorization": "Bearer " + _token }
    }).then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function(data) {
      if (!data || !data.worldState) {
        syncCampaignList(null);
        return;
      }
      var serverTurn = data.worldState.turn || 0;
      var localTurn  = (worldState && worldState.turn) || 0;
      // The server provably holds serverTurn — seed the ACK baseline (#24). If local is
      // AHEAD (the dead-host scenario), unsynced = localTurn - serverTurn shows immediately.
      if (serverTurn > _lastAckTurn) _lastAckTurn = serverTurn;
      _updateSyncUI();
      if (serverTurn > localTurn) {
        var wasFresh = !localOk;
        worldState = data.worldState;
        // Restore the authoritative campaign ID from the server before saveAll()
        // fires — without this, getActiveCampId() returns null and syncToServer()
        // generates a new timestamp-based ID, creating a duplicate campaign record.
        var _scid = data.campaignId || (worldState && worldState.campId);
        if (_scid) { if (typeof setActiveCampId === "function") setActiveCampId(_scid); worldState.campId = _scid; }
        sessionLog = data.sessionLog || [];
        memory     = data.memory || blankMemory();
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
          var spc = data.worldState.character && data.worldState.character.portrait;
          if ((spc || data.portrait) && worldState.character) worldState.character.portrait = spc || data.portrait;
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
      console.warn("[storage] server load failed:", e.message);
    });
  }

  // ── Character library ────────────────────────────────────────────────────

  function listCharLibrary(cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    fetch(_serverUrl + "/api/characters", {
      headers: { "Authorization": "Bearer " + _token }
    }).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  function saveCharToLibrary(char, cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    fetch(_serverUrl + "/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + _token },
      body: JSON.stringify({ character: char })
    }).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  function deleteCharFromLibrary(slug, cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    fetch(_serverUrl + "/api/characters/" + encodeURIComponent(slug), {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + _token }
    }).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  // ── Blueprint library ────────────────────────────────────────────────────

  function listBlueprintLibrary(cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    fetch(_serverUrl + "/api/blueprints", {
      headers: { "Authorization": "Bearer " + _token }
    }).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  function saveBlueprintToLibrary(bp, cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    fetch(_serverUrl + "/api/blueprints", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + _token },
      body: JSON.stringify({ blueprint: bp })
    }).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  function deleteBlueprintFromLibrary(slug, cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    fetch(_serverUrl + "/api/blueprints/" + encodeURIComponent(slug), {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + _token }
    }).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d) { if (cb) cb(null, d); })
      .catch(function(e) { if (cb) cb(e.message); });
  }

  function deleteCampaignFromServer(id, cb) {
    if (!_serverUrl || !_token) { if (cb) cb("Not connected"); return; }
    fetch(_serverUrl + "/api/campaigns/" + encodeURIComponent(id), {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + _token }
    }).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
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
