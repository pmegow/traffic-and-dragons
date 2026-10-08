// Each admission/read seam is proved against actual engine or UI-door failure fixtures.
var sabotage=require("./sabotage.js"),code=0;
if(!code)code=sabotage.prove({
  "file": "identity.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#542"
    ]
  ],
  "cases": [
    {
      "label": "allow incoming alias claims",
      "find": "if(claims.length)return \"'\"+values[i]",
      "replace": "if(false)return \"'\"+values[i]",
      "mustFail": "library replacements"
    },
    {
      "label": "forget response competing claims",
      "find": "for(i=0;i<(planned||[]).length;i++)",
      "replace": "for(i=0;i<0;i++)",
      "mustFail": "reply preflight"
    },
    {
      "label": "ignore saved alias competition",
      "find": "var owner=identityAliasOwner(canonical),claims=identityNameClaims(alias,[owner]),i;",
      "replace": "var owner=identityAliasOwner(canonical),claims=[],i;",
      "mustFail": "reply preflight"
    },
    {
      "label": "forget row sheet aliases",
      "find": "scan(identityNpcOwner(n.name),n.name,identityAliasList(n.aliases).concat(identityAliasList(n.charSheet&&n.charSheet.aliases)))",
      "replace": "scan(identityNpcOwner(n.name),n.name,[])",
      "mustFail": "reply preflight"
    },
    {
      "label": "treat same owner as a collision",
      "find": "if((exclude||[]).indexOf(id)>=0)return;",
      "replace": "",
      "mustFail": "library replacements"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "memory.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#542"
    ]
  ],
  "cases": [
    {
      "label": "let conflicting hero alias hide canonical NPC",
      "find": "&&(!identityNameClaims(name,[\"@player\"]).some(function(claim){return claim.primary;}))",
      "replace": "",
      "mustFail": "loaded conflicting"
    },
    {
      "label": "forget demoted hero sheet aliases",
      "find": "var sheetAlias=identitySheetAliasKey(name);if(sheetAlias)return sheetAlias;",
      "replace": "",
      "mustFail": "swap validates"
    },
    {
      "label": "forget hero epithet in recurring scan",
      "find": "var heroAliases=identityAliasList(worldState.character&&worldState.character.aliases);",
      "replace": "var heroAliases=[];",
      "mustFail": "recurring-name scan"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "game.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#542"
    ]
  ],
  "cases": [
    {
      "label": "hero adopter bypasses claims",
      "find": "if(!identitySheetAdmit(c,worldState.character.name,[\"@player\"]))return null;",
      "replace": "",
      "mustFail": "library replacements"
    },
    {
      "label": "companion adopter bypasses claims",
      "find": "if(!identitySheetAdmit(c,n.name,[identityNpcOwner(n.name)]))return null;",
      "replace": "",
      "mustFail": "library replacements"
    },
    {
      "label": "swap ignores demoted hero claims",
      "find": "if(identityIssue){identityAdmissionWarn(identityIssue);return {ok:false,reason:identityIssue};}",
      "replace": "if(false){identityAdmissionWarn(identityIssue);return {ok:false,reason:identityIssue};}",
      "mustFail": "swap validates"
    },
    {
      "label": "Village imports namesakes",
      "find": "if(!identitySheetAdmit(c,nm,identityAttachOwners(nm))){skipped.push(nm);continue;}",
      "replace": "",
      "mustFail": "Village and blueprint"
    },
    {
      "label": "blueprint seeds namesakes",
      "find": "if(!identitySheetAdmit(n,n.name,[]))continue;",
      "replace": "",
      "mustFail": "Village and blueprint"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "tag_table.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#542"
    ]
  ],
  "cases": [
    {
      "label": "lose response-wide alias plan",
      "find": "R.aliasClaims=identityResponseClaims(text);",
      "replace": "R.aliasClaims=[];",
      "mustFail": "reply preflight"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "game.js",
  "command": [
    "node",
    [
      "dev/tests-542-admission-doors.js"
    ]
  ],
  "cases": [
    {
      "label": "startup seeds namesake",
      "find": "if(!identitySheetAdmit(comp,comp.name,[]))continue;",
      "replace": "",
      "mustFail": "startup companion namesakes"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "ui-browsers.js",
  "command": [
    "node",
    [
      "dev/tests-542-admission-doors.js"
    ]
  ],
  "cases": [
    {
      "label": "UI admits identity collision",
      "find": "if(!identitySheetAdmit(char,char.name,identityAttachOwners(char.name)))return;",
      "replace": "",
      "mustFail": "UI import refuses"
    },
    {
      "label": "UI mutates source copy",
      "find": "char=JSON.parse(JSON.stringify(char));",
      "replace": "",
      "mustFail": "UI valid import copies"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "state.js",
  "command": [
    "node",
    [
      "dev/tests-542-admission-doors.js"
    ]
  ],
  "cases": [
    {
      "label": "load loses loud conflict audit",
      "find": "if(typeof identityAliasAudit===\"function\"&&identityAliasAudit())_mig=true;",
      "replace": "",
      "mustFail": "loaded conflict diagnostic"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "identity.js",
  "command": [
    "node",
    [
      "dev/tests-542-admission-doors.js"
    ]
  ],
  "cases": [
    {
      "label": "load repeats diagnostic",
      "find": "if((worldState.identityAliasNotice||\"\")===fingerprint)return false;",
      "replace": "",
      "mustFail": "loaded conflict diagnostic"
    },
    {
      "label": "malformed alias becomes a claim",
      "find": "function identityAliasList(value){return Array.isArray(value)?value.filter(function(v){return typeof v===\"string\"&&v.trim();}):[];}",
      "replace": "function identityAliasList(value){return value||[];}",
      "mustFail": "malformed saved aliases"
    },
    {
      "label": "malformed incoming aliases admitted",
      "find": "if(malformed)return malformed;",
      "replace": "",
      "mustFail": "incoming malformed aliases"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "identity.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#542"
    ]
  ],
  "cases": [
    {
      "label": "memory-only identity cannot reattach",
      "find": "?[identityNpcOwner(name)]:[];",
      "replace": "?[]:[];",
      "mustFail": "exact memory-only"
    },
    {
      "label": "case variant silently becomes another memory key",
      "find": "Object.prototype.hasOwnProperty.call(memory.npcs,name)&&!wsNpcByName(name)",
      "replace": "Object.keys(memory.npcs).some(function(k){return identityNameFold(k)===identityNameFold(name);})&&!wsNpcByName(name)",
      "mustFail": "exact memory-only"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "identity.js",
  "command": [
    "node",
    [
      "dev/tests-542-admission-doors.js"
    ]
  ],
  "cases": [
    {
      "label": "inactive hero alias blocks existing canonical NPC refresh",
      "find": "claims=claims.filter(function(c){return c.id!==\"@player\"||c.primary;});",
      "replace": "claims=claims;",
      "mustFail": "canonical NPC refresh"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "memory.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#542"
    ]
  ],
  "cases": [
    {
      "label": "legacy NPC alias takes active hero epithet",
      "find": "identityNameClaims(name,[\"@player\"]).some(function(claim){return claim.primary;})",
      "replace": "identityNameClaims(name,[\"@player\"]).length",
      "mustFail": "loaded alias-only conflict"
    }
  ]
});
process.exit(code);
