// Model-specific voice controls. The optional cast tab owns no campaign data.
var VoiceSettings = (function() {
  var activeClose = null;
  var TABS = { settings: { label: "Voice & performance", render: renderSettings }, cast: { label: "Manage Cast", render: renderCast } };
  var LANG = { "": "Detect from text", "en-US": "English", "ko-KR": "Korean" };
  function e(v) { return escHtml(String(v == null ? "" : v)); }
  function option(id, label, selected) { return "<option value='" + e(id) + "'" + (id === selected ? " selected" : "") + ">" + e(label) + "</option>"; }
  function field(id, label, html) { return "<div class='tts-field'><label for='" + id + "'>" + label + "</label>" + html + "</div>"; }
  function select(id, values, current, labels) { return "<select id='" + id + "'>" + values.map(function(v) { return option(v, labels ? labels[v] : v || "Natural", current); }).join("") + "</select>"; }
  function actorLabel(v, compact) { return v.label + (v.g ? " · " + (v.g === "M" ? "Male" : "Female") : " · Unspecified") + (!compact && v.note ? " · " + v.note : ""); }
  function matchesActor(v, query) { query = query.trim().toLowerCase(); if (query === "male") return v.g === "M"; if (query === "female") return v.g === "F"; return actorLabel(v).toLowerCase().indexOf(query) >= 0; }
  function actors(ctx, selected, automatic, compact) {
    var html = automatic ? option("", "Automatic", selected) : "";
    var list = ctx.catalog();
    if (!automatic && !list.length) html += option("", "Load voices to choose an actor", "");
    if (compact) {
      var query = (ctx.castQuery || "").toLowerCase(), chosen = list.filter(function(v) { return v.id === selected; })[0];
      list = list.filter(function(v) { return !query || matchesActor(v, query); }).slice(0, 100);
      if (chosen && !list.some(function(v) { return v.id === selected; })) list.push(chosen);
    }
    list.forEach(function(v) { html += option(v.id, actorLabel(v, ctx.model().compactActors), selected); });
    if (selected && !list.some(function(v) { return v.id === selected; })) html += option(selected, selected + " · saved voice", selected);
    return html;
  }
  function renderSettings(ctx) {
    var m = ctx.model(), c = ctx.config(), html = "";
    if (m.key) {
      var key = ctx.d.keys[ctx.id], saved = ctx.initial.keys[ctx.id];
      html += "<div class='tts-connection'><span>" + (key ? (key === saved ? "API key saved" : "API key staged — Save to keep") : "API key needed") + "</span>";
      if (key) html += "<button id='tts-key-change' class='tts-link' type='button'>Change key</button>";
      html += "</div>" + "<div id='tts-key-wrap'" + (key ? " hidden" : "") + ">" + field("tts-api-key", m.label.split(" · ")[0] + " API key", "<input id='tts-api-key' type='password' autocomplete='off' spellcheck='false' placeholder='Paste API key' value='" + e(key === saved ? "" : key) + "'/>") + "<p class='tts-help'>" + (m.auth === "Basic" ? "Paste the encoded API key from Inworld, without the Basic prefix." : "Stored on this device, like your existing API keys.") + "</p></div>";
    }
    html += "<p class='tts-help'>" + e(m.note) + "</p>";
    if (m.catalogUrl) html += "<div class='tts-load'><button id='tts-load-voices' type='button'>Load / refresh voices</button><span id='tts-catalog-status' role='status'>" + ctx.catalog().length + " actors loaded</span></div>";
    if (ctx.catalog().length > 30) html += field("tts-actor-search", "Find a narrator", "<input id='tts-actor-search' type='search' placeholder='Name, gender or description'/>");
    html += field("tts-narrator", "Narrator voice", "<select id='tts-narrator'>" + actors(ctx, c.narrator, false) + "</select>");
    html += "<p id='tts-actor-note' class='tts-help'></p>";
    if (m.languages.length > 1) html += field("tts-language", "Speech language", select("tts-language", m.languages, c.language, LANG));
    else html += "<p class='tts-help'>Language: " + (m.languages[0] ? e(LANG[m.languages[0]]) : "detected from text / selected voice") + "</p>";
    if (m.direction) html += field("tts-direction", "Delivery direction" + (ctx.id === "inworld" ? " (write in English)" : ""), "<textarea id='tts-direction' rows='2' maxlength='1200'>" + e(c.direction) + "</textarea>");
    if (m.delivery) html += field("tts-delivery", "Performance variation", select("tts-delivery", m.delivery, c.delivery, { STABLE: "Stable · consistent reading", BALANCED: "Balanced", CREATIVE: "Creative · more variation" }));
    if (m.emotions) html += field("tts-emotion", "Emotion", select("tts-emotion", m.emotions, c.emotion));
    if (m.rate) html += field("tts-speed", "Speech rate <span id='tts-speed-value'>" + Number(c.rate).toFixed(2) + "×</span>", "<input id='tts-speed' type='range' min='0.8' max='1.3' step='0.05' value='" + c.rate + "'/>");
    ctx.panel.innerHTML = html;
    ctx.bind("tts-api-key", "input", function(el) { if (el.value.trim()) ctx.d.keys[ctx.id] = el.value.trim().replace(/^(Bearer|Basic)\s+/i, ""); });
    ctx.bind("tts-key-change", "click", function() { ctx.el("tts-key-wrap").hidden = false; ctx.el("tts-api-key").focus(); });
    ctx.bind("tts-load-voices", "click", function() { ctx.load(); });
    ctx.bind("tts-actor-search", "input", function(el) { var query = el.value.toLowerCase(), list = ctx.catalog().filter(function(v) { return v.id === c.narrator || matchesActor(v, query); }); ctx.el("tts-narrator").innerHTML = list.map(function(v) { return option(v.id, actorLabel(v, ctx.model().compactActors), c.narrator); }).join(""); });
    ctx.bind("tts-narrator", "change", function(el) { c.narrator = el.value; describe(); });
    ctx.bind("tts-language", "change", function(el) { c.language = el.value; });
    ctx.bind("tts-direction", "input", function(el) { c.direction = el.value; });
    ctx.bind("tts-delivery", "change", function(el) { c.delivery = el.value; });
    ctx.bind("tts-emotion", "change", function(el) { c.emotion = el.value; });
    ctx.bind("tts-speed", "input", function(el) { c.rate = Number(el.value); ctx.el("tts-speed-value").textContent = c.rate.toFixed(2) + "×"; });
    function describe() { var v = ctx.catalog().filter(function(a) { return a.id === c.narrator; })[0]; ctx.el("tts-actor-note").textContent = v ? actorLabel(v) : ""; }
    describe();
  }
  // Remove the cast entry in TABS to retire this surface. The sheet's stable voice IDs
  // remain authoritative; these device-local actor overrides never rewrite the campaign.
  function renderCast(ctx) {
    ctx.castQuery = "";
    if (!ctx.model().key) { ctx.panel.innerHTML = "<p class='tts-help'>Piper and device casting use the existing character-sheet voices. Select a cloud model above to audition and assign its actors to cast slots.</p>"; return; }
    var c = ctx.config(), slots = ctx.S.castSlots();
    var html = "<p class='tts-help'>Choose an actor for each existing cast slot. Automatic casting prefers matching gender. Characters sharing a cast voice share its actor. Assignments are saved separately for each model on this device.</p>";
    if (!ctx.catalog().length) { ctx.panel.innerHTML = html + "<p>Load the actor catalog in Voice & performance first.</p>"; return; }
    if (ctx.catalog().length > 100) html += field("tts-cast-search", "Find cast actors (up to 100 matches shown)", "<input id='tts-cast-search' type='search' placeholder='Name, gender or description'/>");
    if (!slots.length) html += "<p>No cast slots yet. Assign a character-sheet voice or star voices in the voice picker.</p>";
    slots.forEach(function(s, i) {
      var chosen = c.cast[s.id] || "", actual = ctx.S.actor(ctx.id, s.id, c), v = ctx.catalog().filter(function(a) { return a.id === actual; })[0];
      html += "<div class='tts-cast-row'>" + field("tts-cast-" + i, e(s.label), "<select id='tts-cast-" + i + "'>" + actors(ctx, chosen, true, true) + "</select>")
        + "<div class='tts-cast-meta'><span>" + e((s.assigned.length ? s.assigned.join(", ") : "Available cast slot") + " · " + (v ? v.label : actual)) + "</span><button type='button' id='tts-cast-test-" + i + "'>Test actor</button></div></div>";
    });
    ctx.panel.innerHTML = html;
    ctx.bind("tts-cast-search", "input", function(el) { ctx.castQuery = el.value; slots.forEach(function(s, i) { ctx.el("tts-cast-" + i).innerHTML = actors(ctx, c.cast[s.id] || "", true, true); }); });
    slots.forEach(function(s, i) {
      ctx.bind("tts-cast-" + i, "change", function(el) { if (el.value) c.cast[s.id] = el.value; else delete c.cast[s.id]; });
      ctx.bind("tts-cast-test-" + i, "click", function() { ctx.test(ctx.S.actor(ctx.id, s.id, c)); });
    });
  }
  function show() {
    if (activeClose) activeClose();
    var S = TTS.settings, draft = S.draft(), initial = S.draft(), tab = "settings", closed = false, generation = 0, catalogCtrl = null, ticker = null, catalogTicker = null, ownsAudio = false;
    var previousFocus = document.activeElement;
    var style = "<style>#tts-modal .tts-main{overflow-y:auto;min-height:0;padding:4px 0 14px}#tts-modal .tts-field{margin:12px 0}#tts-modal label{display:block;color:var(--t1);font-size:12px;margin-bottom:6px}#tts-modal input:not([type=range]),#tts-modal select,#tts-modal textarea{width:100%;min-width:0;box-sizing:border-box;background:var(--bg2);color:var(--t0);border:1px solid var(--brd);border-radius:5px;padding:10px;font:inherit;font-size:13px}#tts-modal select{height:42px;text-overflow:ellipsis}#tts-modal textarea{resize:vertical;line-height:1.5}#tts-modal input[type=range]{width:100%;accent-color:var(--acc);height:26px}#tts-modal button{min-height:38px;padding:7px 12px;border:1px solid var(--brd);border-radius:5px;background:var(--bg2);color:var(--t0);cursor:pointer;font:inherit;font-size:12px}#tts-modal button:hover{border-color:var(--acc)}#tts-modal button:focus-visible,#tts-modal select:focus-visible,#tts-modal textarea:focus-visible,#tts-modal input:focus-visible{outline:2px solid var(--acc);outline-offset:2px}#tts-modal .tts-help{color:var(--t2);font-size:12px;line-height:1.55;margin:8px 0}#tts-modal .tts-head,#tts-modal .tts-connection,#tts-modal .tts-load,#tts-modal .tts-cast-meta,#tts-modal .tts-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}#tts-modal .tts-head h2{font-size:17px;margin:0}#tts-modal .tts-tabs{display:flex;border-bottom:1px solid var(--brd);gap:16px;margin-top:4px}#tts-modal .tts-tabs button{border:0;border-bottom:2px solid transparent;border-radius:0;background:none;padding:10px 0;color:var(--t2)}#tts-modal .tts-tabs button[aria-selected=true]{border-bottom-color:var(--acc);color:var(--acc)}#tts-modal .tts-connection{font-size:12px;margin-top:12px;color:var(--t1)}#tts-modal button.tts-link{border:0;background:none;color:var(--acc)}#tts-modal .tts-load{font-size:11px;color:var(--t2);flex-wrap:wrap}#tts-modal .tts-cast-row{border-bottom:1px solid var(--brd);padding-bottom:12px}#tts-modal .tts-cast-meta{font-size:11px;color:var(--t2)}#tts-modal .tts-cast-meta span{min-width:0;overflow-wrap:anywhere}#tts-modal .tts-cast-meta button{flex-shrink:0}#tts-modal details{border-top:1px solid var(--brd);margin-top:18px;padding-top:14px}#tts-modal summary{cursor:pointer;font-size:12px;color:var(--t2)}#tts-modal .tts-actions{padding-top:14px;border-top:1px solid var(--brd)}#tts-modal #tts-save-btn{background:var(--acc);color:var(--on-acc,#111);font-weight:bold;flex:1}#tts-modal #tts-status{font-size:12px;color:var(--acc);line-height:1.4;margin:8px 0;overflow-wrap:anywhere}#tts-modal [hidden]{display:none!important}#tts-modal .tts-test-buttons{display:flex;align-items:center;gap:8px}#tts-modal #tts-test-status{font-size:12px;color:var(--t2)}@media(max-width:500px){#tts-modal{padding:10px!important}#tts-modal>div{padding:16px!important;max-height:calc(100dvh - 20px)!important}#tts-modal button{min-height:44px}#tts-modal .tts-tabs{gap:18px}}</style>";
    var html = style + "<div class='tts-head'><h2>Voice Settings</h2><button id='tts-modal-x' aria-label='Close voice settings' type='button'>×</button></div>"
      + field("tts-model", "Primary voice model", "<select id='tts-model'>" + Object.keys(S.models).map(function(id) { return option(id, S.models[id].label, draft.primary); }).join("") + "</select>")
      + "<p class='tts-help' style='margin:0 0 8px'>Changes apply to gameplay only after Save.</p><div class='tts-tabs' role='tablist' aria-label='Voice settings tabs'>"
      + Object.keys(TABS).map(function(id) { return "<button type='button' id='tts-tab-" + id + "' role='tab' aria-selected='" + (id === tab) + "' aria-controls='tts-tab-panel' tabindex='" + (id === tab ? "0" : "-1") + "'>" + TABS[id].label + "</button>"; }).join("")
      + "</div><div class='tts-main'><div id='tts-tab-panel' role='tabpanel' aria-labelledby='tts-tab-settings'></div>"
      + "<div id='tts-audition'>" + field("tts-test-text", "Test passage", "<textarea id='tts-test-text' rows='3' maxlength='1000'>" + e(S.sample) + "</textarea>")
      + "<div class='tts-test-buttons'><button type='button' id='tts-test-btn'>▶ Test narrator</button><button type='button' id='tts-stop-btn'>Stop</button><span id='tts-test-status' role='status'></span></div><p id='tts-test-billing' class='tts-help'></p></div>"
      + "<details id='tts-advanced'><summary>Advanced · fallback & diagnostics</summary>" + field("tts-fallback-piper", "Piper fallback voice", "<select id='tts-fallback-piper'>" + S.piperOptions() + "</select>")
      + field("tts-fallback-native", "Device fallback voice", "<select id='tts-fallback-native'>" + S.nativeOptions() + "</select>")
      + "<p class='tts-help'>A failed cloud read falls back to local voices. It never switches to another paid service.</p><p id='tts-audio-diag' class='tts-help'></p><p id='tts-server-line' class='tts-help'></p><p id='tts-piper-err' class='tts-help'></p><p id='tts-piper-runtime' class='tts-help'></p></details></div>"
      + "<div id='tts-status' role='alert'></div><div class='tts-actions'><button type='button' id='tts-cancel-btn'>Cancel</button><button type='button' id='tts-save-btn'>Save</button></div>";
    var modal = modalShell("tts-modal", html, { maxWidth: 570, boxPad: "22px", boxExtra: "display:flex;flex-direction:column;max-height:calc(100dvh - 40px);box-sizing:border-box;", closeId: "tts-modal-x", outside: true, onClose: close });
    function el(id) { return modal.querySelector("#" + id); }
    function bind(id, event, fn) { var node = el(id); if (node) node.addEventListener(event, function() { fn(node); }); }
    function cancelCatalog() { generation++; if (catalogCtrl) catalogCtrl.abort(); catalogCtrl = null; if (catalogTicker) catalogTicker.stop(); catalogTicker = null; }
    function stopTest() { if (ownsAudio) TTS.stop(); ownsAudio = false; if (ticker) ticker.stop(); ticker = null; el("tts-test-status").textContent = ""; }
    function close() { if (closed) return; closed = true; cancelCatalog(); stopTest(); clearInterval(diagPoll); modal.remove(); activeClose = null; if (previousFocus && previousFocus.isConnected) previousFocus.focus(); }
    activeClose = close;
    var ctx = { S: S, d: draft, initial: initial, id: draft.primary, panel: el("tts-tab-panel"), el: el, bind: bind,
      catalog: function() { return ctx.actorList; }, model: function() { return S.models[ctx.id]; }, config: function() { return draft.models[ctx.id]; },
      test: function(actor) {
        stopTest(); el("tts-status").textContent = "";
        try { ownsAudio = true; S.test(draft, el("tts-test-text").value, actor, function(phase) {
          if (ticker) ticker.stop(); ticker = null;
          if (closed) return;
          if (phase === "loading") ticker = elapsedTicker(el("tts-test-status"), "Preparing", { text: true });
          else { el("tts-test-status").textContent = phase === "playing" ? "Playing" : ""; if (phase === "idle") ownsAudio = false; }
        }); } catch (err) { ownsAudio = false; el("tts-status").textContent = err.message; console.warn("[tts settings] " + err.message); }
      },
      load: function() {
        cancelCatalog(); var token = generation, id = ctx.id, key = draft.keys[id].trim(), c = ctx.config();
        if (!key) { el("tts-status").textContent = "Enter an API key before loading voices."; return; }
        var btn = el("tts-load-voices"); btn.disabled = true; el("tts-status").textContent = "";
        catalogTicker = elapsedTicker(el("tts-catalog-status"), "Loading actors", { text: true });
        S.loadCatalog(id, key, function(ctrl) { catalogCtrl = ctrl; if (closed || token !== generation) ctrl.abort(); }).then(function(list) {
          if (closed || token !== generation) return;
          c.voices = list; if (!list.some(function(v) { return v.id === c.narrator; })) c.narrator = list[0].id;
          cancelCatalog(); paint(); el("tts-status").textContent = list.length + " actors loaded. Save to keep this catalog and key.";
        }, function(err) { if (closed || token !== generation) return; cancelCatalog(); btn.disabled = false; el("tts-catalog-status").textContent = "Load failed"; el("tts-status").textContent = "Could not load actors: " + err.message; console.warn("[tts settings] " + err.message); });
      }
    };
    function paint() {
      ctx.actorList = S.catalog(ctx.id, ctx.config());
      TABS[tab].render(ctx); el("tts-tab-panel").setAttribute("aria-labelledby", "tts-tab-" + tab);
      Object.keys(TABS).forEach(function(id) { el("tts-tab-" + id).setAttribute("aria-selected", String(id === tab)); el("tts-tab-" + id).tabIndex = id === tab ? 0 : -1; });
      el("tts-test-btn").hidden = tab !== "settings";
      el("tts-test-billing").textContent = ctx.model().key ? "Test auditions the unsaved settings and bills the selected service's API key." : "Test auditions the unsaved settings.";
    }
    bind("tts-model", "change", function(node) { cancelCatalog(); stopTest(); draft.primary = node.value; ctx.id = node.value; el("tts-status").textContent = ""; paint(); });
    Object.keys(TABS).forEach(function(id) {
      bind("tts-tab-" + id, "click", function() { cancelCatalog(); stopTest(); tab = id; paint(); });
      el("tts-tab-" + id).addEventListener("keydown", function(ev) { if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return; ev.preventDefault(); var keys = Object.keys(TABS), ix = keys.indexOf(id), next = keys[(ix + (ev.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length]; el("tts-tab-" + next).click(); el("tts-tab-" + next).focus(); });
    });
    bind("tts-fallback-piper", "change", function(node) { draft.fallback.piper = node.value; draft.models.local.narrator = node.value; });
    bind("tts-fallback-native", "change", function(node) { draft.fallback.native = node.value; draft.models.native.narrator = node.value; });
    bind("tts-test-btn", "click", function() { ctx.test(""); }); bind("tts-stop-btn", "click", stopTest); bind("tts-cancel-btn", "click", close);
    bind("tts-save-btn", "click", function() { try { S.save(draft); close(); showToast("Voice settings saved.", 2500); } catch (err) { el("tts-status").textContent = err.message; console.warn("[tts settings] " + err.message); } });
    modal.addEventListener("keydown", function(ev) {
      if (ev.key === "Escape") { ev.preventDefault(); close(); }
      if (ev.key === "Tab") { var nodes = Array.prototype.filter.call(modal.querySelectorAll("button,input,select,textarea,summary"), function(n) { return !n.disabled && n.tabIndex !== -1 && n.getClientRects().length; }); var first = nodes[0], last = nodes[nodes.length - 1]; if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); } }
    });
    function diag() { if (closed || !modal.isConnected) { clearInterval(diagPoll); return; } el("tts-audio-diag").textContent = S.diagnostics(); }
    var diagPoll = setInterval(diag, 1000); diag(); S.refreshDiagnostics(); paint(); el("tts-model").focus();
    return modal;
  }
  return { show: show };
})();
