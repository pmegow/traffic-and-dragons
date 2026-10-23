/* The saved game choice wins on every active page. Only pages with an explicit
   data-theme-default opt into another fallback when no player preference exists.
   Lives beside themes.css so both static deployments publish the same controller. */
(function(){
  var KEY="tnd_theme_v1";
  var root=document.documentElement, fallback=root.getAttribute("data-theme-default");
  var device=window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)"):null;
  function read(){
    var t="dark";
    if(fallback==="light"||(fallback==="system"&&device&&!device.matches))t="light";
    try{if(localStorage.getItem(KEY)==="light")t="light";else if(localStorage.getItem(KEY)==="dark")t="dark";}
    catch(e){console.warn("Theme preference unavailable: "+e.message);}
    return t;
  }
  function apply(){
    document.documentElement.setAttribute("data-theme",read());
    if(document.dispatchEvent)document.dispatchEvent(new Event("tnd:theme"));
  }
  apply();
  if(window.addEventListener)window.addEventListener("storage",function(e){if(!e||e.key===null||e.key===KEY)apply();});
  if(device){if(device.addEventListener)device.addEventListener("change",apply);else device.addListener(apply);}
})();
