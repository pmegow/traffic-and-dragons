// dev/sabotage-425-skeleton-record.js — proves the #425 guards are guarded: the hero's record reaches the skeleton
// generator (bonds first, earlier adventures named, chronological, capped), the three generator rules ride the
// prompt, the reviewer sees the character and the INVENTED PAST dimension (and the designer's prompt stays bare),
// the call sites actually pass the character through, and the GM's skeleton block carries the hero's-own-stake
// line. Each mutation runs in a disposable clone (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-425-skeleton-record.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#425 skeleton record"]], cases: cases }); }
prove("helpers.js", [
  { label: "bonds no longer lead the record",
    find: 'if(cm[i].kind==="bond")bonds.push(l);else rest.push(l);', replace: 'rest.push(l);',
    mustFail: "charRecordDigest" },
  { label: "a raw campaign id leaks as a label",
    find: '!k||/^camp_\\d/.test(k)?"an earlier adventure":k', replace: '!k?"an earlier adventure":k',
    mustFail: "charRecordDigest" },
  { label: "beats come out newest-first instead of in the order they happened",
    find: 'beats.unshift(b);', replace: 'beats.push(b);',
    mustFail: "charRecordDigest" },
  { label: "the cap drops the newest beats instead of the oldest",
    find: 'for(i=sb.length-1;i>=0;i--){var b=line(sb[i]);if(!b)continue;if(used+b.length+1>CHAR_RECORD_CAP)break;beats.unshift(b);',
    replace: 'for(i=0;i<sb.length;i++){var b=line(sb[i]);if(!b)continue;if(used+b.length+1>CHAR_RECORD_CAP)break;beats.push(b);',
    mustFail: "charRecordDigest" }
]);
prove("game.js", [
  { label: "the record never reaches the generator",
    find: '+(rec?"THE RECORD — this character', replace: '+(false?"THE RECORD — this character',
    mustFail: "buildSkeletonPrompt" },
  { label: "the canon rule is dropped",
    find: '+(hasRecord?"- THE RECORD IS CANON', replace: '+(false?"- THE RECORD IS CANON',
    mustFail: "buildSkeletonPrompt" },
  { label: "the never-date rule is dropped",
    find: '+"- NEVER DATE THE CHARACTER\'S OWN PAST', replace: '+""+"',
    mustFail: "buildSkeletonPrompt" },
  { label: "the reveal rule is dropped",
    find: '+"- THE PLAYER HAS NOT READ THIS PREMISE.', replace: '+""+"',
    mustFail: "buildSkeletonPrompt" },
  { label: "the reviewer is called without the hero",
    find: 'reviewCampaignSkeleton(skel,upgradeModelFor(),"skeleton",skeletonCharBlock(c))', replace: 'reviewCampaignSkeleton(skel,upgradeModelFor(),"skeleton")',
    mustFail: "the failure condition" },
  { label: "generateSkeleton stops using the pinned builder",
    find: 'var prompt=buildSkeletonPrompt(c,w,t,_skelDNA);', replace: 'var prompt="Design a three-act campaign skeleton."+skeletonCharBlock(c);',
    mustFail: "the failure condition" }
]);
prove("campaign_generator.js", [
  { label: "the INVENTED PAST dimension is dropped",
    find: '+(ctx?"\\n- INVENTED PAST:', replace: '+(false?"\\n- INVENTED PAST:',
    mustFail: "buildSkeletonReviewPrompt" },
  { label: "the character block never reaches the reviewer",
    find: '+(ctx?"\\n\\nCHARACTER — the protagonist', replace: '+(false?"\\n\\nCHARACTER — the protagonist',
    mustFail: "buildSkeletonReviewPrompt" },
  { label: "the review call drops the character it was handed",
    find: 'var msg=buildSkeletonReviewPrompt(skel,charCtx);', replace: 'var msg=buildSkeletonReviewPrompt(skel);',
    mustFail: "the failure condition" },
  { label: "the constraints no longer end the prompt",
    find: "+SKELETON_REVIEW_CONSTRAINTS; // constraints LAST", replace: '+SKELETON_REVIEW_CONSTRAINTS+"\\n"; // constraints LAST',
    mustFail: "buildSkeletonReviewPrompt" }
]);
prove("api.js", [
  { label: "the hero's-own-stake line is dropped from the skeleton block",
    find: 'lines.push("THE HERO\'S OWN STAKE IS NEVER A SECRET FROM THE PLAYER:', replace: 'if(false)lines.push("THE HERO\'S OWN STAKE IS NEVER A SECRET FROM THE PLAYER:',
    mustFail: "buildSkeletonBlock" },
  { label: "the stake line stops naming the hero",
    find: 'var _hn=(worldState.character&&worldState.character.name)||"the hero";', replace: 'var _hn="the hero";',
    mustFail: "buildSkeletonBlock" }
]);
process.exit(code);
