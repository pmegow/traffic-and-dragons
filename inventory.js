/* inventory.js — THE INVENTORY MODULE (#599 release (b), v1.1196; DOC/DESIGN_599_inventory_rows.md §2, §5.2, §12).
   One job: carried items, in both the shapes the game knows. Loads after helpers.js (keyedDict, itemBaseName) and before
   state.js, in every host that loads state.js — the game, the character editor, map cleanup, the browsers and the home page.

   • THE LEGACY FORM (what every sheet stores through release (b)): an array of strings, a count as a trailing " xN". The
     functions under "THE LEGACY FORM" are the game's inventory API exactly as it stood in api.js up to v1.1195, moved
     verbatim: every writer rewrites only the entry it touches, so an untouched spelling survives every turn (review 41 R1).
   • THE ROW FORM (what release (c) will store): {name, qty, equipped, …unknown fields carried}. invRows prepares rows from
     any input losslessly or refuses whole; the row functions are built and tested here and INSTALLED BY (c), never by (b).

   ONE KEY. itemKey(name) is the pack rule — case, spaces, dash variants, a trailing plural "s" — on a COUNT-FREE name. A
   legacy string decodes its count first (invStoredParse, _invNorm); an object row's name is literal (I3: a row named
   "Torch x2" is an item called "Torch x2"). Where a provenance-free match is wanted (wants, the pair key, bible lookups)
   itemBaseKey projects the clause away — "(from …)" and " — …" — never a count. The TAG grammar (_qtyParse, QTY_MAX=999)
   reads what the GM writes and keeps its own bound; INV_QTY_MAX bounds stored rows (§5.2 ②). */
var INV_QTY_MAX=9999;
function itemKey(name){return String(name==null?"":name).toLowerCase().replace(/[—–−‑]/g,"-").replace(/\s*-\s*/g,"-").replace(/\s+/g," ").trim().replace(/s$/,"");}
/* the provenance-free projection of a COUNT-FREE name: the first spaced dash begins a clause, a parenthesis is one too */
function itemProvenanceFree(name){var s=String(name==null?"":name),cut=s.search(/\s+[—–-]\s+/);if(cut>=0)s=s.slice(0,cut);s=s.replace(/\s*\(.*\)/,"");return s.replace(/\s+/g," ").trim();}
function itemBaseKey(name){return itemKey(itemProvenanceFree(name));}
/* the STORED grammar (§5.2 ②): a trailing " xN", N ≥ 1 with no leading zero, is a count; anything else is a literal name with
   one unit. It never clamps — a stored count above INV_QTY_MAX is the caller's refusal, never a silent cut. */
function invStoredParse(s){var str=String(s==null?"":s),m=str.match(/^(.*\S)\s+x([1-9]\d*)$/i);return m?{name:m[1],qty:parseInt(m[2],10)}:{name:str.trim(),qty:1};}

/* ═══ THE ROW FORM ═══
   I1 qty is an integer in 1…INV_QTY_MAX; a write or a fold that would pass it refuses, never clamps.
   I2 no two rows share an item key — STRICT (review 41 R3: key-only catalogs, marks and ledgers cannot tell two apart).
   I3 name is literal; only a legacy STRING parses a stored count.
   I4 equipped is a boolean on the whole row.
   I5 unknown own fields ride every preparation, removal fragment and copy verbatim; a same-key fold happens only when the
      two rows' extra fields deep-equal, else the whole preparation refuses with the source intact.
   §5.2 ① plain JSON only: a value JSON cannot carry losslessly (a function, a symbol, undefined, NaN, ±Infinity, negative
   zero, an accessor, a cycle, a Date or any other object type) refuses before any clone. Nothing here touches its inputs. */
function invJsonIssue(v,seen){
  seen=seen||[];var t=typeof v,k,r,d;
  if(v===null||t==="string"||t==="boolean")return "";
  if(t==="number"){if(v!==v||v===Infinity||v===-Infinity)return "a non-finite number";if(v===0&&1/v<0)return "negative zero";return "";}
  if(t==="undefined")return "an undefined value";if(t==="function")return "a function";if(t==="symbol")return "a symbol";
  if(t!=="object")return "an unsupported value";
  if(seen.indexOf(v)>=0)return "a cycle";seen.push(v);
  var proto=Object.getPrototypeOf(v);if(proto!==null&&proto!==Object.prototype&&proto!==Array.prototype)return "an unsupported object type";
  if(Array.isArray(v)){for(k=0;k<v.length;k++){r=invJsonIssue(v[k],seen);if(r)return r;}}
  else for(k in v){if(!Object.prototype.hasOwnProperty.call(v,k))continue;d=Object.getOwnPropertyDescriptor(v,k);if(d&&(d.get||d.set))return "an accessor";r=invJsonIssue(v[k],seen);if(r)return r;}
  seen.pop();return "";
}
function invDeepEqual(a,b){
  if(a===b)return true;if(typeof a!==typeof b||!a||!b||typeof a!=="object")return false;
  if(Array.isArray(a)!==Array.isArray(b))return false;var i;
  if(Array.isArray(a)){if(a.length!==b.length)return false;for(i=0;i<a.length;i++)if(!invDeepEqual(a[i],b[i]))return false;return true;}
  var ka=Object.keys(a).sort(),kb=Object.keys(b).sort();if(ka.length!==kb.length)return false;
  for(i=0;i<ka.length;i++){if(ka[i]!==kb[i]||!invDeepEqual(a[ka[i]],b[kb[i]]))return false;}return true;
}
function invExtras(row){var o={},k;for(k in row)if(Object.prototype.hasOwnProperty.call(row,k)&&k!=="name"&&k!=="qty"&&k!=="equipped")o[k]=row[k];return o;}
/* one entry → {ok,row,diag} (a detached row), {ok:false,diag} (junk: not an item), or {refuse} (the whole preparation stops) */
function invRowOf(entry){
  if(typeof entry==="string"){var p=invStoredParse(entry);if(!p.name)return {ok:false,diag:{reason:"an empty name",original:entry}};if(p.qty>INV_QTY_MAX)return {refuse:"a stored count above "+INV_QTY_MAX+" ('"+entry+"')"};return {ok:true,row:{name:p.name,qty:p.qty,equipped:false},diag:null};}
  if(!entry||typeof entry!=="object"||Array.isArray(entry)||typeof entry.name!=="string"||!entry.name.trim())return {ok:false,diag:{reason:"not an item",original:entry}};
  var ji=invJsonIssue(entry);if(ji)return {refuse:ji+" on '"+entry.name+"'"};
  var row=JSON.parse(JSON.stringify(entry)),diag=null,q=row.qty;
  if(typeof q==="number"&&q===Math.floor(q)&&q>=1){if(q>INV_QTY_MAX)return {refuse:"a count above "+INV_QTY_MAX+" on '"+row.name+"'"};}
  else{diag={reason:"an invalid count repaired to 1",original:JSON.parse(JSON.stringify(entry))};row.qty=1;}
  if(row.equipped!==true){if(row.equipped!==undefined&&row.equipped!==false)diag=diag||{reason:"a non-boolean equipped flag read as false",original:JSON.parse(JSON.stringify(entry))};row.equipped=false;}
  return {ok:true,row:row,diag:diag};
}
/* invRows(list, worn) → {ok, rows, diagnostics, reason}. Pure preparation: success is idempotent (rows in → the same rows
   out, no new diagnostics); refusal preserves the complete source and returns no rows. Junk (a number, null, a nameless
   object, an empty name, a worn name nobody carries) becomes a diagnostic with its complete original; the owner of the
   sheet (invHealSheet, release (c)) files those. A missing inventory is an empty list without evidence; a container that
   is not a list is kept whole as evidence and reads as empty (§5.2 ⑤). */
function invRows(list,worn){
  var rows=[],diags=[],idx=keyedDict(),i,r,k,have;
  if(list===undefined||list===null)list=[];
  if(!Array.isArray(list)){diags.push({reason:"the inventory is not a list",original:list});list=[];}
  for(i=0;i<list.length;i++){
    r=invRowOf(list[i]);
    if(r.refuse)return {ok:false,rows:null,diagnostics:[],reason:r.refuse};
    if(!r.ok){diags.push(r.diag);continue;}
    if(r.diag)diags.push(r.diag);
    k=itemKey(r.row.name);
    if(idx[k]!==undefined){have=rows[idx[k]];
      if(!invDeepEqual(invExtras(have),invExtras(r.row)))return {ok:false,rows:null,diagnostics:[],reason:"two rows share the key '"+k+"' with different fields ('"+have.name+"', '"+r.row.name+"')"};
      if(have.qty+r.row.qty>INV_QTY_MAX)return {ok:false,rows:null,diagnostics:[],reason:"folding '"+have.name+"' and '"+r.row.name+"' passes "+INV_QTY_MAX};
      have.qty+=r.row.qty;have.equipped=have.equipped||r.row.equipped;continue;}
    idx[k]=rows.length;rows.push(r.row);
  }
  var w=Array.isArray(worn)?worn:[];
  for(i=0;i<w.length;i++){if(typeof w[i]!=="string"||!w[i].trim())continue;k=itemKey(invStoredParse(w[i]).name);
    if(idx[k]!==undefined)rows[idx[k]].equipped=true;else diags.push({reason:"a worn item that is not carried",original:w[i]});}
  return {ok:true,rows:rows,diagnostics:diags,reason:""};
}
/* invFind: the exact key first, then a UNIQUE provenance-free base (the resolver rule of #481 A2); two candidates are
   ambiguous — nothing is chosen, and invFind.last says why. Returns the index or -1. */
function invFind(rows,name){
  var t=itemKey(name),i,hits=[],b;invFind.last=null;
  for(i=0;i<(rows||[]).length;i++)if(itemKey(rows[i].name)===t)return i;
  b=itemBaseKey(name);if(b)for(i=0;i<(rows||[]).length;i++)if(itemBaseKey(rows[i].name)===b)hits.push(i);
  if(hits.length===1)return hits[0];
  invFind.last=hits.length>1?{why:"ambiguous",names:hits.map(function(h){return rows[h].name;})}:{why:"absent"};return -1;
}
function invCount(rows,name){var i=invFind(rows,name);return i<0?0:rows[i].qty;}
function invUnits(n){return (typeof n==="number"&&n===Math.floor(n)&&n>=1)?n:1;}
function invAdd(rows,name,n){
  n=invUnits(n);var nm=String(name==null?"":name).trim(),t,i,row;if(!nm)return {ok:false,reason:"no name"};t=itemKey(nm);
  for(i=0;i<rows.length;i++)if(itemKey(rows[i].name)===t){if(rows[i].qty+n>INV_QTY_MAX)return {ok:false,reason:"'"+rows[i].name+"' would pass "+INV_QTY_MAX};rows[i].qty+=n;return {ok:true,row:rows[i]};}
  if(n>INV_QTY_MAX)return {ok:false,reason:"a count above "+INV_QTY_MAX};row={name:nm,qty:n,equipped:false};rows.push(row);return {ok:true,row:row};
}
/* invRemove returns the removed FRAGMENT — the row's unknown fields with the units taken (I5 through a transfer) */
function invRemove(rows,name,n){
  n=invUnits(n);var i=invFind(rows,name),row,take,frag;
  if(i<0)return {ok:false,reason:(invFind.last&&invFind.last.why==="ambiguous")?"ambiguous: "+invFind.last.names.join(", "):"not carried",miss:invFind.last};
  row=rows[i];take=Math.min(n,row.qty);frag=JSON.parse(JSON.stringify(row));frag.qty=take;row.qty-=take;if(row.qty<=0)rows.splice(i,1);
  return {ok:true,removed:frag,units:take,remainder:row.qty<=0?0:row.qty,name:row.name};
}
function invRename(rows,from,to){
  var i=invFind(rows,from),nm=String(to==null?"":to).trim(),t,j;if(i<0)return {ok:false,reason:"no '"+from+"'"};if(!nm)return {ok:false,reason:"no new name"};t=itemKey(nm);
  for(j=0;j<rows.length;j++)if(j!==i&&itemKey(rows[j].name)===t)return {ok:false,reason:"'"+nm+"' already on the sheet"};
  rows[i].name=nm;return {ok:true,row:rows[i]};
}
function invEquip(rows,name,on){
  var i=invFind(rows,name);if(i<0)return {ok:false,reason:"not carried"};
  if(on&&rows[i].equipped)return {ok:false,reason:"already equipped",row:rows[i]};if(!on&&!rows[i].equipped)return {ok:false,reason:"not equipped",row:rows[i]};
  rows[i].equipped=!!on;return {ok:true,row:rows[i]};
}
/* invText is a DISPLAY projection: two distinct rows can print alike; it is never the row's serialization or identity */
function invText(row){return String(row&&row.name)+(row&&row.qty>1?" x"+row.qty:"");}
function invTextList(rows){var out=[],i;for(i=0;i<(rows||[]).length;i++)out.push(invText(rows[i]));return out;}
/* a detached copy for preflights and snapshots (§5.2 ⑦) — validated first, so nothing is lost in the clone */
function invDetach(rows){var ji=invJsonIssue(rows);if(ji)return {ok:false,reason:ji,rows:null};return {ok:true,rows:JSON.parse(JSON.stringify(rows)),reason:""};}


/* ═══ THE LEGACY FORM — the inventory API as it stood in api.js up to v1.1195, moved verbatim (#599 b). Every writer
   rewrites ONLY the entry it touches, so an untouched spelling ("Torch x1") survives every turn; the count is a trailing
   " xN" suffix and _invNorm/_invCount/_invBase read and write it. Nothing below changed in the move. ═══ */
// Inventory stacks via a trailing " xN" suffix: gaining a duplicate increments the count instead of
// pushing a second entry; losing decrements (and drops the suffix at 1). Genuine repeat pickups (5x
// poison arrow) collapse to one "Poison arrow x5" line.
// Stack-matching tolerates case, extra whitespace, and a trailing plural "s" (so "Travel ration",
// "travel rations", and "Saddle"/"Saddles" stack) — but NOT parenthetical qualifiers: "Sword (rusty)"
// and "Sword (enchanted)" are distinct and must stay separate. A trailing " xN" count is stripped first.
// #75(b) v1.385: DASH VARIANTS normalise too. The GM writes the same item with an em-dash one
// turn and a hyphen the next ("Iron ring — unmarked" / "Iron ring - unmarked"), and because the
// two strings differed here they were two separate stacks of the same three rings — on the t881
// save, exactly 2 such pairs across the party (Iron ring, Iron key; verified by enumerating every
// NEW collision the change causes, since a wrong merge silently destroys a real item — the
// superficially-similar "Dark tooth cap 'Third'/'Seventh'" pair correctly does NOT fold).
// Every dash character folds to "-" and the
// spacing around it collapses, so all of "A — B", "A - B", "A—B" agree. Spaced words are NOT
// folded into hyphenated ones ("well worn" stays distinct from "well-worn") — deliberately
// conservative, since a wrong merge silently destroys a real item.
// Non-strings coerce to "" (not just null/undefined): load-time migration deliberately preserves
// non-string inventory entries, and a primitive that throws on one kills whatever loop touched it —
// inventorySnapshot sits BEFORE applyMuts in the turn path, so that throw cost the entire turn.
function _invStr(s){return typeof s==="string"?s:"";}
function _invNorm(s){return _invStr(s).replace(/\s*x\d+\s*$/i,"").toLowerCase().replace(/[—–−‑]/g,"-").replace(/\s*-\s*/g,"-").replace(/\s+/g," ").trim().replace(/s$/,"");}
function _invCount(s){var m=_invStr(s).match(/\sx(\d+)\s*$/i);return m?parseInt(m[1],10):1;}
function _invBase(s){return _invStr(s).replace(/\s*x\d+\s*$/i,"").trim();}
function _wornIdx(list,item){var t=_invNorm(item),i;for(i=0;i<(list||[]).length;i++)if(_invNorm(list[i])===t)return i;return -1;}
function wornSet(cs,item,on,who){if(!cs)return {ok:false,reason:"no sheet"};if(!cs.worn)cs.worn=[];var inv=cs.inventory||[],ii=_wornIdx(inv,item),wi=_wornIdx(cs.worn,item);
  if(!on){if(wi<0)return {ok:false,reason:"not worn"};var _rm=cs.worn.splice(wi,1)[0];return {ok:true,item:_invBase(_rm)};}
  if(ii<0){if(typeof console!=="undefined")console.warn("[attire] WORN: '"+item+"' is not in "+(who||cs.name||"?")+"'s inventory — nothing is worn that is not carried; emit [ITEM_GAINED:] first (#388)");return {ok:false,reason:"not carried"};}
  var stored=_invBase(inv[ii]);if(wi>=0)return {ok:false,reason:"already worn",item:stored};cs.worn.push(stored);return {ok:true,item:stored};}
function wornPrune(cs){if(!cs||!cs.worn||!cs.worn.length)return 0;var inv=cs.inventory||[],keep=[],i,dropped=0;for(i=0;i<cs.worn.length;i++){if(_wornIdx(inv,cs.worn[i])>=0)keep.push(cs.worn[i]);else dropped++;}cs.worn=keep;return dropped;}
function wornRename(cs,oldName,newName){if(!cs||!cs.worn)return false;var wi=_wornIdx(cs.worn,oldName);if(wi<0)return false;cs.worn[wi]=_invBase(newName);return true;}
function isWorn(cs,item){return !!(cs&&cs.worn&&_wornIdx(cs.worn,item)>=0);}
// P14: a quantity baked into an item TAG ("Rope x3") means N of the base item, not one item
// literally named "Rope x3" — without this, gaining "Rope x3" onto an existing "Rope" stack
// stepped the count to x2 instead of x4, and losing "Rope x2" removed only one. The x must be
// a separate token (whitespace before, single digit 2-9 after) so names that merely end in x
// ("Potion of Hex") are never mangled.
/* #481 D3 (audit 2026-09-29, Fable-approved): ONE quantity grammar — " xN" for any N from 1 (the stack reader always
   accepted any xN; the tag parser read only x2..x9, so "+Arrows x12" onto 13 gave 14 and "-Arrow x10" removed one). "x1" is
   one unit, never part of a name; x0 and leading zeros stay part of the name (unchanged). A runaway count is CLAMPED at
   QTY_MAX with clamped:true, and every caller names the bound in its receipt. */
var QTY_MAX=999;
function _qtyParse(name){var m=(name||"").trim().match(/^(.*\S)\s+x([1-9]\d*)$/i);if(!m)return {base:(name||"").trim(),n:1};var n=parseInt(m[2],10);return n>QTY_MAX?{base:m[1],n:QTY_MAX,clamped:true}:{base:m[1],n:n};}
function addInventoryItem(inv,name){var t=_invNorm(name),i;
  for(i=0;i<inv.length;i++){if(_invNorm(inv[i])===t){inv[i]=_invBase(inv[i])+" x"+(_invCount(inv[i])+1);return;}}
  inv.push(name);
}
function inventoryCountOf(inv,name){
  var t=_invNorm(name),n=0,i;
  for(i=0;i<(inv||[]).length;i++)if(_invNorm(inv[i])===t)n+=_invCount(inv[i]);
  return n;
}
// #176: relabel a carried item IN PLACE — the engine path a fiction-side rename never had.
// Stack count and list position survive; unknown item and name-collision both refuse LOUDLY
// (muts + console). A collision is refused because two entries silently becoming one is
// [ITEM_LOST:]'s job — a relabel must never destroy a stack.
function renameInventoryItem(inv,oldName,newName,R,who){
  var key=_invNorm(oldName),nk=_invNorm(newName),i,hit=-1,label=who?who+": ":"";
  for(i=0;i<(inv||[]).length;i++){if(_invNorm(inv[i])===key){hit=i;break;}}
  if(hit<0){for(i=0;i<(inv||[]).length;i++){if(itemBaseName(inv[i])===itemBaseName(oldName)){hit=i;break;}}}
  if(hit<0){
    var m1="RENAME refused: no '"+oldName+"' on the "+(who||"player")+" sheet";
    if(typeof console!=="undefined")console.warn("[items] "+m1);if(R&&R.muts)R.muts.push("⚠ "+label+m1);return false;
  }
  for(i=0;i<inv.length;i++){if(i!==hit&&_invNorm(inv[i])===nk){
    var m2="RENAME refused: '"+newName+"' already on the sheet — if the two are one item, emit [ITEM_LOST:"+oldName+"] instead";
    if(typeof console!=="undefined")console.warn("[items] "+m2);if(R&&R.muts)R.muts.push("⚠ "+label+m2);return false;
  }}
  var c=_invCount(inv[hit]);inv[hit]=newName+(c>1?" x"+c:"");
  if(R&&R.muts)R.muts.push(label+oldName+" → "+newName);
  return true;
}
/* #481 A2 (a) (audit 2026-09-29, Fable-approved): ONE inventory name resolver. Exact (_invNorm) first; then a UNIQUE base
   name (itemBaseName strips the provenance clause, the rename rule), because the tag doc teaches "Signet ring (from Sheriff
   Hemlock)" and the GM later writes "Signet ring". Two candidates for one base name are AMBIGUOUS: nothing is removed and
   the reason rides _invLastMiss for the loud line. Returns the index, or -1. */
var _invLastMiss=null;
function resolveInventoryName(inv,name){
  var t=_invNorm(name),i,hits=[];_invLastMiss=null;
  for(i=0;i<(inv||[]).length;i++){if(_invNorm(inv[i])===t)return i;}
  var b=_invNorm(itemBaseName(name));
  if(b)for(i=0;i<(inv||[]).length;i++){if(_invNorm(itemBaseName(inv[i]))===b)hits.push(i);}
  if(hits.length===1)return hits[0];
  _invLastMiss=hits.length>1?{why:"ambiguous",names:hits.map(function(k){return _invBase(inv[k]);})}:{why:"absent"};
  return -1;
}
function removeInventoryItem(inv,name){var i=resolveInventoryName(inv,name);removeInventoryItem.last=null;if(i<0)return false;
  removeInventoryItem.last=_invBase(inv[i]);/* #481 A2: the exact sheet name removed, so a refused partner can put it back */
  var n=_invCount(inv[i])-1;if(n<=0)inv.splice(i,1);else if(n===1)inv[i]=_invBase(inv[i]);else inv[i]=_invBase(inv[i])+" x"+n;return true;
}
/* #481 A2 (b): the halves of one move share a PAIR KEY (base name, provenance-free), and each handler notes what it moved or
   missed on R, so the partner handler can withhold itself or put the unit back. The shapes: stow (ITEM_LOST +
   LOCATION_ITEM placed), give (ITEM_LOST + COMPANION_ITEM_GAINED), take (COMPANION_ITEM_LOST + ITEM_GAINED), and sale
   (GOLD + ITEM_LOST). */
function itemPairKey(name){return _invNorm(itemBaseName(_qtyParse(String(name==null?"":name)).base));}
/* #481 D2 (audit 2026-09-29, Fable-approved): the STASH identity — the quantity grammar plus the pack's own name normaliser
   (plural s, dash spacing, case), so the chest and the pack agree on what an item is. Unlike the pair key it keeps the
   provenance: "Rope (spare)" and "Rope" are two different chest rows. Every stash consumer keys through it. */
function stashKey(name){return _invNorm(_qtyParse(String(name==null?"":name)).base);}
function itemPairNote(R,field,name,val){if(!R[field])R[field]=keyedDict();var k=itemPairKey(name);(R[field][k]=R[field][k]||[]).push(val);}
function itemPairTake(R,field,name){var m=R&&R[field],k=itemPairKey(name);return (m&&m[k]&&m[k].length)?m[k].pop():null;}
function itemPairMissed(R,name){return !!(R&&R.ilMiss&&R.ilMiss[itemPairKey(name)]);}
// ── #50(d): model-inventory sanitation + duplicate healing (v1.291) ────────────
// Byte-identical duplicate inventory entries can only be MINTED where a model-emitted array is
// copied verbatim — sheet generation (normalizeCompanionSheet) and regeneration (generateNpcSheet).
// Every play-time write stacks via addInventoryItem, which provably cannot produce two identical
// siblings (the Frizwick t455 three-adjacent-pairs anomaly). Two teeth:
//   sanitizeModelInventory — guards the FAUCETS: strings only, duplicates stack on arrival
//   (quantity-aware: two "Rope x3" fold to x6), cap counts unique entries.
//   foldDuplicateInventory — heals the STOCK: migrateWorldState folds exact-duplicate entries
//   already sitting in saves into proper " xN" stacks.
function sanitizeModelInventory(list,cap){
  var out=[],i,j,max=cap||1e9;
  if(!list||!list.length)return out;
  for(i=0;i<list.length&&out.length<max;i++){
    if(typeof list[i]!=="string"||!list[i])continue;
    var q=_qtyParse(list[i]),t=_invNorm(q.base),hit=false;
    for(j=0;j<out.length;j++){if(_invNorm(out[j])===t){out[j]=_invBase(out[j])+" x"+(_invCount(out[j])+q.n);hit=true;break;}}
    if(!hit)out.push(list[i]);
  }
  return out;
}
// Folds BYTE-IDENTICAL entries only — healing must never guess at intent, so "Dagger"+"Dagger"
// becomes "Dagger x2" but "Dagger"+"dagger" is left alone (play-time writes already stack the
// loose-match class; anything loose-distinct in a save could be deliberate). In place, order
// preserved (first occurrence keeps its slot); returns the number of entries folded away.
function foldDuplicateInventory(inv){
  if(!inv||inv.length<2)return 0;
  var seen=keyedDict(),out=[],folded=0,i,k,kk;
  for(i=0;i<inv.length;i++){
    // #75(b) v1.385: key on _invNorm, not the raw string. Byte-identical matching could never
    // heal the dash-variant splits this pass exists to clean up ("Iron ring — unmarked" vs
    // "Iron ring - unmarked"), and raw matching was already INCONSISTENT with the write path —
    // addInventoryItem/removeInventoryItem have always stacked by _invNorm, so the migration was
    // using a stricter notion of "same item" than the code that creates the stacks.
    // Verified on the t881 save: norm keying merges exactly 2 groups across the whole party, both
    // genuine dash twins; the look-alike "Dark tooth cap 'Third'/'Seventh'" pair is untouched.
    k=inv[i];kk="k:"+(typeof k==="string"?_invNorm(k):k); // prefixed key — an item literally named "__proto__" must not walk the prototype
    if(typeof k==="string"&&seen[kk]!=null){var fi=seen[kk];out[fi]=_invBase(out[fi])+" x"+(_invCount(out[fi])+_invCount(k));folded++;}
    else{if(typeof k==="string")seen[kk]=out.length;out.push(k);}
  }
  if(folded){inv.length=0;for(i=0;i<out.length;i++)inv.push(out[i]);}
  return folded;
}
