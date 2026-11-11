// The Designer owns one atomic working copy. The legacy localStorage value stays a recovery backup.
var DesignerDrafts=(function(){
  "use strict";
  var DATABASE="bpd_drafts_v1",LEGACY="bpd_draft_v1";
  function problem(message,code){var e=new Error(message);e.code=code||"storage";return e;}
  function validPayload(p){return p&&typeof p==="object"&&p.bp&&typeof p.bp==="object"&&typeof p.bp.format==="string"&&!!p.bp.format;}
  function checkRow(row){if(row&&(row.schema!==1||typeof row.revision!=="number"||Math.floor(row.revision)!==row.revision||row.revision<1||row.revision>9007199254740990||!validPayload(row.payload)))throw problem("The saved draft is damaged or uses an unsupported format. Download its recovery copy before continuing.","damaged");}
  function savedRevision(row){return row&&typeof row.revision==="number"&&isFinite(row.revision)&&row.revision>=0&&row.revision<9007199254740990?Math.floor(row.revision):0;}
  function create(options){
    options=options||{};
    var idb=options.indexedDB||(typeof indexedDB!=="undefined"?indexedDB:null),readLegacy=options.readLegacy||function(){return localStorage.getItem(LEGACY);};
    var opened=null,revision=null,legacyRaw=null,closed=false;
    function open(){
      if(opened)return opened;
      opened=new Promise(function(resolve,reject){
        if(!idb){reject(problem("This browser does not provide IndexedDB draft storage."));return;}
        var done=false,request,timer=setTimeout(function(){fail(problem("Opening draft storage timed out. Close other Designer tabs and retry."));},8000);
        function fail(e){if(done)return;done=true;clearTimeout(timer);reject(e);}
        try{request=idb.open(options.name||DATABASE,1);}catch(e){fail(e);return;}
        request.onupgradeneeded=function(){if(!request.result.objectStoreNames.contains("drafts"))request.result.createObjectStore("drafts");};
        request.onerror=function(){fail(request.error||problem("Could not open draft storage."));};
        request.onblocked=function(){fail(problem("Another tab is blocking draft storage. Close other Designer tabs and retry."));};
        request.onsuccess=function(){var db=request.result;if(done||closed){db.close();if(!done)fail(problem("Draft storage opening was cancelled."));return;}done=true;clearTimeout(timer);db.onversionchange=function(){db.close();opened=null;revision=null;};resolve(db);};
      });
      opened=opened.catch(function(e){opened=null;throw e;});return opened;
    }
    function read(){return open().then(function(db){return new Promise(function(resolve,reject){
      var tx=db.transaction("drafts","readonly"),s=tx.objectStore("drafts"),current=s.get("current"),legacy=s.get("legacy"),retained=s.get("recovery");
      tx.oncomplete=function(){resolve({current:current.result||null,legacy:legacy.result||null,retained:retained.result||null});};
      tx.onabort=function(){reject(tx.error||problem("Reading the saved draft was interrupted."));};
    });});}
    function commit(payload,expected,raw,displaced){return open().then(function(db){return new Promise(function(resolve,reject){
      var tx=db.transaction("drafts","readwrite"),s=tx.objectStore("drafts"),failure=null,next=expected+1;
      tx.onabort=function(){reject(failure||tx.error||problem("The draft write was interrupted; the previous saved copy is intact."));};
      tx.oncomplete=function(){revision=next;legacyRaw=raw;resolve();};
      s.get("current").onsuccess=function(ev){try{
        var row=ev.target.result;
        if(!displaced)checkRow(row);
        if(displaced?JSON.stringify(row)!==JSON.stringify(displaced):(row?row.revision:0)!==expected)throw problem("Another Designer tab saved a newer draft. Save this tab as a .blueprint file before reloading.","conflict");
        if(readLegacy()!==raw)throw problem("An older Designer tab changed the legacy draft. Save this tab as a .blueprint file, then reload to choose a recovery copy.","legacy");
        function put(){s.put({schema:1,revision:next,payload:payload},"current");if(raw!==null)s.put({raw:raw},"legacy");}
        if(displaced){
          s.get("recovery").onsuccess=function(found){try{
            if(found.target.result)throw problem("A prior recovery backup is still stored. Download it and remove that backup before choosing another legacy copy.","recovery");
            s.put(displaced,"recovery");put();
          }catch(e){failure=e;tx.abort();}};
        }else put();
      }catch(e){failure=e;tx.abort();}};
    });});}
    function load(choice,replacement){return read().then(function(saved){
      var raw=readLegacy(),row=saved.current,payload=null,legacyText=raw===null&&choice==="legacy"&&saved.legacy?saved.legacy.raw:raw;
      try{
        if(choice==="new"){
          if(!validPayload(replacement))throw problem("A replacement draft was not provided.");
          return commit(replacement,savedRevision(row),raw,row).then(function(){return replacement;});
        }
        if(choice!=="legacy"||!legacyText)checkRow(row);
        if(legacyText&&(choice==="legacy"||!row||!saved.legacy||saved.legacy.raw!==raw)){
          if(choice==="saved"&&row){payload=row.payload;}
          else {
            try{payload=JSON.parse(legacyText);}catch(e){throw problem("The legacy draft is not readable JSON. Download its recovery copy before continuing.","legacy");}
            if(!validPayload(payload))throw problem("The legacy draft has an unsupported format. Download its recovery copy before continuing.","legacy");
            if(row&&choice!=="legacy")throw problem("Two different drafts are stored on this device. Download copies or choose which one to continue.","legacy");
          }
          return commit(payload,savedRevision(row),raw,choice==="legacy"?row:null).then(function(){
            if(readLegacy()!==raw)throw problem("The legacy draft changed during recovery. Retry to choose between the preserved copies.","legacy");
            return payload;
          });
        }
        revision=row?row.revision:0;legacyRaw=raw;return row?row.payload:null;
      }catch(e){e.saved=row;e.legacy=raw;throw e;}
    });}
    return {
      load:load,
      write:function(payload){if(revision===null)return Promise.reject(problem("Draft storage has not finished loading. Reload before editing."));if(!validPayload(payload))return Promise.reject(problem("The working draft has an unsupported format."));return commit(payload,revision,legacyRaw);},
      recovery:function(){
        var raw;try{raw=readLegacy();}catch(e){return Promise.reject(e);}
        return read().then(function(saved){return {saved:saved.current,legacy:raw===null&&saved.legacy?saved.legacy.raw:raw,retained:saved.retained};},function(e){return {saved:null,legacy:raw,retained:null,error:e};});
      },
      removeRecovery:function(expected){return open().then(function(db){return new Promise(function(resolve,reject){
        var tx=db.transaction("drafts","readwrite"),s=tx.objectStore("drafts"),failure=null;
        s.get("recovery").onsuccess=function(e){if(JSON.stringify(e.target.result)!==JSON.stringify(expected)){failure=problem("The recovery backup changed. Reload before removing it.","conflict");tx.abort();return;}s.delete("recovery");};
        tx.oncomplete=function(){resolve();};tx.onabort=function(){reject(failure||tx.error||problem("The recovery backup could not be removed."));};
      });});},
      close:function(){closed=true;if(opened)opened.then(function(db){db.close();},function(){});opened=null;revision=null;}
    };
  }
  // One writer serializes transactions. A completion may acknowledge only the snapshot it wrote.
  function writer(adapter,snapshot,notify,delay){
    var requested=0,completed=0,timer=null,running=null,error=null,stopped=false;
    function paint(kind,e){notify({kind:kind,error:e||null});}
    function cancelTimer(){if(timer!==null){clearTimeout(timer);timer=null;}}
    function flush(){
      cancelTimer();if(running)return running;
      if(error)return Promise.reject(error);
      if(stopped||requested===completed)return Promise.resolve();
      var serial=requested,payload;
      try{payload=JSON.parse(JSON.stringify(snapshot()));}catch(e){error=e;paint("error",e);return Promise.reject(e);}
      running=Promise.resolve().then(function(){return adapter.write(payload);}).then(function(){
        completed=serial;running=null;
        if(requested!==completed)return flush();
        if(!stopped)paint("saved");
      },function(e){running=null;error=e;if(!stopped)paint("error",e);throw e;});
      return running;
    }
    return {
      schedule:function(){if(stopped)return;requested++;cancelTimer();if(error)return;paint("pending");timer=setTimeout(function(){timer=null;flush().catch(function(){});},delay===undefined?400:delay);},
      flush:flush,
      retry:function(){if(error&&(error.code==="conflict"||error.code==="legacy"))return Promise.reject(error);error=null;paint("pending");return flush();},
      unsettled:function(){return requested!==completed||!!error;},
      close:function(){stopped=true;cancelTimer();}
    };
  }
  return {create:create,writer:writer,database:DATABASE,legacyKey:LEGACY};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=DesignerDrafts;
