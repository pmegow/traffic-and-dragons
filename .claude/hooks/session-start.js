// SessionStart hook (#646): run dev/session-check.js and hand its report to the model as context —
// a SessionStart hook's stdout is added to the session, so a red CI (or anything else the advisory
// finds) is in front of Claude before the first turn. Warn-only like the advisory itself: never a
// non-zero exit, never a stall (60 s cap). Wired per machine in .claude/settings.local.json:
//   "SessionStart": [{ "hooks": [{ "type": "command", "command": "node C:/Projects/traffic-and-dragons/.claude/hooks/session-start.js" }] }]
var cp = require("child_process"), path = require("path");
var ROOT = process.env.TND_HOOK_ROOT || path.join(__dirname, "..", "..");
var r = cp.spawnSync(process.execPath, [path.join(ROOT, "dev", "session-check.js"), "--root", ROOT], { encoding: "utf8", timeout: 60000, windowsHide: true });
var text = ((r.stdout || "") + (r.stderr || "")).trim();
if (r.error) text += (text ? "\n" : "") + "session-check could not run: " + r.error.message;
if (text) process.stdout.write("[session-check at session start]\n" + text + "\n");
process.exit(0);
