// One worker owns the delivery cache. Insertion order is the bounded LRU order.
function createAudioCache(options){
  var chain=Promise.resolve(),queued=0,limit=32*1024*1024;
  function warn(e){console.warn("[audio cache] "+e.message);if(options.warn)options.warn(e.message);}
  function serve(request){
    var path=new URL(request.url).pathname,asset=options.catalog.assets.filter(function(a){return "/"+audioAssetMedia(a).url===path;})[0];
    if(!asset||request.headers.get("Range"))return options.fetch(request);
    return options.caches.open(options.name).catch(function(e){warn(e);return null;}).then(function(cache){
      if(!cache)return options.fetch(request);
      return cache.match(request).then(function(hit){
        if(hit)return cache.delete(request).then(function(){return cache.put(request,hit.clone());}).then(function(){return hit;}).catch(function(e){warn(e);return hit;});
        return options.fetch(request).then(function(response){
          return audioReadBytes(response,Math.min(audioAssetMedia(asset).maxBytes,8*1024*1024)).then(function(bytes){return audioVerifyBytes(bytes,asset);}).then(function(bytes){
            var headers=new Headers(response.headers);headers.set("Content-Length",String(bytes.byteLength));
            var fresh=new Response(bytes,{status:200,headers:headers});
            return cache.keys().then(function(keys){
              return Promise.all(keys.map(function(k){return cache.match(k).then(function(r){return {key:k,bytes:Number(r.headers.get("Content-Length"))||limit};});}));
            }).then(function(rows){
              var total=rows.reduce(function(n,r){return n+r.bytes;},0),drop=[];
              while(rows.length&&(rows.length>=32||total+bytes.byteLength>limit)){var row=rows.shift();total-=row.bytes;drop.push(cache.delete(row.key));}
              return Promise.all(drop).then(function(){return cache.put(request,fresh.clone());});
            }).then(function(){return fresh;}).catch(function(e){warn(e);return fresh;});
          });
        });
      });
    }).catch(function(e){warn(e);throw e;});
  }
  return {fetch:function(request){
    if(queued>=8)return options.fetch(request);
    queued++;var result=chain.then(function(){return serve(request);});
    chain=result.then(function(){queued--;},function(){queued--;});return result;
  },inspect:function(){return {queued:queued};}};
}
