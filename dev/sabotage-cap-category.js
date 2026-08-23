#!/usr/bin/env node
"use strict";

// Mutation proof for the Bible Editor's martial-versus-magic category exclusion.
// Each mutation runs in a disposable clone and must be caught by its named contract clause.
const sabotage = require("./scratch-contract-sabotage.js");

const cases = [
  { file: "bible_editor.html", label: "magic selections clear martial", mustFail: "checking arcane clears martial",
    find: "      delete chosen.martial;", replace: "      chosen.martial = 1;" },
  { file: "bible_editor.html", label: "martial selections clear every magic tradition", mustFail: "checking martial clears every magic tradition",
    find: "      for (i = 0; i < order.length; i++) if (magic[order[i]]) delete chosen[order[i]];",
    replace: "      for (i = 0; i < order.length; i++) if (magic[order[i]]) chosen[order[i]] = 1;" },
  { file: "bible_editor.html", label: "capability form routes checkbox changes through the exclusion rule", mustFail: "capForm no longer wires category checkbox changes",
    find: "      var keep = capCategorySelection(selected, this.value, this.checked), keepSet = {}, i;",
    replace: "      var keep = selected, keepSet = {}, i;" },
  { file: "bible_editor.html", label: "validator rejects martial plus a magic tradition", mustFail: "martial + a magic tradition is rejected",
    find: "    if (cats.indexOf(\"martial\") >= 0 && (cats.indexOf(\"arcane\") >= 0 || cats.indexOf(\"divine\") >= 0 || cats.indexOf(\"primal\") >= 0 || cats.indexOf(\"necromantic\") >= 0))",
    replace: "    if (false)" }
];

process.exit(sabotage.prove("BIBLE EDITOR CATEGORY EXCLUSION SABOTAGE", cases));
