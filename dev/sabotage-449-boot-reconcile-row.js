// sabotage-449-boot-reconcile-row.js — mutation proof for #449: the boot reconcile fetches the ACTIVE campaign's own
// row (never the account's latest while a campaign is active), a missing row is not a sync failure, and the identity
// refusal is loud. Usage: node dev/sabotage-449-boot-reconcile-row.js
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  file:"storage-adapter.js",
  command:["node",["dev/tests-449-boot-reconcile-row.js"]],
  cases:[
    { label:"#449: the reconcile asks for the account's latest campaign again instead of the active one",
      mustFail:"the field case",
      find:'    var _rcUrl = _rcId ? "/api/campaigns/" + encodeURIComponent(_rcId) : "/api/state";\n',
      replace:'    var _rcUrl = "/api/state";\n' },
    { label:"#449: a missing row (404) becomes a sync failure",
      mustFail:"a local-only campaign",
      find:'      if (r.status === 404 && _rcId) return null;\n',
      replace:'      if (false) return null;\n' },
    { label:"#449: the identity refusal goes quiet again",
      mustFail:"says so on the console",
      find:'        console.error("[storage] reconcile REFUSED — the server answered with campaign "',
      replace:'        console.debug("[storage] reconcile REFUSED — the server answered with campaign "' }
  ]
}));
