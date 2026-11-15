/* atlas-public-journey.js — THE JOURNEY SHEET (#757, owner 2026-11-14, Kaelon at The Ironwood Heart: "the region map is
   unavailable, meaning I can't see the path I took to get here"; ruling by chip: a journey sheet). A campaign begun since
   #735 has no private region, so nothing showed how the visited places lie together.

   The sheet is made of PUBLIC facts only, read at every draw and never stored:
     places  the world places the party has been in (the public places registry, folded to their world place), in order
             of first visit;
     ways    the travel the location graph recorded between two of them (memory.map.edges: the party's own first
             passage each way, never a road the story only mentioned);
     where   a way's DIRECTION is known only when a public feature of one end bears the other end's own name with a
             stated bearing ("You see The Ironwood Heart to the north" at The Boundary Clearing) — never otherwise.
   A way whose direction is known is laid along it and drawn solid. A way whose direction is not known is laid in the
   next free place beside where it came from and drawn DOTTED: the placement then shows the order of travel and nothing
   else, and the sheet says so. Nothing here reads a private recipe, a description or a generated layout. */
var ATLAS_JOURNEY_TITLE="The journey so far";
var ATLAS_JOURNEY_DIRS={N:[0,-1],NE:[1,-1],E:[1,0],SE:[1,1],S:[0,1],SW:[-1,1],W:[-1,0],NW:[-1,-1]};
var ATLAS_JOURNEY_OPPOSITE={N:"S",NE:"SW",E:"W",SE:"NW",S:"N",SW:"NE",W:"E",NW:"SE"};
var ATLAS_JOURNEY_UNSURE_ORDER=["S","SE","SW","E","W","N","NE","NW"];/* where a way of unknown direction is laid: the first free place, this order, nearest first — DOWN the sheet first, so an order of travel reads like a list and each name sits beside its pin */
var ATLAS_JOURNEY_FRAME={cx:400,cy:285,width:520,height:300,step:90};
var _atlasJourneyMemo=null;
function atlasJourneyId(A){return A.seed+"/journey";}
function atlasJourneyIs(A,id){return !!A&&typeof id==="string"&&id===atlasJourneyId(A);}
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
/* PURE: places (in order) and legs → {cells: {key: [cx, cy]}, legs: [{a, b, sure}]}. The first place is the origin. Each
   later place is laid from a place already laid that it shares a way with — along the way's bearing when one is known
   (stepping on past an occupied place), else in the first free place beside it. A place no way reaches is laid beside
   the one visited before it, and no way is drawn. A way is SURE only when its bearing is known and the two places lie
   exactly along it. */
function atlasJourneyLayout(places,legs){
  var cells=Object.create(null),taken=Object.create(null),out=[],i,j,p,l,from,dir,c,n,d,placed,q;
  function at(x,y){return Object.prototype.hasOwnProperty.call(taken,x+","+y);}
  function put(key,x,y){cells[key]=[x,y];taken[x+","+y]=key;}
  function beside(o){var r,k,v;for(r=1;r<=64;r++)for(k=0;k<ATLAS_JOURNEY_UNSURE_ORDER.length;k++){v=ATLAS_JOURNEY_DIRS[ATLAS_JOURNEY_UNSURE_ORDER[k]];if(!at(o[0]+v[0]*r,o[1]+v[1]*r))return [o[0]+v[0]*r,o[1]+v[1]*r];}return null;}
  for(i=0;i<places.length;i++){
    p=places[i];if(!i){put(p.key,0,0);continue;}
    from=null;dir=null;
    for(j=0;j<legs.length&&!dir;j++){l=legs[j];q=l.a===p.key?l.b:(l.b===p.key?l.a:null);if(!q||!cells[q])continue;
      if(l.bearing){from=q;dir=l.a===q?l.bearing:ATLAS_JOURNEY_OPPOSITE[l.bearing];}else if(!from)from=q;}
    if(!from)from=places[i-1].key;
    c=null;
    if(dir){d=ATLAS_JOURNEY_DIRS[dir];for(n=1;n<=64&&!c;n++)if(!at(cells[from][0]+d[0]*n,cells[from][1]+d[1]*n))c=[cells[from][0]+d[0]*n,cells[from][1]+d[1]*n];}
    if(!c)c=beside(cells[from]);
    if(!c)throw new Error("the journey sheet has no free place for "+p.name);
    put(p.key,c[0],c[1]);
  }
  for(j=0;j<legs.length;j++){
    l=legs[j];if(!cells[l.a]||!cells[l.b])continue;placed=false;
    if(l.bearing){d=ATLAS_JOURNEY_DIRS[l.bearing];var dx=cells[l.b][0]-cells[l.a][0],dy=cells[l.b][1]-cells[l.a][1],m=Math.max(Math.abs(dx),Math.abs(dy));placed=m>0&&dx===d[0]*m&&dy===d[1]*m;}
    out.push({a:l.a,b:l.b,sure:placed});
  }
  return {cells:cells,legs:out};
}
/* PURE: the layout's cells → sheet points, centred, never wider apart than ATLAS_JOURNEY_FRAME.step and always inside
   the frame; and the eighth of the compass a point lies in from the sheet's middle (the library asks every placed
   feature for one; on this sheet it is a fact of the drawing, never of the world). */
function atlasJourneyPoints(cells){
  var F=ATLAS_JOURNEY_FRAME,keys=Object.keys(cells),x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,i,c,s,out=Object.create(null);
  for(i=0;i<keys.length;i++){c=cells[keys[i]];if(c[0]<x0)x0=c[0];if(c[0]>x1)x1=c[0];if(c[1]<y0)y0=c[1];if(c[1]>y1)y1=c[1];}
  s=Math.min(F.step,(x1>x0)?F.width/(x1-x0):F.step,(y1>y0)?F.height/(y1-y0):F.step);
  for(i=0;i<keys.length;i++){c=cells[keys[i]];out[keys[i]]=[Math.round(F.cx+(c[0]-(x0+x1)/2)*s),Math.round(F.cy+(c[1]-(y0+y1)/2)*s)];}
  return out;
}
function atlasJourneyEighth(pt){
  var F=ATLAS_JOURNEY_FRAME,dx=pt[0]-F.cx,dy=pt[1]-F.cy,a,names=["E","SE","S","SW","W","NW","N","NE"];
  if(!dx&&!dy)return "N";
  a=Math.round(Math.atan2(dy,dx)/(Math.PI/4));return names[((a%8)+8)%8];
}
/* What the sheet is drawn from: {places, legs, points, spec}. */
function atlasJourneyRead(A){
  var places=atlasJourneyPlaces(A),legs=atlasJourneyLegs(places),lay=atlasJourneyLayout(places,legs),points=atlasJourneyPoints(lay.cells),zoneOf=Object.create(null),spec,i;
  for(i=0;i<places.length;i++)zoneOf[places[i].key]=places[i].zone;
  spec={scale:"region",title:ATLAS_JOURNEY_TITLE,
    features:places.map(function(p){return {id:p.zone,name:p.name,kind:"place",bearing:atlasJourneyEighth(points[p.key]),mode:"observed",at:points[p.key]};}),
    links:lay.legs.map(function(l,n){return {id:"way-"+(n+1),from:zoneOf[l.a],to:zoneOf[l.b],sure:l.sure};})};
  return {places:places,legs:lay.legs,points:points,spec:spec};
}
function atlasJourneyDoc(A){
  var j=atlasJourneyRead(A),sig=JSON.stringify(j.spec);
  if(_atlasJourneyMemo&&_atlasJourneyMemo.signature===sig)return _atlasJourneyMemo.doc;
  _atlasJourneyMemo={signature:sig,doc:TnDMaps.schematic(j.spec)};return _atlasJourneyMemo.doc;
}
/* The party stands at the place it is in: exact on this sheet (a visited place is a known spot). */
function atlasJourneyParty(A){
  var j=atlasJourneyRead(A),here=atlasJourneyWorld(atlasPublicContext()),p=j.points[here];
  return p?{x:p[0],y:p[1],exact:true,last:false,key:null}:null;
}
/* A tap on a place: its name, when it was first visited, whether any way to it is only in order — and its sheet to open. */
function atlasJourneyCard(A,target){
  var j=atlasJourneyRead(A),i,p,unsure=false,k;
  if(!target||target.id==null)return null;
  for(i=0;i<j.places.length;i++)if(j.places[i].zone===target.id){
    p=j.places[i];for(k=0;k<j.legs.length;k++)if(!j.legs[k].sure&&(j.legs[k].a===p.key||j.legs[k].b===p.key))unsure=true;
    return {id:null,x:j.points[p.key][0],y:j.points[p.key][1],title:p.name,word:"First visited on turn "+p.turn+"."+(unsure?" A dotted way shows the order of travel only: its direction is not established.":""),
      opens:p.zone,unvisited:false,partyHere:p.key===atlasJourneyWorld(atlasPublicContext()),place:null,added:null,note:null};
  }
  return null;
}
