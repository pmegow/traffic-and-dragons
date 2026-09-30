// Library slug contract (#481 F5). Also vendored unchanged as library-slug.cjs on the server — update both together (the
// SHA-256 of this file is pinned in dev/tests-481-f5-library-slug.js and in the server's test-library-slug.mjs).
// ONE slug for a library entry, shared by the game and the server: lowercase; every run outside a-z0-9 becomes one "_";
// BOTH edge underscores are trimmed (the server trimmed one, so "(Ammut)" was ammut_ there and ammut here, and Replace /
// Update from library never found it). A blueprint id keeps the designer's rule: trimmed, then cut at 120 characters.
var LibrarySlug=(function(){
  function library(name){return String(name==null?"":name).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");}
  function blueprint(name){return library(name).slice(0,120);}
  return {library:library,blueprint:blueprint};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LibrarySlug;
