// dev/village-measure.js — #6 D4: the village acceptance MEASURE over a corpus (dev/corpus_*.json or a save's
// transcript). Counts what the DRIVE rule promises: residents who refuse ("no", "not today", "can't"), GM-invented
// threats (a fight, an ambush, a monster where none may exist), words per GM turn, and unprompted resident actions
// (a resident as the subject of a sentence in the narration). Heuristic by design — a measure, not a judge; the
// numbers go in the playtest audit beside the reading. Node-only; exported for the suite.
//   node dev/village-measure.js dev/corpus_village_livecheck_v1912.json
var REFUSAL=/\b(no|not today|not now|can't|cannot|won't|will not|later|another time|not for you|i don't|i do not)\b/i;
var THREAT=/\b(ambush|bandits?|raiders?|monster|beast|blade[s]? drawn|attack(?:s|ed)?|assault|thugs?|goblins?|wolves|undead|assassin)\b/i;
function measureVillageCorpus(corpus){
  var npcs=(corpus&&corpus.npcs)||[],names=[],i;
  for(i=0;i<npcs.length;i++)if(npcs[i]&&(npcs[i].resident||npcs[i].rel==="resident")&&npcs[i].name)names.push(npcs[i].name);
  var tr=(corpus&&corpus.transcript)||[],out={turns:0,refusals:0,threats:0,words:0,wordsPerTurn:0,residentActions:0,residents:names.slice()};
  for(i=0;i<tr.length;i++){var e=tr[i];if(!e||e.r!=="gm")continue;var x=String(e.x||"");out.turns++;
    out.words+=x.split(/\s+/).filter(function(w){return !!w;}).length;
    var quotes=x.match(/"[^"]{1,300}"/g)||[],q;for(q=0;q<quotes.length;q++){var hits=quotes[q].match(new RegExp(REFUSAL.source,"gi"));if(hits)out.refusals+=hits.length;}
    if(THREAT.test(x))out.threats++;
    var sentences=x.replace(/"[^"]*"/g,"").split(/(?<=[.!?])\s+/),s;
    for(s=0;s<sentences.length;s++){var sent=sentences[s].trim();var j;for(j=0;j<names.length;j++){var first=names[j].split(/\s+/)[0];if(new RegExp("^"+first+"\\b").test(sent)&&/\b\w+(s|ed|es)\b/.test(sent)){out.residentActions++;break;}}}
  }
  out.wordsPerTurn=out.turns?Math.round(out.words/out.turns):0;
  return out;
}
if(typeof module!=="undefined")module.exports={measureVillageCorpus:measureVillageCorpus};
if(typeof require!=="undefined"&&require.main===module){
  var fs=require("fs"),p=process.argv[2];if(!p){console.error("usage: node dev/village-measure.js <corpus.json>");process.exit(2);}
  var c=JSON.parse(fs.readFileSync(p,"utf8")),r=measureVillageCorpus(c);
  console.log("village measure — "+p);console.log("  GM turns: "+r.turns+"  words/turn: "+r.wordsPerTurn);
  console.log("  refusals (quoted no/not today/can't): "+r.refusals+"  → zero FAILS the acceptance test");
  console.log("  invented-threat turns: "+r.threats+"  → any is a DRIVE-rule break");
  console.log("  unprompted resident actions: "+r.residentActions+"  residents: "+r.residents.join(", "));
}
