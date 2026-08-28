// Retained mutation proof for Fable f75's satellite injection/seam contract.
var sabotage = require("./sabotage.js");

process.exit(sabotage.prove({
  file: "bug_tracker.html",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    {
      label: "report text funnel changed to executable HTML",
      mustFail: "executable-HTML sink found",
      find: "if(text!=null)e.textContent=text;",
      replace: "if(text!=null)e.innerHTML=text;"
    },
    {
      label: "report text funnel no longer assigns textContent",
      mustFail: "el() lost its textContent assignment",
      find: "if(text!=null)e.textContent=text;",
      replace: "if(text!=null)e.innerText=text;"
    },
    {
      label: "filed report body bypasses its inert sink",
      mustFail: "el(\"pre\",\"report\",b.report)",
      find: "el(\"pre\",\"report\",b.report)",
      replace: "el(\"pre\",\"report\",String(b.report))"
    },
    {
      label: "feed report body bypasses its inert sink",
      mustFail: "el(\"pre\",\"report\",body)",
      find: "el(\"pre\",\"report\",body)",
      replace: "el(\"pre\",\"report\",String(body))"
    },
    {
      label: "findings/action text bypasses its inert sink",
      mustFail: "el(\"div\",\"sectext\",text)",
      find: "el(\"div\",\"sectext\",text)",
      replace: "el(\"div\",\"sectext\",String(text))"
    },
    {
      label: "browser test seam renamed away",
      mustFail: "window.__bugTrackerTest must expose",
      find: "window.__bugTrackerTest={",
      replace: "window.__bugTrackerTestMissing={"
    }
  ]
}));
