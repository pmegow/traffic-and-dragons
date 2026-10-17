/* game-theme.js — the game's colour scheme for its satellite pages (#642, owner 2026-10-17: "set the FAQ to obey
   the light/dark schemes").
   The game stores the player's choice under ONE key (THEME_KEY in ui-modals.js — File ▸ ⚙ Settings ▸ Dark mode);
   index.html applies it before first paint with an inline copy of this read (the cache-first app shell must not
   wait on a network script). A satellite loads THIS file in its <head> so it paints in the same scheme as the game
   — dark unless the player chose light — and follows a change made in the game while the page is open (the storage
   event fires in every other same-origin tab). Palette values live in website/themes.css (through satellite.css);
   this file only sets data-theme. The THEME PALETTE CONTRACT (dev/run-tests.js) keeps the literal equal to
   THEME_KEY and pins which pages load it. website/system-theme.js is the OTHER policy — follow the device — for
   pages that are not the game's own. */
(function(){
  var KEY="tnd_theme_v1";
  function read(){var t="dark";try{if(localStorage.getItem(KEY)==="light")t="light";}catch(e){}return t;}
  function apply(){document.documentElement.setAttribute("data-theme",read());}
  apply();
  if(window.addEventListener)window.addEventListener("storage",function(e){if(!e||e.key===null||e.key===KEY)apply();});/* a clear() reports key null */
})();
