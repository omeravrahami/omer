import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { X, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useShallow } from 'zustand/react/shallow';
import { TAX_CONFIG, calcIsraeliTax } from '@/lib/utils/tax-calc';
import { calcRegionalTax } from '@/lib/utils/regional-tax-engine';
import { getRegionCurrencySymbol } from '@/lib/utils/regional-tax-engine';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/lib/state/auth-store';
import { useAuthSessions } from '@/lib/api/workclock-api';
import { calcOvertimePay, calcOvertimePayMonthly } from '@/lib/utils/overtime-calc';
import type { WorkSession } from '@/lib/types';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG = '#080E1A';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';

const BRACKET_COLORS = [
  '#22C55E',
  '#84CC16',
  '#EAB308',
  '#F97316',
  '#EF4444',
  '#DC2626',
  '#B91C1C',
];

// ─── Region-specific bracket configs ──────────────────────────────────────────

interface BracketDisplay {
  label: string;         // e.g. "10%"
  rate: number;          // 0.10
  monthlyRange: string;  // display label for monthly range
  annualCeiling: number; // for determining user's bracket
  color: string;
}

interface RegionConfig {
  title: string;
  subtitle: string;
  currency: string;
  brackets: BracketDisplay[];
  extraInfo?: string;
  isEstimate: boolean;
  estimateNote?: string;
  additionalSections?: Array<{
    title: string;
    content: string;
  }>;
}

function getRegionConfig(region: string): RegionConfig {
  switch (region) {
    case 'US':
      return {
        title: 'US Federal Tax Brackets 2026',
        subtitle: 'Single filer — federal income tax only',
        currency: '$',
        isEstimate: true,
        estimateNote: 'Federal estimate only. State and local taxes are not included.',
        brackets: [
          { label: '10%', rate: 0.10, monthlyRange: 'Up to $966/mo', annualCeiling: 11_600, color: BRACKET_COLORS[0] },
          { label: '12%', rate: 0.12, monthlyRange: '$967 – $3,929/mo', annualCeiling: 47_150, color: BRACKET_COLORS[1] },
          { label: '22%', rate: 0.22, monthlyRange: '$3,930 – $8,377/mo', annualCeiling: 100_525, color: BRACKET_COLORS[2] },
          { label: '24%', rate: 0.24, monthlyRange: '$8,378 – $15,996/mo', annualCeiling: 191_950, color: BRACKET_COLORS[3] },
          { label: '32%', rate: 0.32, monthlyRange: '$15,997 – $20,310/mo', annualCeiling: 243_725, color: BRACKET_COLORS[4] },
          { label: '35%', rate: 0.35, monthlyRange: '$20,311 – $50,779/mo', annualCeiling: 609_350, color: BRACKET_COLORS[5] },
          { label: '37%', rate: 0.37, monthlyRange: 'Over $50,779/mo', annualCeiling: Infinity, color: BRACKET_COLORS[6] },
        ],
        additionalSections: [
          {
            title: 'FICA Taxes',
            content: 'Social Security: 6.2% (up to $168,600/yr wage base)\nMedicare: 1.45% (no ceiling)\nStandard deduction reduces taxable income by $14,600 (single).',
          },
        ],
      };

    case 'UK':
      return {
        title: 'UK Income Tax Brackets 2025/26',
        subtitle: 'PAYE — income above personal allowance',
        currency: '£',
        isEstimate: true,
        estimateNote: 'Based on standard personal allowance (£12,570). Actual take-home depends on your tax code.',
        brackets: [
          { label: '20%', rate: 0.20, monthlyRange: '£1,048 – £4,189/mo', annualCeiling: 50_270, color: BRACKET_COLORS[0] },
          { label: '40%', rate: 0.40, monthlyRange: '£4,190 – £10,428/mo', annualCeiling: 125_140, color: BRACKET_COLORS[3] },
          { label: '45%', rate: 0.45, monthlyRange: 'Over £10,428/mo', annualCeiling: Infinity, color: BRACKET_COLORS[5] },
        ],
        additionalSections: [
          {
            title: 'National Insurance (Employee)',
            content: '8% on earnings between £12,570 – £50,270/yr\n2% on earnings above £50,270/yr\nPersonal allowance: £12,570/yr (£1,048/mo) — no tax below this.',
          },
        ],
      };

    case 'IL':
    default:
      return {
        title: 'מדרגות מס בישראל 2026',
        subtitle: '7 מדרגות מס הכנסה',
        currency: '₪',
        isEstimate: false,
        brackets: TAX_CONFIG.incomeTaxBrackets.slice(0, 6).map((b, i) => {
          const labels = [
            'עד ₪7,010/חודש',
            '₪7,011 – ₪10,060',
            '₪10,061 – ₪16,150',
            '₪16,151 – ₪22,440',
            '₪22,441 – ₪46,690',
            '₪46,691 – ₪60,130',
          ];
          return {
            label: b.label,
            rate: b.rate,
            monthlyRange: labels[i] ?? '',
            annualCeiling: b.upTo,
            color: BRACKET_COLORS[i] ?? '#22C55E',
          };
        }).concat([{
          label: '50%',
          rate: 0.50,
          monthlyRange: 'מעל ₪60,130/חודש',
          annualCeiling: Infinity,
          color: BRACKET_COLORS[6],
        }]),
        additionalSections: [
          {
            title: 'ביטוח לאומי + בריאות',
            content: '0.4% + 3.1% (עד ₪7,420/חודש)\n7.0% + 5.0% (₪7,421 – ₪49,030/חודש)\n0% מעל ₪49,030/חודש',
          },
        ],
      };
  }
}

// ─── Bracket Row ──────────────────────────────────────────────────────────────

function BracketRow({
  index,
  bracket,
  isCurrentBracket,
  amountInBracket,
  taxInBracket,
  maxCeiling,
  currency,
}: {
  index: number;
  bracket: BracketDisplay;
  isCurrentBracket: boolean;
  amountInBracket: number;
  taxInBracket: number;
  maxCeiling: number;
  currency: string;
}) {
  const fillFraction = bracket.annualCeiling === Infinity
    ? 1
    : Math.min(1, bracket.annualCeiling / maxCeiling);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(400)}
      testID={`bracket-row-${index}`}
      style={{
        marginBottom: 10,
        borderRadius: 16,
        borderWidth: isCurrentBracket ? 1.5 : 1,
        borderColor: isCurrentBracket ? bracket.color : BORDER,
        backgroundColor: isCurrentBracket ? `${bracket.color}14` : BG_CARD,
        overflow: 'hidden',
        shadowColor: isCurrentBracket ? bracket.color : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isCurrentBracket ? 0.35 : 0,
        shadowRadius: 12,
        elevation: isCurrentBracket ? 4 : 0,
      }}
    >
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>{bracket.monthlyRange}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isCurrentBracket ? (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: bracket.color }}>{'Your bracket'}</Text>
              </View>
            ) : null}
            <View style={{
              backgroundColor: bracket.color,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{bracket.label}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 8 }}>
          <View style={{
            height: 5,
            borderRadius: 3,
            width: `${Math.round(fillFraction * 100)}%`,
            backgroundColor: bracket.color,
          }} />
        </View>

        {amountInBracket > 0 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: bracket.color }}>
              {`Tax: ${currency}${Math.round(taxInBracket).toLocaleString()}`}
            </Text>
            <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
              {`${currency}${Math.round(amountInBracket).toLocaleString()} in this bracket`}
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
  const region = useSettingsStore((s) => s.region) ?? 'IL';
  const currentMonthKey = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const { data: currentMonthSessions } = useAuthSessions(token, currentMonthKey);

  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const carBenefitMonthly = useSettingsStore((s) => s.carBenefitMonthly);
  const carGrossupMonthly = useSettingsStore((s) => s.carGrossupMonthly);
  const taxCreditPoints = useSettingsStore((s) => s.taxCreditPoints);
  const overtimeEnabled = useSettingsStore((s) => s.overtimeEnabled);
  const overtimeMode = useSettingsStore((s) => s.overtimeMode);
  const oneTimeAdditions = useSettingsStore(useShallow((s) => s.oneTimeAdditions));
  const trainingFundValue = useSettingsStore((s) => s.trainingFundValue);
  const trainingFundType = useSettingsStore((s) => s.trainingFundType);
  const transportationValue = useSettingsStore((s) => s.transportationValue);
  const transportationType = useSettingsStore((s) => s.transportationType);
  const employerPensionRate = useSettingsStore((s) => s.employerPensionRate);

  const regionConfig = useMemo(() => getRegionConfig(region), [region]);
  const currencySymbol = useMemo(() => getRegionCurrencySymbol(region as 'IL' | 'US' | 'UK' | 'EU'), [region]);

  const currentMonthShifts = useMemo(
    () => (currentMonthSessions ?? []).filter((s: WorkSession) => s.sessionType !== 'sick' && s.sessionType !== 'vacation'),
    [currentMonthSessions]
  );

  const baseMonthlyGross = useMemo(() => {
    if (!overtimeEnabled) return currentMonthShifts.reduce((t: number, s: WorkSession) => t + (s.netMinutes / 60) * hourlyRate, 0);
    if (overtimeMode === 'daily') return calcOvertimePayMonthly(currentMonthShifts, hourlyRate);
    const totalNetMinutes = currentMonthShifts.reduce((t: number, s: WorkSession) => t + s.netMinutes, 0);
    return calcOvertimePay(totalNetMinutes, hourlyRate, 'monthly');
  }, [currentMonthShifts, hourlyRate, overtimeEnabled, overtimeMode]);

  const oneTimeBonusTotal = useMemo(
    () => oneTimeAdditions.filter(a => a.month === currentMonthKey && a.isGross && !a.isTaxOnly).reduce((t, a) => t + a.amount, 0),
    [oneTimeAdditions, currentMonthKey]
  );

  const oneTimeGiftTotal = useMemo(
    () => oneTimeAdditions.filter(a => a.month === currentMonthKey && a.isTaxOnly).reduce((t, a) => t + a.amount, 0),
    [oneTimeAdditions, currentMonthKey]
  );

  const oneTimePensionTotal = useMemo(
    () => oneTimeAdditions.filter(a => a.month === currentMonthKey && a.isPension).reduce((t, a) => t + a.amount, 0),
    [oneTimeAdditions, currentMonthKey]
  );

  const totalNetHours = useMemo(
    () => currentMonthShifts.reduce((t: number, s: WorkSession) => t + s.netMinutes / 60, 0),
    [currentMonthShifts]
  );

  const taxResult = useMemo(
    () => calcRegionalTax({
      region: (region as 'IL' | 'US' | 'UK' | 'EU') || 'IL',
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
      oneTimePensionTotal,
      employerPensionRate: employerPensionRate / 100,
      totalHours: totalNetHours > 0 ? totalNetHours : undefined,
    }),
    [region, baseMonthlyGross, carBenefitMonthly, carGrossupMonthly, taxCreditPoints,
     trainingFundValue, trainingFundType, transportationValue,
     transportationType, oneTimeBonusTotal, oneTimeGiftTotal, oneTimePensionTotal, employerPensionRate,
     totalNetHours]
  );

  // Annual taxable income for bracket determination
  const annualTaxable = useMemo(
    () => (baseMonthlyGross + carGrossupMonthly + carBenefitMonthly + oneTimeBonusTotal + oneTimeGiftTotal) * 12,
    [baseMonthlyGross, carGrossupMonthly, carBenefitMonthly, oneTimeBonusTotal, oneTimeGiftTotal]
  );

  // Determine current bracket index
  const currentBracketIdx = useMemo(() => {
    const brackets = regionConfig.brackets;
    for (let i = 0; i < brackets.length; i++) {
      if (annualTaxable <= brackets[i].annualCeiling) return i;
    }
    return brackets.length - 1;
  }, [annualTaxable, regionConfig.brackets]);

  // Compute per-bracket breakdown
  const bracketBreakdown = useMemo(() => {
    const brackets = regionConfig.brackets;
    let remaining = annualTaxable;
    // For US/UK, account for standard deductions in breakdown display
    // For IL: no adjustment (handled by tax engine)
    let prev = 0;
    return brackets.map((b) => {
      if (remaining <= 0) return { amountInBracket: 0, taxInBracket: 0 };
      const ceiling = b.annualCeiling === Infinity ? prev + remaining : b.annualCeiling;
      const span = Math.min(remaining, ceiling - prev);
      const amount = Math.max(0, span);
      const tax = amount * b.rate;
      remaining -= amount;
      prev = ceiling;
      return { amountInBracket: amount / 12, taxInBracket: tax / 12 };
    });
  }, [annualTaxable, regionConfig.brackets]);

  const maxCeiling = useMemo(() => {
    const finite = regionConfig.brackets.filter(b => b.annualCeiling !== Infinity);
    return finite.length > 0 ? (finite[finite.length - 1]?.annualCeiling ?? 663_240) : 663_240;
  }, [regionConfig.brackets]);

  // IL-specific: credit point worth
  const creditPointWorth = region === 'IL' ? TAX_CONFIG.creditPointMonthly * taxCreditPoints : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} testID="tax-brackets-screen">
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(350)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 16,
        }}
      >
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
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center' }}>
            {regionConfig.title}
          </Text>
          <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'center', marginTop: 2 }}>
            {regionConfig.subtitle}
          </Text>
        </View>
        {/* Region badge */}
        <View style={{
          backgroundColor: 'rgba(59,130,246,0.15)',
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderWidth: 1,
          borderColor: 'rgba(59,130,246,0.3)',
        }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#60A5FA' }}>{region}</Text>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
      >
        {/* Estimate disclaimer for non-IL */}
        {regionConfig.isEstimate ? (
          <Animated.View
            entering={FadeInDown.delay(30).duration(400)}
            style={{
              flexDirection: 'row',
              gap: 8,
              backgroundColor: 'rgba(245,158,11,0.08)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: 'rgba(245,158,11,0.2)',
              alignItems: 'flex-start',
            }}
          >
            <Info size={14} color="#F59E0B" style={{ marginTop: 1 }} />
            <Text style={{ fontSize: 11, color: 'rgba(245,158,11,0.9)', flex: 1, lineHeight: 17 }}>
              {regionConfig.estimateNote}
            </Text>
          </Animated.View>
        ) : null}

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
            <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 4 }}>
              {'This month gross'}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#60A5FA' }}>
              {`${currencySymbol}${Math.round(taxResult.regularGross).toLocaleString()}`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
              <View>
                <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'Income Tax'}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#F87171', marginTop: 2 }}>
                  {`${currencySymbol}${Math.round(taxResult.incomeTax).toLocaleString()}`}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: BORDER }} />
              <View>
                <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                  {region === 'IL' ? 'ביטוח לאומי + בריאות' : region === 'US' ? 'FICA' : region === 'UK' ? 'National Insurance' : 'Social'}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FBBF24', marginTop: 2 }}>
                  {`${currencySymbol}${Math.round(taxResult.nationalInsurance + taxResult.healthInsurance).toLocaleString()}`}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: BORDER }} />
              <View>
                <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'Net Pay'}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#4ADE80', marginTop: 2 }}>
                  {`${currencySymbol}${Math.round(taxResult.finalTakeHome).toLocaleString()}`}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Section title */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, marginBottom: 12, letterSpacing: 0.4 }}>
            {`${regionConfig.brackets.length} TAX BRACKETS`}
          </Text>
        </Animated.View>

        {/* Bracket rows */}
        {regionConfig.brackets.map((bracket, i) => {
          const { amountInBracket, taxInBracket } = bracketBreakdown[i] ?? { amountInBracket: 0, taxInBracket: 0 };
          return (
            <BracketRow
              key={`${bracket.label}-${i}`}
              index={i}
              bracket={bracket}
              isCurrentBracket={i === currentBracketIdx}
              amountInBracket={amountInBracket}
              taxInBracket={taxInBracket}
              maxCeiling={maxCeiling}
              currency={currencySymbol}
            />
          );
        })}

        {/* IL: Credit points info */}
        {region === 'IL' ? (
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
              {`${taxCreditPoints} נקודות = פטור של ₪${Math.round(creditPointWorth).toLocaleString()}/חודש`}
            </Text>
            <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4, lineHeight: 18 }}>
              {'כל נקודת זיכוי שווה ₪242/חודש ישירות מהמס — לא מהברוטו. רווק/ה מקבל/ת 2.25 נקודות, נשוי/אה עוד נקודה.'}
            </Text>
          </Animated.View>
        ) : null}

        {/* Additional sections (FICA, NI, etc.) */}
        {(regionConfig.additionalSections ?? []).map((section, i) => (
          <Animated.View
            key={section.title}
            entering={FadeInDown.delay(520 + i * 40).duration(400)}
            style={{
              backgroundColor: BG_CARD,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: BORDER,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 8 }}>
              {section.title}
            </Text>
            <Text style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 20 }}>
              {section.content}
            </Text>
          </Animated.View>
        ))}

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
          <Text style={{ fontSize: 12, color: 'rgba(148,197,255,0.85)', lineHeight: 20 }}>
            {region === 'IL'
              ? 'מדרגות מס הן מצטברות — רק החלק שמעל הסף של כל מדרגה ממוסה בשיעור הגבוה יותר. מעבר למדרגה הבאה לא אומר שכל השכר ממוסה בשיעור החדש.'
              : 'Tax brackets are progressive — only the income within each bracket is taxed at that rate. Moving into a higher bracket does not mean all income is taxed at the higher rate.'}
          </Text>
        </Animated.View>

        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
          {region === 'IL'
            ? 'לפי נתוני רשות המסים 2026. אינו תחליף לייעוץ מס.'
            : region === 'US'
            ? 'Based on 2026 US federal tax rates. Not tax advice.'
            : region === 'UK'
            ? 'Based on HMRC 2025/26 tax year rates. Not tax advice.'
            : 'Generic EU estimate. Consult your local tax authority.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
