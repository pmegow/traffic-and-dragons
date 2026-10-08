// Campaign-owned renders retain detached subjects; asynchronous actions retain their own targets.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "game.js",
  "command": [
    "node",
    [
      "dev/tests-440-render-job.js"
    ]
  ],
  "cases": [
    {
      "label": "hero name again cancels same-campaign render",
      "find": "return worldState.campId===job.campId;}",
      "replace": "return worldState.campId===job.campId&&worldState.character.name===job.name;}",
      "mustFail": "same-campaign hero swap at prompt"
    },
    {
      "label": "painter reads the swapped live hero",
      "find": "var sc=collectRenderSeeds(mdlCfg,c,party);",
      "replace": "var sc=collectRenderSeeds(mdlCfg,worldState.character,party);",
      "mustFail": "same-campaign hero swap at prompt"
    },
    {
      "label": "party portrait objects remain shared",
      "find": "var c=subjects.character,w=worldState.world,party=subjects.party;",
      "replace": "var c=subjects.character,w=worldState.world,party=hist?partyForRender(ctx):livingPartyCompanions();",
      "mustFail": "in-place subject changes"
    },
    {
      "label": "hero portrait object remains shared",
      "find": "var c=subjects.character,w=worldState.world,party=subjects.party;",
      "replace": "var c=worldState.character,w=worldState.world,party=subjects.party;",
      "mustFail": "in-place subject changes"
    },
    {
      "label": "portrait final callback ignores changed actor",
      "find": "if(!_renderJobLive(_job)||worldState.character!==portraitTarget){",
      "replace": "if(!_renderJobLive(_job)){",
      "mustFail": "Portrait captures click target"
    },
    {
      "label": "portrait final callback ignores changed campaign",
      "find": "if(!_renderJobLive(_job)||worldState.character!==portraitTarget){",
      "replace": "if(worldState.character!==portraitTarget){",
      "mustFail": "Portrait refuses campaign change"
    },
    {
      "label": "save blob callback skips campaign check",
      "find": "        if(!_renderJobLive(_job)){_renderJobDrop(_job,\"the save\");return;}",
      "replace": "",
      "mustFail": "Save checks campaign after blob"
    },
    {
      "label": "failed save opens stale fallback",
      "find": "}).catch(function(){if(!_renderJobLive(_job)){_renderJobDrop(_job,\"the save\");return;}window.open(imageUrl,\"_blank\");});",
      "replace": "}).catch(function(){window.open(imageUrl,\"_blank\");});",
      "mustFail": "Save failed fetch"
    }
  ]
}));
