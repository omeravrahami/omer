import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  TrendingUp,
  Zap,
  Target,
  Shield,
  Info,
  ChevronDown,
} from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useSessions } from '@/lib/api/workclock-api';
import { formatCurrency } from '@/lib/utils';
import {
  calcIsraeliTax,
  getBracketInfo,
  simulateExtraHours,
  getSmartTips,
  TAX_CONFIG,
} from '@/lib/utils/tax-calc';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG_DEEP = '#080E1A';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT_BLUE = '#3B82F6';
const ACCENT_CYAN = '#06B6D4';
const ACCENT_GREEN = '#22C55E';
const ACCENT_RED = '#F87171';
const ACCENT_AMBER = '#F59E0B';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: 'rgba(6,182,212,0.12)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 1 }}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Salary Breakdown Card ────────────────────────────────────────────────────

function SalaryBreakdownCard({
  gross,
  taxableGross,
  incomeTax,
  nationalInsurance,
  healthInsurance,
  netPay,
  effectiveTaxRate,
  carBenefitMonthly,
  trainingFundDeduction,
  transportationAllowance,
  finalTakeHome,
}: {
  gross: number;
  taxableGross: number;
  incomeTax: number;
  nationalInsurance: number;
  healthInsurance: number;
  netPay: number;
  effectiveTaxRate: number;
  carBenefitMonthly: number;
  trainingFundDeduction: number;
  transportationAllowance: number;
  finalTakeHome: number;
}) {
  const rows: { label: string; value: number; color: string; bold?: boolean }[] = [
    { label: '\u05D1\u05E8\u05D5\u05D8\u05D5', value: gross, color: TEXT_PRIMARY },
    ...(carBenefitMonthly > 0
      ? [{ label: '\u05E9\u05D5\u05D5\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9 \u05E8\u05DB\u05D1 \u05DC\u05DE\u05E1', value: carBenefitMonthly, color: ACCENT_AMBER }]
      : []),
    { label: '\u05D1\u05E8\u05D5\u05D8\u05D5 \u05DC\u05DE\u05E1', value: taxableGross, color: TEXT_SECONDARY },
    { label: '\u05DE\u05E1 \u05D4\u05DB\u05E0\u05E1\u05D4', value: incomeTax, color: ACCENT_RED },
    { label: '\u05D1\u05D9\u05D8\u05D5\u05D7 \u05DC\u05D0\u05D5\u05DE\u05D9', value: nationalInsurance, color: ACCENT_AMBER },
    { label: '\u05D1\u05D9\u05D8\u05D5\u05D7 \u05D1\u05E8\u05D9\u05D0\u05D5\u05EA', value: healthInsurance, color: ACCENT_AMBER },
    ...(trainingFundDeduction > 0
      ? [{ label: '\u05E7\u05E8\u05DF \u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA', value: trainingFundDeduction, color: ACCENT_AMBER }]
      : []),
    ...(transportationAllowance > 0
      ? [{ label: '\u05D3\u05DE\u05D9 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA', value: transportationAllowance, color: ACCENT_GREEN }]
      : []),
    { label: '\u05E0\u05D8\u05D5 \u05DC\u05E7\u05D1\u05DC\u05D4', value: finalTakeHome, color: ACCENT_GREEN, bold: true },
  ];

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(400)}
      style={{ backgroundColor: BG_CARD, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: BORDER, marginBottom: 16 }}
      testID="salary-breakdown-card"
    >
      <SectionHeader
        title={'\u05E4\u05D9\u05E8\u05D5\u05D8 \u05E9\u05DB\u05E8'}
        subtitle={'\u05D1\u05E8\u05D9\u05E8\u05D5\u05EA \u05DC\u05D7\u05DC\u05D5\u05D8\u05D9\u05DF'}
        icon={<TrendingUp size={18} color={ACCENT_CYAN} />}
      />

      {rows.map((row, i) => (
        <View
          key={row.label}
          style={{
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 9,
            borderBottomWidth: i < rows.length - 1 ? 1 : 0,
            borderBottomColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <Text style={{ fontSize: row.bold ? 15 : 13, fontWeight: row.bold ? '700' : '400', color: row.color === TEXT_SECONDARY ? TEXT_SECONDARY : TEXT_PRIMARY, textAlign: 'right' }}>
            {row.label}
          </Text>
          <Text style={{ fontSize: row.bold ? 16 : 14, fontWeight: row.bold ? '800' : '500', color: row.color, fontVariant: ['tabular-nums'] }}>
            {formatCurrency(row.value)}
          </Text>
        </View>
      ))}

      {/* Effective rate badge */}
      <View style={{ marginTop: 14, flexDirection: 'row-reverse', justifyContent: 'flex-start' }}>
        <View style={{ backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: ACCENT_RED }}>
            {`${Math.round(effectiveTaxRate)}% \u05E9\u05D9\u05E2\u05D5\u05E8 \u05E0\u05D9\u05DB\u05D5\u05D9 \u05D0\u05E4\u05E7\u05D8\u05D9\u05D1\u05D9`}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Bracket Progress Card ────────────────────────────────────────────────────

const BRACKET_COLORS = ['#22C55E', '#84CC16', '#F59E0B', '#F97316', '#EF4444', '#DC2626', '#991B1B'];

function BracketProgressCard({
  monthlyGross,
  carBenefitMonthly,
  currentRate,
  nextLabel,
  monthlyAmountToNextBracket,
  isTopBracket,
}: {
  monthlyGross: number;
  carBenefitMonthly: number;
  currentRate: number;
  currentLabel: string;
  nextLabel: string | null;
  monthlyAmountToNextBracket: number | null;
  hoursToNextBracket: number | null;
  isTopBracket: boolean;
}) {
  const brackets = TAX_CONFIG.incomeTaxBrackets;
  const annualTaxable = (monthlyGross + carBenefitMonthly) * 12;

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(400)}
      style={{ backgroundColor: BG_CARD, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: BORDER, marginBottom: 16 }}
      testID="bracket-progress-card"
    >
      <SectionHeader
        title={'\u05DE\u05D3\u05E8\u05D2\u05EA \u05D4\u05DE\u05E1 \u05E9\u05DC\u05DA'}
        icon={<Shield size={18} color={ACCENT_CYAN} />}
      />

      {/* All 7 brackets visual */}
      <View style={{ gap: 8, marginBottom: 16 }}>
        {brackets.map((bracket, i) => {
          const isCurrent = bracket.rate === currentRate;
          const isPast = annualTaxable > (i > 0 ? brackets[i - 1].upTo : 0);
          const bracketColor = BRACKET_COLORS[i] ?? ACCENT_BLUE;

          return (
            <View key={bracket.label} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
              {/* Rate label */}
              <View style={{ width: 44, alignItems: 'flex-end' }}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: isCurrent ? '800' : '400',
                  color: isCurrent ? bracketColor : TEXT_SECONDARY,
                }}>
                  {bracket.label}
                </Text>
              </View>
              {/* Bar */}
              <View style={{ flex: 1, height: isCurrent ? 10 : 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                {isPast ? (
                  <View style={{
                    height: '100%',
                    borderRadius: 3,
                    width: isCurrent ? '60%' : '100%',
                    backgroundColor: isCurrent ? bracketColor : `${bracketColor}60`,
                  }} />
                ) : null}
              </View>
              {/* Current indicator */}
              {isCurrent ? (
                <View style={{ backgroundColor: `${bracketColor}20`, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: bracketColor }}>{'כאן'}</Text>
                </View>
              ) : (
                <View style={{ width: 36 }} />
              )}
            </View>
          );
        })}
      </View>

      {/* Amount to next bracket */}
      {!isTopBracket && monthlyAmountToNextBracket !== null ? (
        <View style={{ backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: ACCENT_BLUE, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
            {formatCurrency(monthlyAmountToNextBracket)}
          </Text>
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 3 }}>
            {`\u05E2\u05D3 \u05DE\u05D3\u05E8\u05D2\u05EA ${nextLabel ?? ''} \u05D4\u05D1\u05D0\u05D4`}
          </Text>
          <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 6, lineHeight: 16, opacity: 0.7 }}>
            {`\u05E8\u05D5\u05D1 \u05D4\u05E9\u05DB\u05E8 \u05E9\u05DC\u05DA \u05E2\u05D3\u05D9\u05D9\u05DF \u05DE\u05DE\u05D5\u05E1\u05D4 \u05D1-${Math.round(currentRate * 100)}%, \u05D4\u05DE\u05D3\u05E8\u05D2\u05D4 \u05D4\u05D1\u05D0\u05D4 \u05DE\u05E9\u05E4\u05D9\u05E2\u05D4 \u05E8\u05E7 \u05E2\u05DC \u05D4\u05E9\u05DB\u05E8 \u05DE\u05E2\u05DC \u05D4\u05E1\u05E3`}
          </Text>
        </View>
      ) : (
        <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT_RED, textAlign: 'right' }}>
            {'\u05D0\u05EA\u05D4 \u05D1\u05DE\u05D3\u05E8\u05D2\u05EA \u05D4\u05DE\u05E1 \u05D4\u05D2\u05D1\u05D5\u05D4\u05D4 \u05D1\u05D9\u05D5\u05EA\u05E8 (50%)'}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Smart Tips Section ───────────────────────────────────────────────────────

const TIP_ICONS: Record<number, string> = { 0: '⚡', 1: '💡', 2: '🚗', 3: '📊', 4: '💰' };

function SmartTipsSection({ tips }: { tips: string[] }) {
  if (tips.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(300).duration(400)}
      style={{ marginBottom: 16 }}
      testID="smart-tips-section"
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Zap size={18} color={ACCENT_AMBER} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>
          {'\u05EA\u05D5\u05D1\u05E0\u05D5\u05EA \u05D7\u05DB\u05DE\u05D5\u05EA'}
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {tips.map((tip, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(300 + i * 80).duration(350)}
            style={{
              backgroundColor: BG_CARD,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: BORDER,
              flexDirection: 'row-reverse',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 20 }}>{TIP_ICONS[i] ?? '💡'}</Text>
            <Text style={{ flex: 1, fontSize: 13, color: TEXT_PRIMARY, textAlign: 'right', lineHeight: 19 }}>
              {tip}
            </Text>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Simulation Card ──────────────────────────────────────────────────────────

function SimulationCard({
  extraHours,
  extraGross,
  extraNet,
  keepRate,
  bracketCrossed,
  netPay,
  delay,
}: {
  extraHours: number;
  extraGross: number;
  extraNet: number;
  keepRate: number;
  bracketCrossed: boolean;
  netPay: number;
  delay: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400)}
      style={{
        backgroundColor: BG_CARD,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: bracketCrossed ? 'rgba(245,158,11,0.25)' : BORDER,
        flex: 1,
      }}
    >
      {/* Hours label */}
      <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 4 }}>
        {`+${extraHours} \u05E9\u05E2\u05D5\u05EA`}
      </Text>

      {/* Keep rate — large */}
      <Text style={{ fontSize: 28, fontWeight: '800', color: bracketCrossed ? ACCENT_AMBER : ACCENT_GREEN, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
        {`${Math.round(keepRate)}%`}
      </Text>
      <Text style={{ fontSize: 10, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10, lineHeight: 14 }}>
        {'\u05DE\u05D4\u05EA\u05D5\u05E1\u05E4\u05EA \u05D9\u05D9\u05E9\u05D0\u05E8 \u05D0\u05E6\u05DC\u05DA'}
      </Text>

      {/* Status badge */}
      <View style={{
        backgroundColor: bracketCrossed ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.1)',
        borderRadius: 99,
        paddingHorizontal: 8,
        paddingVertical: 3,
        alignSelf: 'flex-end',
        marginBottom: 8,
      }}>
        <Text style={{ fontSize: 10, fontWeight: '600', color: bracketCrossed ? ACCENT_AMBER : ACCENT_GREEN }}>
          {bracketCrossed
            ? '\u05D7\u05D5\u05E6\u05D4 \u05DE\u05D3\u05E8\u05D2\u05EA \u05DE\u05E1'
            : '\u05E0\u05E9\u05D0\u05E8 \u05D1\u05D0\u05D5\u05EA\u05D4 \u05DE\u05D3\u05E8\u05D2\u05D4'}
        </Text>
      </View>

      {/* Expand toggle */}
      <Pressable
        onPress={() => setExpanded(!expanded)}
        testID={`simulation-expand-${extraHours}`}
        style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 4 }}
      >
        <Text style={{ fontSize: 11, color: ACCENT_BLUE }}>{'פרטים'}</Text>
        <ChevronDown
          size={12}
          color={ACCENT_BLUE}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </Pressable>

      {/* Expanded details */}
      {expanded ? (
        <View style={{ marginTop: 12, gap: 6, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'ברוטו נוסף'}</Text>
            <Text style={{ fontSize: 11, color: TEXT_PRIMARY, fontVariant: ['tabular-nums'] }}>{formatCurrency(extraGross)}</Text>
          </View>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'נטו נוסף'}</Text>
            <Text style={{ fontSize: 11, color: ACCENT_GREEN, fontVariant: ['tabular-nums'] }}>{formatCurrency(extraNet)}</Text>
          </View>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'נטו כולל'}</Text>
            <Text style={{ fontSize: 11, color: TEXT_PRIMARY, fontVariant: ['tabular-nums'] }}>{formatCurrency(netPay)}</Text>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const deviceId = useDeviceId();
  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const carBenefitMonthly = useSettingsStore((s) => s.carBenefitMonthly);
  const taxCreditPoints = useSettingsStore((s) => s.taxCreditPoints);
  const dailyGoalHours = useSettingsStore((s) => s.dailyGoalHours);
  const trainingFundValue = useSettingsStore((s) => s.trainingFundValue);
  const trainingFundType = useSettingsStore((s) => s.trainingFundType);
  const transportationValue = useSettingsStore((s) => s.transportationValue);
  const transportationType = useSettingsStore((s) => s.transportationType);

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const { data: sessions, isLoading } = useSessions(deviceId, currentMonth);

  const totalNetHours = useMemo(
    () => (sessions ?? []).reduce((sum, s) => sum + s.netMinutes / 60, 0),
    [sessions]
  );

  const currentMonthlyGross = useMemo(
    () => totalNetHours * hourlyRate,
    [totalNetHours, hourlyRate]
  );

  const taxResult = useMemo(
    () => calcIsraeliTax({ monthlyGross: currentMonthlyGross, carBenefitMonthly, creditPoints: taxCreditPoints, trainingFundValue, trainingFundType, transportationValue, transportationType }),
    [currentMonthlyGross, carBenefitMonthly, taxCreditPoints, trainingFundValue, trainingFundType, transportationValue, transportationType]
  );

  const bracketInfo = useMemo(
    () => getBracketInfo(currentMonthlyGross, hourlyRate, carBenefitMonthly),
    [currentMonthlyGross, hourlyRate, carBenefitMonthly]
  );

  const tips = useMemo(
    () => getSmartTips(currentMonthlyGross, hourlyRate, carBenefitMonthly, taxCreditPoints, dailyGoalHours * 20, totalNetHours),
    [currentMonthlyGross, hourlyRate, carBenefitMonthly, taxCreditPoints, dailyGoalHours, totalNetHours]
  );

  const sim5 = useMemo(
    () => simulateExtraHours(currentMonthlyGross, 5, hourlyRate, carBenefitMonthly, taxCreditPoints),
    [currentMonthlyGross, hourlyRate, carBenefitMonthly, taxCreditPoints]
  );
  const sim10 = useMemo(
    () => simulateExtraHours(currentMonthlyGross, 10, hourlyRate, carBenefitMonthly, taxCreditPoints),
    [currentMonthlyGross, hourlyRate, carBenefitMonthly, taxCreditPoints]
  );
  const sim20 = useMemo(
    () => simulateExtraHours(currentMonthlyGross, 20, hourlyRate, carBenefitMonthly, taxCreditPoints),
    [currentMonthlyGross, hourlyRate, carBenefitMonthly, taxCreditPoints]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_DEEP }} testID="financial-insights-screen">
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(350)}
          style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 }}
        >
          <Text style={{ fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right', letterSpacing: 0.3 }}>
            {'\u05EA\u05D5\u05D1\u05E0\u05D5\u05EA \u05E4\u05D9\u05E0\u05E0\u05E1\u05D9\u05D5\u05EA'}
          </Text>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
            {'\u05D4\u05DB\u05E1\u05E3 \u05E9\u05DC\u05DA, \u05D1\u05E6\u05D5\u05E8\u05D4 \u05D1\u05E8\u05D5\u05E8\u05D4'}
          </Text>
        </Animated.View>

        {/* Stats summary row */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(380)}
          style={{ flexDirection: 'row-reverse', gap: 10, paddingHorizontal: 20, paddingVertical: 16 }}
        >
          <View style={{ flex: 1, backgroundColor: BG_CARD, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: BORDER, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, color: TEXT_SECONDARY, marginBottom: 4 }}>{'שעות החודש'}</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, fontVariant: ['tabular-nums'] }}>
              {totalNetHours.toFixed(1)}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: BG_CARD, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: BORDER, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, color: TEXT_SECONDARY, marginBottom: 4 }}>{'ברוטו'}</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, fontVariant: ['tabular-nums'] }}>
              {formatCurrency(currentMonthlyGross)}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: BG_CARD, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: BORDER, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, color: TEXT_SECONDARY, marginBottom: 4 }}>{'נטו'}</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: ACCENT_GREEN, fontVariant: ['tabular-nums'] }}>
              {formatCurrency(taxResult.finalTakeHome)}
            </Text>
          </View>
        </Animated.View>

        {isLoading ? (
          <View style={{ padding: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={ACCENT_CYAN} testID="loading-indicator" />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {/* Salary Breakdown */}
            <SalaryBreakdownCard
              gross={taxResult.grossPay}
              taxableGross={taxResult.taxableGross}
              incomeTax={taxResult.incomeTax}
              nationalInsurance={taxResult.nationalInsurance}
              healthInsurance={taxResult.healthInsurance}
              netPay={taxResult.netPay}
              effectiveTaxRate={taxResult.effectiveTaxRate}
              carBenefitMonthly={carBenefitMonthly}
              trainingFundDeduction={taxResult.trainingFundDeduction}
              transportationAllowance={taxResult.transportationAllowance}
              finalTakeHome={taxResult.finalTakeHome}
            />

            {/* Bracket Progress */}
            <BracketProgressCard
              monthlyGross={currentMonthlyGross}
              carBenefitMonthly={carBenefitMonthly}
              currentRate={bracketInfo.currentRate}
              currentLabel={bracketInfo.currentLabel}
              nextLabel={bracketInfo.nextLabel}
              monthlyAmountToNextBracket={bracketInfo.monthlyAmountToNextBracket}
              hoursToNextBracket={bracketInfo.hoursToNextBracket}
              isTopBracket={bracketInfo.isTopBracket}
            />

            {/* Smart Tips */}
            <SmartTipsSection tips={tips} />

            {/* Simulation Section */}
            <Animated.View
              entering={FadeInDown.delay(400).duration(400)}
              style={{ marginBottom: 16 }}
              testID="simulation-section"
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Target size={18} color={ACCENT_CYAN} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>
                  {'\u05DE\u05D4 \u05D0\u05DD \u05D0\u05E2\u05D1\u05D5\u05D3 \u05D9\u05D5\u05EA\u05E8?'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                <SimulationCard
                  extraHours={5}
                  extraGross={sim5.extraGross}
                  extraNet={sim5.extraNet}
                  keepRate={sim5.keepRate}
                  bracketCrossed={sim5.bracketCrossed}
                  netPay={sim5.netPay}
                  delay={420}
                />
                <SimulationCard
                  extraHours={10}
                  extraGross={sim10.extraGross}
                  extraNet={sim10.extraNet}
                  keepRate={sim10.keepRate}
                  bracketCrossed={sim10.bracketCrossed}
                  netPay={sim10.netPay}
                  delay={460}
                />
                <SimulationCard
                  extraHours={20}
                  extraGross={sim20.extraGross}
                  extraNet={sim20.extraNet}
                  keepRate={sim20.keepRate}
                  bracketCrossed={sim20.bracketCrossed}
                  netPay={sim20.netPay}
                  delay={500}
                />
              </View>
            </Animated.View>

            {/* Disclaimer footer */}
            <Animated.View
              entering={FadeInDown.delay(550).duration(400)}
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'flex-start',
                gap: 8,
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: BORDER,
                marginBottom: 8,
              }}
            >
              <Info size={14} color={TEXT_SECONDARY} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', lineHeight: 17 }}>
                {'\u05D4\u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05DD \u05DE\u05D1\u05D5\u05E1\u05E1\u05D9\u05DD \u05E2\u05DC \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA \u05DE\u05E1 2024 \u05D5\u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA \u05D0\u05D9\u05E9\u05D9\u05D9\u05DD. \u05D4\u05E2\u05E8\u05DB\u05D5\u05EA \u05D1\u05DC\u05D1\u05D3 \u05DC\u05E6\u05D5\u05E8\u05DA \u05D9\u05D9\u05D3\u05D5\u05E2\u05D9 \u2014 \u05DC\u05D9\u05D9\u05E2\u05D5\u05E5 \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9 \u05E4\u05E0\u05D4 \u05DC\u05E8\u05D5\u05D0\u05D4 \u05D7\u05E9\u05D1\u05D5\u05DF.'}
              </Text>
            </Animated.View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
