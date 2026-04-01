import React, { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  Crown,
  Check,
  Zap,
  Archive,
  Download,
  Smartphone,
  TrendingUp,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/lib/state/settings-store';
import * as Haptics from 'expo-haptics';

const BG_DEEP = '#060B18';
const GOLD = '#F59E0B';
const GOLD_LIGHT = '#FCD34D';
const CARD_BG = 'rgba(255,255,255,0.06)';
const CARD_BORDER = 'rgba(245,158,11,0.25)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(240,246,255,0.6)';
const TEXT_DIM = 'rgba(240,246,255,0.35)';

interface FeatureRow {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
}

export default function PremiumScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isPremium = useSettingsStore((s) => s.isPremium);
  const isRTL = i18n.language === 'he';

  const scaleAnim = useSharedValue(0.92);

  useEffect(() => {
    scaleAnim.value = withSpring(1, { damping: 14, stiffness: 120 });
  }, [scaleAnim]);

  const crownStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: Integrate RevenueCat / StoreKit IAP here.
    // On successful purchase, call backend to set isPremium=true for the user.
  };

  const handleRestore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Integrate RevenueCat / StoreKit restore here.
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const features: FeatureRow[] = [
    {
      icon: <Zap size={20} color={GOLD} />,
      titleKey: 'premium.feature_no_ads',
      descKey: 'premium.feature_no_ads_desc',
    },
    {
      icon: <Archive size={20} color={GOLD} />,
      titleKey: 'premium.feature_unlimited_history',
      descKey: 'premium.feature_unlimited_history_desc',
    },
    {
      icon: <Download size={20} color={GOLD} />,
      titleKey: 'premium.feature_export',
      descKey: 'premium.feature_export_desc',
    },
    {
      icon: <Smartphone size={20} color={GOLD} />,
      titleKey: 'premium.feature_sync',
      descKey: 'premium.feature_sync_desc',
    },
    {
      icon: <TrendingUp size={20} color={GOLD} />,
      titleKey: 'premium.feature_insights',
      descKey: 'premium.feature_insights_desc',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: BG_DEEP }} testID="premium-screen">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0A1628', '#060B18', '#060B18']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Subtle top glow */}
      <View
        style={{
          position: 'absolute',
          top: -60,
          left: '50%',
          marginLeft: -150,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: 'rgba(245,158,11,0.08)',
        }}
        pointerEvents="none"
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Close button */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-start',
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
        >
          <Pressable
            onPress={handleClose}
            testID="premium-close-button"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} color={TEXT_SECONDARY} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
        >
          {/* Hero section */}
          <Animated.View
            entering={FadeInDown.duration(500).springify()}
            style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 32 }}
          >
            <Animated.View
              style={[
                crownStyle,
                {
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: 'rgba(245,158,11,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                  borderWidth: 1.5,
                  borderColor: 'rgba(245,158,11,0.3)',
                },
              ]}
            >
              <Crown size={36} color={GOLD} />
            </Animated.View>

            <Text
              style={{
                fontSize: 28,
                fontWeight: '800',
                color: TEXT_PRIMARY,
                textAlign: 'center',
                letterSpacing: -0.5,
                marginBottom: 8,
              }}
            >
              {t('premium.title')}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: TEXT_SECONDARY,
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              {t('premium.subtitle')}
            </Text>

            {/* Price pill */}
            <View
              style={{
                marginTop: 20,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 99,
                backgroundColor: 'rgba(245,158,11,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(245,158,11,0.3)',
              }}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '700',
                  color: GOLD_LIGHT,
                }}
              >
                {t('premium.price_monthly', { price: '$9.99' })}
              </Text>
            </View>
          </Animated.View>

          {/* Features card */}
          <Animated.View
            entering={FadeInDown.delay(120).duration(500).springify()}
            style={{
              backgroundColor: CARD_BG,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: CARD_BORDER,
              paddingVertical: 8,
              marginBottom: 24,
            }}
          >
            {features.map((feature, idx) => (
              <View
                key={feature.titleKey}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderBottomWidth: idx < features.length - 1 ? 1 : 0,
                  borderBottomColor: 'rgba(255,255,255,0.05)',
                }}
              >
                {/* Icon */}
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: isRTL ? 0 : 14,
                    marginLeft: isRTL ? 14 : 0,
                    flexShrink: 0,
                  }}
                >
                  {feature.icon}
                </View>

                {/* Text */}
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 3,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: TEXT_PRIMARY,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {t(feature.titleKey)}
                    </Text>
                    <Check size={14} color={GOLD} strokeWidth={3} />
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      color: TEXT_SECONDARY,
                      lineHeight: 18,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {t(feature.descKey)}
                  </Text>
                </View>
              </View>
            ))}
          </Animated.View>

          {/* Current plan note (if premium) */}
          {isPremium ? (
            <Animated.View
              entering={FadeInUp.delay(200).duration(400)}
              style={{
                backgroundColor: 'rgba(34,197,94,0.1)',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(34,197,94,0.25)',
                padding: 16,
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#22C55E' }}>
                {t('premium.subscription_active')}
              </Text>
            </Animated.View>
          ) : null}

          {/* CTA Button */}
          <Animated.View entering={FadeInUp.delay(250).duration(500).springify()}>
            {/* Coming-soon notice — remove once IAP is wired */}
            <View
              style={{
                backgroundColor: 'rgba(99,102,241,0.08)',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(99,102,241,0.2)',
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginBottom: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 12, color: 'rgba(165,180,252,0.8)', textAlign: 'center', lineHeight: 18 }}>
                {t('premium.payment_coming_soon')}
              </Text>
            </View>
            {!isPremium ? (
              <Pressable
                onPress={handleUpgrade}
                testID="premium-upgrade-button"
                style={({ pressed }) => ({
                  borderRadius: 18,
                  overflow: 'hidden',
                  opacity: pressed ? 0.88 : 1,
                  marginBottom: 12,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 18,
                    alignItems: 'center',
                    borderRadius: 18,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '800',
                      color: '#060B18',
                      letterSpacing: 0.2,
                    }}
                  >
                    {t('premium.upgrade_button')}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : null}

            {/* Restore Purchase */}
            <Pressable
              onPress={handleRestore}
              testID="premium-restore-button"
              style={{ alignItems: 'center', paddingVertical: 14 }}
            >
              <Text style={{ fontSize: 14, color: TEXT_SECONDARY, fontWeight: '500' }}>
                {t('premium.restore_button')}
              </Text>
            </Pressable>

            {/* Legal note */}
            <Text
              style={{
                fontSize: 11,
                color: TEXT_DIM,
                textAlign: 'center',
                lineHeight: 16,
                paddingHorizontal: 16,
                marginTop: 4,
              }}
            >
              {t('premium.terms_note')}
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
