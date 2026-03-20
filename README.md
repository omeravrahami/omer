# WorkClock - וורק קלוק

A free Hebrew time-tracking app for employees, freelancers, and students. Monetized via ads (AdMob), not subscriptions.

## Overview

WorkClock helps users track work hours, breaks, and earnings with a beautiful, RTL-native interface. The app features real-time timers, automatic salary calculations, and detailed analytics.

## Architecture

- **Mobile**: Expo SDK 53 + React Native with NativeWind styling
- **Backend**: Hono + Bun + Prisma (SQLite)
- **State**: React Query (server), Zustand (local)
- **Auth**: Custom token-based auth (bcryptjs + DB sessions), guest mode supported

## Monetization

- **Free forever** (at least year 1) — all features unlocked
- **AdMob** (pending native build): Banner (home), Interstitial (end shift), Rewarded (reports/insights)
- Ad placeholders in `mobile/src/components/ads/` — activate after app store publish

## Features

- Start/stop work sessions with live timer + pulse animation
- Break tracking (start/end breaks during shifts)
- Automatic pay calculation based on hourly rate
- Session history with month navigation
- Weekly/monthly analytics and reports
- **3-tier salary breakdown**: ברוטו לתשלום / ברוטו לחישוב מס / נטו בפועל
- **Smart component tags**: "לצורכי מס בלבד", "פטור ממס", "רכיב חד פעמי"
- **User accounts**: email/password registration, login, guest mode, cross-device sync
- **Dynamic insights**: effective hourly net rate, effective tax %, net per extra hour
- Onboarding flow for new users
- Dark mode, full RTL Hebrew interface

## Screens

1. **Dashboard** - Live timer, today's card, weekly/monthly summary, quick actions
2. **History** - Session list grouped by date, month navigation, delete with confirmation
3. **Reports** - Stats overview, goal progress bars, weekly chart, export buttons
4. **Settings** - Hourly rate, goals, currency, display preferences
5. **Onboarding** - 3-slide intro + initial settings setup
6. **Session Detail** - Full session view with breaks, notes, edit/delete
7. **Add/Edit Session** - Manual entry form with live calculation preview
8. **Premium** - PRO upgrade screen with benefits list

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/settings/:deviceId | Get/create settings |
| PUT | /api/settings/:deviceId | Update settings |
| GET | /api/sessions/:deviceId | List sessions |
| GET | /api/sessions/:deviceId/active | Get active session |
| POST | /api/sessions/:deviceId | Start work |
| PUT | /api/sessions/:deviceId/:id | End/update session |
| DELETE | /api/sessions/:deviceId/:id | Delete session |
| POST | /api/sessions/:deviceId/:sid/breaks | Start break |
| PUT | /api/sessions/:deviceId/:sid/breaks/:bid | End break |
| GET | /api/stats/:deviceId | Get stats |

## Data Model

- **Settings** - Per-device preferences (hourly rate, goals, etc.)
- **WorkSession** - Work session records with times, pay, notes
- **BreakSession** - Break records within work sessions
