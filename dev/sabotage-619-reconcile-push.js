// dev/sabotage-619-reconcile-push.js — proves the #619 guard guards: a device that boots AHEAD of the cloud with no JP0-11
// marker pushes ONCE from the reconcile, with the server's turn as its CAS base, through the ordinary debounced path; a
// level device pushes nothing. Each clause plants the exact regression; dev/tests-jp011-flush-dirty.js must then FAIL on the
// attributed line. A mutation that changes no bytes is a hard failure.
//   node dev/sabotage-619-reconcile-push.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "storage-adapter.js",
  command: ["node", ["dev/tests-jp011-flush-dirty.js"]],
  cases: [
    { label: "#619 the reconcile measures the gap and leaves it (the pre-#619 behaviour: the badge stays lit until the next taken turn)",
      mustFail: "expected exactly one push from the reconcile",
      find: "        console.info(\"[storage] reconcile: this device is ahead (local turn \" + localTurn + \", server \" + serverTurn + \") — pushing now\" + (_wasConflict ? \"; the standing 409 pause is stale\" : \"\") + \" (#619)\");\n        syncToServer();\n",
      replace: "        if (_wasConflict) syncToServer();\n" },

    { label: "#619 the push goes out before the base is seeded (baseTurn -1: a 409 on every boot, the #377 class)",
      mustFail: "did not seed the base from the server's turn",
      find: "      if (serverTurn > _lastAckTurn) _lastAckTurn = serverTurn;\n      // CAS re-arm (Known issue #5)",
      replace: "      // CAS re-arm (Known issue #5)" },

    { label: "#619 a level device pushes too (every boot of every synced device POSTs for nothing)",
      mustFail: "a level device pushed from the reconcile",
      find: "      if (localTurn > serverTurn) {\n        console.info(\"[storage] reconcile: this device is ahead",
      replace: "      if (localTurn >= serverTurn) {\n        console.info(\"[storage] reconcile: this device is ahead" }
  ]
});

process.exit(rc ? 1 : 0);
