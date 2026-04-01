import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
}

export function LockedHistoryBanner({ visible }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isRTL = i18n.language === 'he';

  if (!visible) return null;

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/premium' as never);
  };

  return (
    <View
      testID="locked-history-banner"
      style={{
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 16,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.3)',
        backgroundColor: 'rgba(245,158,11,0.07)',
      }}
    >
      <View
        style={{
          padding: 20,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        {/* Lock icon */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: 'rgba(245,158,11,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Lock size={20} color="#F59E0B" />
        </View>

        {/* Text content */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: '#F0F6FF',
              textAlign: isRTL ? 'right' : 'left',
              marginBottom: 4,
            }}
          >
            {t('premium.locked_history_title')}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: 'rgba(240,246,255,0.6)',
              lineHeight: 18,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('premium.locked_history_message')}
          </Text>
        </View>
      </View>

      {/* Upgrade CTA */}
      <Pressable
        onPress={handleUpgrade}
        testID="locked-history-upgrade-btn"
        style={({ pressed }) => ({
          marginHorizontal: 16,
          marginBottom: 16,
          borderRadius: 12,
          backgroundColor: pressed ? 'rgba(245,158,11,0.85)' : '#F59E0B',
          paddingVertical: 12,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: '#060B18',
          }}
        >
          {t('premium.locked_history_cta')}
        </Text>
        <ArrowRight size={14} color="#060B18" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}
