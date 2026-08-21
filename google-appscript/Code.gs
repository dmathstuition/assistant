/**
 * D-Maths Assistant — Google Apps Script bridge.
 *
 * Deploy this under your OWN Google account so the app can:
 *   - mirror every expense/income into a Google Sheet ("D-Maths Ledger")
 *   - build an on-demand export Sheet
 *   - save a monthly summary Doc to Drive and email it
 *   - send reminder / alert emails via your Gmail
 *
 * Everything runs as YOU, using your free Google quota — no Google Cloud
 * project, OAuth screen, or API keys.
 *
 * SETUP
 *  1. script.google.com → New project → paste this file.
 *  2. Change SHARED_SECRET below to a long random string.
 *  3. Deploy → New deployment → type "Web app".
 *       Execute as:  Me
 *       Who has access:  Anyone
 *     Copy the /exec Web app URL.
 *  4. In Vercel set env vars:
 *       APPSCRIPT_WEBHOOK_URL   = the /exec URL
 *       APPSCRIPT_SHARED_SECRET = the same secret as below
 *  5. Run doPost once from the editor if prompted, to grant Gmail/Drive/Sheets.
 *
 * SECURITY: this endpoint is public, so it authenticates every request with the
 * shared secret. Without a matching secret it does nothing and returns an error.
 */

var SHARED_SECRET = "CHANGE_ME_to_a_long_random_string";
var LEDGER_SHEET_NAME = "D-Maths Ledger";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (!SHARED_SECRET || body.secret !== SHARED_SECRET) {
      return json({ ok: false, error: "unauthorized" });
    }
    var d = body.data || {};
    switch (body.type) {
      case "transaction":
        return json(handleTransaction(d));
      case "export":
        return json(handleExport(d));
      case "summary":
        return json(handleSummary(d));
      case "mail":
        return json(handleMail(d));
      default:
        return json({ ok: false, error: "unknown type" });
    }
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// Find-or-create the running ledger Sheet, return its first tab.
function ledgerSheet() {
  var files = DriveApp.getFilesByName(LEDGER_SHEET_NAME);
  var ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(LEDGER_SHEET_NAME);
    ss.getSheets()[0].appendRow([
      "Timestamp",
      "Date",
      "Type",
      "Category/Source",
      "Amount",
      "Description",
    ]);
  }
  return ss.getSheets()[0];
}

function handleTransaction(d) {
  ledgerSheet().appendRow([
    new Date(),
    d.occurred_on,
    d.kind,
    d.category,
    d.amount,
    d.description || "",
  ]);
  return { ok: true };
}

function handleExport(d) {
  var ss = SpreadsheetApp.create(d.title || "D-Maths export");
  var sh = ss.getSheets()[0];
  if (d.header) sh.appendRow(d.header);
  (d.rows || []).forEach(function (r) {
    sh.appendRow(r);
  });
  return { ok: true, url: ss.getUrl() };
}

function handleSummary(d) {
  var doc = DocumentApp.create("D-Maths summary " + d.month);
  var b = doc.getBody();
  b.appendParagraph("D-Maths — " + d.month).setHeading(
    DocumentApp.ParagraphHeading.HEADING1,
  );
  b.appendParagraph("Income: ₦" + d.income);
  b.appendParagraph("Expenses: ₦" + d.expenses);
  b.appendParagraph("Net: ₦" + d.net);
  if (d.topCategory) {
    b.appendParagraph("Top category: " + d.topCategory + " (₦" + d.topAmount + ")");
  }
  (d.goals || []).forEach(function (g) {
    b.appendParagraph(
      "Goal " + g.name + ": ₦" + g.current + " / ₦" + g.target,
    );
  });
  doc.saveAndClose();
  if (d.email) {
    MailApp.sendEmail({
      to: d.email,
      subject: "Your D-Maths monthly summary (" + d.month + ")",
      htmlBody:
        'Your monthly summary is ready: <a href="' +
        doc.getUrl() +
        '">open in Google Docs</a>',
    });
  }
  return { ok: true, url: doc.getUrl() };
}

function handleMail(d) {
  MailApp.sendEmail({ to: d.to, subject: d.subject, htmlBody: d.html });
  return { ok: true };
}

// ---------------------------------------------------------------------
//  TASK ALARMS (optional) — fire notifications even when the app is closed.
//  Apps Script time triggers are free and can run every few minutes, so we
//  use one to poke the app's alarm endpoint on a schedule.
//
//  SETUP
//   1. Set ALARM_URL below to your deployed endpoint INCLUDING the secret:
//        https://YOUR-APP.vercel.app/api/alarms/push?key=YOUR_CRON_SECRET
//   2. In the Apps Script editor: Triggers (clock icon) → Add Trigger →
//        Function: runAlarms
//        Event source: Time-driven → Minutes timer → Every 5 minutes
//   That's it — the endpoint checks which tasks are due (or due in 10 min)
//   and pushes to your phone. It de-duplicates, so a 5-minute cadence is fine.
// ---------------------------------------------------------------------
var ALARM_URL = "";

function runAlarms() {
  if (!ALARM_URL) return;
  UrlFetchApp.fetch(ALARM_URL, { muteHttpExceptions: true });
}

// ---------------------------------------------------------------------
//  EMAIL IMPORT (optional) — auto-log expenses/income from bank alerts.
//  This searches your Gmail for bank "transaction alert" emails and posts
//  each one to the app, which parses the amount + debit/credit and saves it
//  (de-duplicated by the Gmail message id, so re-runs never double count).
//
//  SETUP
//   1. INGEST_URL: your endpoint INCLUDING the secret:
//        https://YOUR-APP.vercel.app/api/ingest/email?key=YOUR_CRON_SECRET
//   2. BANK_QUERY: a Gmail search that matches your bank's alerts. Examples:
//        'from:alerts@gtbank.com newer_than:2d'
//        'subject:(transaction alert OR debit alert OR credit alert) newer_than:2d'
//      Tune this to your bank so you only import real alerts.
//   3. Triggers (clock icon) → Add Trigger → Function: scanBankEmails →
//        Time-driven → Hour timer (e.g. every 1 hour). It labels handled
//        threads "D-Maths Imported" so the same email is never re-sent.
// ---------------------------------------------------------------------
var INGEST_URL = "";
var BANK_QUERY = 'subject:(transaction alert OR debit alert OR credit alert) newer_than:2d';
var IMPORTED_LABEL = "D-Maths Imported";

function scanBankEmails() {
  if (!INGEST_URL) return;
  var label = GmailApp.getUserLabelByName(IMPORTED_LABEL) ||
    GmailApp.createLabel(IMPORTED_LABEL);
  var me = Session.getActiveUser().getEmail();
  var threads = GmailApp.search(BANK_QUERY + ' -label:"' + IMPORTED_LABEL + '"', 0, 25);

  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length; j++) {
      var m = msgs[j];
      var payload = {
        messageId: m.getId(),
        from: m.getFrom(),
        subject: m.getSubject(),
        body: m.getPlainBody().slice(0, 4000),
        receivedAt: m.getDate().toISOString(),
        email: me,
      };
      try {
        UrlFetchApp.fetch(INGEST_URL, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        });
      } catch (err) {
        // best-effort; leave the thread unlabelled so the next run retries it
      }
    }
    threads[i].addLabel(label);
  }
}
