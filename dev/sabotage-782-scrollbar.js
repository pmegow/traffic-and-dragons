// sabotage-782-scrollbar.js - prove the #782 scrollbar-contrast guard is not decorative.
// #782 (owner 2026-11-25): in light mode the scroll handle (#b6a17a) sat on a groove of the page's own
// colour (#b0a68b) - 1.04:1, no groove and a handle nobody could find. The groove is now a panel tone
// and the handle a text tone. Each mutation puts one of the old choices back; the engine test must
// turn red, and sabotage.js restores byte-identical source after every case.
//   node dev/sabotage-782-scrollbar.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","#782 scrollbar contrast"]];
var MUST="#782 a scrollbar is visible in both colour schemes";

rc|=sabotage.prove({file:"index.html",command:CMD,cases:[
  {label:"#782 the groove is the page colour again",find:"::-webkit-scrollbar-track{background:var(--bg1)}",replace:"::-webkit-scrollbar-track{background:var(--bg0)}",mustFail:MUST},
  {label:"#782 the handle is the border tone again",find:"::-webkit-scrollbar-thumb{background:var(--t2);border-radius:3px}",replace:"::-webkit-scrollbar-thumb{background:var(--brd);border-radius:3px}",mustFail:MUST},
  {label:"#782 the story and side panel take a low-contrast handle of their own",find:"#story::-webkit-scrollbar-thumb,.rpanel::-webkit-scrollbar-thumb{border-radius:2px}",replace:"#story::-webkit-scrollbar-thumb,.rpanel::-webkit-scrollbar-thumb{background:var(--brd);border-radius:2px}",mustFail:MUST}
  /* A washed-out --t2 token is not a clause here: the light palette is a pinned copy of website/themes.css, and that
     contract turns red first (tried 2026-11-25: MISATTRIBUTED). */
]});
process.exit(rc);
