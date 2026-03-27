import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { formatCurrency } from '@/lib/utils';
import type { SalaryBreakdown } from '@/lib/utils/salary-engine';
import { TAG_COLORS, type SalaryTag } from '@/lib/utils/salary-engine';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SalaryBreakdownCardProps {
  breakdown: SalaryBreakdown;
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

export function SalaryBreakdownCard({ breakdown }: SalaryBreakdownCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

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
          label={'ברוטו רגיל'}
          value={formatCurrency(breakdown.regularGross)}
          valueColor={'#2563EB'}
        />
        <View style={{ width: 1, backgroundColor: 'rgba(0,0,0,0.06)' }} />
        <HeaderCell
          label={'ברוטו למס'}
          value={formatCurrency(breakdown.taxGross)}
          valueColor={'#D97706'}
        />
        <View style={{ width: 1, backgroundColor: 'rgba(0,0,0,0.06)' }} />
        <HeaderCell
          label={'נטו'}
          value={formatCurrency(breakdown.netSalary)}
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
          {'פרטי רכיבים'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12, color: '#64748B' }}>
            {expanded ? 'סגור' : `${breakdown.components.length} רכיבים`}
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
                  {formatCurrency(component.amount)}
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
              {'סיכום ניכויים'}
            </Text>
            <DeductionRow label={'מס הכנסה'} value={breakdown.incomeTax} color={'#DC2626'} />
            <DeductionRow label={'ביטוח לאומי'} value={breakdown.nationalInsurance} color={'#D97706'} />
            <DeductionRow label={'מס בריאות'} value={breakdown.healthInsurance} color={'#7C3AED'} />
            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 }} />
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{'סך ניכויים'}</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#DC2626', fontVariant: ['tabular-nums'] }}>
                {`-${formatCurrency(breakdown.totalDeductions)}`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>{'שיעור ניכוי אפקטיבי'}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', fontVariant: ['tabular-nums'] }}>
                {`${Math.round(breakdown.effectiveRate)}%`}
              </Text>
            </View>
          </View>
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

function DeductionRow({ label, value, color }: { label: string; value: number; color: string }) {
  if (value <= 0) return null;
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 12, color: '#64748B' }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color, fontVariant: ['tabular-nums'] }}>
        {`-${formatCurrency(value)}`}
      </Text>
    </View>
  );
}
