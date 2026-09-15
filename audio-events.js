// Additive voice subscribers must never replace Car Mode's legacy callbacks.
function createAudioEvents() {
  var listeners = {};
  function off(name, fn) {
    var list = listeners[name] || [], i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  function on(name, fn) {
    if (typeof fn !== "function") throw new Error("Audio subscriber must be a function");
    var list = listeners[name] || (listeners[name] = []);
    if (list.indexOf(fn) < 0) list.push(fn);
    return function() { off(name, fn); };
  }
  function emit(name, value) {
    (listeners[name] || []).slice().forEach(function(fn) {
      try { fn(value); } catch (e) { console.warn("[audio event] " + name + ": " + e.message); }
    });
  }
  return { on: on, off: off, emit: emit };
}
