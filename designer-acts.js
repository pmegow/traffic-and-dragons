// Authoring act references: selection views are read-only; structural edits commit together.
(function(root){
  function all(acts){return (acts||[]).map(function(a,i){return i+1;});}
  function problem(values,acts){
    if(!Array.isArray(values))return "Available acts must be a list of act numbers.";
    var seen={},i,n;for(i=0;i<values.length;i++){n=values[i];if(typeof n!=="number"||!isFinite(n)||n%1||n<1||n>(acts||[]).length||seen[n])return "Available acts must be unique whole act numbers from 1 to "+(acts||[]).length+".";seen[n]=1;}
    return "";
  }
  function selection(c,acts){
    if(c.availableActs!==undefined){
      if(c.revealAct!==undefined)throw new Error("A creature cannot have both available acts and a legacy reveal act.");
      var issue=problem(c.availableActs,acts);if(issue)throw new Error(issue);return c.availableActs.slice().sort(function(a,b){return a-b;});
    }
    var numbers=all(acts);
    if(c.revealAct!==undefined){if(problem([c.revealAct],acts))throw new Error("The legacy reveal act does not name an existing act.");numbers=numbers.filter(function(n){return n>=c.revealAct;});}
    return numbers;
  }
  function choose(c,values,acts){
    var issue=problem(values,acts);if(issue)throw new Error(issue);
    delete c.revealAct;
    if(values.length>0&&values.length===(acts||[]).length)delete c.availableActs;
    else c.availableActs=values.slice().sort(function(a,b){return a-b;});
  }
  var targets=[{field:"revealAct",label:"secret"},{field:"armor",label:"plot armor"}];
  function restructure(bp,next){
    var old=bp.acts||[],map=[],writes=[],i,j;
    if(next.length===old.length&&next.every(function(a,i){return a===old[i];}))return;
    for(i=0;i<next.length;i++)if(next.indexOf(next[i])!==i)throw new Error("An act cannot appear twice.");
    for(i=0;i<old.length;i++)map[i+1]=next.indexOf(old[i])+1;
    (bp.creatures||[]).forEach(function(c){
      if(c.availableActs===undefined&&c.revealAct===undefined)return;
      var selected=selection(c,old),mapped=selected.map(function(n){return map[n];}).filter(function(n){return n>0;});
      writes.push(function(){delete c.revealAct;c.availableActs=mapped.sort(function(a,b){return a-b;});});
    });
    (bp.npcs||[]).forEach(function(n){targets.forEach(function(ref){
      var v=n[ref.field];if(v===undefined||v===null||v===""||ref.field==="armor"&&!/^\d+$/.test(String(v).trim()))return;
      var number=Number(v);if(problem([number],old))throw new Error((n.name||"NPC")+" has an invalid act reference for "+ref.label+".");
      var moved=map[number];if(!moved)throw new Error("Cannot remove act "+number+": "+(n.name||"NPC")+" still uses it for "+ref.label+". Choose another act first.");
      writes.push(function(){n[ref.field]=moved;});
    });});
    writes.forEach(function(write){write();});bp.acts=next;
  }
  var api={all:all,problem:problem,selection:selection,choose:choose,restructure:restructure};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.DesignerActs=api;
})(this);
