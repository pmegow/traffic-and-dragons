// Release dates are successful production deployment timestamps from the release ledger.
(function(){
  var root=document.getElementById("release-history"),status=document.getElementById("release-status");
  function el(tag,text){var n=document.createElement(tag);n.textContent=text;return n;}
  function valid(r){return r&&typeof r.version==="string"&&/^[a-f0-9]{40}$/.test(r.commit)&&typeof r.releasedAt==="string"&&isFinite(Date.parse(r.releasedAt))&&Array.isArray(r.actions)&&r.actions.length>0&&r.actions.every(function(a){return typeof a==="string"&&a.trim()&&a.trim().split(/\s+/).length<25;});}
  fetch("release-notes.json?admin_console",{cache:"no-store"}).then(function(r){if(!r.ok)throw Error("HTTP "+r.status);return r.json();}).then(function(data){
    if(!data||data.schemaVersion!==1||!Array.isArray(data.releases)||!data.releases.every(valid))throw Error("Invalid release history");
    root.textContent="";
    data.releases.slice().sort(function(a,b){return Date.parse(b.releasedAt)-Date.parse(a.releasedAt);}).forEach(function(r){
      var entry=el("article","");entry.className="release-entry";entry.appendChild(el("h3",r.version));
      var time=el("time",new Date(r.releasedAt).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"long"}));time.dateTime=r.releasedAt;entry.appendChild(time);
      var list=el("ul","");r.actions.forEach(function(a){list.appendChild(el("li",a));});entry.appendChild(list);root.appendChild(entry);
    });
    status.textContent=data.releases.length?"Production releases · dates shown in your local time zone.":"No recorded releases yet.";
  }).catch(function(e){root.textContent="";status.textContent="Release history unavailable: "+e.message;status.className="error";console.warn("[release notes] "+e.message);});
})();
