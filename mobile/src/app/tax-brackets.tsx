import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettingsStore } from '@/lib/state/settings-store';
import { TAX_CONFIG, calcIsraeliTax } from '@/lib/utils/tax-calc';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/lib/state/auth-store';
import { useAuthSessions } from '@/lib/api/workclock-api';
import { calcOvertimePay, calcOvertimePayMonthly } from '@/lib/utils/overtime-calc';
import type { WorkSession } from '@/lib/types';

// ─── Colors ───────────────────────────────────────────────────────────────────

const BG = '#080E1A';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';

const BRACKET_COLORS = [
  '#22C55E', // 10% — green
  '#84CC16', // 14% — lime
  '#EAB308', // 20% — yellow
  '#F97316', // 31% — orange
  '#EF4444', // 35% — red
  '#DC2626', // 47% — deep red
];

// Monthly bracket ranges (display only)
const BRACKET_MONTHLY_LABELS = [
  'עד ₪6,790/חודש',
  '₪6,791 – ₪9,730',
  '₪9,731 – ₪15,620',
  '₪15,621 – ₪21,150',
  '₪21,151 – ₪55,270',
  'מעל ₪55,270',
];

// Annual ceiling for each bracket (for bar fill proportion)
const BRACKET_CEILINGS_ANNUAL = [81_480, 116_760, 187_440, 253_800, 663_240, 999_999];
const MAX_CEILING = 663_240;

// ─── Bracket Row ──────────────────────────────────────────────────────────────

function BracketRow({
  index,
  rate,
  label,
  monthlyLabel,
  color,
  fillFraction,
  isCurrentBracket,
  amountInBracket,
  taxInBracket,
}: {
  index: number;
  rate: number;
  label: string;
  monthlyLabel: string;
  color: string;
  fillFraction: number;
  isCurrentBracket: boolean;
  amountInBracket: number;
  taxInBracket: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(400)}
      testID={`bracket-row-${index}`}
      style={{
        marginBottom: 10,
        borderRadius: 16,
        borderWidth: isCurrentBracket ? 1.5 : 1,
        borderColor: isCurrentBracket ? color : BORDER,
        backgroundColor: isCurrentBracket
          ? `${color}14`
          : BG_CARD,
        overflow: 'hidden',
        shadowColor: isCurrentBracket ? color : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isCurrentBracket ? 0.35 : 0,
        shadowRadius: 12,
        elevation: isCurrentBracket ? 4 : 0,
      }}
    >
      <View style={{ padding: 14 }}>
        {/* Top row: rate badge + range label */}
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
            {/* Rate badge */}
            <View style={{
              backgroundColor: color,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{label}</Text>
            </View>
            {/* Current bracket tag */}
            {isCurrentBracket ? (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: color }}>{'המדרגה שלך'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'left' }}>{monthlyLabel}</Text>
        </View>

        {/* Fill bar */}
        <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 8 }}>
          <View style={{
            height: 5,
            borderRadius: 3,
            width: `${Math.round(fillFraction * 100)}%`,
            backgroundColor: color,
          }} />
        </View>

        {/* Tax breakdown for this bracket */}
        {amountInBracket > 0 ? (
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
              {`${formatCurrency(amountInBracket)} בתוך מדרגה זו`}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color }}>
              {`מס: ${formatCurrency(taxInBracket)}`}
            </Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TaxBracketsScreen() {
  const router = useRouter();

  const token = useAuthStore((s) => s.token) ?? '';

  const currentMonthKey = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const { data: currentMonthSessions } = useAuthSessions(token, currentMonthKey);

  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const carBenefitMonthly = useSettingsStore((s) => s.carBenefitMonthly);
  const carGrossupMonthly = useSettingsStore((s) => s.carGrossupMonthly);
  const taxCreditPoints = useSettingsStore((s) => s.taxCreditPoints);
  const overtimeEnabled = useSettingsStore((s) => s.overtimeEnabled);
  const overtimeMode = useSettingsStore((s) => s.overtimeMode);
  const oneTimeAdditions = useSettingsStore((s) => s.oneTimeAdditions);
  const trainingFundValue = useSettingsStore((s) => s.trainingFundValue);
  const trainingFundType = useSettingsStore((s) => s.trainingFundType);
  const transportationValue = useSettingsStore((s) => s.transportationValue);
  const transportationType = useSettingsStore((s) => s.transportationType);
  const employerPensionRate = useSettingsStore((s) => s.employerPensionRate);

  // Filter shifts — exclude sick/vacation
  const currentMonthShifts = useMemo(
    () => (currentMonthSessions ?? []).filter((s: WorkSession) => s.sessionType !== 'sick' && s.sessionType !== 'vacation'),
    [currentMonthSessions]
  );

  // Base gross (overtime-aware)
  const baseMonthlyGross = useMemo(() => {
    if (!overtimeEnabled) return currentMonthShifts.reduce((t: number, s: WorkSession) => t + (s.netMinutes / 60) * hourlyRate, 0);
    if (overtimeMode === 'daily') return calcOvertimePayMonthly(currentMonthShifts, hourlyRate);
    const totalNetMinutes = currentMonthShifts.reduce((t: number, s: WorkSession) => t + s.netMinutes, 0);
    return calcOvertimePay(totalNetMinutes, hourlyRate, 'monthly');
  }, [currentMonthShifts, hourlyRate, overtimeEnabled, overtimeMode]);

  const oneTimeBonusTotal = useMemo(
    () => oneTimeAdditions.filter(a => a.month === currentMonthKey && a.type === 'bonus').reduce((t, a) => t + a.amount, 0),
    [oneTimeAdditions, currentMonthKey]
  );

  const oneTimeGiftTotal = useMemo(
    () => oneTimeAdditions.filter(a => a.month === currentMonthKey && a.type === 'gift').reduce((t, a) => t + a.amount, 0),
    [oneTimeAdditions, currentMonthKey]
  );

  const totalNetHours = useMemo(
    () => currentMonthShifts.reduce((t: number, s: WorkSession) => t + s.netMinutes / 60, 0),
    [currentMonthShifts]
  );

  // Full tax calculation using real session data
  const taxResult = useMemo(
    () => calcIsraeliTax({
      monthlyGross: baseMonthlyGross,
      carBenefitMonthly,
      carGrossupMonthly,
      creditPoints: taxCreditPoints,
      trainingFundValue,
      trainingFundType,
      transportationValue,
      transportationType,
      oneTimeBonusTotal,
      oneTimeGiftTotal,
      employerPensionRate: employerPensionRate / 100,
      totalHours: totalNetHours > 0 ? totalNetHours : undefined,
    }),
    [baseMonthlyGross, carBenefitMonthly, carGrossupMonthly, taxCreditPoints,
     trainingFundValue, trainingFundType, transportationValue,
     transportationType, oneTimeBonusTotal, oneTimeGiftTotal, employerPensionRate,
     totalNetHours]
  );

  const annualTaxable = useMemo(
    () => (baseMonthlyGross + carGrossupMonthly + carBenefitMonthly + oneTimeBonusTotal + oneTimeGiftTotal) * 12,
    [baseMonthlyGross, carGrossupMonthly, carBenefitMonthly, oneTimeBonusTotal, oneTimeGiftTotal]
  );

  // Determine which bracket the user is in
  const currentBracketIdx = useMemo(() => {
    const brackets = TAX_CONFIG.incomeTaxBrackets;
    for (let i = 0; i < brackets.length; i++) {
      if (annualTaxable <= brackets[i].upTo) return i;
    }
    return brackets.length - 1;
  }, [annualTaxable]);

  // Compute per-bracket breakdown: how much of user's income falls in each bracket
  const bracketBreakdown = useMemo(() => {
    const brackets = TAX_CONFIG.incomeTaxBrackets;
    let remaining = annualTaxable;
    let prev = 0;
    return brackets.map((b) => {
      if (remaining <= 0) return { amountInBracket: 0, taxInBracket: 0 };
      const span = b.upTo === Infinity ? remaining : Math.min(remaining, b.upTo - prev);
      const amount = Math.max(0, Math.min(remaining, span));
      const tax = amount * b.rate;
      remaining -= amount;
      prev = b.upTo === Infinity ? prev + amount : b.upTo;
      return { amountInBracket: amount / 12, taxInBracket: tax / 12 };
    });
  }, [annualTaxable]);

  const creditPointWorth = TAX_CONFIG.creditPointMonthly * taxCreditPoints;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} testID="tax-brackets-screen">
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(350)}
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 16,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY }}>
          {'מדרגות מס בישראל 2026'}
        </Text>
        <Pressable
          onPress={() => router.back()}
          testID="tax-brackets-close"
          hitSlop={10}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} color={TEXT_PRIMARY} />
        </Pressable>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
      >
        {/* User gross highlight */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <LinearGradient
            colors={['#1E3A5F', '#0F2040']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 20,
              padding: 18,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(59,130,246,0.25)',
            }}
          >
            <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 4 }}>
              {'המשכורת החודשית שלך החודש'}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#60A5FA', textAlign: 'right' }}>
              {formatCurrency(taxResult.regularGross)}
            </Text>
            <View style={{ flexDirection: 'row-reverse', gap: 16, marginTop: 12 }}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'מס הכנסה'}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#F87171', marginTop: 2 }}>
                  {formatCurrency(taxResult.incomeTax)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: BORDER }} />
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'ביטוח לאומי + בריאות'}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FBBF24', marginTop: 2 }}>
                  {formatCurrency(taxResult.nationalInsurance + taxResult.healthInsurance)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: BORDER }} />
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'נטו'}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#4ADE80', marginTop: 2 }}>
                  {formatCurrency(taxResult.netPay)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Section title */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 12, letterSpacing: 0.4 }}>
            {'7 מדרגות המס'}
          </Text>
        </Animated.View>

        {/* Bracket rows */}
        {TAX_CONFIG.incomeTaxBrackets.map((bracket, i) => {
          const ceiling = BRACKET_CEILINGS_ANNUAL[i] ?? MAX_CEILING;
          const fillFraction = Math.min(1, ceiling / MAX_CEILING);
          const { amountInBracket, taxInBracket } = bracketBreakdown[i] ?? { amountInBracket: 0, taxInBracket: 0 };
          return (
            <BracketRow
              key={bracket.label}
              index={i}
              rate={bracket.rate}
              label={bracket.label}
              monthlyLabel={BRACKET_MONTHLY_LABELS[i] ?? ''}
              color={BRACKET_COLORS[i] ?? '#22C55E'}
              fillFraction={fillFraction}
              isCurrentBracket={i === currentBracketIdx}
              amountInBracket={amountInBracket}
              taxInBracket={taxInBracket}
            />
          );
        })}

        {/* Credit points info */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(400)}
          style={{
            backgroundColor: BG_CARD,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: BORDER,
            marginTop: 4,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right', marginBottom: 6 }}>
            {'נקודות זיכוי'}
          </Text>
          <Text style={{ fontSize: 14, color: '#60A5FA', textAlign: 'right', fontWeight: '600' }}>
            {`${taxCreditPoints} נקודות = פטור של ${formatCurrency(creditPointWorth)}/חודש`}
          </Text>
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4, lineHeight: 18 }}>
            {'כל נקודת זיכוי שווה ₪242/חודש ישירות מהמס — לא מהברוטו. רווק/ה מקבל/ת 2.25 נקודות, נשוי/אה עוד נקודה, וכן הלאה.'}
          </Text>
        </Animated.View>

        {/* How brackets work note */}
        <Animated.View
          entering={FadeInDown.delay(560).duration(400)}
          style={{
            backgroundColor: 'rgba(59,130,246,0.07)',
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: 'rgba(59,130,246,0.15)',
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 12, color: 'rgba(148,197,255,0.85)', textAlign: 'right', lineHeight: 20 }}>
            {'מדרגות מס הן מצטברות — רק החלק שמעל הסף של כל מדרגה ממוסה בשיעור הגבוה יותר. מעבר למדרגה הבאה לא אומר שכל השכר ממוסה בשיעור החדש.'}
          </Text>
        </Animated.View>

        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'right', marginTop: 8 }}>
          {'לפי נתוני רשות המסים 2026. אינו תחליף לייעוץ מס.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
