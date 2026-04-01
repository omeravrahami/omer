# Ads Setup Guide (AdMob)

## Current Status

Ads infrastructure is fully built but disabled. All the wiring is in place — connecting requires:
1. Creating an AdMob account
2. Adding 4 environment variables
3. Publishing a native build

---

## Files Overview

| File | Purpose |
|------|---------|
| `mobile/src/lib/ads-config.ts` | Central config: test IDs, production IDs, display rules |
| `mobile/src/lib/ads/index.ts` | Main ad manager (currently disabled) |
| `mobile/src/lib/ads/ad-manager.ts` | Session tracking for interstitial logic |
| `mobile/src/components/ads/AdBanner.tsx` | Banner component (renders placeholder in dev, null in prod) |
| `mobile/src/components/ads/useInterstitialAd.ts` | Hook for interstitial ads |

---

## Display Rules (already configured)

| Rule | Value |
|------|-------|
| Interstitial shown after | every 3 work sessions ended |
| Minimum interval between interstitials | 180 seconds |
| Banner shown on | Dashboard, Stats, History screens |
| Ad-free screens | Clock, Settings, Admin |
| Premium users | Never see any ads |

---

## Step-by-Step: Activating Real Ads

### Step 1: Create AdMob account
1. Go to https://apps.admob.com
2. Create a new app (iOS + Android — two separate apps)
3. Copy the **App ID** for each platform (format: `ca-app-pub-XXXXXXXX~XXXXXXXXXX`)

### Step 2: Add App IDs to app.json
In `mobile/app.json`, add under `plugins`:
```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX",
    "iosAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"
  }
]
```

### Step 3: Create Ad Units in AdMob
Create three ad units for each platform:
- **Banner** (for dashboard/stats/history)
- **Interstitial** (for after sessions)
- **Rewarded** (for simulation feature unlock)

### Step 4: Add Ad Unit IDs via ENV tab
Add these in the Vibecode ENV tab:
```
EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-XXXXXXXX/XXXXXXXXXX
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-XXXXXXXX/XXXXXXXXXX
EXPO_PUBLIC_ADMOB_REWARDED_ID=ca-app-pub-XXXXXXXX/XXXXXXXXXX
```

### Step 5: Enable ads in config
In `mobile/src/lib/ads/index.ts`, change:
```typescript
enabled: false,  // → change to true
```

### Step 6: Wire up AdBanner in screens
In `AdBanner.tsx`, replace the placeholder with real AdMob component:
```typescript
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
// Replace placeholder View with:
<BannerAd unitId={getAdUnitId('BANNER')} size={BannerAdSize.BANNER} />
```

### Step 7: Publish native build
Ads require a native EAS build — use the Vibecode publish flow.

---

## Development vs Production

| Mode | Behavior |
|------|---------|
| `__DEV__ = true` | Shows visible placeholder rectangle ("Ad Space") |
| `__DEV__ = false`, no prod IDs | Returns null (no crash, no broken UI) |
| `__DEV__ = false`, prod IDs set | Shows real AdMob ads |
| `isPremium = true` | Always returns null (no ads) |
| `adConfig.enabled = false` | Always returns null (no ads) |

---

## Premium No-Ads Handling

The `isAdEnabled(isPremium)` function in `ads/index.ts` already returns `false` for premium users. This is checked in both `AdBanner` and `useInterstitialAd` before making any ad request.

---

## Test IDs Reference

These are Google's official test ad unit IDs — safe to use in any build:
```
Banner:       ca-app-pub-3940256099942544/6300978111
Interstitial: ca-app-pub-3940256099942544/1033173712
Rewarded:     ca-app-pub-3940256099942544/5224354917
```

---

## Admin Panel: Ads Configuration

The admin panel has an `admin/ads.tsx` screen where you can:
- Toggle ads on/off system-wide
- See current ad config status
- The `ads_enabled` value is stored in `AppConfig` table (key: `ads_enabled`)
