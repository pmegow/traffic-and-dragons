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
      /* #272 re-point: both POST paths now route through the ONE wire-form seam */
      label: "normal turn sync returns to a plain worldState payload",
      mustFail: "of the 2 POST paths (_syncNow payload + pushCampaignState)",
      find: "worldState:    wireWorldStateSnapshot(wsStripped),",
      replace: "worldState:    wsStripped,"
    },
    {
      label: "first campaign upload returns to a plain worldState payload",
      mustFail: "of the 2 POST paths (_syncNow payload + pushCampaignState)",
      find: "worldState:    wireWorldStateSnapshot(_stripNpcPortraits(parts.worldState)),",
      replace: "worldState:    _stripNpcPortraits(parts.worldState),"
    },
    {
      label: "the reconcile stops refusing an unreadable transcript form before adopting (#272 D3)",
      mustFail: "no longer refuses an unreadable transcript form",
      find: "if (_srvTr && !(_srvTr instanceof Array) && typeof inflateTranscriptField === \"function\" && inflateTranscriptField(_srvTr) === null) {",
      replace: "if (false) {"
    }
  ]
}));
