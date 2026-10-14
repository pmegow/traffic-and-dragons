// ui-character-voice.js — THE character voice control (#629, owner 2026-10-13): ONE renderer and ONE wirer over
// tts.js's CHARACTER_VOICE_SLOTS registry, hosted by the character sheet and the NPC sheet (ui-sheets.js, id prefix
// "cs-") and by the wizard's Finishing Touches page (char-creation.js, id prefix "ft-"); a later host — the blueprint
// designer's named NPCs, say — takes the same two calls. A reader added to or removed from the registry changes every
// host at once. A host decides only WHERE the block renders, what its ids are prefixed with (two hosts can share one
// page), and what happens after a write (the sheet saves at once; the wizard holds the draft until confirmChar carries
// it). The cs* function names are the sheet-era names, kept because the suites that drive them (tests-402/404/456/
// 481-e6) and the batteries anchored on them read unchanged — the functions themselves are host-neutral.
// Loads after ui-voice-settings.js; every host calls it at render time only (the #161 call-time argument).
var CharacterVoice=(function(){
  var DEFAULT_PREFIX="cs-";
  function prefixOf(opts){return (opts&&typeof opts.prefix==="string"&&opts.prefix)?opts.prefix:DEFAULT_PREFIX;}
  /* ONE id rule: <prefix><slot key>-sel / -test for a registry slot; <prefix>voice-direction, voice-rate, voice-rate-value,
     voice-rate-reset for the per-character rows. The sheet's prefix reproduces its historical ids exactly. */
  function slotIds(slot,prefix){prefix=prefix||DEFAULT_PREFIX;return {select:prefix+slot.key+"-sel",test:prefix+slot.key+"-test"};}
  function html(char,opts){
    if(!char||typeof TTS==="undefined"||!TTS.characterVoiceSlots)return "";
    var prefix=prefixOf(opts);
    /* #456: the registry decides — a cloud slot renders its catalog, the Piper slot its stars; no provider named here */
    return TTS.characterVoiceSlots().map(function(slot){
      var id=slotIds(slot,prefix);
      return "<div class='cs-voice-row' style='margin-top:10px;font-size:12px;color:var(--t1);'>"
        +"<label for='"+id.select+"' style='display:block;margin-bottom:5px;'>"+slot.label+" · "+slot.service+"</label>"
        +"<div style='display:flex;align-items:center;gap:8px;'><select id='"+id.select+"' style='flex:1;min-width:0;width:0;font-family:var(--font);font-size:12px;background:var(--bg2);color:var(--t0);border:1px solid var(--brd);border-radius:var(--r);padding:8px;cursor:pointer;'>"+({backup:csBackupVoiceOptions,catalog:csPrimaryVoiceOptions}[slot.options||"catalog"])(char,slot)+"</select>"
        +"<button id='"+id.test+"' type='button' style='flex-shrink:0;min-height:36px;padding:5px 10px;font-family:var(--font);font-size:12px;background:none;border:1px solid var(--brd2);border-radius:var(--r);color:var(--t1);cursor:pointer;'>&#9654; Test</button></div></div>";
    }).join("")+csVoiceDirectionHtml(char,prefix)+"<div style='font-size:11px;color:var(--t2);margin-top:6px;'>Cloud voice tests use your API keys.</div>";
  }
  /* The host's after-write hook: the sheet saves, the wizard holds its draft. Called with (field, value, char) after the
     field is written and BEFORE a released Piper voice or a toast — the order the sheet always had. */
  function wire(char,opts){
    if(!char||typeof TTS==="undefined"||!TTS.characterVoiceSlots)return;
    var prefix=prefixOf(opts);
    function changed(field,value){if(opts&&typeof opts.onChange==="function")opts.onChange(field,value,char);}
    TTS.characterVoiceSlots().forEach(function(slot){
      var id=slotIds(slot,prefix),sel=document.getElementById(id.select),tb=document.getElementById(id.test),ticker=null;
      if(!sel)return;
      sel.addEventListener("change",function(){
        var prev=char[slot.field]||"",v=sel.value;
        if(v)char[slot.field]=v;else delete char[slot.field];
        changed(slot.field,v);
        if(prev&&prev!==v&&slot.release)slot.release(prev);
        if(typeof showToast==="function")showToast(slot.label+": "+(v?sel.options[sel.selectedIndex].textContent:"automatic"));
      });
      if(tb)tb.addEventListener("click",function(){
        try{slot.test(char,sel.value,function(phase){
          if(ticker)ticker.stop();ticker=null;
          if(!tb.isConnected)return;
          if(phase==="loading")ticker=elapsedTicker(tb,"Preparing",{text:true});else tb.textContent="▶ Test";
        });}catch(err){if(ticker)ticker.stop();ticker=null;tb.textContent="▶ Test";console.warn("[character voice] "+err.message);showToast(slot.service+" test failed: "+err.message,8000);}
      });
    });
    var rate=document.getElementById(prefix+"voice-rate"),rateLabel=document.getElementById(prefix+"voice-rate-value"),rateReset=document.getElementById(prefix+"voice-rate-reset");/* #457 */
    if(rate){
      rate.addEventListener("input",function(){if(rateLabel)rateLabel.textContent=csVoiceRateLabel(rate.value);});
      rate.addEventListener("change",function(){var v=Math.round(Number(rate.value)*100)/100;if(!v||v<0.8||v>1.3)return;char.voiceRate=v;if(rateLabel)rateLabel.textContent=csVoiceRateLabel(char.voiceRate);changed("voiceRate",char.voiceRate);if(typeof showToast==="function")showToast("Speed "+csVoiceRateLabel(char.voiceRate));});
      if(rateReset)rateReset.addEventListener("click",function(){delete char.voiceRate;rate.value=csVoiceRateValue(null);if(rateLabel)rateLabel.textContent=csVoiceRateLabel(null);changed("voiceRate",null);if(typeof showToast==="function")showToast("Speed follows the provider rate ("+csVoiceRateLabel(null)+")");});
    }
    var dir=document.getElementById(prefix+"voice-direction");/* #456 */
    if(dir)dir.addEventListener("change",function(){var v=String(dir.value||"").trim().slice(0,300);if(v)char.voiceDirection=v;else delete char.voiceDirection;changed("voiceDirection",v);if(typeof showToast==="function")showToast(v?"Delivery direction saved":"Delivery direction cleared");});
  }
  /* Every character field this control writes — the registry's slot fields plus the two per-character rows. The wizard
     carries exactly these onto the new sheet; nothing is listed by hand anywhere else. */
  function fields(){
    if(typeof TTS==="undefined"||!TTS.characterVoiceSlots)return [];
    return TTS.characterVoiceSlots().map(function(slot){return slot.field;}).concat(["voiceDirection","voiceRate"]);
  }
  return {html:html,wire:wire,fields:fields,ids:slotIds,DEFAULT_PREFIX:DEFAULT_PREFIX};
})();
function csUnlistedVoiceOption(cur){
  // Keep a saved pin selected without offering an actor outside the character's filtered list.
  return "<option value='"+escHtml(cur)+"' selected disabled hidden>Saved voice (not listed)</option>";
}
function csBackupVoiceOptions(char){
  var vs=TTS.filterCharacterVoices(char,TTS.voices()),cur=char.voiceId||"",allStars=TTS.starsList(),st=TTS.filterCharacterVoices(char,allStars);
  vs=vs.filter(function(v){return !allStars.some(function(star){return star.id===v.id;});});
  var listed=st.concat(vs).some(function(v){return v.id===cur;});
  var opts="<option value=''"+(cur?"":" selected")+">"+(st.length||vs.length?"Automatic on first speech (default)":"No matching actors")+"</option>";/* Fable review 2026-09-11 (Brief C): the empty state is named, like the primary's */
  opts+=TTS.starOptionsHtml(cur,char);
  if(cur&&!listed)opts+=csUnlistedVoiceOption(cur);
  vs.forEach(function(v){opts+="<option value='"+escHtml(v.id)+"'"+(v.id===cur?" selected":"")+">"+escHtml(v.label)+"</option>";});
  return opts;
}
function csPrimaryVoiceOptions(char,slot){
  var cur=char[slot.field]||"",catalog=slot.catalog(),voices=TTS.filterCharacterVoices(char,catalog);
  var empty=catalog.length?"No matching actors":"Load actors in Voice Settings";
  var opts="<option value=''"+(cur?"":" selected")+">"+(voices.length?"Automatic (gender matched)":empty)+"</option>";
  voices.forEach(function(v){opts+="<option value='"+escHtml(v.id)+"'"+(v.id===cur?" selected":"")+">"+escHtml(v.label+" · "+(v.g==="M"?"Male":v.g==="F"?"Female":v.g==="NB"?"Non-binary":"Unspecified"))+"</option>";});
  if(cur&&!voices.some(function(v){return v.id===cur;}))opts+=csUnlistedVoiceOption(cur);
  return opts;
}
/* #456 (owner 2026-09-25): ONE delivery direction per character — the reader's per-request instruction. Saved on change like the
   voice selects; the Inworld slot's Test reads with it. #481 E6 (audit 2026-09-29): a row shows only where the PRIMARY reader
   honours it (TTS.characterVoiceCaps, derived from the model table); a hidden row leaves a one-line hint naming who does honour
   it, and a saved value is kept (never deleted), so switching back restores it. prefix: the host's id prefix (#629). */
function csVoiceDirectionHtml(char,prefix){
  prefix=prefix||CharacterVoice.DEFAULT_PREFIX;
  var caps=(typeof TTS!=="undefined"&&TTS.characterVoiceCaps)?TTS.characterVoiceCaps():{rate:true,direction:true,label:"",rateBy:[],directionBy:[]};
  return (caps.direction?"<div class='cs-voice-row' style='margin-top:10px;font-size:12px;color:var(--t1);'><label for='"+prefix+"voice-direction' style='display:block;margin-bottom:5px;'>Delivery direction · "+escHtml(caps.label)+"</label>"
    +"<textarea id='"+prefix+"voice-direction' rows='2' maxlength='300' placeholder='How this character speaks — e.g. gruff and impatient; low, unhurried' style='width:100%;box-sizing:border-box;font-family:var(--font);font-size:12px;background:var(--bg2);color:var(--t0);border:1px solid var(--brd);border-radius:var(--r);padding:8px;resize:vertical;'>"+escHtml(char.voiceDirection||"")+"</textarea></div>"
    :csVoiceCapHint("Delivery direction",caps.label,caps.directionBy,!!char.voiceDirection))
    +(caps.rate?"<div class='cs-voice-row' style='margin-top:10px;font-size:12px;color:var(--t1);'><label for='"+prefix+"voice-rate' style='display:block;margin-bottom:5px;'>Speed <span id='"+prefix+"voice-rate-value'>"+csVoiceRateLabel(char.voiceRate)+"</span> <button type='button' id='"+prefix+"voice-rate-reset' title='Follow the provider rate' style='background:none;border:none;color:var(--t2);cursor:pointer;font-size:12px;padding:0 4px;'>&times;</button></label>"
    +"<input id='"+prefix+"voice-rate' type='range' min='0.8' max='1.3' step='0.05' value='"+csVoiceRateValue(char.voiceRate)+"' style='width:100%;'/></div>"/* #457 */
    :csVoiceCapHint("Speed",caps.label,caps.rateBy,!!Number(char.voiceRate)));
}
/* #481 E6: the one line a hidden voice row leaves — what it is, that this reader ignores it, who reads it, and that yours is kept */
function csVoiceCapHint(what,label,by,kept){
  var who=by.length>1?by.slice(0,-1).join(", ")+" and "+by[by.length-1]:(by[0]||"");
  return "<div class='cs-voice-hint' style='margin-top:8px;font-size:11px;color:var(--t2);'>"+escHtml(what+": "+label+" does not use it"+(who?"; "+who+(by.length>1?" do":" does"):"")+"."+(kept?" Yours is kept.":""))+"</div>";
}
/* #457 (owner ruling 2026-09-25: no silent multiplier): an assigned speed IS that character's rate; unassigned shows and
   reads the provider rate (TTS.providerRate — 1.1× until saved). The × deletes the assignment. */
function csVoiceRateValue(r){var v=Number(r);if(!v||v<0.8||v>1.3)v=(typeof TTS!=="undefined"&&TTS.providerRate)?TTS.providerRate():1.1;return String(Math.round(v*100)/100);}
function csVoiceRateLabel(r){var own=!!(Number(r)&&Number(r)>=0.8&&Number(r)<=1.3);return Number(csVoiceRateValue(r)).toFixed(2)+"×"+(own?"":" · provider default");}
