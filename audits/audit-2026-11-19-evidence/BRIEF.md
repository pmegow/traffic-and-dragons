# Evidence brief — full-project code review, 2026-11-19 (HEAD d7ed4ea6, v1.1451)

You are one of 13 parallel lanes gathering evidence for a senior code review of
C:\Projects\traffic-and-dragons (a browser RPG: ES5 JavaScript, no build step, a model acts as Game
Master and writes hidden state tags the engine parses). The senior reviewer adjudicates; you report
facts. Your lane's files and lens are in the prompt that pointed you here.

## Hard rules
- READ-ONLY. Never modify, create, move or delete any file inside the repo. No git writes. No network.
- Scratch scripts ONLY under
  audits/audit-2026-11-19-evidence/<your lane letter>\
- Do NOT run dev/run-tests.js, any dev/sabotage-*.js, any browser suite, or anything that takes more
  than ~30 seconds. Small `node` probes are welcome: `require('C:/Projects/traffic-and-dragons/dev/load-engine.js')`
  then `.loadEngine(); .makeTestWorld();` gives you the real engine headless with globals
  (worldState, memory, applyMuts, …). See dev/engine-tests.js lines 1–40 for the stub pattern.
- Write scripts with the Write tool, not shell heredocs (the shell halves backslashes).
- Other sessions share this tree. Touch nothing.

## How to read
- Source lines are long and dense (a 400 KB file may be 4,000 lines). Read your files IN FULL, in
  chunks; do not sample. If a lane is too large to read whole, say exactly what you read and what
  you did not.
- CLAUDE.md (repo root) is the architecture map. Read the contract file(s) named in your prompt
  first (DOC/contracts/*.md) — a behaviour the contract describes as deliberate is NOT a finding,
  unless the code fails to do what the contract says (that IS a finding: contract drift).
- A comment carrying a tracker id (#123, UA6, B59, an owner ruling with a date) marks a deliberate
  decision. Do not report it as a defect unless you can show it fails at what it claims.

## What counts as a finding
Real defects only, in this order of interest:
1. Correctness: wrong result, lost or corrupted campaign data, state written on a failed path, a
   race across an `await` (campaign switched, `busy` left true, a stale closure writing into the
   new world), an edge input that breaks (empty, null, a name like `__proto__` / `constructor` /
   `toString` used as an object key, a `|` or `]` inside a name, very long input).
2. Silent failure: a caught error that tells nobody; a refusal with no reason; a fallback that
   hides a failure. (Project policy: failures are loud and attributable.)
3. Security: HTML/attribute injection from model-authored, imported-file or server-authored
   strings; secrets (API keys, tokens) reaching logs, error reports, URLs or exports; prototype
   pollution from parsed JSON.
4. Monotonic resources (MANDATORY section, even if empty): everything in your lane that
   accumulates — arrays, maps, caches, listeners, timers, AudioNodes, object URLs, DOM nodes,
   localStorage/IndexedDB keys — with its scope (per call / per turn / per session / per campaign /
   per device forever), its bound, and whether the bound is enforced in code. Report unbounded ones
   as findings.
5. Contract drift: CLAUDE.md or a DOC/contracts file states something the code does not do.
6. Duplicated logic whose copies DISAGREE (show the disagreement), and dead code that misleads.
NOT findings: style, naming, ES5 idiom, "could be refactored", missing tests in general, anything
you cannot tie to a concrete failing input.

## Evidence standard
For every finding give: file, function name, line number, the quoted code (short), the concrete
input or sequence that fails, the observed or expected wrong outcome, and one of
- REPRODUCED (you ran a probe; paste the script path and its actual output),
- READ (established by reading; say what you did not run and why),
- SUSPECTED (plausible, not established; say what would settle it).
Never round up. A wrong finding costs the reviewer more than a missing one. Before reporting,
try to refute your own finding: look for the guard upstream, the caller that already sanitises,
the test that already pins it (grep dev/ for the function name).

## Output
Write your full report with the Write tool to
audits/audit-2026-11-19-evidence/<lane letter>-report.md
with these sections:
1. Coverage — each file, how much you read, what you skipped.
2. Findings — at most 12, strongest first. Each: a one-sentence plain-language summary, then the
   evidence fields above, a severity guess (high = data loss / wrong canon / security; medium =
   wrong behaviour a player can hit; low = latent or cosmetic), and the smallest remedy you can see.
3. Monotonic resources — the table described above.
4. Affirmed — up to 8 things you specifically tried to break and could not (name the function and
   the input you tried). This is evidence too.
5. Undetermined — questions you could not settle.
Then reply to me with ONLY: the report path, the count of findings by severity, and one line per
finding (title + REPRODUCED/READ/SUSPECTED). No other prose.
