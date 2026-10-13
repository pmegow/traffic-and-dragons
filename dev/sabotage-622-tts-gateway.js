// sabotage-622-tts-gateway.js — prove the #622 client guards are not decorative.
// #622 (owner rulings 2026-10-12): a keyless signed-in entitled player's Speechify rides the T&D
// server; an own key wins; the picker lists a non-admin only the reachable readers; the Voice
// Settings row is open and its key fields are dev-only. Each mutation removes one load-bearing
// clause; the named test must turn red; sabotage.js restores byte-identical source after each.
var sabotage=require("./sabotage.js"),rc=0;
var SUITE=["node",["dev/tests-622-tts-gateway.js"]];
var ENGINE=["node",["dev/run-tests.js","#622"]];

rc|=sabotage.prove({file:"tts.js",command:SUITE,cases:[
  {label:"Speechify loses its server flag",
   mustFail:"the route: a signed-in entitled keyless player rides the server",
   find:'server: true,/* #622 (owner ruling 2026-10-12)',
   replace:'server: false,/* #622 (owner ruling 2026-10-12)'},
  {label:"an own key no longer wins (the gateway would pay for a BYOK player)",
   mustFail:"the route: no sign-in and no key is null; a staged key wins",
   find:'    if (own) return { own: true, key: own };\n',
   replace:''},
  {label:"an unflagged reader rides the server too",
   mustFail:"the route: a signed-in entitled keyless player rides the server",
   find:'    if (!m.server) return null;\n',
   replace:''},
  {label:"entitlement is not checked",
   mustFail:"the route: a signed-in entitled keyless player rides the server",
   find:'if (typeof serverAccount === "undefined" || !serverAccount || !serverAccount.entitled) return null;',
   replace:'if (typeof serverAccount === "undefined" || !serverAccount) return null;'},
  {label:"the server route posts to the vendor endpoint",
   mustFail:"synthesis on the server route",
   find:'var url = route.server ? _voiceServerUrl("/api/tts/" + id) : m.endpoint;',
   replace:'var url = m.endpoint;'},
  {label:"the server's refusal sentence is dropped (the toast would say 'quota or rate limit')",
   mustFail:"the server's refusals reach the read as the server's own sentence",
   find:'if (body && typeof body.error === "string") reason = (typeof body.message === "string" && body.message) ? body.message : body.error;',
   replace:'/* no server sentence */'},
  {label:"the server catalog skips the client's mapper (an unsupported actor would be offered)",
   mustFail:"the catalog on the server route",
   find:'      sj.voices.forEach(admit);\n',
   replace:'      sj.voices.forEach(function(v) { voices.push({ id: v.id, label: v.display_name || v.id, g: "", note: "" }); });\n'},
  {label:"available() reads the key again instead of the route",
   mustFail:"available() follows the route",
   find:'!!_voiceRoute(id)/* #622: an own key OR the server route */',
   replace:'!!_voiceKey(id)'},
  {label:"the validator demands a key on the server route",
   mustFail:"the validator passes a keyless draft on the server route",
   find:'if (m.key && !_voiceRoute(d.primary, d.keys[d.primary])) return',
   replace:'if (m.key && !String(d.keys[d.primary] || "").trim()) return'}
]});

rc|=sabotage.prove({file:"ui-boot.js",command:ENGINE,cases:[
  {label:"the Voice Settings row is dev-only again",
   mustFail:"the Voice Settings row is marked fm-dev-only again",
   find:'btn(p+"tts-settings","🔊 Voice Settings&hellip;",0)',
   replace:'btn(p+"tts-settings","🔊 Voice Settings&hellip;",0,{cls:"fm-dev-only"})'}
]});

rc|=sabotage.prove({file:"ui-voice-settings.js",command:ENGINE,cases:[
  {label:"the key block loses its dev-only wrapper (a tester would see a key field)",
   mustFail:"the Voice Settings key block lost its fm-dev-only wrapper",
   find:"<div class='fm-dev-only'><div class='tts-connection'>",
   replace:"<div><div class='tts-connection'>"},
  {label:"the picker lists every model for everyone",
   mustFail:"the Voice Settings model picker no longer filters",
   find:'modelChoices(draft).map(function(id) { return option(id, S.models[id].label, draft.primary); })',
   replace:'Object.keys(S.models).map(function(id) { return option(id, S.models[id].label, draft.primary); })'}
]});

process.exit(rc);
