// sabotage-634-menu-layout.js — prove the #634 menu-layout and theme pins are not decorative.
// #634 (owner 2026-10-15): a Dark mode toggle in Settings (default on, off = the light palette copied from
// website/themes.css and derived by contract), an Audio drawer (voice, UI sounds, ambience), an operator-only
// Dev tools drawer (language model, usage & cost, render options), Campaigns under Save / Load, no Campaign
// Blueprints row, the Sync button operator-only, the Re-roll button gone. Each mutation removes one
// load-bearing clause; the MENU TIER or THEME PALETTE contract in run-tests.js must turn red by name;
// sabotage.js restores byte-identical source after each.
//
// THE GATE: `node dev/run-tests.js repairModelJson` — the source contracts run at the top of run-tests.js
// unconditionally, before the engine suite and independent of the section filter (the shape
// sabotage-contract-tier.js established), so every clause here reddens in under a second.
var sabotage=require("./sabotage.js"),rc=0;
var GATE=["node",["dev/run-tests.js","repairModelJson"]];

rc|=sabotage.prove({file:"ui-boot.js",command:GATE,cases:[
  {label:"the mobile Sync state row loses fm-dev-only (a tester's phone menu would show it)",
   mustFail:"the mobile Sync state row lost fm-dev-only",
   find:'btn("fm-sync-mob","Sync state",0,{cls:"fm-mobile-only fm-dev-only",hidden:true})',
   replace:'btn("fm-sync-mob","Sync state",0,{cls:"fm-mobile-only",hidden:true})'},
  {label:"the Re-roll mobile row returns",
   mustFail:"the Re-roll button is back",
   find:'    if(g)h+=btn(p+"ending",',
   replace:'    if(g)h+=btn("fm-reroll-mob","Re-roll last scene",0,{cls:"fm-mobile-only",hidden:true});\n    if(g)h+=btn(p+"ending",'},
  {label:"the Campaign Blueprints row returns",
   mustFail:"the Campaign Blueprints menu row is back",
   find:'    h+=g?btn(p+"bugreport",',
   replace:'    h+=btn(p+"blueprints","Campaign Blueprints&hellip;",0);\n    h+=g?btn(p+"bugreport",'},
  {label:"the Dev tools drawer loses its fm-dev-only wrapper (a tester would see the drawer)",
   mustFail:"the Dev tools drawer lost its fm-dev-only wrapper",
   find:"\"<div class='fm-dev-only'>\"+drawer(p+\"devtools\"",
   replace:"\"<div>\"+drawer(p+\"devtools\""},
  {label:"Render Options loses its own flag inside the drawer",
   mustFail:"operator row 'fal-key' is not marked fm-dev-only",
   find:'btn(p+"fal-key","🖼 Render Options&hellip;",0,{cls:"fm-dev-only"})',
   replace:'btn(p+"fal-key","🖼 Render Options&hellip;",0)'},
  {label:"Campaigns leaves the Save / Load drawer for the menu root again",
   mustFail:"the Campaigns row left the Save / Load drawer",
   find:'    var sl=btn(p+"campaigns","&#128193; Campaigns&hellip;",0,{color:"var(--acc)",extra:"font-weight:bold;"})',
   replace:'    h+=btn(p+"campaigns","&#128193; Campaigns&hellip;",0,{color:"var(--acc)",extra:"font-weight:bold;"});\n    var sl=""'},
  {label:"Voice Settings leaves the Audio drawer (its row id changes under the drawer)",
   mustFail:"the Audio drawer lost btn(p+\"tts-settings\"",
   find:'    var aud=btn(p+"tts-settings","🔊 Voice Settings&hellip;",0)',
   replace:'    var aud=btn(p+"voice-settings","🔊 Voice Settings&hellip;",0)'},
  {label:"the Language Model row leaves the Dev tools drawer (still flagged, so only the drawer pin can catch it)",
   mustFail:"the Dev tools drawer lost btn(p+\"llm\"",
   find:'    var dev=btn(p+"llm","🧠 Language Model&hellip;",0,{cls:"fm-dev-only"})\n      +btn(p+"usage"',
   replace:'    var llmRow=btn(p+"llm","🧠 Language Model&hellip;",0,{cls:"fm-dev-only"});\n    var dev=btn(p+"usage"'},
  {label:"the Audio drawer's toggle is dropped from the cascading loop",
   mustFail:"an Audio or Dev tools drawer is unwired",
   find:'[["devmode","devmenu"],["saveload","saveloadmenu"],["audio","audiomenu"],["narropts","narroptsmenu"],["devtools","devtoolsmenu"]]',
   replace:'[["devmode","devmenu"],["saveload","saveloadmenu"],["narropts","narroptsmenu"],["devtools","devtoolsmenu"]]'},
  {label:"the Dark mode row is gone",
   mustFail:"the Dark mode row is unwired or gone",
   find:'    var dm=chk(p+"dark-cb","🌙 Dark mode",0)',
   replace:'    var dm=""'},
  {label:"the Dark mode row is not wired to the toggle",
   mustFail:"the Dark mode row is unwired or gone",
   find:'["font-lg",toggleFontSize],["dark-cb",toggleDarkMode]]',
   replace:'["font-lg",toggleFontSize]]'},
  {label:"boot no longer loads the theme (the menu row would read unchecked in light mode)",
   mustFail:"initSettings no longer loads the theme",
   find:'  loadTheme();loadFontSize();updateServerUI();',
   replace:'  loadFontSize();updateServerUI();'}
]});

rc|=sabotage.prove({file:"index.html",command:GATE,cases:[
  {label:"the topbar Sync button loses fm-dev-only",
   mustFail:"the topbar Sync button lost fm-dev-only",
   find:'<button class="ib fm-dev-only" id="sync-btn"',
   replace:'<button class="ib" id="sync-btn"'},
  {label:"the Re-roll button returns to the topbar",
   mustFail:"the Re-roll button is back",
   find:'      <button class="ib" id="tts-btn"',
   replace:'      <button class="ib" id="reroll-btn">&#8635; Re-roll</button>\n      <button class="ib" id="tts-btn"'},
  {label:"a light token drifts from website/themes.css",
   mustFail:"light token --acc differs between index.html",
   find:'  --acc:#883c2d;--on-acc:#fff5d9;--acc-bg:#ecd4b5;',
   replace:'  --acc:#883c2e;--on-acc:#fff5d9;--acc-bg:#ecd4b5;'},
  {label:"a themed token goes missing from the light block",
   mustFail:"light token --modal-bg is themed in website/themes.css but missing",
   find:'  --modal-bg:#eaddb9;\n',
   replace:''},
  {label:"a dark token drifts from website/themes.css",
   mustFail:"dark token --acc differs between index.html",
   find:'  --acc:#9ab0c8;--on-acc:#000;--acc-bg:#141c24;',
   replace:'  --acc:#9ab0c9;--on-acc:#000;--acc-bg:#141c24;'},
  {label:"the head script stops reading the stored theme (every load would paint dark)",
   mustFail:"head no longer applies the stored theme",
   find:'if(localStorage.getItem("tnd_theme_v1")==="light")t="light";',
   replace:'t="dark";'},
  {label:"the dark color-scheme declaration is dropped (form controls would stay light-styled)",
   mustFail:"lost a color-scheme declaration",
   find:':root[data-theme="dark"]{color-scheme:dark}\n',
   replace:''},
  {label:"the head script's key diverges from the toggle's (a light-mode player would flash dark every load)",
   mustFail:"head no longer applies the stored theme (tnd_theme_v1",
   find:'localStorage.getItem("tnd_theme_v1")==="light"',
   replace:'localStorage.getItem("tnd_theme_v2")==="light"'}
]});

/* The toggle's side of the key: a literal rename here trips the storage-key census (#523) before the theme
   contract — so the mutation hides the key behind an expression instead, which the contract's literal pin
   refuses (the head script can only be checked against a literal). */
rc|=sabotage.prove({file:"ui-modals.js",command:GATE,cases:[
  {label:"THEME_KEY stops being a plain literal the head script can be checked against",
   mustFail:"ui-modals.js lost THEME_KEY",
   find:'var THEME_KEY="tnd_theme_v1";',
   replace:'var THEME_KEY="tnd_theme_v1".replace("v1","v1");'}
]});

rc|=sabotage.prove({file:"website/themes.css",command:GATE,cases:[
  {label:"the shared light palette moves without the game's copy",
   mustFail:"light token --acc differs between index.html",
   find:'  --acc:#883c2d;--on-acc:#fff5d9;--acc-bg:#ecd4b5;',
   replace:'  --acc:#883c2e;--on-acc:#fff5d9;--acc-bg:#ecd4b5;'}
]});

process.exit(rc);
