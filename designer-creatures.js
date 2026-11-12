// Blueprint authoring only. Frequency lives in notes because the runtime reads that field.
(function(root){
  var Acts=typeof module!=="undefined"&&module.exports?require("./designer-acts.js"):root.DesignerActs;
  var environments=["Forest","Swamp","Desert","Grassland","Mountains","Tundra","Coast","Ocean","Freshwater","Underground","Urban area","Farmland","Ruins","Otherworld"];
  var fields={
    environment:{label:"Environment",help:"The habitat the creature is designed for.",default:"Any environment",values:["Any environment"].concat(environments),randomValues:environments},
    kind:{label:"Kind",help:"Pack means a group encountered together.",values:["Beast","Humanoid","Corrupted","Giant","Undead","Magical","Pack","Construct","Elemental","Plant","Aberration","Dragon"]},
    threat:{label:"Threat",help:"Safe is harmless; Catastrophic threatens a region or world.",values:["Safe","Minor","Dangerous","Lethal","Catastrophic"]},
    frequency:{label:"Frequency",help:"How often encountered. Unique means one individual.",values:["common","uncommon","scarce","rare","unique"]},
    treasure:{label:"Treasure type",help:"Possessions, a cache, or useful remains; not guaranteed loot.",default:"None",values:["None","Coins & valuables","Trade goods","Equipment","Salvage","Crafting materials","Magic items","Relics","Mixed hoard"]}
  };
  var maxCount=20;
  function plan(input,random,acts){
    input=Object.assign({},input||{});Object.keys(fields).forEach(function(k){if(input[k]==null&&fields[k].default)input[k]=fields[k].default;});var n=Number(input.count),out=[],i,k,p,v;random=random||Math.random;
    if(!n||!isFinite(n)||Math.floor(n)!==n||n<1||n>maxCount)throw new Error("Number of new creatures must be a whole number from 1 to "+maxCount+".");
    Object.keys(fields).forEach(function(key){if(input[key]!=="random"&&fields[key].values.indexOf(input[key])<0)throw new Error("Choose a valid "+fields[key].label+".");});
    var selected;
    if(Array.isArray(acts)&&(acts.length||input.availableActs!==undefined))selected=input.availableActs===undefined?Acts.all(acts):input.availableActs;
    else if(input.availableActs!==undefined)throw new Error("Campaign acts are required for an act selection.");
    if(selected!==undefined){var issue=Acts.problem(selected,acts);if(issue)throw new Error(issue);}
    for(i=0;i<n;i++){p={};for(k in fields){v=fields[k].randomValues||fields[k].values;p[k]=input[k]==="random"?v[Math.floor(random()*v.length)]:input[k];}if(selected!==undefined)p.availableActs=selected.slice();out.push(p);}
    return out;
  }
  function entry(raw,choice,existing,acts){
    if(raw&&typeof raw.error==="string"&&raw.error.trim())throw new Error(raw.error.trim());
    if(!raw||Array.isArray(raw)||typeof raw.name!=="string"||!raw.name.trim()||typeof raw.notes!=="string"||!raw.notes.trim())throw new Error("The model returned a creature without a name or notes.");
    var name=raw.name.trim();
    if(existing.some(function(c){return String(c.name||"").trim().toLowerCase()===name.toLowerCase();}))throw new Error("A creature named “"+name+"” already exists. Try again.");
    var result={name:name,kind:choice.kind,threat:choice.threat,notes:"Frequency: "+choice.frequency+". Treasure: "+(choice.treasure||"None")+". "+raw.notes.trim()};
    ["desc","displayName","abilities"].forEach(function(k){if(raw[k]===undefined)return;if(typeof raw[k]!=="string")throw new Error("Creature "+k+" must be text.");if(raw[k].trim())result[k]=raw[k].trim();});
    if(raw.revealAct!==undefined){if(typeof raw.revealAct!=="number"||raw.revealAct<1||raw.revealAct%1!==0||(Array.isArray(acts)&&raw.revealAct>acts.length))throw new Error("Creature revealAct must name an existing positive whole act number.");result.revealAct=raw.revealAct;}
    if(choice.environment&&choice.environment!=="Any environment")result.environment=choice.environment;
    if(choice.availableActs!==undefined)Acts.choose(result,choice.availableActs,acts);
    return result;
  }
  function prompt(context,choice,names){
    return context+"\n\nTASK: Invent exactly ONE new creature in service to this campaign's regions, factions, tone, and conflicts."
      +"\nEnvironment: "+(choice.environment||"Any environment")+"\nKind: "+choice.kind+"\nThreat: "+choice.threat+"\nFrequency: "+choice.frequency+"\nTreasure type: "+choice.treasure
      +(choice.availableActs!==undefined?"\nAllowed acts for these encounters: "+(choice.availableActs.length?choice.availableActs.join(", "):"none — keep this creature out of encounters until the author enables it")+". These selections are authoritative; do not return a different revealAct or availableActs.":"")
      +"\nRespect the hard campaign rules and established canon. If these selections cannot fit, return only {\"error\":\"Explain the conflicting choice\"}; never silently contradict a rule."
      +"\nThese selections are requirements. Safe means harmless; Catastrophic means a regional or world-scale danger. Pack means a collective creature encounter."
      +"\nFrequency describes how often it is encountered, not its strength. Unique means a single individual in the setting."
      +"\nTreasure is a category, not a guaranteed drop or a new economy. None means no associated treasure. Otherwise describe plausible possessions, a lair cache, or useful remains, fitting the creature and campaign. Do not assign gold values or mechanical rewards."
      +"\nDo not duplicate any existing creature or these names already generated in this batch: "+names.join(", ")
      +"\nNotes: 2–4 concise sentences about nature, appearance, behaviour, tactics and weaknesses. Fit the selected threat and frequency. No numeric combat stats; do not repeat the frequency label."
      +"\nKeep notes GM-only. Add desc for public appearance, with no hidden identity, origin or motives. For a disguise add displayName, the name used on screen. "
      +(choice.availableActs===undefined?"If the story reserves this creature for a later act, add revealAct as that existing act's 1-based integer; otherwise omit it.":"The author has already chosen the acts; omit availability fields.")
      +"\nOutput ONLY a JSON object with name, notes, desc, abilities (optional text for spells, special attacks, resistances and their limits; empty if none) and, only when needed, displayName"+(choice.availableActs===undefined?" and revealAct":"")+".";
  }
  function portraitPrompt(c){
    var focus=" Use a 55mm lens at f/1.8 with shallow depth of field. Keep the creature's eyes and face in sharp focus where present, with its silhouette and defining features clearly readable. Place the habitat well behind the creature: the background is softly blurred into gentle bokeh. Apply sharp focus and fine detail to the creature only; background scenery stays out of focus.";
    if(c.desc||c.displayName){
      if(!c.desc||!c.desc.trim())throw new Error("Write the creature's public appearance before illustrating its disguise.");
      return "Bestiary illustration. Visible appearance: "+c.desc+" Show only this appearance in a fitting habitat; no lettering or stat blocks."+focus;
    }
    return "Bestiary illustration. Kind: "+(c.kind||"creature")+". Threat: "+(c.threat||"unspecified")+". "+c.notes+" Show the creature clearly in a fitting habitat; no lettering or stat blocks."+focus;
  }
  function preserveCreature(previous,next){
    preserveEntity(previous,next);
    if(previous){["environment","availableActs","revealAct","desc","displayName"].forEach(function(k){
      if(k==="revealAct"&&next.availableActs!==undefined||k==="availableActs"&&next.revealAct!==undefined)return;
      if(next[k]===undefined&&previous[k]!==undefined)next[k]=Array.isArray(previous[k])?previous[k].slice():previous[k];
    });}
    return next;
  }
  function textBlueprint(bp){return JSON.parse(JSON.stringify(bp,function(k,v){return k==="portrait"||(k&&k.charAt(0)==="_")?undefined:v;}));}
  function preserveEntity(previous,next){preservePortrait(previous,next);if(previous&&next.abilities===undefined&&previous.abilities!==undefined)next.abilities=previous.abilities;return next;}
  function preservePortrait(previous,next){delete next.portrait;if(previous&&previous.portrait)next.portrait=previous.portrait;return next;}
  var api={preserveEntity:preserveEntity,preserveCreature:preserveCreature,portraitPrompt:portraitPrompt,preservePortrait:preservePortrait,fields:fields,maxCount:maxCount,plan:plan,entry:entry,prompt:prompt,textBlueprint:textBlueprint};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.DesignerCreatures=api;
})(this);
