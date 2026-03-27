# WorkClock - מסמך מערכת לעלייה לאוויר

**תאריך:** מרץ 2026
**גרסה:** 1.0.0 Production Ready
**פלטפורמה:** iOS (ראשי), Android (נתמך), Web (נתמך חלקית)

---

## 1. שירותים מחוברים

| שירות | תפקיד | ניהול |
|--------|--------|--------|
| **Vibecode Backend** | שרת API (Hono + Bun) | Vibecode Platform |
| **SQLite via Prisma** | בסיס נתונים | `/backend/prisma/dev.db` |
| **Expo EAS** | Build & Deploy לאפסטור | Vibecode Publish |
| **AdMob** (ממתין) | פרסומות | לאחר אישור App Store |

---

## 2. טבלאות בבסיס הנתונים

| טבלה | תיאור | שדות מרכזיים |
|-------|--------|--------------|
| `User` | חשבונות משתמשים | id, email, username, passwordHash, role, status, lastLoginAt, isEmailVerified |
| `UserSession` | טוקני אימות | id, userId, token, deviceName, platform, lastSeenAt, isActive, expiresAt |
| `UserSettings` | הגדרות לפי משתמש | userId, hourlyRate, currency, dailyGoalHours, themeMode |
| `Settings` | הגדרות לפי מכשיר (אורח) | deviceId, hourlyRate, currency, isPro |
| `WorkSession` | משמרות עבודה | id, deviceId, date, startTime, endTime, netMinutes, totalPay, sessionType |
| `BreakSession` | הפסקות בתוך משמרת | id, workSessionId, startTime, endTime, durationMinutes |
| `PasswordResetToken` | טוקני איפוס סיסמה | id, userId, token, expiresAt, usedAt |
| `AppConfig` | הגדרות מערכת גלובליות | key, value, description, updatedAt |

---

## 3. Roles (תפקידים) במערכת

| Role | ערך בDB | הרשאות |
|------|---------|--------|
| **USER** | `"USER"` | גישה לנתונים של עצמו בלבד |
| **ADMIN** | `"ADMIN"` | גישה לכל ה-API של `/api/admin/*`, ניהול משתמשים, הגדרות מערכת |

### סטטוסים של משתמש

| Status | ערך | משמעות |
|--------|-----|--------|
| **ACTIVE** | `"ACTIVE"` | משתמש פעיל, יכול להתחבר |
| **SUSPENDED** | `"SUSPENDED"` | מושהה זמנית, לא יכול להתחבר |
| **DISABLED** | `"DISABLED"` | חשבון מבוטל |

---

## 4. Environment Variables

### Backend (`backend/.env`)
```
PORT=3000
NODE_ENV=production
BACKEND_URL=https://your-backend-url.vibecode.run
```

### Mobile (`mobile/.env`)
```
EXPO_PUBLIC_BACKEND_URL=https://your-backend-url.vibecode.run
EXPO_PUBLIC_EXAMPLE_ENV_VAR=example
```

> **חשוב:** הוסף משתנים חדשים דרך לשונית ENV בפלטפורמת Vibecode.

---

## 5. כניסה לאדמין

### יצירת האדמין הראשון (חד-פעמי)

```bash
curl -X POST $BACKEND_URL/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@workclock.app",
    "password": "Admin123!",
    "username": "admin"
  }'
```

הפקודה עובדת **רק פעם אחת** (כשאין עדיין אדמין במערכת).
הפלט יכלול `token` לכניסה מיידית.

### כניסה לאדמין באפליקציה
1. התחבר עם האימייל/שם משתמש של האדמין
2. עבור ל-**הגדרות** (לשונית תחתונה)
3. יופיע כפתור **"לוח בקרה לאדמין"**
4. לחץ עליו לכניסה ללוח הבקרה

---

## 6. ניהול משתמשים

### דרך לוח הבקרה (מומלץ)
- **רשימת משתמשים:** אדמין > משתמשים
- **חסימה/שחרור:** פרופיל משתמש > שנה סטטוס
- **שינוי תפקיד:** פרופיל משתמש > שנה תפקיד
- **ניתוק מכשירים:** פרופיל משתמש > נתק כל המכשירים
- **איפוס סיסמה:** פרופיל משתמש > אפס סיסמה (מקבל טוקן)

### דרך API (למפתחים)
```bash
# רשימת משתמשים
GET /api/admin/users?page=1&limit=20&search=email@domain.com

# עדכון סטטוס
PUT /api/admin/users/:id
Body: { "status": "SUSPENDED" }

# עדכון תפקיד
PUT /api/admin/users/:id
Body: { "role": "ADMIN" }

# ניתוק כל הסשנים
DELETE /api/admin/users/:id/sessions
```

---

## 7. Flow שחזור סיסמה

### מצד המשתמש:
1. לחץ "שכחתי סיסמה" במסך ההתחברות
2. הזן אימייל
3. לחץ "שלח קישור איפוס"
4. **בסביבת פיתוח:** קוד הטוקן מוצג ישירות במסך
5. **בסביבת ייצור:** יישלח קישור למייל (דורש שילוב SMTP/SendGrid)
6. הזן טוקן + סיסמה חדשה
7. כניסה חוזרת לאפליקציה

### כ-Admin:
```bash
# יצירת טוקן איפוס עבור משתמש
POST /api/admin/users/:id/reset-password
Response: { "data": { "resetToken": "abc123...", "expiresAt": "2026-03-28T..." } }
```

> **⚠️ הערה:** לייצור אמיתי יש לחבר שירות שליחת מיילים (SendGrid, Mailgun, Resend).
> הוסף את ה-API key דרך לשונית ENV, ועדכן `/backend/src/routes/auth.ts` לשלוח מייל אמיתי.

---

## 8. הגדרות מערכת (AppConfig)

הגדרות שאפשר לשנות **בלי לשנות קוד**:

| Key | ברירת מחדל | תיאור |
|-----|-----------|--------|
| `tip_percentage` | `12` | אחוז טיפ ברירת מחדל |
| `min_wage` | `32.30` | שכר מינימום לשעה (ש"ח) |
| `vat_rate` | `18` | אחוז מע"מ |
| `app_name` | `WorkClock` | שם האפליקציה |
| `support_email` | `support@workclock.app` | מייל תמיכה |

### עדכון הגדרה:
```bash
PUT /api/admin/config/min_wage
Header: Authorization: Bearer <admin-token>
Body: { "value": "33.00", "description": "Updated minimum wage" }
```

או דרך לוח הבקרה: **אדמין > הגדרות מערכת**

---

## 9. Deploy (עלייה לאוויר)

### שלב 1: Backend
- Backend עולה אוטומטית דרך פלטפורמת Vibecode
- לחץ **Deploy** בפינה הימנית העליונה של Vibecode

### שלב 2: Mobile App
1. לחץ על לשונית **Publish** בפלטפורמת Vibecode
2. בחר Build ל-iOS או Android
3. לאחר Build: שלח ל-App Store Connect / Google Play Console

### שלב 3: לאחר Deploy
1. הרץ את פקודת יצירת האדמין הראשון (ראה סעיף 5)
2. וודא שה-AppConfig הוגדר כראוי
3. בדוק שהאפליקציה מתחברת לBackend הנכון

---

## 10. בדיקת Logs

### Backend Logs:
```bash
# קריאה ישירה
cat /home/user/workspace/backend/server.log

# בVibecode - לשונית LOGS
```

### Mobile Logs:
```bash
# בVibecode - לשונית LOGS
# או קובץ:
cat /home/user/workspace/mobile/expo.log
```

---

## 11. QA Checklist - לפני עלייה לאוויר

### אימות ✅
- [ ] הרשמה עם אימייל + סיסמה
- [ ] הרשמה עם שם משתמש
- [ ] התחברות עם אימייל
- [ ] התחברות עם שם משתמש
- [ ] שכחתי סיסמה - שליחת טוקן
- [ ] איפוס סיסמה עם טוקן
- [ ] התנתקות
- [ ] מצב אורח (guest mode)
- [ ] שגיאה: משתמש מושהה
- [ ] שגיאה: אימייל כבר קיים

### הרשאות ✅
- [ ] משתמש רגיל לא רואה כפתור "לוח בקרה לאדמין"
- [ ] אדמין רואה כפתור "לוח בקרה לאדמין"
- [ ] ניסיון גישה ל-/api/admin/* ללא אדמין → 403
- [ ] ניסיון גישה ל-/api/admin/* ללא טוקן → 401

### פונקציונליות ✅
- [ ] הפעלת שעון (start shift)
- [ ] עצירת שעון (end shift)
- [ ] הוספת הפסקה
- [ ] עריכת משמרת ידנית
- [ ] מחיקת משמרת
- [ ] היסטוריה לפי חודש
- [ ] דוחות שבועיים/חודשיים
- [ ] חישוב שכר ברוטו/נטו
- [ ] חישוב שווי שימוש ברכב
- [ ] חישוב גיפט קארד / ספיבוס
- [ ] בונוס וגילום מס

### לוח בקרה Admin ✅
- [ ] רשימת משתמשים
- [ ] חיפוש משתמש
- [ ] חסימת משתמש
- [ ] שחרור חסימה
- [ ] שינוי תפקיד
- [ ] איפוס סיסמה
- [ ] ניתוק מכשירים
- [ ] עדכון הגדרות מערכת
- [ ] סטטיסטיקות מערכת

### UI/UX ✅
- [ ] RTL תקין בכל המסכים
- [ ] Dark mode עובד
- [ ] Empty states - אין נתונים
- [ ] Loading states
- [ ] Error states
- [ ] Toast notifications
- [ ] הודעות שגיאה בעברית
- [ ] ולידציות טפסים
- [ ] Haptic feedback

### אבטחה ✅
- [ ] סיסמאות לא נשמרות ב-plain text (bcrypt ✅)
- [ ] API Keys לא בקוד לקוח
- [ ] הרשאות Admin מוגנות
- [ ] Session expires אחרי 30 יום
- [ ] איפוס סיסמה מבטל כל הסשנים
- [ ] Environment variables מוגנות

---

## 12. תחזוקה שוטפת

### ניקוי Sessions ישנים
Sessions פגי תוקף (30 יום) מנוקים אוטומטית בכל בקשת auth.
לניקוי ידני:
```sql
-- דרך Prisma Studio (bunx prisma studio)
DELETE FROM UserSession WHERE expiresAt < datetime('now')
```

### גיבוי Database
```bash
cp /home/user/workspace/backend/prisma/dev.db backup_$(date +%Y%m%d).db
```

### בדיקת בריאות המערכת
```bash
curl $BACKEND_URL/health
# Response: {"status":"ok"}
```

---

## 13. ארכיטקטורה כוללת

```
User (iOS/Android)
    │
    ▼
Expo App (React Native 0.79)
    │ HTTPS + Bearer Token
    ▼
Hono API Server (Bun, Port 3000)
    │ Prisma ORM
    ▼
SQLite Database (dev.db)
```

**State Management:**
- React Query → Server state (sessions, settings, stats)
- Zustand + AsyncStorage → Local state (auth, preferences)

**Auth Flow:**
1. Register/Login → Token (30 days)
2. Token stored in AsyncStorage
3. Every API call sends `Authorization: Bearer <token>`
4. Server validates token + checks user status + updates lastSeenAt

---

*מסמך זה עודכן אוטומטית. לשאלות, פנה דרך לוח הבקרה.*
