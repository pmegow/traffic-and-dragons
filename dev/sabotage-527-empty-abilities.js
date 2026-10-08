// #527(22): empty ability slots heal once before any ability reader.
var sabotage=require("./sabotage.js"),rc=0;
rc|=sabotage.prove({
  "file": "helpers.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 empty ability slots at load"
    ]
  ],
  "cases": [
    {
      "label": "empty slots never leave the sheet",
      "find": "if(rep.empty.length)c.abilities=valid;",
      "replace": "if(false)c.abilities=valid;",
      "mustFail": "#527 relevelOnLoad repairs"
    },
    {
      "label": "undefined and sparse slots are missed",
      "find": "if(c.abilities[i]==null)rep.empty.push(i+1);",
      "replace": "if(c.abilities[i]===null)rep.empty.push(i+1);",
      "mustFail": "#527 cleanup-only hero"
    },
    {
      "label": "valid custom and racial entries are discarded",
      "find": "else valid.push(c.abilities[i]);",
      "replace": "else {}",
      "mustFail": "#527 cleanup-only hero"
    }
  ]
});
rc|=sabotage.prove({
  "file": "game.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 empty ability slots at load"
    ]
  ],
  "cases": [
    {
      "label": "cleanup-only repair is not persisted or reported",
      "find": "&&!rep.granted.length&&!rep.empty.length)return;",
      "replace": "&&!rep.granted.length)return;",
      "mustFail": "#527 cleanup-only hero"
    },
    {
      "label": "repair has no visible system message",
      "find": "addMsg(\"system\",reason);if(typeof console!==\"undefined\")console.warn(\"[#527 heal] \"+reason);",
      "replace": "if(typeof console!==\"undefined\")console.warn(\"[#527 heal] \"+reason);",
      "mustFail": "#527 cleanup-only hero"
    },
    {
      "label": "repair has no console reason",
      "find": "if(typeof console!==\"undefined\")console.warn(\"[#527 heal] \"+reason);",
      "replace": "",
      "mustFail": "#527 cleanup-only hero"
    }
  ]
});
process.exit(rc);
