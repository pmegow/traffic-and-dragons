// sabotage-777-ui.js — retained proof for audit 2026-11-19 (TODO #777), the DOM shells judged over a fake page:
//   ui-modals.js, ui-shell.js   U5 the four hand-built modals are dialogs on modalShell, looking as they did
// Each clause runs ONE named case of dev/tests-777-ui.js (the suite's own --only).
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-777-ui.js"]], ONLY = "FAIL #777 ";
var failed = 0;
function prove(file, cases) { failed += sabotage.prove({ file: file, command: CMD, only: ONLY, cases: cases }); }
var T = {
  RESPAWN: "U5: respawn-modal is a dialog",
  ONWARD: "U5: onward-modal is a dialog",
  HEALTH: "U5: health-modal is a dialog",
  WORK: "U5: the modals' own buttons still do their work",
  DERIVED: "U5 derived: every modal the game builds by hand is a dialog"
};
prove("ui-shell.js", [
  { label: "U5: a modal on the shell is not a dialog to the focus contract",
    find: "modal.setAttribute(\"aria-modal\",\"true\");", replace: "", mustFail: ONLY + T.RESPAWN }
]);
prove("ui-modals.js", [
  { label: "U5: Escape answers the forced choice at Death's door",
    find: "{wireClose:false/* a forced choice", replace: "{wireClose:true/* a forced choice", mustFail: ONLY + T.ONWARD },
  { label: "U5: the health modal opens with focus on Submit report",
    find: "  document.getElementById(\"hm-ok\").focus();/* U5:", replace: "  /* U5:", mustFail: ONLY + T.HEALTH },
  { label: "U5: the health modal's close mark does nothing",
    find: "{closeId:\"hm-close\",outside:true,", replace: "{outside:true,", mustFail: ONLY + T.WORK },
  { label: "U5: the respawn modal's overlay changed",
    find: "{overlayCss:\"position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:320;", replace: "{overlayCss:\"position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:300;", mustFail: ONLY + T.RESPAWN },
  { label: "U5: the health modal's box changed",
    find: "max-width:460px;width:100%;max-height:85vh;overflow-y:auto;padding:16px;\"});", replace: "max-width:460px;width:100%;max-height:85vh;overflow-y:auto;padding:20px;\"});", mustFail: ONLY + T.HEALTH },
  { label: "U5: a hand-built modal loses its aria-modal and nothing notices",
    find: "m.setAttribute(\"role\",\"dialog\");m.setAttribute(\"aria-modal\",\"true\");m.setAttribute(\"aria-labelledby\",\"firstturn-title\");", replace: "m.setAttribute(\"role\",\"dialog\");m.setAttribute(\"aria-labelledby\",\"firstturn-title\");", mustFail: ONLY + T.DERIVED }
]);

// ── C5, C6 (2026-11-20) ────────────────────────────────────────────────────────────────────────────────────────────
var T5 = "C5: Back from an imported character puts the wizard back as it was", T6 = "C6: a file the browser cannot read as an image is refused and said";
prove("ui-browsers.js", [
  { label: "C5: Back leaves the import's fields in the wizard",
    find: "  if(was&&prev){at=cs.step;to=prev.step;cs=prev;cs.step=at;goStep(to>=1&&to<6?to:5);return;}\n", replace: "", mustFail: ONLY + T5 },
  { label: "C5: the wizard is not kept before an import",
    find: "  if(!pendingImportChar)pendingImportPrev=JSON.parse(JSON.stringify(cs));", replace: "  ", mustFail: ONLY + T5 },
  { label: "C5: a second import replaces the snapshot of the player's own wizard",
    find: "  if(!pendingImportChar)pendingImportPrev=", replace: "  pendingImportPrev=", mustFail: ONLY + T5 },
  { label: "C5: Back leaves the import pending",
    find: "  pendingImportChar=null;pendingImportPrev=null;\n  if(was&&prev)", replace: "  pendingImportPrev=null;\n  if(was&&prev)", mustFail: ONLY + T5 }
]);
prove("ui-boot.js", [
  { label: "C5: the review's Back button is not wired to the restore",
    find: "addEventListener(\"click\",function(){wizardReviewBack();});", replace: "addEventListener(\"click\",function(){pendingImportChar=null;goStep(5);});", mustFail: ONLY + T5 },
  { label: "C6: the wizard's upload stores a refused picture",
    find: "function(compressed){if(!compressed)return;cs.portrait=compressed;refreshFtPortrait();}", replace: "function(compressed){cs.portrait=compressed;refreshFtPortrait();}", mustFail: ONLY + T6 }
]);
prove("ui-portrait.js", [
  { label: "C6: an undecodable file is stored as it is",
    find: "  img.onerror=function(){portraitUnreadable();cb(null);};", replace: "  img.onerror=function(){cb(dataUrl);};", mustFail: ONLY + T6 },
  { label: "C6: the refusal is not said",
    find: "  img.onerror=function(){portraitUnreadable();cb(null);};", replace: "  img.onerror=function(){cb(null);};", mustFail: ONLY + T6 },
  { label: "C6: the modal's upload shows a refused picture",
    find: "function(compressed){if(!compressed)return;showResult(compressed,false,null);}", replace: "function(compressed){showResult(compressed,false,null);}", mustFail: ONLY + T6 },
  { label: "C6: the modal's Apply stores a refused picture",
    find: "function(compressed){if(!compressed){useBtn.disabled=false;useBtn.textContent=\"Apply\";return;}setPort(compressed);", replace: "function(compressed){setPort(compressed);", mustFail: ONLY + T6 },
  { label: "C6: a failed image request is read as the picture (the modal)",
    find: "if(r.ok===false)throw new Error(\"the image could not be fetched (HTTP \"+r.status+\")\");/* C6 */", replace: "", mustFail: ONLY + T6 }
]);
prove("char-creation.js", [
  { label: "C6: a failed image request is read as the picture (the wizard)",
    find: "if(resp.ok===false)throw new Error(\"the image could not be fetched (HTTP \"+resp.status+\")\");/* audit 2026-11-19, C6 */", replace: "", mustFail: ONLY + T6 },
  { label: "C6: the wizard stores a refused generated picture",
    find: "        if(!compressed){status.innerHTML=\"<span style='color:var(--red);'>The generated picture could not be read as an image.</span>\";return;}\n", replace: "", mustFail: ONLY + T6 }
]);
prove("game.js", [
  { label: "C6: the render's portrait stores a refused picture",
    find: "          if(!compressed)return;/* C6: refused and said by compressPortrait */\n", replace: "", mustFail: ONLY + T6 },
  { label: "C6: a failed image request is read as the picture (the render)",
    find: "if(r.ok===false)throw new Error(\"the image could not be fetched (HTTP \"+r.status+\")\");/* audit 2026-11-19, C6 */", replace: "", mustFail: ONLY + T6 }
]);

process.exit(failed ? 1 : 0);
