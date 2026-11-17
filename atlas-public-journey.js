/* atlas-public-journey.js — THE JOURNEY: where the party has been and the ways it travelled, read from PUBLIC facts.
   This file drew the journey sheet (#757, owner 2026-11-14: "I can't see the path I took to get here"). The sheet
   RETIRED INTO THE REGION (#771 P3; removed in P4, owner 2026-11-16): the region (atlas-public-region.js) sets these
   places on generated ground, and the place sheets (atlas-public-sheet.js) draw these ways as their exits. What stays
   here is the one reading of the record both of them share — read at every draw, never stored:
     places  the world places the party has been in (the public places registry, folded to their world place), in order
             of first visit;
     ways    the travel the location graph recorded between two of them (memory.map.edges: the party's own first
             passage each way, never a road the story only mentioned);
     where   a way's DIRECTION is known only when a public feature of one end bears the other end's own name with a
             stated bearing ("You see The Ironwood Heart to the north" at The Boundary Clearing) — never otherwise.
   Nothing here reads a private recipe, a description or a generated layout. */
var ATLAS_JOURNEY_OPPOSITE={N:"S",NE:"SW",E:"W",SE:"NW",S:"N",SW:"NE",W:"E",NW:"SE"};
var ATLAS_JOURNEY_UNSURE_ORDER=["S","SE","SW","E","W","N","NE","NW"];/* where a way of unknown direction is laid on a place sheet: the first free edge, this order */
function atlasJourneyWorld(key){var k=String(key==null?"":key),i=k.indexOf("|"),w=i<0?k:k.slice(0,i);return typeof locResolve==="function"?locResolve(w):w;}
/* The visited WORLD places, first visit first: {key, name, zone, turn}. zone is the sheet a tap opens — the world place's
   own sheet when the party stood in it, else the first sheet visited inside it. */
function atlasJourneyPlaces(A){
  var rows=atlasPublicPlacesList(A),by=Object.create(null),out=[],i,r,w,p;
  for(i=0;i<rows.length;i++){
    r=rows[i];w=atlasJourneyWorld(r.container);if(!w)continue;p=by[w];
    if(!p){p=by[w]={key:w,name:(typeof locDisplayLeaf==="function")?locDisplayLeaf(w):w,zone:r.id,turn:r.turn,own:r.container===w,order:out.length};out.push(p);}
    else{if(r.turn<p.turn)p.turn=r.turn;if(!p.own&&r.container===w){p.zone=r.id;p.own=true;}}
  }
  out.sort(function(a,b){return (a.turn-b.turn)||(a.order-b.order);});
  return out;
}
/* The direction of the way from a to b, or null: a public feature of a that IS b by name, with a stated bearing; else one
   of b that is a, turned round. Reads the player's projection only. */
function atlasJourneyBearing(a,b){
  function named(from,to){var f=atlasKnowledgeProjection(from).features,i;for(i=0;i<f.length;i++)if(f[i].bearing!=="unknown"&&atlasKnowledgeSelfLabel(to,f[i].label))return f[i].bearing;return null;}
  var d;
  try{d=named(a,b);if(d)return d;d=named(b,a);return d?ATLAS_JOURNEY_OPPOSITE[d]:null;}
  catch(e){if(typeof console!=="undefined")console.warn("[journey] a way's direction could not be read: "+((e&&e.message)||e));return null;}
}
/* The travelled ways between two journey places, in the order they were first travelled: {a, b, bearing} (a → b). */
function atlasJourneyLegs(places){
  var keys=Object.create(null),seen=Object.create(null),out=[],edges=(memory&&memory.map&&memory.map.edges)||[],i,e,a,b,k;
  for(i=0;i<places.length;i++)keys[places[i].key]=true;
  edges=edges.slice().sort(function(x,y){return ((x.turn||0)-(y.turn||0));});
  for(i=0;i<edges.length;i++){
    e=edges[i];if(!e)continue;a=atlasJourneyWorld(e.from);b=atlasJourneyWorld(e.to);
    if(!a||!b||a===b||!keys[a]||!keys[b])continue;k=a<b?a+"\n"+b:b+"\n"+a;if(seen[k])continue;seen[k]=true;
    out.push({a:a,b:b,bearing:atlasJourneyBearing(a,b)});
  }
  return out;
}
