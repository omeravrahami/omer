import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Dimensions,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import PagerView from 'react-native-pager-view';
import { Briefcase, Clock, BarChart3, DollarSign, ArrowLeft } from 'lucide-react-native';
import { useSettingsStore } from '@/lib/state/settings-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PAGES = [
  {
    icon: Briefcase,
    iconColor: '#2563EB',
    iconBg: '#EFF6FF',
    title: '\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC-WorkClock!',
    subtitle: '\u05D4\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4 \u05D4\u05D7\u05DB\u05DE\u05D4 \u05D1\u05D9\u05D5\u05EA\u05E8 \u05DC\u05DE\u05E2\u05E7\u05D1 \u05E9\u05E2\u05D5\u05EA \u05D4\u05E2\u05D1\u05D5\u05D3\u05D4',
  },
  {
    icon: Clock,
    iconColor: '#059669',
    iconBg: '#F0FDF4',
    title: '\u05DE\u05E2\u05E7\u05D1 \u05E9\u05E2\u05D5\u05EA \u05D7\u05DB\u05DD',
    subtitle: '\u05E2\u05E7\u05D1\u05D5 \u05D0\u05D7\u05E8 \u05E9\u05E2\u05D5\u05EA \u05D4\u05E2\u05D1\u05D5\u05D3\u05D4, \u05D4\u05E4\u05E1\u05E7\u05D5\u05EA \u05D5\u05E9\u05DB\u05E8 \u05D1\u05DC\u05D7\u05D9\u05E6\u05EA \u05DB\u05E4\u05EA\u05D5\u05E8',
  },
  {
    icon: BarChart3,
    iconColor: '#D97706',
    iconBg: '#FEF3C7',
    title: '\u05D3\u05D5\u05D7\u05D5\u05EA \u05D5\u05E1\u05D9\u05DB\u05D5\u05DE\u05D9\u05DD',
    subtitle: '\u05E7\u05D1\u05DC\u05D5 \u05EA\u05DE\u05D5\u05E0\u05D4 \u05DE\u05E4\u05D5\u05E8\u05D8\u05EA \u05E2\u05DC \u05E9\u05E2\u05D5\u05EA \u05D4\u05E2\u05D1\u05D5\u05D3\u05D4 \u05D5\u05D4\u05D4\u05DB\u05E0\u05E1\u05D5\u05EA \u05E9\u05DC\u05DB\u05DD',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hourlyRate, setHourlyRate] = useState('50');
  const [dailyGoal, setDailyGoal] = useState('8');
  const [showSalary, setShowSalary] = useState(true);

  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const setOnboardingCompleted = useSettingsStore((s) => s.setOnboardingCompleted);

  const totalPages = PAGES.length + 1; // slides + setup

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentPage < totalPages - 1) {
      pagerRef.current?.setPage(currentPage + 1);
    }
  };

  const handleComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const rate = parseInt(hourlyRate, 10);
    const goal = parseInt(dailyGoal, 10);
    updateSettings({
      hourlyRate: isNaN(rate) ? 50 : rate,
      dailyGoalHours: isNaN(goal) ? 8 : goal,
      showSalaryOnDashboard: showSalary,
    });
    setOnboardingCompleted(true);
    router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8FAFC' }} testID="onboarding-screen">
      <PagerView
        ref={pagerRef}
        className="flex-1"
        initialPage={0}
        onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
      >
        {/* Feature Slides */}
        {PAGES.map((page, idx) => (
          <View key={idx} className="flex-1 justify-center items-center px-8">
            <Animated.View entering={FadeInDown.duration(500)}>
              <View
                className="w-24 h-24 rounded-full items-center justify-center mb-8 self-center"
                style={{ backgroundColor: page.iconBg }}
              >
                <page.icon size={48} color={page.iconColor} />
              </View>
              <Text className="text-2xl font-bold mb-4" style={{ color: '#0F172A', textAlign: 'center' }}>
                {page.title}
              </Text>
              <Text className="text-base leading-6" style={{ color: '#64748B', textAlign: 'center' }}>
                {page.subtitle}
              </Text>
            </Animated.View>
          </View>
        ))}

        {/* Setup Page */}
        <View key="setup" className="flex-1 justify-center px-8">
          <Animated.View entering={FadeInUp.duration(500)}>
            <View className="w-20 h-20 rounded-full items-center justify-center mb-6 self-center" style={{ backgroundColor: '#EFF6FF' }}>
              <DollarSign size={40} color="#2563EB" />
            </View>
            <Text className="text-2xl font-bold mb-2" style={{ color: '#0F172A', textAlign: 'center' }}>
              {'\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA \u05E8\u05D0\u05E9\u05D5\u05E0\u05D9\u05D5\u05EA'}
            </Text>
            <Text className="text-sm mb-8" style={{ color: '#64748B', textAlign: 'center' }}>
              {'\u05EA\u05D5\u05DB\u05DC\u05D5 \u05DC\u05E9\u05E0\u05D5\u05EA \u05D0\u05EA \u05D6\u05D4 \u05DE\u05D0\u05D5\u05D7\u05E8 \u05D9\u05D5\u05EA\u05E8 \u05D1\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA'}
            </Text>

            <View className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
              <SetupRow label={'\u05E9\u05DB\u05E8 \u05DC\u05E9\u05E2\u05D4 (\u20AA)'}>
                <TextInput
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  keyboardType="numeric"
                  className="rounded-xl px-4 py-2 text-base font-bold"
                  style={{ backgroundColor: '#F1F5F9', color: '#0F172A', minWidth: 80, textAlign: 'left' }}
                  testID="onboarding-rate-input"
                />
              </SetupRow>
              <SetupRow label={'\u05D9\u05E2\u05D3 \u05E9\u05E2\u05D5\u05EA \u05D9\u05D5\u05DE\u05D9'}>
                <TextInput
                  value={dailyGoal}
                  onChangeText={setDailyGoal}
                  keyboardType="numeric"
                  className="rounded-xl px-4 py-2 text-base font-bold"
                  style={{ backgroundColor: '#F1F5F9', color: '#0F172A', minWidth: 60, textAlign: 'left' }}
                  testID="onboarding-goal-input"
                />
              </SetupRow>
              <SetupRow label={'\u05D4\u05E6\u05D2 \u05E9\u05DB\u05E8 \u05D1\u05D3\u05E9\u05D1\u05D5\u05E8\u05D3'}>
                <Switch
                  value={showSalary}
                  onValueChange={setShowSalary}
                  trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
                  thumbColor={showSalary ? '#2563EB' : '#94A3B8'}
                  testID="onboarding-salary-toggle"
                />
              </SetupRow>
            </View>

            <Pressable
              onPress={handleComplete}
              className="rounded-2xl py-4 items-center mt-2"
              style={{ backgroundColor: '#2563EB' }}
              testID="onboarding-complete-button"
            >
              <Text className="text-white font-bold text-lg">
                {'\u05D1\u05D5\u05D0\u05D5 \u05E0\u05EA\u05D7\u05D9\u05DC!'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </PagerView>

      {/* Dots + Next Button */}
      <View className="pb-8 px-8">
        {/* Dots */}
        <View className="flex-row justify-center mb-4 gap-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <View
              key={i}
              className="rounded-full"
              style={{
                width: currentPage === i ? 24 : 8,
                height: 8,
                backgroundColor: currentPage === i ? '#2563EB' : '#E2E8F0',
              }}
            />
          ))}
        </View>

        {currentPage < totalPages - 1 ? (
          <View className="flex-row justify-between items-center">
            <Pressable onPress={handleComplete} testID="onboarding-skip">
              <Text className="text-sm" style={{ color: '#94A3B8' }}>{'\u05D3\u05DC\u05D2'}</Text>
            </Pressable>
            <Pressable
              onPress={goNext}
              className="rounded-2xl px-8 py-3"
              style={{ backgroundColor: '#2563EB' }}
              testID="onboarding-next"
            >
              <Text className="text-white font-semibold">{'\u05D4\u05D1\u05D0'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function SetupRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between py-3" style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
      {children}
      <Text className="text-sm font-medium flex-1 mr-3" style={{ color: '#374151', textAlign: 'right' }}>
        {label}
      </Text>
    </View>
  );
}
