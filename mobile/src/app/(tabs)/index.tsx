import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  Play,
  Square,
  Coffee,
  Plus,
  Clock,
  DollarSign,
  Briefcase,
  Timer,
  PauseCircle,
} from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useActiveSession, useStartWork, useEndWork, useStartBreak, useEndBreak, useStats } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import {
  getHebrewDate,
  formatTime,
  formatCurrency,
  getTimerDisplay,
  formatHours,
} from '@/lib/utils';
import type { WorkSession } from '@/lib/types';

function PulsingDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.3, { duration: 1000 }), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginLeft: 6 },
        style,
      ]}
    />
  );
}

function ActiveSessionCard({ session, deviceId }: { session: WorkSession; deviceId: string }) {
  const [timer, setTimer] = useState('00:00:00');
  const showSalary = useSettingsStore((s) => s.showSalaryOnDashboard);
  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const currency = useSettingsStore((s) => s.currency);
  const showToast = useToastStore((s) => s.showToast);

  const endWork = useEndWork(deviceId);
  const startBreakMut = useStartBreak(deviceId);
  const endBreakMut = useEndBreak(deviceId);

  const activeBreak = session.breaks?.find((b) => !b.endTime);
  const isOnBreak = !!activeBreak;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(
        getTimerDisplay(
          session.startTime,
          session.breakMinutes,
          isOnBreak,
          activeBreak?.startTime
        )
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [session.startTime, session.breakMinutes, isOnBreak, activeBreak?.startTime]);

  const handleEndWork = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    endWork.mutate(session.id, {
      onSuccess: () => showToast('\u05D4\u05DE\u05E9\u05DE\u05E8\u05EA \u05D4\u05E1\u05EA\u05D9\u05D9\u05DE\u05D4 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4!'),
      onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E1\u05D9\u05D5\u05DD \u05D4\u05DE\u05E9\u05DE\u05E8\u05EA', 'error'),
    });
  }, [endWork, session.id, showToast]);

  const handleBreakToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOnBreak && activeBreak) {
      endBreakMut.mutate(
        { sessionId: session.id, breakId: activeBreak.id },
        {
          onSuccess: () => showToast('\u05D7\u05D6\u05E8\u05EA\u05DD \u05DC\u05E2\u05D1\u05D5\u05D3\u05D4!'),
          onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4', 'error'),
        }
      );
    } else {
      startBreakMut.mutate(session.id, {
        onSuccess: () => showToast('\u05D4\u05E4\u05E1\u05E7\u05D4 \u05D4\u05EA\u05D7\u05D9\u05DC\u05D4'),
        onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4', 'error'),
      });
    }
  }, [isOnBreak, activeBreak, endBreakMut, startBreakMut, session.id, showToast]);

  // Calculate current pay
  const timerParts = timer.split(':').map(Number);
  const netHours = (timerParts[0] ?? 0) + (timerParts[1] ?? 0) / 60 + (timerParts[2] ?? 0) / 3600;
  const currentPay = netHours * hourlyRate;

  return (
    <Animated.View entering={FadeInDown.duration(500)} testID="active-session-card">
      <View className="bg-white rounded-3xl mx-4 overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 }}>
        <LinearGradient
          colors={isOnBreak ? ['#FEF3C7', '#FDE68A'] : ['#EFF6FF', '#DBEAFE']}
          style={{ padding: 24, borderRadius: 24 }}
        >
          {/* Status */}
          <View className="flex-row-reverse items-center justify-center mb-4">
            <Text className="text-base font-semibold" style={{ color: isOnBreak ? '#D97706' : '#059669' }}>
              {isOnBreak ? '\u05D1\u05D4\u05E4\u05E1\u05E7\u05D4' : '\u05E2\u05D5\u05D1\u05D3'}
            </Text>
            <PulsingDot color={isOnBreak ? '#D97706' : '#059669'} />
          </View>

          {/* Timer */}
          <Text
            className="text-center font-bold mb-6"
            style={{ fontSize: 52, color: '#0F172A', fontVariant: ['tabular-nums'] }}
            testID="live-timer"
          >
            {timer}
          </Text>

          {/* Stats Grid */}
          <View className="flex-row-reverse flex-wrap justify-between mb-6">
            <StatItem
              icon={<Clock size={16} color="#64748B" />}
              label={'\u05E9\u05E2\u05EA \u05D4\u05EA\u05D7\u05DC\u05D4'}
              value={formatTime(session.startTime)}
            />
            <StatItem
              icon={<Timer size={16} color="#64748B" />}
              label={'\u05D6\u05DE\u05DF \u05E2\u05D1\u05D5\u05D3\u05D4'}
              value={timer.slice(0, 5)}
            />
            <StatItem
              icon={<Coffee size={16} color="#64748B" />}
              label={'\u05D6\u05DE\u05DF \u05D4\u05E4\u05E1\u05E7\u05D5\u05EA'}
              value={formatHours(session.breakMinutes)}
            />
            {showSalary ? (
              <StatItem
                icon={<DollarSign size={16} color="#64748B" />}
                label={'\u05E9\u05DB\u05E8 \u05DC\u05D4\u05D9\u05D5\u05DD'}
                value={formatCurrency(currentPay, currency)}
              />
            ) : null}
          </View>

          {/* Actions */}
          <View className="flex-row-reverse gap-3">
            <Pressable
              onPress={handleEndWork}
              className="flex-1 rounded-2xl py-4 items-center justify-center"
              style={{ backgroundColor: '#DC2626' }}
              testID="end-work-button"
            >
              <View className="flex-row-reverse items-center gap-2">
                <Square size={18} color="#FFF" fill="#FFF" />
                <Text className="text-white font-bold text-base">
                  {'\u05E1\u05D9\u05D9\u05DD \u05E2\u05D1\u05D5\u05D3\u05D4'}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={handleBreakToggle}
              className="flex-1 rounded-2xl py-4 items-center justify-center"
              style={{ backgroundColor: isOnBreak ? '#059669' : '#D97706' }}
              testID="break-toggle-button"
            >
              <View className="flex-row-reverse items-center gap-2">
                {isOnBreak ? (
                  <Play size={18} color="#FFF" fill="#FFF" />
                ) : (
                  <PauseCircle size={18} color="#FFF" />
                )}
                <Text className="text-white font-bold text-base">
                  {isOnBreak ? '\u05D7\u05D6\u05D5\u05E8 \u05DC\u05E2\u05D1\u05D5\u05D3\u05D4' : '\u05D4\u05E4\u05E1\u05E7\u05D4'}
                </Text>
              </View>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="items-center w-1/2 mb-3 px-1">
      <View className="flex-row-reverse items-center gap-1 mb-1">
        {icon}
        <Text className="text-xs" style={{ color: '#64748B' }}>{label}</Text>
      </View>
      <Text className="text-lg font-bold" style={{ color: '#0F172A', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function EmptySessionCard({ deviceId }: { deviceId: string }) {
  const startWork = useStartWork(deviceId);
  const showToast = useToastStore((s) => s.showToast);

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startWork.mutate(undefined, {
      onSuccess: () => showToast('\u05DE\u05E9\u05DE\u05E8\u05EA \u05D4\u05EA\u05D7\u05D9\u05DC\u05D4!'),
      onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D4\u05EA\u05D7\u05DC\u05EA \u05DE\u05E9\u05DE\u05E8\u05EA', 'error'),
    });
  }, [startWork, showToast]);

  return (
    <Animated.View entering={FadeInDown.duration(500)} testID="empty-session-card">
      <View className="bg-white rounded-3xl mx-4 p-8 items-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 }}>
        <View className="w-20 h-20 rounded-full bg-blue-50 items-center justify-center mb-4">
          <Briefcase size={36} color="#2563EB" />
        </View>
        <Text className="text-xl font-bold mb-2" style={{ color: '#0F172A', textAlign: 'center' }}>
          {'\u05E2\u05D5\u05D3 \u05DC\u05D0 \u05D4\u05EA\u05D7\u05DC\u05EA\u05DD \u05DE\u05E9\u05DE\u05E8\u05EA \u05D4\u05D9\u05D5\u05DD'}
        </Text>
        <Text className="text-sm mb-6" style={{ color: '#64748B', textAlign: 'center' }}>
          {'\u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4\u05DB\u05E4\u05EA\u05D5\u05E8 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC'}
        </Text>
        <Pressable
          onPress={handleStart}
          className="w-full rounded-2xl py-4 items-center justify-center"
          style={{ backgroundColor: '#2563EB' }}
          testID="start-work-button"
        >
          {startWork.isPending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <View className="flex-row-reverse items-center gap-2">
              <Play size={20} color="#FFF" fill="#FFF" />
              <Text className="text-white font-bold text-lg">
                {'\u05D4\u05EA\u05D7\u05DC \u05E2\u05D1\u05D5\u05D3\u05D4'}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  color,
  delay,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} className="flex-1">
      <View
        className="rounded-2xl p-4"
        style={{
          backgroundColor: '#FFFFFF',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <Text className="text-xs font-medium mb-1" style={{ color: '#64748B', textAlign: 'right' }}>
          {title}
        </Text>
        <Text className="text-2xl font-bold mb-0.5" style={{ color, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
        <Text className="text-xs" style={{ color: '#94A3B8', textAlign: 'right' }}>
          {subtitle}
        </Text>
      </View>
    </Animated.View>
  );
}

function AdBanner() {
  const isPro = useSettingsStore((s) => s.isPro);
  const router = useRouter();

  if (isPro) return null;

  return (
    <Pressable
      onPress={() => router.push('/premium' as never)}
      className="mx-4 mb-4 rounded-2xl py-3 px-4"
      style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE' }}
      testID="ad-banner"
    >
      <Text className="text-center text-sm font-medium" style={{ color: '#2563EB' }}>
        {'\u2B50 \u05E9\u05D3\u05E8\u05D2\u05D5 \u05DC-PRO \u05DC\u05D4\u05E1\u05E8\u05EA \u05E4\u05E8\u05E1\u05D5\u05DE\u05D5\u05EA'}
      </Text>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const deviceId = useDeviceId();
  const router = useRouter();
  const { data: activeSession, isLoading } = useActiveSession(deviceId);
  const { data: weekStats } = useStats(deviceId, 'week');
  const { data: monthStats } = useStats(deviceId, 'month');

  const today = new Date();
  const hebrewDate = getHebrewDate(today);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8FAFC' }} testID="dashboard-screen">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} className="px-5 pt-4 pb-6">
          <Text className="text-2xl font-bold" style={{ color: '#0F172A', textAlign: 'right' }}>
            {'\u05D5\u05D5\u05E8\u05E7 \u05E7\u05DC\u05D5\u05E7'}
          </Text>
          <Text className="text-sm mt-1" style={{ color: '#64748B', textAlign: 'right' }}>
            {hebrewDate}
          </Text>
        </Animated.View>

        {/* Today Card */}
        <View className="mb-6">
          <Text className="text-lg font-bold px-5 mb-3" style={{ color: '#0F172A', textAlign: 'right' }}>
            {'\u05D4\u05D9\u05D5\u05DD \u05E9\u05DC\u05D9'}
          </Text>
          {isLoading ? (
            <View className="mx-4 p-12 items-center">
              <ActivityIndicator size="large" color="#2563EB" testID="loading-indicator" />
            </View>
          ) : activeSession ? (
            <ActiveSessionCard session={activeSession} deviceId={deviceId} />
          ) : (
            <EmptySessionCard deviceId={deviceId} />
          )}
        </View>

        {/* Summary Row */}
        <View className="flex-row-reverse gap-3 px-4 mb-6">
          <SummaryCard
            title={'\u05D4\u05E9\u05D1\u05D5\u05E2 \u05E9\u05DC\u05DA'}
            value={weekStats ? `${weekStats.totalHours.toFixed(1)}h` : '0h'}
            subtitle={`${weekStats?.workDaysCount ?? 0} \u05D9\u05DE\u05D9 \u05E2\u05D1\u05D5\u05D3\u05D4`}
            color="#2563EB"
            delay={100}
          />
          <SummaryCard
            title={'\u05D4\u05D7\u05D5\u05D3\u05E9 \u05E9\u05DC\u05DA'}
            value={monthStats ? `${monthStats.totalHours.toFixed(1)}h` : '0h'}
            subtitle={monthStats ? formatCurrency(monthStats.totalPay) : formatCurrency(0)}
            color="#059669"
            delay={200}
          />
        </View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} className="px-4 mb-6">
          <Text className="text-lg font-bold mb-3" style={{ color: '#0F172A', textAlign: 'right' }}>
            {'\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA \u05DE\u05D4\u05D9\u05E8\u05D5\u05EA'}
          </Text>
          <View className="flex-row-reverse gap-3">
            <QuickAction
              icon={<Plus size={20} color="#2563EB" />}
              label={'\u05D4\u05D5\u05E1\u05E3 \u05D9\u05D3\u05E0\u05D9\u05EA'}
              onPress={() => router.push('/add-edit-session' as never)}
              testID="quick-add-manual"
            />
            <QuickAction
              icon={<Clock size={20} color="#059669" />}
              label={'\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D4'}
              onPress={() => router.push('/(tabs)/history' as never)}
              testID="quick-history"
            />
            <QuickAction
              icon={<DollarSign size={20} color="#D97706" />}
              label={'\u05D4\u05D2\u05D3\u05E8 \u05E9\u05DB\u05E8'}
              onPress={() => router.push('/(tabs)/settings' as never)}
              testID="quick-settings"
            />
          </View>
        </Animated.View>

        {/* Ad Banner */}
        <AdBanner />
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      className="flex-1 rounded-2xl py-4 items-center"
      style={{
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
      testID={testID}
    >
      <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mb-2">
        {icon}
      </View>
      <Text className="text-xs font-medium" style={{ color: '#0F172A', textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}
