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

  var SERVER_URL_KEY = "ashen_server_url_v1";
  var SERVER_TOK_KEY = "ashen_server_tok_v1";

  var _serverUrl = null;   // null = local mode
  var _token     = null;
  var _syncing   = false;
  var _popup     = null;
  var _popupCb   = null;

  // ── Auto-connect on page load ───────────────────────────────────────────
  // If a saved server URL + token exist in sessionStorage, restore server mode.

  function autoConnect() {
    try {
      var url = sessionStorage.getItem(SERVER_URL_KEY);
      var tok = sessionStorage.getItem(SERVER_TOK_KEY);
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
        sessionStorage.setItem(SERVER_URL_KEY, _serverUrl);
        sessionStorage.setItem(SERVER_TOK_KEY, _token);
      } else {
        sessionStorage.removeItem(SERVER_URL_KEY);
        sessionStorage.removeItem(SERVER_TOK_KEY);
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
      "ashen-auth",
      "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top
    );

    // Listen for postMessage from /auth/done
    function onMsg(e) {
      if (!e.data || e.data.type !== "ashen-auth") return;
      if (e.origin !== serverUrl) return;
      window.removeEventListener("message", onMsg);
      if (_popup && !_popup.closed) { try { _popup.close(); } catch(x) {} }
      _popup = null;

      setServer(serverUrl, e.data.sessionId);
      if (typeof _popupCb === "function") {
        _popupCb(null, { username: e.data.username, avatarUrl: e.data.avatarUrl });
        _popupCb = null;
      }
    }
    window.addEventListener("message", onMsg);
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
    fetch(_serverUrl + "/api/campaigns", {
      headers: { "Authorization": "Bearer " + _token }
    }).then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function(serverList) {
      if (!Array.isArray(serverList)) { if (cb) cb(null); return; }
      // Merge server list into local: server wins on ID conflicts, local-only kept
      var local = [];
      try { var raw = localStorage.getItem("ashen_camps_v1"); if (raw) local = JSON.parse(raw); } catch(e) {}
      var merged = local.slice(), i, j, found;
      for (i = 0; i < serverList.length; i++) {
        serverList[i].onServer = true;
        found = false;
        for (j = 0; j < merged.length; j++) {
          if (merged[j].id === serverList[i].id) { merged[j] = Object.assign({}, merged[j], serverList[i], {onServer:true}); found = true; break; }
        }
        if (!found) merged.push(serverList[i]);
      }
      try { localStorage.setItem("ashen_camps_v1", JSON.stringify(merged)); } catch(e) {}
      if (cb) cb(merged);
    }).catch(function(e) {
      console.warn("[storage] campaign list sync failed:", e.message);
      if (cb) cb(null);
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
