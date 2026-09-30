// dev/sabotage-481-f1-campaign-folders.js — proves the #481 F1 guards are guarded: a campaign's folder is keyed by its ID.
// Fable's named clause: "restore the campName derivation". The others remove one rule of the resolver (the foreign-marker
// skip, the adoption marker, the stored slug), the merge's local-slug rule, and the rehome re-stamp. Each mutation runs in a
// disposable clone.
//   node dev/sabotage-481-f1-campaign-folders.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-f1-campaign-folders.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("ui-files.js", [
  { label: "restore the campName derivation (Fable's named clause): two same-named campaigns share one folder again",
    find: "  return campaignFolderFor(id,(typeof worldState!==\"undefined\"&&worldState&&worldState.campName)||\"Campaign\",create).then(function(sub){",
    replace: "  return campaignFolderFor(null,(typeof worldState!==\"undefined\"&&worldState&&worldState.campName)||\"Campaign\",create).then(function(sub){",
    mustFail: "two campaigns with ONE name get TWO folders" },
  { label: "a folder marked for another live campaign is written anyway",
    find: "        return probe(n+1);/* another campaign's folder — never written */", replace: "        return keep(dir);",
    mustFail: "a folder whose marker names ANOTHER live campaign" },
  { label: "an adopted legacy folder gets no marker",
    find: "        if(!mk||!mk.campId){return _campWriteMarker(dir,id,campName).then(function(){", replace: "        if(!mk||!mk.campId){return Promise.resolve().then(function(){",
    mustFail: "a legacy folder with no marker is ADOPTED" },
  { label: "the stored slug is ignored (a refused rename sends the next save elsewhere)",
    find: "  var row=_campMetaRow(id),stored=row&&row.folderSlug;", replace: "  var row=_campMetaRow(id),stored=null;",
    mustFail: "a refused rename keeps the stored slug" },
  { label: "the rehome re-stamp writes nothing",
    find: "if(mk&&mk.campId&&mk.campId!==oldId&&mk.campId!==newId)return false;return _campWriteMarker(dir,newId,row.campName).then(function(){return true;});",
    replace: "return false;",
    mustFail: "a rehome re-stamps the marker it owns" }
]);
prove("storage-adapter.js", [
  { label: "the server's slug wins the merge (another device's disk)",
    find: "if (_fs) merged[j].folderSlug = _fs; else delete merged[j].folderSlug;", replace: "",
    mustFail: "the stored slug survives mergeCampaignLists" }
]);
prove("state.js", [
  { label: "a rehome leaves the folder marker behind",
    find: "  if(old&&typeof campaignFolderRestamp===\"function\")campaignFolderRestamp(old,nid);", replace: "",
    mustFail: "rehomeCampaign (state.js) calls the re-stamp" }
]);
process.exit(code);
