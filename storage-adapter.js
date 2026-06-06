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

  var _serverUrl = null;   // null = local mode
  var _token     = null;
  var _syncing   = false;
  var _popup     = null;
  var _popupCb   = null;

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
    var url = _serverUrl;
    setServer(null, null);   // clear local state immediately
    if (!url) { if (cb) cb(); return; }
    fetch(url + "/auth/logout", { method: "POST" })
      .catch(function() {})
      .then(function() { if (cb) cb(); });
  }

  // ── Write-through sync (fire-and-forget) ────────────────────────────────

  function syncToServer() {
    if (!_serverUrl || _syncing || typeof worldState === "undefined" || !worldState) return;
    var campId = (typeof getActiveCampId === "function") ? getActiveCampId() : null;
    _syncing = true;
    // Strip portraits from sync payload — they are large base64 blobs stored locally only
    var wsStripped = Object.assign({}, worldState, {
      character: Object.assign({}, worldState.character, {portrait: null}),
      npcs: (worldState.npcs||[]).map(function(n){
        return n.portrait ? Object.assign({}, n, {portrait:null}) : n;
      })
    });
    var payload = JSON.stringify({
      worldState:  wsStripped,
      sessionLog:  sessionLog,
      memory:      memory,
      campaignId:  campId
    });
    fetch(_serverUrl + "/api/state", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + _token
      },
      body: payload
    }).then(function(r) {
      _syncing = false;
      if (!r.ok) console.warn("[storage] server sync returned", r.status);
    }).catch(function(e) {
      _syncing = false;
      console.warn("[storage] server sync failed:", e.message);
    });
  }

  // ── Campaign list sync ──────────────────────────────────────────────────────

  function syncCampaignList(cb) {
    if (!_serverUrl || !_token) { if (cb) cb(null); return; }
    var _fired = false;
    function done(result) { if (!_fired) { _fired = true; if (cb) cb(result); } }
    var _tid = setTimeout(function() {
      console.warn("[storage] campaign list sync timed out");
      done(null);
    }, 60000);
    fetch(_serverUrl + "/api/campaigns", {
      headers: { "Authorization": "Bearer " + _token }
    }).then(function(r) {
      clearTimeout(_tid);
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
      clearTimeout(_tid);
      console.warn("[storage] campaign list sync failed:", e.message);
      done(null);
    });
  }

  // ── Load ────────────────────────────────────────────────────────────────

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
      if (serverTurn > localTurn) {
        var wasFresh = !localOk;
        worldState = data.worldState;
        sessionLog = data.sessionLog || [];
        memory     = data.memory || {
          npcs:{}, locations:{}, quests:{}, lore:[], keyDecisions:[],
          futureEvents:[], chapters:[], usedNames:[]
        };
        saveAll();
        if (wasFresh && typeof showGame === "function") {
          showGame();
          if (typeof initAbilities === "function") initAbilities();
          if (typeof initSpells    === "function") initSpells();
        }
        syncUI();
        addMsg("system", "☁ State synced from server (turn " + serverTurn + ").");
      }
      syncCampaignList(null);
    }).catch(function(e) {
      console.warn("[storage] server load failed:", e.message);
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────

  // Auto-connect immediately (runs on script load)
  autoConnect();

  return {
    setServer:        setServer,
    isServerMode:     isServerMode,
    getServerUrl:     getServerUrl,
    loginWithServer:  loginWithServer,
    logoutFromServer: logoutFromServer,
    load:             load,
    syncToServer:     syncToServer,
    syncCampaignList: syncCampaignList
  };

})();
