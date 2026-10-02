// agent3 probe bootstrap: loads the real engine from the review worktree (read-only).
process.env.ENGINE_ROOT = process.env.ENGINE_ROOT || "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/wt-rev3";
require("C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/thu/vtags/harness.js");
global.J = function (v) { return JSON.stringify(v); };
global.endings = function (cs) { return (cs.coreMemories || []).filter(function (m) { return m && m.kind === "ending"; }).map(function (m) { return m.text; }); };
global.w525 = function (heroName) {
  makeWorld(); var c = worldState.character; c.name = heroName || "Ammut"; c.cls = "Rogue"; c.level = 19; c.coreMemories = [];
  worldState.campName = "The Princess Is Not In Danger"; worldState.turn = 89;
  worldState.npcs.push({ name: "Daeris", status: "steady", rel: "wife", partyMember: true, charSheet: { name: "Daeris", cls: "Cleric", level: 18, coreMemories: [] } });
  memory.chapters = []; worldState.transcript = []; delete worldState.ended; worldState.spineComplete = { turn: 88 }; return c;
};
