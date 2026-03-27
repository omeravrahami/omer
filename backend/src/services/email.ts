import { env } from "../env";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "WorkClock <noreply@workclock.app>";

async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // Dev mode: log to console instead of sending
    console.log("\n========== EMAIL (DEV MODE) ==========");
    console.log(`TO: ${options.to}`);
    console.log(`SUBJECT: ${options.subject}`);
    console.log("BODY (HTML):", options.html.replace(/<[^>]+>/g, " ").trim());
    console.log("======================================\n");
    return;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[email] Failed to send email: ${response.status} ${body}`);
    throw new Error(`Failed to send email: ${response.status}`);
  }
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  username: string
): Promise<void> {
  const resetLink = `workclock://reset-password?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>איפוס סיסמה - WorkClock</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; direction: rtl; }
    .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #2563eb; padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; }
    .body { padding: 32px; color: #222; }
    .body p { line-height: 1.7; font-size: 16px; }
    .token-box { background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0; }
    .token-box code { font-size: 14px; word-break: break-all; color: #1e40af; font-family: monospace; }
    .btn { display: inline-block; background: #2563eb; color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 8px 0; }
    .footer { padding: 20px 32px; background: #f9fafb; color: #888; font-size: 13px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>WorkClock</h1>
    </div>
    <div class="body">
      <p>שלום ${username || ""},</p>
      <p>קיבלנו בקשה לאיפוס הסיסמה שלך. לחץ על הכפתור למטה כדי לאפס את הסיסמה:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="btn">איפוס סיסמה</a>
      </p>
      <p>אם הכפתור לא עובד, תוכל להעתיק את הקוד הבא ולהזין אותו ידנית באפליקציה:</p>
      <div class="token-box">
        <code>${resetToken}</code>
      </div>
      <p style="color: #888; font-size: 14px;">הקישור תקף למשך שעה אחת. אם לא ביקשת לאפס סיסמה, אנא התעלם ממייל זה.</p>
    </div>
    <div class="footer">
      WorkClock &mdash; ניהול שעות חכם
    </div>
  </div>
</body>
</html>
  `.trim();

  await sendEmail({
    to: email,
    subject: "איפוס סיסמה - WorkClock",
    html,
  });
}

export async function sendEmailVerificationEmail(
  email: string,
  verifyToken: string,
  username: string
): Promise<void> {
  const verifyLink = `workclock://verify-email?token=${verifyToken}`;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>אימות אימייל - WorkClock</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; direction: rtl; }
    .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #16a34a; padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; }
    .body { padding: 32px; color: #222; }
    .body p { line-height: 1.7; font-size: 16px; }
    .token-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0; }
    .token-box code { font-size: 14px; word-break: break-all; color: #15803d; font-family: monospace; }
    .btn { display: inline-block; background: #16a34a; color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 8px 0; }
    .footer { padding: 20px 32px; background: #f9fafb; color: #888; font-size: 13px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>WorkClock</h1>
    </div>
    <div class="body">
      <p>שלום ${username || ""},</p>
      <p>תודה שנרשמת ל-WorkClock! לחץ על הכפתור למטה כדי לאמת את כתובת האימייל שלך:</p>
      <p style="text-align: center;">
        <a href="${verifyLink}" class="btn">אימות אימייל</a>
      </p>
      <p>אם הכפתור לא עובד, תוכל להעתיק את הקוד הבא ולהזין אותו ידנית:</p>
      <div class="token-box">
        <code>${verifyToken}</code>
      </div>
      <p style="color: #888; font-size: 14px;">הקישור תקף למשך 6 שעות.</p>
    </div>
    <div class="footer">
      WorkClock &mdash; ניהול שעות חכם
    </div>
  </div>
</body>
</html>
  `.trim();

  await sendEmail({
    to: email,
    subject: "אימות אימייל - WorkClock",
    html,
  });
}

export async function sendWelcomeEmail(
  email: string,
  username: string
): Promise<void> {
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ברוך הבא ל-WorkClock!</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; direction: rtl; }
    .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #7c3aed; padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; }
    .body { padding: 32px; color: #222; }
    .body p { line-height: 1.7; font-size: 16px; }
    .feature { display: flex; align-items: flex-start; margin: 12px 0; gap: 12px; }
    .feature-icon { font-size: 22px; }
    .footer { padding: 20px 32px; background: #f9fafb; color: #888; font-size: 13px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ברוך הבא ל-WorkClock!</h1>
    </div>
    <div class="body">
      <p>שלום ${username || ""},</p>
      <p>אנחנו שמחים שהצטרפת ל-WorkClock &mdash; האפליקציה החכמה לניהול שעות עבודה.</p>
      <p>מה תוכל לעשות עם WorkClock:</p>
      <div class="feature"><span class="feature-icon">&#9200;</span><span>מעקב אחר שעות עבודה בקלות ובמהירות</span></div>
      <div class="feature"><span class="feature-icon">&#128176;</span><span>חישוב שכר אוטומטי לפי תעריף שעתי</span></div>
      <div class="feature"><span class="feature-icon">&#128202;</span><span>דוחות מפורטים ותובנות על דפוסי העבודה שלך</span></div>
      <div class="feature"><span class="feature-icon">&#9729;</span><span>סנכרון בין מכשירים</span></div>
      <p>בהצלחה!</p>
    </div>
    <div class="footer">
      WorkClock &mdash; ניהול שעות חכם
    </div>
  </div>
</body>
</html>
  `.trim();

  await sendEmail({
    to: email,
    subject: "ברוך הבא ל-WorkClock!",
    html,
  });
}
