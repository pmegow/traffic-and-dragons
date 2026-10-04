/* Pure, reusable envelope math. Preview and export consume the same rendered PCM. */
(function(root){
'use strict';
const curves={linear:u=>u,cosine:u=>(1-Math.cos(Math.PI*u))/2,exponential:(u,k)=>(1-Math.exp(-k*u))/(1-Math.exp(-k))};
function validate(points,duration){
 if(!Number.isFinite(duration)||duration<=0||!Array.isArray(points)||points.length<2||points.length>64)throw Error('Use 2–64 points and a positive clip duration.');
 points.forEach((p,i)=>{if(!Number.isFinite(p.time)||!Number.isFinite(p.gain)||p.gain<0||p.gain>1||p.time<0||p.time>duration||i&&p.time<=points[i-1].time)throw Error('Points must be ordered, with distinct times and volume between 0 and 100%.');});
 if(Math.abs(points[0].time)>1e-8||Math.abs(points.at(-1).time-duration)>1e-7)throw Error('The first and last points must span the clip.');return points;
}
function gainAt(time,points,shape='exponential',strength=6.907755){
 const fn=curves[shape];if(!fn||!Number.isFinite(strength)||strength<.1||strength>12)throw Error('Invalid curve shape or strength.');
 if(time<=points[0].time)return points[0].gain;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(time<=b.time){const u=(time-a.time)/(b.time-a.time);return u>=1?b.gain:a.gain+(b.gain-a.gain)*fn(u,strength);}}
 return points.at(-1).gain;
}
function render(channels,rate,start,end,points,shape,strength){
 if(!channels.length||!Number.isFinite(rate)||rate<=0||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>channels[0].length/rate+1e-8)throw Error('Choose a valid region inside the recording.');
 validate(points,end-start);const first=Math.round(start*rate),last=Math.min(channels[0].length,Math.round(end*rate)),n=last-first;
 if(n<2||n*channels.length>16000000)throw Error('Choose a clip with at least two samples and at most 16 million samples across channels.');
 const gains=new Float32Array(n);for(let i=0;i<n;i++)gains[i]=gainAt(i/(n-1)*(end-start),points,shape,strength);
 return channels.map(ch=>{if(ch.length!==channels[0].length)throw Error('Channel lengths differ.');const out=new Float32Array(n);for(let i=0;i<n;i++)out[i]=ch[first+i]*gains[i];return out;});
}
function wav(channels,rate){
 const count=channels.length,n=channels[0].length,size=n*count*2,buf=new ArrayBuffer(44+size),v=new DataView(buf);let at=44;
 const str=(offset,s)=>{for(let i=0;i<s.length;i++)v.setUint8(offset+i,s.charCodeAt(i));};str(0,'RIFF');v.setUint32(4,36+size,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,count,true);v.setUint32(24,rate,true);v.setUint32(28,rate*count*2,true);v.setUint16(32,count*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,size,true);
 for(let i=0;i<n;i++)for(let c=0;c<count;c++){const x=Math.max(-1,Math.min(1,channels[c][i]));v.setInt16(at,Math.round(x*(x<0?32768:32767)),true);at+=2;}return buf;
}
const api={validate,gainAt,render,wav};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AudioEnvelope=api;
})(typeof globalThis!=='undefined'?globalThis:this);
