// sabotage-438-folder-rename.js — mutation proof for #438: the occupied-destination refusal, the same-entry
// exemption, and the source-intact promise on a failed copy. Usage: node dev/sabotage-438-folder-rename.js
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  file:"ui-files.js",
  command:["node",["dev/tests-438-folder-rename.js"]],
  cases:[
    { label:"#438: the destination probe is gone — an occupied folder is treated as free again",
      mustFail:"an occupied destination is REFUSED",
      find:'  return _campRootHandle.getDirectoryHandle(newSlug,{create:false}).then(function(existing){',
      replace:'  return Promise.reject(Object.assign(new Error("x"),{name:"NotFoundError"})).then(function(existing){' },
    { label:"#438: a same-entry rename is refused as a collision",
      mustFail:"a case-only rename on a case-insensitive disk",
      find:"      if(same)return {same:true};\n",
      replace:"" },
    { label:"#438: the source is removed before the copy is known to have succeeded",
      mustFail:"a copy that fails midway leaves the source intact",
      find:"      return _copyDir(oldHandle,newDir).then(function(){\n        return _campRootHandle.removeEntry(oldName,{recursive:true});\n      }).then(function(){",
      replace:"      return _campRootHandle.removeEntry(oldName,{recursive:true}).then(function(){\n        return _copyDir(oldHandle,newDir);\n      }).then(function(){" }
  ]
}));
