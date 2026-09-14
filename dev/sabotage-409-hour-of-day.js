// sabotage-409-hour-of-day.js — mutation proof for the #409 hour-of-day reader.
//
// The guard: the campaign clock counts ELAPSED minutes and clock%day==0 is DAWN. Every consumer
// that needs "what hour is it" derives it from clockMinuteOfDay() (clock.js), which applies
// DAWN_OFFSET_MIN. Before #409 the geo block's OPEN/CLOSED line (api.js _hrLine) took the raw
// elapsed minutes as the hour: a shop filed 8–18 read CLOSED at 8 am and OPEN at midnight, six
// hours early, on every turn since #207 ②. The #207 ② test had pinned the bug (its fixture called
// 14h-elapsed "14:00").
// Each clause must make dev/run-tests.js FAIL; a mutation changing no bytes is a hard failure.
// Usage: node dev/sabotage-409-hour-of-day.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "the geo block reads raw elapsed minutes as the hour again (the six-hour bug returns)",
      mustFail: "#207 ②",
      find: 'mins=clockMinuteOfDay(),',
      replace: 'mins=clockNow()%MIN_PER_DAY,' }
  ]
});

rc |= sabotage.prove({
  file: "clock.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "the one reader drops the dawn offset — the player stamp and the geo line both shift six hours",
      mustFail: "#207 ②",
      find: 'return ((t%MIN_PER_DAY)+DAWN_OFFSET_MIN)%MIN_PER_DAY;',
      replace: 'return t%MIN_PER_DAY;' },
    { label: "clockTimeOfDay computes its own hour instead of deriving from clockMinuteOfDay (two computations can drift)",
      mustFail: "#207 ②",
      find: 'var tod=clockMinuteOfDay(min);',
      replace: 'var tod=((Math.max(0,Math.floor(Number(min==null?clockNow():min)||0))%MIN_PER_DAY)+DAWN_OFFSET_MIN)%MIN_PER_DAY;' }
  ]
});

rc |= sabotage.prove({
  file: "helpers.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "residentWhereabouts computes its own hour instead of the one reader",
      mustFail: "#207 ②",
      find: '(typeof clockMinuteOfDay==="function")?clockMinuteOfDay(m):',
      replace: '(false)?0:' }
  ]
});

process.exit(rc);
