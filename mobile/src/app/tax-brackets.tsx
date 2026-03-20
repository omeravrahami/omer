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
  '#991B1B', // 50% — dark red
];

// Monthly bracket ranges (display only)
const BRACKET_MONTHLY_LABELS = [
  'עד ₪7,010/חודש',
  '₪7,011 – ₪10,060',
  '₪10,061 – ₪16,150',
  '₪16,151 – ₪22,440',
  '₪22,441 – ₪46,520',
  '₪46,521 – ₪60,130',
  'מעל ₪60,130',
];

// Annual ceiling for each bracket (for bar fill proportion)
const BRACKET_CEILINGS_ANNUAL = [84_120, 120_720, 193_800, 269_280, 558_240, 721_560, 999_999];
const MAX_CEILING = 721_560;

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

  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const taxCreditPoints = useSettingsStore((s) => s.taxCreditPoints);
  const carBenefitMonthly = useSettingsStore((s) => s.carBenefitMonthly);

  // Estimate monthly gross from hourly rate * ~186 hours
  const estimatedMonthlyGross = useMemo(() => hourlyRate * 186, [hourlyRate]);

  const taxResult = useMemo(
    () =>
      calcIsraeliTax({
        monthlyGross: estimatedMonthlyGross,
        carBenefitMonthly,
        creditPoints: taxCreditPoints,
      }),
    [estimatedMonthlyGross, carBenefitMonthly, taxCreditPoints]
  );

  const annualTaxable = useMemo(
    () => (estimatedMonthlyGross + carBenefitMonthly) * 12,
    [estimatedMonthlyGross, carBenefitMonthly]
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
          {'מדרגות מס בישראל 2024'}
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
              {'המשכורת החודשית המשוערת שלך (186 שעות)'}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#60A5FA', textAlign: 'right' }}>
              {formatCurrency(estimatedMonthlyGross)}
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
                <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'נטו משוער'}</Text>
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
          {'הערכה בלבד לפי נתוני רשות המסים 2024. אינו תחליף לייעוץ מס.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
