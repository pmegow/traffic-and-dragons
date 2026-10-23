// dev/measure-pcm.js — #659: measures a mono 16-bit PCM file the way the dice sound was tuned to the owner's reference
// (2026-10-23): the RMS envelope in 5 ms frames, every onset (a frame 6 dB over the previous four and above a tenth of the
// loudest, 25 ms apart at least) with its peak, decay to -20 dB and the strongest bands over its first 40 ms (Goertzel at
// fifteen bands), and the band balance over the active frames. Decode first:
//   ffmpeg -i Audio/Inspiration/dice.mp3 -ac 1 -ar 48000 -f s16le dice.pcm
//   node dev/measure-pcm.js dice.pcm 48000 "reference"
// The same arithmetic runs in the page against an OfflineAudioContext render of a recipe (the first Sound.play of a fresh
// page — sound.js keeps its first context); the numbers in TODO #659 came from both sides of that comparison.
// Measures a mono 16-bit PCM file: RMS envelope, transients (onsets), each one's peak, decay and spectral bands.
// Usage: node analyze-pcm.js <file.pcm> <sampleRate> [label]
var fs=require("fs");
var file=process.argv[2],sr=Number(process.argv[3]||48000),label=process.argv[4]||file;
var buf=fs.readFileSync(file),n=buf.length/2,x=new Float64Array(n),i;
for(i=0;i<n;i++)x[i]=buf.readInt16LE(i*2)/32768;
var peakAll=0;for(i=0;i<n;i++)if(Math.abs(x[i])>peakAll)peakAll=Math.abs(x[i]);
var frame=Math.round(sr*0.005),frames=Math.floor(n/frame),rms=new Float64Array(frames),f;
for(f=0;f<frames;f++){var s=0;for(i=f*frame;i<(f+1)*frame;i++)s+=x[i]*x[i];rms[f]=Math.sqrt(s/frame);}
var floor=0;{var sorted=Array.from(rms).sort(function(a,b){return a-b;});floor=sorted[Math.floor(sorted.length*0.2)]||1e-6;}
var maxRms=Math.max.apply(null,Array.from(rms));
/* onsets: a frame at least 6 dB above the mean of the previous 4 frames and above 10% of the loudest frame, with a 25 ms refractory */
var onsets=[],lastOn=-100;
for(f=4;f<frames;f++){var prev=(rms[f-1]+rms[f-2]+rms[f-3]+rms[f-4])/4;if(rms[f]>prev*2&&rms[f]>maxRms*0.1&&f-lastOn>=5){onsets.push(f);lastOn=f;}}
function goertzel(start,len,freq){var k=2*Math.PI*freq/sr,c=2*Math.cos(k),s0=0,s1=0,s2=0,j;for(j=0;j<len;j++){var v=start+j<n?x[start+j]:0;s0=v+c*s1-s2;s2=s1;s1=s0;}return Math.sqrt(Math.max(0,s1*s1+s2*s2-c*s1*s2))/len;}
var bands=[100,150,200,300,400,600,800,1000,1400,2000,2800,4000,5600,8000,11000];
function dB(v){return 20*Math.log10(Math.max(v,1e-9));}
console.log("== "+label+": "+(n/sr).toFixed(2)+" s, peak "+dB(peakAll).toFixed(1)+" dBFS, loudest 5 ms frame RMS "+dB(maxRms).toFixed(1)+" dBFS, floor "+dB(floor).toFixed(1)+" dBFS, "+onsets.length+" onsets");
var active=0;for(f=0;f<frames;f++)if(rms[f]>maxRms*0.05)active++;
console.log("   active (above -26 dB of the loudest frame): "+(active*0.005).toFixed(2)+" s");
onsets.forEach(function(f0,idx){
  var t=f0*0.005,pk=rms[f0];var e=f0;while(e<frames&&rms[e]>pk*0.1)e++;var decay=(e-f0)*0.005;
  var win=Math.round(sr*0.04),st=f0*frame,mags=bands.map(function(b){return goertzel(st,win,b);}),tot=mags.reduce(function(a,b){return a+b;},0)||1e-9;
  var cent=bands.reduce(function(a,b,i){return a+b*mags[i];},0)/tot;
  var top=bands.map(function(b,i){return [b,mags[i]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,4).map(function(p){return p[0]+"Hz "+dB(p[1]).toFixed(0);});
  var gap=idx?((f0-onsets[idx-1])*5)+" ms after prev":"first";
  console.log("   onset "+(idx+1)+" at "+t.toFixed(3)+"s ("+gap+"): peak "+dB(pk).toFixed(1)+" dB, decay to -20 dB "+Math.round(decay*1000)+" ms, centroid "+Math.round(cent)+" Hz, top bands "+top.join(", "));
});
/* the whole-file band balance over active frames */
var sum=bands.map(function(){return 0;}),cnt=0;
for(f=0;f<frames;f++){if(rms[f]<=maxRms*0.05)continue;cnt++;bands.forEach(function(b,i){sum[i]+=goertzel(f*frame,frame*4,b);});}
console.log("   band balance (dB, active frames): "+bands.map(function(b,i){return b+":"+dB(sum[i]/Math.max(1,cnt)).toFixed(0);}).join(" "));
/* the envelope, 50 ms steps */
var env=[];for(f=0;f<frames;f+=10){var m=0;for(i=f;i<Math.min(frames,f+10);i++)if(rms[i]>m)m=rms[i];env.push(dB(m).toFixed(0));}
console.log("   envelope (dB per 50 ms): "+env.join(" "));
