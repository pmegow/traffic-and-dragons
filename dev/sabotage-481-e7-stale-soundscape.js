// dev/sabotage-481-e7-stale-soundscape.js — proves the #481 E7 guard is guarded: a stale-but-valid soundscape is published as
// STALE (the house plays its hearth until reclassified), an invalid one stays classified-without-profile (no fallback), and
// the re-ask fires on staleness. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-e7-stale-soundscape.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "audio-profile.js", command: ["node", ["dev/run-tests.js", "Interior hearth defaults"]], cases: [
  { label: "nothing is ever stale (the house goes silent again)",
    find: "function audioNodeStale(node){if(!node||!node.soundscape)return false;", replace: "function audioNodeStale(node){return false;if(!node||!node.soundscape)return false;",
    mustFail: "#481 E7 a stale house plays its hearth" },
  { label: "the snapshot still calls a stale profile classified",
    find: "classified:!!(node&&node.soundscape)&&!audioNodeStale(node),", replace: "classified:!!(node&&node.soundscape),",
    mustFail: "#481 E7 a stale house plays its hearth" },
  { label: "an invalid profile counts as stale (and becomes a fallback)",
    find: "return !!(v.ok&&v.profile.stamp!==audioNodeStamp(node));}", replace: "return !v.ok||v.profile.stamp!==audioNodeStamp(node);}",
    mustFail: "#481 E7 a stale house plays its hearth" }
]}));
