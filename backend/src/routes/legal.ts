import { Hono } from "hono";
import { html } from "hono/html";

export const legalRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /delete-account  — public web page required by App Store & Play Store
// ---------------------------------------------------------------------------

legalRoutes.get("/delete-account", (c) => {
  return c.html(html`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>מחיקת חשבון — WorkClock</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #080E1A;
      color: #F0F6FF;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #0F1729;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 36px 32px;
      max-width: 520px;
      width: 100%;
    }
    .logo { font-size: 28px; font-weight: 800; color: #3B82F6; margin-bottom: 8px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 20px; }
    p  { font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.75); margin-bottom: 16px; }
    ul { padding-right: 20px; margin-bottom: 16px; }
    li { font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.75); margin-bottom: 6px; }
    .step {
      background: rgba(59,130,246,0.1);
      border: 1px solid rgba(59,130,246,0.25);
      border-radius: 12px;
      padding: 16px 18px;
      margin-bottom: 12px;
      font-size: 15px;
      line-height: 1.6;
      color: #F0F6FF;
    }
    .step strong { color: #3B82F6; }
    .warn {
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.25);
      border-radius: 12px;
      padding: 14px 18px;
      margin-top: 20px;
      font-size: 14px;
      color: rgba(255,255,255,0.7);
    }
    a { color: #3B82F6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 32px; font-size: 13px; color: rgba(255,255,255,0.35); text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">WorkClock</div>
    <h1>מחיקת חשבון ונתונים</h1>

    <p>ניתן למחוק את החשבון ואת כל הנתונים הקשורים אליו ישירות מתוך האפליקציה, בכמה שניות.</p>

    <div class="step"><strong>שלב 1</strong> — פתח את אפליקציית WorkClock ועבור ל<strong>הגדרות</strong> (אייקון גלגל השיניים).</div>
    <div class="step"><strong>שלב 2</strong> — גלול למטה עד לקטע <strong>אזור מסוכן</strong> ולחץ על <strong>מחיקת חשבון</strong>.</div>
    <div class="step"><strong>שלב 3</strong> — הזן את הסיסמה שלך לאישור, ולחץ <strong>מחק חשבון</strong>.</div>

    <div class="warn">
      ⚠️ המחיקה היא <strong>בלתי הפיכה</strong>. כל נתוני שעות העבודה, ההגדרות, וההיסטוריה יימחקו לצמיתות.
    </div>

    <p style="margin-top:24px;">
      אם אינך יכול לגשת לאפליקציה, שלח בקשה למחיקת נתונים בכתובת:
      <a href="mailto:support@workclock.app">support@workclock.app</a><br />
      נטפל בבקשה בתוך 30 יום.
    </p>
  </div>

  <div class="footer">
    &copy; ${new Date().getFullYear()} WorkClock &nbsp;·&nbsp;
    <a href="/privacy">מדיניות פרטיות</a>
  </div>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// GET /privacy  — public privacy policy web page
// ---------------------------------------------------------------------------

legalRoutes.get("/privacy", (c) => {
  return c.html(html`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>מדיניות פרטיות — WorkClock</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #080E1A;
      color: #F0F6FF;
      min-height: 100vh;
      padding: 32px 24px 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .card {
      background: #0F1729;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 32px;
      max-width: 620px;
      width: 100%;
      margin-bottom: 16px;
    }
    .logo { font-size: 26px; font-weight: 800; color: #3B82F6; margin-bottom: 4px; }
    .updated { font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    h2 { font-size: 16px; font-weight: 700; margin-bottom: 10px; color: #F0F6FF; }
    p  { font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.7); }
    .section {
      background: #0F1729;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 20px;
      max-width: 620px;
      width: 100%;
      margin-bottom: 12px;
    }
    a { color: #3B82F6; }
    .footer { margin-top: 24px; font-size: 13px; color: rgba(255,255,255,0.35); text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">WorkClock</div>
    <h1>מדיניות פרטיות</h1>
    <div class="updated">עדכון אחרון: מרץ 2026</div>
    <p>WorkClock מחויבת להגנה על פרטיותך. מסמך זה מסביר אילו נתונים אנחנו אוספים, כיצד אנחנו משתמשים בהם, ואיך אנחנו שומרים עליהם.</p>
  </div>

  <div class="section"><h2>מה אנחנו אוספים</h2><p>האפליקציה שומרת את נתוני שעות העבודה, ההפסקות, ושיעור השכר שלך. הנתונים מאוחסנים במכשיר שלך ובשרת מאובטח, ומקושרים לחשבון המשתמש האישי שלך.</p></div>
  <div class="section"><h2>איך אנחנו משתמשים במידע</h2><p>המידע משמש אך ורק להצגת נתוני שכר וסטטיסטיקות בתוך האפליקציה. אנחנו לא מוכרים, מעבירים, או חולקים את המידע שלך עם צדדים שלישיים.</p></div>
  <div class="section"><h2>אחסון ואבטחה</h2><p>הנתונים מוצפנים בעת העברה (HTTPS). נתוני ההגדרות נשמרים גם מקומית במכשיר באמצעות AsyncStorage.</p></div>
  <div class="section"><h2>פרסומות</h2><p>גרסת החינמית מציגה פרסומות דרך ספקי פרסום מורשים. ספקים אלה עשויים לאסוף מידע אנונימי כדי להציג פרסומות רלוונטיות, בהתאם למדיניות הפרטיות שלהם.</p></div>
  <div class="section"><h2>מחיקת נתונים</h2><p>ניתן למחוק את כל הנתונים ואת החשבון בכל עת דרך הגדרות האפליקציה ← "מחיקת חשבון". לחלופין, <a href="/delete-account">לחץ כאן להוראות מחיקה</a> או פנה אלינו בכתובת <a href="mailto:support@workclock.app">support@workclock.app</a>.</p></div>
  <div class="section"><h2>יצירת קשר</h2><p>לשאלות בנושא פרטיות: <a href="mailto:support@workclock.app">support@workclock.app</a></p></div>

  <div class="footer">
    &copy; ${new Date().getFullYear()} WorkClock &nbsp;·&nbsp;
    <a href="/delete-account">מחיקת חשבון</a>
  </div>
</body>
</html>`);
});
