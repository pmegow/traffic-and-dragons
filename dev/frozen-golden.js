// frozen-golden.js — failure-only diagnostics for byte-frozen generated tag text.
var fs=require("fs"),path=require("path");

function readGolden(root,rel){
  var s=fs.readFileSync(path.join(root,rel),"utf8").replace(/\r\n/g,"\n");
  var marker="\n[GOLDEN EOF: 2 NEWLINES]\n";
  if(s.slice(-marker.length)===marker)return s.slice(0,-marker.length)+"\n\n";
  return s.charAt(s.length-1)==="\n"?s.slice(0,-1):s;
}
function clipped(s,at){
  var from=Math.max(0,at-55),to=Math.min(s.length,at+70);
  return (from?"…":"")+s.slice(from,to)+(to<s.length?"…":"");
}
function firstChar(a,b){
  var n=Math.min(a.length,b.length),i;
  for(i=0;i<n;i++)if(a.charAt(i)!==b.charAt(i))return i;
  return n;
}
function failureDiff(root,rel,actual){
  var expected;
  try{expected=readGolden(root,rel);}catch(e){return "\n  FROZEN GOLDEN DIFF UNAVAILABLE: "+rel+" could not be read ("+e.message+")";}
  actual=String(actual).replace(/\r\n/g,"\n");
  if(expected===actual)return "\n  FROZEN GOLDEN: "+rel+" matches generated text; inspect the frozen hash/length constants.";
  var a=expected.split("\n"),b=actual.split("\n"),n=Math.max(a.length,b.length),line=0;
  while(line<n&&a[line]===b[line])line++;
  var oldLine=a[line]===undefined?"<missing>":a[line],newLine=b[line]===undefined?"<missing>":b[line];
  var ch=firstChar(oldLine,newLine);
  return "\n  FROZEN GOLDEN DIFF:\n  --- committed "+rel+"\n  +++ generated tag_table text\n  @@ line "+(line+1)+", char "+(ch+1)+" @@\n  - "+clipped(oldLine,ch)+"\n  + "+clipped(newLine,ch);
}

module.exports={failureDiff:failureDiff,readGolden:readGolden};
