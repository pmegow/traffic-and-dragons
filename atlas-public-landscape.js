/* atlas-public-landscape.js — cartographic texture from literal public geography only.
   The phrase's HEAD NOUN (its last word) decides: "Forest Gate Tavern" is a tavern, never a forest.
   These symbols are illustrative: no coordinates, feature identities or route connections are inferred.

   #765 (owner 2026-11-15, Petrified Mire: "where's the cool topological detail?"): each row once listed the adjectives
   it would accept before its noun ("deep marsh", "southern marsh"), so a place the story names its own way — Petrified
   Mire, Shattered Ridge, Crossroads Track — matched nothing and the sheet was drawn bare. A row is now its NOUNS alone
   (one row per ground or route, adding a word is adding it to a row); any words may stand before the noun, and nothing
   may follow it. A NAMED feature (a capital in its label: Shattered Ridge) is a place elsewhere, so it lends this sheet
   no ground — a ridge seen to the north does not make the mire hills; a plain phrase (deep timber, a marsh) is the
   ground the party stands in, as before. Routes are unchanged: only an observed, positioned one is drawn. */
var ATLAS_PUBLIC_LANDSCAPES=[
  {nouns:["forest","woods","wood","woodland","woodlands","timber","weald","grove","thicket","jungle"],terrain:"forest"},
  {nouns:["clearing","glade"],terrain:"clearing"},
  {nouns:["marsh","marshes","swamp","swamps","wetlands","bog","bogs","fen","fens","mire","mires","morass","quagmire"],terrain:"marsh"},
  {nouns:["grassland","grasslands","meadow","meadows","plain","plains","steppe","heath","prairie"],terrain:"grass"},
  {nouns:["hill","hills","ridge","ridges","downs","highlands","bluff","bluffs","crag","crags"],terrain:"hills"},
  {nouns:["lake","pond","sea","ocean","mere","tarn","lagoon"],terrain:"water"},
  {nouns:["road","causeway","highway"],route:"road"},
  {nouns:["path","trail","track","lane"],route:"path"},
  {nouns:["river","stream","brook","creek"],route:"river"}
];
/* The row a phrase's last word belongs to, or null. */
function atlasPublicLandscapeRow(phrase){
  var words=String(phrase||"").split(" "),head=words[words.length-1],i;
  for(i=0;i<ATLAS_PUBLIC_LANDSCAPES.length;i++)if(ATLAS_PUBLIC_LANDSCAPES[i].nouns.indexOf(head)>=0)return ATLAS_PUBLIC_LANDSCAPES[i];
  return null;
}
/* A label that carries a capital after its article is a NAME (Shattered Ridge), not a description (a low ridge). */
function atlasPublicLandscapeNamed(label){return /[A-Z]/.test(String(label||"").replace(/^(?:The|A|An) /,"").replace(/^./,function(c){return c.toLowerCase();}))||/^(?:The|A|An) [A-Z]/.test(String(label||""));}
function atlasPublicLandscape(title,features){
  var out={terrain:[],routes:[]};
  function ground(kind){if(out.terrain.indexOf(kind)<0&&out.terrain.length<4)out.terrain.push(kind);}
  function add(label,id,bearing,feature){
    var phrase=String(label||"").toLowerCase().replace(/^(?:the|a|an) /,"").replace(/[^a-z' ]+/g," ").replace(/\s+/g," ").trim(),row=atlasPublicLandscapeRow(phrase),words,w,lead;
    if(!row)return;
    if(row.terrain){if(!feature||!atlasPublicLandscapeNamed(label))ground(row.terrain);return;}
    /* a route through named ground wears it: the Forest Road runs in forest */
    words=phrase.split(" ");for(w=0;w<words.length-1;w++){lead=atlasPublicLandscapeRow(words[w]);if(lead&&lead.terrain==="forest")ground("forest");}
    if(feature&&bearing==="unknown")return;
    if(out.routes.length>=32)return;
    var route={id:id,kind:row.route,bearing:bearing};
    if(feature)route.feature=feature;out.routes.push(route);
  }
  add(title,"here","unknown",null);
  features.forEach(function(f){if(f.mode==="observed")add(f.label,f.id,f.bearing,f.id);});
  return out;
}
