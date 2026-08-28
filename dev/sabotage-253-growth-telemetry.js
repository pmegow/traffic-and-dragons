// Retained mutation proof for P2-03's observation-only per-store growth telemetry.
var sabotage = require("./sabotage.js"), rc = 0;

rc |= sabotage.prove({
  file: "helpers.js",
  also: ["ui-modals.js"],
  command: ["node", ["dev/run-tests.js", "#17: drift health readout"]],
  cases: [
    {
      label: "the modal opt-in stops producing growth rows",
      mustFail: "opt-in growth telemetry reports UTF-8 bytes and counts per logical store",
      find: "if(withGrowth)out.growth=healthGrowthTelemetry(ws,mem);",
      replace: "if(false)out.growth=healthGrowthTelemetry(ws,mem);"
    },
    {
      label: "astral Unicode is undercounted as two bytes",
      mustFail: "transcript byte count is not UTF-8",
      find: "{n+=4;i++;}",
      replace: "{n+=2;i++;}"
    },
    {
      label: "archive count reports buckets instead of retained records",
      mustFail: "memory counts wrong",
      find: "if(Array.isArray(v))archCount+=v.length;",
      replace: "if(Array.isArray(v))archCount++;"
    }
  ]
});

rc |= sabotage.prove({
  file: "ui-modals.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    {
      label: "the #17 modal stops opting into memory measurement",
      mustFail: "modal no longer opts into pure world+memory byte measurement",
      find: 'healthIndicators(worldState,(typeof memory!=="undefined"?memory:null),true)',
      replace: "healthIndicators(worldState)"
    },
    {
      label: "the modal replaces measured counts with zero",
      mustFail: "no longer renders the measured per-store bytes/counts truthfully",
      find: "gr.count.toLocaleString()",
      replace: "(0).toLocaleString()"
    },
    {
      label: "the modal replaces measured bytes with zero",
      mustFail: "no longer renders the measured per-store bytes/counts truthfully",
      find: "growthSize(gr.bytes)",
      replace: "growthSize(0)"
    }
  ]
});

process.exit(rc);
