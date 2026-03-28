import React from 'react';
import { View, Text } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useNetworkStatus } from '@/lib/useNetworkStatus';

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View
      style={{
        backgroundColor: '#DC2626',
        paddingVertical: 8,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
      testID="offline-banner"
    >
      <WifiOff size={14} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
        אין חיבור לאינטרנט
      </Text>
    </View>
  );
}
