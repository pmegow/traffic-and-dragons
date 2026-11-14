/* atlas-public-landscape.js — cartographic texture from literal public geography only.
   Whole noun phrases prevent a building such as Forest Gate Tavern from becoming a forest.
   These symbols are illustrative: no coordinates, feature identities or route connections are inferred. */
var ATLAS_PUBLIC_LANDSCAPES=[
  {test:/^(?:(?:deep|dense|dark|old|ancient|pine|fir|oak|birch|sunken|enchanted|whispering) )?(?:forest|woods|woodland|woodlands|timber|weald)$/,terrain:"forest"},
  {test:/^(?:(?:boundary|forest|woodland|small|wide|grassy) )?clearing$/,terrain:"clearing"},
  {test:/^(?:(?:deep|wide|misty|salt|southern|northern|eastern|western) )?(?:marsh|marshes|swamp|wetlands|bog)$/,terrain:"marsh"},
  {test:/^(?:(?:open|wide|rolling|grassy) )?(?:grassland|grasslands|meadow|meadows|plain|plains)$/,terrain:"grass"},
  {test:/^(?:(?:low|high|rolling|rocky) )?(?:hill|hills|ridge)$/,terrain:"hills"},
  {test:/^(?:(?:wide|broad|deep|still|blue|cold) )?(?:lake|pond|sea|ocean)$/,terrain:"water"},
  {test:/^(?:(?:old|overgrown|narrow|winding|north|south|east|west|northern|southern|eastern|western) )?(forest|woodland|marsh|mountain|mine|cart|stone|dirt|gravel|trade|farm)? ?(?:road|path|trail|track|causeway)$/,route:"road"},
  {test:/^(?:(?:wide|broad|narrow|winding|swift|slow|cold|shallow) )?(?:river|stream|brook)$/,route:"river"}
];
function atlasPublicLandscape(title,features){
  var out={terrain:[],routes:[]};
  function add(label,id,bearing,feature){
    var phrase=String(label||"").toLowerCase().replace(/^(?:the|a|an) /,""),i,row,route;
    for(i=0;i<ATLAS_PUBLIC_LANDSCAPES.length;i++){
      row=ATLAS_PUBLIC_LANDSCAPES[i];if(!row.test.test(phrase))continue;
      if(row.terrain&&out.terrain.indexOf(row.terrain)<0&&out.terrain.length<4)out.terrain.push(row.terrain);
      if(!row.route)continue;
      if(/^(?:(?:old|overgrown|narrow|winding|north|south|east|west|northern|southern|eastern|western) )?(?:forest|woodland) /.test(phrase)&&out.terrain.indexOf("forest")<0&&out.terrain.length<4)out.terrain.push("forest");
      if(feature&&bearing==="unknown")continue;
      if(out.routes.length>=32)continue;
      route={id:id,kind:row.route==="road"&&/ (?:path|trail|track)$/.test(" "+phrase)?"path":row.route,bearing:bearing};
      if(feature)route.feature=feature;out.routes.push(route);
    }
  }
  add(title,"here","unknown",null);
  features.forEach(function(f){if(f.mode==="observed")add(f.label,f.id,f.bearing,f.id);});
  return out;
}
