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
import Animated, { FadeInDown, SlideInRight } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Trash2, Clock, Calendar } from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useSessions, useDeleteSession } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import { formatTime, formatCurrency, formatHours, getHebrewMonthYear, getMonthKey } from '@/lib/utils';
import type { WorkSession } from '@/lib/types';

export default function HistoryScreen() {
  const deviceId = useDeviceId();
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const currency = useSettingsStore((s) => s.currency);
  const isPro = useSettingsStore((s) => s.isPro);

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

  const grouped = useMemo(() => {
    if (!sessions) return {};
    const groups: Record<string, WorkSession[]> = {};
    for (const s of sessions) {
      const dateKey = s.date ?? new Date(s.startTime).toISOString().split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(s);
    }
    return groups;
  }, [sessions]);

  const sortedDates = useMemo(
    () => Object.keys(grouped).sort((a, b) => b.localeCompare(a)),
    [grouped]
  );

  const handleDelete = (sessionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteSession.mutate(sessionId, {
      onSuccess: () => showToast('\u05D4\u05DE\u05E9\u05DE\u05E8\u05EA \u05E0\u05DE\u05D7\u05E7\u05D4'),
      onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05DE\u05D7\u05D9\u05E7\u05D4', 'error'),
    });
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8FAFC' }} testID="history-screen">
      {/* Month Selector */}
      <View className="flex-row items-center justify-between px-5 py-4">
        <Pressable onPress={() => navigateMonth(1)} testID="month-next">
          <ChevronLeft size={24} color="#0F172A" />
        </Pressable>
        <Text className="text-lg font-bold" style={{ color: '#0F172A' }}>
          {getHebrewMonthYear(currentDate)}
        </Text>
        <Pressable onPress={() => navigateMonth(-1)} testID="month-prev">
          <ChevronRight size={24} color="#0F172A" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {isLoading ? (
          <View className="p-12 items-center">
            <ActivityIndicator size="large" color="#2563EB" testID="loading-indicator" />
          </View>
        ) : sortedDates.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} className="items-center py-20 px-8">
            <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
              <Calendar size={32} color="#94A3B8" />
            </View>
            <Text className="text-lg font-semibold mb-2" style={{ color: '#64748B', textAlign: 'center' }}>
              {'\u05D0\u05D9\u05DF \u05E8\u05E9\u05D5\u05DE\u05D5\u05EA \u05DC\u05D7\u05D5\u05D3\u05E9 \u05D6\u05D4'}
            </Text>
            <Text className="text-sm" style={{ color: '#94A3B8', textAlign: 'center' }}>
              {'\u05D4\u05EA\u05D7\u05D9\u05DC\u05D5 \u05DC\u05E2\u05D1\u05D5\u05D3 \u05D5\u05D4\u05E8\u05E9\u05D5\u05DE\u05D5\u05EA \u05D9\u05D5\u05E4\u05D9\u05E2\u05D5 \u05DB\u05D0\u05DF'}
            </Text>
          </Animated.View>
        ) : (
          sortedDates.map((dateKey, idx) => (
            <Animated.View key={dateKey} entering={FadeInDown.delay(idx * 50).duration(300)}>
              {/* Date Header */}
              <Text className="text-sm font-semibold px-5 py-2 mt-2" style={{ color: '#64748B', textAlign: 'right' }}>
                {new Date(dateKey + 'T12:00:00').toLocaleDateString('he-IL', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
              {grouped[dateKey]?.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  currency={currency}
                  onPress={() =>
                    router.push({
                      pathname: '/session-detail/[id]' as never,
                      params: { id: session.id },
                    } as never)
                  }
                  onDelete={() => handleDelete(session.id)}
                />
              ))}
            </Animated.View>
          ))
        )}

        {/* Ad Banner */}
        {!isPro ? (
          <Pressable
            onPress={() => router.push('/premium' as never)}
            className="mx-4 mt-4 rounded-2xl py-3 px-4"
            style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE' }}
            testID="history-ad-banner"
          >
            <Text className="text-center text-sm font-medium" style={{ color: '#2563EB' }}>
              {'\u2B50 \u05E9\u05D3\u05E8\u05D2\u05D5 \u05DC-PRO \u05DC\u05D4\u05E1\u05E8\u05EA \u05E4\u05E8\u05E1\u05D5\u05DE\u05D5\u05EA'}
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
}: {
  session: WorkSession;
  currency: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  const netHrs = (session.netMinutes / 60).toFixed(1);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      className="mx-4 mb-2 rounded-2xl p-4"
      style={{
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
      }}
      testID={`session-row-${session.id}`}
    >
      <View className="flex-row-reverse items-center justify-between">
        <View className="flex-row-reverse items-center gap-2">
          <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: session.status === 'active' ? '#DCFCE7' : '#EFF6FF' }}>
            <Clock size={18} color={session.status === 'active' ? '#059669' : '#2563EB'} />
          </View>
          <View>
            <Text className="text-base font-semibold" style={{ color: '#0F172A', textAlign: 'right' }}>
              {formatTime(session.startTime)} - {session.endTime ? formatTime(session.endTime) : '\u05E4\u05E2\u05D9\u05DC'}
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: '#94A3B8', textAlign: 'right' }}>
              {netHrs} {'\u05E9\u05E2\u05D5\u05EA \u05E0\u05D8\u05D5'}
            </Text>
          </View>
        </View>
        <View className="items-start">
          <Text className="text-lg font-bold" style={{ color: '#059669', fontVariant: ['tabular-nums'] }}>
            {formatCurrency(session.totalPay, currency)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
