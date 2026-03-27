// AdMob abstraction layer
// When ready to enable ads, set ADS_ENABLED=true in config
// and install react-native-google-mobile-ads

export type AdPlacement = 'home_banner' | 'history_banner' | 'report_interstitial' | 'simulation_rewarded';

interface AdConfig {
  enabled: boolean;
  testMode: boolean;
  placements: Record<AdPlacement, { unitId: string; testUnitId: string }>;
}

// TODO: Replace unit IDs with real AdMob unit IDs when account is ready
export const adConfig: AdConfig = {
  enabled: false, // Set to true when AdMob account is connected
  testMode: true,  // Always use test IDs in development
  placements: {
    home_banner: {
      unitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      testUnitId: 'ca-app-pub-3940256099942544/6300978111', // Google test banner
    },
    history_banner: {
      unitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      testUnitId: 'ca-app-pub-3940256099942544/6300978111',
    },
    report_interstitial: {
      unitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      testUnitId: 'ca-app-pub-3940256099942544/1033173712', // Google test interstitial
    },
    simulation_rewarded: {
      unitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      testUnitId: 'ca-app-pub-3940256099942544/5224354917', // Google test rewarded
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
