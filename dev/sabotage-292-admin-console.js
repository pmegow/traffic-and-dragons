var sabotage=require("./sabotage.js"),bad=0;
var common={command:["node",["dev/tests-292-admin-console.js"]],also:["admin_console.html","ui-boot.js","sw.js","dev/tests-292-admin-console.js"]};
function prove(file,cases){bad|=sabotage.prove(Object.assign({},common,{file:file,cases:cases}));}
prove("admin_console.html",[
  {label:"health response generation",find:"if(thisRefresh!==refreshId)return;",replace:"",mustFail:"#292 operator console > older health responses cannot replace a newer refresh"},
  {label:"operator identity gate",find:"a.isAdmin!==true",replace:"false",mustFail:"#292 operator console > signed-out and non-admin views cannot mutate accounts"},
  {label:"unpriced models stay visible",find:"total.unpriced.push(String(u.provider)+\"/\"+String(u.model));",replace:"",mustFail:"#292 operator console > cached and uncached tokens are priced once; unknown models are not free"},
  {label:"roster stays inert",find:"n.textContent=text",replace:"n.innerHTML=text",mustFail:"#292 operator console > untrusted roster text stays inert and empty activity is explicit"},
  {label:"refresh errors stay visible",find:'status("Users unavailable: "+(usersErr||"invalid server response"),true);',replace:'status("",false);',mustFail:"#292 operator console > failed refresh clears stale roster and shouts the reason"},
  {label:"subscription confirmation",find:'if(!window.confirm(names[action]+" for "+name+" ("+userId+")\\n\\n"+explanation))return;',replace:"",mustFail:"#292 operator console > cancelled, invalid and repeated subscription actions cannot submit"},
  {label:"action in-flight latch",find:"function applyAction(userId,action,tier,days){\n    if(pending)return;",replace:"function applyAction(userId,action,tier,days){",mustFail:"#292 operator console > cancelled, invalid and repeated subscription actions cannot submit"}
]);
prove("storage-adapter.js",[
  {label:"server refusal body survives",find:'" — " + d.error',replace:'""',mustFail:"#292 operator console > admin refusal retains the server reason"},
  {label:"admin transport route",find:'_apiJson("/api/admin/users", "GET", null, cb, true)',replace:'_apiJson("/api/account", "GET", null, cb, true)',mustFail:"#292 operator console > admin API methods share authenticated bounded transport"}
]);
prove("sw.js",[{label:"network-first satellite",find:"|admin_console|",replace:"|",mustFail:"#292 operator console > satellite contracts:"}]);
prove("ui-boot.js",[{label:"dev-only menu",find:'btn(p+"admin-console","Operator console&hellip;",0,{cls:"fm-dev-only"})',replace:'btn(p+"admin-console","Operator console&hellip;",0)',mustFail:"#292 operator console > satellite contracts:"}]);
process.exitCode=bad;
