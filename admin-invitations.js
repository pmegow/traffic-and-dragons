// Operator invitation controls. The server owns recipient validation, expiry and approval.
(function(){
  var allowed=false,busy=false,loaded=false,rows=[],requests={};
  function $(id){return document.getElementById(id);}
  function node(tag,text){var n=document.createElement(tag);n.textContent=text;return n;}
  function status(text,bad){$("invite-status").textContent=text;$("invite-status").className=bad?"error":"sub";if(bad)console.warn("[invitations] "+text);}
  function lock(value){
    busy=value;
    ["invite-email","invite-tier","invite-days","invite-send","invite-history"].forEach(function(id){$(id).disabled=busy||!allowed;});
    Array.prototype.forEach.call($("invite-list").querySelectorAll("button"),function(b){b.disabled=busy||!allowed;});
  }
  function requestId(key){
    if(!requests[key]){
      var bytes=new Uint8Array(16);window.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
      var hex=Array.prototype.map.call(bytes,function(b){return("0"+b.toString(16)).slice(-2);}).join("");
      requests[key]=hex.slice(0,8)+"-"+hex.slice(8,12)+"-"+hex.slice(12,16)+"-"+hex.slice(16,20)+"-"+hex.slice(20);
    }
    return requests[key];
  }
  function render(){
    $("invite-list").textContent="";
    rows.forEach(function(r){
      var item=node("details",""),heading=node("summary",r.email+" — "+r.status);item.className="invite-entry";item.appendChild(heading);
      item.appendChild(node("p",r.tier+" · "+r.days+" days from acceptance"));
      item.appendChild(node("p","Sent "+new Date(r.createdAt).toLocaleString()+" · Link expires "+new Date(r.expiresAt).toLocaleString()));
      if(r.acceptedAt)item.appendChild(node("p","Accepted "+new Date(r.acceptedAt).toLocaleString()));
      item.appendChild(node("p","Email: "+(r.delivery?r.delivery.message:"No delivery receipt available.")));
      if(r.status!=="accepted"){
        var actions=node("div","");actions.className="mail-actions";
        [{key:"resend",label:"Resend invitation"},{key:"revoke",label:"Revoke invitation"}].forEach(function(action){
          if(action.key==="revoke"&&r.status==="revoked")return;
          var b=node("button",action.label);b.type="button";b.setAttribute("data-invite-action",action.key);
          b.addEventListener("click",function(){change(r,action.key);});actions.appendChild(b);
        });item.appendChild(actions);
      }
      $("invite-list").appendChild(item);
    });lock(busy);
  }
  function save(row){
    rows=rows.filter(function(r){return r.id!==row.id;});
    if(row.replacesId)rows.forEach(function(r){if(r.id===row.replacesId)r.status="revoked";});
    rows.unshift(row);render();
  }
  function finish(key,err,row){
    lock(false);if(!allowed)return;
    if(err||!row||!row.id){status("Invitation request failed: "+(err||"invalid response")+". Load history before trying again; repeating the same action safely checks its saved receipt.",true);return;}
    delete requests[key];save(row);
    if(row.status==="revoked"){status("Invitation revoked. Its link can no longer approve an account.",false);return;}
    var receipt=row.delivery;
    status(receipt&&receipt.status==="accepted"?"Invitation accepted by the mail service. Inbox delivery is not yet confirmed.":"Invitation saved. "+(receipt?receipt.message:"No delivery receipt available."),!receipt||receipt.status!=="accepted");
  }
  function history(){
    if(!allowed||busy)return;lock(true);status("Loading invitations…",false);
    storageAdapter.listInvitations(function(err,data){
      lock(false);if(!allowed)return;
      if(err||!Array.isArray(data)){status("Invitation history unavailable: "+(err||"invalid response"),true);return;}
      rows=data;loaded=true;render();status(rows.length?"Latest "+rows.length+" invitations. Open an entry to inspect delivery or manage its link.":"No invitations yet.",false);
    });
  }
  function change(row,action){
    if(!allowed||busy)return;
    var prompt=action==="resend"?"Send a fresh invitation to "+row.email+"? The previous link stops working; the new link expires in 7 days. If delivery was uncertain, this sends another email.":"Revoke the invitation for "+row.email+"? Its link will stop working.";
    if(!window.confirm(prompt))return;
    var key=action+":"+row.id;lock(true);status(action==="resend"?"Sending replacement invitation…":"Revoking invitation…",false);
    if(action==="resend")storageAdapter.resendInvitation(row.id,{requestId:requestId(key)},function(err,data){finish(key,err,data);});
    else storageAdapter.revokeInvitation(row.id,function(err,data){finish(key,err,data);});
  }
  $("invite-form").addEventListener("submit",function(e){
    e.preventDefault();if(!allowed||busy)return;
    var email=$("invite-email").value.trim(),tier=$("invite-tier").value,days=Number($("invite-days").value);
    if(!/^[a-z0-9]+(?:\.[a-z0-9]+)*(?:\+[a-z0-9._-]+)?@gmail\.com$/i.test(email)||days<1||days>3650||Math.floor(days)!==days){status("Enter a Gmail address and 1–3650 whole days of access.",true);return;}
    if(!window.confirm("Send an invitation to "+email+" for "+days+" days of "+tier+" access? Access starts when they accept with Google."))return;
    var key="send:"+email.toLowerCase()+":"+tier+":"+days;
    var body={email:email,tier:tier,days:days,requestId:requestId(key)};
    lock(true);status("Sending invitation…",false);storageAdapter.sendInvitation(body,function(err,data){finish(key,err,data);});
  });
  $("invite-history").addEventListener("click",history);
  window.AdminInvitations={isBusy:function(){return busy;},enable:function(value){
    allowed=value;lock(busy);
    if(!value){loaded=false;rows=[];render();status("",false);}
    else if(!loaded&&!busy)history();
  }};
  lock(false);
})();
