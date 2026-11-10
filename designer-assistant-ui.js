// One author request and its reviewable proposal live only while this modal is open.
var designerAssistantSession=null;
function closeAsk(){
  var session=designerAssistantSession;if(!session)return;
  designerAssistantSession=null;if(session.timer)session.timer.stop();session.proposal=null;
  session.modal.remove();if(session.opener&&document.body.contains(session.opener))session.opener.focus();
}
function assistantValue(value){
  if(value===null||value===undefined)return '—';
  if(Array.isArray(value))return value.map(assistantValue).join(value.every(function(v){return v===null||typeof v!=='object';})?', ':'\n\n');
  if(typeof value!=='object')return String(value);
  var labels={name:'Name',kind:'Kind',threat:'Threat',notes:'GM notes',desc:'Description',displayName:'Public name',environment:'Environment',availableActs:'Available acts',revealAct:'Available from act',hd:'Hit die',prime:'Primary stat',statPriority:'Stat priority',nm:'Name',ds:'Effect',lvl:'Level',skillSeeds:'Starting skills'};
  return Object.keys(value).filter(function(k){return k!=='portrait'&&k.charAt(0)!=='_';}).map(function(k){return (labels[k]||k.charAt(0).toUpperCase()+k.slice(1))+': '+assistantValue(value[k]);}).join('\n');
}
function openAsk(seedFinding){
  if(!llmReady())return;closeAsk();
  var opener=document.activeElement,session={busy:false,proposal:null,timer:null,modal:null,opener:opener,previous:null};designerAssistantSession=session;
  var html='<div class="assistant-head"><h2>AI assistant</h2><button class="tbtn" id="ask-x">Close</button></div>'
    +'<p>Ask for ideas or changes to this blueprint. Review proposed changes, then apply them to your draft.</p>'
    +(seedFinding?'<p>Review finding: '+esc(seedFinding.issue)+'</p>':'')
    +'<label for="ask-inp">What would you like help with?</label><textarea id="ask-inp" maxlength="4000" rows="4" placeholder="Add 5 forest fey soldiers and 5 swamp fey soldiers. Or: any ideas for Act 3? Design two custom classes."></textarea>'
    +'<div class="assistant-actions"><button class="tbtn primary" id="ask-send">Send request</button><button class="tbtn primary" id="ask-apply" hidden>Apply changes</button></div>'
    +'<div id="ask-status" role="status" aria-live="polite"></div><div id="ask-log" class="assistant-result"><div id="ask-reply"></div><div id="ask-changes"></div></div>';
  var modal=modalShell('ask-modal',html,{maxWidth:780,boxBg:'var(--bg1)',boxExtra:'max-height:90vh;overflow:auto;',closeId:'ask-x',onClose:closeAsk});session.modal=modal;
  var input=modal.querySelector('#ask-inp'),sendButton=modal.querySelector('#ask-send'),applyButton=modal.querySelector('#ask-apply'),status=modal.querySelector('#ask-status'),reply=modal.querySelector('#ask-reply'),changes=modal.querySelector('#ask-changes');
  function live(){return designerAssistantSession===session;}
  var host={previous:function(){return session.previous;},current:function(){return live()?bp:null;},key:BlueprintEdition.key,merge:applyPatches,normalize:function(value){return normalizeBlueprint(value,{preserveProse:true});},validate:validateBlueprint,fields:blueprintTextFields,caps:IMPORT_CAPS,repair:repairModelJson,model:designerModel,ask:function(msg,sys,tokens,model,opts){return callGM(msg,sys,tokens,model,opts);}};
  function error(e){console.warn('[designer assistant] '+e.message);status.textContent=e.message;status.className='err';}
  async function send(){
    if(!live()||session.busy)return;
    var question=input.value.trim();if(!question){status.textContent='Enter a request first.';input.focus();return;}
    session.busy=true;session.proposal=null;applyButton.hidden=true;sendButton.disabled=true;input.disabled=true;reply.textContent='';changes.textContent='';status.className='';
    session.timer=elapsedTicker(status,'Thinking…',{text:true});
    try{
      var proposal=await DesignerAssistant.request(bp,question,host,seedFinding);
      if(!live())return;
      session.timer.stop();session.timer=null;session.proposal=proposal;session.previous={question:question,reply:proposal.reply};reply.textContent=proposal.reply;
      proposal.changes.forEach(function(change){
        var detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent=change.label;detail.appendChild(summary);
        [{label:'Before',value:change.before},{label:'After',value:change.after}].forEach(function(part){var label=document.createElement('h3'),text=document.createElement('div');label.textContent=part.label;text.className='assistant-change';text.textContent=assistantValue(part.value);detail.appendChild(label);detail.appendChild(text);});changes.appendChild(detail);
      });
      applyButton.hidden=!proposal.patches.length;status.textContent=proposal.patches.length?'Review '+proposal.patches.length+' proposed change(s). Your draft has not changed.':'Advice only. Your draft has not changed.';
    }catch(e){if(live()){if(session.timer)session.timer.stop();session.timer=null;error(e);}}
    finally{if(live()){session.busy=false;sendButton.disabled=false;input.disabled=false;input.focus();}}
  }
  sendButton.addEventListener('click',send);
  input.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){ev.preventDefault();send();}});
  applyButton.addEventListener('click',function(){
    if(!live()||!session.proposal||session.busy)return;
    try{var next=DesignerAssistant.apply(session.proposal,bp,host);bp=next;session.proposal=null;applyButton.hidden=true;markDirty();render();status.textContent='Applied to your draft. Save or publish when ready.';status.className='ok';}
    catch(e){session.proposal=null;applyButton.hidden=true;error(e);}
  });
  input.focus();
}
document.getElementById('btn-ask').addEventListener('click',function(){openAsk(null);});
