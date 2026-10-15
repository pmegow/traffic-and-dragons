// conversation.js — THE ENGINE: a conversation with a model, kept small enough to carry. PORTABLE (dev/run-tests.js runs the seam
// scan over it with the game's platform list): this file names nothing but what it declares and the ECMAScript builtins. It
// knows NOTHING about Gemini, the DOM, storage or the car — the ADAPTER is where the network is, the HOST is where the car is.
//
//   var conv = Conversation.create({ persona: "<system block>", adapter: { ask: function(system, messages) → Promise<string> }, window: 12 });
//   conv.reply(text)        → Promise<string>  the model's line for this heard line; the exchange is kept only once it arrives
//   conv.transcript()       → [{ user, assistant }]  the kept exchanges, oldest first (a copy)
//   conv.reset()            forget every exchange (the persona stays)
//   conv.persona(text)      swap the persona block; with no argument, read it
//
// The persona is a system block — a STRING the host hands in (car-talk: persona.js; the game, later: a character's own block —
// who they are, what they know, how they speak, what they must not do). Spoken-reply discipline (two sentences, no lists) lives
// in that text, never here. The adapter sees persona + the kept exchanges + the new line as
//   ask(system, [{ role: "user" | "assistant", text }, …])
// and resolves the reply text. A failed call REJECTS with an Error whose message says why — the adapter's own reason (timeout,
// an HTTP status, a quota sentence), "empty reply", "no adapter" — and never resolves to a fabricated line: the host decides what
// the car says then. A rejected line is NOT kept, so a retry resends it against the same history. Calls are serialized: a reply
// asked while one is pending waits for it and sees it in the history.
var Conversation = (function() {
  var CONVERSATION_WINDOW_DEFAULT = 12;   // exchanges (a heard line + its reply) kept and resent; the oldest is dropped past this

  function _clean(text) { return String(text == null ? "" : text).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, ""); }

  function create(opts) {
    opts = opts || {};
    var _persona = String(opts.persona == null ? "" : opts.persona);
    var _adapter = opts.adapter || null;
    var _window = (typeof opts.window === "number" && isFinite(opts.window) && opts.window >= 0) ? Math.floor(opts.window) : CONVERSATION_WINDOW_DEFAULT;
    var _kept = [];                    // [{ user, assistant }] oldest first, at most _window long
    var _chain = Promise.resolve();    // the serializer: each reply waits for the one before it

    function _messages(line) {
      var out = [], i;
      for (i = 0; i < _kept.length; i++) {
        out.push({ role: "user", text: _kept[i].user });
        out.push({ role: "assistant", text: _kept[i].assistant });
      }
      out.push({ role: "user", text: line });
      return out;
    }
    function _keep(user, assistant) {
      _kept.push({ user: user, assistant: assistant });
      while (_kept.length > _window) _kept.shift();
    }

    // One round trip: the kept exchanges plus this line go through the adapter; the exchange is kept only once the reply is in.
    function _send(line) {
      if (!line) return Promise.reject(new Error("empty line — nothing to send"));
      if (!_adapter || typeof _adapter.ask !== "function") return Promise.reject(new Error("no adapter — nothing can answer"));
      var p;
      try { p = _adapter.ask(_persona, _messages(line)); }
      catch (e) { return Promise.reject((e && e.message) ? e : new Error("adapter threw: " + e)); }
      return Promise.resolve(p).then(function(text) {
        var reply = _clean(text);
        if (!reply) throw new Error("empty reply — the model sent no text");
        _keep(line, reply);
        return reply;
      });
    }

    function reply(text) {
      var line = _clean(text);
      var p = _chain.then(function() { return _send(line); });
      _chain = p.then(function() {}, function() {});   // a failure never breaks the chain for the next line
      return p;
    }
    function transcript() {
      var out = [], i;
      for (i = 0; i < _kept.length; i++) out.push({ user: _kept[i].user, assistant: _kept[i].assistant });
      return out;
    }
    function reset() { _kept = []; }
    function persona(text) {
      if (arguments.length) _persona = String(text == null ? "" : text);
      return _persona;
    }

    return { reply: reply, transcript: transcript, reset: reset, persona: persona };
  }

  return { create: create, WINDOW_DEFAULT: CONVERSATION_WINDOW_DEFAULT };
})();
