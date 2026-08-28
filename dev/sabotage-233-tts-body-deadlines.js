// Retained mutation proof for the two full-operation TTS deadlines.
// Each target runs in sabotage.js's disposable clone; the working tree is never rewritten.
var sabotage = require("./sabotage.js");

process.exit(sabotage.prove({
  file: "tts.js",
  command: ["node", ["dev/tests-233-tts-body-deadlines.js"]],
  cases: [
    {
      label: "server deadline cleared at headers instead of after arrayBuffer",
      mustFail: "server deadline covers a stalled arrayBuffer() body",
      find: "      var res = await fetch(_ttsServerUrl() + \"/api/tts\", opts);\n      if (!res.ok) {",
      replace: "      var res = await fetch(_ttsServerUrl() + \"/api/tts\", opts);\n      if (tid) { clearTimeout(tid); tid = null; }\n      if (!res.ok) {"
    },
    {
      label: "Gemini deadline cleared at headers instead of after json",
      mustFail: "Gemini deadline covers a stalled json() body",
      find: "        var res = await fetch(_geminiEndpoint(model), opts);\n        var j = await res.json();",
      replace: "        var res = await fetch(_geminiEndpoint(model), opts);\n        if (tid) { clearTimeout(tid); tid = null; }\n        var j = await res.json();"
    },
    {
      label: "server timeout remainder appended behind later speech",
      mustFail: "timeout handoffs preserve the unread remainder and resume the queue",
      find: "_queue.unshift({ text: _remText, piper: true",
      replace: "_queue.push({ text: _remText, piper: true"
    },
    {
      label: "Gemini timeout remainder appended behind later speech",
      mustFail: "timeout handoffs preserve the unread remainder and resume the queue",
      find: "_queue.unshift({ text: rem, piper: true",
      replace: "_queue.push({ text: rem, piper: true"
    }
  ]
}));
