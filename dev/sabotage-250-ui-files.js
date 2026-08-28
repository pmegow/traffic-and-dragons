// Retained mutation proof for browser-file failure ownership.
var sabotage = require("./sabotage.js");

process.exit(sabotage.prove({
  file: "ui-files.js",
  command: ["node", ["dev/tests-250-browser-io.js"]],
  cases: [
    {
      label: "restored image error cleanup removed",
      mustFail: "restored render revokes its object URL when image decode fails",
      find: /img\.onerror=function\(\)\{/,
      replace: "img.onerror=null;function _deadRestoredRenderError(){"
    },
    {
      label: "restored image decode warning silenced",
      mustFail: "restored render revokes its object URL when image decode fails",
      find: "console.warn(\"[files] restored render could not be displayed — object URL released: \"+ptr.f);",
      replace: "console.info(\"[files] restored render could not be displayed — object URL released: \"+ptr.f);"
    },
    {
      label: "picker cancellation misclassified as an error",
      mustFail: "folder-picker cancellation is quiet and distinct from failure",
      find: "if(e&&e.name===\"AbortError\"){",
      replace: "if(false&&e&&e.name===\"AbortError\"){"
    },
    {
      label: "real picker failure toast removed",
      mustFail: "real folder-picker failures warn and toast with their reason",
      find: "showToast(\"Campaign folder \"+action+\" failed: \"+reason);",
      replace: "console.info(\"Campaign folder \"+action+\" failed: \"+reason);"
    },
    {
      label: "restored-handle permission failure swallowed",
      mustFail: "restored-folder permission failures are surfaced",
      find: ").catch(function(e){return _folderPickerFailure(e,\"permission\");});",
      replace: ").catch(function(){return false;});"
    },
    {
      label: "persistent clear failure toast removed",
      mustFail: "clear-folder persistence failure is loud",
      find: "showToast(\"Folder cleared for this tab, but reload may restore it: \"+reason);",
      replace: "console.info(\"Folder cleared for this tab, but reload may restore it: \"+reason);"
    }
  ]
}));
