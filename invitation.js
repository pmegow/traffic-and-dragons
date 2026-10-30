// Opening a link is inert: only the recipient's explicit Google acceptance can consume it.
(function(){
  var token=window.location.hash.slice(1),pending=false,finished=false,attempt=0;
  function $(id){return document.getElementById(id);}
  function status(message,bad){$("invitation-status").textContent=message;$("invitation-status").className=bad?"error":"";if(bad)console.warn("[invitation] "+message);}
  function lock(value){pending=value;$("invitation-accept").disabled=value||finished;}
  if(!/^[a-f0-9]{64}$/.test(token)){
    $("invitation-accept").disabled=true;status("This invitation link is missing or incomplete. Open the full link from your invitation email.",true);return;
  }
  function accept(){
    if(pending||finished)return;
    var id=++attempt;lock(true);status("Choose the Gmail account that received your invitation.",false);
    var deadline=setTimeout(function(){if(id!==attempt)return;attempt++;lock(false);status("Google sign-in did not finish. Please try again.",true);},310000);
    storageAdapter.loginWithServer("https://traffic-and-dragons-server.fly.dev",function(err){
      if(id!==attempt)return;clearTimeout(deadline);
      if(err){lock(false);status("Could not sign in: "+err,true);return;}
      status("Accepting your invitation…",false);
      storageAdapter.acceptInvitation(token,function(error,data){
        if(id!==attempt)return;
        if(error||!data||data.ok!==true){lock(false);status(error||"The server did not confirm acceptance. Please try again.",true);return;}
        finished=true;lock(false);$("invitation-accept").hidden=true;$("invitation-play").hidden=false;
        status(data.alreadyAccepted?"This invitation has already been accepted by your account.":data.preservedAccess?"Invitation accepted. Your existing access is unchanged.":"Invitation accepted. Your account is approved and ready to play.",false);
      });
    },"google");
  }
  $("invitation-accept").addEventListener("click",accept);
  window.__invitationTest={accept:accept};
})();
