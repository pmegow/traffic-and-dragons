// dev/sabotage-743-designer-forms.js — proves the #743 step-3 guards (the Blueprint Designer's second portrait slot and the
// alternate form's fields: DOC/DESIGN_743_forms.md ▸ Designer). Node clauses run dev/tests-designer-creatures.js and
// dev/tests-724-designer-assistant.js; browser clauses run the real designer through dev/tests-732-missing-portraits-browser.js
// (dev/cdp-browser.js; a missing Chrome is an explicit skip).
//   node dev/sabotage-743-designer-forms.js
var sabotage = require("./sabotage.js"), chrome = require("./cdp-browser.js").locateChrome(), failed = 0;
var NODE = ["node", ["dev/tests-designer-creatures.js"]], ASSIST = ["node", ["dev/tests-724-designer-assistant.js"]];
var T_TEXT = "#743 images of both forms stay out of text payloads and survive text fixes";
var T_ALT = "#743 the alternate portrait is drawn from the alternate appearance alone";
var T_TRUE = "#743 slot one is the true form: an authored alternate frees it from the mask description";
var T_MOVE = "#743 a legacy mask moves its description and its portrait to the alternate, once";
var T_SLOT = "#743 each slot generates into its own field from its own prompt";
var T_REV = "#743 review: staleness is judged per slot, a busy entry says so, and a blank alternate field is no field";
var T_CARD = "#743 the card renders both slots, the alternate fields and the three starting forms";
failed += sabotage.prove({ file: "designer-creatures.js", command: NODE, cases: [
  { label: "the alternate image rides text payloads (image bytes sent to a model)",
    find: "var IMAGE_KEYS=[\"portrait\",\"altPortrait\"],", replace: "var IMAGE_KEYS=[\"portrait\"],", mustFail: T_TEXT },
  { label: "a text fix drops the alternate's authored fields",
    find: "[\"abilities\",\"desc\"].concat(FORM_KEYS).forEach(", replace: "[\"abilities\",\"desc\"].forEach(", mustFail: T_TEXT },
  { label: "a text fix may attach a model's image",
    find: "IMAGE_KEYS.forEach(function(k){delete next[k];if(previous", replace: "IMAGE_KEYS.forEach(function(k){if(previous", mustFail: T_TEXT },
  { label: "the alternate portrait is drawn from the GM notes too",
    find: "\" Visible appearance: \"+c.altDesc.trim()+\" Show only", replace: "\" Visible appearance: \"+c.altDesc.trim()+\" \"+(c.notes||\"\")+\" Show only", mustFail: T_ALT },
  { label: "an alternate with no appearance is illustrated anyway",
    find: "if(!c||typeof c.altDesc!==\"string\"||!c.altDesc.trim())throw new Error(\"Write the alternate appearance", replace: "if(!c)throw new Error(\"Write the alternate appearance", mustFail: T_ALT },
  { label: "the true portrait of a formed entry still demands the mask description",
    find: "if(c.desc||legacyMask(c)||c.displayName&&!c.altDesc){", replace: "if(c.desc||c.displayName){", mustFail: T_TRUE },
  { label: "the move leaves a copy of the description on the true form",
    find: "c.altDesc=c.desc;delete c.desc;", replace: "c.altDesc=c.desc;", mustFail: T_MOVE },
  { label: "the move overwrites an existing alternate image",
    find: "if(withPortrait===true&&c.portrait&&!c.altPortrait){", replace: "if(withPortrait===true&&c.portrait){", mustFail: T_MOVE },
  { label: "the move carries the portrait without being asked (a true face in the disguise slot)",
    find: "if(withPortrait===true&&c.portrait&&!c.altPortrait){", replace: "if(c.portrait&&!c.altPortrait){", mustFail: T_MOVE },
  { label: "the move runs on an entry that is not a legacy mask",
    find: "    if(!legacyMask(c))return false;\n", replace: "", mustFail: T_MOVE }
] });
failed += sabotage.prove({ file: "blueprint-designer.html", command: NODE, cases: [
  { label: "the alternate button writes the true slot",
    find: "slotName=options.slot===\"alternate\"?\"alternate\":\"true\",key=portraitSlot(slotName).key;", replace: "slotName=options.slot===\"alternate\"?\"alternate\":\"true\",key=\"portrait\";", mustFail: T_SLOT },
  { label: "the alternate slot is drawn from the true form's prompt",
    find: "var url=await generatePortraitImage(cfg.prompt(c,slotName));", replace: "var url=await generatePortraitImage(cfg.prompt(c));", mustFail: T_SLOT },
  { label: "an alternate appearance edited mid-drawing keeps the stale image",
    find: "identity:function(c,slot){return JSON.stringify(slot===\"alternate\"?[c.altDesc]:[c.name,c.kind,", replace: "identity:function(c,slot){return JSON.stringify(slot===\"alternate\"?[]:[c.name,c.kind,", mustFail: T_SLOT },
  { label: "an edit the alternate prompt never reads discards its image",
    find: "var target=bp,identity=cfg.identity(c,slotName);", replace: "var target=bp,identity=cfg.identity(c);", mustFail: T_REV },
  { label: "a click on a busy entry is silently ignored",
    find: "if(creaturePortraitBusy(c))return result(\"skipped\",PORTRAIT_BUSY_TEXT);", replace: "if(creaturePortraitBusy(c))return result(\"skipped\");", mustFail: T_REV },
  { label: "a blank alternate appearance is stored",
    find: "&&!String(v).trim()){delete o[k];return;}/* #743", replace: "&&0){delete o[k];return;}/* #743", mustFail: T_REV },
  { label: "the block closes over an authored cue",
    find: "(formHasAlternate(o)||o.altWhen||o.altPortrait||o.startsAs?\" open\":\"\")", replace: "(formHasAlternate(o)?\" open\":\"\")", mustFail: T_CARD },
  { label: "the starting-form radio loses the as-serves-the-story choice",
    find: ",[\"story\",\"As serves the story\"]];", replace: "];", mustFail: T_CARD },
  { label: "the alternate block shows no second portrait slot",
    find: "    +designerPortraitActions(sec,o,i,\"alternate\")+\"</details>\";", replace: "    +\"</details>\";", mustFail: T_CARD },
  { label: "the side column shows only the true portrait",
    find: "  [\"true\",\"alternate\"].forEach(function(slot){\n    var def=PORTRAIT_SLOTS[slot];if(!safeImgSrc(c[def.key]))return;", replace: "  [\"true\"].forEach(function(slot){\n    var def=PORTRAIT_SLOTS[slot];if(!safeImgSrc(c[def.key]))return;", mustFail: T_CARD },
  { label: "the legacy move is offered on every entry",
    find: "    +(DesignerCreatures.legacyMask(o)?\"<p class='creature-help'>This entry has a public name", replace: "    +(1?\"<p class='creature-help'>This entry has a public name", mustFail: T_CARD }
] });
failed += sabotage.prove({ file: "designer-assistant-ui.js", command: NODE, cases: [
  { label: "the before and after panel prints the alternate image's bytes",
    find: "DesignerCreatures.imageKeys.indexOf(k)<0&&k.charAt(0)", replace: "k!=='portrait'&&k.charAt(0)", mustFail: "#743 review: the assistant's before and after panel never prints an image" }
] });
failed += sabotage.prove({ file: "designer-assistant.js", command: ASSIST, cases: [
  { label: "the assistant's request carries the alternate image",
    find: "k==='portrait'||k==='altPortrait'||k==='review'", replace: "k==='portrait'||k==='review'", mustFail: "#743 the alternate form is assistant text: accepted, validated, and its image never sent or lost" },
  { label: "the assistant refuses the alternate's fields on a creature",
    find: "revealAct availableActs environment altDesc altWhen startsAs'", replace: "revealAct availableActs environment'", mustFail: "#743 the alternate form is assistant text: accepted, validated, and its image never sent or lost" }
] });
var B = "FAIL #732 ", BROWSER = ["node", ["dev/tests-732-missing-portraits-browser.js"]];
var T_BATCH = B + "#743 the batch fills a missing alternate only where an alternate appearance is written";
var T_LIVE = B + "#743 the card authors the alternate form: fields, the starting form, both slots, the legacy move";
failed += sabotage.prove({ file: "designer-portrait-batch.js", skip: !chrome.path, command: BROWSER, only: B, cases: [
  { label: "the batch never renders a missing alternate",
    find: "      if(!c.altPortrait&&typeof c.altDesc===\"string\"&&c.altDesc.trim())queue.push({type:type,subject:c,slot:\"alternate\"});", replace: "", mustFail: T_BATCH },
  { label: "the batch queues an alternate with no appearance written",
    find: "if(!c.altPortrait&&typeof c.altDesc===\"string\"&&c.altDesc.trim())queue.push(", replace: "if(!c.altPortrait)queue.push(", mustFail: T_BATCH },
  { label: "the batch renders the alternate into the true slot's prompt",
    find: "{missingOnly:true,quiet:true,slot:entry.slot});", replace: "{missingOnly:true,quiet:true});", mustFail: T_BATCH }
] });
failed += sabotage.prove({ file: "blueprint-designer.html", skip: !chrome.path, command: BROWSER, only: B, cases: [
  { label: "the alternate's Remove button deletes the true portrait",
    find: "delete subject[slotKey];markDirty();render();}", replace: "delete subject.portrait;markDirty();render();}", mustFail: T_LIVE },
  { label: "the move button does nothing",
    find: "if(DesignerCreatures.moveToAlternate(moveSubject,movedImage)){markDirty();render();", replace: "if(0){markDirty();render();", mustFail: T_LIVE },
  { label: "the portrait button moves the description alone",
    find: "var movedImage=t.getAttribute(\"data-form-portrait\")===\"1\"&&", replace: "var movedImage=false&&", mustFail: T_LIVE },
  { label: "the alternate portrait cannot be enlarged",
    find: "if(portraitAction===\"view\")openCreaturePortrait(subject,slotKey);", replace: "if(portraitAction===\"view\")openCreaturePortrait(subject);", mustFail: T_LIVE }
] });
process.exit(failed ? 1 : 0);
