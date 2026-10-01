// Blueprint authoring only. Frequency lives in notes because the runtime reads that field.
(function(root){
  var fields={
    kind:{label:"Kind",help:"Pack means a group encountered together.",values:["Beast","Humanoid","Corrupted","Giant","Undead","Magical","Pack","Construct","Elemental","Plant","Aberration","Dragon"]},
    threat:{label:"Threat",help:"Safe is harmless; Catastrophic threatens a region or world.",values:["Safe","Minor","Dangerous","Lethal","Catastrophic"]},
    frequency:{label:"Frequency",help:"How often encountered. Unique means one individual.",values:["common","uncommon","scarce","rare","unique"]},
    treasure:{label:"Treasure type",help:"Possessions, a cache, or useful remains; not guaranteed loot.",default:"None",values:["None","Coins & valuables","Trade goods","Equipment","Salvage","Crafting materials","Magic items","Relics","Mixed hoard"]}
  };
  var maxCount=20;
  function plan(input,random){
    input=Object.assign({},input||{});Object.keys(fields).forEach(function(k){if(input[k]==null&&fields[k].default)input[k]=fields[k].default;});var n=Number(input.count),out=[],i,k,p,v;random=random||Math.random;
    if(!n||!isFinite(n)||Math.floor(n)!==n||n<1||n>maxCount)throw new Error("Number of new creatures must be a whole number from 1 to "+maxCount+".");
    Object.keys(fields).forEach(function(key){if(input[key]!=="random"&&fields[key].values.indexOf(input[key])<0)throw new Error("Choose a valid "+fields[key].label+".");});
    for(i=0;i<n;i++){p={};for(k in fields){v=fields[k].values;p[k]=input[k]==="random"?v[Math.floor(random()*v.length)]:input[k];}out.push(p);}
    return out;
  }
  function entry(raw,choice,existing){
    if(raw&&typeof raw.error==="string"&&raw.error.trim())throw new Error(raw.error.trim());
    if(!raw||Array.isArray(raw)||typeof raw.name!=="string"||!raw.name.trim()||typeof raw.notes!=="string"||!raw.notes.trim())throw new Error("The model returned a creature without a name or notes.");
    var name=raw.name.trim();
    if(existing.some(function(c){return String(c.name||"").trim().toLowerCase()===name.toLowerCase();}))throw new Error("A creature named “"+name+"” already exists. Try again.");
    return {name:name,kind:choice.kind,threat:choice.threat,notes:"Frequency: "+choice.frequency+". Treasure: "+(choice.treasure||"None")+". "+raw.notes.trim()};
  }
  function prompt(context,choice,names){
    return context+"\n\nTASK: Invent exactly ONE new creature in service to this campaign's regions, factions, tone, and conflicts."
      +"\nKind: "+choice.kind+"\nThreat: "+choice.threat+"\nFrequency: "+choice.frequency+"\nTreasure type: "+choice.treasure
      +"\nRespect the hard campaign rules and established canon. If these selections cannot fit, return only {\"error\":\"Explain the conflicting choice\"}; never silently contradict a rule."
      +"\nThese selections are requirements. Safe means harmless; Catastrophic means a regional or world-scale danger. Pack means a collective creature encounter."
      +"\nFrequency describes how often it is encountered, not its strength. Unique means a single individual in the setting."
      +"\nTreasure is a category, not a guaranteed drop or a new economy. None means no associated treasure. Otherwise describe plausible possessions, a lair cache, or useful remains, fitting the creature and campaign. Do not assign gold values or mechanical rewards."
      +"\nDo not duplicate any existing creature or these names already generated in this batch: "+names.join(", ")
      +"\nNotes: 2–4 concise sentences about nature, appearance, behaviour, tactics and weaknesses. Fit the selected threat and frequency. No numeric combat stats; do not repeat the frequency label."
      +"\nOutput ONLY this JSON object: {\"name\":\"\",\"notes\":\"\"}";
  }
  function textBlueprint(bp){return JSON.parse(JSON.stringify(bp,function(k,v){return k==="portrait"||(k&&k.charAt(0)==="_")?undefined:v;}));}
  function preservePortrait(previous,next){delete next.portrait;if(previous&&previous.portrait)next.portrait=previous.portrait;return next;}
  var api={preservePortrait:preservePortrait,fields:fields,maxCount:maxCount,plan:plan,entry:entry,prompt:prompt,textBlueprint:textBlueprint};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.DesignerCreatures=api;
})(this);
