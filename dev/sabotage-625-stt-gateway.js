// sabotage-625-stt-gateway.js — prove the #625 client guards are not decorative.
// #625: a keyless signed-in entitled player's dictation rides the T&D server; an own key wins;
// an account refusal ends the attempt. Each mutation removes one load-bearing clause; the named
// test must turn red; sabotage.js restores byte-identical source after each.
var sabotage=require("./sabotage.js"),rc=0;
var SUITE=["node",["dev/tests-625-stt-gateway.js"]];

rc|=sabotage.prove({file:"stt.js",command:SUITE,cases:[
  {label:"an own key no longer wins (the gateway would pay for a BYOK player)",
   mustFail:"the route: no key and no sign-in is null; an own key wins",
   find:"    if (own) return { own: true, key: own };\n",
   replace:""},
  {label:"the server's available flag is ignored (a tester would be offered a route that 501s)",
   mustFail:"the route: no key and no sign-in is null; an own key wins",
   find:"    if (!serverAccount.transcription || serverAccount.transcription.available !== true) return null;\n",
   replace:""},
  {label:"entitlement is not checked",
   mustFail:"the route: no key and no sign-in is null; an own key wins",
   find:"if (typeof serverAccount === \"undefined\" || !serverAccount || !serverAccount.entitled) return null;\n    if (!serverAccount.transcription",
   replace:"if (typeof serverAccount === \"undefined\" || !serverAccount) return null;\n    if (!serverAccount.transcription"},
  {label:"_cloudAvailable stops consulting the route (the mic would record, then fail to upload)",
   mustFail:"the route: no key and no sign-in is null; an own key wins",
   find:"typeof MediaRecorder !== \"undefined\" && _sttRoute());",
   replace:"typeof MediaRecorder !== \"undefined\");"},
  {label:"the server route posts to the vendor endpoint",
   mustFail:"the upload on the server route",
   find:"var url = route.server ? String(storageAdapter.getServerUrl() || \"\").replace(/\\/$/, \"\") + \"/api/stt/transcribe\" : \"https://api.openai.com/v1/audio/transcriptions\";",
   replace:"var url = \"https://api.openai.com/v1/audio/transcriptions\";"},
  {label:"the take's duration no longer rides the request (the server would meter by size)",
   mustFail:"the upload on the server route",
   find:"var h = { \"X-TND-Audio-Ms\": String(Math.round(audioMs || 0)) };",
   replace:"var h = {};"},
  {label:"an account refusal is retried on the fallback model (a second refusal, paid twice on a vendor error)",
   mustFail:"a server 429 (the daily cap) ends the attempt",
   find:"        if (e && e.terminal) throw e;\n",
   replace:""},
  {label:"the server's refusal sentence is dropped (the car would hear 'HTTP 429')",
   mustFail:"a server 429 (the daily cap) ends the attempt",
   find:"if (route.server && (resp.status === 401 || resp.status === 402 || resp.status === 429)) {",
   replace:"if (false) {"}
]});

process.exit(rc);
