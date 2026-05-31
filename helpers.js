function smod(v){var m=Math.floor((v-10)/2);return(m>=0?"+":"")+m;}
function droll(s){return Math.floor(Math.random()*s)+1;}
function r4d6(){var d=[droll(6),droll(6),droll(6),droll(6)];d.sort(function(a,b){return a-b;});return d[1]+d[2]+d[3];}
function getFin(){
  var b={STR:cs.bs.STR,DEX:cs.bs.DEX,CON:cs.bs.CON,INT:cs.bs.INT,WIS:cs.bs.WIS,CHA:cs.bs.CHA};
  var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}
  if(!a)return b;
  if(a.fc>0){for(i=0;i<cs.fp.length;i++){b[cs.fp[i]]=(b[cs.fp[i]]||8)+1;}}
  else{var keys=Object.keys(a.stats);for(i=0;i<keys.length;i++){b[keys[i]]=(b[keys[i]]||8)+a.stats[keys[i]];}}
  return b;
}
function getMHP(){var i,c=null;for(i=0;i<CLSS.length;i++){if(CLSS[i].id===cs.cls){c=CLSS[i];break;}}if(!c)return 8;return c.hd+Math.floor((getFin().CON-10)/2);}
function pbSp(){var t=0,i;for(i=0;i<STATS.length;i++){t+=(PBC[cs.bs[STATS[i]]]||0);}return t;}
function pval(si,ci){var s=document.getElementById(si);if(!s)return"";if(s.value==="custom"){var c=document.getElementById(ci);return c?c.value.trim():"";}return s.value;}
function getToneNm(){if(!cs.tone)return"Unspecified";if(cs.tone==="custom")return"Custom";var i;for(i=0;i<TONES.length;i++){if(TONES[i].id===cs.tone)return TONES[i].nm;}return"Unspecified";}
function getToneVc(){if(!cs.tone)return"";if(cs.tone==="custom"){var el=document.getElementById("tone-ct");return el?el.value.trim():"";}var i;for(i=0;i<TONES.length;i++){if(TONES[i].id===cs.tone)return TONES[i].vc;}return"";}
function getSubNm(){var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}if(!a||!a.subraces)return"";var j,k;for(j=0;j<a.subraces.length;j++){if(a.subraces[j].id===cs.subrace){if(cs.heritageVariant&&a.subraces[j].lineages){for(k=0;k<a.subraces[j].lineages.length;k++){if(a.subraces[j].lineages[k].id===cs.heritageVariant)return a.subraces[j].lineages[k].nm;}}return a.subraces[j].nm;}}return"";}
function getLvl(xp){var i,l=1;for(i=1;i<XP_LEVELS.length;i++){if(xp>=XP_LEVELS[i])l=i+1;else break;}return Math.min(l,10);}
function alignLabel(law,good){var l=law>=2?"Lawful":law<=-2?"Chaotic":"Neutral";var g=good>=2?"Good":good<=-2?"Evil":"Neutral";if(l==="Neutral"&&g==="Neutral")return"True Neutral";if(l==="Neutral")return"Neutral "+g;if(g==="Neutral")return l+" Neutral";return l+" "+g;}
function skillLevel(successes){var i;for(i=SKILL_THRESHOLDS.length-1;i>=0;i--){if(successes>=SKILL_THRESHOLDS[i])return i+1;}return 0;}
function initSkills(){var s={},i;for(i=0;i<SKILLS.length;i++)s[SKILLS[i].id]=0;return s;}
