import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  TrendingUp,
  Zap,
  Target,
  Shield,
  Info,
  ChevronDown,
  BarChart3,
} from 'lucide-react-native';
import { useSettingsStore, type OneTimeAddition } from '@/lib/state/settings-store';
import { useAuthSessions } from '@/lib/api/workclock-api';
import { useAuthStore } from '@/lib/state/auth-store';
import { formatCurrency } from '@/lib/utils';
import {
  calcIsraeliTax,
  getBracketInfo,
  simulateExtraHours,
  getSmartTips,
  TAX_CONFIG,
} from '@/lib/utils/tax-calc';
import { calcRegionalTax } from '@/lib/utils/regional-tax-engine';
import { calcOvertimePay, calcOvertimePayMonthly } from '@/lib/utils/overtime-calc';
import { TAG_COLORS, type SalaryTag } from '@/lib/utils/salary-engine';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG_DEEP  = '#080E1A';
const BG_CARD  = '#0F1729';
const BG_CARD2 = '#0D1526';
const BORDER   = 'rgba(255,255,255,0.08)';
const BORDER_BLUE  = 'rgba(59,130,246,0.18)';
const BORDER_AMBER = 'rgba(245,158,11,0.18)';
const BORDER_GREEN = 'rgba(34,197,94,0.2)';
const TEXT_PRIMARY   = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.48)';
const TEXT_MUTED     = 'rgba(255,255,255,0.28)';
const ACCENT_BLUE  = '#3B82F6';
const ACCENT_CYAN  = '#06B6D4';
const ACCENT_GREEN = '#22C55E';
const ACCENT_RED   = '#F87171';
const ACCENT_AMBER = '#F59E0B';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TagPill({ tag }: { tag: SalaryTag }) {
  const c = TAG_COLORS[tag];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: c.text }}>{tag}</Text>
    </View>
  );
}

function SectionLabel({ label, color = TEXT_SECONDARY }: { label: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 14, marginBottom: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 8 }} />
      <Text style={{ fontSize: 10, fontWeight: '700', color, letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 6 }} />;
}

// Component row with icon + label + explanation + tags + amount
function ComponentRow({
  icon,
  label,
  explanation,
  tags,
  amount,
  amountColor,
  prefix = '',
  dimOpacity = 1,
}: {
  icon: string;
  label: string;
  explanation?: string;
  tags?: SalaryTag[];
  amount: number;
  amountColor: string;
  prefix?: string;
  dimOpacity?: number;
}) {
  return (
    <View style={{
      flexDirection: 'row-reverse',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingVertical: 10,
      opacity: dimOpacity,
    }}>
      <View style={{ flexDirection: 'row-reverse', gap: 9, flex: 1, alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 15, marginTop: 1 }}>{icon}</Text>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' }}>{label}</Text>
          {explanation ? (
            <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', lineHeight: 15 }}>{explanation}</Text>
          ) : null}
          {tags && tags.length > 0 ? (
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
              {tags.map((t) => <TagPill key={t} tag={t} />)}
            </View>
          ) : null}
        </View>
      </View>
      <Text style={{
        fontSize: 14,
        fontWeight: '700',
        color: amountColor,
        fontVariant: ['tabular-nums'],
        marginLeft: 10,
        marginTop: 1,
      }}>
        {prefix}{formatCurrency(amount)}
      </Text>
    </View>
  );
}

// Sub-total row (section summary)
function SubtotalRow({
  label,
  amount,
  accentColor,
  bgColor,
  borderColor,
}: {
  label: string;
  amount: number;
  accentColor: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <View style={{
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: bgColor,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginTop: 6,
      borderWidth: 1,
      borderColor,
    }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: accentColor }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '800', color: accentColor, fontVariant: ['tabular-nums'] }}>
        {formatCurrency(amount)}
      </Text>
    </View>
  );
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KpiStrip({
  finalTakeHome,
  regularGross,
  taxableGross,
  netToGrossRatio,
  effectiveHourlyNet,
  totalHours,
}: {
  finalTakeHome: number;
  regularGross: number;
  taxableGross: number;
  netToGrossRatio: number;
  effectiveHourlyNet: number;
  totalHours: number;
}) {
  type KpiCard = { label: string; value: string; accent: string; bg: string; border: string; big?: boolean };

  const cards: KpiCard[] = [
    {
      label: 'נטו לקבלה',
      value: formatCurrency(finalTakeHome),
      accent: '#4ADE80',
      bg: 'rgba(34,197,94,0.08)',
      border: BORDER_GREEN,
      big: true,
    },
    {
      label: 'ברוטו למס',
      value: formatCurrency(taxableGross),
      accent: ACCENT_AMBER,
      bg: 'rgba(245,158,11,0.07)',
      border: BORDER_AMBER,
    },
    {
      label: 'יחס נטו/ברוטו',
      value: `${Math.round(netToGrossRatio * 100)}%`,
      accent: ACCENT_CYAN,
      bg: 'rgba(6,182,212,0.07)',
      border: 'rgba(6,182,212,0.18)',
    },
    ...(totalHours > 0 && effectiveHourlyNet > 0 ? [{
      label: 'נטו לשעה',
      value: `₪${Math.round(effectiveHourlyNet)}`,
      accent: '#A78BFA',
      bg: 'rgba(139,92,246,0.07)',
      border: 'rgba(139,92,246,0.18)',
    }] : []),
  ];

  return (
    <Animated.View entering={FadeInDown.delay(50).duration(380)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, flexDirection: 'row-reverse' }}
        style={{ flexGrow: 0, marginBottom: 16 }}
      >
        {cards.map((c) => (
          <View
            key={c.label}
            style={{
              backgroundColor: c.bg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              paddingHorizontal: 16,
              paddingVertical: 14,
              minWidth: c.big ? 156 : 118,
              alignItems: 'flex-end',
            }}
          >
            <Text style={{ fontSize: 10, color: TEXT_SECONDARY, marginBottom: 5, letterSpacing: 0.2 }}>{c.label}</Text>
            <Text style={{
              fontSize: c.big ? 26 : 20,
              fontWeight: '800',
              color: c.accent,
              fontVariant: ['tabular-nums'],
              textShadowColor: c.big ? 'rgba(74,222,128,0.3)' : 'transparent',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: c.big ? 12 : 0,
            }}>
              {c.value}
            </Text>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

// ─── Key Metrics Card ─────────────────────────────────────────────────────────

function KeyMetricsCard({
  effectiveTaxRate,
  netToGrossRatio,
  effectiveHourlyNet,
  totalHours,
  regularGross,
  employerPension,
}: {
  effectiveTaxRate: number;
  netToGrossRatio: number;
  effectiveHourlyNet: number;
  totalHours: number;
  regularGross: number;
  employerPension: number;
}) {
  const metrics = [
    {
      label: 'שיעור ניכוי אפקטיבי',
      value: `${Math.round(effectiveTaxRate)}%`,
      sub: 'מס + ביטוח לאומי + בריאות',
      color: ACCENT_RED,
    },
    {
      label: 'יחס נטו / ברוטו רגיל',
      value: `${Math.round(netToGrossRatio * 100)}%`,
      sub: 'מכל שקל ברוטו נשאר',
      color: ACCENT_GREEN,
    },
    ...(totalHours > 0 && effectiveHourlyNet > 0 ? [{
      label: 'שכר נטו לשעה',
      value: `₪${Math.round(effectiveHourlyNet)}`,
      sub: `${totalHours.toFixed(1)} שעות החודש`,
      color: '#A78BFA',
    }] : []),
    ...(employerPension > 0 ? [{
      label: 'הפרשות מעסיק',
      value: formatCurrency(employerPension),
      sub: 'לפנסיה (על שכר בסיס)',
      color: '#14B8A6',
    }] : []),
  ];

  return (
    <Animated.View
      entering={FadeInDown.delay(90).duration(400)}
      style={{
        backgroundColor: BG_CARD,
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: BORDER,
        marginBottom: 16,
      }}
      testID="key-metrics-card"
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(6,182,212,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart3 size={16} color={ACCENT_CYAN} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>{'מדדים מרכזיים'}</Text>
      </View>

      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>
        {metrics.map((m) => (
          <View
            key={m.label}
            style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
              minWidth: '44%',
              flex: 1,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '800', color: m.color, fontVariant: ['tabular-nums'], textAlign: 'right', marginBottom: 3 }}>
              {m.value}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' }}>{m.label}</Text>
            <Text style={{ fontSize: 10, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 1 }}>{m.sub}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Salary Breakdown Card (3-layer) ─────────────────────────────────────────

function SalaryBreakdownCard({
  baseGross,
  regularGross,
  taxableGross,
  incomeTax,
  nationalInsurance,
  healthInsurance,
  netPay,
  effectiveTaxRate,
  carBenefitMonthly,
  carGrossupMonthly,
  trainingFundDeduction,
  transportationAllowance,
  finalTakeHome,
  bonusAdditions,
  giftAdditions,
  employerPension,
}: {
  baseGross: number;
  regularGross: number;
  taxableGross: number;
  incomeTax: number;
  nationalInsurance: number;
  healthInsurance: number;
  netPay: number;
  effectiveTaxRate: number;
  carBenefitMonthly: number;
  carGrossupMonthly: number;
  trainingFundDeduction: number;
  transportationAllowance: number;
  finalTakeHome: number;
  bonusAdditions: OneTimeAddition[];
  giftAdditions: OneTimeAddition[];
  employerPension: number;
}) {
  const hasTaxOnlyItems = carBenefitMonthly > 0 || giftAdditions.length > 0;

  return (
    <Animated.View
      entering={FadeInDown.delay(130).duration(420)}
      style={{
        backgroundColor: BG_CARD2,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: BORDER_BLUE,
        marginBottom: 16,
        shadowColor: '#3B82F6',
        shadowOpacity: 0.12,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
      }}
      testID="salary-breakdown-card"
    >
      {/* Header */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={18} color="#60A5FA" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#60A5FA', textAlign: 'right' }}>{'פירוט שכר מלא'}</Text>
          <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 1 }}>{'חישוב מס ישראלי 2026 — 3 שכבות'}</Text>
        </View>
      </View>

      {/* 3-tier summary strip */}
      <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 14, marginBottom: 6 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(52,211,153,0.08)', borderRadius: 14, padding: 12, alignItems: 'flex-end', borderWidth: 1, borderColor: 'rgba(52,211,153,0.2)' }}>
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 4, letterSpacing: 0.4 }}>{'ברוטו לתשלום'}</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#34D399', fontVariant: ['tabular-nums'] }}>{formatCurrency(regularGross)}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: 'rgba(96,165,250,0.08)', borderRadius: 14, padding: 12, alignItems: 'flex-end', borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)' }}>
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 4, letterSpacing: 0.4 }}>{'ברוטו לחישוב מס'}</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#60A5FA', fontVariant: ['tabular-nums'] }}>{formatCurrency(taxableGross)}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 14, padding: 12, alignItems: 'flex-end', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 4, letterSpacing: 0.4 }}>{'נטו בפועל'}</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#A78BFA', fontVariant: ['tabular-nums'] }}>{formatCurrency(finalTakeHome)}</Text>
        </View>
      </View>

      {/* ── Layer 1: ברוטו רגיל ─────────────────────────────────────── */}
      <SectionLabel label="שכבה 1 — הכנסות ברוטו רגיל" color="#60A5FA" />

      <ComponentRow
        icon="💰"
        label="שכר בסיס"
        explanation="שעות × שכר שעתי, כולל שעות נוספות"
        tags={['שכר בסיס', 'נכנס לנטו', 'בסיס פנסיוני']}
        amount={baseGross}
        amountColor={ACCENT_GREEN}
      />

      {carGrossupMonthly > 0 ? (
        <ComponentRow
          icon="🚗"
          label="גילום רכב"
          explanation="כיסוי עלות המס על הרכב — נכנס לנטו בפועל"
          tags={['נכנס לנטו', 'מגדיל בסיס מס', 'לא נכלל בפנסיה']}
          amount={carGrossupMonthly}
          amountColor={ACCENT_GREEN}
        />
      ) : null}

      {bonusAdditions.map((a) => (
        <ComponentRow
          key={a.id}
          icon="💎"
          label={a.name}
          explanation="בונוס חד-פעמי — נכנס לנטו, חייב במס"
          tags={['נכנס לנטו', 'הטבה חייבת', 'לא נכלל בפנסיה']}
          amount={a.amount}
          amountColor={ACCENT_GREEN}
        />
      ))}

      <SubtotalRow
        label="= ברוטו רגיל (הכנסה במזומן)"
        amount={regularGross}
        accentColor="#60A5FA"
        bgColor="rgba(59,130,246,0.07)"
        borderColor={BORDER_BLUE}
      />

      {/* ── Layer 2: זקיפות מס ────────────────────────────────────── */}
      {hasTaxOnlyItems ? (
        <>
          <SectionLabel label="שכבה 2 — זקיפות מס (לא מזומן)" color={ACCENT_AMBER} />

          {carBenefitMonthly > 0 ? (
            <ComponentRow
              icon="🚗"
              label="שווי שימוש ברכב"
              explanation="מגדיל בסיס מס — לא מתקבל כמזומן"
              tags={['לצורכי מס בלבד', 'מגדיל בסיס מס', 'לא נכלל בפנסיה']}
              amount={carBenefitMonthly}
              amountColor={ACCENT_AMBER}
              dimOpacity={0.75}
            />
          ) : null}

          {giftAdditions.map((a) => (
            <ComponentRow
              key={a.id}
              icon="🎁"
              label={a.name}
              explanation="שי/גיפטקארד — מגדיל בסיס מס, אינו מזומן"
              tags={['לצורכי מס בלבד', 'הטבה חייבת', 'לא נכלל בפנסיה']}
              amount={a.amount}
              amountColor={ACCENT_AMBER}
              dimOpacity={0.75}
            />
          ))}

          <SubtotalRow
            label="= ברוטו למס (בסיס חישוב מס הכנסה)"
            amount={taxableGross}
            accentColor={ACCENT_AMBER}
            bgColor="rgba(245,158,11,0.07)"
            borderColor={BORDER_AMBER}
          />
        </>
      ) : null}

      {/* ── Layer 3: ניכויים ─────────────────────────────────────── */}
      <SectionLabel label="שכבה 3 — ניכויים" color={ACCENT_RED} />

      <ComponentRow
        icon="📊"
        label="מס הכנסה"
        explanation={`מחושב על ברוטו למס (${formatCurrency(taxableGross)})`}
        amount={incomeTax}
        amountColor={ACCENT_RED}
        prefix="−"
      />

      <ComponentRow
        icon="🏥"
        label="ביטוח לאומי"
        explanation="מחושב על ברוטו רגיל, עד תקרת ₪49,030"
        amount={nationalInsurance}
        amountColor={ACCENT_RED}
        prefix="−"
      />

      <ComponentRow
        icon="💊"
        label="ביטוח בריאות"
        explanation="מחושב על ברוטו רגיל, עד תקרת ₪49,030"
        amount={healthInsurance}
        amountColor={ACCENT_RED}
        prefix="−"
      />

      {trainingFundDeduction > 0 ? (
        <ComponentRow
          icon="🏦"
          label="קרן השתלמות (עובד)"
          explanation="ניכוי מברוטו — חוסך גם ממס הכנסה"
          amount={trainingFundDeduction}
          amountColor={ACCENT_RED}
          prefix="−"
        />
      ) : null}

      <Divider />

      {/* Net before transport */}
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
        <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>{'נטו לפני נסיעות'}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY, fontVariant: ['tabular-nums'] }}>
          {formatCurrency(netPay)}
        </Text>
      </View>

      {/* Transport */}
      {transportationAllowance > 0 ? (
        <ComponentRow
          icon="🚌"
          label="נסיעות / החזר הוצאות"
          explanation="מתווסף לאחר המס — פטור ממס הכנסה"
          tags={['נכנס לנטו', 'פטור ממס', 'הטבת מעסיק']}
          amount={transportationAllowance}
          amountColor={ACCENT_GREEN}
          prefix="+"
        />
      ) : null}

      {/* Final take-home */}
      <View style={{
        backgroundColor: 'rgba(34,197,94,0.09)',
        borderRadius: 16,
        padding: 16,
        marginTop: 10,
        borderWidth: 1,
        borderColor: BORDER_GREEN,
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY }}>{'נטו לקבלה'}</Text>
          <Text style={{ fontSize: 10, color: TEXT_SECONDARY, marginTop: 2 }}>{'מה שנכנס לחשבון הבנק'}</Text>
        </View>
        <Text style={{
          fontSize: 30,
          fontWeight: '800',
          color: '#4ADE80',
          fontVariant: ['tabular-nums'],
          textShadowColor: 'rgba(74,222,128,0.3)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 14,
        }}>
          {formatCurrency(finalTakeHome)}
        </Text>
      </View>

      {/* Badges row */}
      <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <View style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 99, paddingHorizontal: 11, paddingVertical: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: ACCENT_RED }}>
            {`${Math.round(effectiveTaxRate)}% שיעור ניכוי`}
          </Text>
        </View>
        {employerPension > 0 ? (
          <View style={{ backgroundColor: 'rgba(20,184,166,0.1)', borderRadius: 99, paddingHorizontal: 11, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#14B8A6' }}>
              {`${formatCurrency(employerPension)} הפרשות מעסיק`}
            </Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ─── Bracket Progress Card ────────────────────────────────────────────────────

const BRACKET_COLORS = ['#22C55E', '#84CC16', '#EAB308', '#F97316', '#EF4444', '#DC2626', '#991B1B'];

function BracketProgressCard({
  monthlyGross,
  carBenefitMonthly,
  currentRate,
  currentLabel,
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
      entering={FadeInDown.delay(220).duration(420)}
      style={{ backgroundColor: BG_CARD, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: BORDER, marginBottom: 16 }}
      testID="bracket-progress-card"
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(6,182,212,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={16} color={ACCENT_CYAN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>{'מדרגת המס שלך'}</Text>
          <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 1 }}>{`נמצא במדרגת ${currentLabel}`}</Text>
        </View>
      </View>

      <View style={{ gap: 7, marginBottom: 16 }}>
        {brackets.map((bracket, i) => {
          const isCurrent = bracket.rate === currentRate;
          const isPast = annualTaxable > (i > 0 ? brackets[i - 1]!.upTo : 0);
          const bColor = BRACKET_COLORS[i] ?? ACCENT_BLUE;
          return (
            <View key={bracket.label} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, fontWeight: isCurrent ? '800' : '400', color: isCurrent ? bColor : TEXT_MUTED }}>
                  {bracket.label}
                </Text>
              </View>
              <View style={{ flex: 1, height: isCurrent ? 10 : 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                {isPast ? (
                  <View style={{ height: '100%', borderRadius: 3, width: isCurrent ? '65%' : '100%', backgroundColor: isCurrent ? bColor : `${bColor}55` }} />
                ) : null}
              </View>
              {isCurrent ? (
                <View style={{ backgroundColor: `${bColor}22`, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: bColor }}>{'כאן'}</Text>
                </View>
              ) : (
                <View style={{ width: 32 }} />
              )}
            </View>
          );
        })}
      </View>

      {!isTopBracket && monthlyAmountToNextBracket !== null ? (
        <View style={{ backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER_BLUE }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: ACCENT_BLUE, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
            {formatCurrency(monthlyAmountToNextBracket)}
          </Text>
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 3 }}>
            {`עד מדרגת ${nextLabel ?? ''} הבאה`}
          </Text>
          <Text style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'right', marginTop: 6, lineHeight: 16 }}>
            {`רוב השכר שלך עדיין ממוסה ב-${Math.round(currentRate * 100)}% — המדרגה הבאה משפיעה רק על השכר מעל הסף`}
          </Text>
        </View>
      ) : (
        <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT_RED, textAlign: 'right' }}>
            {'אתה במדרגת המס הגבוהה ביותר (50%)'}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Smart Tips Section ───────────────────────────────────────────────────────

const TIP_ICONS: Record<number, string> = { 0: '⚡', 1: '💡', 2: '🚗', 3: '📊' };

function SmartTipsSection({ tips }: { tips: string[] }) {
  if (tips.length === 0) return null;
  return (
    <Animated.View
      entering={FadeInDown.delay(300).duration(420)}
      style={{ marginBottom: 16 }}
      testID="smart-tips-section"
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Zap size={17} color={ACCENT_AMBER} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY }}>{'תובנות חכמות'}</Text>
      </View>
      <View style={{ gap: 10 }}>
        {tips.map((tip, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(300 + i * 70).duration(360)}
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
            <Text style={{ flex: 1, fontSize: 13, color: TEXT_PRIMARY, textAlign: 'right', lineHeight: 19 }}>{tip}</Text>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Month Comparison Card ────────────────────────────────────────────────────

function MonthComparisonCard({
  currentHours,
  currentGross,
  currentNet,
  lastHours,
  lastGross,
  lastNet,
}: {
  currentHours: number;
  currentGross: number;
  currentNet: number;
  lastHours: number;
  lastGross: number;
  lastNet: number;
}) {
  const noLastData = lastHours === 0 && lastGross === 0;
  type Row = { label: string; current: number; last: number; diff: number; isHours?: boolean; fmt: (v: number) => string };

  const rows: Row[] = [
    { label: 'שעות', current: currentHours, last: lastHours, diff: currentHours - lastHours, isHours: true, fmt: (v) => v.toFixed(1) },
    { label: 'ברוטו רגיל', current: currentGross, last: lastGross, diff: currentGross - lastGross, fmt: formatCurrency },
    { label: 'נטו לקבלה', current: currentNet, last: lastNet, diff: currentNet - lastNet, fmt: formatCurrency },
  ];

  return (
    <Animated.View
      entering={FadeInDown.delay(170).duration(420)}
      style={{ backgroundColor: BG_CARD, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: BORDER, marginBottom: 16 }}
      testID="month-comparison-card"
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(6,182,212,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={16} color={ACCENT_CYAN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>{'השוואה לחודש שעבר'}</Text>
          <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 1 }}>{'החודש הנוכחי מול החודש הקודם'}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
        <Text style={{ fontSize: 11, color: TEXT_MUTED, flex: 1, textAlign: 'right' }}>{'פריט'}</Text>
        <Text style={{ fontSize: 11, color: TEXT_MUTED, width: 70, textAlign: 'center' }}>{'חודש שעבר'}</Text>
        <Text style={{ fontSize: 11, color: TEXT_MUTED, width: 70, textAlign: 'center' }}>{'החודש'}</Text>
        <Text style={{ fontSize: 11, color: TEXT_MUTED, width: 46, textAlign: 'center' }}>{'שינוי'}</Text>
      </View>

      {rows.map((row, i) => (
        <View
          key={row.label}
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 11,
            borderBottomWidth: i < rows.length - 1 ? 1 : 0,
            borderBottomColor: 'rgba(255,255,255,0.04)',
          }}
        >
          <Text style={{ fontSize: 13, color: TEXT_PRIMARY, flex: 1, textAlign: 'right', fontWeight: '500' }}>{row.label}</Text>
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, width: 70, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
            {noLastData ? '—' : row.fmt(row.last)}
          </Text>
          <Text style={{ fontSize: 13, color: TEXT_PRIMARY, width: 70, textAlign: 'center', fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {row.fmt(row.current)}
          </Text>
          <View style={{ width: 46, alignItems: 'center' }}>
            {noLastData ? (
              <Text style={{ fontSize: 10, color: TEXT_MUTED }}>{'—'}</Text>
            ) : (
              <View style={{
                backgroundColor: row.diff >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.12)',
                borderRadius: 99, paddingHorizontal: 5, paddingVertical: 2,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: row.diff >= 0 ? ACCENT_GREEN : ACCENT_RED }}>
                  {row.diff >= 0
                    ? `+${row.fmt(row.diff)}`
                    : row.isHours ? row.fmt(row.diff) : `−${row.fmt(Math.abs(row.diff))}`}
                </Text>
              </View>
            )}
          </View>
        </View>
      ))}
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
  finalNet,
  delay,
}: {
  extraHours: number;
  extraGross: number;
  extraNet: number;
  keepRate: number;
  bracketCrossed: boolean;
  finalNet: number;
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
        borderColor: bracketCrossed ? 'rgba(245,158,11,0.22)' : BORDER,
        flex: 1,
      }}
    >
      <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 4 }}>{`+${extraHours} שעות`}</Text>
      <Text style={{ fontSize: 28, fontWeight: '800', color: bracketCrossed ? ACCENT_AMBER : ACCENT_GREEN, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
        {`${Math.round(keepRate)}%`}
      </Text>
      <Text style={{ fontSize: 10, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10, lineHeight: 14 }}>{'מהתוספת יישאר אצלך'}</Text>
      <View style={{
        backgroundColor: bracketCrossed ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
        borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-end', marginBottom: 8,
      }}>
        <Text style={{ fontSize: 10, fontWeight: '600', color: bracketCrossed ? ACCENT_AMBER : ACCENT_GREEN }}>
          {bracketCrossed ? 'חוצה מדרגה' : 'אותה מדרגה'}
        </Text>
      </View>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        testID={`simulation-expand-${extraHours}`}
        style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}
      >
        <Text style={{ fontSize: 11, color: ACCENT_BLUE }}>{'פרטים'}</Text>
        <ChevronDown size={11} color={ACCENT_BLUE} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
      </Pressable>
      {expanded ? (
        <View style={{ marginTop: 10, gap: 5, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 }}>
          {[
            { label: 'ברוטו נוסף', value: formatCurrency(extraGross), color: TEXT_PRIMARY },
            { label: 'נטו נוסף', value: formatCurrency(extraNet), color: ACCENT_GREEN },
            { label: 'נטו כולל', value: formatCurrency(finalNet), color: TEXT_PRIMARY },
          ].map((r) => (
            <View key={r.label} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{r.label}</Text>
              <Text style={{ fontSize: 11, color: r.color, fontVariant: ['tabular-nums'] }}>{r.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── Month Slider Helpers ────────────────────────────────────────────────────

function generateMonths(todayKey: string, count: number): string[] {
  const months: string[] = [];
  const [y, m] = todayKey.split('-').map(Number);
  for (let i = 0; i < count; i++) {
    const date = new Date((y ?? 2026), ((m ?? 1) - 1) - i, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const date = new Date((y ?? 2026), ((m ?? 1) - 1), 1);
  return date.toLocaleDateString('he-IL', { month: 'short', year: 'numeric' });
}

// ─── Upgrade Prompt Modal ────────────────────────────────────────────────────

function UpgradeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: '#0F1729',
            borderRadius: 24,
            padding: 28,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(245,158,11,0.3)',
            marginHorizontal: 32,
            width: 300,
          }}
          onPress={() => {}}
        >
          <Text style={{ fontSize: 36, marginBottom: 12 }}>{'🔒'}</Text>
          <Text style={{
            fontSize: 17,
            fontWeight: '700',
            color: '#F0F6FF',
            textAlign: 'center',
            marginBottom: 8,
            lineHeight: 24,
          }}>
            {'שדרג לפרימיום לגישה לכל ההיסטוריה'}
          </Text>
          <Text style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
            marginBottom: 20,
            lineHeight: 18,
          }}>
            {'משתמשי פרימיום יכולים לצפות בנתונים של עד 24 חודשים אחורה'}
          </Text>
          <Pressable
            onPress={() => { onClose(); router.push('/premium' as never); }}
            style={{
              backgroundColor: '#F59E0B',
              borderRadius: 14,
              paddingHorizontal: 28,
              paddingVertical: 13,
              width: '100%',
              alignItems: 'center',
            }}
            testID="upgrade-to-premium-button"
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#080E1A' }}>{'שדרג עכשיו'}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ marginTop: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{'ביטול'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Month Slider Component ──────────────────────────────────────────────────

function MonthSlider({
  todayMonth,
  selectedMonth,
  onSelect,
  maxMonthsBack,
}: {
  todayMonth: string;
  selectedMonth: string;
  onSelect: (month: string) => void;
  maxMonthsBack: number;
}) {
  const allMonths = useMemo(() => generateMonths(todayMonth, 24), [todayMonth]);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleSelect = useCallback((month: string, index: number) => {
    const isLocked = index >= maxMonthsBack;
    if (isLocked) {
      setShowUpgrade(true);
      return;
    }
    onSelect(month);
    // Scroll to keep selected chip visible
    const chipWidth = 90;
    const gap = 8;
    scrollRef.current?.scrollTo({ x: Math.max(0, index * (chipWidth + gap) - 80), animated: true });
  }, [maxMonthsBack, onSelect]);

  // Navigate prev/next
  const currentIndex = allMonths.indexOf(selectedMonth);

  const goNext = useCallback(() => {
    if (currentIndex <= 0) return;
    const nextIndex = currentIndex - 1;
    handleSelect(allMonths[nextIndex]!, nextIndex);
  }, [currentIndex, allMonths, handleSelect]);

  const goPrev = useCallback(() => {
    if (currentIndex >= 23) return;
    const prevIndex = currentIndex + 1;
    handleSelect(allMonths[prevIndex]!, prevIndex);
  }, [currentIndex, allMonths, handleSelect]);

  return (
    <>
      <UpgradeModal visible={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <View
        style={{
          backgroundColor: '#0B1020',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
          paddingVertical: 10,
          marginBottom: 8,
        }}
        testID="month-slider"
      >
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 8 }}>
          {/* Right arrow = go forward in time (decrease index) */}
          <Pressable
            onPress={goNext}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: currentIndex <= 0 ? 'rgba(255,255,255,0.03)' : 'rgba(59,130,246,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 4,
            }}
            testID="month-next-button"
          >
            <Text style={{ fontSize: 16, color: currentIndex <= 0 ? 'rgba(255,255,255,0.2)' : '#3B82F6' }}>{'›'}</Text>
          </Pressable>

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4, gap: 8, flexDirection: 'row-reverse' }}
            style={{ flexGrow: 1 }}
          >
            {allMonths.map((month, index) => {
              const isSelected = month === selectedMonth;
              const isLocked = index >= maxMonthsBack;
              return (
                <Pressable
                  key={month}
                  onPress={() => handleSelect(month, index)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: isSelected
                      ? '#3B82F6'
                      : isLocked
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(255,255,255,0.1)',
                    backgroundColor: isSelected
                      ? 'rgba(59,130,246,0.18)'
                      : isLocked
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(255,255,255,0.05)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    shadowColor: isSelected ? '#3B82F6' : 'transparent',
                    shadowOpacity: isSelected ? 0.4 : 0,
                    shadowRadius: isSelected ? 8 : 0,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: isSelected ? 4 : 0,
                  }}
                  testID={`month-chip-${month}`}
                >
                  {isLocked ? (
                    <Text style={{ fontSize: 11, marginRight: 2 }}>{'🔒'}</Text>
                  ) : null}
                  <Text style={{
                    fontSize: 13,
                    fontWeight: isSelected ? '700' : '400',
                    color: isSelected
                      ? '#60A5FA'
                      : isLocked
                        ? 'rgba(255,255,255,0.25)'
                        : 'rgba(255,255,255,0.6)',
                  }}>
                    {formatMonthLabel(month)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Left arrow = go back in time (increase index) */}
          <Pressable
            onPress={goPrev}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: currentIndex >= 23 ? 'rgba(255,255,255,0.03)' : 'rgba(59,130,246,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 4,
            }}
            testID="month-prev-button"
          >
            <Text style={{ fontSize: 16, color: currentIndex >= 23 ? 'rgba(255,255,255,0.2)' : '#3B82F6' }}>{'‹'}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const token = useAuthStore((s) => s.token) ?? '';

  const hourlyRate          = useSettingsStore((s) => s.hourlyRate);
  const carBenefitMonthly   = useSettingsStore((s) => s.carBenefitMonthly);
  const carGrossupMonthly   = useSettingsStore((s) => s.carGrossupMonthly);
  const taxCreditPoints     = useSettingsStore((s) => s.taxCreditPoints);
  const dailyGoalHours      = useSettingsStore((s) => s.dailyGoalHours);
  const trainingFundValue   = useSettingsStore((s) => s.trainingFundValue);
  const trainingFundType    = useSettingsStore((s) => s.trainingFundType);
  const transportationValue = useSettingsStore((s) => s.transportationValue);
  const transportationType  = useSettingsStore((s) => s.transportationType);
  const overtimeEnabled     = useSettingsStore((s) => s.overtimeEnabled);
  const overtimeMode        = useSettingsStore((s) => s.overtimeMode);
  const oneTimeAdditions    = useSettingsStore((s) => s.oneTimeAdditions);
  const employerPensionRate = useSettingsStore((s) => s.employerPensionRate);
  const region = useSettingsStore((s) => s.region);

  const user = useAuthStore((s) => s.user);
  const isPremium = useSettingsStore((s) => s.isPremium);
  const hasFullAccess = isPremium || user?.role === 'ADMIN';
  const maxMonthsBack = hasFullAccess ? 24 : 3;

  const todayMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  const oneTimeBonusTotal = useMemo(
    () => oneTimeAdditions.filter((a) => a.month === selectedMonth && a.isGross && !a.isTaxOnly).reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, selectedMonth]
  );
  const oneTimeGiftTotal = useMemo(
    () => oneTimeAdditions.filter((a) => a.month === selectedMonth && a.isTaxOnly).reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, selectedMonth]
  );
  const oneTimePensionTotal = useMemo(
    () => oneTimeAdditions.filter((a) => a.month === selectedMonth && a.isPension).reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, selectedMonth]
  );

  const { data: sessions, isLoading } = useAuthSessions(token, selectedMonth);

  const lastMonthKey = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date((y ?? 2026), ((m ?? 1) - 1) - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth]);
  const { data: lastMonthSessions } = useAuthSessions(token, lastMonthKey);

  const shiftSessions = useMemo(
    () => (sessions ?? []).filter((s) => s.sessionType !== 'sick' && s.sessionType !== 'vacation'),
    [sessions]
  );

  const totalNetHours = useMemo(
    () => shiftSessions.reduce((sum, s) => sum + s.netMinutes / 60, 0),
    [shiftSessions]
  );

  const currentMonthlyGross = useMemo(() => {
    if (!overtimeEnabled) return totalNetHours * hourlyRate;
    if (overtimeMode === 'daily') return calcOvertimePayMonthly(shiftSessions, hourlyRate);
    const totalNetMinutes = shiftSessions.reduce((sum, s) => sum + s.netMinutes, 0);
    return calcOvertimePay(totalNetMinutes, hourlyRate, 'monthly');
  }, [totalNetHours, hourlyRate, overtimeEnabled, overtimeMode, shiftSessions]);

  const taxResult = useMemo(
    () => calcRegionalTax({
      region: (region as 'IL' | 'US' | 'UK' | 'EU') || 'IL',
      monthlyGross: currentMonthlyGross,
      carBenefitMonthly,
      creditPoints: taxCreditPoints,
      trainingFundValue,
      trainingFundType,
      transportationValue,
      transportationType,
      carGrossupMonthly,
      oneTimeBonusTotal,
      oneTimeGiftTotal,
      oneTimePensionTotal,
      employerPensionRate: employerPensionRate / 100,
      totalHours: totalNetHours > 0 ? totalNetHours : undefined,
    }),
    [region, currentMonthlyGross, carBenefitMonthly, taxCreditPoints, trainingFundValue,
     trainingFundType, transportationValue, transportationType, carGrossupMonthly,
     oneTimeBonusTotal, oneTimeGiftTotal, oneTimePensionTotal, employerPensionRate, totalNetHours]
  );

  // Last month
  const lastMonthShifts = useMemo(
    () => (lastMonthSessions ?? []).filter((s) => s.sessionType !== 'sick' && s.sessionType !== 'vacation'),
    [lastMonthSessions]
  );
  const lastMonthHours = useMemo(
    () => lastMonthShifts.reduce((sum, s) => sum + s.netMinutes / 60, 0),
    [lastMonthShifts]
  );
  const lastMonthGross = useMemo(() => {
    if (!overtimeEnabled) return lastMonthHours * hourlyRate;
    if (overtimeMode === 'daily') return calcOvertimePayMonthly(lastMonthShifts, hourlyRate);
    const mins = lastMonthShifts.reduce((sum, s) => sum + s.netMinutes, 0);
    return calcOvertimePay(mins, hourlyRate, 'monthly');
  }, [lastMonthHours, hourlyRate, overtimeEnabled, overtimeMode, lastMonthShifts]);

  const lastMonthBonusTotal = useMemo(
    () => oneTimeAdditions.filter((a) => a.month === lastMonthKey && a.isGross && !a.isTaxOnly).reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, lastMonthKey]
  );
  const lastMonthGiftTotal = useMemo(
    () => oneTimeAdditions.filter((a) => a.month === lastMonthKey && a.isTaxOnly).reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, lastMonthKey]
  );
  const lastMonthPensionTotal = useMemo(
    () => oneTimeAdditions.filter((a) => a.month === lastMonthKey && a.isPension).reduce((s, a) => s + a.amount, 0),
    [oneTimeAdditions, lastMonthKey]
  );
  const lastMonthTax = useMemo(
    () => calcRegionalTax({
      region: (region as 'IL' | 'US' | 'UK' | 'EU') || 'IL',
      monthlyGross: lastMonthGross,
      carBenefitMonthly,
      creditPoints: taxCreditPoints,
      trainingFundValue,
      trainingFundType,
      transportationValue,
      transportationType,
      carGrossupMonthly,
      oneTimeBonusTotal: lastMonthBonusTotal,
      oneTimeGiftTotal: lastMonthGiftTotal,
      oneTimePensionTotal: lastMonthPensionTotal,
      employerPensionRate: employerPensionRate / 100,
    }),
    [region, lastMonthGross, carBenefitMonthly, taxCreditPoints, trainingFundValue,
     trainingFundType, transportationValue, transportationType, carGrossupMonthly,
     lastMonthBonusTotal, lastMonthGiftTotal, lastMonthPensionTotal, employerPensionRate]
  );

  // Bracket info & tips — pass full taxable base (regularGross + benefits)
  const oneTimeTotal = oneTimeBonusTotal + oneTimeGiftTotal;
  const bracketInfo = useMemo(
    () => getBracketInfo(currentMonthlyGross, hourlyRate, carBenefitMonthly + carGrossupMonthly + oneTimeTotal),
    [currentMonthlyGross, hourlyRate, carBenefitMonthly, carGrossupMonthly, oneTimeTotal]
  );
  const tips = useMemo(
    () => getSmartTips(currentMonthlyGross, hourlyRate, carBenefitMonthly + carGrossupMonthly + oneTimeTotal, taxCreditPoints, dailyGoalHours * 20, totalNetHours, 186, carBenefitMonthly),
    [currentMonthlyGross, hourlyRate, carBenefitMonthly, carGrossupMonthly, oneTimeTotal, taxCreditPoints, dailyGoalHours, totalNetHours]
  );

  // Simulations — pass full context so results match actual taxResult
  const simContext = useMemo(() => ({
    carBenefitMonthly,
    creditPoints: taxCreditPoints,
    trainingFundValue,
    trainingFundType,
    transportationValue,
    transportationType,
    carGrossupMonthly,
    oneTimeBonusTotal,
    oneTimeGiftTotal,
    oneTimePensionTotal,
    employerPensionRate: employerPensionRate / 100,
  }), [carBenefitMonthly, taxCreditPoints, trainingFundValue, trainingFundType,
       transportationValue, transportationType, carGrossupMonthly,
       oneTimeBonusTotal, oneTimeGiftTotal, oneTimePensionTotal, employerPensionRate]);

  const sim5  = useMemo(() => simulateExtraHours(currentMonthlyGross, 5,  hourlyRate, simContext), [currentMonthlyGross, hourlyRate, simContext]);
  const sim10 = useMemo(() => simulateExtraHours(currentMonthlyGross, 10, hourlyRate, simContext), [currentMonthlyGross, hourlyRate, simContext]);
  const sim20 = useMemo(() => simulateExtraHours(currentMonthlyGross, 20, hourlyRate, simContext), [currentMonthlyGross, hourlyRate, simContext]);

  const currentBonusAdditions = useMemo(
    () => oneTimeAdditions.filter((a) => a.month === selectedMonth && a.isGross && !a.isTaxOnly),
    [oneTimeAdditions, selectedMonth]
  );
  const currentGiftAdditions = useMemo(
    () => oneTimeAdditions.filter((a) => a.month === selectedMonth && a.isTaxOnly),
    [oneTimeAdditions, selectedMonth]
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
          style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}
        >
          <Text style={{ fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right', letterSpacing: 0.3 }}>
            {'תובנות פיננסיות'}
          </Text>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
            {'הכסף שלך, בצורה ברורה — חישוב מס 2026'}
          </Text>
        </Animated.View>

        {/* Month Slider */}
        <MonthSlider
          todayMonth={todayMonth}
          selectedMonth={selectedMonth}
          onSelect={setSelectedMonth}
          maxMonthsBack={maxMonthsBack}
        />

        {/* KPI Strip */}
        <KpiStrip
          finalTakeHome={taxResult.finalTakeHome}
          regularGross={taxResult.regularGross}
          taxableGross={taxResult.taxableGross}
          netToGrossRatio={taxResult.netToGrossRatio}
          effectiveHourlyNet={taxResult.effectiveHourlyNet}
          totalHours={totalNetHours}
        />

        {isLoading ? (
          <View style={{ padding: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={ACCENT_CYAN} testID="loading-indicator" />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>

            {/* Key Metrics Card */}
            <KeyMetricsCard
              effectiveTaxRate={taxResult.effectiveTaxRate}
              netToGrossRatio={taxResult.netToGrossRatio}
              effectiveHourlyNet={taxResult.effectiveHourlyNet}
              totalHours={totalNetHours}
              regularGross={taxResult.regularGross}
              employerPension={taxResult.employerPension}
            />

            {/* 3-Layer Salary Breakdown */}
            <SalaryBreakdownCard
              baseGross={taxResult.grossPay}
              regularGross={taxResult.regularGross}
              taxableGross={taxResult.taxableGross}
              incomeTax={taxResult.incomeTax}
              nationalInsurance={taxResult.nationalInsurance}
              healthInsurance={taxResult.healthInsurance}
              netPay={taxResult.netPay}
              effectiveTaxRate={taxResult.effectiveTaxRate}
              carBenefitMonthly={carBenefitMonthly}
              carGrossupMonthly={carGrossupMonthly}
              trainingFundDeduction={taxResult.trainingFundDeduction}
              transportationAllowance={taxResult.transportationAllowance}
              finalTakeHome={taxResult.finalTakeHome}
              bonusAdditions={currentBonusAdditions}
              giftAdditions={currentGiftAdditions}
              employerPension={taxResult.employerPension}
            />

            {/* Month Comparison */}
            <MonthComparisonCard
              currentHours={totalNetHours}
              currentGross={taxResult.regularGross}
              currentNet={taxResult.finalTakeHome}
              lastHours={lastMonthHours}
              lastGross={lastMonthTax.regularGross}
              lastNet={lastMonthTax.finalTakeHome}
            />

            {/* Bracket Progress */}
            <BracketProgressCard
              monthlyGross={currentMonthlyGross}
              carBenefitMonthly={carBenefitMonthly + carGrossupMonthly + oneTimeTotal}
              currentRate={bracketInfo.currentRate}
              currentLabel={bracketInfo.currentLabel}
              nextLabel={bracketInfo.nextLabel}
              monthlyAmountToNextBracket={bracketInfo.monthlyAmountToNextBracket}
              hoursToNextBracket={bracketInfo.hoursToNextBracket}
              isTopBracket={bracketInfo.isTopBracket}
            />

            {/* Smart Tips */}
            <SmartTipsSection tips={tips} />

            {/* Simulation */}
            <Animated.View
              entering={FadeInDown.delay(400).duration(400)}
              style={{ marginBottom: 16 }}
              testID="simulation-section"
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Target size={17} color={ACCENT_CYAN} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY }}>{'מה אם אעבוד יותר?'}</Text>
              </View>

              {/* Smart rate summary strip */}
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 12 }}>
                {totalNetHours > 0 && taxResult.effectiveHourlyNet > 0 ? (
                  <View style={{ flex: 1, backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 14, padding: 12, alignItems: 'flex-end', borderWidth: 1, borderColor: 'rgba(167,139,250,0.18)' }}>
                    <Text style={{ fontSize: 9, color: TEXT_SECONDARY, marginBottom: 3 }}>{'שכר נטו לשעה'}</Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#A78BFA', fontVariant: ['tabular-nums'] }}>
                      {`₪${Math.round(taxResult.effectiveHourlyNet)}`}
                    </Text>
                  </View>
                ) : null}
                <View style={{ flex: 1, backgroundColor: 'rgba(248,113,113,0.08)', borderRadius: 14, padding: 12, alignItems: 'flex-end', borderWidth: 1, borderColor: 'rgba(248,113,113,0.18)' }}>
                  <Text style={{ fontSize: 9, color: TEXT_SECONDARY, marginBottom: 3 }}>{'אחוז מס אפקטיבי'}</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: ACCENT_RED, fontVariant: ['tabular-nums'] }}>
                    {`${Math.round(taxResult.effectiveTaxRate)}%`}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(52,211,153,0.08)', borderRadius: 14, padding: 12, alignItems: 'flex-end', borderWidth: 1, borderColor: 'rgba(52,211,153,0.18)' }}>
                  <Text style={{ fontSize: 9, color: TEXT_SECONDARY, marginBottom: 3 }}>{'מכל שעה נוספת'}</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#34D399', fontVariant: ['tabular-nums'] }}>
                    {`₪${Math.round(sim5.extraNet / 5)}`}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                <SimulationCard extraHours={5}  extraGross={sim5.extraGross}  extraNet={sim5.extraNet}  keepRate={sim5.keepRate}  bracketCrossed={sim5.bracketCrossed}  finalNet={sim5.finalTakeHome}  delay={420} />
                <SimulationCard extraHours={10} extraGross={sim10.extraGross} extraNet={sim10.extraNet} keepRate={sim10.keepRate} bracketCrossed={sim10.bracketCrossed} finalNet={sim10.finalTakeHome} delay={460} />
                <SimulationCard extraHours={20} extraGross={sim20.extraGross} extraNet={sim20.extraNet} keepRate={sim20.keepRate} bracketCrossed={sim20.bracketCrossed} finalNet={sim20.finalTakeHome} delay={500} />
              </View>
            </Animated.View>

            {/* Disclaimer */}
            <Animated.View
              entering={FadeInDown.delay(550).duration(400)}
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'flex-start',
                gap: 8,
                backgroundColor: 'rgba(255,255,255,0.025)',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: BORDER,
                marginBottom: 8,
              }}
            >
              <Info size={14} color={TEXT_MUTED} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', lineHeight: 17 }}>
                {'החישובים מבוססים על מדרגות מס 2026 ונתוני הגדרות אישיים. הערכות בלבד לצורך יידועי — לייעוץ מקצועי פנה לרואה חשבון.'}
              </Text>
            </Animated.View>

          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
