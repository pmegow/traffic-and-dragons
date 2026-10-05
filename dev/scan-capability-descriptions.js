// Reproduce exact phrase screening from locally extracted PDFs, without a network dependency.
// node dev/scan-capability-descriptions.js capabilities.json srd-5.1.json srd-5.2.1.json > scan.json
// capabilities.json: [{key,effect,...}]; each source: {version,url,pages:[text,...]}.
// Extract each PDF page with pypdf.PdfReader(...).pages[n].extract_text().
const fs=require('fs');
function tokens(s){return s.replace(/\uFB01/g,'fi').replace(/\uFB02/g,'fl').replace(/-\s*\n\s*/g,'').toLowerCase().match(/[a-z0-9]+/g)||[];}
function scan(rows,sources){const indexed=sources.map(source=>{const pages=source.pages.map(tokens),index=new Map();pages.forEach((words,p)=>{for(let i=0;i+6<=words.length;i++){const k=words.slice(i,i+6).join(' ');if(!index.has(k))index.set(k,[]);index.get(k).push([p,i]);}});return {source,pages,index};});
 return rows.map(row=>{const words=tokens(row.effect),matches=[];for(const {source,pages,index} of indexed){let best=null;for(let i=0;i+6<=words.length;i++){const found=index.get(words.slice(i,i+6).join(' '))||[];for(const [p,j] of found){let n=6;while(i+n<words.length&&j+n<pages[p].length&&words[i+n]===pages[p][j+n])n++;if(!best||n>best.words)best={source:'SRD '+source.version,url:source.url+'#page='+(p+1),page:p+1,words:n,phrase:words.slice(i,i+n).join(' ')};}}if(best)matches.push(best);}return {key:row.key,matches};});
}
if(require.main===module){if(process.argv.length<5)throw Error('Supply capability JSON and extracted SRD JSON files.');const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write(JSON.stringify(scan(read(process.argv[2]),process.argv.slice(3).map(read)),null,2)+'\n');}
module.exports={scan,tokens};
