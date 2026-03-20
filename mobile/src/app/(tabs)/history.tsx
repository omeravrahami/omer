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
import { ChevronLeft, ChevronRight, Clock, Calendar, TrendingDown, Pencil } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore, calcDeductions } from '@/lib/state/settings-store';
import { useSessions, useDeleteSession } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import { formatTime, formatCurrency, getHebrewMonthYear, getMonthKey } from '@/lib/utils';
import type { WorkSession } from '@/lib/types';

// ─── Dark theme ───────────────────────────────────────────────────────────────

const BG_DEEP = '#080E1A';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT_BLUE = '#3B82F6';
const ACCENT_GREEN = '#22C55E';

export default function HistoryScreen() {
  const deviceId = useDeviceId();
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const currency = useSettingsStore((s) => s.currency);
  const isPro = useSettingsStore((s) => s.isPro);
  const deductions = useSettingsStore((s) => s.deductions);

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
    if (!sessions) return { hours: 0, grossPay: 0, netPay: 0, deductionsTotal: 0, days: 0 };
    const completed = sessions.filter((s) => s.status === 'completed');
    const hours = completed.reduce((sum, s) => sum + s.netMinutes / 60, 0);
    const grossPay = completed.reduce((sum, s) => sum + s.totalPay, 0);
    const deductionsTotal = calcDeductions(grossPay, deductions);
    const netPay = Math.max(0, grossPay - deductionsTotal);
    const days = new Set(completed.map((s) => s.date)).size;
    return { hours, grossPay, netPay, deductionsTotal, days };
  }, [sessions, deductions]);

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

  const hasDeductions = deductions.length > 0;

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Monthly Summary Card */}
        {!isLoading && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ marginHorizontal: 16, marginBottom: 16, marginTop: 12 }}>
            <View style={{ borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}>
              <LinearGradient
                colors={['#0B1020', '#1E3A5F']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ padding: 24 }}
              >
                {/* Hours + gross pay */}
                <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 }}>
                      {'סה״כ שעות'}
                    </Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 44 }}>
                      {totals.hours.toFixed(1)}
                      <Text style={{ fontSize: 18, fontWeight: '500', color: 'rgba(255,255,255,0.6)' }}>h</Text>
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
                      {`${totals.days} ימי עבודה`}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 }}>
                      {hasDeductions ? 'שכר ברוטו' : 'סה״כ שכר'}
                    </Text>
                    <Text style={{ color: '#60A5FA', fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 36 }}>
                      {formatCurrency(totals.grossPay, currency)}
                    </Text>
                  </View>
                </View>

                {hasDeductions ? (
                  <>
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16 }} />
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                        <TrendingDown size={14} color="rgba(255,255,255,0.45)" />
                        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{'ניכויים'}</Text>
                      </View>
                      <Text style={{ color: '#FCA5A5', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        {`- ${formatCurrency(totals.deductionsTotal, currency)}`}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>{'נטו לקבלה'}</Text>
                      <Text style={{ color: '#4ADE80', fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                        {formatCurrency(totals.netPay, currency)}
                      </Text>
                    </View>
                  </>
                ) : null}
              </LinearGradient>
            </View>
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
    </SafeAreaView>
  );
}

function SessionRow({
  session,
  currency,
  onPress,
  onDelete,
  onEdit,
}: {
  session: WorkSession;
  currency: string;
  onPress: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
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
        {/* Icon + time info */}
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, flex: 1 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: session.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.12)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={17} color={session.status === 'active' ? ACCENT_GREEN : ACCENT_BLUE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' }}>
              {formatTime(session.startTime)}
              {' – '}
              {session.endTime ? formatTime(session.endTime) : 'פעיל'}
            </Text>
            <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
              {`${netHrs} שעות נטו${(session.breaks?.length ?? 0) > 0 ? ` · ${session.breaks!.length} הפסקות` : ''}`}
            </Text>
          </View>
        </View>

        {/* Pay + edit button */}
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: ACCENT_GREEN, fontVariant: ['tabular-nums'] }}>
            {formatCurrency(session.totalPay, currency)}
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
      </View>
    </Pressable>
  );
}
