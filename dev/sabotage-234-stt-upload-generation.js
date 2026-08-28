// Retained mutation proof for STT upload ownership. Disposable-clone mutations only.
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "stt.js",
  command: ["node", ["dev/tests-234-stt-upload-generation.js"]],
  cases: [
    {
      label: "STT upload deadline timer disabled",
      mustFail: "STT deadline covers a stalled response json() body",
      find: "      tid = setTimeout(function() {",
      replace: "      if (false) tid = setTimeout(function() {"
    },
    {
      label: "STT stale-generation refusals disabled",
      mustFail: "older recording completion cannot overwrite or auto-send",
      find: /if \(generation !== _cloudGeneration\)/g,
      replace: "if (false && generation !== _cloudGeneration)"
    }
  ]
});

process.exit(rc ? 1 : 0);
