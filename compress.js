// compress.js — self-contained LZ-string (UTF-16) compression, no dependencies (TODO Known issue #3).
// Purpose: keep the append-only worldState.transcript (the dominant, ever-growing part of a mature save —
// 54% of a t308 Runelords blob) from bloating localStorage past the mobile quota. The in-memory state and
// .tnd exports keep the plain array; the localStorage boundary stores {__lz} (#92 superseded the original
// "server sync keeps the plain array" rule — the sync POST ships the compressed form too, and #272 D3 adds
// packWire/unpackWire below so the NETWORK boundary can carry the same bit stream in ASCII).
//
// Algorithm: the public-domain LZString compressToUTF16 / decompressFromUTF16 (Pieroxy, lz-string, MIT).
// compressToUTF16 packs into 15 bits per UTF-16 code unit (offset +32) so the result is a valid, dense
// localStorage string. Reproduced faithfully and covered by a round-trip test on the real transcript —
// this stores save data, so correctness is non-negotiable (a compressor bug would CAUSE data loss).
var LZ=(function(){
  var f=String.fromCharCode;
  function _compress(uncompressed,bitsPerChar,getCharFromInt){
    if(uncompressed==null)return "";
    var i,value,context_dictionary={},context_dictionaryToCreate={},context_c="",context_wc="",context_w="",
        context_enlargeIn=2,context_dictSize=3,context_numBits=2,context_data=[],context_data_val=0,context_data_position=0,ii;
    function _out(){if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0;}else{context_data_position++;}}
    function _emit(v,bits){for(i=0;i<bits;i++){context_data_val=(context_data_val<<1)|(v&1);_out();v=v>>1;}}
    function _emitZeros(bits){for(i=0;i<bits;i++){context_data_val=(context_data_val<<1);_out();}}
    function _flushW(){
      if(Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)){
        if(context_w.charCodeAt(0)<256){_emitZeros(context_numBits);_emit(context_w.charCodeAt(0),8);}
        else{ // 16-bit char marker
          value=1;for(i=0;i<context_numBits;i++){context_data_val=(context_data_val<<1)|value;_out();value=0;}
          _emit(context_w.charCodeAt(0),16);
        }
        context_enlargeIn--;if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++;}
        delete context_dictionaryToCreate[context_w];
      }else{_emit(context_dictionary[context_w],context_numBits);}
      context_enlargeIn--;if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++;}
    }
    for(ii=0;ii<uncompressed.length;ii+=1){
      context_c=uncompressed.charAt(ii);
      if(!Object.prototype.hasOwnProperty.call(context_dictionary,context_c)){context_dictionary[context_c]=context_dictSize++;context_dictionaryToCreate[context_c]=true;}
      context_wc=context_w+context_c;
      if(Object.prototype.hasOwnProperty.call(context_dictionary,context_wc)){context_w=context_wc;}
      else{_flushW();context_dictionary[context_wc]=context_dictSize++;context_w=String(context_c);}
    }
    if(context_w!==""){_flushW();}
    value=2;_emit(value,context_numBits); // end marker
    while(true){context_data_val=(context_data_val<<1);if(context_data_position==bitsPerChar-1){context_data.push(getCharFromInt(context_data_val));break;}else context_data_position++;}
    return context_data.join('');
  }
  function _decompress(length,resetValue,getNextValue){
    var dictionary=[],next,enlargeIn=4,dictSize=4,numBits=3,entry="",result=[],i,w,bits,resb,maxpower,power,c,
        data={val:getNextValue(0),position:resetValue,index:1};
    function _read(nbits){bits=0;maxpower=Math.pow(2,nbits);power=1;while(power!=maxpower){resb=data.val&data.position;data.position>>=1;if(data.position==0){data.position=resetValue;data.val=getNextValue(data.index++);}bits|=(resb>0?1:0)*power;power<<=1;}return bits;}
    for(i=0;i<3;i+=1){dictionary[i]=i;}
    switch(next=_read(2)){
      case 0:c=f(_read(8));break;
      case 1:c=f(_read(16));break;
      case 2:return "";
    }
    dictionary[3]=c;w=c;result.push(c);
    while(true){
      if(data.index>length){return "";}
      c=_read(numBits);
      switch(c){
        case 0:dictionary[dictSize++]=f(_read(8));c=dictSize-1;enlargeIn--;break;
        case 1:dictionary[dictSize++]=f(_read(16));c=dictSize-1;enlargeIn--;break;
        case 2:return result.join('');
      }
      if(enlargeIn==0){enlargeIn=Math.pow(2,numBits);numBits++;}
      if(dictionary[c]){entry=dictionary[c];}else{if(c===dictSize){entry=w+w.charAt(0);}else{return null;}}
      result.push(entry);
      dictionary[dictSize++]=w+entry.charAt(0);enlargeIn--;
      w=entry;
      if(enlargeIn==0){enlargeIn=Math.pow(2,numBits);numBits++;}
    }
  }
  // #272 D3: 6-bit ASCII repack of the 15-bit compressToUTF16 stream, for the NETWORK boundary.
  // compressToUTF16 output is uniform over 0x20-0x801F, so it encodes at ~2.94 UTF-8 bytes/char on
  // the wire — MORE bytes than the plain JSON it compresses (~1.33x, f69). Repacking the same bit
  // stream at 6 bits/char is pure ASCII (~0.85x plain) and byte-count ≈ char-count, so size
  // telemetry over it is honest for free. The "<charCount>:" prefix pins the exact reconstruction
  // length — tail padding can never mint a phantom 15-bit unit. Pure bit-shuffle, NO
  // re-compression: packWire(compressToUTF16(x)) is fully reversible and unpackWire returns the
  // byte-identical UTF-16 stream (null on any corruption — callers treat null as inflate failure).
  var _WIRE_A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  return {
    compressToUTF16:function(input){if(input==null)return "";return _compress(input,15,function(a){return f(a+32);})+" ";},
    decompressFromUTF16:function(compressed){if(compressed==null)return "";if(compressed=="")return null;return _decompress(compressed.length,16384,function(index){return compressed.charCodeAt(index)-32;});},
    packWire:function(lz){
      if(lz==null||lz==="")return "";
      var out=[],acc=0,nbits=0,i,v;
      for(i=0;i<lz.length;i++){
        v=lz.charCodeAt(i)-32;
        if(v<0||v>32767)return null; // not a compressToUTF16 stream
        acc=(acc<<15)|v;nbits+=15;
        while(nbits>=6){nbits-=6;out.push(_WIRE_A.charAt((acc>>nbits)&63));acc&=(1<<nbits)-1;}
      }
      if(nbits>0)out.push(_WIRE_A.charAt((acc<<(6-nbits))&63));
      return String(lz.length)+":"+out.join("");
    },
    unpackWire:function(s){
      if(s==null||s==="")return "";
      s=String(s);var ci=s.indexOf(":");if(ci<1)return null;
      var n=parseInt(s.slice(0,ci),10);if(!isFinite(n)||n<0)return null;
      if(n===0)return "";
      var R={},ri;for(ri=0;ri<64;ri++)R[_WIRE_A.charAt(ri)]=ri;
      var out=[],acc=0,nbits=0,i,idx;
      for(i=ci+1;i<s.length&&out.length<n;i++){
        idx=R[s.charAt(i)];if(idx===undefined)return null;
        acc=(acc<<6)|idx;nbits+=6;
        if(nbits>=15){nbits-=15;out.push(f(((acc>>nbits)&32767)+32));acc&=(1<<nbits)-1;}
      }
      return out.length===n?out.join(""):null;
    }
  };
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LZ; // node round-trip test only; browser uses the global
