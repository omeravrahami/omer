import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { X, Plus, Minus, TrendingUp, ArrowUpRight, Zap } from 'lucide-react-native';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useAuthStore } from '@/lib/state/auth-store';
import { useAuthSessions } from '@/lib/api/workclock-api';
import { formatCurrency } from '@/lib/utils';
import {
  calcIsraeliTax,
  calcExtraHoursImpact,
  simulateExtraHours,
  getBracketInfo,
} from '@/lib/utils/tax-calc';
import { calcOvertimePay, calcOvertimePayMonthly } from '@/lib/utils/overtime-calc';

const HOUR_STEPS = [5, 10, 15, 20, 30, 40];

export default function SimulationScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token) ?? '';
  const [selectedHours, setSelectedHours] = useState<number>(10);

  // Settings
  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const carBenefitMonthly = useSettingsStore((s) => s.carBenefitMonthly);
  const carGrossupMonthly = useSettingsStore((s) => s.carGrossupMonthly);
  const taxCreditPoints = useSettingsStore((s) => s.taxCreditPoints);
  const trainingFundValue = useSettingsStore((s) => s.trainingFundValue);
  const trainingFundType = useSettingsStore((s) => s.trainingFundType);
  const transportationValue = useSettingsStore((s) => s.transportationValue);
  const transportationType = useSettingsStore((s) => s.transportationType);
  const employerPensionRate = useSettingsStore((s) => s.employerPensionRate);
  const overtimeEnabled = useSettingsStore((s) => s.overtimeEnabled);
  const overtimeMode = useSettingsStore((s) => s.overtimeMode);
  const oneTimeAdditions = useSettingsStore((s) => s.oneTimeAdditions);

  const currentMonthKey = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const { data: sessions } = useAuthSessions(token, currentMonthKey);

  const shiftSessions = useMemo(
    () => (sessions ?? []).filter((s) => s.sessionType !== 'sick' && s.sessionType !== 'vacation'),
    [sessions]
  );

  const totalNetHours = useMemo(
    () => shiftSessions.reduce((sum, s) => sum + s.netMinutes / 60, 0),
    [shiftSessions]
  );

  const oneTimeBonusTotal = useMemo(
    () => oneTimeAdditions
      .filter((a) => a.month === currentMonthKey && a.isGross && !a.isTaxOnly)
      .reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, currentMonthKey]
  );

  const oneTimeGiftTotal = useMemo(
    () => oneTimeAdditions
      .filter((a) => a.month === currentMonthKey && a.isTaxOnly)
      .reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, currentMonthKey]
  );

  const oneTimePensionTotal = useMemo(
    () => oneTimeAdditions
      .filter((a) => a.month === currentMonthKey && a.isPension)
      .reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, currentMonthKey]
  );

  const baseMonthlyGross = useMemo(() => {
    if (!overtimeEnabled) return totalNetHours * hourlyRate;
    if (overtimeMode === 'daily') return calcOvertimePayMonthly(shiftSessions, hourlyRate);
    const totalNetMinutes = shiftSessions.reduce((t, s) => t + s.netMinutes, 0);
    return calcOvertimePay(totalNetMinutes, hourlyRate, 'monthly');
  }, [shiftSessions, totalNetHours, hourlyRate, overtimeEnabled, overtimeMode]);

  const taxContext = useMemo(() => ({
    carBenefitMonthly,
    carGrossupMonthly,
    creditPoints: taxCreditPoints,
    trainingFundValue,
    trainingFundType,
    transportationValue,
    transportationType,
    oneTimeBonusTotal,
    oneTimeGiftTotal,
    oneTimePensionTotal,
    employerPensionRate: employerPensionRate / 100,
  }), [
    carBenefitMonthly, carGrossupMonthly, taxCreditPoints,
    trainingFundValue, trainingFundType, transportationValue, transportationType,
    oneTimeBonusTotal, oneTimeGiftTotal, oneTimePensionTotal, employerPensionRate,
  ]);

  const currentTaxResult = useMemo(
    () => calcIsraeliTax({ ...taxContext, monthlyGross: baseMonthlyGross }),
    [taxContext, baseMonthlyGross]
  );

  const simResult = useMemo(
    () => simulateExtraHours(baseMonthlyGross, selectedHours, hourlyRate, taxContext),
    [baseMonthlyGross, selectedHours, hourlyRate, taxContext]
  );

  const impact = useMemo(
    () => calcExtraHoursImpact(baseMonthlyGross, hourlyRate, selectedHours),
    [baseMonthlyGross, hourlyRate, selectedHours]
  );

  const currentBracket = useMemo(
    () => getBracketInfo(baseMonthlyGross, hourlyRate, carBenefitMonthly),
    [baseMonthlyGross, hourlyRate, carBenefitMonthly]
  );

  const newBracket = useMemo(
    () => getBracketInfo(baseMonthlyGross + impact.additionalGross, hourlyRate, carBenefitMonthly),
    [baseMonthlyGross, impact.additionalGross, hourlyRate, carBenefitMonthly]
  );

  const keepPercent = impact.additionalGross > 0
    ? Math.round((impact.additionalNet / impact.additionalGross) * 100)
    : 0;

  const marginalRate = impact.additionalGross > 0
    ? Math.round(((impact.additionalGross - impact.additionalNet) / impact.additionalGross) * 100)
    : 0;

  const handleSelectHours = useCallback((hours: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedHours(hours);
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1020' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}
        >
          <Pressable
            onPress={handleClose}
            testID="simulation-close-button"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
          <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center' }}>
            {'סימולטור שעות'}
          </Text>
          <View style={{ width: 36 }} />
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        >
          {/* Current month stats card */}
          <Animated.View entering={FadeInDown.delay(60).duration(350)}>
            <View
              style={{
                backgroundColor: '#0D1526',
                borderRadius: 20,
                padding: 18,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: 'rgba(59,130,246,0.18)',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textAlign: 'right', marginBottom: 12, letterSpacing: 0.8 }}>
                {'מצב חודש נוכחי'}
              </Text>
              <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)' }}>
                  <Text style={{ fontSize: 9, color: '#94A3B8', marginBottom: 4 }}>{'ברוטו'}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#60A5FA', fontVariant: ['tabular-nums'] }}>
                    {formatCurrency(currentTaxResult.regularGross)}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(34,197,94,0.15)' }}>
                  <Text style={{ fontSize: 9, color: '#94A3B8', marginBottom: 4 }}>{'נטו'}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#22C55E', fontVariant: ['tabular-nums'] }}>
                    {formatCurrency(currentTaxResult.finalTakeHome)}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)' }}>
                  <Text style={{ fontSize: 9, color: '#94A3B8', marginBottom: 4 }}>{'שעות'}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#818CF8', fontVariant: ['tabular-nums'] }}>
                    {totalNetHours.toFixed(1)}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Hour selector */}
          <Animated.View entering={FadeInDown.delay(120).duration(350)}>
            <View
              style={{
                backgroundColor: '#0D1526',
                borderRadius: 20,
                padding: 18,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.07)',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textAlign: 'right', marginBottom: 14, letterSpacing: 0.8 }}>
                {'כמה שעות נוספות לסמולציה?'}
              </Text>

              {/* Step buttons row 1 */}
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 8 }}>
                {HOUR_STEPS.slice(0, 3).map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => handleSelectHours(h)}
                    testID={`hour-step-${h}`}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selectedHours === h ? '#3B82F6' : 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: selectedHours === h ? '#3B82F6' : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <Text style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: selectedHours === h ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                      fontVariant: ['tabular-nums'],
                    }}>
                      {`+${h}`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Step buttons row 2 */}
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 14 }}>
                {HOUR_STEPS.slice(3).map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => handleSelectHours(h)}
                    testID={`hour-step-${h}`}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selectedHours === h ? '#3B82F6' : 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: selectedHours === h ? '#3B82F6' : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <Text style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: selectedHours === h ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                      fontVariant: ['tabular-nums'],
                    }}>
                      {`+${h}`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Manual +/- stepper */}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <Pressable
                  onPress={() => { if (selectedHours > 1) handleSelectHours(selectedHours - 1); }}
                  testID="hour-decrease"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.12)',
                  }}
                >
                  <Minus size={16} color="#94A3B8" strokeWidth={2.5} />
                </Pressable>
                <View style={{ alignItems: 'center', minWidth: 60 }}>
                  <Text style={{ fontSize: 32, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
                    {selectedHours}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: -2 }}>{'שעות'}</Text>
                </View>
                <Pressable
                  onPress={() => handleSelectHours(selectedHours + 1)}
                  testID="hour-increase"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: 'rgba(59,130,246,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(59,130,246,0.3)',
                  }}
                >
                  <Plus size={16} color="#60A5FA" strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>
          </Animated.View>

          {/* Results card */}
          <Animated.View entering={FadeInUp.delay(180).duration(400)}>
            <LinearGradient
              colors={['#0D1F1A', '#0B1020']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 20,
                padding: 20,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: 'rgba(52,211,153,0.2)',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textAlign: 'right', marginBottom: 14, letterSpacing: 0.8 }}>
                {`תוצאת סימולציה — +${selectedHours} שעות`}
              </Text>

              {/* Main net gain */}
              <View style={{ alignItems: 'flex-end', marginBottom: 18 }}>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{'תוספת נטו'}</Text>
                <Text style={{
                  color: '#34D399',
                  fontSize: 44,
                  fontWeight: '800',
                  fontVariant: ['tabular-nums'],
                  textShadowColor: 'rgba(52,211,153,0.35)',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 20,
                }}>
                  {`+${formatCurrency(impact.additionalNet)}`}
                </Text>
              </View>

              {/* Details grid */}
              <View style={{ gap: 10 }}>
                <ResultRow
                  label={'תוספת ברוטו'}
                  value={`+${formatCurrency(impact.additionalGross)}`}
                  valueColor={'#60A5FA'}
                />
                <ResultRow
                  label={'תוספת מסים'}
                  value={`-${formatCurrency(impact.additionalTax)}`}
                  valueColor={'#F87171'}
                />
                <ResultRow
                  label={'נטו לשעה נוספת'}
                  value={`${formatCurrency(impact.netPerExtraHour)}/שע׳`}
                  valueColor={'#34D399'}
                />
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 4 }} />
                <ResultRow
                  label={'ברוטו חדש כולל'}
                  value={formatCurrency(simResult.regularGross)}
                  valueColor={'#F0F6FF'}
                />
                <ResultRow
                  label={'נטו חדש כולל'}
                  value={formatCurrency(simResult.finalTakeHome)}
                  valueColor={'#34D399'}
                />
              </View>

              {/* Efficiency bar */}
              <View style={{ marginTop: 18 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>{'כמה מהתוספת נשאר לך'}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: keepPercent >= 60 ? '#34D399' : '#F59E0B' }}>
                    {`${keepPercent}%`}
                  </Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <LinearGradient
                    colors={keepPercent >= 60 ? ['#059669', '#34D399'] : ['#D97706', '#F59E0B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ height: 8, borderRadius: 4, width: `${keepPercent}%` }}
                  />
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 10, color: '#22C55E' }}>
                    {`${formatCurrency(impact.additionalNet)} נטו`}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#F87171' }}>
                    {`${formatCurrency(impact.additionalTax)} מסים`}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Tax bracket info */}
          <Animated.View entering={FadeInUp.delay(240).duration(350)}>
            <View
              style={{
                backgroundColor: '#0D1526',
                borderRadius: 20,
                padding: 18,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: simResult.bracketCrossed ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)',
              }}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  backgroundColor: simResult.bracketCrossed ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {simResult.bracketCrossed
                    ? <ArrowUpRight size={14} color="#F59E0B" strokeWidth={2.5} />
                    : <Zap size={14} color="#818CF8" strokeWidth={2.5} />
                  }
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#F0F6FF', textAlign: 'right' }}>
                  {'מדרגת מס'}
                </Text>
              </View>

              <View style={{ gap: 8 }}>
                <ResultRow
                  label={'מדרגה נוכחית'}
                  value={currentBracket.currentLabel}
                  valueColor={'#818CF8'}
                />
                {simResult.bracketCrossed ? (
                  <>
                    <ResultRow
                      label={'מדרגה חדשה לאחר תוספת'}
                      value={newBracket.currentLabel}
                      valueColor={'#F59E0B'}
                    />
                    <View style={{
                      backgroundColor: 'rgba(245,158,11,0.08)',
                      borderRadius: 10,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: 'rgba(245,158,11,0.2)',
                      marginTop: 4,
                    }}>
                      <Text style={{ fontSize: 11, color: '#F59E0B', textAlign: 'right', lineHeight: 16 }}>
                        {`תעבור מדרגת מס! השעות הנוספות ימוסו ב-${newBracket.currentLabel} (רק החלק מעל הסף)`}
                      </Text>
                    </View>
                  </>
                ) : (
                  <ResultRow
                    label={'שיעור מס שולי על תוספת'}
                    value={`${marginalRate}%`}
                    valueColor={'#34D399'}
                  />
                )}
              </View>
            </View>
          </Animated.View>

          {/* Disclaimer */}
          <Text style={{ fontSize: 11, color: '#475569', textAlign: 'right', paddingHorizontal: 4, lineHeight: 17 }}>
            {'* הסימולציה מבוססת על שכר החודש הנוכחי בלבד ואינה מהווה ייעוץ פיננסי'}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ResultRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'right' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: valueColor, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}
