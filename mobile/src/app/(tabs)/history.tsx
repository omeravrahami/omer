import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Clock, Calendar, Pencil, Plus, Heart, Sun } from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useSessions, useDeleteSession } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import { formatTime, formatCurrency, getHebrewMonthYear, getMonthKey } from '@/lib/utils';
import { calcTaxForHours } from '@/lib/utils/tax-calc';
import type { WorkSession } from '@/lib/types';

// ─── Dark theme ───────────────────────────────────────────────────────────────

const BG_DEEP = '#080E1A';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT_BLUE = '#3B82F6';
const ACCENT_GREEN = '#22C55E';
const COLOR_RED = '#F87171';
const COLOR_AMBER = '#FBBF24';
const DIVIDER = 'rgba(255,255,255,0.06)';

// ─── Tax Summary Card ─────────────────────────────────────────────────────────

function TaxSummaryCard({
  totalNetHours,
  days,
  hourlyRate,
  carBenefitMonthly,
  taxCreditPoints,
  currency,
  monthLabel,
}: {
  totalNetHours: number;
  days: number;
  hourlyRate: number;
  carBenefitMonthly: number;
  taxCreditPoints: number;
  currency: string;
  monthLabel: string;
}) {
  const tax = useMemo(
    () => calcTaxForHours(totalNetHours, hourlyRate, carBenefitMonthly, taxCreditPoints),
    [totalNetHours, hourlyRate, carBenefitMonthly, taxCreditPoints]
  );

  const fmt = (n: number) => formatCurrency(Math.round(n), currency);

  return (
    <View
      style={{
        backgroundColor: '#0F1729',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(6,182,212,0.25)',
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
      }}
      testID="tax-summary-card"
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>
          {monthLabel}
        </Text>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(6,182,212,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Clock size={18} color="#06B6D4" />
        </View>
      </View>

      {/* Hours row */}
      <TaxRow label="שעות עבודה" value={`${totalNetHours.toFixed(1)} שעות`} valueColor={TEXT_PRIMARY} />
      <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 8 }}>
        {`${days} ימי עבודה`}
      </Text>

      <Divider />

      {/* Gross */}
      <TaxRow label="ברוטו" value={fmt(tax.grossPay)} valueColor={TEXT_PRIMARY} />
      {carBenefitMonthly > 0 && tax.taxableGross > tax.grossPay ? (
        <TaxRow label="שווי רכב למס" value={fmt(tax.taxableGross - tax.grossPay)} valueColor={COLOR_AMBER} />
      ) : null}

      <Divider />

      {/* Deductions */}
      <TaxRow label="מס הכנסה" value={`-${fmt(tax.incomeTax)}`} valueColor={COLOR_RED} dot="#F87171" />
      <TaxRow label="ביטוח לאומי" value={`-${fmt(tax.nationalInsurance)}`} valueColor={COLOR_AMBER} dot="#FBBF24" />
      <TaxRow label="ביטוח בריאות" value={`-${fmt(tax.healthInsurance)}`} valueColor={COLOR_AMBER} dot="#FBBF24" />

      <Divider />

      {/* Net pay box */}
      <View
        style={{
          backgroundColor: 'rgba(34,197,94,0.1)',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#22C55E',
          padding: 16,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 4,
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#22C55E', textAlign: 'right' }}>
          {'נטו לקבלה'}
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#22C55E', fontVariant: ['tabular-nums'] }}>
          {fmt(tax.netPay)}
        </Text>
      </View>

      {/* Effective tax rate badge */}
      <View style={{ alignItems: 'flex-start' }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, fontVariant: ['tabular-nums'] }}>
            {`שיעור מס: ${tax.effectiveTaxRate.toFixed(1)}%`}
          </Text>
        </View>
      </View>
    </View>
  );
}

function TaxRow({ label, value, valueColor, dot }: { label: string; value: string; valueColor: string; dot?: string }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
        {dot ? (
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
        ) : null}
        <Text style={{ fontSize: 14, color: TEXT_SECONDARY, textAlign: 'right' }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 14, fontWeight: '600', color: valueColor, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: DIVIDER, marginVertical: 6 }} />;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const deviceId = useDeviceId();
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const currency = useSettingsStore((s) => s.currency);
  const isPro = useSettingsStore((s) => s.isPro);
  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const carBenefitMonthly = useSettingsStore((s) => s.carBenefitMonthly);
  const taxCreditPoints = useSettingsStore((s) => s.taxCreditPoints);

  const [currentDate, setCurrentDate] = useState(new Date());
  const monthKey = getMonthKey(currentDate);

  const { data: sessions, isLoading } = useSessions(deviceId, monthKey);
  const deleteSession = useDeleteSession(deviceId);

  const navigateMonth = (dir: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + dir);
      return next;
    });
  };

  const totals = useMemo(() => {
    if (!sessions) return { hours: 0, days: 0 };
    const completed = sessions.filter((s) => s.status === 'completed' && (s.sessionType === 'shift' || !s.sessionType));
    const hours = completed.reduce((sum, s) => sum + s.netMinutes / 60, 0);
    const days = new Set(completed.map((s) => s.date)).size;
    return { hours, days };
  }, [sessions]);

  const grouped = useMemo(() => {
    if (!sessions) return {} as Record<string, WorkSession[]>;
    const groups: Record<string, WorkSession[]> = {};
    for (const s of sessions) {
      const dateKey = s.date ?? new Date(s.startTime).toISOString().split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey]!.push(s);
    }
    return groups;
  }, [sessions]);

  const sortedDates = useMemo(
    () => Object.keys(grouped).sort((a, b) => b.localeCompare(a)),
    [grouped]
  );

  const confirmDelete = (sessionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'מחיקת משמרת',
      'האם למחוק את המשמרת הזו?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () =>
            deleteSession.mutate(sessionId, {
              onSuccess: () => showToast('המשמרת נמחקה'),
              onError: () => showToast('שגיאה במחיקה', 'error'),
            }),
        },
      ]
    );
  };

  const handleEdit = (session: WorkSession) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(
      `/add-edit-session?sessionId=${session.id}&editStartTime=${encodeURIComponent(session.startTime)}&editEndTime=${encodeURIComponent(session.endTime ?? '')}&editDate=${session.date ?? ''}&editNotes=${encodeURIComponent(session.notes ?? '')}` as never
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_DEEP }} testID="history-screen">
      {/* Month selector */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: BORDER,
        }}
      >
        <Pressable onPress={() => navigateMonth(1)} testID="month-next" style={{ padding: 4 }}>
          <ChevronLeft size={22} color={TEXT_PRIMARY} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY }}>
          {getHebrewMonthYear(currentDate)}
        </Text>
        <Pressable onPress={() => navigateMonth(-1)} testID="month-prev" style={{ padding: 4 }}>
          <ChevronRight size={22} color={TEXT_PRIMARY} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Monthly Tax Summary Card */}
        {!isLoading && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ marginHorizontal: 16, marginBottom: 16, marginTop: 12 }}>
            <TaxSummaryCard
              totalNetHours={totals.hours}
              days={totals.days}
              hourlyRate={hourlyRate}
              carBenefitMonthly={carBenefitMonthly}
              taxCreditPoints={taxCreditPoints}
              currency={currency}
              monthLabel={getHebrewMonthYear(currentDate)}
            />
          </Animated.View>
        )}

        {/* Session List */}
        {isLoading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={ACCENT_BLUE} testID="loading-indicator" />
          </View>
        ) : sortedDates.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: BG_CARD, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: BORDER }}>
              <Calendar size={28} color={TEXT_SECONDARY} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'center', marginBottom: 6 }}>
              {'אין רשומות לחודש זה'}
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center' }}>
              {'התחילו לעבוד והרשומות יופיעו כאן'}
            </Text>
          </Animated.View>
        ) : (
          sortedDates.map((dateKey, idx) => (
            <Animated.View key={dateKey} entering={FadeInUp.delay(idx * 40).duration(280)}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6, letterSpacing: 0.3 }}>
                {new Date(dateKey + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              {grouped[dateKey]?.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  currency={currency}
                  hourlyRate={hourlyRate}
                  onPress={() => router.push({ pathname: '/session-detail/[id]' as never, params: { id: session.id } } as never)}
                  onDelete={() => confirmDelete(session.id)}
                  onEdit={() => handleEdit(session)}
                />
              ))}
            </Animated.View>
          ))
        )}

        {/* Ad Banner */}
        {!isPro ? (
          <Pressable
            onPress={() => router.push('/premium' as never)}
            style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 16, backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', paddingVertical: 12, paddingHorizontal: 16 }}
            testID="history-ad-banner"
          >
            <Text style={{ textAlign: 'center', fontSize: 13, fontWeight: '600', color: ACCENT_BLUE }}>
              {'שדרגו ל-PRO להסרת פרסומות'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push(`/add-day-record?month=${monthKey}` as never);
        }}
        style={{
          position: 'absolute', right: 20, bottom: 30,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: ACCENT_BLUE,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
        }}
        testID="add-day-record-fab"
      >
        <Plus size={24} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

function SessionRow({
  session,
  currency,
  hourlyRate,
  onPress,
  onDelete,
  onEdit,
}: {
  session: WorkSession;
  currency: string;
  hourlyRate: number;
  onPress: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const isSick = session.sessionType === 'sick';
  const isVacation = session.sessionType === 'vacation';
  const isSpecial = isSick || isVacation;

  const iconBg = isSick
    ? 'rgba(248,113,113,0.15)'
    : isVacation
    ? 'rgba(251,191,36,0.15)'
    : session.status === 'active'
    ? 'rgba(34,197,94,0.15)'
    : 'rgba(59,130,246,0.12)';

  const iconColor = isSick
    ? COLOR_RED
    : isVacation
    ? COLOR_AMBER
    : session.status === 'active'
    ? ACCENT_GREEN
    : ACCENT_BLUE;

  const dynamicPay = (session.netMinutes / 60) * hourlyRate;
  const netHrs = (session.netMinutes / 60).toFixed(1);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      style={{
        marginHorizontal: 16, marginBottom: 8,
        borderRadius: 18, backgroundColor: BG_CARD,
        padding: 16, borderWidth: 1, borderColor: BORDER,
      }}
      testID={`session-row-${session.id}`}
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Icon + info */}
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, flex: 1 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: iconBg,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {isSick ? (
              <Heart size={17} color={iconColor} />
            ) : isVacation ? (
              <Sun size={17} color={iconColor} />
            ) : (
              <Clock size={17} color={iconColor} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            {isSick ? (
              <>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLOR_RED, textAlign: 'right' }}>
                  {'יום מחלה'}
                </Text>
                {session.notes ? (
                  <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
                    {session.notes}
                  </Text>
                ) : null}
              </>
            ) : isVacation ? (
              <>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLOR_AMBER, textAlign: 'right' }}>
                  {'יום חופשה'}
                </Text>
                {session.notes ? (
                  <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
                    {session.notes}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' }}>
                  {formatTime(session.startTime)}
                  {' – '}
                  {session.endTime ? formatTime(session.endTime) : 'פעיל'}
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
                  {`${netHrs} שעות נטו${(session.breaks?.length ?? 0) > 0 ? ` · ${session.breaks!.length} הפסקות` : ''}`}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Pay + edit button (only for shift) */}
        {!isSpecial ? (
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: ACCENT_GREEN, fontVariant: ['tabular-nums'] }}>
              {formatCurrency(Math.round(dynamicPay), currency)}
            </Text>
            {session.status === 'completed' ? (
              <Pressable
                onPress={onEdit}
                testID={`edit-session-${session.id}`}
                style={{ padding: 4 }}
                hitSlop={8}
              >
                <Pencil size={14} color={TEXT_SECONDARY} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
