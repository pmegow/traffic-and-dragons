// dev/sabotage-206-scene-render.js — proves the per-scene render is guarded: the stamp, the no-history writer call,
// the frame's turn in the save funnel, the weather omission, and the prose-named party.
//   node dev/sabotage-206-scene-render.js
var sabotage = require("./sabotage.js");
var rc1 = sabotage.prove({
  file: "state.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "new GM entries lose their stamps (a future frame renders from today's facts again)",
      find: 'if(role==="gm"&&!_bk&&worldState.world){if(worldState.world.location)_e.l=worldState.world.location;', replace: 'if(false){if(worldState.world.location)_e.l=worldState.world.location;' }
  ]
});
var rc2 = sabotage.prove({
  file: "game.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "the historical writer call rides the live history (every button paints the CURRENT scene)",
      find: 'var resp=hist?await callGM(rp,_wsys,undefined,null,{noHistory:true}):await callGM(rp,_wsys);', replace: 'var resp=await callGM(rp,_wsys);' },
    { label: "the save funnel stamps the newest turn, not the frame's",
      find: 'var _rt=hist?ctx.turn:_job.turn;', replace: 'var _rt=_job.turn;' },/* re-anchored at #440 (v1.985): the live branch stamps the render job's own turn now; the guard — a past frame keeps ITS turn — is unchanged */
    { label: "a past frame with no weather on record is painted under today's weather rule (the omission is dropped)",
      find: '+(opts&&!w.weather?(opts.weatherInProse?"Weather: only as the scene text describes it. ":"Weather: the record names none for this moment — paint no weather, only the place and its light. "):"")', replace: '' },
    { label: "the prose-named party filter is dropped (every living companion is painted into every old frame)",
      find: '.test(low))))out.push(live[i]);', replace: '.test(low))||true)out.push(live[i]);' }
  ]
});
process.exit(rc1 || rc2);
