/**
 * AdBanner.tsx
 *
 * Ad banner infrastructure for AdMob integration.
 *
 * HOW TO ACTIVATE REAL ADS (after publishing to App Store / Play Store):
 * 1. Install the native package: `npx expo install react-native-google-mobile-ads`
 * 2. Add your real ad unit IDs to app.json under `react-native-google-mobile-ads`
 * 3. Replace the placeholder below with:
 *      import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
 *      const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';
 *      return <BannerAd unitId={adUnitId} size={BannerAdSize.BANNER} />;
 * 4. Remove this placeholder file.
 *
 * NOTE: Native ad packages require a development build (EAS Build), they do NOT
 * work in Expo Go. Use the test IDs below during development.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { getAdUnitId } from '@/lib/ads-config';
import { isAdEnabled } from '@/lib/ads';

// Re-export for backward compatibility
export const TEST_BANNER_ID = getAdUnitId('BANNER', true);
export const TEST_INTERSTITIAL_ID = getAdUnitId('INTERSTITIAL', true);
export const TEST_REWARDED_ID = getAdUnitId('REWARDED', true);

export type AdUnitType = 'banner' | 'interstitial' | 'rewarded';

export interface AdBannerProps {
  /** Override the ad unit ID (default: TEST_BANNER_ID in dev, null in prod) */
  adUnitId?: string;
  /** When true, suppresses the ad entirely */
  isPremium?: boolean;
}

const isDev = __DEV__;

/**
 * AdBanner renders a styled placeholder in development mode so you can
 * see and design around the ad space without a native build.
 * In production it returns null until real AdMob is wired up.
 */
export const AdBanner = ({ adUnitId: _adUnitId, isPremium = false }: AdBannerProps = {}) => {
  if (!isAdEnabled(isPremium)) {
    return null;
  }

  if (!isDev) {
    // Production: return nothing until native ads are configured.
    return null;
  }

  // Development: show a visible placeholder representing the ad slot.
  return (
    <View
      testID="ad-banner-placeholder"
      style={{
        height: 50,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 16,
        marginVertical: 4,
      }}
    >
      <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', letterSpacing: 0.5 }}>
        {'Ad Space'}
      </Text>
      <Text style={{ fontSize: 9, color: '#CBD5E1', marginTop: 1 }}>
        {'320×50 Banner — Dev Placeholder'}
      </Text>
    </View>
  );
};
