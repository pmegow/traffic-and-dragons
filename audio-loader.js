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

function audioVerifyBytes(bytes,asset){
  return crypto.subtle.digest("SHA-256",bytes).then(function(hash){
    var hex=Array.prototype.map.call(new Uint8Array(hash),function(b){return (b<16?"0":"")+b.toString(16);}).join("");
    if(hex!==asset.sha256)throw new Error("Ambience asset checksum does not match the catalog");
    return bytes;
  });
}
