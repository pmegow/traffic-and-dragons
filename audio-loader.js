// The reader enforces the cap while bytes arrive; Content-Length is only an early refusal.
function audioReadBytes(response,limit,signal){
  if(!response||!response.ok)return Promise.reject(new Error("Ambience download failed (HTTP "+(response&&response.status)+")"));
  if(Number(response.headers.get("Content-Length"))>limit)return Promise.reject(new Error("Ambience download exceeds its size limit"));
  if(!response.body||!response.body.getReader)return Promise.reject(new Error("This browser cannot read bounded audio downloads"));
  var reader=response.body.getReader(),chunks=[],size=0;
  function read(){return reader.read().then(function(part){
    if(signal&&signal.aborted)throw new Error("Ambience download cancelled");
    if(part.done){var bytes=new Uint8Array(size),offset=0;chunks.forEach(function(c){bytes.set(c,offset);offset+=c.byteLength;});chunks=[];return bytes.buffer;}
    size+=part.value.byteLength;if(size>limit)throw new Error("Ambience download exceeds its size limit");
    chunks.push(part.value);return read();
  });}
  return read().catch(function(e){chunks=[];return Promise.resolve(reader.cancel()).catch(function(cancelError){console.warn("[audio] stream cancellation failed: "+cancelError.message);}).then(function(){throw e;});});
}
// A catalog asset carries ONE audio file: a looping bed, or an accent set's sprite (§21). Every url/limit lookup goes through here.
function audioAssetMedia(asset){return asset.bed||asset.sprite;}
function createAudioLoader(context,catalog){
  var records=[],budget=48*1024*1024;
  function used(){return records.reduce(function(n,r){return n+r.bytes;},0);}
  function release(buffer){for(var i=records.length-1;i>=0;i--)if(records[i].buffer===buffer)records.splice(i,1);}
  function drop(record){var i=records.indexOf(record);if(i>=0)records.splice(i,1);}
  return {
    load:function(scene,signal){
      var cannot=audioPageRefusal();if(cannot)return Promise.reject(new Error(cannot));/* #502: refuse BEFORE the download — a page that cannot verify fetched every scene's audio only to fail at the checksum */
      var bed=audioAssetMedia(scene),asset=catalog.assets.filter(function(a){return audioAssetMedia(a).url===bed.url;})[0];
      if(!asset)return Promise.reject(new Error("Audio asset is absent from the delivery catalog"));
      if(records.some(function(r){return !r.buffer;}))return Promise.reject(new Error("Another audio decode is still settling"));
      var reserve=bed.maxDecodedBytes;
      if(used()+reserve>budget)return Promise.reject(new Error("Ambience decoded-memory budget exhausted"));
      var record={bytes:reserve,buffer:null};records.push(record);
      var abort=new AbortController(),timer=setTimeout(function(){abort.abort();},15000);
      function cancel(){abort.abort();}signal.addEventListener("abort",cancel);if(signal.aborted)cancel();
      function cleanup(){clearTimeout(timer);signal.removeEventListener("abort",cancel);}
      return fetch(bed.url,{signal:abort.signal}).then(function(r){return audioReadBytes(r,Math.min(bed.maxBytes,8*1024*1024),abort.signal);}).then(function(bytes){
        if(abort.signal.aborted)throw new Error("Ambience download cancelled or timed out");
        return audioVerifyBytes(bytes,asset).then(function(){
          if(abort.signal.aborted)throw new Error("Ambience download cancelled or timed out");
          return new Promise(function(resolve,reject){context.decodeAudioData(bytes,resolve,reject);});
        });
      }).then(function(buffer){
        if(abort.signal.aborted)throw new Error("Ambience decode cancelled or timed out");
        if(scene.sprite)audioValidateSprite(buffer,bed);else ambientValidateBuffer(buffer,bed);record.buffer=buffer;record.bytes=buffer.length*buffer.numberOfChannels*4;cleanup();return buffer;
      }).catch(function(e){cleanup();drop(record);throw new Error(e.name==="AbortError"?"Ambience download cancelled or timed out; use Enable audio to retry":e.message||"Ambience decoding failed");});
    },
    release:release,
    inspect:function(){return {decodedBytes:used(),reservedDecodes:records.filter(function(r){return !r.buffer;}).length,bufferRecords:records.length};}
  };
}

/* #502: can a page verify an audio download? The checksum needs SubtleCrypto, which a browser exposes only in a secure
   context (https, or localhost). On plain http — the game served to a phone over the LAN — `crypto.subtle` is undefined: the
   checksum threw "Cannot read properties of undefined (reading 'digest')" and that is what the player was told, after every
   scene had downloaded its audio for nothing. ONE rule, three readers: the loader refuses before it downloads, the checksum
   refuses on its own (a rejected promise in plain words — never a TypeError, never a pass), and the ambience shell says it
   once and starts nothing (ui-ambient.js). audioVerifyRefusal is pure over the crypto object it is handed; audioPageRefusal
   asks it about THIS page. Both return null, or the reason. */
var AUDIO_INSECURE_PAGE="This page is not secure (plain http), so the audio cannot be verified. Open the hosted game or localhost.";
function audioVerifyRefusal(c){return (c&&c.subtle&&typeof c.subtle.digest==="function")?null:AUDIO_INSECURE_PAGE;}
function audioPageRefusal(){return audioVerifyRefusal(typeof crypto!=="undefined"?crypto:null);}
function audioVerifyBytes(bytes,asset){
  var cannot=audioPageRefusal();if(cannot)return Promise.reject(new Error(cannot));
  return crypto.subtle.digest("SHA-256",bytes).then(function(hash){
    var hex=Array.prototype.map.call(new Uint8Array(hash),function(b){return (b<16?"0":"")+b.toString(16);}).join("");
    if(hex!==asset.sha256)throw new Error("Ambience asset checksum does not match the catalog");
    return bytes;
  });
}
