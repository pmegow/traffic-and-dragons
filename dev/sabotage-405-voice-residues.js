// sabotage-405-voice-residues.js — mutation proof for the #405 residues: the catalog-arrives-later
// assignment (shipped-bench backup, pins never overwritten), the out-of-list pin on both sheet
// renderers, the unusable Retry-After hint, and the MANUAL QA header contract.
// Usage: node dev/sabotage-405-voice-residues.js
var sabotage=require("./sabotage.js"),rc=0;
rc|=sabotage.prove({
  file:"tts.js",
  command:["node",["dev/tests-402-character-voices.js"]],
  cases:[
    { label:"#405: the backup slot no longer falls back to the shipped bench when the star list is empty",
      mustFail:"#405 a catalog that arrives AFTER automatic casting",
      find:"      if (!pool.length && slot.defaultCatalog) pool = slot.defaultCatalog().filter(function(v) { return castGenderMatches(gender, v.g); });\n",
      replace:"" },
    { label:"#405: a set pin is overwritten by automatic casting",
      mustFail:"#405 a catalog that arrives AFTER automatic casting",
      find:'      if (typeof char[slot.field] === "string" && char[slot.field]) return;',
      replace:'      if (false) return;' }
  ]
});
rc|=sabotage.prove({
  file:"tts.js",
  command:["node",["dev/tests-401-voice-settings.js"]],
  cases:[
    { label:"#405: an unusable Retry-After invents a hint",
      mustFail:"#405 an HTTP-date, junk, zero, over-a-day or empty Retry-After",
      find:'            if (isFinite(retry) && retry > 0 && retry <= 86400) reason += "; try again in " + Math.ceil(retry) + "s";',
      replace:'            if (true) reason += "; try again in " + Math.ceil(retry) + "s";' }
  ]
});
rc|=sabotage.prove({
  file:"ui-sheets.js",
  command:["node",["dev/tests-402-character-voices.js"]],
  cases:[
    { label:"#405: the backup renderer drops an out-of-list pin",
      mustFail:"#405 an out-of-list pin survives a sheet reopen",
      find:"  if(cur&&!listed)opts+=csUnlistedVoiceOption(cur);\n",
      replace:"" },
    { label:"#405: the primary renderer drops an out-of-list pin",
      mustFail:"#405 an out-of-list pin survives a sheet reopen",
      find:"  if(cur&&!voices.some(function(v){return v.id===cur;}))opts+=csUnlistedVoiceOption(cur);\n",
      replace:"" }
  ]
});
rc|=sabotage.prove({
  file:"dev/qa-402-voice-filter.js",
  command:["node",["dev/run-tests.js","#81 item bible"]],
  cases:[
    { label:"#405: a browser QA script stops declaring itself manual",
      mustFail:"MANUAL QA HEADER CONTRACT BROKEN",
      find:"// MANUAL QA — not run by dev/run-tests.js or CI",
      replace:"// browser QA — not run by dev/run-tests.js or CI" }
  ]
});
process.exit(rc?1:0);
