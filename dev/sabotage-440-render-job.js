// sabotage-440-render-job.js — mutation proof for #440: the render job identity is checked after the prompt writer,
// after the image service, and at Save; the Save pointer stamps the render's own turn. Usage: node dev/sabotage-440-render-job.js
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  file:"game.js",
  command:["node",["dev/tests-440-render-job.js"]],
  cases:[
    { label:"#440: the check after the prompt writer is gone",
      mustFail:"prompt boundary: the writer answers after a campaign switch",
      find:'    if(!_renderJobLive(_job)){if(th&&th.parentNode)th.remove();_renderJobDrop(_job,"the scene prompt");return;}',
      replace:'' },
    { label:"#440: the check after the image service is gone",
      mustFail:"image boundary: the image arrives after a campaign switch",
      find:'        if(!_renderJobLive(_job)){div.remove();_renderJobDrop(_job,"the image");return;}',
      replace:'' },
    { label:"#440: the job is always live (identity ignores the campaign)",
      mustFail:"prompt boundary: the writer answers after a campaign switch",
      find:'return worldState.campId===job.campId&&(!c||c.name===job.name);}',
      replace:'return true;}' },
    { label:"#440: the Save pointer stamps the live turn again",
      mustFail:"the Save pointer stamps the turn the render STARTED on",
      find:'      var _rt=hist?ctx.turn:_job.turn;',
      replace:'      var _rt=hist?ctx.turn:(worldState?worldState.turn:0);' },
    { label:"#440: a stale scene saves into the new campaign",
      mustFail:"the Save pointer stamps the turn the render STARTED on",
      find:'      if(!_renderJobLive(_job)){showToast("This scene belongs to "+(_job.campName||"another campaign")+", which is no longer loaded — nothing saved.");return;}',
      replace:'' }
  ]
}));
