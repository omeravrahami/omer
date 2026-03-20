import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  CalendarDays,
  Coffee,
  CircleCheck,
  Shield,
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
  useSessions,
} from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import {
  getHebrewDate,
  formatTime,
  formatCurrency,
  getTimerDisplay,
  formatHours,
} from '@/lib/utils';
import {
  getBracketInfo,
  getSmartTips,
} from '@/lib/utils/tax-calc';
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
    <Animated.View entering={FadeInDown.duration(500)} testID="active-session-card">
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
  const [currentTime, setCurrentTime] = useState(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const iv = setInterval(() => {
      const n = new Date();
      setCurrentTime(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.15);

  useEffect(() => {
    glowOpacity.value = withRepeat(withTiming(0.35, { duration: 2500 }), -1, true);
  }, [glowOpacity]);

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startWork.mutate(undefined, {
      onSuccess: () => showToast('\u05DE\u05E9\u05DE\u05E8\u05EA \u05D4\u05EA\u05D7\u05D9\u05DC\u05D4!'),
      onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D4\u05EA\u05D7\u05DC\u05EA \u05DE\u05E9\u05DE\u05E8\u05EA', 'error'),
    });
  }, [startWork, showToast]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(600)}
      testID="empty-session-card"
      style={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 }}
    >
      {/* Ambient glow behind the time */}
      <Animated.View style={[{
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#1D4ED8',
        top: -20,
        alignSelf: 'center',
      }, glowStyle]} />

      {/* Current time display */}
      <Text
        style={{
          fontSize: 72,
          fontWeight: '200',
          color: '#FFFFFF',
          fontVariant: ['tabular-nums'],
          letterSpacing: 4,
          textShadowColor: 'rgba(96,165,250,0.5)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 24,
          marginBottom: 4,
        }}
      >
        {currentTime}
      </Text>

      {/* Subtitle */}
      <Text
        style={{
          color: 'rgba(255,255,255,0.38)',
          fontSize: 13,
          letterSpacing: 0.5,
          marginBottom: 28,
        }}
      >
        {'\u05DC\u05D7\u05E5 \u05DC\u05D4\u05EA\u05D7\u05DC\u05EA \u05DE\u05E9\u05DE\u05E8\u05EA'}
      </Text>

      {/* CTA Button — compact, centered, premium */}
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.95, { damping: 15 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
          onPress={handleStart}
          testID="start-work-button"
          style={{ borderRadius: 99, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={['#3B82F6', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 52,
              width: 220,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row-reverse',
              gap: 10,
            }}
          >
            {startWork.isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Play size={18} color="#FFF" fill="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 }}>
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

// ─── Tax Status Card ──────────────────────────────────────────────────────────

function TaxStatusCard() {
  const deviceId = useDeviceId();
  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const carBenefitMonthly = useSettingsStore((s) => s.carBenefitMonthly);
  const taxCreditPoints = useSettingsStore((s) => s.taxCreditPoints);
  const dailyGoalHours = useSettingsStore((s) => s.dailyGoalHours);

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const { data: sessions } = useSessions(deviceId, currentMonth);

  const totalNetHours = useMemo(
    () => (sessions ?? []).reduce((sum, s) => sum + s.netMinutes / 60, 0),
    [sessions]
  );
  const currentMonthlyGross = useMemo(
    () => totalNetHours * hourlyRate,
    [totalNetHours, hourlyRate]
  );

  const bracketInfo = useMemo(
    () => getBracketInfo(currentMonthlyGross, hourlyRate, carBenefitMonthly),
    [currentMonthlyGross, hourlyRate, carBenefitMonthly]
  );

  const tips = useMemo(
    () => getSmartTips(currentMonthlyGross, hourlyRate, carBenefitMonthly, taxCreditPoints, dailyGoalHours * 20, totalNetHours),
    [currentMonthlyGross, hourlyRate, carBenefitMonthly, taxCreditPoints, dailyGoalHours, totalNetHours]
  );

  const bracketRate = Math.round(bracketInfo.currentRate * 100);
  const isHighBracket = bracketRate >= 31;
  const badgeColor = isHighBracket ? '#F59E0B' : '#3B82F6';
  const badgeBg = isHighBracket ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)';

  // Progress toward next bracket (0–1)
  const progress = useMemo(() => {
    if (bracketInfo.isTopBracket || bracketInfo.monthlyAmountToNextBracket === null) return 1;
    // Find the current bracket threshold (monthly)
    // We know gross is before threshold by monthlyAmountToNextBracket
    const currentBracketMonthlyThreshold = currentMonthlyGross + bracketInfo.monthlyAmountToNextBracket;
    if (currentBracketMonthlyThreshold <= 0) return 0;
    // Find previous bracket threshold to compute span
    // Use tax config brackets (annual / 12)
    const annualBrackets = [0, 84120, 120720, 193800, 269280, 558240, 721560];
    const annualTaxable = (currentMonthlyGross + carBenefitMonthly) * 12;
    let prevThreshold = 0;
    for (let i = 0; i < annualBrackets.length; i++) {
      if (annualTaxable <= annualBrackets[i + 1] || i === annualBrackets.length - 1) {
        prevThreshold = annualBrackets[i] / 12;
        break;
      }
    }
    const span = currentBracketMonthlyThreshold - prevThreshold;
    if (span <= 0) return 0;
    return Math.min(1, Math.max(0, (currentMonthlyGross - prevThreshold) / span));
  }, [bracketInfo, currentMonthlyGross, carBenefitMonthly]);

  const firstTip = tips[0] ?? null;

  return (
    <Animated.View
      entering={FadeInUp.delay(150).duration(400)}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 18,
        shadowColor: '#0B1020',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 5,
      }}
      testID="tax-status-card"
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(6,182,212,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={17} color="#06B6D4" strokeWidth={2} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', textAlign: 'right' }}>
            {'\u05DE\u05E6\u05D1 \u05DE\u05E1 \u05D4\u05D7\u05D5\u05D3\u05E9'}
          </Text>
        </View>
        {/* Bracket badge */}
        <View style={{ backgroundColor: badgeBg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: badgeColor }}>
            {`\u05DE\u05D3\u05E8\u05D2\u05D4 ${bracketInfo.currentLabel}`}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ marginBottom: 10 }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: '#06B6D4',
            }}
          />
        </View>
      </View>

      {/* Hours to next bracket */}
      {!bracketInfo.isTopBracket && bracketInfo.hoursToNextBracket !== null ? (
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569', textAlign: 'right', marginBottom: 8 }}>
          {`\u05E0\u05E9\u05D0\u05E8\u05D5 ${Math.ceil(bracketInfo.hoursToNextBracket).toFixed(0)} \u05E9\u05E2\u05D5\u05EA \u05DC\u05DE\u05D3\u05E8\u05D2\u05D4 \u05D4\u05D1\u05D0\u05D4 (${bracketInfo.nextLabel ?? ''})`}
        </Text>
      ) : (
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569', textAlign: 'right', marginBottom: 8 }}>
          {'\u05D0\u05EA\u05D4 \u05D1\u05DE\u05D3\u05E8\u05D2\u05EA \u05D4\u05DE\u05E1 \u05D4\u05D2\u05D1\u05D5\u05D4\u05D4 \u05D1\u05D9\u05D5\u05EA\u05E8'}
        </Text>
      )}

      {/* Smart insight */}
      {firstTip ? (
        <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'right', lineHeight: 18 }}>
          {firstTip}
        </Text>
      ) : null}

      {/* Disclaimer */}
      <Text style={{ fontSize: 10, color: '#94A3B8', textAlign: 'right', marginTop: 8 }}>
        {'\u05D4\u05E2\u05E8\u05DB\u05D4 \u05D1\u05DC\u05D1\u05D3 \u05DC\u05E4\u05D9 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E7\u05D9\u05D9\u05DE\u05D9\u05DD'}
      </Text>
    </Animated.View>
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
        <View style={{ paddingTop: 12, paddingBottom: 24, minHeight: 180, justifyContent: 'center' }}>
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

          {/* Tax Status Card */}
          <TaxStatusCard />

          {/* Quick action cards */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
              <ActionCard
                icon={<Plus size={22} color="#2563EB" />}
                title={'\u05D4\u05D5\u05E1\u05E3 \u05DE\u05E9\u05DE\u05E8\u05EA'}
                subtitle={'\u05D4\u05D6\u05E0\u05D4 \u05D9\u05D3\u05E0\u05D9\u05EA'}
                color="#EFF6FF"
                accentColor="#2563EB"
                onPress={() => router.push('/add-edit-session' as never)}
                testID="quick-add-manual"
              />
              <ActionCard
                icon={<CalendarDays size={22} color="#059669" />}
                title={'\u05D4\u05D5\u05E1\u05E3 \u05D9\u05D5\u05DD'}
                subtitle={'\u05DE\u05D7\u05DC\u05D4 / \u05D7\u05D5\u05E4\u05E9'}
                color="#F0FDF4"
                accentColor="#059669"
                onPress={() => {
                  const now = new Date();
                  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  router.push(`/add-day-record?month=${monthKey}` as never);
                }}
                testID="quick-add-day-record"
              />
            </View>
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

// ─── Action Card ──────────────────────────────────────────────────────────────

function ActionCard({
  icon,
  title,
  subtitle,
  color,
  accentColor,
  onPress,
  testID,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  accentColor: string;
  onPress: () => void;
  testID: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        testID={testID}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: 18,
          alignItems: 'flex-end',
          shadowColor: '#0B1020',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 3,
        }}
      >
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}>
          {icon}
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', textAlign: 'right', marginBottom: 2 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'right' }}>
          {subtitle}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
