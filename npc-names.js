/* npc-names.js - #786 (owner 2026-11-25: "Prior to a character being named, we need to stick to descriptions").
   WHETHER THE HERO HAS BEEN GIVEN A CHARACTER'S NAME.

   The engine files every character by name the moment they appear (the rules require it; a blueprint seeds its cast by
   name), and from then the name rode every prompt exactly as a known name does. Nothing said the name was the engine's and
   not yet the story's, so the registration turn was written correctly ("the guard murmurs") and the name leaked a turn or
   two later ("Farren's woven reed mantle"). This file is that missing record and its three readers.

   The record, on the roster row (worldState.npcs[]):
     nameGiven  the turn the story gave the hero the name (absent = not given)
     seenAs     the few words the story uses until then ("the heron-crested guard")
     nameSlips  how often the narration used the name before it was given
   The whole feature is off for a world without worldState.nameGate (set at Begin and by the load door, namesHeal).

   How a name becomes given:
     - it is spoken in quoted dialogue (the hero hears it) - read from the prose by namesObserve, after the turn commits;
     - the GM says so: [NPC_NAMED:Name] (tag_table.js) - a name read, or told outside a quoted line;
     - the narration used it NAME_SLIP_MAX times after being asked not to: the player has read it, so the engine stops asking.
   Known from the start: party members, the player, a village resident, anyone the hero's sheet holds a relationship with
   at Begin (namesBegin), and a "name" that is a description or a title ("The Forest King").

   Readers: buildNamesBlock (the GM is told, volatile half), buildNameSlipNote (api.js - the correction, one turn later),
   npcShownName (what the panels print). Tags always carry the real name; identity and voices never see this file. */
var NAME_SLIP_MAX=2;      /* corrections per character before the engine counts the name as read */
var NAME_BLOCK_CAP=24;    /* characters listed in the GM's block */
var NAME_SEEN_AS_MAX=60;  /* characters of a description */
var NAME_UNNAMED_LABEL="Unnamed figure";
/* Words that are a rank, a kinship or grammar: never the part of a name that identifies someone. */
var NAME_TITLE_WORDS=["the","and","von","van","del","der","lord","lady","sir","dame","king","queen","prince","princess","captain","master","mistress","old","young","brother","sister","father","mother","elder","chief","high","priest","priestess","duke","duchess","baron","baroness","count","countess","guard","sheriff","mayor","doctor","general","commander","sergeant","warden","saint","uncle","aunt","grandmother","grandfather"];
var NAME_LETTER="A-Za-z\\u00C0-\\u024F";
/* The words of a registered name that identify the person: capitalised, three letters or more, not a title. A name that
   opens with "the" is a description and has none. */
function nameWords(name){
  var s=String(name||"").trim(),out=[],parts,i,w;
  if(!s||/^the\s/i.test(s))return out;
  parts=s.split(/\s+/);
  for(i=0;i<parts.length;i++){
    w=parts[i].replace(new RegExp("^[^"+NAME_LETTER+"]+|[^"+NAME_LETTER+"]+$","g"),"");
    if(w.length<3||!/^[A-ZÀ-Þ]/.test(w))continue;
    if(NAME_TITLE_WORDS.indexOf(w.toLowerCase())>=0)continue;
    if(out.indexOf(w)<0)out.push(w);
  }
  return out;
}
/* The first word of the name found in the text as a whole word (case as written; a possessive counts), or "". */
function nameHit(text,name){
  var t=String(text||""),ws=nameWords(name),i,re;
  if(!t)return "";
  for(i=0;i<ws.length;i++){
    re=new RegExp("(^|[^"+NAME_LETTER+"])"+ws[i].replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?!["+NAME_LETTER+"])");
    if(re.test(t))return ws[i];
  }
  return "";
}
/* Cleaned narration, split into what is SAID (inside quotation marks) and what is TOLD (the narrator). A straight quote
   toggles; a curly pair opens and closes; a blank line ends an open quotation (a continuing speech reopens it). */
function nameProseSplit(clean){
  var s=String(clean||""),said="",told="",open=false,i,c;
  for(i=0;i<s.length;i++){
    c=s.charAt(i);
    if(c==="\n"&&s.charAt(i+1)==="\n"){open=false;said+=" ";told+=" ";continue;}
    if(c==="\""){open=!open;said+=" ";told+=" ";continue;}
    if(c==="“"){open=true;said+=" ";told+=" ";continue;}
    if(c==="”"){open=false;said+=" ";told+=" ";continue;}
    if(open)said+=c;else told+=c;
  }
  return {said:said,told:told};
}
/* The buttons a reply offers ([SUGGEST:a|b|c]), as one text. */
function nameButtonsText(raw){
  var m=String(raw||"").match(/\[SUGGEST:([^\]]*)\]/g)||[],i,out=[];
  for(i=0;i<m.length;i++)out.push(m[i].slice(9,-1).replace(/\|/g," . "));
  return out.join(" . ");
}
function _nameHeroKnows(name){
  var c=(typeof worldState!=="undefined"&&worldState)?worldState.character:null,r=c&&c.relationships,i,k=String(name||"").toLowerCase();
  if(!(r instanceof Array))return false;
  for(i=0;i<r.length;i++)if(r[i]&&String(r[i].entity||r[i].name||"").toLowerCase()===k)return true;
  return false;
}
/* Has the story given the hero this character's name? True for every character of a world without the gate. */
function npcNameKnown(n){
  if(typeof worldState==="undefined"||!worldState||!worldState.nameGate)return true;
  if(!n||n.partyMember||n.resident||n.nameGiven)return true;
  if(!nameWords(n.name).length)return true;
  return !!(typeof memoryNpcIsPlayer==="function"&&memoryNpcIsPlayer(n.name));
}
/* Begin (startGame, after the blueprint and the companions are in): the people the hero's own sheet holds a relationship
   with are known by name - a backstory bond is someone the hero knows. Only here: a relationship the story files later
   says nothing about a name (the field save filed one for a guard two turns before anyone named him). */
function namesBegin(){
  if(typeof worldState==="undefined"||!worldState||!worldState.nameGate||!(worldState.npcs instanceof Array))return 0;
  var c=0,i,n;
  for(i=0;i<worldState.npcs.length;i++){n=worldState.npcs[i];if(n&&!n.nameGiven&&_nameHeroKnows(n.name)){n.nameGiven=1;c++;}}
  return c;
}
/* What a panel prints for a character: the name once given, else the description, else a plain label. */
function npcShownName(name){
  var n=(typeof wsNpcByName==="function")?wsNpcByName(name):null;
  if(!n||npcNameKnown(n))return String(name||"");
  var d=String(n.seenAs||"").trim();
  return d||NAME_UNNAMED_LABEL;
}
/* What the player READS outside the story's prose - the changes line under a reply and the suggested actions - with every
   name the story has not given replaced by the character's description (owner 2026-11-27: the prose kept to descriptions,
   the line and a button still printed "Theron Wyndfall"). A run of the name's own words that holds an identifying word is
   one mention; a title alone ("the Princess") is left. Display only: the record, the tags and the prompt keep the name. */
var NAME_MASK_LABEL="the stranger";
function nameMaskText(text){
  var s=String(text==null?"":text);
  if(!s||typeof worldState==="undefined"||!worldState||!worldState.nameGate||!(worldState.npcs instanceof Array))return s;
  var edge=new RegExp("^[^"+NAME_LETTER+"]+|[^"+NAME_LETTER+"]+$","g"),i;
  for(i=0;i<worldState.npcs.length;i++){
    (function(n){
      if(!n||npcNameKnown(n)||!nameHit(s,n.name))return;
      var toks=String(n.name).split(/\s+/).map(function(w){return w.replace(edge,"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}).filter(function(w){return !!w;});
      if(!toks.length)return;
      var alt="(?:"+toks.join("|")+")",label=String(n.seenAs||"").trim()||NAME_MASK_LABEL;
      s=s.replace(new RegExp("(^|[^"+NAME_LETTER+"])("+alt+"(?:\\s+"+alt+")*)(?!["+NAME_LETTER+"])","g"),function(m,pre,run,at){
        if(!nameHit(run,n.name))return m;
        return pre+((at+pre.length===0)?label.charAt(0).toUpperCase()+label.slice(1):label);
      });
    })(worldState.npcs[i]);
  }
  return s;
}
/* A description as stored: one line, no quotation marks, capped. "" when nothing usable is left. */
function nameSeenAsClean(text){
  return String(text||"").replace(/[\r\n]+/g," ").replace(/["“”]/g,"").replace(/\s+/g," ").trim().slice(0,NAME_SEEN_AS_MAX).trim();
}
/* The characters whose names are not yet given: those play has touched first, most recently mentioned first, then the
   rest of the record in its own order. */
function namesNotGiven(){
  if(typeof worldState==="undefined"||!worldState||!worldState.nameGate||!(worldState.npcs instanceof Array))return [];
  var mem=(typeof memory!=="undefined"&&memory&&memory.npcs)?memory.npcs:{},seen=[],rest=[],i,n,m;
  for(i=0;i<worldState.npcs.length;i++){
    n=worldState.npcs[i];if(!n||npcNameKnown(n))continue;
    m=Object.prototype.hasOwnProperty.call(mem,n.name)?mem[n.name]:null;
    if(typeof npcDiscovered==="function"&&npcDiscovered(n,m))seen.push({n:n,at:(m&&m.lastMentioned)||n.met||0,i:i});else rest.push(n);
  }
  seen.sort(function(a,b){return (b.at-a.at)||(a.i-b.i);});
  return seen.map(function(x){return x.n;}).concat(rest);
}
/* After a turn commits: a name spoken aloud is given; a name the narrator or a button used before that is a slip. */
function namesObserve(raw,clean,turn){
  if(typeof worldState==="undefined"||!worldState||!worldState.nameGate||!(worldState.npcs instanceof Array))return null;
  var parts=nameProseSplit(clean),btn=nameButtonsText(raw),out={given:[],slips:[]},i,n,w;
  for(i=0;i<worldState.npcs.length;i++){
    n=worldState.npcs[i];if(!n||npcNameKnown(n))continue;
    if(nameHit(parts.said,n.name)){n.nameGiven=turn||1;out.given.push(n.name);continue;}
    w=nameHit(parts.told,n.name)||nameHit(btn,n.name);
    if(!w)continue;
    n.nameSlips=(n.nameSlips||0)+1;
    if(n.nameSlips>NAME_SLIP_MAX){
      n.nameGiven=turn||1;n.nameGivenBy="use";out.given.push(n.name);
      if(typeof console!=="undefined")console.warn("[names] #786 the narration used '"+n.name+"' "+n.nameSlips+" times before the story gave it - counted as given; the engine stops asking");
    }else out.slips.push({name:n.name,word:w});
  }
  if(out.slips.length){
    worldState.namePing={turn:turn||0,slips:out.slips.slice(0,4)};
    if(typeof console!=="undefined")console.warn("[names] #786 named before the story gave the name: "+out.slips.map(function(s){return s.name+" ('"+s.word+"')";}).join(", "));
  }
  return out;
}
/* What the GM is told, every turn of a gated world (volatile half). It also teaches the two tags: they are engine-only
   in the standing doc (tag_table.js TAG_DOC_ENGINE_ONLY), so the stable half is byte-identical. */
function buildNamesBlock(){
  if(typeof worldState==="undefined"||!worldState||!worldState.nameGate)return "";
  var list=namesNotGiven(),show=list.slice(0,NAME_BLOCK_CAP),more=list.length-show.length;
  var s="NAMES THE HERO HAS BEEN GIVEN: registering a character gives the ENGINE their name; it does not give the hero that name. Until the story gives it (they say it, someone says it in the hero's hearing, the hero reads it), narration and [SUGGEST:] buttons call the character by what the hero sees - \"the heron-crested guard\" - never by the name. Tags always carry the REGISTERED name, never the description: [NPC:Name|...], and [SAY:Name] before a line the prose gives to \"the guard\" - a description in a tag files a second person and loses the voice. A name spoken in quoted dialogue is given; a name the hero learns any other way: [NPC_NAMED:Name]. When you register a character whose name the story has not given, add [NPC_SEEN_AS:Name|a few words for what the hero sees].\n";
  if(show.length)s+="NOT YET GIVEN - write the description, never the name: "+show.map(function(n){return n.name+(n.seenAs?" (write: "+n.seenAs+")":(typeof npcDiscovered==="function"&&npcDiscovered(n,null)?" (no description on record - emit [NPC_SEEN_AS:"+n.name+"|a few words])":""));}).join("; ")+(more>0?"; and "+more+" more on record":"")+"\n";
  return s+"\n";
}
/* The load door (migrateWorldState): a world saved before the gate. Every character play has already touched counts as
   named (owner ruling 2026-11-25) - the player has read those names; a seeded character nobody has met does not. */
function namesHeal(ws,mem){
  if(!ws||ws.nameGate)return 0;
  var c=0,i,n,m,npcs=(ws.npcs instanceof Array)?ws.npcs:[],mn=(mem&&mem.npcs)||{};
  for(i=0;i<npcs.length;i++){
    n=npcs[i];if(!n||n.nameGiven)continue;
    m=Object.prototype.hasOwnProperty.call(mn,n.name)?mn[n.name]:null;
    if(typeof npcDiscovered==="function"&&npcDiscovered(n,m)){n.nameGiven=(typeof n.introduced==="number"&&n.introduced>0)?n.introduced:(n.met>0?n.met:1);c++;}
  }
  ws.nameGate=1;
  return c;
}
