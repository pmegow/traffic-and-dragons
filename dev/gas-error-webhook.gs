// gas-error-webhook.gs — GAS v2 for Traffic and Dragons error reporting (TODO #16 → bug-triage
// pipeline). Replaces the v1 doPost→MailApp script deployed 2026-07-18.
//
// WHAT CHANGED vs v1 (dual-write):
//   • Every report is APPENDED TO A GOOGLE SHEET before the email is sent — the durable,
//     machine-readable record. Email remains the human notification ping, unchanged.
//   • Screenshots (user reports, base64 data URLs up to ~1.5MB) go to a DRIVE FOLDER as JPEG
//     files — a Sheet cell caps at 50,000 chars, so they can't ride in the row. The row stores
//     the Drive link; the email still gets the image as an attachment like v1.
//   • New doGet: returns the reports as JSON for the /bugs sync step. Gated by a shared secret
//     (?s=...) so the public /exec URL doesn't expose campaign data to whoever finds it.
//
// FAILURE ORDER (no-silent-failures): sheet write FIRST, then email. Each half is try/caught
// independently — a dead email quota can't lose the record, a Sheet hiccup can't kill the email.
// Whatever failed is named inside the other channel (email notes the sheet error and vice versa)
// and in the POST response body.
//
// ── DEPLOY (your ~10 minutes) ─────────────────────────────────────────────────────────────────
// 1. script.google.com → open the EXISTING "Traffic and Dragons error webhook" project.
// 2. Replace the entire script with this file. Save.
// 3. Project Settings (⚙, left rail) → Script Properties → Add script property:
//        SECRET = <a long random string — 30+ chars, e.g. from a password generator>
//    (SHEET_ID / FOLDER_ID are auto-created on the first report and self-stored here — don't
//    add them yourself.)
// 4. Deploy → Manage deployments → ✏ (edit) → Version: "New version" → Deploy.
//    ⚠ Do NOT use "New deployment" — that mints a DIFFERENT /exec URL and orphans the one wired
//    into error-report.js (the v1 maintenance note).
//    Because the script now touches Sheets + Drive, Google will re-prompt for authorization —
//    approve the two new scopes for your own account.
// 5. Verify in a browser (logged in as you or not — doesn't matter):
//        <your /exec URL>?s=<SECRET>          → {"ok":true,"count":0,"reports":[]}
//        <your /exec URL>?s=wrong             → {"ok":false,"error":"forbidden"}
// 5b. Run AUTHORIZE_DRIVE once from the editor (▶ Run, bottom of this file) and approve the
//     Drive consent prompt. The runtime try/catch around storeScreenshot_ SUPPRESSES Google's
//     authorization prompt (the AUTHORIZE_ME lesson), so without this one-shot the Drive scope
//     is never granted and every screenshot store fails quietly — discovered live 2026-07-18
//     ("You do not have permission to call DriveApp.createFolder" in the POST response).
// 6. Hand the SECRET to Claude Code to store in .claude/bugs.local.json (gitignored — the
//    secret never enters the public repo; this .gs file is committable because it reads the
//    secret from Script Properties, not from source).
//
// ── SHEET SHAPE (auto-created: "T&D Bug Reports", one sheet "reports") ────────────────────────
//   id | receivedAt | clientTs | kind | ctx | message | detail | app | camp | turn | url | ua
//      | online | suppressed | screenshotUrl
//   crash reports:  ctx = throw site, message = error message, detail = stack (≤4KB)
//   user reports:   ctx = "user-report", message = the player's typed report (≤4000),
//                   detail = the auto-gathered context block (≤20K)

var MAIL_TO = "pmegow@gmail.com";
var CELL_MAX = 45000; // defensive floor under the 50k Sheet cell cap

// ── storage bootstrap ─────────────────────────────────────────────────────────────────────────

function props_() { return PropertiesService.getScriptProperties(); }

function getSheet_() {
  var p = props_();
  var id = p.getProperty("SHEET_ID");
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create("T&D Bug Reports");
    p.setProperty("SHEET_ID", ss.getId());
  }
  var sh = ss.getSheetByName("reports");
  if (!sh) {
    sh = ss.getSheets()[0];
    sh.setName("reports");
    sh.appendRow(["id", "receivedAt", "clientTs", "kind", "ctx", "message", "detail",
                  "app", "camp", "turn", "url", "ua", "online", "suppressed", "screenshotUrl"]);
  }
  return sh;
}

function getFolder_() {
  var p = props_();
  var id = p.getProperty("FOLDER_ID");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder("T&D Bug Screenshots");
  p.setProperty("FOLDER_ID", f.getId());
  return f;
}

// data URL → Drive JPEG, anyone-with-link view (mirrors the accepted email exposure). Returns
// the file URL, or "" on any failure (named by the caller in email/response).
function storeScreenshot_(dataUrl, id) {
  var m = String(dataUrl).match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) throw new Error("unrecognized screenshot data URL");
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], "tnd-report-" + id + ".jpg");
  var file = getFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function clip_(v, n) { return String(v == null ? "" : v).slice(0, n || CELL_MAX); }

// ── doPost — receive a report ─────────────────────────────────────────────────────────────────

function doPost(e) {
  var out = { ok: true, sheet: null, email: null, screenshot: null };
  var d;
  try { d = JSON.parse(e.postData.contents); }
  catch (err) { d = { kind: "unparseable", ctx: "doPost", msg: String(e && e.postData && e.postData.contents).slice(0, 500) }; }

  var id = Utilities.getUuid();
  var isUser = d.kind === "user-report";
  var message = isUser ? d.report : d.msg;
  var detail  = isUser ? d.context : d.detail;
  var shotUrl = "";

  if (isUser && d.screenshot) {
    try { shotUrl = storeScreenshot_(d.screenshot, id); }
    catch (err) { out.screenshot = String(err); }
  }

  // 1) the durable record
  try {
    getSheet_().appendRow([
      id, new Date().toISOString(), clip_(d.ts, 40), clip_(d.kind, 40),
      clip_(isUser ? "user-report" : d.ctx, 200), clip_(message, 4000), clip_(detail),
      clip_(d.app, 40), clip_(d.camp, 200), d.turn == null ? "" : d.turn,
      clip_(d.url, 500), clip_(d.ua, 500),
      d.online == null ? "" : String(d.online), d.suppressed || 0, shotUrl
    ]);
  } catch (err) { out.sheet = String(err); out.ok = false; }

  // 2) the notification ping
  try {
    var subj = "[T&D " + (d.app || "?") + "] " + (isUser ? "user report: " : (d.ctx || "error") + ": ")
             + String(message || "(no message)").slice(0, 120);
    var body =
      "kind: " + (d.kind || "?") + "\n" +
      "context: " + (d.ctx || (isUser ? "user-report" : "?")) + "\n" +
      "app: " + (d.app || "?") + "   campaign: " + (d.camp || "-") + "   turn: " + (d.turn == null ? "-" : d.turn) + "\n" +
      "url: " + (d.url || "?") + "\n" +
      "ua: " + (d.ua || "?") + "\n" +
      "online: " + (d.online == null ? "?" : d.online) + "   suppressed before this: " + (d.suppressed || 0) + "\n" +
      "client time: " + (d.ts || "?") + "   report id: " + id + "\n" +
      (shotUrl ? "screenshot: " + shotUrl + "\n" : "") +
      (out.screenshot ? "⚠ screenshot store FAILED: " + out.screenshot + "\n" : "") +
      (out.sheet ? "⚠ SHEET WRITE FAILED (email is the only record of this one): " + out.sheet + "\n" : "") +
      "\n──── message ────\n" + (message || "(none)") +
      "\n\n──── detail ────\n" + (detail || "(none)");
    var opts = {};
    if (isUser && d.screenshot && !out.screenshot) {
      try {
        var m = String(d.screenshot).match(/^data:(image\/\w+);base64,(.+)$/);
        if (m) opts.attachments = [Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], "screenshot.jpg")];
      } catch (err) {}
    }
    MailApp.sendEmail(MAIL_TO, subj, body, opts);
  } catch (err) { out.email = String(err); }

  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doGet — serve reports as JSON (the /bugs sync feed) ───────────────────────────────────────
// <exec>?s=SECRET            → all reports
// <exec>?s=SECRET&since=ISO  → reports with receivedAt > since (the sync cursor)

function doGet(e) {
  var json = function (o) {
    return ContentService.createTextOutput(JSON.stringify(o))
      .setMimeType(ContentService.MimeType.JSON);
  };
  var secret = props_().getProperty("SECRET");
  if (!secret || !e || !e.parameter || e.parameter.s !== secret) {
    return json({ ok: false, error: "forbidden" });
  }
  try {
    var sh = getSheet_();
    var rows = sh.getDataRange().getValues();
    var head = rows.shift() || [];
    var since = e.parameter.since || "";
    var reports = [];
    for (var i = 0; i < rows.length; i++) {
      var r = {};
      for (var j = 0; j < head.length; j++) r[head[j]] = rows[i][j];
      if (since && String(r.receivedAt) <= since) continue;
      reports.push(r);
    }
    return json({ ok: true, count: reports.length, reports: reports });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// ── AUTHORIZE_DRIVE — one-shot editor run (deploy step 5b) ────────────────────────────────────
// The runtime wraps every DriveApp call in try/catch (correctly — a screenshot must never kill
// the report), which means Google never shows the Drive consent prompt on its own: the exact
// AUTHORIZE_ME bring-up lesson, replayed on the Drive half (found live 2026-07-18 — the 07-18
// deploy had the Sheets scope only, and every screenshot store failed with "You do not have
// permission to call DriveApp.createFolder", visible only in the POST response body).
// Run this once from the editor (▶ Run) and approve the prompt. It creates the screenshots
// folder and self-stores FOLDER_ID. No re-deploy needed — scope grants attach to the script,
// not the deployment. Safe to leave in the file; nothing calls it at runtime.
function AUTHORIZE_DRIVE() {
  var f = getFolder_();
  Logger.log("Drive authorized — screenshots folder: " + f.getUrl());
}
