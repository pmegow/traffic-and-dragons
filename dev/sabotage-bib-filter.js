#!/usr/bin/env node
"use strict";

// Mutation proof for the Bible Editor spell browser's name/effect and category filters.
// Each mutation runs in a disposable clone and must be caught by its named contract clause.
const sabotage = require("./scratch-contract-sabotage.js");

const cases = [
  { file: "bible_editor.html", label: "no selected category leaves every candidate visible", mustFail: "no filters shows every candidate",
    find: "    if (!selected.length) return true;", replace: "    if (!selected.length) return false;" },
  { file: "bible_editor.html", label: "multiple selected categories use inclusive OR", mustFail: "multiple category filters are inclusive OR",
    find: "    return categoryMatch;", replace: "    return selected.length > 1 ? false : categoryMatch;" },
  { file: "bible_editor.html", label: "free text excludes category and tradition", mustFail: "free-text row blob includes category/tradition again",
    find: '(c.key + " " + (c.entry.effect || "")).toLowerCase()', replace: '(c.key + " " + cats + " " + (c.entry.effect || "")).toLowerCase()' },
  { file: "bible_editor.html", label: "placeholder names only searchable text fields", mustFail: "text placeholder still advertises tradition",
    find: "placeholder='filter by name / effect'", replace: "placeholder='filter by name / effect / tradition'" },
  { file: "bible_editor.html", label: "category checkbox changes refresh candidate rows", mustFail: "category checkbox changes no longer refresh",
    find: "bpCats[bci].onchange = refreshBibFilters", replace: "bpCats[bci].onchange = function () {}" }
];

process.exit(sabotage.prove("BIBLE EDITOR BIB FILTER SABOTAGE", cases));
