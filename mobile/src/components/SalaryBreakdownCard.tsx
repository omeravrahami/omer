import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { formatCurrency } from '@/lib/utils';
import type { SalaryBreakdown } from '@/lib/utils/salary-engine';
import { TAG_COLORS, type SalaryTag } from '@/lib/utils/salary-engine';
import { getRegionCurrencySymbol, type Region } from '@/lib/utils/regional-tax-engine';
import { useTranslation } from 'react-i18next';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SalaryBreakdownCardProps {
  breakdown: SalaryBreakdown;
  region?: Region;
}

function TagPill({ tag }: { tag: string }) {
  const knownTag = tag as SalaryTag;
  const colors = TAG_COLORS[knownTag] ?? { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8' };

  return (
    <View
      style={{
        backgroundColor: colors.bg,
        borderRadius: 99,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.text }}>
        {tag}
      </Text>
    </View>
  );
}

export function SalaryBreakdownCard({ breakdown, region = 'IL' }: SalaryBreakdownCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { t, i18n } = useTranslation();
  const isNonIL = region !== 'IL';
  const isRTL = i18n.language === 'he';

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  // Region-specific label helpers
  const incomeTaxLabel = isNonIL
    ? region === 'US'
      ? t('us_salary.federal_income_tax')
      : t('uk_salary.income_tax')
    : t('salary.income_tax');

  const niLabel = isNonIL
    ? region === 'US'
      ? t('us_salary.social_security')
      : t('uk_salary.national_insurance')
    : t('salary.national_insurance');

  const healthLabel = isNonIL
    ? region === 'US'
      ? t('us_salary.medicare')
      : t('salary.health_insurance')
    : t('salary.health_insurance');

  const grossLabel = isNonIL
    ? region === 'US' ? t('us_salary.gross') : t('uk_salary.gross')
    : t('salary.regular_gross');

  const taxGrossLabel = isNonIL
    ? region === 'US' ? t('us_salary.gross') : t('uk_salary.gross')
    : t('salary.taxable_gross');

  const netLabel = isNonIL
    ? region === 'US' ? t('us_salary.net') : t('uk_salary.net')
    : t('salary.net_pay');

  const currencySymbol = getRegionCurrencySymbol(region);

  const formatAmt = (amount: number) => {
    if (region === 'IL') return formatCurrency(amount);
    return `${currencySymbol}${Math.round(amount).toLocaleString()}`;
  };

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
      }}
      testID="salary-breakdown-card"
    >
      {/* Header row: three gross/net values */}
      <View
        style={{
          flexDirection: 'row-reverse',
          padding: 16,
          gap: 8,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0,0,0,0.06)',
        }}
      >
        <HeaderCell
          label={grossLabel}
          value={formatAmt(breakdown.regularGross)}
          valueColor={'#2563EB'}
        />
        <View style={{ width: 1, backgroundColor: 'rgba(0,0,0,0.06)' }} />
        <HeaderCell
          label={taxGrossLabel}
          value={formatAmt(breakdown.taxGross)}
          valueColor={'#D97706'}
        />
        <View style={{ width: 1, backgroundColor: 'rgba(0,0,0,0.06)' }} />
        <HeaderCell
          label={netLabel}
          value={formatAmt(breakdown.netSalary)}
          valueColor={'#059669'}
        />
      </View>

      {/* Expand button */}
      <Pressable
        onPress={handleToggle}
        testID="breakdown-expand-button"
        style={({ pressed }) => ({
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: pressed ? 'rgba(0,0,0,0.03)' : 'transparent',
        })}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
          {isRTL ? 'פרטי רכיבים' : 'Breakdown Details'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12, color: '#64748B' }}>
            {expanded ? (isRTL ? 'סגור' : 'Close') : `${breakdown.components.length} ${isRTL ? 'רכיבים' : 'items'}`}
          </Text>
          {expanded
            ? <ChevronUp size={16} color="#64748B" strokeWidth={2.5} />
            : <ChevronDown size={16} color="#64748B" strokeWidth={2.5} />
          }
        </View>
      </Pressable>

      {/* Expandable component list */}
      {expanded ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: 'rgba(0,0,0,0.06)',
            paddingBottom: 8,
          }}
        >
          {breakdown.components.map((component, index) => (
            <View
              key={component.id}
              testID={`breakdown-component-${component.id}`}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: index < breakdown.components.length - 1 ? 1 : 0,
                borderBottomColor: 'rgba(0,0,0,0.05)',
              }}
            >
              {/* Component name + amount */}
              <View
                style={{
                  flexDirection: 'row-reverse',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 6,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', textAlign: 'right', flex: 1 }}>
                  {component.name}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '800',
                    color: component.includedInNet ? '#059669' : '#64748B',
                    fontVariant: ['tabular-nums'],
                    marginLeft: 8,
                  }}
                >
                  {formatAmt(component.amount)}
                </Text>
              </View>

              {/* Tags */}
              {component.tags.length > 0 ? (
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    flexWrap: 'wrap',
                    gap: 5,
                    marginBottom: 6,
                  }}
                >
                  {component.tags.map((tag) => (
                    <TagPill key={tag} tag={tag} />
                  ))}
                </View>
              ) : null}

              {/* Explanation text */}
              <Text
                style={{
                  fontSize: 11,
                  color: '#94A3B8',
                  textAlign: 'right',
                  lineHeight: 16,
                }}
              >
                {component.explanationText}
              </Text>
            </View>
          ))}

          {/* Deductions summary */}
          <View
            style={{
              margin: 12,
              marginTop: 4,
              backgroundColor: '#F8FAFC',
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: 'rgba(0,0,0,0.06)',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', textAlign: 'right', marginBottom: 10 }}>
              {isRTL ? 'סיכום ניכויים' : 'Deductions Summary'}
            </Text>
            <DeductionRow label={incomeTaxLabel} value={breakdown.incomeTax} color={'#DC2626'} formatAmt={formatAmt} />
            <DeductionRow label={niLabel} value={breakdown.nationalInsurance} color={'#D97706'} formatAmt={formatAmt} />
            {!isNonIL || region === 'US' ? (
              <DeductionRow label={healthLabel} value={breakdown.healthInsurance} color={'#7C3AED'} formatAmt={formatAmt} />
            ) : null}
            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 }} />
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                {isRTL ? 'סך ניכויים' : 'Total Deductions'}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#DC2626', fontVariant: ['tabular-nums'] }}>
                {`-${formatAmt(breakdown.totalDeductions)}`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                {isRTL ? 'שיעור ניכוי אפקטיבי' : 'Effective Tax Rate'}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', fontVariant: ['tabular-nums'] }}>
                {`${Math.round(breakdown.effectiveRate)}%`}
              </Text>
            </View>
          </View>

          {/* Estimate disclaimer for non-IL regions */}
          {isNonIL ? (
            <View
              style={{
                marginHorizontal: 12,
                marginBottom: 8,
                padding: 12,
                borderRadius: 10,
                backgroundColor: 'rgba(245,158,11,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(245,158,11,0.15)',
              }}
            >
              <Text style={{ fontSize: 11, color: '#92400E', textAlign: isRTL ? 'right' : 'left', lineHeight: 16 }}>
                {t('tax_region.estimate_disclaimer')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function HeaderCell({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '600', marginBottom: 4, textAlign: 'center' }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '800',
          color: valueColor,
          fontVariant: ['tabular-nums'],
          textAlign: 'center',
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function DeductionRow({ label, value, color, formatAmt }: { label: string; value: number; color: string; formatAmt: (n: number) => string }) {
  if (value <= 0) return null;
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 12, color: '#64748B' }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color, fontVariant: ['tabular-nums'] }}>
        {`-${formatAmt(value)}`}
      </Text>
    </View>
  );
}
