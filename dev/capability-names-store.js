// One validated project list. The worksheet's own pure rules govern reads and writes.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
function createStore(root){
  const file=path.join(root,'capability-names.json');
  function rules(){
    const box={},html=fs.readFileSync(path.join(root,'capability-names.html'),'utf8');
    vm.runInNewContext(fs.readFileSync(path.join(root,'capability_bible.js'),'utf8'),box);
    vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),box);
    const core=html.match(/<script id="names-core">([\s\S]*?)<\/script>/);if(!core)throw Error('Capability naming rules are unavailable.');
    vm.runInNewContext(core[1],box);return box;
  }
  function read(){
    let text;try{text=fs.readFileSync(file,'utf8');}catch(e){if(e.code==='ENOENT')return {ok:true,text:null,revision:null,file};throw e;}
    return {ok:true,text,revision:crypto.createHash('sha256').update(text).digest('hex'),file};
  }
  function write(payload){
    if(!payload||typeof payload.text!=='string'||!Object.prototype.hasOwnProperty.call(payload,'revision'))throw Error('A complete names document and its file revision are required.');
    const box=rules(),names=box.CapabilityNames.read(payload.text,box.CAPABILITY_BIBLE),text=box.CapabilityNames.pack(names)+'\n';
    const current=read();
    if(payload.revision!==current.revision){const e=Error('The names file changed on disk. Reload the worksheet and review or import the current file before saving. Your draft has not been written.');e.status=409;throw e;}
    const temp=file+'.'+process.pid+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
    try{fs.writeFileSync(temp,text,{flag:'wx'});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
    return read();
  }
  return {read,write};
}
module.exports={createStore};
