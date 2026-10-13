// sabotage-418-schedule-retire.js — prove the #418 helper's clauses are not decorative.
// #418 (audit F9): ONE schedule-and-retire (_scheduleDecoded, tts.js) for every decoded buffer.
// Each mutation removes one load-bearing step from the helper, or puts the block back inline in a
// lane; the named test must turn red; sabotage.js restores byte-identical source after each.
var sabotage=require("./sabotage.js"),rc=0;
var SUITE=["node",["dev/tests-418-schedule-retire.js"]];

rc|=sabotage.prove({file:"tts.js",command:SUITE,cases:[
  {label:"the buffer is no longer detached on end (Safari #718 retention)",
   mustFail:"the helper schedules at max(nextStart, now + 30 ms)",
   find:"      try { src.buffer = null; } catch (e) {}\n",
   replace:""},
  {label:"the finished source stays in _sources (stop/skip would re-stop it; the list grows per read)",
   mustFail:"the helper schedules at max(nextStart, now + 30 ms)",
   find:"      var ix = _sources.indexOf(src); if (ix >= 0) _sources.splice(ix, 1);\n      if (typeof onEnded",
   replace:"      if (typeof onEnded"},
  {label:"the source is never disconnected on end",
   mustFail:"the helper schedules at max(nextStart, now + 30 ms)",
   find:"      try { src.disconnect(); } catch (e) {}\n",
   replace:""},
  {label:"a stale nextStart schedules in the past",
   mustFail:"the helper schedules at max(nextStart, now + 30 ms)",
   find:"    var startAt = Math.max(nextStart, ctx.currentTime + 0.03);\n    src.start(startAt);\n    _ctxSynths++;",
   replace:"    var startAt = nextStart;\n    src.start(startAt);\n    _ctxSynths++;"},
  {label:"the source is not counted on the current context (the recycle would never trigger)",
   mustFail:"the helper schedules at max(nextStart, now + 30 ms)",
   find:"    src.start(startAt);\n    _ctxSynths++;\n    _sources.push(src);",
   replace:"    src.start(startAt);\n    _sources.push(src);"},
  {label:"the lane's onEnded is dropped (activeSrcs never reaches zero — the read never reports idle)",
   mustFail:"the cloud lane end to end",
   find:"      if (typeof onEnded === \"function\") onEnded();\n",
   replace:""},
  {label:"the server lane re-inlines its own createBufferSource (a fourth landing site)",
   mustFail:"the three lanes contain no inline createBufferSource",
   find:"      nextStart = _scheduleDecoded(ctx, buf, nextStart, unitGap(u), function() {/* #418: the one retire; this lane's bookkeeping */",
   replace:"      var _inl = ctx.createBufferSource(); _inl.buffer = buf; _inl.connect(ctx.destination); _inl.start(Math.max(nextStart, ctx.currentTime + 0.03)); _sources.push(_inl); nextStart = Math.max(nextStart, ctx.currentTime + 0.03) + buf.duration + unitGap(u); if (false) _scheduleDecoded(ctx, buf, nextStart, unitGap(u), function() {"}
]});

process.exit(rc);
