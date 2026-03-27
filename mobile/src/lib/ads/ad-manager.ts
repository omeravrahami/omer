// Ads are disabled pending full ad network integration
export const trackSessionEnd = async (): Promise<boolean> => false;
export const trackScreenTransition = async (_screen: string): Promise<void> => {};
export const shouldShowInterstitial = async (): Promise<boolean> => false;
export const resetInterstitialCount = async (): Promise<void> => {};
