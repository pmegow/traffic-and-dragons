/* inventory.js — THE INVENTORY MODULE (#599 release (b) v1.1196, release (c) v1.1202; DOC/DESIGN_599_inventory_rows.md §2,
   §5.2, §12). One job: carried items, in both the shapes the game knows. Loads after helpers.js (keyedDict, itemBaseName) and
   before state.js, in every host that loads state.js — the game, the character editor, map cleanup, the browsers, the home page.

   • THE ROW FORM (what every sheet stores from release (c), save v11): {name, qty, equipped, …unknown fields carried}.
     invRows prepares rows from any input losslessly or refuses whole; invHealSheet installs them on a sheet (worn folds into
     equipped, junk is filed as evidence, the sheet is stamped) — the admission registry runs it at every door, the load
     included (state.js inventoryAdmitWorld). The row functions (invFind/Add/Remove/Rename/Equip/Count) are the ONE
     implementation of every write.
   • THE LEGACY FORM (what sheets stored through release (b)): an array of strings, a count as a trailing " xN". It is still
     READ everywhere (invEntries decodes it, invTextList prints it verbatim) — a save from before (c), a test fixture, a stale
     device's write-back. The functions under "THE LEGACY DELEGATES" keep the api.js names every caller and test knows, but
     each is a thin delegate: it PREPARES the list through invRows (strings → rows, in place, or a loud refusal that leaves
     the list as it was — §2.4 "writers prepare before mutation") and then calls the row function. Never a second
     implementation. The names retire in a later explicit cleanup commit once callers, tests and anchors have moved.

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
function invStoredParse(s){var str=String(s==null?"":s).trim(),m=str.match(/^(.*\S)\s+x([1-9]\d*)$/i);return m?{name:m[1],qty:parseInt(m[2],10)}:{name:str,qty:1};}/* trimmed first: "Torch x3 " is three torches, as the old reader and the tag grammar read it (review (b) 6) */

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
function invExtras(row){var o=keyedDict(),k;for(k in row)if(Object.prototype.hasOwnProperty.call(row,k)&&k!=="name"&&k!=="qty"&&k!=="equipped")o[k]=row[k];return o;}/* a null-prototype bag: an own "__proto__" field is a field, never the prototype (review (b) 12) */
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
  if(worn!==undefined&&worn!==null&&!Array.isArray(worn))diags.push({reason:"a worn list that is not a list",original:worn});/* #599 (c2), review 8: a malformed worn is EVIDENCE, never deleted in silence (§5.2 ⑤) */
  for(i=0;i<w.length;i++){if(typeof w[i]!=="string"||!w[i].trim()){if(w[i]!==undefined&&w[i]!==null)diags.push({reason:"a worn entry that is not a name",original:w[i]});continue;}k=itemKey(invStoredParse(w[i]).name);
    if(idx[k]!==undefined)rows[idx[k]].equipped=true;else diags.push({reason:"a worn item that is not carried",original:w[i]});}
  return {ok:true,rows:rows,diagnostics:diags,reason:""};
}
/* invFind: the exact key first, then a UNIQUE provenance-free base (the resolver rule of #481 A2); two candidates are
   ambiguous — nothing is chosen, and invFind.last says why. Returns the index or -1. */
/* a list may carry junk beside its rows (a bare list cannot file evidence — invPrepare keeps it verbatim); every row walk skips it */
function _invIsRow(e){return !!(e&&typeof e==="object"&&typeof e.name==="string");}
function invFind(rows,name){
  var t=itemKey(name),i,hits=[],b;invFind.last=null;
  for(i=0;i<(rows||[]).length;i++)if(_invIsRow(rows[i])&&itemKey(rows[i].name)===t)return i;
  b=itemBaseKey(name);if(b)for(i=0;i<(rows||[]).length;i++)if(_invIsRow(rows[i])&&itemBaseKey(rows[i].name)===b)hits.push(i);
  if(hits.length===1)return hits[0];
  invFind.last=hits.length>1?{why:"ambiguous",names:hits.map(function(h){return rows[h].name;})}:{why:"absent"};return -1;
}
function invCount(rows,name){var i=invFind(rows,name);return i<0?0:rows[i].qty;}
function invUnits(n){return (typeof n==="number"&&n===Math.floor(n)&&n>=1)?n:1;}
/* invAdd(rows, name, n, extras): stacks by key, else appends a row. `extras` (#599 (c2), review 4 — I5) is a fragment's unknown
   fields riding a TRANSFER: a new row carries them; a stack with the same fields takes the units; a stack with DIFFERENT
   fields refuses with fields:true (the caller restores the move). A plain add (no extras) merges as it always did. */
function invAdd(rows,name,n,extras){
  n=invUnits(n);var nm=String(name==null?"":name).trim(),t,i,row,k,ex=(extras&&typeof extras==="object")?keyedDict(extras):null,exn=ex?Object.keys(ex).length:0;if(!nm)return {ok:false,reason:"no name"};t=itemKey(nm);
  for(i=0;i<rows.length;i++)if(_invIsRow(rows[i])&&itemKey(rows[i].name)===t){if(exn&&!invDeepEqual(invExtras(rows[i]),ex))return {ok:false,reason:"'"+rows[i].name+"' carries different fields",fields:true};if(rows[i].qty+n>INV_QTY_MAX)return {ok:false,reason:"'"+rows[i].name+"' would pass "+INV_QTY_MAX};rows[i].qty+=n;return {ok:true,row:rows[i]};}
  if(n>INV_QTY_MAX)return {ok:false,reason:"a count above "+INV_QTY_MAX};row={name:nm,qty:n,equipped:false};if(exn)for(k in ex)row[k]=JSON.parse(JSON.stringify(ex[k]));rows.push(row);return {ok:true,row:row};
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
  for(j=0;j<rows.length;j++)if(j!==i&&_invIsRow(rows[j])&&itemKey(rows[j].name)===t)return {ok:false,reason:"'"+nm+"' already on the sheet"};
  rows[i].name=nm;return {ok:true,row:rows[i]};
}
function invEquip(rows,name,on){
  var i=invFind(rows,name);if(i<0)return {ok:false,reason:"not carried"};
  if(on&&rows[i].equipped)return {ok:false,reason:"already equipped",row:rows[i]};if(!on&&!rows[i].equipped)return {ok:false,reason:"not equipped",row:rows[i]};
  rows[i].equipped=!!on;return {ok:true,row:rows[i]};
}
/* invText is a DISPLAY projection: two distinct rows can print alike; it is never the row's serialization or identity */
function invText(row){return String(row&&row.name)+(row&&row.qty>1?" x"+row.qty:"");}
/* invTextList(inv): every entry's text, for the prompt and every display that showed the old strings — a legacy STRING
   VERBATIM (the prompt stays byte-identical through (b)), a row through invText. The ONE join source outside this file. */
function invTextList(inv){var out=[],i;for(i=0;i<(inv||[]).length;i++){var e=inv[i];out.push(typeof e==="string"?e:(e==null?"":(typeof e==="object"&&typeof e.name==="string"?invText(e):String(e))));}return out;}/* junk prints as the old join printed it — null/undefined as "", a number as its digits — never "undefined" (review (b) 11) */
/* #599 (c2) — I5 through a TRANSFER. A fragment is what invRemove returned: the row's unknown fields with the units taken.
   invHasFields(frag) says whether it carries any; invFragsHaveFields(list) asks it of a pair's noted fragments; invCarryFields
   (rows, name, frag, units) puts a fragment's fields onto the destination row a transfer created — a row with the same fields
   takes the units as they are, a plain row of exactly those units takes the fields, anything else refuses (the caller restores
   the move). invHoldsRow(inv) is the write boundary's question — does this pack hold a row at all (inventoryStampWorld). */
function invHasFields(frag){return !!(frag&&typeof frag==="object"&&Object.keys(invExtras(frag)).length);}
function invFragsHaveFields(list){var i;for(i=0;i<(list||[]).length;i++)if(invHasFields(list[i]))return true;return false;}
function invCarryFields(rows,name,frag,units){
  var i=_invLegacyFind(rows,name),ex=frag?invExtras(frag):keyedDict(),k;if(i<0)return {ok:false,reason:"'"+name+"' is not on the sheet"};
  var row=rows[i],have=invExtras(row);if(invDeepEqual(have,ex))return {ok:true,row:row};
  if(Object.keys(have).length)return {ok:false,reason:"'"+row.name+"' already carries different fields"};
  if(row.qty!==units)return {ok:false,reason:"'"+row.name+"' is a stack of "+row.qty+" without those fields"};
  for(k in ex)row[k]=JSON.parse(JSON.stringify(ex[k]));return {ok:true,row:row};
}
function invHoldsRow(inv){var i;for(i=0;i<(inv||[]).length;i++)if(_invIsRow(inv[i]))return true;return false;}
/* a detached copy for preflights and snapshots (§5.2 ⑦) — validated first, so nothing is lost in the clone */
function invDetach(rows){var ji=invJsonIssue(rows);if(ji)return {ok:false,reason:ji,rows:null};return {ok:true,rows:JSON.parse(JSON.stringify(rows)),reason:""};}
/* invSnapshot(inv): the detached copy every preflight and before/after diff reads — a `.slice()` of a row list SHARES the row
   objects, so a check that removes from the copy would decrement the live pack (gate 14). A pack that cannot be copied is
   said on the console and reads as empty; the caller's own check then refuses. */
function invSnapshot(inv){var d=invDetach(inv||[]);if(d.ok)return d.rows;if(typeof console!=="undefined")console.error("[inventory] the pack could not be copied for a check — "+d.reason);return [];}

/* ═══ THE SHEET HEAL (#599 c, §5.2 ⑤–⑥) — ONE function installs the row form on a sheet: the admission registry's inventory
   entry runs it at every door (the load included), and every sheet-level delegate below runs it before a write.
   • invSheetIssue(sheet) is the read-only GATE: "" when the pack can be prepared, else why (a count over the bound, two rows
     with one key and different fields, malformed evidence already on the sheet). A refusal touches nothing.
   • invHealSheet(sheet) installs: the rows (worn folded into equipped by key, the field deleted), every diagnostic filed on
     sheet.inventoryJunk with its complete original (deduplicated by reason + content, so a repeated heal adds no bytes),
     sheetVer stamped. One bounded console line per NEW batch of evidence; a heal of fixed input is silent and changes nothing. */
function invSheetIssue(sheet){
  if(!sheet||typeof sheet!=="object")return "no sheet";
  if(sheet.inventoryJunk!==undefined&&!Array.isArray(sheet.inventoryJunk))return (sheet.name||"the sheet")+"'s inventory evidence is malformed (not a list) — refused, nothing overwritten";
  var r=invRows(sheet.inventory,sheet.worn);return r.ok?"":(sheet.name||"the sheet")+"'s inventory cannot be prepared: "+r.reason;
}
function invJunkKey(d){return String(d&&d.reason)+"\u0000"+JSON.stringify(d&&d.original===undefined?null:d.original);}
function invHealSheet(sheet){
  var why=invSheetIssue(sheet);if(why)return {ok:false,reason:why,changed:false,filed:0};
  var r=invRows(sheet.inventory,sheet.worn),changed=false,i,have=keyedDict(),junk=Array.isArray(sheet.inventoryJunk)?sheet.inventoryJunk:[],add=[];
  for(i=0;i<junk.length;i++)if(junk[i]&&typeof junk[i]==="object")have[invJunkKey(junk[i])]=1;
  for(i=0;i<r.diagnostics.length;i++){var k=invJunkKey(r.diagnostics[i]);if(!have[k]){have[k]=1;add.push(r.diagnostics[i]);}}
  if(!invDeepEqual(sheet.inventory,r.rows)){sheet.inventory=r.rows;changed=true;}
  if(sheet.worn!==undefined){delete sheet.worn;changed=true;}
  if(add.length){sheet.inventoryJunk=junk.concat(add);changed=true;
    if(typeof console!=="undefined")console.warn("[inventory] "+(sheet.name||"the sheet")+": "+add.length+" unreadable inventory entr"+(add.length===1?"y":"ies")+" set aside as evidence (inventoryJunk) — "+add.slice(0,3).map(function(d){return d.reason+" ("+JSON.stringify(d.original).slice(0,40)+")";}).join("; ")+(add.length>3?"; …":""));}
  if(sheet.sheetVer!==SHEET_VER){sheet.sheetVer=SHEET_VER;changed=true;}/* the sheet says which shape it holds (§5.4) */
  return {ok:true,reason:"",changed:changed,filed:add.length};
}
/* invApplyLines(inv, lines): the Sync modal's free text back onto the pack (§4.3) — the ONE free-text writer. An unchanged
   line keeps its exact source row (fields, flag and all); an edited line that still names a carried item (same key) keeps
   that row and takes the new name and count; a new line is a new row; two source rows that print alike are AMBIGUOUS and the
   whole edit refuses with both names. Never rebuilds existing rows from their text alone. Returns {ok, rows, reason}. */
function invApplyLines(inv,lines){
  var d=invDetach(inv||[]);if(!d.ok)return {ok:false,rows:null,reason:"the pack cannot be copied ("+d.reason+")"};
  var p=invRows(d.rows);if(!p.ok)return {ok:false,rows:null,reason:p.reason};
  if(p.diagnostics.length)return {ok:false,rows:null,reason:p.diagnostics.length+" unreadable entr"+(p.diagnostics.length===1?"y":"ies")+" in the pack ("+p.diagnostics.map(function(d){return d.reason;}).slice(0,3).join("; ")+") — reload to heal the sheet before editing its items"};/* #599 (c2), review 6: junk never becomes a row through the text box */
  var src=p.rows,claimed=[],out=[],i,j,hits,nr,k,kh,row;lines=lines||[];
  for(i=0;i<lines.length;i++){hits=[];
    for(j=0;j<src.length;j++)if(!claimed[j]&&invText(src[j])===lines[i])hits.push(j);
    if(hits.length>1)return {ok:false,rows:null,reason:"'"+lines[i]+"' matches "+hits.length+" rows that print alike ("+hits.map(function(h){return src[h].name+" ×"+src[h].qty;}).join(", ")+") — edit those on the sheet"};
    if(hits.length===1){claimed[hits[0]]=1;out.push(src[hits[0]]);continue;}
    nr=invRowOf(lines[i]);if(nr.refuse)return {ok:false,rows:null,reason:nr.refuse};if(!nr.ok)continue;/* a blank line (the caller trims; belt and braces) */
    k=itemKey(nr.row.name);kh=-1;for(j=0;j<src.length;j++)if(!claimed[j]&&itemKey(src[j].name)===k){kh=j;break;}
    if(kh>=0){claimed[kh]=1;row=src[kh];row.name=nr.row.name;row.qty=nr.row.qty;out.push(row);}/* an edited count or spelling keeps the row — its flag and its fields */
    else out.push(nr.row);
  }
  var fin=invRows(out);if(!fin.ok)return {ok:false,rows:null,reason:fin.reason};
  return {ok:true,rows:fin.rows,reason:""};
}
/* invEquippedNames(cs): the names the sheet has ON, in pack order — rows carry the flag; a legacy sheet (not yet healed) still
   carries a worn list, read after the rows and never twice. The prompt's Wearing line and the portrait prompt read this. */
function invEquippedNames(cs){
  var out=[],seen=keyedDict(),i,es=invEntries((cs&&cs.inventory)||[]);
  for(i=0;i<es.length;i++)if(es[i].equipped){out.push(es[i].name);seen[itemKey(es[i].name)]=1;}
  var w=(cs&&Array.isArray(cs.worn))?cs.worn:[];for(i=0;i<w.length;i++){if(typeof w[i]!=="string"||!w[i])continue;var k=itemKey(invStoredParse(w[i]).name);if(!seen[k]){seen[k]=1;out.push(w[i]);}}
  return out;
}
/* a writer PREPARES before it mutates (§2.4): a list not yet in the row form is converted in place through invRows, or the
   write refuses LOUDLY and the list stays exactly as it was. A bare list cannot FILE evidence, so junk (a null, a number, a
   nameless object) is kept IN the list verbatim after the rows — nothing is lost, every reader already skips it loudly
   (invEntries), and the sheet's own heal files it at the next door. A REPAIR (an invalid count, a non-boolean flag) cannot
   keep its original here, so that refuses: heal the sheet first (invHealSheet). */
function invPrepare(inv){
  if(!Array.isArray(inv))return {ok:false,reason:"not a list"};
  var i,e,rows=true,keep=[];for(i=0;i<inv.length;i++){e=inv[i];if(!e||typeof e!=="object"||typeof e.name!=="string"||!e.name.trim()||typeof e.qty!=="number"||e.qty!==Math.floor(e.qty)||e.qty<1||e.qty>INV_QTY_MAX||typeof e.equipped!=="boolean"){rows=false;break;}}
  if(rows)return {ok:true};
  var r=invRows(inv);
  if(!r.ok){if(typeof console!=="undefined")console.error("[inventory] write refused — the pack cannot be prepared: "+r.reason);return {ok:false,reason:r.reason};}
  for(i=0;i<r.diagnostics.length;i++){if(/repaired|read as false/.test(r.diagnostics[i].reason)){if(typeof console!=="undefined")console.error("[inventory] write refused — an entry needs repair ("+r.diagnostics[i].reason+") and a bare list cannot keep the evidence; heal the sheet first (invHealSheet)");return {ok:false,reason:"an entry needs repair on an unhealed list"};}}
  for(i=0;i<inv.length;i++)if(!invRowOf(inv[i]).ok)keep.push(inv[i]);/* junk stays, verbatim — classified by the SAME rule the conversion used (#599 (c2), review 7: invEntryRow read a nameless object as a row, so it was neither converted nor kept) */
  inv.length=0;for(i=0;i<r.rows.length;i++)inv.push(r.rows[i]);for(i=0;i<keep.length;i++)inv.push(keep[i]);
  return {ok:true};
}


/* ═══ THE LEGACY DELEGATES (#599 c) — the api.js names every caller and test knows, each a thin delegate over the row
   functions above: PREPARE the list (invPrepare — strings become rows in place, or the write refuses loudly and nothing
   moves), then the one implementation. A legacy string operand decodes its count at this boundary (invStoredParse) — a
   row's name is literal, so the literal key is tried first (§2.2). The readers (_invNorm/_invCount/_invBase, isWorn,
   inventoryCountOf, resolveInventoryName) never mutate and read both shapes through invEntries. ═══ */
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
/* #599 (b3) ONE KEY, ONE GRAMMAR: the three legacy readers are delegates — the STORED grammar decodes the count (invStoredParse:
   " xN", N ≥ 1, no leading zero; anything else is a literal name with one unit — "Modelx3" and "Model x01" are names, the
   loose `x\d+` strip that read them as counts is gone; the 2026-10-09 census over 77 owner saves / 11,490 entries found 0
   grammar splits) and itemKey is the pack rule on the decoded name. The compatibility table is the "#599 (b3)" test section. */
function _invNorm(s){return itemKey(_invBase(s));}
function _invCount(s){return invStoredParse(_invStr(s)).qty;}
function _invBase(s){return invStoredParse(_invStr(s)).name;}
function _wornIdx(list,item){var t=_invNorm(item),i;for(i=0;i<(list||[]).length;i++)if(_invNorm(list[i])===t)return i;return -1;}/* the legacy worn LIST reader (isWorn on an unhealed sheet) */
/* the legacy boundary's find over ROWS: the literal key first (a row named "Torch x2" is that item), then the decoded name
   (a legacy caller handing "Torch x2" means two torches), each through invFind (exact key, then a unique base) */
function _invLegacyFind(rows,name){var i=invFind(rows,name),d;if(i>=0)return i;d=invStoredParse(name).name;if(d!==String(name==null?"":name).trim()){var miss=invFind.last;i=invFind(rows,d);if(i<0&&miss&&miss.why==="ambiguous")invFind.last=miss;}return i;}
/* the same find over ENTRIES (both shapes, read-only): returns the index into `es`, or -1 with the miss on _invLastMiss */
function _invEntryFind(es,name){
  var lit=itemKey(name),dec=itemKey(invStoredParse(name).name),i,hits=[],b;_invLastMiss=null;
  for(i=0;i<es.length;i++)if(itemKey(es[i].name)===lit)return i;
  if(dec!==lit)for(i=0;i<es.length;i++)if(itemKey(es[i].name)===dec)return i;
  b=itemBaseKey(invStoredParse(name).name);if(b)for(i=0;i<es.length;i++)if(itemBaseKey(es[i].name)===b)hits.push(i);
  if(hits.length===1)return hits[0];
  _invLastMiss=hits.length>1?{why:"ambiguous",names:hits.map(function(h){return es[h].name;})}:{why:"absent"};return -1;
}
/* wornSet(cs, item, on, who) → {ok, item | reason}: the WORN tag and the summary extractor's attire belt. The sheet is healed
   first (rows, the flag on the row); nothing uncarried is worn — refused LOUDLY, as always (#388). */
function wornSet(cs,item,on,who){if(!cs)return {ok:false,reason:"no sheet"};var h=invHealSheet(cs);if(!h.ok){if(typeof console!=="undefined")console.warn("[attire] WORN refused — "+h.reason);return {ok:false,reason:h.reason};}
  var inv=cs.inventory,ii=_invLegacyFind(inv,item);
  if(ii<0){if(on&&typeof console!=="undefined")console.warn("[attire] WORN: '"+item+"' is not in "+(who||cs.name||"?")+"'s inventory — nothing is worn that is not carried; emit [ITEM_GAINED:] first (#388)");return {ok:false,reason:on?"not carried":"not worn"};}
  var r=invEquip(inv,inv[ii].name,on);if(r.ok)return {ok:true,item:r.row.name};return {ok:false,reason:on?"already worn":"not worn",item:inv[ii].name};}
/* wornPrune(cs): the invariant "nothing is worn that is not carried" holds by construction on rows (a removed row takes its
   flag with it) — the call heals an unhealed sheet (a leftover worn list folds in) and returns 0. The name retires with the
   legacy form's cleanup. */
function wornPrune(cs){if(!cs)return 0;invHealSheet(cs);return 0;}
/* wornRename: a rename keeps the row and its flag (invRename) — nothing to move; a REFUSED rename moves nothing either (#606
   closes by construction: the mark could no longer follow a name the pack refused). Returns false: no separate mark exists. */
function wornRename(cs){if(cs)invHealSheet(cs);return false;}
/* isWorn(cs, item): READ-ONLY, both shapes — the row's flag; on an unhealed sheet the legacy worn list */
function isWorn(cs,item){if(!cs)return false;if(Array.isArray(cs.worn))return _wornIdx(cs.worn,item)>=0;var es=invEntries(cs.inventory||[]),i=_invEntryFind(es,item);return i>=0&&es[i].equipped===true;}
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
/* addInventoryItem(inv, name): ONE unit by a count-free name (every tag handler and ledger line passes the decoded base);
   a legacy caller handing "Rope x3" adds three, as the raw push used to read back. Returns true when the unit landed. */
function addInventoryItem(inv,name,frag){addInventoryItem.lastRefusal=null;addInventoryItem.lastFields=false;var p=invPrepare(inv);if(!p.ok){addInventoryItem.lastRefusal="the pack cannot be prepared: "+p.reason;return false;}var d=invStoredParse(name),r=invAdd(inv,d.name,d.qty,frag?invExtras(frag):null);/* #599 (c2): a fragment's fields ride the unit (I5); .lastRefusal says why a unit did not land, .lastFields that the destination's fields differ */
  if(!r.ok){addInventoryItem.lastRefusal=r.reason;addInventoryItem.lastFields=!!r.fields;if(typeof console!=="undefined")console.warn("[inventory] gain refused — '"+name+"': "+r.reason);}return r.ok;}
/* inventoryCountOf(inv, name): units held under the name's key — read-only, both shapes (the reward measurement) */
function inventoryCountOf(inv,name){
  var es=invEntries(inv||[]),lit=itemKey(name),dec=itemKey(invStoredParse(name).name),n=0,i;
  for(i=0;i<es.length;i++)if(itemKey(es[i].name)===lit)n+=es[i].qty;
  if(!n&&dec!==lit)for(i=0;i<es.length;i++)if(itemKey(es[i].name)===dec)n+=es[i].qty;
  return n;
}
// #176: relabel a carried item IN PLACE — the engine path a fiction-side rename never had.
// Stack count and list position survive; unknown item and name-collision both refuse LOUDLY
// (muts + console). A collision is refused because two entries silently becoming one is
// [ITEM_LOST:]'s job — a relabel must never destroy a stack.
function renameInventoryItem(inv,oldName,newName,R,who){
  /* #599 (b3): the ONE resolver — exact key, then a UNIQUE provenance-free base; two candidates for one base refuse LOUDLY
     (the first-match fallback used to relabel whichever came first — "Rope" with "Rope (spare)" and "Rope (coil)" carried).
     (c): over rows through invRename — the count, the position, the flag and every unknown field stay on the row. */
  var label=who?who+": ":"",p=invPrepare(inv);if(!p.ok){if(R&&R.muts)R.muts.push("⚠ "+label+"RENAME refused: "+p.reason);return false;}
  var hit=_invLegacyFind(inv,oldName),miss=invFind.last;
  if(hit<0){
    var m1=(miss&&miss.why==="ambiguous")
      ?"RENAME refused: '"+oldName+"' matches "+miss.names.length+" items on the "+(who||"player")+" sheet ("+miss.names.join(", ")+") — name the one you mean"
      :"RENAME refused: no '"+oldName+"' on the "+(who||"player")+" sheet";
    if(typeof console!=="undefined")console.warn("[items] "+m1);if(R&&R.muts)R.muts.push("⚠ "+label+m1);return false;
  }
  var r=invRename(inv,inv[hit].name,newName);
  if(!r.ok){
    var m2=/already on the sheet/.test(r.reason)?"RENAME refused: '"+newName+"' already on the sheet — if the two are one item, emit [ITEM_LOST:"+oldName+"] instead":"RENAME refused: "+r.reason;
    if(typeof console!=="undefined")console.warn("[items] "+m2);if(R&&R.muts)R.muts.push("⚠ "+label+m2);return false;
  }
  if(R&&R.muts)R.muts.push(label+oldName+" → "+newName);
  return true;
}
/* #481 A2 (a) (audit 2026-09-29, Fable-approved): ONE inventory name resolver. Exact (_invNorm) first; then a UNIQUE base
   name (itemBaseName strips the provenance clause, the rename rule), because the tag doc teaches "Signet ring (from Sheriff
   Hemlock)" and the GM later writes "Signet ring". Two candidates for one base name are AMBIGUOUS: nothing is removed and
   the reason rides _invLastMiss for the loud line. Returns the index, or -1. */
var _invLastMiss=null;
/* resolveInventoryName(inv, name): READ-ONLY, both shapes — the STORED index of the entry the name means, or -1 with the
   miss on _invLastMiss (invHolds and the loud "ambiguous" lines read it) */
function resolveInventoryName(inv,name){var es=invEntries(inv||[]),i=_invEntryFind(es,name);return i<0?-1:es[i].i;}
/* removeInventoryItem(inv, name): ONE unit; .last carries the exact sheet name removed (#481 A2: a refused partner puts it
   back by that name) and _invLastMiss the reason for a miss */
function removeInventoryItem(inv,name){removeInventoryItem.last=null;removeInventoryItem.lastRow=null;_invLastMiss=null;var p=invPrepare(inv);if(!p.ok)return false;
  var i=_invLegacyFind(inv,name);if(i<0){_invLastMiss=invFind.last;return false;}
  var r=invRemove(inv,inv[i].name,1);if(!r.ok)return false;removeInventoryItem.last=r.name;removeInventoryItem.lastRow=r.removed;/* #599 (c2): the unit's FRAGMENT (its unknown fields), for a transfer to carry (I5) */return true;
}
/* #481 A2 (b): the halves of one move share a PAIR KEY (base name, provenance-free), and each handler notes what it moved or
   missed on R, so the partner handler can withhold itself or put the unit back. The shapes: stow (ITEM_LOST +
   LOCATION_ITEM placed), give (ITEM_LOST + COMPANION_ITEM_GAINED), take (COMPANION_ITEM_LOST + ITEM_GAINED), and sale
   (GOLD + ITEM_LOST). */
function itemPairKey(name){return itemBaseKey(_qtyParse(String(name==null?"":name)).base);}/* #599 (b3): the tag grammar decodes the count, itemBaseKey projects the clause */
/* #481 D2 (audit 2026-09-29, Fable-approved): the STASH identity — the quantity grammar plus the pack's own name normaliser
   (plural s, dash spacing, case), so the chest and the pack agree on what an item is. Unlike the pair key it keeps the
   provenance: "Rope (spare)" and "Rope" are two different chest rows. Every stash consumer keys through it. */
function stashKey(name){return itemKey(_qtyParse(String(name==null?"":name)).base);}/* #599 (b3): the tag grammar, then the pack rule — provenance kept */
function itemPairNote(R,field,name,val){if(!R[field])R[field]=keyedDict();var k=itemPairKey(name);(R[field][k]=R[field][k]||[]).push(val);}

/* ═══ THE READ/WRITE BOUNDARY (#599 b4) — every reader and writer outside this file sees an inventory through these, never
   by indexing an entry, testing its type, parsing its count or joining the list itself (the INVENTORY BOUNDARY CONTRACT in
   run-tests.js derives the census). Release (c) changes what these return; nothing outside this file moves. ═══ */
/* invEntries(inv) → [{name, qty, text, i}]: a string decodes through the stored grammar, a row is itself. A non-string,
   non-row entry is JUNK — skipped, counted on invEntries.lastJunk and said on the console (the three readers that used to
   skip it in silence now share this one loud skip). */
/* ONE entry → {name, qty, text, equipped} or null (junk): the reader every projection below shares */
function invEntryRow(e){
  if(typeof e==="string"){if(!e.trim())return null;var p=invStoredParse(e);return {name:p.name,qty:p.qty,text:e,equipped:false};}
  if(e&&typeof e==="object"&&typeof e.name==="string")return {name:e.name,qty:invUnits(e.qty),text:invText(e),equipped:e.equipped===true};
  return null;
}
function invEntries(inv){var out=[],i,junk=0,first=-1;for(i=0;i<(inv||[]).length;i++){var r=invEntryRow(inv[i]);
  if(r){r.i=i;out.push(r);}
  else{junk++;if(first<0)first=i;}}
  invEntries.lastJunk=junk;
  /* said ONCE per distinct junk shape per page (count, first position, list length) — the readers run several times a turn
     (the snapshot, the ghost sweep, the recurring-name check, a panel paint), and §5.2 ⑥ forbids a repeated warning */
  if(junk&&typeof console!=="undefined"){var sig=junk+"|"+first+"|"+(inv||[]).length;if(!invEntries._said[sig]){invEntries._said[sig]=1;console.warn("[inventory] "+junk+" empty or unreadable inventory entr"+(junk===1?"y":"ies")+" skipped (not a string, not a row) — first at position "+first);}}
  return out;}
invEntries.lastJunk=0;invEntries._said=keyedDict();
/* invEntryText(inv, at): the text of ONE entry by position — the sheet's × mark rides it (#429) */
function invEntryText(inv,at){var e=(inv||[])[at];return e==null?"":(typeof e==="string"?e:invText(e));}
/* invEntryName(inv, at): the NAME of one entry by position (count-free; a row's name is literal) — the delete marks key on it */
function invEntryName(inv,at){var r=invEntryRow((inv||[])[at]);return r?r.name:"";}
/* invTally(inv) → {key: {label, n}}: units per item KEY (never per whole string — two spellings of one item are one tally);
   the label is the first spelling met. The snapshot/toast and the Sync diff read this. */
function invTally(inv){var m=keyedDict(),es=invEntries(inv),i;for(i=0;i<es.length;i++){var k=itemKey(es[i].name);if(!m[k])m[k]={label:es[i].name,n:0};m[k].n+=es[i].qty;}return m;}
/* invFromLines(text): the ONE free-text parser (the Sync modal's textarea) — one item per line, trimmed, empties dropped,
   each line kept as typed (a legacy string; " xN" is read by the stored grammar wherever it is read) */
function invFromLines(text){return String(text==null?"":text).split("\n").map(function(x){return x.trim();}).filter(function(x){return x.length>0;});}
/* invHolds(inv, name): does the pack hold the item — by the ONE resolver (exact key, then a unique provenance-free base),
   never a whole-string indexOf: "Rope x2" holds "Rope", "rope" holds "Rope"; two bases for one name is not a hold */
function invHolds(inv,name){return resolveInventoryName(inv,name)>=0;}
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
/* (c): the faucet hands the model's strings to invRows — duplicates stack by key on arrival, the stored grammar reads the count
   ("Rope x3" + "rope x3" is one row of six), the first `cap` rows are kept. Non-strings are not evidence here: the model's
   array is not a sheet. A count over the bound is CLAMPED to INV_QTY_MAX and said — the pack arrives (#599 (c2), review 9:
   the (c) faucet emptied a whole generated pack over one such entry; the old faucet had kept it) — never a raw push. */
function sanitizeModelInventory(list,cap){
  var rows=[],i,max=cap||1e9,p,q,a,j,clamped=[];
  if(!list||!list.length)return [];
  for(i=0;i<list.length;i++){if(typeof list[i]!=="string"||!list[i])continue;p=invStoredParse(list[i]);if(!p.name)continue;q=p.qty;
    if(q>INV_QTY_MAX){clamped.push(p.name+" x"+q);q=INV_QTY_MAX;}
    a=invAdd(rows,p.name,q);if(!a.ok){j=invFind(rows,p.name);if(j>=0){clamped.push(rows[j].name+" x"+(rows[j].qty+q));rows[j].qty=INV_QTY_MAX;}}}/* a fold over the bound clamps the stack */
  if(clamped.length&&typeof console!=="undefined")console.warn("[inventory] a model inventory held "+clamped.length+" count"+(clamped.length>1?"s":"")+" over "+INV_QTY_MAX+" — clamped: "+clamped.join(", "));
  return rows.slice(0,max);
}
/* foldDuplicateInventory(inv): the stock heal — two entries under one key become one row (invRows: first name and position
   win, units summed, equipped OR; different unknown fields refuse). In place; returns the number of entries folded away.
   (c): the admission registry's heal does this at every door; the name stays for its callers and tests. */
function foldDuplicateInventory(inv){
  if(!inv||inv.length<2)return 0;
  var r=invRows(inv),i;if(!r.ok||r.diagnostics.length){if(typeof console!=="undefined")console.warn("[inventory] fold refused — "+(r.ok?"unreadable entries on a bare list (heal the sheet first)":r.reason));return 0;}
  var folded=inv.length-r.rows.length;inv.length=0;for(i=0;i<r.rows.length;i++)inv.push(r.rows[i]);
  return folded;
}

/* ═══ THE SHEET'S READERS (#599 b4) — moved VERBATIM from helpers.js (one home): the category grouping the sheet renders and the
   #429 drop marks it commits. They index the stored list and compare whole entries, which only this module may do. ═══ */
// ── #157: THE shared inventory view model (Sol §5) — one pure grouping fn, two renderers ───
// Returns non-empty category groups in registry order (+ Unclassified last), each row carrying
// its ORIGINAL array index so a visually regrouped Drop still removes the right stored row.
// Every input row appears exactly once; the stored array is never reordered or rewritten.
function groupInventory(inv){
  inv=inv||[];
  var buckets=keyedDict(),order=[],i,j;
  for(i=0;i<INVENTORY_CATEGORY_REGISTRY.length;i++){buckets[INVENTORY_CATEGORY_REGISTRY[i].id]={id:INVENTORY_CATEGORY_REGISTRY[i].id,label:INVENTORY_CATEGORY_REGISTRY[i].label,rows:[]};order.push(INVENTORY_CATEGORY_REGISTRY[i].id);}
  var un={id:"unclassified",label:"Unclassified",rows:[]};
  for(i=0;i<inv.length;i++){
    var raw=inv[i],text=invEntryText(inv,i),er=invEntryRow(raw),e=itemLookup(text),cats=e?itemInvCategories(e):null;
    var row={raw:raw,text:text,name:er?er.name:"",qty:er?er.qty:1,equipped:!!(er&&er.equipped),sourceIndex:i,key:itemBaseName(text),entry:e,categories:cats||[]};/* #599 (b5): `text` is what a renderer shows and passes on — `raw` is the stored entry, whatever its shape (review (b) 2); (c): name, qty and equipped for the row's badge and mark */
    if(!cats){un.rows.push(row);continue;}
    var placed=false;
    for(j=0;j<order.length;j++){if(cats.indexOf(order[j])>=0){buckets[order[j]].rows.push(row);placed=true;break;}}
    if(!placed)un.rows.push(row);
  }
  var out=[];
  for(i=0;i<order.length;i++){if(buckets[order[i]].rows.length)out.push(buckets[order[i]]);}
  if(un.rows.length)out.push(un);
  return out;
}
// ── #429 BATCH DROP (owner 2026-09-21): the sheet's × MARKS a row, one "Delete N items" button commits ──
// (The copy says DELETE: nothing is placed in the world, the item ceases to exist. The identifiers keep "drop".)
// Marks are session state: {"<idx>|<name>":true} per owner. The pair pins a mark to the row it was set
// on; invDropPlan re-resolves every mark against the LIVE inventory (index first, then by name, never
// the same row twice) so a GM turn that spliced the array between the mark and the button never drops
// the row that slid into a marked index. Pure and DOM-free — the sheet is a thin shell over these.
function invDropMarkKey(idx,name){return String(idx|0)+"|"+String(name);}
function invDropToggle(marks,idx,name){
  marks=marks||{};var k=invDropMarkKey(idx,name),out={},m;
  for(m in marks){if(Object.prototype.hasOwnProperty.call(marks,m)&&marks[m]&&m!==k)out[m]=true;}
  if(!marks[k])out[k]=true;
  return out;
}
function invDropCount(marks){var n=0,m;if(!marks)return 0;for(m in marks){if(Object.prototype.hasOwnProperty.call(marks,m)&&marks[m])n++;}return n;}
/* #481 F8: the row a × means. The × carries its row's index AND name, but a GM turn between the render and the click can
   splice the pack, so the index alone may now name the neighbour ("Deleted 1 item: Waterskin" for the Torch ×). The name
   wins when the two disagree — the row carrying it nearest the old index; no name (a render from before) keeps the index;
   -1 = the item is gone. Pure. */
/* (c): a mark names its row by the row's NAME, matched by the one item key (§4.3) — never the whole entry, which a row is not */
function _invMarkIs(inv,i,name){return itemKey(invEntryName(inv,i))===itemKey(name);}
function invMarkResolve(inv,idx,name){
  inv=inv||[];idx=idx|0;
  if(name==null||name==="")return idx>=0&&idx<inv.length?idx:-1;
  if(idx>=0&&idx<inv.length&&_invMarkIs(inv,idx,name))return idx;
  var best=-1,i;for(i=0;i<inv.length;i++){if(_invMarkIs(inv,i,name)&&(best<0||Math.abs(i-idx)<Math.abs(best-idx)))best=i;}
  return best;
}
function invDropPlan(inv,marks){
  inv=inv||[];marks=marks||{};var live=[],stale=[],seen=keyedDict(),k,i;
  for(k in marks){
    if(!Object.prototype.hasOwnProperty.call(marks,k)||!marks[k])continue;
    var bar=k.indexOf("|"),idx=parseInt(k.slice(0,bar),10),name=k.slice(bar+1),at=-1;
    if(idx>=0&&idx<inv.length&&_invMarkIs(inv,idx,name)&&!seen[idx])at=idx;
    else{for(i=0;i<inv.length;i++){if(_invMarkIs(inv,i,name)&&!seen[i]){at=i;break;}}}
    if(at<0){stale.push(name);continue;}
    seen[at]=true;live.push({idx:at,name:name});
  }
  live.sort(function(a,b){return a.idx-b.idx;});
  return {drop:live,stale:stale,count:live.length,ok:live.length>0};
}
function invDropApply(inv,plan){
  var names=[],i;
  for(i=plan.drop.length-1;i>=0;i--)inv.splice(plan.drop[i].idx,1);/* highest first: the lower indices stay true */
  for(i=0;i<plan.drop.length;i++)names.push(plan.drop[i].name);
  return names;
}
function invDropButtonText(n){return "Delete "+n+" item"+(n===1?"":"s");}
function invDropNamesText(names){
  names=names||[];if(names.length<=4)return names.join(", ");
  return names.slice(0,4).join(", ")+" and "+(names.length-4)+" more";
}
