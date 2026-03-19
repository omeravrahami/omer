# WorkClock - וורק קלוק

A premium Hebrew time-tracking app for employees, freelancers, and students.

## Overview

WorkClock helps users track work hours, breaks, and earnings with a beautiful, RTL-native interface. The app features real-time timers, automatic salary calculations, and detailed analytics.

## Architecture

- **Mobile**: Expo SDK 53 + React Native with NativeWind styling
- **Backend**: Hono + Bun + Prisma (SQLite)
- **State**: React Query (server), Zustand (local)

## Features

- Start/stop work sessions with live timer
- Break tracking (start/end breaks during shifts)
- Automatic pay calculation based on hourly rate
- Session history with month navigation
- Weekly/monthly analytics and reports
- Onboarding flow for new users
- Dark mode support
- Full RTL Hebrew interface
- PRO upgrade screen (placeholder)
- Ad banner placeholder for free tier

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
