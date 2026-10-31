// Composition is separate from delivery; every send uses the reviewed server-rendered copy.
(function(){
  var allowed=false,busy=false,loaded=false,rows=[],requests={},source=null,preview=null,lastSaved=null;
  function $(id){return document.getElementById(id);}
  function node(tag,text){var n=document.createElement(tag);n.textContent=text;return n;}
  function status(text,bad){$("invite-status").textContent=text;$("invite-status").className=bad?"error":"sub";if(bad)console.warn("[invitations] "+text);}
  function lock(value){
    busy=value;
    ["invite-email","invite-tier","invite-days","invite-subject","invite-message","invite-preview","invite-history","invite-new"].forEach(function(id){$(id).disabled=busy||!allowed;});
    if(source)["invite-email","invite-tier","invite-days"].forEach(function(id){$(id).disabled=true;});
    $("invite-send").disabled=busy||!allowed||!preview;
    $("invite-new").hidden=!source;
    $("invite-preview").textContent=source?"Preview replacement invitation":"Preview invitation";
    Array.prototype.forEach.call($("invite-list").querySelectorAll("button"),function(b){b.disabled=busy||!allowed;});
  }
  function invalidate(){preview=null;$("invite-review").hidden=true;lock(busy);}
  function requestId(key){
    if(!requests[key]){
      var bytes=new Uint8Array(16);window.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
      var hex=Array.prototype.map.call(bytes,function(b){return("0"+b.toString(16)).slice(-2);}).join("");
      requests[key]=hex.slice(0,8)+"-"+hex.slice(8,12)+"-"+hex.slice(12,16)+"-"+hex.slice(16,20)+"-"+hex.slice(20);
    }
    return requests[key];
  }
  function formBody(){
    var body={email:$("invite-email").value.trim(),tier:$("invite-tier").value,days:Number($("invite-days").value),subject:$("invite-subject").value,message:$("invite-message").value};
    if(source)body.sourceId=source.id;
    return body;
  }
  function compose(row){
    if(!allowed||busy)return;source=row||null;invalidate();
    if(row){
      $("invite-email").value=row.email;$("invite-tier").value=row.tier;$("invite-days").value=row.days;
      $("invite-subject").value=row.subject||"You are invited to Traffic and Dragons";
      $("invite-message").value=row.message||"You are invited to play Traffic and Dragons.";
      status("Edit and preview this replacement invitation. The existing link stays valid until you send its replacement.",false);
    }else{$("invite-form").reset();status("Personalize your message, then preview the full email before sending.",false);}
    lock(false);$("invitations").open=true;$("invite-form").scrollIntoView({block:"start"});$("invite-subject").focus();
  }
  function render(){
    $("invite-list").textContent="";
    rows.forEach(function(r){
      var item=node("details",""),heading=node("summary",r.email+" — "+r.status);item.className="invite-entry";item.open=r.id===lastSaved;item.appendChild(heading);
      item.appendChild(node("p",r.tier+" · "+r.days+" days from acceptance"));
      item.appendChild(node("p","Sent "+new Date(r.createdAt).toLocaleString()+" · Link expires "+new Date(r.expiresAt).toLocaleString()));
      if(r.acceptedAt)item.appendChild(node("p","Accepted "+new Date(r.acceptedAt).toLocaleString()));
      item.appendChild(node("p","Email: "+(r.delivery?r.delivery.message:"No delivery receipt available.")));
      if(r.subject)item.appendChild(node("h4",r.subject));
      if(r.message){var copy=node("pre",r.message);copy.className="mail-copy";item.appendChild(copy);}
      if(r.status!=="accepted"){
        var actions=node("div","");actions.className="mail-actions";
        [{key:"resend",label:"Resend invitation"},{key:"revoke",label:"Revoke invitation"}].forEach(function(action){
          if(action.key==="revoke"&&r.status==="revoked")return;
          var b=node("button",action.label);b.type="button";b.setAttribute("data-invite-action",action.key);
          b.addEventListener("click",function(){if(action.key==="resend")compose(r);else revoke(r);});actions.appendChild(b);
        });item.appendChild(actions);
      }
      $("invite-list").appendChild(item);
    });lock(busy);
  }
  function save(row){
    rows=rows.filter(function(r){return r.id!==row.id;});
    if(row.replacesId)rows.forEach(function(r){if(r.id===row.replacesId)r.status="revoked";});
    rows.unshift(row);lastSaved=row.id;render();
  }
  function finish(key,err,row){
    lock(false);if(!allowed)return;
    if(err||!row||!row.id){status("Invitation request failed: "+(err||"invalid response")+". Load history before trying again; repeating the same action safely checks its saved receipt.",true);return;}
    delete requests[key];save(row);invalidate();
    if(row.status==="revoked"){status("Invitation revoked. Its link can no longer approve an account.",false);return;}
    source=null;lock(false);var receipt=row.delivery;
    status(receipt&&receipt.status==="accepted"?"Invitation accepted by the mail service. Inbox delivery is not yet confirmed.":"Invitation saved. "+(receipt?receipt.message:"No delivery receipt available."),!receipt||receipt.status!=="accepted");
  }
  function history(){
    if(!allowed||busy)return;lock(true);status("Loading invitations…",false);
    storageAdapter.listInvitations(function(err,data){
      lock(false);if(!allowed)return;
      if(err||!Array.isArray(data)){status("Invitation history unavailable: "+(err||"invalid response"),true);return;}
      rows=data;loaded=true;render();status(rows.length?"Latest "+rows.length+" invitations. Open an entry to inspect its message, delivery or link.":"No invitations yet. Personalize your message below, then preview it.",false);
    });
  }
  function revoke(row){
    if(!allowed||busy||!window.confirm("Revoke the invitation for "+row.email+"? Its link will stop working."))return;
    lock(true);status("Revoking invitation…",false);
    storageAdapter.revokeInvitation(row.id,function(err,data){finish("revoke:"+row.id,err,data);});
  }
  $("invite-form").addEventListener("submit",function(e){
    e.preventDefault();if(!allowed||busy)return;
    var body=formBody();invalidate();lock(true);status("Preparing the email preview…",false);
    storageAdapter.previewInvitation(body,function(err,data){
      lock(false);if(!allowed)return;
      if(err||!data||typeof data.subject!=="string"||typeof data.text!=="string"||!data.previewHash){status("Invitation preview failed: "+(err||"invalid response"),true);return;}
      preview={body:body,hash:data.previewHash};$("invite-review").textContent="";
      $("invite-review").appendChild(node("h3","Review your invitation"));
      $("invite-review").appendChild(node("p","To: "+data.to));
      $("invite-review").appendChild(node("h4",data.subject));
      var copy=node("pre",data.text);copy.className="mail-copy";$("invite-review").appendChild(copy);
      $("invite-review").appendChild(node("p","The secure link is generated when you send. Everything else appears as shown."));
      $("invite-review").hidden=false;lock(false);status("Review the full email below, then choose Send Invitation. Nothing has been sent.",false);
    });
  });
  ["invite-email","invite-tier","invite-days","invite-subject","invite-message"].forEach(function(id){
    ["input","change"].forEach(function(event){$(id).addEventListener(event,function(){if(!busy){invalidate();status("Invitation changed. Preview again before sending.",false);}});});
  });
  $("invite-send").addEventListener("click",function(){
    if(!allowed||busy||!preview)return;
    if(JSON.stringify(formBody())!==JSON.stringify(preview.body)){invalidate();status("Invitation changed. Preview again before sending.",true);return;}
    var body=Object.assign({},preview.body),prompt=source?
      "Send a fresh invitation to "+body.email+"? The previous link stops working. If delivery was uncertain, this sends another email.":
      "Send an invitation to "+body.email+" for "+body.days+" days of "+body.tier+" access?";
    if(!window.confirm(prompt))return;
    var key="send:"+preview.hash;body.requestId=requestId(key);body.previewHash=preview.hash;
    lock(true);status("Sending invitation…",false);
    if(source)storageAdapter.resendInvitation(source.id,body,function(err,data){finish(key,err,data);});
    else storageAdapter.sendInvitation(body,function(err,data){finish(key,err,data);});
  });
  $("invite-new").addEventListener("click",function(){compose(null);});
  $("invite-history").addEventListener("click",history);
  window.AdminInvitations={isBusy:function(){return busy;},enable:function(value){
    allowed=value;lock(busy);
    if(!value){loaded=false;rows=[];source=null;invalidate();render();status("",false);}
    else if(!loaded&&!busy)history();
  }};
  lock(false);
})();
