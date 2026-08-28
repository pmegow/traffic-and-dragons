// Retained mutation proof for #92's compressed sync wire and adopt-hop inflater.
var sabotage = require("./sabotage.js");

process.exit(sabotage.prove({
  file: "storage-adapter.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    {
      label: "reconcile adopts the compressed server blob without inflating it",
      mustFail: "reconcile adopt no longer inflates the pulled blob",
      find: "data.worldState = inflateWorldStateSnapshot(data.worldState);",
      replace: "data.worldState = data.worldState;"
    },
    {
      label: "normal turn sync returns to a plain worldState payload",
      mustFail: "of the 2 POST paths (_syncNow payload + pushCampaignState)",
      find: "worldState:    compressWorldStateSnapshot(wsStripped),",
      replace: "worldState:    wsStripped,"
    },
    {
      label: "first campaign upload returns to a plain worldState payload",
      mustFail: "of the 2 POST paths (_syncNow payload + pushCampaignState)",
      find: "worldState:    compressWorldStateSnapshot(_stripNpcPortraits(parts.worldState)),",
      replace: "worldState:    _stripNpcPortraits(parts.worldState),"
    }
  ]
}));
