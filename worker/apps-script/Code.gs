// Pomwik welcome-email sender.
// Deploy as a Web app (Execute as: Me, Who has access: Anyone) from the pomwikapps@gmail.com account.
// The Cloudflare Worker posts JSON to this script; the script mails from this Gmail account.

const SECRET = 'PASTE_YOUR_SECRET_HERE';   // must match the Worker's WELCOME_WEBHOOK_SECRET
const REPLY_TO = 'pomwikapps@gmail.com';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return reply({ ok: false, error: 'forbidden' });

    const to = String(body.to || '');
    if (!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/.test(to)) return reply({ ok: false, error: 'bad_to' });

    MailApp.sendEmail({
      to: to,
      subject: String(body.subject || '').slice(0, 200),
      body: String(body.text || ''),
      htmlBody: String(body.html || ''),
      name: 'Pomwik',
      replyTo: REPLY_TO,
    });
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
