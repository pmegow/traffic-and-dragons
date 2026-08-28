"use strict";

// Retained proof for the benchmark loader/label source contract. Mutations run only in a
// disposable clone through scratch-contract-sabotage; the shared working tree is never edited.
var prove = require("./scratch-contract-sabotage.js").prove;

process.exit(prove("performance bench loader", [
  {
    file: "dev/bench-lz-memo.js",
    label: "LZ bench cannot switch to a partial canonical load",
    find: "var loaded=engine.loadEngine();",
    replace: "var loaded=engine.loadEngine(\"memory.js\");",
    mustFail: "BENCH LOADER CONTRACT: dev/bench-lz-memo.js"
  },
  {
    file: "dev/bench-rag-memo.js",
    label: "RAG bench cannot switch to a partial canonical load",
    find: "var loaded=engine.loadEngine();",
    replace: "var loaded=engine.loadEngine(\"memory.js\");",
    mustFail: "BENCH LOADER CONTRACT: dev/bench-rag-memo.js"
  },
  {
    file: "dev/bench-lz-memo.js",
    label: "LZ bench cannot present its current control as historical code",
    find: "CONTROL (memo reset every call)",
    replace: "BEFORE (old code)",
    mustFail: "BENCH LABEL CONTRACT: dev/bench-lz-memo.js"
  },
  {
    file: "dev/bench-rag-memo.js",
    label: "RAG bench cannot present its current control as historical code",
    find: "CONTROL (wrapper memos reset every call)",
    replace: "BEFORE (old code)",
    mustFail: "BENCH LABEL CONTRACT: dev/bench-rag-memo.js"
  }
]));
