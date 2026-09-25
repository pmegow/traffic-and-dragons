// Blueprint edition contract. Also vendored unchanged as blueprint-edition.cjs on the catalog server.
// Revision components are integers, never decimals: 0.09 -> 0.10, 0.99 -> 0.100.
var BlueprintEdition=(function(){
  var statuses={draft:"Draft","release-candidate":"Release Candidate",released:"Released"};
  function parts(v){
    if(typeof v!=="string"||v!==v.trim()||!/^(0|[1-9][0-9]{0,5})\.(0|0[1-9]|[1-9][0-9]{1,5})$/.test(v))return null;
    var p=v.split("."),a=Number(p[0]),b=Number(p[1]);return a===0&&b===0?null:[a,b];
  }
  function compare(a,b){var x=parts(a),y=parts(b);if(!x||!y)throw new Error("Invalid blueprint version.");return x[0]===y[0]?x[1]-y[1]:x[0]-y[0];}
  function next(v){var p=parts(v);if(!p)throw new Error("Invalid blueprint version.");var n=p[1]+1;if(n>999999)throw new Error("Blueprint revision limit reached; start a new major candidate.");return p[0]+"."+(n<10?"0":"")+n;}
  function adopt(b){
    if(b.version===undefined)b.version="0.01";
    if(b.releaseStatus===undefined){var p=parts(b.version);b.releaseStatus=p&&p[0]>0?"release-candidate":"draft";}
    return b;
  }
  function problem(b){
    var p=parts(b.version);
    if(!p)return "Blueprint version must be text such as 0.01, 0.10, 1.0 or 1.01 (starting at 0.01).";
    if(typeof b.releaseStatus!=="string"||!Object.prototype.hasOwnProperty.call(statuses,b.releaseStatus))return "Blueprint status must be Draft, Release Candidate or Released.";
    if(b.releaseStatus!=="draft"&&p[0]===0)return "Release candidates and released blueprints must be version 1.0 or higher.";
    return null;
  }
  // Order-independent content identity; editor state and publication metadata are not story edits.
  function key(b){
    function sorted(v,root){
      if(Array.isArray(v))return v.map(function(x){return sorted(x,false);});
      if(!v||typeof v!=="object")return v;
      var o={};Object.keys(v).sort().forEach(function(k){
        if(k.charAt(0)==="_"||root&&["version","releaseStatus","designerVersion","catalogId","review"].indexOf(k)>=0)return;
        if(v[k]===""||root&&k==="kind"&&v[k]==="adventure")return;
        if(root&&["npcs","locations","rules","creatures","customClasses","deepTime"].indexOf(k)>=0&&Array.isArray(v[k])&&!v[k].length)return;
        o[k]=sorted(v[k],false);
      });return o;
    }
    return JSON.stringify(sorted(b,true));
  }
  function baseline(b){return {version:b.version,releaseStatus:b.releaseStatus,key:key(b)};}
  function plan(b,base){
    var e=adopt({version:b.version,releaseStatus:b.releaseStatus});
    if(problem(e))return e;
    if(base&&key(b)!==base.key){
      if(compare(e.version,base.version)<=0)e.version=next(base.version);
      if(e.releaseStatus==="released")e.releaseStatus="release-candidate";
    }
    return e;
  }
  function publication(b,old){
    var e=adopt({version:b.version,releaseStatus:b.releaseStatus});if(!old||problem(e))return e;
    var previous=adopt({version:old.version,releaseStatus:old.releaseStatus});
    if(problem(previous))throw new Error("The catalog edition is invalid; correct it before publishing.");
    var changed=key(b)!==key(old),cmp=compare(e.version,previous.version);
    if(cmp<0||changed&&cmp===0){e.version=changed?next(previous.version):previous.version;e.releaseStatus=parts(e.version)[0]>0?"release-candidate":"draft";}
    if(changed&&e.releaseStatus==="released")e.releaseStatus="release-candidate";
    return e;
  }
  function publishProblem(b,old){
    var issue=problem(b);if(issue||!old)return issue;
    var expected=publication(b,old);
    return expected.version!==b.version||expected.releaseStatus!==b.releaseStatus?"Content changed or the version is stale. Publish a newer candidate edition ("+expected.version+") before marking it Released.":null;
  }
  function label(b){var e=adopt({version:b&&b.version,releaseStatus:b&&b.releaseStatus});return problem(e)?"Invalid blueprint edition":"v"+e.version+" · "+statuses[e.releaseStatus];}
  return {statuses:statuses,parts:parts,compare:compare,next:next,adopt:adopt,problem:problem,key:key,baseline:baseline,plan:plan,publication:publication,publishProblem:publishProblem,label:label};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=BlueprintEdition;
