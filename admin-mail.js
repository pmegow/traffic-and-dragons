// Operator mail composition; the server owns recipient selection and delivery receipts.
(function(){
  var allowed=false,busy=false,loaded=false,job=null;
  function $(id){return document.getElementById(id);}
  function node(tag,text){var n=document.createElement(tag);n.textContent=text;return n;}
  function message(text,bad){$("mail-status").textContent=text;$("mail-status").className=bad?"error":"sub";if(bad)console.warn("[beta mail] "+text);}
  function lock(value){busy=value;["mail-preview","mail-history","mail-subject","mail-body"].forEach(function(id){$(id).disabled=value||!allowed;});$("mail-send").disabled=value||!allowed||!job||!job.deliveries.some(function(d){return d.retryable;});}
  function render(data){
    job=data;$("mail-review").textContent="";$("mail-review").hidden=!data;
    if(!data){lock(busy);return;}
    $("mail-review").appendChild(node("h3",data.subject));
    $("mail-review").appendChild(node("p",new Date(data.createdAt).toLocaleString()+" · "+data.deliveries.length+" unique recipients · "+data.missingEmail+" without email · "+data.duplicates+" duplicate addresses excluded"));
    var body=node("pre",data.text);body.className="mail-copy";$("mail-review").appendChild(body);
    var list=node("ul","");
    data.deliveries.forEach(function(d){list.appendChild(node("li",d.recipient+" — "+d.message));});
    $("mail-review").appendChild(list);lock(busy);
  }
  function history(){
    if(!allowed||busy)return;lock(true);message("Loading recent mailings…",false);
    storageAdapter.listBetaMailings(function(err,data){
      lock(false);if(!allowed)return;
      if(err||!Array.isArray(data)){message("Mailings unavailable: "+(err||"invalid response"),true);return;}
      loaded=true;$("mail-recent").textContent="";
      data.forEach(function(m){var b=node("button",new Date(m.createdAt).toLocaleString()+" · "+m.subject);b.type="button";b.addEventListener("click",function(){if(allowed&&!busy){render(m);message("Saved preview and delivery receipts loaded.",false);}});$("mail-recent").appendChild(b);});
      message(data.length?"Choose a saved mailing to inspect receipts or resume unsent recipients.":"No previous mailings.",false);
    });
  }
  $("mail-preview").addEventListener("click",function(){
    if(!allowed||busy)return;render(null);lock(true);message("Preparing recipient preview…",false);
    storageAdapter.previewBetaMail({subject:$("mail-subject").value,text:$("mail-body").value},function(err,data){
      lock(false);if(!allowed)return;
      if(err||!data||!Array.isArray(data.deliveries)){message("Preview failed: "+(err||"invalid response"),true);return;}
      render(data);message("Review this saved message and recipient list, then send. Preview expires after 24 hours.",false);
    });
  });
  ["mail-subject","mail-body"].forEach(function(id){$(id).addEventListener("input",function(){if(!busy){render(null);message("Message changed. Preview again before sending.",false);}});});
  $("mail-send").addEventListener("click",function(){
    if(!allowed||busy||!job)return;
    var queue=job.deliveries.filter(function(d){return d.retryable;}).map(function(d){return d.id;});
    if(!queue.length||!window.confirm('Send "'+job.subject+'" to '+queue.length+' remaining beta tester(s)? Each receives a separate email.'))return;
    lock(true);
    function next(){
      if(!allowed){lock(false);return;}
      if(!queue.length){lock(false);message("All selected messages accepted by the mail service. Acceptance does not confirm inbox delivery.",false);return;}
      var id=queue.shift();message("Sending… Keep this page open. "+(queue.length+1)+" remaining.",false);
      storageAdapter.sendBetaMail(job.id,id,function(err,data){
        if(!allowed){lock(false);return;}
        if(err||!data||!Array.isArray(data.deliveries)){lock(false);message("Sending stopped: "+(err||"invalid response")+". Load recent mailings to inspect receipts before resuming.",true);return;}
        render(data);var receipt=data.deliveries.filter(function(d){return d.id===id;})[0];
        if(!receipt||receipt.status!=="accepted"){lock(false);message("Sending stopped: "+(receipt?receipt.message:"missing receipt")+". Accepted recipients will not be sent again.",true);return;}
        next();
      });
    }
    next();
  });
  $("mail-history").addEventListener("click",history);
  window.AdminMail={isBusy:function(){return busy;},enable:function(value){allowed=value;lock(busy);if(value&&!loaded&&!busy)history();if(!value){loaded=false;render(null);$("mail-recent").textContent="";}}};
  lock(false);
})();
