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
