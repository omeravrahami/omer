# WorkClock — Production Handoff Document

> Last updated: 2026-03-27 | Version: 1.0.0

---

## 1. Project Overview

**WorkClock** is an Israeli mobile app for time tracking and salary calculation.
Stack: Expo React Native (iOS) + Hono/Bun backend + SQLite via Prisma.

---

## 2. Repository Structure

```
/workspace
  mobile/          — Expo SDK 53 app (React Native 0.76.7)
  backend/         — Hono 4.6 API server (Bun runtime)
  CLAUDE.md        — AI assistant instructions
  README.md        — Developer readme
```

---

## 3. Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | — | `production` in prod |
| `BACKEND_URL` | No | `http://localhost:3000` | Public URL of backend |
| `RESEND_API_KEY` | No | — | Email service (password reset) |
| `OPENAI_API_KEY` | No | — | If AI features are used |

### Mobile (`mobile/.env` or Vibecode ENV tab)

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | Yes | Full URL of deployed backend |

> Set `EXPO_PUBLIC_BACKEND_URL` in the Vibecode ENV tab before publishing.

---

## 4. Database Schema

Database: **SQLite** at `backend/prisma/dev.db`
ORM: **Prisma 5.22**

### Tables

#### `User`
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| email | String | Unique |
| username | String? | Unique, optional |
| passwordHash | String | bcrypt cost 12 |
| role | String | `USER` or `ADMIN` |
| status | String | `ACTIVE` or `SUSPENDED` |
| lastLoginAt | DateTime? | — |
| isEmailVerified | Boolean | Default false |
| createdAt / updatedAt | DateTime | Auto-managed |

#### `UserSession`
Token-based auth sessions (30-day TTL).
| Column | Notes |
|---|---|
| token | UUID, unique — sent as Bearer header |
| expiresAt | Auto-expires after 30 days |
| deviceName, platform | Device info for admin view |
| isActive | Can be revoked |

#### `UserSettings`
Per-user cloud settings (synced from device on registration).
| Column | Default | Notes |
|---|---|---|
| hourlyRate | 50 | ₪/hour |
| currency | ILS | — |
| dailyGoalHours | 8 | — |
| weeklyGoalHours | 40 | — |
| defaultBreakMinutes | 30 | — |
| themeMode | dark | — |

#### `Settings`
Guest/device-only settings (no account required).
| Column | Notes |
|---|---|
| deviceId | Unique device identifier |
| isPro | Reserved for future monetization |

#### `WorkSession`
Time tracking records — stored by `deviceId`.
| Column | Notes |
|---|---|
| deviceId | Device that created the record |
| date | YYYY-MM-DD |
| startTime / endTime | Timestamps |
| grossMinutes / breakMinutes / netMinutes | Computed durations |
| totalPay | Gross pay for session |
| sessionType | `shift`, `sick`, or `vacation` |
| status | `active` or `completed` |

#### `BreakSession`
Break intervals within a WorkSession (cascade delete).

#### `AppConfig`
Key-value store for system configuration (admin-controlled).

#### `PasswordResetToken`
Temporary tokens for password reset / email verification.

---

## 5. API Routes

All routes return `{ data: ... }` envelope except `/api/auth/*`.

### Auth (`/api/auth/*`)
Handled by custom auth layer in `backend/src/routes/auth.ts`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Create account |
| POST | `/api/auth/login` | None | Login → returns token |
| POST | `/api/auth/logout` | Bearer | Invalidate session |
| GET | `/api/auth/me` | Bearer | Get current user |
| PUT | `/api/auth/user-settings` | Bearer | Sync settings from device |
| POST | `/api/auth/change-password` | Bearer | Change password |
| DELETE | `/api/auth/account` | Bearer | Delete account + data |
| GET | `/api/auth/sessions` | Bearer | List active sessions |
| DELETE | `/api/auth/sessions/:id` | Bearer | Revoke session |

### WorkClock (`/` prefix)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/work-sessions` | Device | List sessions for device |
| POST | `/api/work-sessions` | Device | Create session |
| PUT | `/api/work-sessions/:id` | Device | Update session |
| DELETE | `/api/work-sessions/:id` | Device | Delete session |
| GET | `/api/settings` | Device | Get device settings |
| PUT | `/api/settings` | Device | Update device settings |

### Admin (`/api/admin/*`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/users` | Admin | List all users |
| GET | `/api/admin/users/:id` | Admin | User detail |
| POST | `/api/admin/users/:id/suspend` | Admin | Suspend user |
| DELETE | `/api/admin/users/:id` | Admin | Delete user |
| GET | `/api/admin/stats` | Admin | System stats |

### Health
```
GET /health → { status: "ok" }
```

---

## 6. Security

| Layer | Implementation |
|---|---|
| Password hashing | bcryptjs, cost factor **12** |
| Session tokens | UUID v4, 30-day expiry, stored in DB |
| Input validation | Zod schemas on all routes |
| Rate limiting | Built-in Hono middleware |
| CORS | Explicit allowlist (no wildcard with credentials) |
| Admin access | Role check middleware (`role === 'ADMIN'`) |
| SQL injection | Prisma ORM — no raw queries |

**To create first admin user:**
```bash
# In backend directory:
bunx prisma studio
# Or via direct DB:
sqlite3 backend/prisma/dev.db "UPDATE User SET role='ADMIN' WHERE email='your@email.com';"
```

---

## 7. Tax Engine (2026)

File: `mobile/src/lib/utils/tax-calc.ts`

### 2026 Tax Brackets
| Bracket | Monthly Income | Rate |
|---|---|---|
| 1 | 0 – ₪7,010 | 10% |
| 2 | ₪7,011 – ₪10,060 | 14% |
| 3 | ₪10,061 – ₪16,150 | 20% |
| 4 | ₪16,151 – ₪22,440 | 31% |
| 5 | ₪22,441 – ₪46,690 | 35% |
| 6 | ₪46,691 – ₪60,130 | 47% |
| 7 | ₪60,131+ | 50% |

- Credit point: **₪242/month** (2.25 default = ₪544.50 offset)
- National Insurance: 0.4% up to ₪7,420 / 7.0% up to ₪49,030
- Health: 3.1% / 5.0% same ceiling

**When tax brackets change (annually):** Update constants at top of `tax-calc.ts`.

---

## 8. MoneyCharacter

File: `mobile/src/components/MoneyCharacter.tsx`

SVG-based animated character using `react-native-svg` v15.12.1 + `react-native-reanimated`.

### States
| State | When Shown |
|---|---|
| `idle` | No active session |
| `working` | Session active, not on break |
| `break` | Break in progress |
| `done` | 3 seconds after session ended |
| `sleeping` | After 22:00, no active session |

### Toggle
Users can show/hide via Settings → "דמות שטר חיה".
Controlled by `showCharacter` in `mobile/src/lib/state/settings-store.ts`.

---

## 9. AdMob (Prepared, Not Active)

Files:
- `mobile/src/components/ads/AdBanner.tsx`
- `mobile/src/lib/ads/ad-manager.ts`

Currently uses **Google test IDs** — safe for development:
- Banner: `ca-app-pub-3940256099942544/6300978111`
- Interstitial: `ca-app-pub-3940256099942544/1033173712`
- Rewarded: `ca-app-pub-3940256099942544/5224354917`

**Before going live:** Replace test IDs with real AdMob unit IDs from your Google AdMob account.
**Interstitial frequency:** Shows every 3rd session end (configurable in `ad-manager.ts`).

---

## 10. Deploy Process

### Backend
1. Push code to Vibecode (click Deploy button top-right on vibecode.dev)
2. Set env vars in Vibecode ENV tab
3. Backend auto-runs `prisma generate` + `prisma migrate deploy` on start
4. Verify: `curl $BACKEND_URL/health`

### Mobile (iOS)
1. In Vibecode app → Publish tab
2. Select iOS
3. Build and submit via Vibecode publish flow
4. Do NOT run `eas build` manually in the terminal

### Database Migrations
```bash
# Create migration (dev):
cd backend
bunx prisma migrate dev --create-only --name describe-change

# Apply to production:
bunx prisma migrate deploy

# Quick dev push (no migration file):
bunx prisma db push
```

---

## 11. Admin Area

Access: Tap version number 7 times in Settings → Admin login.
Or navigate directly to `/admin` route in the app.

**Default admin credentials:** Set manually in DB (see Section 6 above).

### Admin Features
- View all users + active session count
- Suspend / delete users
- View system stats (total users, active sessions, DB status)
- AppConfig key-value store for feature flags

---

## 12. Logs

### Backend Logs
```bash
# Read live logs:
cat /home/user/workspace/backend/server.log

# Or tail:
tail -f /home/user/workspace/backend/server.log
```

### Mobile Logs
```bash
# Expo runtime logs:
cat /home/user/workspace/expo.log
```

Logs are reset on each conversation with the AI assistant.

---

## 13. Key Files Reference

| Purpose | File |
|---|---|
| Tax engine (2026) | `mobile/src/lib/utils/tax-calc.ts` |
| Salary breakdown engine | `mobile/src/lib/utils/salary-engine.ts` |
| Animated character | `mobile/src/components/MoneyCharacter.tsx` |
| Economic insights cards | `mobile/src/components/InsightsCards.tsx` |
| Simulation screen | `mobile/src/app/simulation.tsx` |
| Settings store | `mobile/src/lib/state/settings-store.ts` |
| API client | `mobile/src/lib/api/` |
| Backend routes | `backend/src/routes/` |
| DB schema | `backend/prisma/schema.prisma` |
| Environment config | `backend/src/env.ts` |
| AdMob | `mobile/src/components/ads/`, `mobile/src/lib/ads/` |

---

## 14. Future Development Notes

### Adding New Features
1. If backend + mobile: design API contract in `backend/src/types.ts` first
2. Add Prisma model + migration
3. Add Hono route in `backend/src/routes/`
4. Add mobile screen in `mobile/src/app/`
5. Register new screens in `mobile/src/app/_layout.tsx`

### Adding New Tax Year
1. Update constants in `mobile/src/lib/utils/tax-calc.ts`
2. Update `YEAR` constant
3. Update label strings in `mobile/src/app/tax-brackets.tsx` and `settings.tsx`

### Adding Paid Features / Subscriptions
1. Use Vibecode PAYMENTS tab to connect RevenueCat
2. Once connected, the AI assistant will set up purchase flows automatically

### Adding Push Notifications
- Use `expo-notifications` (already in Expo SDK)
- Register push token on login, store in `UserSettings`

### Adding Email (Password Reset)
- Set `RESEND_API_KEY` in backend `.env`
- Implement email send in `backend/src/routes/auth.ts` (stub already exists)

---

## 15. Maintenance Checklist

### Monthly
- [ ] Check `server.log` for error spikes
- [ ] Review admin panel for suspended/flagged users
- [ ] Verify tax year is current (update January each year)

### Before Each App Store Release
- [ ] Update version in `mobile/app.json`
- [ ] Replace AdMob test IDs with production IDs
- [ ] Verify `EXPO_PUBLIC_BACKEND_URL` points to production
- [ ] Run full flow test: register → log session → view salary
- [ ] Check that privacy screen is up to date

### Database Backup
```bash
# Copy SQLite file:
cp backend/prisma/dev.db backend/prisma/dev.db.backup-$(date +%Y%m%d)
```

---

## 16. Support & Contacts

| Role | Notes |
|---|---|
| Developer (AI) | Use Vibecode app — describe changes in plain language |
| App Store | Apple Developer account required for iOS publishing |
| AdMob | Google AdMob account — create ad units before going live |
| Email (Resend) | resend.com — free tier available |

---

*Generated by WorkClock AI assistant — WorkClock v1.0.0 — Tax Data 2026*
