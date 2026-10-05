const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
function createStore(root){
 const file=path.join(root,'audits/capability_vulnerabilities.json');
 function rules(){const html=fs.readFileSync(path.join(root,'audits/capability_vulnerabilities.html'),'utf8'),box={};const manifest=JSON.parse(html.match(/<script id="audit-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);vm.runInNewContext(html.match(/<script id="review-core">([\s\S]*?)<\/script>/)[1],box);return {core:box.CapabilityReview,manifest};}
 function read(){const text=fs.readFileSync(file,'utf8');return {ok:true,text,revision:crypto.createHash('sha256').update(text).digest('hex'),file};}
 function write(payload){
  if(!payload||typeof payload.text!=='string'||!Object.prototype.hasOwnProperty.call(payload,'revision'))throw Error('A complete review document and file revision are required.');
  const {core,manifest}=rules(),text=core.pack(core.read(payload.text,manifest),manifest)+'\n',current=read();
  if(payload.revision!==current.revision){const e=Error('The review changed on disk. Export your draft, then Load project file to review current changes before importing or re-entering your edits.');e.status=409;throw e;}
  const temp=file+'.'+process.pid+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  try{fs.writeFileSync(temp,text,{flag:'wx'});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return read();
 }
 return {read,write};
}
module.exports={createStore};
