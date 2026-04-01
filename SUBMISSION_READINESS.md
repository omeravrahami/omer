# App Store Submission Readiness

## Summary

The code is ready for submission. What remains is account setup and asset preparation — nothing that requires code changes.

---

## ✅ Already Done in Code

### Auth Flows
- [x] Login (email or username + password)
- [x] Register (email, password, optional username)
- [x] Forgot password (email → reset link)
- [x] Reset password (token-based, deep link: `vibecode://reset-password?token=...`)
- [x] Change password (logged-in users)
- [x] Logout
- [x] Delete account (password confirmation, full data wipe)
- [x] Session management (view active sessions, revoke)

### Legal & Privacy
- [x] Privacy screen in app (`/privacy`)
- [x] Privacy policy route on backend (`/privacy-policy`)
- [x] Terms of service route on backend (`/terms-of-service`)
- [x] Account deletion flow (in-app + public endpoint for compliance)
- [x] `/api/auth/request-account-deletion` — public endpoint (App Store requirement)

### Deep Links
- [x] `vibecode://reset-password?token=...` — used in password reset emails
- [x] `vibecode://verify-email?token=...` — used in email verification emails
- [x] App slug registered: `workclock`

### App Configuration
- [x] Bundle ID: `com.workclock.app` (iOS + Android)
- [x] Version: `1.0.0`
- [x] Portrait orientation lock
- [x] Hebrew RTL support
- [x] Dark mode support

---

## ⚠️ Needs Configuration Before Submission

### 1. Privacy Policy URL
The backend serves a privacy policy at `/privacy-policy`. You need to:
- Deploy the backend to a permanent URL
- Submit that URL in App Store Connect: `https://your-domain.com/privacy-policy`

### 2. Account Deletion URL
Required by App Store since 2023. Use:
- In-app: the delete account screen is already present
- Web fallback: `https://your-domain.com/api/auth/request-account-deletion`
  (public endpoint that returns success — actual deletion is done in-app)

### 3. Support Email
Default is `support@workclock.app` (set in AppConfig). Update via admin panel or change default in `backend/src/routes/admin.ts` under `DEFAULT_CONFIGS`.

### 4. App Icons
Required sizes:
- iOS: 1024×1024 (App Store), various smaller sizes
- Android: 512×512 (Play Store), adaptive icons
- Generate from a master 1024×1024 PNG using EAS or expo-image-picker

### 5. App Store Screenshots
Required: iPhone 6.5", 5.5", iPad 12.9" (if iPad supported)
Recommended: 3-5 screenshots per device showing key features.

### 6. AdMob (if using ads)
- Set up AdMob account before submission
- Apple requires AdMob App ID in `app.json` for iOS builds
- See `ADS_SETUP.md` for full instructions

---

## 📋 What to Fill in App Store Connect / Google Play Console

### App Store Connect (iOS)
| Field | Value |
|-------|-------|
| App Name | WorkClock |
| Bundle ID | com.workclock.app |
| Primary Language | Hebrew |
| Category | Finance or Productivity |
| Privacy Policy URL | `https://your-domain.com/privacy-policy` |
| Support URL | `https://your-domain.com` or email |
| Marketing URL | optional |
| Age Rating | 4+ (no objectionable content) |
| Data collection | Declare: Email address (account login), Usage data (analytics) |

### Google Play Console
| Field | Value |
|-------|-------|
| Package Name | com.workclock.app |
| Category | Finance |
| Privacy Policy URL | `https://your-domain.com/privacy-policy` |
| Target Audience | Everyone |
| Data Safety | Declare email/usage data collection |

---

## 📝 App Store Description (draft)

**Short description:**
Track your work hours and calculate your salary instantly.

**Full description:**
WorkClock is the smart work hours tracker for Israeli employees. Clock in and out with one tap, automatically calculate your gross and net salary, and see your tax breakdown in real time.

Features:
• One-tap clock in/out with break tracking
• Automatic Israeli salary calculation (gross, net, tax)
• Support for bonuses, benefits, car allowance, and more
• Weekly and monthly reports
• Dark mode and Hebrew (RTL) support
• Premium: unlimited history and advanced analytics

---

## 🔒 Permissions Declaration

The app currently requests NO special permissions (no camera, location, contacts, etc.).

If you add features later:
- Notifications → add to Info.plist + AndroidManifest
- Camera → add expo-camera permission

---

## 🔑 Required Accounts Before Submission

| Account | Status | Notes |
|---------|--------|-------|
| Apple Developer Account | Needs setup | $99/year |
| Google Play Developer Account | Needs setup | $25 one-time |
| AdMob Account | Needs setup | Free, needs real ads |
| Sentry Account | Optional | Free tier available |
| Resend Account | Needs setup | Free tier: 3000 emails/month |
| Backend Hosting | Needs setup | Railway/Render/Fly.io |
| PostgreSQL Database | Needs setup | Replace SQLite for production |

---

## 🔄 Pre-Submission Checklist

- [ ] Backend deployed to production URL
- [ ] `DATABASE_URL` updated to PostgreSQL
- [ ] `SETUP_SECRET` set to a secure random value
- [ ] Admin account created via `/api/admin/setup`
- [ ] `RESEND_API_KEY` set (for password reset emails)
- [ ] `EXPO_PUBLIC_BACKEND_URL` updated in mobile ENV
- [ ] App icons uploaded
- [ ] Screenshots prepared
- [ ] Privacy policy URL working
- [ ] Account deletion tested end-to-end
- [ ] Password reset email tested
- [ ] AdMob App ID added to `app.json` (if using ads)
- [ ] EAS Build submitted through Vibecode publish flow
