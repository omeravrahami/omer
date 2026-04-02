import React, { useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import Animated, { FadeInRight, FadeInUp } from 'react-native-reanimated';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowRight,
  Zap,
  BarChart2,
  CircleDollarSign,
  Banknote,
  Percent,
} from 'lucide-react-native';
import type { TaxResult } from '@/lib/utils/tax-calc';
import { getBracketInfo, calcExtraHoursImpact } from '@/lib/utils/tax-calc';
import { formatCurrency } from '@/lib/utils';

export interface InsightsCardsProps {
  monthlyGross: number;
  hoursWorkedThisMonth: number;
  hourlyRate: number;
  taxResult: TaxResult;
  prevMonthNet?: number;
}

interface InsightCard {
  id: string;
  title: string;
  mainValue: string;
  subtitle: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
}

interface GridCard {
  id: string;
  title: string;
  mainValue: string;
  subtitle: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
}

function GridCardView({ card, index }: { card: GridCard; index: number }) {
  return (
    <Animated.View
      entering={FadeInUp.delay(index * 70).duration(380)}
      style={{
        width: '48%',
        backgroundColor: card.bgColor,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: card.borderColor,
        shadowColor: card.accentColor,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* Icon + title */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            backgroundColor: card.bgColor,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: card.borderColor,
          }}
        >
          {card.icon}
        </View>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: card.accentColor,
            textAlign: 'right',
            flex: 1,
            letterSpacing: 0.2,
          }}
          numberOfLines={2}
        >
          {card.title}
        </Text>
      </View>

      {/* Main value */}
      <Text
        style={{
          fontSize: 20,
          fontWeight: '800',
          color: card.accentColor,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
          marginBottom: 4,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {card.mainValue}
      </Text>

      {/* Subtitle */}
      <Text
        style={{
          fontSize: 10,
          color: 'rgba(0,0,0,0.45)',
          textAlign: 'right',
          lineHeight: 14,
        }}
        numberOfLines={2}
      >
        {card.subtitle}
      </Text>
    </Animated.View>
  );
}

function InsightCardView({ card, index }: { card: InsightCard; index: number }) {
  return (
    <Animated.View entering={FadeInRight.delay(index * 60).duration(350)}>
      <View
        style={{
          width: 156,
          backgroundColor: card.bgColor,
          borderRadius: 16,
          padding: 14,
          marginRight: 10,
          borderWidth: 1,
          borderColor: card.borderColor,
          shadowColor: card.accentColor,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        {/* Icon + title */}
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <View style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            backgroundColor: card.bgColor,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: card.borderColor,
          }}>
            {card.icon}
          </View>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: card.accentColor,
              textAlign: 'right',
              flex: 1,
              letterSpacing: 0.2,
            }}
            numberOfLines={2}
          >
            {card.title}
          </Text>
        </View>

        {/* Main value */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: '800',
            color: card.accentColor,
            textAlign: 'right',
            fontVariant: ['tabular-nums'],
            marginBottom: 4,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {card.mainValue}
        </Text>

        {/* Subtitle */}
        <Text
          style={{
            fontSize: 10,
            color: 'rgba(0,0,0,0.45)',
            textAlign: 'right',
            lineHeight: 14,
          }}
          numberOfLines={2}
        >
          {card.subtitle}
        </Text>
      </View>
    </Animated.View>
  );
}

export function InsightsCards({
  monthlyGross,
  hoursWorkedThisMonth,
  hourlyRate,
  taxResult,
  prevMonthNet,
}: InsightsCardsProps) {
  const gridCards = useMemo<GridCard[]>(() => {
    const net = taxResult.finalTakeHome;
    const gross = taxResult.taxableGross > 0 ? taxResult.taxableGross : monthlyGross;
    const effectiveRate = taxResult.effectiveTaxRate;

    const ratio = gross > 0 ? Math.round((net / gross) * 100) : 0;

    // 1. נטו לקבלה
    const card1: GridCard = {
      id: 'grid-net',
      title: 'נטו לקבלה',
      mainValue: formatCurrency(net),
      subtitle: `${Math.round(effectiveRate)}% ניכוי אפקטיבי`,
      accentColor: '#059669',
      bgColor: '#F0FDF4',
      borderColor: 'rgba(5,150,105,0.18)',
      icon: <CircleDollarSign size={14} color="#059669" strokeWidth={2.2} />,
    };

    // 2. ברוטו למס
    const card2: GridCard = {
      id: 'grid-gross',
      title: 'ברוטו למס',
      mainValue: formatCurrency(gross),
      subtitle: 'הכנסה חייבת במס',
      accentColor: '#2563EB',
      bgColor: '#EFF6FF',
      borderColor: 'rgba(37,99,235,0.18)',
      icon: <Banknote size={14} color="#2563EB" strokeWidth={2.2} />,
    };

    // 3. יחס ברוטו/נטו
    const card3: GridCard = {
      id: 'grid-ratio',
      title: 'יחס ברוטו/נטו',
      mainValue: `${ratio}%`,
      subtitle: `מכל ₪100 ברוטו נשאר ₪${ratio}`,
      accentColor: '#D97706',
      bgColor: '#FFFBEB',
      borderColor: 'rgba(217,119,6,0.18)',
      icon: <Percent size={14} color="#D97706" strokeWidth={2.2} />,
    };

    // 4. נטו לשעה — uses taxResult.effectiveHourlyNet which excludes car grossup
    const hasHours = hoursWorkedThisMonth > 0;
    const netPerHour = taxResult.effectiveHourlyNet;
    const card4: GridCard = {
      id: 'grid-hourly',
      title: 'נטו לשעה',
      mainValue: hasHours && netPerHour > 0 ? formatCurrency(netPerHour) : '—',
      subtitle: hasHours
        ? `${hoursWorkedThisMonth.toFixed(1)} שע׳ החודש`
        : 'אין שעות מדווחות',
      accentColor: '#7C3AED',
      bgColor: '#F5F3FF',
      borderColor: 'rgba(124,58,237,0.18)',
      icon: <Clock size={14} color="#7C3AED" strokeWidth={2.2} />,
    };

    return [card1, card2, card3, card4];
  }, [monthlyGross, hoursWorkedThisMonth, taxResult]);

  const cards = useMemo<InsightCard[]>(() => {
    const result: InsightCard[] = [];
    const net = taxResult.finalTakeHome;

    // 1. עד מדרגת מס הבאה
    const bracketInfo = getBracketInfo(monthlyGross, hourlyRate, taxResult.taxableGross - taxResult.regularGross);
    if (!bracketInfo.isTopBracket && bracketInfo.monthlyAmountToNextBracket !== null && bracketInfo.monthlyAmountToNextBracket > 0) {
      result.push({
        id: 'next-bracket',
        title: 'עד מדרגה הבאה',
        mainValue: formatCurrency(bracketInfo.monthlyAmountToNextBracket),
        subtitle: `עוד כדי להגיע למדרגת ${bracketInfo.nextLabel ?? ''}`,
        accentColor: '#D97706',
        bgColor: '#FFFBEB',
        borderColor: 'rgba(217,119,6,0.18)',
        icon: <BarChart2 size={14} color="#D97706" strokeWidth={2.2} />,
      });
    }

    // 2. השוואה לחודש קודם
    if (prevMonthNet !== undefined && prevMonthNet > 0 && net > 0) {
      const diff = net - prevMonthNet;
      const pct = Math.abs(Math.round((diff / prevMonthNet) * 100));
      const isUp = diff >= 0;
      result.push({
        id: 'prev-compare',
        title: 'לעומת חודש קודם',
        mainValue: `${isUp ? '+' : ''}${formatCurrency(diff)}`,
        subtitle: `${isUp ? 'עלייה' : 'ירידה'} של ${pct}% בנטו`,
        accentColor: isUp ? '#059669' : '#DC2626',
        bgColor: isUp ? '#F0FDF4' : '#FEF2F2',
        borderColor: isUp ? 'rgba(5,150,105,0.18)' : 'rgba(220,38,38,0.18)',
        icon: isUp
          ? <TrendingUp size={14} color="#059669" strokeWidth={2.2} />
          : <TrendingDown size={14} color="#DC2626" strokeWidth={2.2} />,
      });
    }

    // 3. שעה נוספת שווה
    if (hourlyRate > 0 && monthlyGross > 0) {
      const impact = calcExtraHoursImpact(monthlyGross, hourlyRate, 1);
      result.push({
        id: 'extra-hour',
        title: 'שעה נוספת שווה',
        mainValue: formatCurrency(impact.netPerExtraHour),
        subtitle: `נטו לאחר מס · ברוטו: ${formatCurrency(impact.additionalGross)}`,
        accentColor: '#7C3AED',
        bgColor: '#F5F3FF',
        borderColor: 'rgba(124,58,237,0.18)',
        icon: <Zap size={14} color="#7C3AED" strokeWidth={2.2} />,
      });
    }

    // 4. +10 שעות נוספות
    if (hourlyRate > 0 && monthlyGross > 0) {
      const impact10 = calcExtraHoursImpact(monthlyGross, hourlyRate, 10);
      result.push({
        id: 'extra-10',
        title: '+10 שעות נוספות',
        mainValue: `+${formatCurrency(impact10.additionalNet)}`,
        subtitle: `נטו נוסף · ${Math.round((impact10.additionalNet / impact10.additionalGross) * 100)}% נשאר אחרי מס`,
        accentColor: '#0891B2',
        bgColor: '#ECFEFF',
        borderColor: 'rgba(8,145,178,0.18)',
        icon: <ArrowRight size={14} color="#0891B2" strokeWidth={2.2} />,
      });
    }

    return result;
  }, [monthlyGross, hoursWorkedThisMonth, hourlyRate, taxResult, prevMonthNet]);

  return (
    <View style={{ marginBottom: 16 }}>
      {/* ── סיכום פיננסי – 2x2 grid ── */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', textAlign: 'right' }}>
          {'סיכום פיננסי'}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: 16,
          gap: 10,
          marginBottom: 20,
        }}
      >
        {gridCards.map((card, index) => (
          <GridCardView key={card.id} card={card} index={index} />
        ))}
      </View>

      {/* ── תובנות נוספות – horizontal scroll ── */}
      {cards.length > 0 && (
        <>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', textAlign: 'right' }}>
              {'תובנות נוספות'}
            </Text>
          </View>

          <FlatList
            data={cards}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => <InsightCardView card={item} index={index} />}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 24 }}
            style={{ flexGrow: 0 }}
            inverted
          />
        </>
      )}
    </View>
  );
}
