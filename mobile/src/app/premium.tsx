import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Crown, Check, X, Sparkles, BarChart3, Download, Ban } from 'lucide-react-native';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useToastStore } from '@/lib/state/toast-store';

const BENEFITS = [
  { icon: BarChart3, text: '\u05D3\u05D5\u05D7\u05D5\u05EA \u05DE\u05EA\u05E7\u05D3\u05DE\u05D9\u05DD \u05D5\u05E0\u05D9\u05EA\u05D5\u05D7\u05D9\u05DD' },
  { icon: Download, text: '\u05D9\u05D9\u05E6\u05D5\u05D0 PDF \u05D5-CSV' },
  { icon: Ban, text: '\u05DC\u05DC\u05D0 \u05E4\u05E8\u05E1\u05D5\u05DE\u05D5\u05EA' },
  { icon: Sparkles, text: '\u05EA\u05DB\u05D5\u05E0\u05D5\u05EA \u05E2\u05EA\u05D9\u05D3\u05D9\u05D5\u05EA \u05D5\u05D2\u05D9\u05E9\u05D4 \u05DE\u05D5\u05E7\u05D3\u05DE\u05EA' },
];

export default function PremiumScreen() {
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const isPro = useSettingsStore((s) => s.isPro);
  const togglePro = useSettingsStore((s) => s.togglePro);

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    togglePro();
    if (!isPro) {
      showToast('\u05E9\u05D5\u05D3\u05E8\u05D2\u05EA\u05DD \u05DC-PRO \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4!');
    } else {
      showToast('PRO \u05D1\u05D5\u05D8\u05DC', 'info');
    }
    router.back();
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8FAFC' }} testID="premium-screen">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable onPress={() => router.back()} testID="close-premium">
          <X size={24} color="#0F172A" />
        </Pressable>
        <Text className="text-lg font-bold" style={{ color: '#0F172A' }}>PRO</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Badge */}
        <Animated.View entering={FadeInDown.duration(500)} className="items-center mt-8 mb-6">
          <View
            className="w-28 h-28 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: '#FEF3C7' }}
          >
            <Crown size={56} color="#D97706" />
          </View>
          <Text className="text-3xl font-bold" style={{ color: '#0F172A', textAlign: 'center' }}>
            {'\u05E9\u05D3\u05E8\u05D2\u05D5 \u05DC-PRO'}
          </Text>
          <Text className="text-base mt-2 px-8" style={{ color: '#64748B', textAlign: 'center' }}>
            {'\u05E7\u05D1\u05DC\u05D5 \u05D2\u05D9\u05E9\u05D4 \u05DC\u05DB\u05DC \u05D4\u05EA\u05DB\u05D5\u05E0\u05D5\u05EA \u05D4\u05DE\u05EA\u05E7\u05D3\u05DE\u05D5\u05EA'}
          </Text>
        </Animated.View>

        {/* Benefits */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mx-4 mb-8">
          <View className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
            {BENEFITS.map((benefit, idx) => (
              <View
                key={idx}
                className="flex-row-reverse items-center gap-3 py-4"
                style={idx < BENEFITS.length - 1 ? { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' } : undefined}
              >
                <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                  <benefit.icon size={20} color="#D97706" />
                </View>
                <Text className="text-base font-medium flex-1" style={{ color: '#0F172A', textAlign: 'right' }}>
                  {benefit.text}
                </Text>
                <Check size={20} color="#059669" />
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Pricing */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} className="mx-4 mb-8">
          <View
            className="rounded-2xl p-6 items-center"
            style={{ backgroundColor: '#FEF3C7', borderWidth: 2, borderColor: '#FDE68A' }}
          >
            <Text className="text-sm font-medium mb-1" style={{ color: '#92400E' }}>{'\u05DE\u05E0\u05D5\u05D9 \u05D7\u05D5\u05D3\u05E9\u05D9'}</Text>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-4xl font-bold" style={{ color: '#92400E' }}>{'\u20AA19.90'}</Text>
              <Text className="text-base" style={{ color: '#B45309' }}>{'/\u05D7\u05D5\u05D3\u05E9'}</Text>
            </View>
          </View>
        </Animated.View>

        {/* CTA Button */}
        <View className="mx-4">
          <Pressable
            onPress={handleUpgrade}
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: isPro ? '#94A3B8' : '#D97706' }}
            testID="upgrade-button"
          >
            <Text className="text-white font-bold text-lg">
              {isPro ? '\u05D1\u05D9\u05D8\u05D5\u05DC PRO' : '\u05E9\u05D3\u05E8\u05D2 \u05DC-PRO'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
