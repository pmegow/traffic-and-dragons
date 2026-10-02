require("./common.js");
var h = world();
P("version", ver());
P("hero", h);
var r = run("It happens. [NPC_NOTE:" + h + "|keeps a ledger]");
P("muts", r.muts);
P("state", heroState());
