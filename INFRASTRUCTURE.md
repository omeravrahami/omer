# WorkClock — Infrastructure Connection Guide

Full checklist for connecting all external services to a production environment.
Run through this top-to-bottom once your accounts are ready.

---

## 1. GitHub

**Goal:** Push code to GitHub so CI runs on every commit.

```bash
# One-time setup (run locally):
git remote add origin https://github.com/YOUR_ORG/workclock.git
git push -u origin main
```

CI/CD is already configured at `.github/workflows/ci.yml`.
It runs backend type-checks and tests on every push/PR to `main`.

---

## 2. Supabase (PostgreSQL Database)

**Goal:** Switch from SQLite (dev) to Supabase PostgreSQL (production).

### Step 1 — Create Supabase project
1. Go to [supabase.com](https://supabase.com) → New project
2. Copy the **Connection string** (Transaction pooler, port 6543)
   - Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

### Step 2 — Update Prisma schema
In `backend/prisma/schema.prisma`, change line 6:
```diff
-  provider = "sqlite"
+  provider = "postgresql"
```

### Step 3 — Set environment variables
In the Vibecode ENV tab (or your hosting env vars), set:
```
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```
Also update `backend/.env` locally for testing.

### Step 4 — Run migrations
```bash
cd backend
bunx prisma db push
```
This creates all tables on Supabase. For future schema changes:
```bash
bunx prisma migrate dev --name describe-change
```

### Step 5 — Seed initial app config (first deploy only)
```bash
curl -X POST $BACKEND_URL/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_SETUP_SECRET","email":"admin@yourdomain.com","password":"strong-password"}'
```

---

## 3. Hosting (Backend)

**Goal:** Deploy the Hono backend to a public URL.

### Option A: Vibecode Deploy (easiest)
Click **Deploy** in the Vibecode top-right menu. Done.

### Option B: Railway / Render / Fly.io
1. Connect your GitHub repo
2. Set build command: `bun install`
3. Set start command: `bun run src/index.ts`
4. Set environment variables (see section below)
5. Set `BACKEND_URL` to your deployed URL

### Required env vars for production:
| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (or platform default) |
| `BACKEND_URL` | `https://api.yourdomain.com` |
| `DATABASE_URL` | Supabase connection string |
| `SETUP_SECRET` | Strong random string (first admin creation) |
| `RESEND_API_KEY` | Your Resend key (email sending) |
| `SENTRY_DSN` | Your Sentry DSN (error tracking) |
| `ALLOWED_ORIGINS` | `https://yourdomain.com` (if custom domain) |
| `LOG_LEVEL` | `info` |

### Update mobile app to point to new backend:
In Vibecode ENV tab, set:
```
EXPO_PUBLIC_BACKEND_URL=https://api.yourdomain.com
```

---

## 4. Sentry (Error Monitoring)

### Backend
1. Create project at [sentry.io](https://sentry.io) → Platform: **Node.js**
2. Copy the DSN
3. Set in hosting env vars:
   ```
   SENTRY_DSN=https://xxxxx@oXXXXX.ingest.sentry.io/XXXXXXX
   ```
4. Sentry is already initialized in `backend/src/lib/sentry.ts` — it activates automatically when DSN is set.

### Mobile (React Native)
The crash reporter stub is in `mobile/src/lib/crash-reporter.ts`.
To activate:
1. Create project at sentry.io → Platform: **React Native**
2. In Vibecode ENV tab, add:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://xxxxx@oXXXXX.ingest.sentry.io/XXXXXXX
   ```
3. In `mobile/src/lib/crash-reporter.ts`, uncomment the Sentry lines (already written for you).
4. Publish a new build via Vibecode.

> Note: Sentry React Native requires a native build. Cannot be tested in Expo Go.

---

## 5. AdMob (Ads)

The AdMob infrastructure is already wired. To activate:

1. Create AdMob account → Add iOS app → Add Android app
2. For each platform, create ad units:
   - Banner
   - Interstitial
   - Rewarded

3. In Vibecode ENV tab, add:
   ```
   EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
   EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
   EXPO_PUBLIC_ADMOB_REWARDED_ID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
   ```

4. In `mobile/app.json`, add AdMob App ID under plugins:
   ```json
   [
     "react-native-google-mobile-ads",
     {
       "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX",
       "iosAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"
     }
   ]
   ```

5. In `mobile/src/lib/ads/index.ts`, set `enabled: true`.

6. Publish a new build via Vibecode.

---

## 6. App Store Accounts

### Apple App Store
- Bundle ID: `com.workclock.app`
- App name: WorkClock
- Click **Share → Submit to App Store** in Vibecode app

### Google Play
- Package name: `com.workclock.app`
- React Native supports Android — contact Vibecode for Android build support

---

## 7. RevenueCat (Premium Subscriptions)

The RevenueCat SDK (`react-native-purchases`) is already installed.

1. Go to the **Payments** tab in the Vibecode app → click **Setup Project**
2. Follow the RevenueCat setup flow — Vibecode handles the rest automatically

---

## 8. Email (Resend)

For password reset and email verification emails:

1. Create account at [resend.com](https://resend.com)
2. Add your domain and verify DNS records
3. Create API key
4. Set in hosting env vars:
   ```
   RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXXXXXXXX
   ```

---

## Quick Verification Checklist

After connecting each service, verify:

- [ ] `GET $BACKEND_URL/health` returns `{"status":"ok"}`
- [ ] Register a new user and receive welcome email
- [ ] Login works and returns session token
- [ ] Admin login works at `/api/admin`
- [ ] Supabase dashboard shows rows in `User` table
- [ ] Sentry receives a test error (throw in `/health` temporarily)
- [ ] App Store connect shows the app
- [ ] AdMob dashboard shows test ad requests
- [ ] RevenueCat shows test purchase event

---

## Environment Variables Reference

### Backend (`backend/.env`)

```env
PORT=3000
NODE_ENV=production
BACKEND_URL=https://api.yourdomain.com
DATABASE_URL=postgresql://...supabase.com.../postgres
RESEND_API_KEY=re_...
SETUP_SECRET=<strong-random-string>
LOG_LEVEL=info
SENTRY_DSN=https://...@sentry.io/...
ALLOWED_ORIGINS=https://yourdomain.com
```

### Mobile (Vibecode ENV tab)

```env
EXPO_PUBLIC_BACKEND_URL=https://api.yourdomain.com
EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-...
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-...
EXPO_PUBLIC_ADMOB_REWARDED_ID=ca-app-pub-...
```
