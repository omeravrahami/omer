import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Clock, Calendar, Pencil, Plus, Heart, Sun, Share2 } from 'lucide-react-native';
import { useAuthStore } from '@/lib/state/auth-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useAuthSessionsData, useAuthDeleteSessionById } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import { formatTime, formatCurrency, getHebrewMonthYear, getMonthKey } from '@/lib/utils';
import { calcOvertimePay } from '@/lib/utils/overtime-calc';
import { LockedHistoryBanner } from '@/components/LockedHistoryBanner';
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

// ─── Monthly Summary Card (hours + days only) ─────────────────────────────────

function MonthlySummaryCard({
  totalHours,
  workDays,
  sickDays,
  vacationDays,
  monthLabel,
}: {
  totalHours: number;
  workDays: number;
  sickDays: number;
  vacationDays: number;
  monthLabel: string;
}) {
  return (
    <View
      style={{
        backgroundColor: BG_CARD,
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
      testID="monthly-summary-card"
    >
      {/* Header */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>
          {monthLabel}
        </Text>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(6,182,212,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Clock size={18} color="#06B6D4" />
        </View>
      </View>

      {/* Hours */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <Text style={{ fontSize: 40, fontWeight: '800', color: ACCENT_GREEN, fontVariant: ['tabular-nums'] }}>
          {totalHours.toFixed(1)}
        </Text>
        <Text style={{ fontSize: 16, color: TEXT_SECONDARY, fontWeight: '600' }}>{'שעות עבודה'}</Text>
      </View>

      {/* Days row */}
      <View style={{ flexDirection: 'row-reverse', gap: 12, marginTop: 4 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Clock size={13} color={ACCENT_BLUE} />
          <Text style={{ fontSize: 13, color: ACCENT_BLUE, fontWeight: '600' }}>{`${workDays} ימי עבודה`}</Text>
        </View>
        {sickDays > 0 ? (
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Heart size={13} color={COLOR_RED} />
            <Text style={{ fontSize: 13, color: COLOR_RED, fontWeight: '600' }}>{`${sickDays} מחלה`}</Text>
          </View>
        ) : null}
        {vacationDays > 0 ? (
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Sun size={13} color={COLOR_AMBER} />
            <Text style={{ fontSize: 13, color: COLOR_AMBER, fontWeight: '600' }}>{`${vacationDays} חופשה`}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const token = useAuthStore((s) => s.token) ?? '';
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const currency = useSettingsStore((s) => s.currency);
  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const isPremium = useSettingsStore((s) => s.isPremium);

  const [currentDate, setCurrentDate] = useState(new Date());
  const monthKey = getMonthKey(currentDate);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Free plan: only allow viewing 3 months back from today
  const isMonthLocked = useMemo(() => {
    if (isPremium) return false;
    const today = new Date();
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const viewingDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return viewingDate < threeMonthsAgo;
  }, [isPremium, currentDate]);

  const { data: sessionsData, isLoading } = useAuthSessionsData(token, monthKey);
  const sessions: WorkSession[] = sessionsData?.sessions ?? [];
  const deleteSession = useAuthDeleteSessionById(token);

  const navigateMonth = (dir: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + dir);
      return next;
    });
  };

  const handleShareReport = useCallback(async () => {
    if (!sessions || sessions.length === 0) {
      showToast('אין נתונים לייצוא לחודש זה', 'error');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const monthLabel = getHebrewMonthYear(currentDate);
    const shifts = sessions.filter((s) => s.status === 'completed' && (s.sessionType === 'shift' || !s.sessionType));
    const sickDays = sessions.filter((s) => s.sessionType === 'sick').length;
    const vacationDays = sessions.filter((s) => s.sessionType === 'vacation').length;
    const totalHours = shifts.reduce((sum, s) => sum + s.netMinutes / 60, 0);
    const workDays = new Set(shifts.map((s) => s.date)).size;

    // Group by date, sort ascending
    const groups: Record<string, WorkSession[]> = {};
    for (const s of shifts) {
      const d = s.date ?? new Date(s.startTime).toISOString().split('T')[0];
      if (!groups[d]) groups[d] = [];
      groups[d]!.push(s);
    }
    const sortedDates = Object.keys(groups).sort();

    const lines: string[] = [
      `דוח שעות — ${monthLabel}`,
      '─'.repeat(32),
      `סה"כ שעות: ${totalHours.toFixed(2)}`,
      `ימי עבודה: ${workDays}`,
      ...(sickDays > 0 ? [`ימי מחלה: ${sickDays}`] : []),
      ...(vacationDays > 0 ? [`ימי חופשה: ${vacationDays}`] : []),
      '─'.repeat(32),
      '',
    ];

    for (const dateKey of sortedDates) {
      const dateLabel = new Date(dateKey + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
      const daySessions = groups[dateKey] ?? [];
      const dayHours = daySessions.reduce((sum, s) => sum + s.netMinutes / 60, 0);
      lines.push(`📅 ${dateLabel}  |  ${dayHours.toFixed(2)} שע׳`);
      for (const s of daySessions) {
        const start = s.startTime ? new Date(s.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—';
        const end = s.endTime ? new Date(s.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : 'פעיל';
        const h = (s.netMinutes / 60).toFixed(2);
        lines.push(`   ${start} – ${end}  (${h} שע׳)`);
      }
    }

    lines.push('');
    lines.push('─'.repeat(32));
    lines.push('נוצר על ידי WorkClock');

    await Share.share({ message: lines.join('\n'), title: `דוח שעות — ${monthLabel}` });
  }, [sessions, currentDate, showToast]);


  const totals = useMemo(() => {
    if (!sessions) return { hours: 0, days: 0, sickDays: 0, vacationDays: 0 };
    const shifts = sessions.filter((s) => s.status === 'completed' && (s.sessionType === 'shift' || !s.sessionType));
    const hours = shifts.reduce((sum, s) => sum + s.netMinutes / 60, 0);
    const days = new Set(shifts.map((s) => s.date)).size;
    const sickDays = sessions.filter((s) => s.sessionType === 'sick').length;
    const vacationDays = sessions.filter((s) => s.sessionType === 'vacation').length;
    return { hours, days, sickDays, vacationDays };
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
    setDeleteConfirmId(sessionId);
  };

  const executeDelete = (sessionId: string) => {
    setDeleteConfirmId(null);
    deleteSession.mutate(sessionId, {
      onSuccess: () => showToast('המשמרת נמחקה'),
      onError: () => showToast('שגיאה במחיקה', 'error'),
    });
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => navigateMonth(1)} testID="month-next" style={{ padding: 4 }}>
            <ChevronLeft size={22} color={TEXT_PRIMARY} />
          </Pressable>
          <Pressable
            onPress={handleShareReport}
            testID="share-report-btn"
            style={{ padding: 6, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.12)' }}
          >
            <Share2 size={18} color={ACCENT_BLUE} />
          </Pressable>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY }}>
          {getHebrewMonthYear(currentDate)}
        </Text>
        <Pressable onPress={() => navigateMonth(-1)} testID="month-prev" style={{ padding: 4 }}>
          <ChevronRight size={22} color={TEXT_PRIMARY} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Monthly Summary Card */}
        {!isLoading && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ marginHorizontal: 16, marginBottom: 16, marginTop: 12 }}>
            <MonthlySummaryCard
              totalHours={totals.hours}
              workDays={totals.days}
              sickDays={totals.sickDays}
              vacationDays={totals.vacationDays}
              monthLabel={getHebrewMonthYear(currentDate)}
            />
          </Animated.View>
        )}

        {/* Locked month banner for free users */}
        <LockedHistoryBanner visible={isMonthLocked} />

        {/* Session List */}
        {isLoading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={ACCENT_BLUE} testID="loading-indicator" />
          </View>
        ) : isMonthLocked ? null : sortedDates.length === 0 ? (
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

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteConfirmId !== null} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 }}
          onPress={() => setDeleteConfirmId(null)}
        >
          <Pressable
            style={{ backgroundColor: BG_CARD, borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: BORDER }}
            onPress={() => {}}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right', marginBottom: 8 }}>
              {'מחיקת משמרת'}
            </Text>
            <Text style={{ fontSize: 14, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 24 }}>
              {'האם למחוק את המשמרת הזו?'}
            </Text>
            <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
              <Pressable
                onPress={() => deleteConfirmId && executeDelete(deleteConfirmId)}
                style={{ flex: 1, backgroundColor: COLOR_RED, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
                testID="confirm-delete-button"
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{'מחק'}</Text>
              </Pressable>
              <Pressable
                onPress={() => setDeleteConfirmId(null)}
                style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
                testID="cancel-delete-button"
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY }}>{'ביטול'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  const overtimeEnabled = useSettingsStore((s) => s.overtimeEnabled);
  const overtimeMode = useSettingsStore((s) => s.overtimeMode);
  const dynamicPayFinal = overtimeEnabled
    ? calcOvertimePay(session.netMinutes, hourlyRate, overtimeMode)
    : dynamicPay;
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
              {formatCurrency(Math.round(dynamicPayFinal), currency)}
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
