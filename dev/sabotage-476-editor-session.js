// dev/sabotage-476-editor-session.js — proves the character editor's library session handling is guarded: signed-in
// needs a token, a 401 retries once after re-reading the stored session, a surviving 401 reads as the sign-in message,
// the boot probes the account, and the adapter's reloadSession really re-reads storage.
//   node dev/sabotage-476-editor-session.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "character_editor.html",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "#476 — a server URL alone counts as signed in (unauthenticated library calls)",
      mustFail: "#476: signedIn() must require a token",
      find: 'storageAdapter.isServerMode()&&storageAdapter.hasToken();}',
      replace: 'storageAdapter.isServerMode();}' },
    { label: "#476 — a 401 no longer retries after re-reading the stored session",
      mustFail: "#476: a 401 must retry once",
      find: 'if(is401(err)&&storageAdapter.reloadSession()){',
      replace: 'if(false){' },
    { label: "#476 — a 401 shows as a bare HTTP status again",
      mustFail: "#476: a 401 must map to the sign-in-again message",
      find: '  var SESSION_MSG="Session expired',
      replace: '  var SESSION_MSG_="Session expired' },
    { label: "#476 — the boot no longer probes the account",
      mustFail: "#476: the editor must probe the account at boot",
      find: '  if(signedIn())storageAdapter.fetchAccount(function(err,acct){',
      replace: '  if(false)(function(err,acct){' }
  ]
});

rc |= sabotage.prove({
  file: "storage-adapter.js",
  command: ["node", ["dev/tests-c13-adapter.js"]],
  cases: [
    { label: "#476 — reloadSession never reads storage (always a no-op)",
      mustFail: "a changed token must report true",
      find: "    if (!url || !tok) return false;\n    var changed = (url !== _serverUrl) || (tok !== _token);",
      replace: "    if (!url || !tok) return false;\n    var changed = false;" }
  ]
});

process.exit(rc);
