/* Opt-in browser/device theme following; palette values live in themes.css. */
(function () {
  var preference = window.matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    document.documentElement.setAttribute("data-theme", preference.matches ? "dark" : "light");
  }
  apply();
  if (preference.addEventListener) preference.addEventListener("change", apply);
  else preference.addListener(apply);
})();
