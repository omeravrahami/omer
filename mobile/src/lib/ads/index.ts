// AdMob abstraction layer
// When ready to enable ads, set ADS_ENABLED=true in config
// and install react-native-google-mobile-ads

export type AdPlacement = 'home_banner' | 'history_banner' | 'report_interstitial' | 'simulation_rewarded';

interface AdConfig {
  enabled: boolean;
  testMode: boolean;
  placements: Record<AdPlacement, { unitId: string; testUnitId: string }>;
}

// Production unit IDs — replace with real IDs from https://apps.admob.com before release
// Set via ENV tab: EXPO_PUBLIC_ADMOB_BANNER_ID, EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID, EXPO_PUBLIC_ADMOB_REWARDED_ID
export const adConfig: AdConfig = {
  enabled: false, // Set to true when AdMob account is connected and EAS build is ready
  testMode: true,  // Flip to false only in production builds
  placements: {
    home_banner: {
      unitId: process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? '',
      testUnitId: 'ca-app-pub-3940256099942544/6300978111', // Official Google test banner
    },
    history_banner: {
      unitId: process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? '',
      testUnitId: 'ca-app-pub-3940256099942544/6300978111',
    },
    report_interstitial: {
      unitId: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? '',
      testUnitId: 'ca-app-pub-3940256099942544/1033173712', // Official Google test interstitial
    },
    simulation_rewarded: {
      unitId: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID ?? '',
      testUnitId: 'ca-app-pub-3940256099942544/5224354917', // Official Google test rewarded
    },
  },
};

export function getUnitId(placement: AdPlacement): string {
  const config = adConfig.placements[placement];
  return adConfig.testMode ? config.testUnitId : config.unitId;
}

export function isAdEnabled(_placement: AdPlacement): boolean {
  return adConfig.enabled;
}
