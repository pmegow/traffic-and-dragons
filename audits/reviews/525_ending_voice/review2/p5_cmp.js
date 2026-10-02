var fs=require('fs');
function parse(f){var s=fs.readFileSync(f,'utf8');var parts=s.split('\n=== ').slice(1);var o={};parts.forEach(function(p){var nl=p.indexOf('\n');try{o[p.slice(0,nl)]=JSON.parse(p.slice(nl+1));}catch(e){o[p.slice(0,nl)]={err:p.slice(nl+1,nl+200)};}});return o;}
var a=parse('p5_out_pre525r.txt'),b=parse('p5_out.txt');
Object.keys(b).forEach(function(k){var A=a[k],B=b[k];if(!A){console.log('?? '+k);return;}
 var keys=['shownCount','html','replay','transcript','heroMoments','heroFate','comps','owed','toasts','modals','saves'];var diffs=keys.filter(function(x){return JSON.stringify(A[x])!==JSON.stringify(B[x]);});
 console.log('=== '+k+(diffs.length?'  DIFFERS in '+diffs.join(','):'  same'));
 diffs.forEach(function(x){if(x==='comps'){B.comps.forEach(function(c,i){var ca=A.comps[i];if(JSON.stringify(ca)!==JSON.stringify(c))console.log('     '+c.name+'\n       before: moments '+JSON.stringify(ca.moments)+' fate '+JSON.stringify(ca.fate&&ca.fate.line)+'\n       after : moments '+JSON.stringify(c.moments)+' fate '+JSON.stringify(c.fate&&c.fate.line));});}
  else console.log('     '+x+'\n       before: '+JSON.stringify(x==='heroFate'?(A[x]&&A[x].line):A[x]).slice(0,420)+'\n       after : '+JSON.stringify(x==='heroFate'?(B[x]&&B[x].line):B[x]).slice(0,420));});
});
