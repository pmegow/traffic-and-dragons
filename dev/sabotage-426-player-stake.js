// dev/sabotage-426-player-stake.js — proves the #426 guards are guarded: the Begin gate (asked only when the backstory
// is empty, only in the skeleton branch, never for a blueprint or the village), the stake as a HARD CONSTRAINT in the
// generator's character block, the reviewer's dimension naming it, the GM block line, the draft prompt's rules and the
// call it rides, the modal's once-latch / ticker / no-outside-dismiss / loud failure, and the journal line.
// Each mutation runs in a disposable clone (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-426-player-stake.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#426 the player's stake"]], cases: cases }); }
prove("helpers.js", [
  { label: "the stake is asked even when a backstory was written",
    find: 'function stakeAskWanted(c){return !!c&&!String(c.backstory||"").trim();}', replace: 'function stakeAskWanted(c){return !!c;}',
    mustFail: "stakeAskWanted" },
  { label: "a whitespace backstory counts as written",
    find: 'function stakeAskWanted(c){return !!c&&!String(c.backstory||"").trim();}', replace: 'function stakeAskWanted(c){return !!c&&!String(c.backstory||"");}',
    mustFail: "stakeAskWanted" }
]);
prove("game.js", [
  { label: "the stake never reaches the character block",
    find: '+(st?"THE PLAYER\'S OWN STAKE — the player wrote this', replace: '+(false?"THE PLAYER\'S OWN STAKE — the player wrote this',
    mustFail: "skeletonCharBlock / buildSkeletonPrompt" },
  { label: "the stake is a suggestion, not a hard constraint",
    find: 'it is a HARD CONSTRAINT: the premise must build on it, in these terms, and may not replace it', replace: 'it is a suggestion the premise may use or ignore',
    mustFail: "skeletonCharBlock / buildSkeletonPrompt" },
  { label: "a blank stake changes the block",
    find: 'st=String(stake||"").trim();', replace: 'st=String(stake||"");',
    mustFail: "skeletonCharBlock / buildSkeletonPrompt" },
  { label: "the draft prompt drops the never-invent rule",
    find: '+"- Build on the record and the written backstory when there is one; never invent a past they did not live (no lost sibling, no ancient failure, no secret debt).\\n"', replace: '',
    mustFail: "buildStakeDraftPrompt" },
  { label: "the draft prompt drops the never-date rule",
    find: '+"- Never state how old they are, and never place their past in a distant age.\\n"', replace: '',
    mustFail: "buildStakeDraftPrompt" },
  { label: "the draft reads a different character block than the generator",
    find: '+skeletonCharBlock(c)\n    +"SETTING: "+w.location+", "+w.region+" | Tone: "+(t&&t.name?t.name:"Sword and Sorcery")+"\\n\\n"\n    +"RULES:\\n"\n    +"- Build on the record', replace: '+"CHARACTER: "+c.name+"\\n"\n    +"SETTING: "+w.location+", "+w.region+" | Tone: "+(t&&t.name?t.name:"Sword and Sorcery")+"\\n\\n"\n    +"RULES:\\n"\n    +"- Build on the record',
    mustFail: "buildStakeDraftPrompt" },
  { label: "draftStake sends the whole session history",
    find: 'STAKE_DRAFT_SYS,300,upgradeModelFor(),{noHistory:true,kind:"skeleton"}', replace: 'STAKE_DRAFT_SYS,300,upgradeModelFor(),{kind:"skeleton"}',
    mustFail: "the wiring" },
  { label: "the modal fires for every start, written backstory or not",
    find: 'if(typeof showStakeModal==="function"&&stakeAskWanted(worldState.character))showStakeModal(_forge);else _forge();', replace: 'if(typeof showStakeModal==="function")showStakeModal(_forge);else _forge();',
    mustFail: "the wiring" },
  { label: "the modal is never shown (the gate is dead)",
    find: 'if(typeof showStakeModal==="function"&&stakeAskWanted(worldState.character))showStakeModal(_forge);else _forge();', replace: '_forge();',
    mustFail: "the wiring" },
  { label: "the modal reaches a blueprint start",
    find: '    // Blueprint provided a skeleton — skip generation, go straight to the adventure\n    beginAdventure();', replace: '    // Blueprint provided a skeleton — skip generation, go straight to the adventure\n    if(typeof showStakeModal==="function")showStakeModal(beginAdventure);else beginAdventure();',
    mustFail: "the wiring" }
]);
prove("campaign_generator.js", [
  { label: "the reviewer's dimension stops counting the stake as canon",
    find: "when the CHARACTER carries a written backstory, THE RECORD or THE PLAYER'S OWN STAKE,", replace: "when the CHARACTER carries a written backstory or THE RECORD,",
    mustFail: "buildSkeletonReviewPrompt" },
  { label: "the reviewer no longer flags a premise that ignores the stake",
    find: ", and any premise that does not build on THE PLAYER'S OWN STAKE in the player's own terms.", replace: ".",
    mustFail: "buildSkeletonReviewPrompt" }
]);
prove("api.js", [
  { label: "the player's stake never reaches the GM block",
    find: 'var _ps=String(worldState.stake||"").trim();if(_ps)lines.push(', replace: 'var _ps=String(worldState.stake||"").trim();if(false)lines.push(',
    mustFail: "buildSkeletonBlock" },
  { label: "the stake line rides even when the stake is empty (not \"\"-clean)",
    find: 'var _ps=String(worldState.stake||"").trim();if(_ps)lines.push(', replace: 'var _ps=String(worldState.stake||"").trim();if(true)lines.push(',
    mustFail: "buildSkeletonBlock" }
]);
prove("ui-modals.js", [
  { label: "done() can fire twice (the campaign forges twice)",
    find: 'function finish(text){if(fired)return;fired=true;', replace: 'function finish(text){',
    mustFail: "the wiring" },
  { label: "an outside click dismisses the modal without deciding",
    find: '{z:420,maxWidth:460,wireClose:false});', replace: '{z:420,maxWidth:460,outside:true});',
    mustFail: "the wiring" },
  { label: "the draft status freezes (no ticker)",
    find: 'var tick=elapsedTicker(st,"Drafting\\u2026");', replace: 'var tick={stop:function(){}};st.textContent="Drafting\\u2026";',
    mustFail: "the wiring" },
  { label: "a failed draft is silent",
    find: 'showToast("Draft failed ("+why+") \\u2014 write your own or skip.",6000);', replace: '',
    mustFail: "the wiring" },
  { label: "the journal hides the stake",
    find: "if(_stk)body+=\"<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t2);margin:2px 0 6px;'>Your stake</div>", replace: "if(false)body+=\"<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t2);margin:2px 0 6px;'>Stake</div>",
    mustFail: "the wiring" }
]);
process.exit(code);
