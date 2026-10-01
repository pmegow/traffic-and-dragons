// dev/sabotage-502-ambience-insecure-page.js — proves the #502 guards are guarded. On a page that is not a secure context
// (plain http that is not localhost) the browser has no SubtleCrypto: the audio checksum threw, the player was told "Ambience:
// Cannot read properties of undefined (reading 'digest')", and every scene downloaded its audio for nothing. ONE rule
// (audioVerifyRefusal / audioPageRefusal, audio-loader.js) now makes the loader refuse before it downloads, the checksum
// refuse in plain words, and the ambience shell say it once and start nothing. Each mutation runs in a disposable clone.
//   node dev/sabotage-502-ambience-insecure-page.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/tests-502-ambience-insecure-page.js"]];
var RULE = "#502 the rule", SUM = "#502 the checksum on an insecure page", LOAD = "#502 the loader refuses BEFORE it downloads",
    SHELL = "#502 the ambience shell on an insecure page", FILE = "#502 a local file keeps its own words";
rc |= sabotage.prove({ file: "audio-loader.js", command: CMD, cases: [
  { label: "the loader downloads the audio before it refuses",
    find: "      var cannot=audioPageRefusal();if(cannot)return Promise.reject(new Error(cannot));/* #502: refuse BEFORE the download", replace: "      /* #502: refuse BEFORE the download",
    mustFail: LOAD },
  { label: "the checksum throws its TypeError again",
    find: "  var cannot=audioPageRefusal();if(cannot)return Promise.reject(new Error(cannot));\n  return crypto.subtle.digest(", replace: "  return crypto.subtle.digest(",
    mustFail: SUM },
  { label: "the checksum is skipped on a page that cannot run it (a silent pass)",
    find: "  var cannot=audioPageRefusal();if(cannot)return Promise.reject(new Error(cannot));\n  return crypto.subtle.digest(", replace: "  if(audioPageRefusal())return Promise.resolve(bytes);\n  return crypto.subtle.digest(",
    mustFail: SUM },
  { label: "a crypto object with no digest to call counts as able to verify",
    find: "return (c&&c.subtle&&typeof c.subtle.digest===\"function\")?null:AUDIO_INSECURE_PAGE;", replace: "return (c&&c.subtle)?null:AUDIO_INSECURE_PAGE;",
    mustFail: RULE },
  { label: "the reason goes back to engine words",
    find: "var AUDIO_INSECURE_PAGE=\"This page is not secure (plain http), so the audio cannot be verified. Open the hosted game or localhost.\";", replace: "var AUDIO_INSECURE_PAGE=\"Cannot read properties of undefined (reading 'digest')\";",
    mustFail: RULE }
]});
rc |= sabotage.prove({ file: "ui-ambient.js", command: CMD, cases: [
  { label: "the shell starts audio on a page that cannot use it",
    find: "    if (pageRefusal()) { sync(); return; }", replace: "    if (location.protocol === \"file:\") { sync(); return; }",
    mustFail: SHELL },
  { label: "the shell says nothing on an insecure page",
    find: "    return typeof audioPageRefusal === \"function\" ? audioPageRefusal() : null;", replace: "    return null;",
    mustFail: SHELL },
  { label: "a local file loses its own words (and starts audio it cannot fetch)",
    find: "    if (location.protocol === \"file:\") return \"Open the hosted game or localhost to use ambience\";\n", replace: "",
    mustFail: FILE }
]});
process.exit(rc ? 1 : 0);
