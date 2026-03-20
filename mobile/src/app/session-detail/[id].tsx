import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { X, Clock, Coffee, DollarSign, FileText, Trash2, Edit3 } from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useSessions, useDeleteSession } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import { formatTime, formatCurrency, formatHours } from '@/lib/utils';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deviceId = useDeviceId();
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const currency = useSettingsStore((s) => s.currency);
  const deleteSession = useDeleteSession(deviceId);

  const { data: sessions, isLoading } = useSessions(deviceId);
  const session = sessions?.find((s) => s.id === id);

  const handleDelete = () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const month = session?.date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
    deleteSession.mutate({ sessionId: id, month }, {
      onSuccess: () => {
        showToast('\u05D4\u05DE\u05E9\u05DE\u05E8\u05EA \u05E0\u05DE\u05D7\u05E7\u05D4');
        router.back();
      },
      onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05DE\u05D7\u05D9\u05E7\u05D4', 'error'),
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#2563EB" testID="loading-indicator" />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
        <Text className="text-lg" style={{ color: '#64748B' }}>{'\u05DE\u05E9\u05DE\u05E8\u05EA \u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0\u05D4'}</Text>
        <Pressable onPress={() => router.back()} className="mt-4 px-6 py-3 rounded-2xl" style={{ backgroundColor: '#2563EB' }}>
          <Text className="text-white font-semibold">{'\u05D7\u05D6\u05D5\u05E8'}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const dateStr = new Date(session.startTime).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8FAFC' }} testID="session-detail-screen">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable onPress={() => router.back()} testID="close-detail">
          <X size={24} color="#0F172A" />
        </Pressable>
        <Text className="text-lg font-bold" style={{ color: '#0F172A' }}>{'\u05E4\u05E8\u05D8\u05D9 \u05DE\u05E9\u05DE\u05E8\u05EA'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Date */}
        <Animated.View entering={FadeInDown.duration(400)} className="px-5 mb-4">
          <Text className="text-sm" style={{ color: '#64748B', textAlign: 'right' }}>{dateStr}</Text>
        </Animated.View>

        {/* Time Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mx-4 mb-4">
          <View className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
            <DetailRow icon={<Clock size={18} color="#2563EB" />} label={'\u05E9\u05E2\u05EA \u05D4\u05EA\u05D7\u05DC\u05D4'} value={formatTime(session.startTime)} />
            <DetailRow icon={<Clock size={18} color="#DC2626" />} label={'\u05E9\u05E2\u05EA \u05E1\u05D9\u05D5\u05DD'} value={session.endTime ? formatTime(session.endTime) : '\u05E4\u05E2\u05D9\u05DC'} />
            <DetailRow icon={<Clock size={18} color="#0F172A" />} label={'\u05E9\u05E2\u05D5\u05EA \u05D1\u05E8\u05D5\u05D8\u05D5'} value={formatHours(session.grossMinutes)} />
            <DetailRow icon={<Coffee size={18} color="#D97706" />} label={'\u05D6\u05DE\u05DF \u05D4\u05E4\u05E1\u05E7\u05D5\u05EA'} value={formatHours(session.breakMinutes)} />
            <DetailRow icon={<Clock size={18} color="#059669" />} label={'\u05E9\u05E2\u05D5\u05EA \u05E0\u05D8\u05D5'} value={formatHours(session.netMinutes)} />
            <DetailRow icon={<DollarSign size={18} color="#059669" />} label={'\u05E9\u05DB\u05E8'} value={formatCurrency(session.totalPay, currency)} last />
          </View>
        </Animated.View>

        {/* Breaks */}
        {session.breaks && session.breaks.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mx-4 mb-4">
            <View className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
              <Text className="text-base font-bold mb-3" style={{ color: '#0F172A', textAlign: 'right' }}>
                {'\u05D4\u05E4\u05E1\u05E7\u05D5\u05EA'}
              </Text>
              {session.breaks.map((b, i) => (
                <View key={b.id} className="flex-row-reverse items-center justify-between py-2" style={i < session.breaks.length - 1 ? { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' } : undefined}>
                  <Text className="text-sm" style={{ color: '#0F172A' }}>
                    {formatTime(b.startTime)} - {b.endTime ? formatTime(b.endTime) : '\u05E4\u05E2\u05D9\u05DC'}
                  </Text>
                  <Text className="text-sm" style={{ color: '#64748B' }}>
                    {b.durationMinutes} {'\u05D3\u05E7\u05D5\u05EA'}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {/* Notes */}
        {session.notes ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mx-4 mb-4">
            <View className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
              <View className="flex-row-reverse items-center gap-2 mb-2">
                <FileText size={18} color="#64748B" />
                <Text className="text-base font-bold" style={{ color: '#0F172A' }}>{'\u05D4\u05E2\u05E8\u05D5\u05EA'}</Text>
              </View>
              <Text className="text-sm" style={{ color: '#374151', textAlign: 'right', lineHeight: 22 }}>{session.notes}</Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mx-4 flex-row-reverse gap-3">
          <Pressable
            onPress={handleDelete}
            className="flex-1 rounded-2xl py-4 items-center"
            style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}
            testID="delete-session-button"
          >
            <View className="flex-row-reverse items-center gap-2">
              <Trash2 size={18} color="#DC2626" />
              <Text className="text-base font-semibold" style={{ color: '#DC2626' }}>{'\u05DE\u05D7\u05E7'}</Text>
            </View>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className="flex-row items-center justify-between py-3"
      style={!last ? { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' } : undefined}
    >
      <Text className="text-base font-bold" style={{ color: '#0F172A', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <View className="flex-row-reverse items-center gap-2">
        {icon}
        <Text className="text-sm" style={{ color: '#64748B' }}>{label}</Text>
      </View>
    </View>
  );
}
