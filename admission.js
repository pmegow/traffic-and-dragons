/* admission.js — SHEET ADMISSION: the ONE registry every door runs a character sheet through (#599 release (b), v1.1197;
   DOC/DESIGN_599_inventory_rows.md §5.3, the owner's go of 2026-10-08 on review 41). Loads after identity.js (its gates and
   the relationship adapter) and before tag_table.js; every host that runs a door loads it (the game, map cleanup).

   WHY ONE TABLE. Up to v1.1196 one adopter alone ran seven per-sheet steps by hand in its own order — the version gate, the
   identity gate, the portrait gate, the scene-field cross, the relationship adapter, the item-canon adoption, the voice
   fill, the stash mark — and every new rule meant an eighth copy at every door, in whatever order that door happened to
   use (review 41 R2: sceneFieldsCross clears relationship dynamics unconditionally, adoptSheetItemDefs writes the live
   item bible even for a detached sheet). Now a door says WHO is arriving and FROM WHERE — the context — and the registry
   says what runs, in three phases:
     gate     read-only checks on the SOURCE; the first refusal stops everything, nothing has been touched;
     prepare  heals on a DETACHED candidate (a JSON copy through keyedStores) unless the door owns the object (detach:false);
     publish  writes that reach destination state (the item bible, the voice pins) — only after every gate passed.
   The door installs the returned sheet; a refusal returns {ok:false, reason} and the door writes nothing.

   THE CONTEXT a door passes:
     door      a short label for the console ("library hero", "character import", "village resident Morwen")
     mode      "cross" — data from another campaign, the library, a file, the home page (the default); "same" — this
               campaign's own data (a generated sheet, a load heal), where cross-campaign heals must NOT run
     name      the name the sheet will carry at its destination (the hero's live name on a hero adopt)
     exclude   the identity exclusions for identitySheetIssue; undefined = this door does not admit a new identity
     rel       the relationship-adapter owner key (null for the hero, the name for a companion, "@import:…" for a file)
     portable  true for a file or a library copy (the relationship adapter's portable mode)
     prev      the sheet being replaced, when one is (the voice pins it holds fill the copy's empty slots)
     detach    false when the door owns the object and heals it in place (the import preview, a generated sheet)
     typed     true when the sheet's prose was typed into this build (the wizard's hero at New Game) or already clamped by
               this build's preview — the import clamp does not apply to it
     toast     false to refuse without a toast (the door says it its own way)
   The context is a value, never a label: an entry's `applies` reads it, never the door's name.

   THE ENTRIES are the registry. Adding a per-sheet rule is adding an entry; the ADMISSION CONTRACT in run-tests.js refuses a
   hand-run step at any door and a door without sheetAdmit. The inventory entry is the legacy adapter in (b) — release (c)
   swaps its run for invHealSheet and nothing else moves. */
var SHEET_ADMISSION=[
  {name:"version",phase:"gate",applies:function(){return true;},
   run:function(sheet){return sheetVersionIssue(sheet);},
   say:function(why,ctx){if(typeof console!=="undefined")console.error("[admission] "+ctx.door+" refused — "+why);if(ctx.toast!==false&&typeof showToast==="function")showToast("⚠ "+why+VERSION_RELOAD_HINT,9000);}},
  {name:"identity",phase:"gate",applies:function(ctx){return ctx.exclude!==undefined;},
   run:function(sheet,ctx){return identitySheetIssue(sheet,ctx.name||sheet.name,ctx.exclude);},
   say:function(why,ctx){if(ctx.toast===false){if(typeof console!=="undefined")console.warn("[identity] Character identity refused: "+why);}else identityAdmissionWarn(why);}},
  {name:"stash",phase:"gate",applies:function(ctx){return ctx.mode!=="same";},/* memory.js loads before this file in every host — a missing helper fails loudly, never skips the mark (§5.3) */
   run:function(sheet,ctx){try{ctx.stashMark=stashCopyMark(ctx.source);return "";}catch(e){ctx.stashMark=null;return (sheet.name||"the copy")+"'s stash history is unreadable ("+((e&&e.message)||e)+") — refused";}},/* read from the SOURCE: the mark says which moves the copy already holds (#481 D9); a corrupted mark REFUSES the copy (review (b) 13: stashJournalRefuse throws, and a throw mid-import would abort the whole list) */
   say:function(why,ctx){if(typeof console!=="undefined")console.error("[admission] "+ctx.door+" refused — "+why);if(ctx.toast!==false&&typeof showToast==="function")showToast("⚠ "+why,9000);}},
  {name:"stores",phase:"prepare",applies:function(){return true;},
   run:function(sheet){keyedStores(sheet,"sheet");}},/* #545: name-keyed dictionaries never walk the prototype */
  {name:"portrait",phase:"prepare",applies:function(){return true;},
   run:function(sheet,ctx){if(portraitAdmit(sheet,ctx.door)&&ctx.toast!==false&&typeof showToast==="function")showToast("⚠ "+(sheet.name||"The character")+"'s portrait was dropped — not an image");}},/* #481 F2 */
  {name:"names",phase:"prepare",applies:function(ctx){return ctx.mode!=="same";},
   run:function(sheet){migrateAncestryNames(sheet);migrateCharClassNames(sheet);migrateCapabilityRenames(sheet);migrateSpellDisplayNames(sheet);}},/* #100, #221: a portable copy may predate a rename */
  {name:"clamp",phase:"prepare",applies:function(ctx){return ctx.mode!=="same"&&!ctx.typed;},
   run:function(sheet){clampImportedCharacter(sheet);}},/* #315: over-long IMPORTED prose is cut before it can reach a prompt — never the prose the player typed into this build (ctx.typed: the wizard's hero at New Game; review (b) 1 found the wizard's 3000-character backstory cut to 2500) */
  {name:"arrays",phase:"prepare",applies:function(){return typeof ensureV10Arrays==="function";},
   run:function(sheet){ensureV10Arrays(sheet);}},/* #428: the v10 field guarantee (game.js; a host without game.js has no v10 doors) */
  {name:"relationships",phase:"prepare",applies:function(){return true;},
   run:function(sheet,ctx){relationshipMigrateSheet(sheet,ctx.rel===undefined?sheet.name:ctx.rel,ctx.portable?{portable:true}:undefined);}},/* #168 W7: the axis adapter */
  {name:"scene",phase:"prepare",applies:function(ctx){return ctx.mode!=="same";},
   run:function(sheet){sceneFieldsCross(sheet);}},/* #481 C5: the last campaign's scene stays there — NEVER on this campaign's own data (review 41 R2) */
  {name:"inventory",phase:"prepare",applies:function(){return true;},
   run:function(sheet){if(!Array.isArray(sheet.inventory))sheet.inventory=[];if(sheet.worn!==undefined&&!Array.isArray(sheet.worn))sheet.worn=[];}},/* (b): the legacy form stays strings; (c) makes this invHealSheet */
  {name:"itemDefs",phase:"publish",applies:function(ctx){return ctx.mode!=="same"&&ctx.stage!=="preview";},/* a preview (the import modal, quick start's pick) looks and heals but never publishes — its later door does */
   run:function(sheet){adoptSheetItemDefs(sheet);}},/* #81b: the travelling item canon joins the destination's bible — a WRITE, so after every gate */
  {name:"voices",phase:"publish",applies:function(ctx){return !!ctx.prev;},
   run:function(sheet,ctx){voicePinsFill(sheet,[ctx.prev],voicePinFitsGender(sheet.gender));}}/* #543: the replaced sheet's pins fill the copy's empty slots */
];
/* sheetAdmit(source, ctx) → {ok, sheet, reason, ran, gate}. Pure over its inputs except through the publish entries and
   the context's own fields (stashMark). Never throws on a bad source. */
function sheetAdmit(source,ctx){
  ctx=ctx||{};if(!ctx.mode)ctx.mode="cross";ctx.source=source;
  var ran=[],i,e,why,cand,phase,phases=["prepare","publish"],p;
  if(!source||typeof source!=="object")return {ok:false,sheet:null,reason:"no sheet",ran:ran,gate:"source"};
  for(i=0;i<SHEET_ADMISSION.length;i++){e=SHEET_ADMISSION[i];if(e.phase!=="gate"||!e.applies(ctx))continue;
    why=e.run(source,ctx);if(why){e.say(why,ctx);return {ok:false,sheet:null,reason:why,ran:ran,gate:e.name};}ran.push(e.name);}
  cand=(ctx.detach===false)?source:JSON.parse(JSON.stringify(source));
  if(typeof ctx.name==="string"&&ctx.name)cand.name=ctx.name;
  for(p=0;p<phases.length;p++){phase=phases[p];
    for(i=0;i<SHEET_ADMISSION.length;i++){e=SHEET_ADMISSION[i];if(e.phase!==phase||!e.applies(ctx))continue;e.run(cand,ctx);ran.push(e.name);}}
  return {ok:true,sheet:cand,reason:"",ran:ran,gate:null};
}
