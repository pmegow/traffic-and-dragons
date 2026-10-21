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
    },
    {
      label: "#651 QA activity value bypasses its inert sink",
      mustFail: "el(\"span\",\"actval\",val)",
      find: "el(\"span\",\"actval\",val)",
      replace: "el(\"span\",\"actval\",String(val))"
    },
    {
      label: "#651 an unreadable activity log is swallowed instead of said",
      mustFail: "unreadable DOC/QA_ACTIVITY.md must be said",
      find: ".catch(function(e){renderActivitySection(wrap,[],e.message);})",
      replace: ".catch(function(e){})"
    },
    {
      label: "#651 the activity parser leaves the seam",
      mustFail: "parseActivity, renderActivitySection",
      find: "  parseActivity:parseActivity,\n",
      replace: ""
    }
  ]
}));
