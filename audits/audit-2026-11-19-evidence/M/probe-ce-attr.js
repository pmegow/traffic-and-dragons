// Probe: character_editor.html's own esc() (lifted verbatim from the file) inside its single-quoted attributes.
var fs=require("fs");
var src=fs.readFileSync("C:/Projects/traffic-and-dragons/character_editor.html","utf8");
var m=src.match(/function esc\(s\)\{[^\n]*?\}/);
eval(m[0]);
console.log("esc source:",m[0]);
// line 212: text field
var v="Tsuto' autofocus onfocus='alert(document.domain)";
var id="f-name";
console.log("name field  :","<input type='text' id='"+id+"' data-k='name' value='"+esc(v)+"'/>");
// line 256: skills value, no esc at all
var n="0' autofocus onfocus='alert(1)";
console.log("skill field :","<input type='number' min='0' data-skill='x' value='"+n+"'/>");
// benign apostrophe
console.log("O'Brien     :","<input type='text' value='"+esc("O'Brien")+"'/>");
// does healChar coerce skills? check source
console.log("healChar skills line:",(src.match(/for\(k in base\)[^\n]*/)||[""])[0]);
