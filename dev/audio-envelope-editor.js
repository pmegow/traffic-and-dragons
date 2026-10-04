/* Browser shell for AudioEnvelope: file I/O and controls; no game scripts or campaign storage. */
'use strict';
(()=>{
const $=id=>document.getElementById(id),E=window.AudioEnvelope,query=new URLSearchParams(location.search);
const state={buffer:null,name:'',start:0,end:0,points:[],selected:1,shape:'exponential',strength:6.9};
let ctx=null,voice=null,playStarted=0,frame=0,playEpoch=0,loadEpoch=0,sourceRequest=0,drag=null,geometry=null;
const duration=()=>state.end-state.start;
const context=()=>{if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();return ctx;};
function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);if(error)console.warn('[audio envelope]',text);}
function failure(e){message(e.message||String(e),true);}
function stop(){playEpoch++;if(voice){voice.onended=null;voice.stop();voice.disconnect();voice=null;}cancelAnimationFrame(frame);$('stop').disabled=true;$('position').textContent='0.000 s';draw();}
function edited(){stop();update();message('Curve updated. Press Play curve to listen.');}
function preset(){return {version:1,source:{name:state.name,start:state.start,end:state.end},shape:state.shape,strength:state.strength,points:state.points.map(p=>({...p}))};}
function curvePoints(d,fade){return [{time:0,gain:1},{time:Math.max(.001,Math.min(d-.001,fade??d*.4)),gain:1},{time:d,gain:0}];}
function channelData(){return Array.from({length:state.buffer.numberOfChannels},(_,i)=>state.buffer.getChannelData(i));}
function render(original=false){if(!state.buffer)throw Error('Open a recording first.');const p=original?[{time:0,gain:1},{time:duration(),gain:1}]:state.points;return E.render(channelData(),state.buffer.sampleRate,state.start,state.end,p,state.shape,state.strength);}
async function play(original=false){
 try{stop();const epoch=playEpoch,c=context();await c.resume();if(epoch!==playEpoch)return;
 const data=render(original),b=c.createBuffer(data.length,data[0].length,state.buffer.sampleRate);data.forEach((ch,i)=>b.copyToChannel(ch,i));
 const src=c.createBufferSource();src.buffer=b;src.loop=$('loop').checked;src.connect(c.destination);voice=src;playStarted=c.currentTime;$('stop').disabled=false;
 src.onended=()=>{if(voice===src){voice=null;src.disconnect();cancelAnimationFrame(frame);$('stop').disabled=true;$('position').textContent='0.000 s';draw();}};src.start();
 const tick=()=>{if(voice!==src)return;const at=(c.currentTime-playStarted)%b.duration;$('position').textContent=at.toFixed(3)+' s';draw(at);frame=requestAnimationFrame(tick);};tick();message(original?'Playing the original region.':'Playing the shaped region.');
 }catch(e){stop();failure(e);}
}
async function loadAudio(bytes,name,opts={}){
 const epoch=++loadEpoch;stop();message('Decoding '+name+'…');
 try{if(bytes.byteLength>64*1024*1024)throw Error('Choose an audio file smaller than 64 MB.');const b=await context().decodeAudioData(bytes.slice(0));if(epoch!==loadEpoch)return;
 if(b.length*b.numberOfChannels>16000000||b.duration<.01)throw Error('Choose a shorter recording (up to 16 million decoded samples across channels).');
 if(opts.fade!=null&&!Number.isFinite(opts.fade))throw Error('Fade time must be a number.');
 const start=opts.start??0,end=opts.end??b.duration;if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>b.duration+.000001||end-start<.01)throw Error('The requested region is outside the recording.');
 Object.assign(state,{buffer:b,name,start,end:Math.min(end,b.duration),points:curvePoints(end-start,opts.fade),selected:1});update();message('Ready. Drag the points, then press Play curve.');
 }catch(e){if(epoch===loadEpoch)failure(e);}
}
function movePoint(i,time,gain){
 const p=state.points[i],last=state.points.length-1;if(!p)return;
 if(Number.isFinite(time)&&i>0&&i<last)p.time=Math.max(state.points[i-1].time+.001,Math.min(state.points[i+1].time-.001,time));
 if(Number.isFinite(gain))p.gain=Math.max(0,Math.min(1,gain));state.selected=i;edited();
}
function addPoint(time,gain){if(!state.buffer)return;if(state.points.length>=64)return message('A curve can have at most 64 points.',true);
 if(time==null){let i=Math.min(state.selected,state.points.length-2);time=(state.points[i].time+state.points[i+1].time)/2;gain=E.gainAt(time,state.points,state.shape,state.strength);}
 if(time<.001||time>duration()-.001||state.points.some(p=>Math.abs(p.time-time)<.001))return message('Give each point a distinct time, at least 1 ms apart.',true);
 state.points.push({time,gain:Math.max(0,Math.min(1,gain))});state.points.sort((a,b)=>a.time-b.time);state.selected=state.points.findIndex(p=>p.time===time);edited();
}
function removePoint(){if(state.selected===0||state.selected===state.points.length-1)return;state.points.splice(state.selected,1);state.selected=Math.min(state.selected,state.points.length-1);edited();}
function applyRegion(){try{const start=Number($('clip-start').value),end=Number($('clip-end').value);if(!state.buffer||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>state.buffer.duration+.000001||end-start<.01)throw Error('Choose a region of at least 0.01 seconds within the recording.');const old=duration();state.points=state.points.map(p=>({time:p.time/old*(end-start),gain:p.gain}));state.start=start;state.end=end;edited();}catch(e){failure(e);}}
function applyPreset(value){
 if(!state.buffer)throw Error('Open the matching audio recording before loading its preset.');
 if(value.version!==1||!value.source||!['linear','cosine','exponential'].includes(value.shape)||!Number.isFinite(value.strength)||value.strength<.1||value.strength>12)throw Error('This is not a supported envelope preset.');
 const {start,end}=value.source;if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>state.buffer.duration+.000001||end-start<.01)throw Error('This preset region does not fit the current recording.');E.validate(value.points,end-start);
 const points=value.points.map(p=>({time:p.time,gain:p.gain}));if(points.some((p,i)=>i&&p.time-points[i-1].time<.001))throw Error('Preset points must be at least 1 ms apart.');
 Object.assign(state,{start,end,points,shape:value.shape,strength:value.strength,selected:1});edited();message('Preset loaded on '+state.name+'.');
}
function update(){
 const ready=!!state.buffer;['play','original','add','reset','apply-region','export-wav','save-preset','copy','clip-start','clip-end','point-gain','gain-slider'].forEach(id=>$(id).disabled=!ready);
 $('shape').value=state.shape;$('strength').value=state.strength;$('strength').disabled=state.shape!=='exponential';$('strength-value').textContent=state.strength.toFixed(1);
 if(ready){$('source-name').textContent=state.name;$('source-info').textContent=state.buffer.duration.toFixed(3)+' s · '+state.buffer.numberOfChannels+' channel'+(state.buffer.numberOfChannels===1?'':'s')+' · '+(state.buffer.sampleRate/1000)+' kHz';$('duration-label').textContent=duration().toFixed(3)+' s region';$('clip-start').value=String(Number(state.start.toFixed(6)));$('clip-end').value=String(Number(state.end.toFixed(6)));$('clip-end').max=state.buffer.duration;
 const i=state.selected,p=state.points[i],end=i===0||i===state.points.length-1;$('point-number').textContent=String(i+1)+' / '+state.points.length;$('point-time').value=p.time.toFixed(3);$('point-gain').value=Math.round(p.gain*100);$('gain-slider').value=p.gain*100;
 for(const id of ['point-time','time-slider']){$(id).disabled=end;$(id).min=end?p.time:state.points[i-1].time+.001;$(id).max=end?p.time:state.points[i+1].time-.001;} $('time-slider').value=p.time;$('remove').disabled=end;}
 draw();
}
const svgEl=(name,attrs,text)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text!=null)e.textContent=text;return e;};
function draw(playhead){
 const box=$('graph'),w=box.clientWidth,h=box.clientHeight,left=w<460?49:61,right=22,top=29,bottom=43,pw=w-left-right,ph=h-top-bottom,d=state.buffer?duration():1;
 geometry={left,top,pw,ph,w,h};const svg=$('plot');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.replaceChildren();const add=(n,a,t)=>svg.appendChild(svgEl(n,a,t));const X=t=>left+t/d*pw,Y=g=>top+(1-g)*ph;
 [0,.25,.5,.75,1].forEach(g=>{add('line',{x1:left,y1:Y(g),x2:w-right,y2:Y(g),stroke:'var(--brd)','stroke-width':1});add('text',{x:left-10,y:Y(g)+4,fill:'var(--t1)','font-size':11,'text-anchor':'end'},Math.round(g*100)+'%');});
 const ticks=w<460?4:6;for(let i=0;i<=ticks;i++)add('text',{x:X(d*i/ticks),y:h-22,fill:'var(--t1)','font-size':11,'text-anchor':'middle'},(d*i/ticks).toFixed(d<10?2:1));add('text',{x:left+pw/2,y:h-3,fill:'var(--t1)','font-size':11,'text-anchor':'middle'},'Time (seconds)');add('text',{x:left,y:14,fill:'var(--t1)','font-size':11},'Volume');
 if(state.buffer){
 const a=state.buffer.getChannelData(0),rate=state.buffer.sampleRate,first=Math.round(state.start*rate),count=Math.round(d*rate),columns=Math.max(1,Math.floor(pw/2));let peak=0;const peaks=[];
 for(let j=0;j<columns;j++){let v=0;const lo=first+Math.floor(j/columns*count),hi=first+Math.floor((j+1)/columns*count),stride=Math.max(1,Math.floor((hi-lo)/60));for(let k=lo;k<hi;k+=stride)v=Math.max(v,Math.abs(a[k]||0));peaks.push(v);peak=Math.max(peak,v);}
 let wave='';peaks.forEach((v,i)=>{const height=peak?v/peak*ph*.40:0,xx=left+i/(columns-1)*pw;wave+=`M${xx.toFixed(1)},${(top+ph/2-height).toFixed(1)}v${(height*2).toFixed(1)} `;});add('path',{d:wave,stroke:'var(--brd2)','stroke-width':1,opacity:.65,fill:'none'});
 const pts=[];for(let i=0;i<=400;i++)pts.push(`${X(d*i/400).toFixed(2)},${Y(E.gainAt(d*i/400,state.points,state.shape,state.strength)).toFixed(2)}`);
 add('polygon',{points:`${left},${Y(0)} `+pts.join(' ')+` ${X(d)},${Y(0)}`,fill:'var(--acc)',opacity:.08});add('polyline',{points:pts.join(' '),fill:'none',stroke:'var(--acc)','stroke-width':2.5});
 if(playhead!=null)add('line',{x1:X(playhead),x2:X(playhead),y1:top,y2:top+ph,stroke:'var(--t0)','stroke-width':1});
 }
 const handles=$('handles');if(handles.children.length!==state.points.length){handles.replaceChildren();state.points.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className='point';b.dataset.index=i;handles.appendChild(b);});}
 [...handles.children].forEach((b,i)=>{const p=state.points[i];b.classList.toggle('selected',i===state.selected);b.style.left=X(p.time)+'px';b.style.top=Y(p.gain)+'px';b.setAttribute('aria-label',`Point ${i+1}: ${p.time.toFixed(3)} seconds, ${Math.round(p.gain*100)} percent`);b.setAttribute('aria-pressed',String(i===state.selected));});
}
function pointer(e){const r=$('graph').getBoundingClientRect(),g=geometry;return {time:Math.max(0,Math.min(duration(),(e.clientX-r.left-g.left)/g.pw*duration())),gain:Math.max(0,Math.min(1,1-(e.clientY-r.top-g.top)/g.ph))};}
$('graph').addEventListener('pointerdown',e=>{const b=e.target.closest('.point');if(!b)return;drag=Number(b.dataset.index);state.selected=drag;$('graph').setPointerCapture(e.pointerId);b.focus();update();e.preventDefault();});
$('graph').addEventListener('pointermove',e=>{if(drag===null)return;const p=pointer(e);movePoint(drag,p.time,p.gain);});
for(const name of ['pointerup','pointercancel'])$('graph').addEventListener(name,()=>{drag=null;});
$('graph').addEventListener('dblclick',e=>{if(!state.buffer||e.target.closest('.point'))return;const p=pointer(e);addPoint(p.time,p.gain);});
$('handles').addEventListener('click',e=>{const b=e.target.closest('.point');if(b){state.selected=Number(b.dataset.index);update();}});
$('handles').addEventListener('keydown',e=>{const b=e.target.closest('.point');if(!b)return;const i=Number(b.dataset.index),p=state.points[i],step=e.shiftKey ? .1 : .01;if(e.key==='Delete'){state.selected=i;removePoint();e.preventDefault();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){movePoint(i,p.time+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),p.gain+(e.key==='ArrowDown'?-.01:e.key==='ArrowUp'?.01:0));e.preventDefault();}});
for(const id of ['point-time','time-slider'])$(id).addEventListener('input',()=>movePoint(state.selected,Number($(id).value),NaN));
for(const id of ['point-gain','gain-slider'])$(id).addEventListener('input',()=>movePoint(state.selected,NaN,Number($(id).value)/100));
$('shape').onchange=()=>{state.shape=$('shape').value;edited();};$('strength').oninput=()=>{state.strength=Number($('strength').value);edited();};$('add').onclick=()=>addPoint();$('remove').onclick=removePoint;
$('reset').onclick=()=>{state.points=curvePoints(duration(),query.has('fade')?Number(query.get('fade')):undefined);state.selected=1;edited();};$('apply-region').onclick=applyRegion;$('play').onclick=()=>play();$('original').onclick=()=>play(true);$('stop').onclick=stop;$('loop').onchange=()=>{if(voice)voice.loop=$('loop').checked;};
function download(bytes,type,ext){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=state.name.replace(/\.[^.]+$/,'')+'-envelope.'+ext;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('export-wav').onclick=()=>{try{download(E.wav(render(),state.buffer.sampleRate),'audio/wav','wav');message('Exported the shaped region. The original file was not changed.');}catch(e){failure(e);}};
$('save-preset').onclick=()=>{download(JSON.stringify(preset(),null,2),'application/json','json');message('Preset saved. Open the matching audio before loading it again.');};
$('copy').onclick=async()=>{const text=JSON.stringify(preset(),null,2);$('settings-output').textContent=text;$('settings-output').hidden=false;try{await navigator.clipboard.writeText(text);message('Settings copied. Paste them into the chat to share this curve.');}catch(e){message('Clipboard unavailable; select and copy the settings shown below.');console.warn('[audio envelope] clipboard:',e.message);}};
$('audio-file').onchange=async()=>{const f=$('audio-file').files[0];if(!f)return;const request=++sourceRequest;try{if(f.size>64*1024*1024)throw Error('Choose an audio file smaller than 64 MB.');const bytes=await f.arrayBuffer();if(request!==sourceRequest)return;await loadAudio(bytes,f.name);}catch(e){failure(e);}finally{$('audio-file').value='';}};
$('preset-file').onchange=async()=>{const f=$('preset-file').files[0];if(!f)return;try{if(f.size>65536)throw Error('Preset file is too large.');applyPreset(JSON.parse(await f.text()));}catch(e){failure(e);}finally{$('preset-file').value='';}};
window.addEventListener('pagehide',stop);new ResizeObserver(()=>draw()).observe($('graph'));
window.__audioEnvelopeEditorTest={getState:()=>preset(),render,applyPreset,movePoint,addPoint,loadAudio,playing:()=>!!voice};
update();
if(query.has('src'))(async()=>{const request=++sourceRequest;try{const url=new URL(query.get('src'),location.href);if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol))throw Error('Use Open audio for local files; example URLs must come from this same server.');const response=await fetch(url);if(!response.ok)throw Error('Could not load example audio (HTTP '+response.status+').');const opts={};for(const k of ['start','end','fade'])if(query.has(k))opts[k]=Number(query.get(k));const bytes=await response.arrayBuffer();if(request!==sourceRequest)return;await loadAudio(bytes,query.get('label')||decodeURIComponent(url.pathname.split('/').pop()),opts);}catch(e){failure(e);}})();
})();
