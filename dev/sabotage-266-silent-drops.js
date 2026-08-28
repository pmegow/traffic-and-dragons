// sabotage-266-silent-drops.js — mutation proof for the #266 silent-drop class.
//
// The guard: a near-miss operand on a known tag name is LOUD (warn + ⚠ muts), never an invisible
// no-op — [SCENE_NOT:] being the sharp case (a dropped W2 negative quietly weakens the death
// gate); a bare [ENEMY_SURRENDERS] against a closed tracker reaches the UA27/#225 orphan
// machinery; and a [COMBAT_START:] naming a living party member is announced at registration.
// Usage: node dev/sabotage-266-silent-drops.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "#266: the near-miss detector is neutered — every malformed operand drops silently again",
      mustFail: "the W2 negative — is loud",
      find: "    if(strict.test(all[i]))continue;",
      replace: "    if(true)continue;" },

    { label: "#266: SCENE_NOT loses its near-miss scan — the W2 negative goes back to invisible loss",
      mustFail: "the W2 negative — is loud",
      find: "__tagNearMiss(text,R,\"SCENE_NOT\",\"^\\\\[SCENE_NOT:[^|\\\\]]+\\\\|[^|\\\\]]+\\\\|(explicit|inference)\\\\]$\",\"[SCENE_NOT:handle|Entity|explicit-or-inference] — a dropped negative weakens the death gate\");",
      replace: "" },

    { label: "#266: the orphan collector regresses to colon-forms — the bare mass surrender slips both tripwires",
      mustFail: "BARE [ENEMY_SURRENDERS] against a closed tracker",
      find: "if(TAG_TABLE[i].nc&&!worldState.combat&&(text.indexOf(\"[\"+TAG_TABLE[i].t+\":\")>=0||text.indexOf(\"[\"+TAG_TABLE[i].t+\"]\")>=0)){",
      replace: "if(TAG_TABLE[i].nc&&!worldState.combat&&text.indexOf(\"[\"+TAG_TABLE[i].t+\":\")>=0){" },

    { label: "#266: the companion-in-tracker announcement dies — a party member enters the enemy list unremarked",
      mustFail: "LIVING party member is loud at registration",
      find: "    var _pmFoe=(typeof findCompanionChar===\"function\")?findCompanionChar(foe.name):null;",
      replace: "    var _pmFoe=null;if(false)findCompanionChar(foe.name);" }
  ]
});

process.exit(rc ? 1 : 0);
