// sabotage-198.js — prove the #198 reasoning-starvation guards are not decorative.
// #198 (owner ruling 2026-08-20): gpt-5.x hidden reasoning bills against max_completion_tokens —
// the fix pins reasoning_effort "low", gives the openai cap x4 headroom, and makes an
// empty-string model response THROW instead of committing an empty turn (field t2002).
// Each mutation removes one load-bearing clause; the exact engine test must turn red,
// and sabotage.js restores byte-identical source after every case.
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","prompt caching split"]];

rc|=sabotage.prove({file:"globals.js",command:CMD,cases:[
  {label:"#198 reasoning_effort pin dropped — gpt-5.x turns pay medium-effort deliberation again",
    mustFail:"#198 openai buildBody pins reasoning_effort 'low' on gpt-5.x",
   find:"{b.max_completion_tokens=maxTok;b.reasoning_effort=\"low\";}",
   replace:"{b.max_completion_tokens=maxTok;}"},
  {label:"#198 openai headroom dropped — the 200-token actions call goes all-reasoning-empty again",
    mustFail:"#198 openai tokScale 4",
   find:"    tokScale:4, // #198:",
   replace:"    // #198:"},
  {label:"#198 openai empty-guard dropped — content:\"\" commits an empty turn again",
    mustFail:"#198 empty-string model responses THROW",
   find:"||!data.choices[0].message.content.trim())throw new Error(\"Empty response\");",
   replace:")throw new Error(\"Empty response\");"},
  {label:"#198 gemini empty-guard dropped",
    mustFail:"#198 empty-string model responses THROW",
   find:"      if(txt.trim())return txt;",
   replace:"      return txt;"},
  {label:"#198 anthropic empty-guard dropped",
    mustFail:"#198 empty-string model responses THROW",
   find:"&&typeof data.content[i].text===\"string\"&&data.content[i].text.trim())return data.content[i].text;",
   replace:"&&typeof data.content[i].text===\"string\")return data.content[i].text;"}
]});

process.exit(rc?1:0);
