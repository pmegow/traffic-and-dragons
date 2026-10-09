// Named #404 guards; the harness mutates disposable clones only.
var sabotage=require("./sabotage.js"),rc=0;
rc |= sabotage.prove({
  "file": "tts.js",
  "command": [
    "node",
    [
      "dev/tests-404-voice-registry.js"
    ]
  ],
  "cases": [
    {
      "label": "drop registry credential write",
      "find": "if (value || !spec.keepEmpty) keyStores[spec.store][spec.key] = value;",
      "replace": "if (false) keyStores[spec.store][spec.key] = value;",
      "mustFail": "FAIL #404 registry credential roundtrip preserves GM keys"
    },
    {
      "label": "skip credential rollback",
      "find": "before.forEach(function(w) { try { if (w[1] === null)",
      "replace": "[].forEach(function(w) { try { if (w[1] === null)",
      "mustFail": "FAIL #404 credential transaction rollback and blank BYOK preservation"
    }
  ]
});
rc |= sabotage.prove({
  "file": "ui-sheets.js",
  "command": [
    "node",
    [
      "dev/tests-404-voice-registry.js"
    ]
  ],
  "cases": [
    {
      "label": "restore provider-name presentation",
      "find": "[slot.options||\"catalog\"]",
      "replace": "[slot.provider===\"piper\"?\"backup\":\"catalog\"]",
      "mustFail": "FAIL #404 sheet dispatch follows slot presentation not provider name"
    }
  ]
});
rc |= sabotage.prove({
  "file": "ui-voice-settings.js",
  "command": [
    "node",
    [
      "dev/tests-404-voice-registry.js"
    ]
  ],
  "cases": [
    {
      "label": "ignore direction hint",
      "find": "e(m.directionHint || \"\")",
      "replace": "\"\"",
      "mustFail": "FAIL #404 settings direction and credential hints derive from model"
    },
    {
      "label": "ignore credential hint",
      "find": "e(m.keyHint || \"Stored on this device, like your existing API keys.\")",
      "replace": "\"Stored on this device\"",
      "mustFail": "FAIL #404 settings direction and credential hints derive from model"
    }
  ]
});
rc |= sabotage.prove({
  "file": "game.js",
  "command": [
    "node",
    [
      "dev/tests-404-voice-registry.js"
    ]
  ],
  "cases": [
    {
      "label": "restore numeric provider map exclusion",
      "find": "_s.speakerMap===false",
      "replace": "_s.provider===\"piper\"",
      "mustFail": "FAIL #404 speaker map and first speech respect numeric slot role"
    },
    {
      "label": "restore numeric first-speech provider exclusion",
      "find": "_vp.speakerMap===false",
      "replace": "_vp.provider===\"piper\"",
      "mustFail": "FAIL #404 speaker map and first speech respect numeric slot role"
    }
  ]
});
rc |= sabotage.prove({
  "file": "tts.js",
  "command": [
    "node",
    [
      "dev/tests-404-voice-catalog.js"
    ]
  ],
  "cases": [
    {
      "label": "retain full catalog payload on Save",
      "find": "if (VOICE_MODELS[id].catalogUrl) c.voices = _voiceCompactActors(id, c.voices || []);",
      "replace": "if (false) c.voices = _voiceCompactActors(id, c.voices || []);",
      "mustFail": "FAIL #404 two full catalogs shrink and plateau without losing ids or pins"
    },
    {
      "label": "ignore whole settings budget",
      "find": "if (settingsJson.length > VOICE_SETTINGS_MAX)",
      "replace": "if (false)",
      "mustFail": "FAIL #404 oversized settings refuse atomically rather than dropping actors"
    },
    {
      "label": "leave saved gender unnormalized",
      "find": "g: _voiceGender(v.g) };",
      "replace": "g: v.g };",
      "mustFail": "FAIL #404 imported catalog gender and compact traits normalize without writes"
    },
    {
      "label": "lose reformatted traits",
      "find": "split(/,|\\s*·\\s*/)",
      "replace": "split(\",\")",
      "mustFail": "FAIL #404 imported catalog gender and compact traits normalize without writes"
    },
    {
      "label": "split Unicode clipping pair",
      "find": "if (/[\\uD800-\\uDBFF]/.test(text.charAt(end - 1))) end--;",
      "replace": "if (false) end--;",
      "mustFail": "FAIL #404 compact projection preserves bounded metadata and Unicode boundaries"
    },
    {
      "label": "throw on invalid inactive catalog",
      "find": "cached.issue = m.label + \": \" + err.message",
      "replace": "throw err; cached.issue = m.label + \": \" + err.message",
      "mustFail": "FAIL #404 invalid inactive saved catalog remains repairable without data loss"
    }
  ]
});
rc |= sabotage.prove({
  "file": "tts.js",
  "command": [
    "node",
    [
      "dev/tests-404-voice-resources.js"
    ]
  ],
  "cases": [
    {
      "label": "retain ready timeout",
      "find": "settled = true; clearReadyTimer(); resolve(adapter);",
      "replace": "settled = true; resolve(adapter);",
      "mustFail": "FAIL #404 ready timer lifecycle returns to zero across repeated spawns"
    },
    {
      "label": "retain completed cloud closure",
      "find": "if (!anyOk && !handedOff) {\n      abortAll();",
      "replace": "if (!anyOk && !handedOff) {",
      "mustFail": "FAIL #404 decode allocation failure releases cloud closure before fallback"
    }
  ]
});
rc |= sabotage.prove({
  "file": "tts.js",
  "command": [
    "node",
    [
      "dev/tests-404-voice-catalog.js"
    ]
  ],
  "cases": [
    {
      "label": "clear action leaves invalid bank in draft",
      "find": "d.models[id].voices = []; delete d.models[id]._catalogIssue;",
      "replace": "delete d.models[id]._catalogIssue;",
      "mustFail": "FAIL #404 explicit keyless catalog clear is draft-only and preserves pins"
    },
    {
      "label": "clear action deletes saved actor pins",
      "find": "d.models[id].voices = []; delete d.models[id]._catalogIssue;",
      "replace": "d.models[id].voices = []; d.models[id].cast = {}; d.models[id].narrator = \"\"; delete d.models[id]._catalogIssue;",
      "mustFail": "FAIL #404 explicit keyless catalog clear is draft-only and preserves pins"
    }
  ]
});
rc |= sabotage.prove({
  "file": "ui-voice-settings.js",
  "command": [
    "node",
    [
      "dev/tests-404-voice-registry.js"
    ]
  ],
  "cases": [
    {
      "label": "clear catalog button does not dispatch",
      "find": "function() { ctx.clearCatalog(id); }",
      "replace": "function() {}",
      "mustFail": "FAIL #404 catalog recovery control dispatches explicit draft clear"
    }
  ]
});
rc |= sabotage.prove({
  "file": "tts.js",
  "command": [
    "node",
    [
      "dev/tests-404-voice-registry.js"
    ]
  ],
  "cases": [
    {
      "label": "standalone key read requires unavailable GM state",
      "find": "(typeof providerKeys !== \"undefined\" && providerKeys) || {}",
      "replace": "providerKeys",
      "mustFail": "FAIL #404 standalone draft tolerates absent BYOK registry"
    }
  ]
});
process.exitCode=rc;
