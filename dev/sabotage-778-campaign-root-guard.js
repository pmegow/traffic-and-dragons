// dev/sabotage-778-campaign-root-guard.js — proves the #778 guards are guarded: a campaign's own folder is never taken as the
// campaigns root, and a root already stored that way is said. Each mutation runs in a disposable clone.
//   node dev/sabotage-778-campaign-root-guard.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-778-campaign-root-guard.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("ui-files.js", [
  { label: "the picker takes a campaign's own folder as the root again",
    find: "    if(is)throw new Error(rootHandle.name+\"/ is one campaign's own folder", replace: "    if(false)throw new Error(rootHandle.name+\"/ is one campaign's own folder",
    mustFail: "#778 File ▸ Set campaigns folder REFUSES a campaign's own folder" },
  { label: "only a READABLE marker counts as a campaign's folder",
    find: "function _campRootIsCampaign(h){return _campReadMarker(h).then(function(mk){return !!mk;});}", replace: "function _campRootIsCampaign(h){return _campReadMarker(h).then(function(mk){return !!(mk&&mk.campId);});}",
    mustFail: "#778 a marker that cannot be parsed still marks a campaign's folder" },
  { label: "a stored campaign-folder root restores silently at boot",
    find: "      if(p===\"granted\"){_campRootHandle=h;updateCampFolderUI();return _campRootCheck(h).then(function(){return true;});}/* #778 */", replace: "      if(p===\"granted\"){_campRootHandle=h;updateCampFolderUI();return true;}",
    mustFail: "#778 a root ALREADY stored that is a campaign's folder" },
  { label: "a re-armed campaign-folder root is silent",
    find: "    return _campRootCheck(h).then(function(){return true;});/* #778 */", replace: "    return true;",
    mustFail: "#778 a stored root whose permission lapsed is checked" },
  { label: "the stored-root warning is console-only (a caught problem that shows nothing)",
    find: "    showToast(\"📁 \"+msg,12000);", replace: "",
    mustFail: "#778 a root ALREADY stored that is a campaign's folder" },
  { label: "every folder is warned about, a healthy root included",
    find: "    if(!is||_campRootWarned)return;", replace: "    if(_campRootWarned)return;",
    mustFail: "#778 a healthy stored root says nothing" }
]);
process.exit(code);
