import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  Play,
  Square,
  Plus,
  Clock,
  BarChart3,
  SlidersHorizontal,
  Coffee,
  CircleCheck,
} from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import {
  useActiveSession,
  useStartWork,
  useEndWork,
  useStartBreak,
  useEndBreak,
  useStats,
} from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import {
  getHebrewDate,
  formatTime,
  formatCurrency,
  getTimerDisplay,
  formatHours,
} from '@/lib/utils';
import type { WorkSession } from '@/lib/types';

// ─── WorkClock Logo ───────────────────────────────────────────────────────────

function WorkClockLogo({ size }: { size: 'small' | 'large' }) {
  const isSmall = size === 'small';
  const iconSize = isSmall ? 22 : 32;
  const fontSize = isSmall ? 18 : 26;

  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      {/* Icon: Clock with Check overlay */}
      <View style={{ width: iconSize + 6, height: iconSize + 6, alignItems: 'center', justifyContent: 'center' }}>
        <Clock size={iconSize} color="#38BDF8" strokeWidth={2} />
        <View style={{ position: 'absolute', bottom: -1, right: -1 }}>
          <CircleCheck size={isSmall ? 12 : 16} color="#4ADE80" fill="#0B1020" strokeWidth={2.5} />
        </View>
      </View>
      {/* Brand text */}
      <Text
        style={{
          fontSize,
          fontWeight: '800',
          letterSpacing: 0.3,
        }}
      >
        <Text style={{ color: '#60A5FA' }}>Work</Text>
        <Text style={{ color: '#4ADE80' }}>Clock</Text>
      </Text>
    </View>
  );
}

// ─── Pulsing Status Dot ───────────────────────────────────────────────────────

function PulsingDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.25, { duration: 900 }), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginLeft: 6 },
        style,
      ]}
    />
  );
}

// ─── Ambient Glow ─────────────────────────────────────────────────────────────

function AmbientGlow({ isOnBreak }: { isOnBreak: boolean }) {
  const opacity = useSharedValue(0.08);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.18, { duration: 3000 }), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: isOnBreak ? '#D97706' : '#2563EB',
          alignSelf: 'center',
          top: '10%',
        },
        style,
      ]}
    />
  );
}

// ─── Active Session (Hero) ────────────────────────────────────────────────────

function ActiveSessionHero({
  session,
  deviceId,
}: {
  session: WorkSession;
  deviceId: string;
}) {
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

  const endScale = useSharedValue(1);
  const breakScale = useSharedValue(1);

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
      onSuccess: () =>
        showToast('\u05D4\u05DE\u05E9\u05DE\u05E8\u05EA \u05D4\u05E1\u05EA\u05D9\u05D9\u05DE\u05D4 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4!'),
      onError: () =>
        showToast('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E1\u05D9\u05D5\u05DD \u05D4\u05DE\u05E9\u05DE\u05E8\u05EA', 'error'),
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

  // Current pay calculation
  const timerParts = timer.split(':').map(Number);
  const netHours =
    (timerParts[0] ?? 0) + (timerParts[1] ?? 0) / 60 + (timerParts[2] ?? 0) / 3600;
  const currentPay = netHours * hourlyRate;

  const breaksCount = session.breaks?.length ?? 0;

  const endAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: endScale.value }],
  }));
  const breakAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breakScale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.duration(500)} testID="active-session-card" style={{ flex: 1 }}>
      {/* Glow */}
      <AmbientGlow isOnBreak={isOnBreak} />

      {/* Status badge */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 99,
            paddingHorizontal: 14,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              color: isOnBreak ? '#FCD34D' : '#86EFAC',
              fontSize: 13,
              fontWeight: '600',
            }}
          >
            {isOnBreak ? '\u05D1\u05D4\u05E4\u05E1\u05E7\u05D4' : '\u05E2\u05D5\u05D1\u05D3'}
          </Text>
          <PulsingDot color={isOnBreak ? '#FCD34D' : '#4ADE80'} />
        </View>
      </View>

      {/* Timer */}
      <Text
        style={{
          textAlign: 'center',
          fontSize: 64,
          fontWeight: '700',
          color: isOnBreak ? '#FBBF24' : '#FFFFFF',
          fontVariant: ['tabular-nums'],
          letterSpacing: 2,
          textShadowColor: isOnBreak ? 'rgba(251,191,36,0.4)' : 'rgba(96,165,250,0.4)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 20,
        }}
        testID="live-timer"
      >
        {timer}
      </Text>

      {/* Inline stats row */}
      <View
        style={{
          flexDirection: 'row-reverse',
          justifyContent: 'space-around',
          marginTop: 20,
          marginBottom: 4,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
            {formatTime(session.startTime)}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3 }}>
            {'\u05E9\u05E2\u05EA \u05D4\u05EA\u05D7\u05DC\u05D4'}
          </Text>
        </View>
        <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 2 }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
            {breaksCount}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3 }}>
            {'\u05D4\u05E4\u05E1\u05E7\u05D5\u05EA'}
          </Text>
        </View>
        {showSalary ? (
          <>
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 2 }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                {formatCurrency(currentPay, currency)}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3 }}>
                {'\u05E9\u05DB\u05E8'}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row-reverse', gap: 12, paddingHorizontal: 20, marginTop: 24, paddingBottom: 8 }}>
        {/* End work */}
        <Animated.View style={[{ flex: 1 }, endAnimStyle]}>
          <Pressable
            onPressIn={() => { endScale.value = withSpring(0.96); }}
            onPressOut={() => { endScale.value = withSpring(1); }}
            onPress={handleEndWork}
            testID="end-work-button"
            style={{ borderRadius: 18, overflow: 'hidden', height: 52 }}
          >
            <LinearGradient
              colors={['#DC2626', '#B91C1C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row-reverse',
                gap: 8,
                shadowColor: '#DC2626',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
              }}
            >
              <Square size={16} color="#FFF" fill="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>
                {'\u05E1\u05D9\u05D9\u05DD \u05E2\u05D1\u05D5\u05D3\u05D4'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Break toggle */}
        <Animated.View style={[{ flex: 1 }, breakAnimStyle]}>
          <Pressable
            onPressIn={() => { breakScale.value = withSpring(0.96); }}
            onPressOut={() => { breakScale.value = withSpring(1); }}
            onPress={handleBreakToggle}
            testID="break-toggle-button"
            style={{ borderRadius: 18, overflow: 'hidden', height: 52 }}
          >
            <LinearGradient
              colors={
                isOnBreak
                  ? ['#059669', '#047857']
                  : ['#D97706', '#B45309']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row-reverse',
                gap: 8,
              }}
            >
              {isOnBreak ? (
                <Play size={16} color="#FFF" fill="#FFF" />
              ) : (
                <Coffee size={16} color="#FFF" />
              )}
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>
                {isOnBreak
                  ? '\u05D7\u05D6\u05D5\u05E8 \u05DC\u05E2\u05D1\u05D5\u05D3\u05D4'
                  : '\u05D4\u05E4\u05E1\u05E7\u05D4'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ─── Empty State (Hero) ───────────────────────────────────────────────────────

function EmptySessionHero({ deviceId }: { deviceId: string }) {
  const startWork = useStartWork(deviceId);
  const showToast = useToastStore((s) => s.showToast);

  const scale = useSharedValue(1);

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startWork.mutate(undefined, {
      onSuccess: () =>
        showToast('\u05DE\u05E9\u05DE\u05E8\u05EA \u05D4\u05EA\u05D7\u05D9\u05DC\u05D4!'),
      onError: () =>
        showToast('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D4\u05EA\u05D7\u05DC\u05EA \u05DE\u05E9\u05DE\u05E8\u05EA', 'error'),
    });
  }, [startWork, showToast]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(600)}
      testID="empty-session-card"
      style={{ alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8 }}
    >
      {/* Icon area */}
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: 'rgba(37,99,235,0.08)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
      >
        {/* Outer ring */}
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            borderWidth: 2,
            borderColor: 'rgba(96,165,250,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Inner ring */}
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              borderWidth: 2,
              borderColor: 'rgba(96,165,250,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Clock hands */}
            <View
              style={{
                width: 2,
                height: 14,
                backgroundColor: '#60A5FA',
                borderRadius: 1,
                position: 'absolute',
                top: 8,
                alignSelf: 'center',
              }}
            />
            <View
              style={{
                width: 10,
                height: 2,
                backgroundColor: '#60A5FA',
                borderRadius: 1,
                position: 'absolute',
                left: 13,
                alignSelf: 'center',
              }}
            />
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#60A5FA',
                alignSelf: 'center',
              }}
            />
          </View>
        </View>
      </View>

      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 20,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 8,
          letterSpacing: 0.3,
        }}
      >
        {'\u05E2\u05D5\u05D3 \u05DC\u05D0 \u05D4\u05EA\u05D7\u05DC\u05EA\u05DD \u05DE\u05E9\u05DE\u05E8\u05EA'}
      </Text>
      <Text
        style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: 14,
          textAlign: 'center',
          marginBottom: 32,
        }}
      >
        {'\u05DC\u05D7\u05E6\u05D5 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05DC\u05E2\u05E7\u05D5\u05D1'}
      </Text>

      {/* CTA Button */}
      <Animated.View style={[{ width: '100%' }, animStyle]}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.96, { damping: 15 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
          onPress={handleStart}
          testID="start-work-button"
          style={{ borderRadius: 18, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={['#2563EB', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 64,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row-reverse',
              gap: 10,
              shadowColor: '#2563EB',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 20,
            }}
          >
            {startWork.isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Play size={22} color="#FFF" fill="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '700', letterSpacing: 0.5 }}>
                  {'\u05D4\u05EA\u05D7\u05DC \u05E2\u05D1\u05D5\u05D3\u05D4'}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Ad Banner ────────────────────────────────────────────────────────────────

function AdBanner() {
  const isPro = useSettingsStore((s) => s.isPro);
  const router = useRouter();

  if (isPro) return null;

  return (
    <Pressable
      onPress={() => router.push('/premium' as never)}
      testID="ad-banner"
      style={{ marginHorizontal: 16, marginBottom: 16, borderRadius: 14, overflow: 'hidden' }}
    >
      <LinearGradient
        colors={['#1E293B', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', textAlign: 'center' }}>
          {'\u26A1 \u05E9\u05D3\u05E8\u05D2\u05D5 \u05DC-PRO \u2014 \u05D1\u05DC\u05D9 \u05E4\u05E8\u05E1\u05D5\u05DE\u05D5\u05EA'}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const deviceId = useDeviceId();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: activeSession, isLoading } = useActiveSession(deviceId);
  const { data: weekStats } = useStats(deviceId, 'week');
  const { data: monthStats } = useStats(deviceId, 'month');

  const today = new Date();
  const hebrewDate = getHebrewDate(today);

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }} testID="dashboard-screen">
      {/* Dark hero section */}
      <View style={{ backgroundColor: '#0B1020', paddingTop: insets.top }}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(350)}
          style={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 12,
            flexDirection: 'row-reverse',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ alignItems: 'flex-end' }}>
            <WorkClockLogo size="small" />
            <Text style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 2, letterSpacing: 0.3 }}>
              {hebrewDate}
            </Text>
          </View>
        </Animated.View>

        {/* Hero content */}
        <View style={{ paddingTop: 20, paddingBottom: 32, minHeight: 300, justifyContent: 'center' }}>
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color="#60A5FA" testID="loading-indicator" />
            </View>
          ) : activeSession ? (
            <ActiveSessionHero session={activeSession} deviceId={deviceId} />
          ) : (
            <EmptySessionHero deviceId={deviceId} />
          )}
        </View>
      </View>

      {/* Light section with top rounding */}
      <View
        style={{
          flex: 1,
          backgroundColor: '#F1F5F9',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          marginTop: -28,
        }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 20 }}
        >
          {/* Weekly / Monthly stats */}
          <Animated.View entering={FadeInUp.delay(100).duration(400)}>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                marginHorizontal: 16,
                marginBottom: 16,
                flexDirection: 'row-reverse',
                overflow: 'hidden',
                shadowColor: '#0B1020',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 4,
              }}
            >
              {/* Week */}
              <View style={{ flex: 1, paddingVertical: 18, paddingHorizontal: 20, alignItems: 'flex-end' }}>
                <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '500', marginBottom: 4, textAlign: 'right' }}>
                  {'\u05D4\u05E9\u05D1\u05D5\u05E2'}
                </Text>
                <Text
                  style={{
                    color: '#2563EB',
                    fontSize: 28,
                    fontWeight: '700',
                    fontVariant: ['tabular-nums'],
                    lineHeight: 32,
                  }}
                >
                  {weekStats ? `${weekStats.totalHours.toFixed(1)}h` : '0h'}
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 3 }}>
                  {`${weekStats?.workDaysCount ?? 0} \u05D9\u05DE\u05D9\u05DD`}
                </Text>
              </View>

              {/* Separator */}
              <View style={{ width: 1, backgroundColor: '#F1F5F9', marginVertical: 14 }} />

              {/* Month */}
              <View style={{ flex: 1, paddingVertical: 18, paddingHorizontal: 20, alignItems: 'flex-end' }}>
                <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '500', marginBottom: 4, textAlign: 'right' }}>
                  {'\u05D4\u05D7\u05D5\u05D3\u05E9'}
                </Text>
                <Text
                  style={{
                    color: '#059669',
                    fontSize: 28,
                    fontWeight: '700',
                    fontVariant: ['tabular-nums'],
                    lineHeight: 32,
                  }}
                >
                  {monthStats ? `${monthStats.totalHours.toFixed(1)}h` : '0h'}
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 3 }}>
                  {monthStats ? formatCurrency(monthStats.totalPay) : formatCurrency(0)}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Quick action pills */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
              style={{ flexGrow: 0, marginBottom: 20 }}
            >
              <QuickPill
                icon={<Plus size={16} color="#2563EB" />}
                label={'\u05D4\u05D5\u05E1\u05E3 \u05D9\u05D3\u05E0\u05D9\u05EA'}
                onPress={() => router.push('/add-edit-session' as never)}
                testID="quick-add-manual"
              />
              <QuickPill
                icon={<Clock size={16} color="#059669" />}
                label={'\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D4'}
                onPress={() => router.push('/(tabs)/history' as never)}
                testID="quick-history"
              />
              <QuickPill
                icon={<BarChart3 size={16} color="#7C3AED" />}
                label={'\u05E1\u05D9\u05DB\u05D5\u05DE\u05D9\u05DD'}
                onPress={() => router.push('/(tabs)/reports' as never)}
                testID="quick-reports"
              />
              <QuickPill
                icon={<SlidersHorizontal size={16} color="#D97706" />}
                label={'\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA'}
                onPress={() => router.push('/(tabs)/settings' as never)}
                testID="quick-settings"
              />
            </ScrollView>
          </Animated.View>

          {/* Ad Banner */}
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <AdBanner />
          </Animated.View>
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Quick Pill ───────────────────────────────────────────────────────────────

function QuickPill({
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
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.94, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        testID={testID}
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 99,
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 7,
          shadowColor: '#0B1020',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        {icon}
        <Text style={{ color: '#0F172A', fontSize: 13, fontWeight: '600' }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
