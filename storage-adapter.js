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
      "ashen-auth",
      "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top
    );

    // Listen for postMessage from /auth/done
    function onMsg(e) {
      if (!e.data || e.data.type !== "ashen-auth") return;
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
    _syncing = true;
    var payload = JSON.stringify({
      worldState:  worldState,
      sessionLog:  sessionLog,
      memory:      memory
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
      if (!data || !data.worldState) return;
      var serverTurn = data.worldState.turn || 0;
      var localTurn  = (worldState && worldState.turn) || 0;
      if (serverTurn > localTurn) {
        worldState = data.worldState;
        sessionLog = data.sessionLog || [];
        memory     = data.memory || {
          npcs:{}, locations:{}, quests:{}, lore:[], keyDecisions:[],
          futureEvents:[], chapters:[], usedNames:[]
        };
        saveAll();
        syncUI();
        addMsg("system", "☁ State synced from server (turn " + serverTurn + ").");
      }
    }).catch(function(e) {
      console.warn("[storage] server load failed:", e.message);
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────

  // Auto-connect immediately (runs on script load)
  autoConnect();

  return {
    setServer:       setServer,
    isServerMode:    isServerMode,
    getServerUrl:    getServerUrl,
    loginWithServer: loginWithServer,
    logoutFromServer:logoutFromServer,
    load:            load,
    syncToServer:    syncToServer
  };

})();
