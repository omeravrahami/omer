import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  BarChart2,
} from 'lucide-react-native';
import { useSettingsStore, type OneTimeAddition } from '@/lib/state/settings-store';
import { useShallow } from 'zustand/react/shallow';
import {
  useAuthActiveSession,
  useAuthStartWork,
  useAuthEndWork,
  useAuthStartBreak,
  useAuthEndBreak,
  useAuthStats,
  useAuthSessions,
} from '@/lib/api/workclock-api';
import { useAuthStore } from '@/lib/state/auth-store';
import { useToastStore } from '@/lib/state/toast-store';
import {
  getHebrewDate,
  formatTime,
  formatCurrency,
  getTimerDisplay,
  formatHours,
} from '@/lib/utils';
import {
  calcIsraeliTax,
  getBracketInfo,
  getSmartTips,
  type TaxResult,
} from '@/lib/utils/tax-calc';
import { calcRegionalTax, type RegionalTaxInput } from '@/lib/utils/regional-tax-engine';
import { calcOvertimePay, calcOvertimePayMonthly } from '@/lib/utils/overtime-calc';
import { AdBanner as AdBannerComponent } from '@/components/ads/AdBanner';
import MoneyCharacter, { type MoneyCharacterState } from '@/components/MoneyCharacter';
import { InsightsCards } from '@/components/InsightsCards';
import type { WorkSession } from '@/lib/types';
import { checkAndClearPendingReview } from '@/lib/review-utils';
import ReviewPromptModal from '@/components/ReviewPromptModal';

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

// ─── Active Session (Hero) ────────────────────────────────────────────────────

function ActiveSessionHero({
  session,
  token,
}: {
  session: WorkSession;
  token: string;
}) {
  const [timer, setTimer] = useState('00:00:00');
  const showCharacterActive = useSettingsStore((s) => s.showCharacter);
  const showToast = useToastStore((s) => s.showToast);

  const activeBreak = session.breaks?.find((b) => !b.endTime);
  const isOnBreak = !!activeBreak;

  const endWork = useAuthEndWork(token, session.id);
  const startBreakMut = useAuthStartBreak(token, session.id);
  const endBreakMut = useAuthEndBreak(token, session.id, activeBreak?.id ?? '');

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

  const handleBreakToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOnBreak && activeBreak) {
      endBreakMut.mutate(undefined, {
        onSuccess: () => showToast('\u05D7\u05D6\u05E8\u05EA\u05DD \u05DC\u05E2\u05D1\u05D5\u05D3\u05D4!'),
        onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4', 'error'),
      });
    } else {
      startBreakMut.mutate(undefined, {
        onSuccess: () => showToast('\u05D4\u05E4\u05E1\u05E7\u05D4 \u05D4\u05EA\u05D7\u05D9\u05DC\u05D4'),
        onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4', 'error'),
      });
    }
  }, [isOnBreak, activeBreak, endBreakMut, startBreakMut, showToast]);

  const handleEndWork = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    endWork.mutate(undefined, {
      onSuccess: () => showToast('\u05D4\u05DE\u05E9\u05DE\u05E8\u05EA \u05D4\u05E1\u05EA\u05D9\u05D9\u05DE\u05D4 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4!'),
      onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E1\u05D9\u05D5\u05DD \u05D4\u05DE\u05E9\u05DE\u05E8\u05EA', 'error'),
    });
  }, [endWork, showToast]);

  const timerColor = isOnBreak ? '#FBBF24' : '#FFFFFF';
  const glowColor = isOnBreak ? 'rgba(251,191,36,0.35)' : 'rgba(96,165,250,0.35)';

  const breakScale = useSharedValue(1);
  const endScale = useSharedValue(1);
  const breakAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: breakScale.value }] }));
  const endAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: endScale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      testID="active-session-card"
      style={{ paddingHorizontal: 24, paddingVertical: 8 }}
    >
      {/* Timer row: character to side + big timer centered */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        {showCharacterActive ? (
          <MoneyCharacter state={isOnBreak ? 'break' : 'working'} size={72} />
        ) : null}

        {/* Timer block */}
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              color: timerColor,
              fontSize: 48,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
              letterSpacing: 1,
              textShadowColor: glowColor,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 16,
            }}
            testID="live-timer"
          >
            {timer}
          </Text>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
            <PulsingDot color={isOnBreak ? '#FCD34D' : '#4ADE80'} />
            <Text style={{
              color: isOnBreak ? '#FCD34D' : '#86EFAC',
              fontSize: 13,
              fontWeight: '600',
              letterSpacing: 0.3,
            }}>
              {isOnBreak ? '\u05D1\u05D4\u05E4\u05E1\u05E7\u05D4' : '\u05E2\u05D5\u05D1\u05D3'}
            </Text>
          </View>
        </View>
      </View>

      {/* Action buttons row */}
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 14 }}>
        {/* End work */}
        <Animated.View style={[{ flex: 1 }, endAnimStyle]}>
          <Pressable
            onPressIn={() => { endScale.value = withSpring(0.96); }}
            onPressOut={() => { endScale.value = withSpring(1); }}
            onPress={handleEndWork}
            testID="end-work-button"
            style={{ borderRadius: 14, overflow: 'hidden', height: 44 }}
          >
            <LinearGradient
              colors={['#DC2626', '#B91C1C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 7 }}
            >
              {endWork.isPending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Square size={13} color="#FFF" fill="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                    {'\u05E1\u05D9\u05D9\u05DD \u05E2\u05D1\u05D5\u05D3\u05D4'}
                  </Text>
                </>
              )}
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
            style={{ borderRadius: 14, overflow: 'hidden', height: 44 }}
          >
            <LinearGradient
              colors={isOnBreak ? ['#059669', '#047857'] : ['#D97706', '#B45309']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 7 }}
            >
              {isOnBreak ? (
                <Play size={13} color="#FFF" fill="#FFF" />
              ) : (
                <Coffee size={13} color="#FFF" />
              )}
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                {isOnBreak ? '\u05D7\u05D6\u05D5\u05E8 \u05DC\u05E2\u05D1\u05D5\u05D3\u05D4' : '\u05D4\u05E4\u05E1\u05E7\u05D4'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ─── Empty State (Hero) ───────────────────────────────────────────────────────

function EmptySessionHero({ token }: { token: string }) {
  const startWork = useAuthStartWork(token);
  const showToast = useToastStore((s) => s.showToast);
  const showCharacterEmpty = useSettingsStore((s) => s.showCharacter);

  const characterState: MoneyCharacterState = useMemo(() => {
    const h = new Date().getHours();
    return h >= 22 || h < 6 ? 'sleeping' : 'idle';
  }, []);

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startWork.mutate(undefined, {
      onSuccess: () => showToast('\u05DE\u05E9\u05DE\u05E8\u05EA \u05D4\u05EA\u05D7\u05D9\u05DC\u05D4!'),
      onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D4\u05EA\u05D7\u05DC\u05EA \u05DE\u05E9\u05DE\u05E8\u05EA', 'error'),
    });
  }, [startWork, showToast]);

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      testID="empty-session-card"
      style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 0, gap: 0 }}
    >
      {/* Character — centered, main visual */}
      {showCharacterEmpty ? (
        <MoneyCharacter state={characterState} size={100} />
      ) : (
        <View style={{ height: 16 }} />
      )}

      {/* Wide pill start button */}
      <Animated.View style={[animStyle, { width: '100%', marginTop: 6 }]}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
          onPress={handleStart}
          testID="start-work-button"
          style={{ borderRadius: 99, overflow: 'hidden', height: 52 }}
        >
          <LinearGradient
            colors={['#2563EB', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              flex: 1,
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
                <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 }}>
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
  return <AdBannerComponent />;
}

// ─── Monthly Salary Breakdown Card ────────────────────────────────────────────

function MonthlySalaryCard({
  baseGross,
  taxResult,
  carBenefitMonthly,
  carGrossupMonthly,
  bonusAdditions,
  giftAdditions,
}: {
  baseGross: number;
  taxResult: TaxResult;
  carBenefitMonthly: number;
  carGrossupMonthly: number;
  bonusAdditions: OneTimeAddition[];
  giftAdditions: OneTimeAddition[];
}) {
  const router = useRouter();
  if (taxResult.taxableGross <= 0 && baseGross <= 0) return null;

  const regularGross = taxResult.regularGross;
  const taxableGross = taxResult.taxableGross;

  type RowKind = 'income' | 'deduction' | 'neutral' | 'total';

  const incomeRows: { label: string; value: number; kind: RowKind; icon: string; sub?: string }[] = [
    { label: 'שכר בסיס', value: baseGross, kind: 'income', icon: '💰', sub: 'שעות × שכר שעתי' },
    ...(carGrossupMonthly > 0
      ? [{ label: 'גילום רכב', value: carGrossupMonthly, kind: 'neutral' as RowKind, icon: '🚗', sub: 'נכנס לנטו' }]
      : []),
    ...bonusAdditions.map(a => ({ label: a.name, value: a.amount, kind: 'income' as RowKind, icon: '💎', sub: 'בונוס' })),
  ];

  const taxOnlyRows: { label: string; value: number; icon: string; sub?: string }[] = [
    ...(carBenefitMonthly > 0
      ? [{ label: 'שווי שימוש ברכב', value: carBenefitMonthly, icon: '🚗', sub: 'לצורכי מס בלבד' }]
      : []),
    ...giftAdditions.map(a => ({ label: a.name, value: a.amount, icon: '🎁', sub: 'לצורכי מס בלבד' })),
  ];

  const deductionRows: { label: string; value: number; kind: RowKind; icon: string }[] = [
    { label: 'מס הכנסה', value: taxResult.incomeTax, kind: 'deduction', icon: '📊' },
    { label: 'ביטוח לאומי', value: taxResult.nationalInsurance, kind: 'deduction', icon: '🏥' },
    { label: 'ביטוח בריאות', value: taxResult.healthInsurance, kind: 'deduction', icon: '💊' },
    ...(taxResult.trainingFundDeduction > 0
      ? [{ label: 'קרן השתלמות', value: taxResult.trainingFundDeduction, kind: 'deduction' as RowKind, icon: '🏦' }]
      : []),
  ];

  const Row = ({ label, value, kind, icon, sub }: { label: string; value: number; kind: RowKind; icon: string; sub?: string }) => {
    const color = kind === 'income' ? '#22C55E' : kind === 'deduction' ? '#F87171' : '#94A3B8';
    return (
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
          <Text style={{ fontSize: 15 }}>{icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#CBD5E1', textAlign: 'right' }}>{label}</Text>
            {sub ? <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 1 }}>{sub}</Text> : null}
          </View>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color, fontVariant: ['tabular-nums'] }}>
          {kind === 'deduction' ? `-${formatCurrency(value)}` : formatCurrency(value)}
        </Text>
      </View>
    );
  };

  const Divider = () => (
    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 }} />
  );

  return (
    <Animated.View
      entering={FadeInUp.delay(180).duration(400)}
      style={{
        backgroundColor: '#0D1526',
        borderRadius: 20,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(59,130,246,0.15)',
        shadowColor: '#3B82F6',
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
      testID="monthly-salary-card"
    >
      {/* Header */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16 }}>{'💼'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#F0F6FF', textAlign: 'right' }}>{'פירוט משכורת חודש נוכחי'}</Text>
        </View>
      </View>

      {/* 3-pill stat strip */}
      <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(59,130,246,0.05)', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.1)' }}>
          <Text style={{ fontSize: 9, color: 'rgba(148,163,184,0.7)', marginBottom: 3 }}>{'ברוטו רגיל'}</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(96,165,250,0.6)', fontVariant: ['tabular-nums'] }}>{formatCurrency(regularGross)}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: 'rgba(245,158,11,0.05)', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245,158,11,0.1)' }}>
          <Text style={{ fontSize: 9, color: 'rgba(148,163,184,0.7)', marginBottom: 3 }}>{'ברוטו למס'}</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(245,158,11,0.6)', fontVariant: ['tabular-nums'] }}>{formatCurrency(taxableGross)}</Text>
        </View>
        <View style={{ flex: 1.4, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' }}>
          <Text style={{ fontSize: 9, color: '#86EFAC', marginBottom: 3, fontWeight: '700' }}>{'נטו לקבלה'}</Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#22c55e', fontVariant: ['tabular-nums'], textShadowColor: 'rgba(34,197,94,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}>{formatCurrency(taxResult.finalTakeHome)}</Text>
        </View>
      </View>

      {/* Income rows */}
      {incomeRows.map((r, i) => <Row key={i} {...r} />)}

      {/* ברוטו רגיל summary line */}
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#60A5FA', textAlign: 'right' }}>{'= ברוטו רגיל'}</Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#60A5FA', fontVariant: ['tabular-nums'] }}>{formatCurrency(regularGross)}</Text>
      </View>

      {/* Tax-only additions */}
      {taxOnlyRows.length > 0 ? (
        <>
          <Divider />
          <View style={{ paddingVertical: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#F59E0B', textAlign: 'right', marginBottom: 4, letterSpacing: 0.5 }}>
              {'זקיפות מס (לא מזומן)'}
            </Text>
            {taxOnlyRows.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, opacity: 0.75 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text style={{ fontSize: 15 }}>{r.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#CBD5E1', textAlign: 'right' }}>{r.label}</Text>
                    {r.sub ? <Text style={{ fontSize: 10, color: '#F59E0B', textAlign: 'right', marginTop: 1 }}>{r.sub}</Text> : null}
                  </View>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B', fontVariant: ['tabular-nums'] }}>{formatCurrency(r.value)}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B', textAlign: 'right' }}>{'= ברוטו למס'}</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#F59E0B', fontVariant: ['tabular-nums'] }}>{formatCurrency(taxableGross)}</Text>
          </View>
        </>
      ) : null}

      <Divider />

      {/* Deduction rows */}
      {deductionRows.map((r, i) => <Row key={i} {...r} />)}

      {/* Net pay subtotal */}
      <Divider />
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 }}>
        <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'right' }}>{'נטו לפני נסיעות'}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#F0F6FF', fontVariant: ['tabular-nums'] }}>
          {formatCurrency(taxResult.netPay)}
        </Text>
      </View>

      {/* Transportation */}
      {taxResult.transportationAllowance > 0 ? (
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 14 }}>{'🚌'}</Text>
            <Text style={{ fontSize: 13, color: '#CBD5E1' }}>{'נסיעות / החזר'}</Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#22C55E', fontVariant: ['tabular-nums'] }}>
            {`+${formatCurrency(taxResult.transportationAllowance)}`}
          </Text>
        </View>
      ) : null}

      {/* Final take-home */}
      <View style={{
        backgroundColor: 'rgba(34,197,94,0.1)',
        borderRadius: 12,
        padding: 14,
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.2)',
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#F0F6FF' }}>{'נטו לקבלה'}</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#22c55e', fontVariant: ['tabular-nums'], textShadowColor: 'rgba(34,197,94,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}>
          {formatCurrency(taxResult.finalTakeHome)}
        </Text>
      </View>

      {/* Link to full insights */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/(tabs)/reports' as never);
        }}
        testID="view-full-insights-link"
        style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}
      >
        <Text style={{ fontSize: 12, color: '#3B82F6', fontWeight: '600' }}>{'לפירוט מלא ← תובנות'}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Tax Status Card ──────────────────────────────────────────────────────────

function TaxStatusCard() {
  const token = useAuthStore((s) => s.token) ?? '';
  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const carBenefitMonthly = useSettingsStore((s) => s.carBenefitMonthly);
  const taxCreditPoints = useSettingsStore((s) => s.taxCreditPoints);
  const dailyGoalHours = useSettingsStore((s) => s.dailyGoalHours);
  const carGrossupMonthly = useSettingsStore((s) => s.carGrossupMonthly);
  const oneTimeAdditions = useSettingsStore(useShallow((s) => s.oneTimeAdditions));
  const employerPensionRate = useSettingsStore((s) => s.employerPensionRate);
  const overtimeEnabled = useSettingsStore((s) => s.overtimeEnabled);
  const overtimeMode = useSettingsStore((s) => s.overtimeMode);
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const { data: sessions } = useAuthSessions(token, currentMonth);

  // Filter out sick/vacation — same as reports page
  const shiftSessions = useMemo(
    () => (sessions ?? []).filter((s: WorkSession) => s.sessionType !== 'sick' && s.sessionType !== 'vacation'),
    [sessions]
  );

  const totalNetHours = useMemo(
    () => shiftSessions.reduce((sum: number, s: WorkSession) => sum + s.netMinutes / 60, 0),
    [shiftSessions]
  );

  const oneTimeBonusTotal = useMemo(
    () => oneTimeAdditions.filter((a) => a.month === currentMonth && a.isGross && !a.isTaxOnly).reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, currentMonth]
  );
  const oneTimeGiftTotal = useMemo(
    () => oneTimeAdditions.filter((a) => a.month === currentMonth && a.isTaxOnly).reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, currentMonth]
  );
  const oneTimePensionTotal = useMemo(
    () => oneTimeAdditions.filter((a) => a.month === currentMonth && a.isPension).reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, currentMonth]
  );
  const oneTimeTotal = oneTimeBonusTotal + oneTimeGiftTotal;

  // Overtime-aware base gross — same as reports page
  const currentMonthlyGross = useMemo(() => {
    if (!overtimeEnabled) return totalNetHours * hourlyRate;
    if (overtimeMode === 'daily') return calcOvertimePayMonthly(shiftSessions, hourlyRate);
    const totalNetMinutes = shiftSessions.reduce((sum: number, s: WorkSession) => sum + s.netMinutes, 0);
    return calcOvertimePay(totalNetMinutes, hourlyRate, 'monthly');
  }, [shiftSessions, totalNetHours, hourlyRate, overtimeEnabled, overtimeMode]);

  const combinedBenefits = carBenefitMonthly + carGrossupMonthly + oneTimeTotal;

  const bracketInfo = useMemo(
    () => getBracketInfo(currentMonthlyGross, hourlyRate, combinedBenefits),
    [currentMonthlyGross, hourlyRate, combinedBenefits]
  );

  const tips = useMemo(
    () => getSmartTips(currentMonthlyGross, hourlyRate, combinedBenefits, taxCreditPoints, dailyGoalHours * 20, totalNetHours),
    [currentMonthlyGross, hourlyRate, combinedBenefits, taxCreditPoints, dailyGoalHours, totalNetHours]
  );

  const bracketRate = Math.round(bracketInfo.currentRate * 100);
  const isHighBracket = bracketRate >= 31;
  const badgeColor = isHighBracket ? '#F59E0B' : '#3B82F6';
  const badgeBg = isHighBracket ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)';

  // Progress toward next bracket (0–1)
  const progress = useMemo(() => {
    if (bracketInfo.isTopBracket || bracketInfo.monthlyAmountToNextBracket === null) return 1;
    const currentBracketMonthlyThreshold = currentMonthlyGross + bracketInfo.monthlyAmountToNextBracket;
    if (currentBracketMonthlyThreshold <= 0) return 0;
    const annualBrackets = [0, 81480, 116760, 187440, 253800, 663240];
    const annualTaxable = (currentMonthlyGross + carBenefitMonthly + carGrossupMonthly + oneTimeTotal) * 12;
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
  }, [bracketInfo, currentMonthlyGross, carBenefitMonthly, carGrossupMonthly, oneTimeTotal]);

  const firstTip = tips[0] ?? null;
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/tax-brackets' as never);
      }}
      testID="tax-status-card-pressable"
    >
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
      <Text style={{ fontSize: 10, color: '#CBD5E1', textAlign: 'center', marginTop: 6 }}>
        {'לחץ לפרטי מדרגות המס ←'}
      </Text>
    </Animated.View>
    </Pressable>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const token = useAuthStore((s) => s.token) ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: activeSession, isLoading } = useAuthActiveSession(token);
  const { data: weekStats } = useAuthStats(token, 'week');

  const currentMonthKey = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Fetch current-month sessions directly (same source as reports page)
  const { data: currentMonthSessions } = useAuthSessions(token, currentMonthKey);

  const hourlyRateHome   = useSettingsStore((s) => s.hourlyRate);
  const carBenefitHome   = useSettingsStore((s) => s.carBenefitMonthly);
  const carGrossupHome   = useSettingsStore((s) => s.carGrossupMonthly);
  const overtimeEnabledHome = useSettingsStore((s) => s.overtimeEnabled);
  const overtimeModeHome    = useSettingsStore((s) => s.overtimeMode);
  const oneTimeAdditionsHome = useSettingsStore(useShallow((s) => s.oneTimeAdditions));
  const taxCreditPointsHome  = useSettingsStore((s) => s.taxCreditPoints);
  const trainingFundValueHome = useSettingsStore((s) => s.trainingFundValue);
  const trainingFundTypeHome  = useSettingsStore((s) => s.trainingFundType);
  const transportationValueHome = useSettingsStore((s) => s.transportationValue);
  const transportationTypeHome  = useSettingsStore((s) => s.transportationType);
  const employerPensionRateHome = useSettingsStore((s) => s.employerPensionRate);
  const regionHome = useSettingsStore((s) => s.region);
  const isPremiumHome = useSettingsStore((s) => s.isPremium);

  // Filter shifts — same as reports page
  const currentMonthShifts = useMemo(
    () => (currentMonthSessions ?? []).filter((s: WorkSession) => s.sessionType !== 'sick' && s.sessionType !== 'vacation'),
    [currentMonthSessions]
  );

  // Base gross (overtime-aware) — identical logic to reports page
  const baseMonthlyGross = useMemo(() => {
    if (!overtimeEnabledHome) return currentMonthShifts.reduce((t: number, s: WorkSession) => t + (s.netMinutes / 60) * hourlyRateHome, 0);
    if (overtimeModeHome === 'daily') return calcOvertimePayMonthly(currentMonthShifts, hourlyRateHome);
    const totalNetMinutes = currentMonthShifts.reduce((t: number, s: WorkSession) => t + s.netMinutes, 0);
    return calcOvertimePay(totalNetMinutes, hourlyRateHome, 'monthly');
  }, [currentMonthShifts, hourlyRateHome, overtimeEnabledHome, overtimeModeHome]);

  const oneTimeBonusTotalHome = useMemo(
    () => oneTimeAdditionsHome.filter(a => a.month === currentMonthKey && a.isGross && !a.isTaxOnly).reduce((t, a) => t + a.amount, 0),
    [oneTimeAdditionsHome, currentMonthKey]
  );
  const oneTimeGiftTotalHome = useMemo(
    () => oneTimeAdditionsHome.filter(a => a.month === currentMonthKey && a.isTaxOnly).reduce((t, a) => t + a.amount, 0),
    [oneTimeAdditionsHome, currentMonthKey]
  );
  const oneTimePensionTotalHome = useMemo(
    () => oneTimeAdditionsHome.filter(a => a.month === currentMonthKey && a.isPension).reduce((t, a) => t + a.amount, 0),
    [oneTimeAdditionsHome, currentMonthKey]
  );

  const totalNetHoursHome = useMemo(
    () => currentMonthShifts.reduce((t: number, s: WorkSession) => t + s.netMinutes / 60, 0),
    [currentMonthShifts]
  );

  // Full tax calculation — same inputs as reports page
  const homeTaxResult = useMemo(
    () => calcRegionalTax({
      region: (regionHome as 'IL' | 'US' | 'UK' | 'EU') || 'IL',
      monthlyGross: baseMonthlyGross,
      carBenefitMonthly: carBenefitHome,
      carGrossupMonthly: carGrossupHome,
      creditPoints: taxCreditPointsHome,
      trainingFundValue: trainingFundValueHome,
      trainingFundType: trainingFundTypeHome,
      transportationValue: transportationValueHome,
      transportationType: transportationTypeHome,
      oneTimeBonusTotal: oneTimeBonusTotalHome,
      oneTimeGiftTotal: oneTimeGiftTotalHome,
      oneTimePensionTotal: oneTimePensionTotalHome,
      employerPensionRate: employerPensionRateHome / 100,
      totalHours: totalNetHoursHome > 0 ? totalNetHoursHome : undefined,
    }),
    [regionHome, baseMonthlyGross, carBenefitHome, carGrossupHome, taxCreditPointsHome,
     trainingFundValueHome, trainingFundTypeHome, transportationValueHome,
     transportationTypeHome, oneTimeBonusTotalHome, oneTimeGiftTotalHome, oneTimePensionTotalHome,
     employerPensionRateHome, totalNetHoursHome]
  );

  // Keep for display (ברוטו רגיל = regularGross — cash components)
  const dynamicMonthlyGross = homeTaxResult.regularGross;

  const showEstimateWarning = (regionHome !== 'IL') && (homeTaxResult as any).isEstimate;

  // Keep weekStats for the week column
  const { data: monthStats } = useAuthStats(token, 'month');

  const today = new Date();
  const hebrewDate = getHebrewDate(today);

  const [headerTime, setHeaderTime] = useState(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  });
  useEffect(() => {
    const iv = setInterval(() => {
      const n = new Date();
      setHeaderTime(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const [showReview, setShowReview] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      checkAndClearPendingReview().then((should) => {
        if (should) {
          setTimeout(() => setShowReview(true), 600);
        }
      }).catch(() => null);
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1020' }} testID="dashboard-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
      {/* Dark hero section */}
      <View style={{ backgroundColor: '#0B1020', paddingTop: insets.top }}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo on LEFT */}
          <View style={{ alignItems: 'flex-start' }}>
            <WorkClockLogo size="small" />
            <Text style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 2, letterSpacing: 0.3 }}>
              {hebrewDate}
            </Text>
          </View>
          {/* Right side: clock + net salary */}
          <View style={{ alignItems: 'flex-end' }}>
            {homeTaxResult.finalTakeHome > 0 ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 }}>
                  {'\u05E0\u05D8\u05D5 \u05DC\u05E7\u05D1\u05DC\u05D4'}
                </Text>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                  <Text style={{
                    color: '#22C55E',
                    fontSize: 20,
                    fontWeight: '800',
                    fontVariant: ['tabular-nums'],
                    textShadowColor: 'rgba(34,197,94,0.3)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 6,
                  }}>
                    {formatCurrency(homeTaxResult.finalTakeHome)}
                  </Text>
                  <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  <Text style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 20,
                    fontWeight: '300',
                    fontVariant: ['tabular-nums'],
                    letterSpacing: -0.5,
                  }}>
                    {headerTime}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 24,
                fontWeight: '300',
                fontVariant: ['tabular-nums'],
                letterSpacing: -0.5,
              }}>
                {headerTime}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Hero content */}
        <View style={{ paddingTop: 4, paddingBottom: 12, justifyContent: 'center' }}>
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color="#60A5FA" testID="loading-indicator" />
            </View>
          ) : activeSession ? (
            <ActiveSessionHero session={activeSession} token={token} />
          ) : (
            <EmptySessionHero token={token} />
          )}
        </View>

        {/* Compact financial strip — show when there is monthly data */}
        {dynamicMonthlyGross > 0 ? (
          <View style={{
            flexDirection: 'row-reverse',
            paddingHorizontal: 20,
            paddingBottom: 28,
            gap: 10,
          }}>
            {/* Month hours pill */}
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 12,
              alignItems: 'center',
            }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 3 }}>
                {'החודש'}
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {`${totalNetHoursHome.toFixed(1)} שע׳`}
              </Text>
            </View>
            {/* Gross pill */}
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 12,
              alignItems: 'center',
            }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 3 }}>
                {'ברוטו'}
              </Text>
              <Text style={{ color: '#60A5FA', fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {formatCurrency(dynamicMonthlyGross)}
              </Text>
            </View>
            {/* Net pill */}
            <View style={{
              flex: 1.2,
              backgroundColor: 'rgba(34,197,94,0.1)',
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(34,197,94,0.2)',
            }}>
              <Text style={{ color: '#86EFAC', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 }}>
                {'נטו לקבלה'}
              </Text>
              <Text style={{ color: '#22C55E', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], textShadowColor: 'rgba(34,197,94,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }}>
                {formatCurrency(homeTaxResult.finalTakeHome)}
              </Text>
              {showEstimateWarning ? (
                <View style={{ backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4, alignSelf: 'flex-start' }}>
                  <Text style={{ fontSize: 10, color: '#F59E0B' }}>{'הערכה בלבד — לא כולל מיסי מדינה/עירייה'}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {/* Light section with top rounding */}
      <View
        style={{
          backgroundColor: '#F1F5F9',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          marginTop: -28,
          paddingTop: 20,
          minHeight: 600,
        }}
      >
          {/* Weekly / Monthly stats */}
          <Animated.View entering={FadeInUp.delay(100).duration(400)}>
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              marginHorizontal: 16,
              marginBottom: 10,
              overflow: 'hidden',
              shadowColor: '#0B1020',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 6,
              elevation: 2,
            }}>
              <View style={{ flexDirection: 'row-reverse' }}>
              {/* Week stat */}
                <View style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: '700', marginBottom: 2, letterSpacing: 0.6 }}>
                    {'השבוע'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                    <Text style={{ color: '#2563EB', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 26 }}>
                      {weekStats ? weekStats.totalHours.toFixed(1) : '0'}
                    </Text>
                    <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700' }}>{'שע׳'}</Text>
                  </View>
                  <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: '500', marginTop: 1 }}>
                    {`${weekStats?.workDaysCount ?? 0} ימים`}
                  </Text>
                </View>

                {/* Divider */}
                <View style={{ width: 1, backgroundColor: '#EEF2FF', marginVertical: 10 }} />

                {/* Month stat */}
                <View style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: '700', marginBottom: 2, letterSpacing: 0.6 }}>
                    {'החודש'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                    <Text style={{ color: '#059669', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 26 }}>
                      {monthStats ? monthStats.totalHours.toFixed(1) : '0'}
                    </Text>
                    <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '700' }}>{'שע׳'}</Text>
                  </View>
                  <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: '500', marginTop: 1 }}>
                    {`${monthStats?.workDaysCount ?? 0} ימים`}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Monthly Salary Breakdown */}
          <MonthlySalaryCard
            baseGross={baseMonthlyGross}
            taxResult={homeTaxResult}
            carBenefitMonthly={carBenefitHome}
            carGrossupMonthly={carGrossupHome}
            bonusAdditions={oneTimeAdditionsHome.filter(a => a.month === currentMonthKey && a.type === 'bonus')}
            giftAdditions={oneTimeAdditionsHome.filter(a => a.month === currentMonthKey && a.type === 'gift')}
          />

          {/* Insights cards — shown when there is monthly data */}
          {baseMonthlyGross > 0 ? (
            <Animated.View entering={FadeInUp.delay(140).duration(400)}>
              <InsightsCards
                monthlyGross={baseMonthlyGross}
                hoursWorkedThisMonth={totalNetHoursHome}
                hourlyRate={hourlyRateHome}
                taxResult={homeTaxResult}
              />
            </Animated.View>
          ) : null}

          {/* Tax Status Card */}
          <TaxStatusCard />

          {/* Simulator button */}
          <Animated.View entering={FadeInUp.delay(180).duration(400)} style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/simulation' as never);
              }}
              testID="simulator-button"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 14,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 10,
                borderWidth: 1,
                borderColor: 'rgba(99,102,241,0.15)',
                shadowColor: '#6366F1',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.07,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={18} color="#6366F1" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E1B4B', textAlign: 'right' }}>{'סימולטור שעות'}</Text>
                <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 1 }}>{'מה יקרה אם אעבוד שעות נוספות?'}</Text>
              </View>
            </Pressable>
          </Animated.View>

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
          {!isPremiumHome && (
            <Animated.View entering={FadeInUp.delay(300).duration(400)}>
              <AdBanner />
            </Animated.View>
          )}
      </View>
      </ScrollView>

      <ReviewPromptModal
        visible={showReview}
        onClose={() => setShowReview(false)}
      />
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
          alignItems: 'center',
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
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', textAlign: 'center', marginBottom: 2 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
          {subtitle}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
