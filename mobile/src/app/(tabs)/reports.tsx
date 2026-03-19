import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { TrendingUp, Calendar, Clock, DollarSign, Target, Download } from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useStats } from '@/lib/api/workclock-api';
import { formatCurrency, getHebrewMonthYear } from '@/lib/utils';
import { useToastStore } from '@/lib/state/toast-store';

function ProgressBar({ progress, color, label }: { progress: number; color: string; label: string }) {
  const pct = Math.min(100, Math.max(0, progress * 100));
  return (
    <View className="mb-4">
      <View className="flex-row-reverse justify-between mb-1">
        <Text className="text-sm font-medium" style={{ color: '#0F172A', textAlign: 'right' }}>{label}</Text>
        <Text className="text-sm font-bold" style={{ color, fontVariant: ['tabular-nums'] }}>{Math.round(pct)}%</Text>
      </View>
      <View className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#E2E8F0' }}>
        <View className="h-3 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function BarChart({ data }: { data: { date: string; hours: number }[] }) {
  const maxHours = Math.max(...data.map((d) => d.hours), 1);
  return (
    <View className="flex-row-reverse items-end justify-between h-32 mt-2">
      {data.slice(-7).map((item, i) => {
        const height = Math.max(4, (item.hours / maxHours) * 100);
        const dayLabel = new Date(item.date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'narrow' });
        return (
          <View key={item.date || i} className="items-center flex-1 mx-0.5">
            <Text className="text-xs font-bold mb-1" style={{ color: '#0F172A', fontVariant: ['tabular-nums'] }}>
              {item.hours > 0 ? item.hours.toFixed(1) : null}
            </Text>
            <View
              className="w-full rounded-t-lg"
              style={{
                height: `${height}%`,
                backgroundColor: item.hours > 0 ? '#2563EB' : '#E2E8F0',
                minHeight: 4,
              }}
            />
            <Text className="text-xs mt-1" style={{ color: '#94A3B8' }}>{dayLabel}</Text>
          </View>
        );
      })}
    </View>
  );
}

function StatBox({
  icon,
  label,
  value,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} className="flex-1">
      <View
        className="rounded-2xl p-4 items-center"
        style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}
      >
        <View className="mb-2">{icon}</View>
        <Text className="text-2xl font-bold" style={{ color: '#0F172A', fontVariant: ['tabular-nums'] }}>{value}</Text>
        <Text className="text-xs mt-1" style={{ color: '#64748B', textAlign: 'center' }}>{label}</Text>
      </View>
    </Animated.View>
  );
}

export default function ReportsScreen() {
  const deviceId = useDeviceId();
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const currency = useSettingsStore((s) => s.currency);
  const dailyGoal = useSettingsStore((s) => s.dailyGoalHours);
  const weeklyGoal = useSettingsStore((s) => s.weeklyGoalHours);
  const isPro = useSettingsStore((s) => s.isPro);

  const { data: monthStats, isLoading: monthLoading } = useStats(deviceId, 'month');
  const { data: weekStats } = useStats(deviceId, 'week');

  const now = new Date();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8FAFC' }} testID="reports-screen">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} className="px-5 pt-4 pb-2">
          <Text className="text-2xl font-bold" style={{ color: '#0F172A', textAlign: 'right' }}>
            {'\u05E1\u05D9\u05DB\u05D5\u05DE\u05D9\u05DD'}
          </Text>
          <Text className="text-sm mt-1" style={{ color: '#64748B', textAlign: 'right' }}>
            {getHebrewMonthYear(now)}
          </Text>
        </Animated.View>

        {monthLoading ? (
          <View className="p-12 items-center">
            <ActivityIndicator size="large" color="#2563EB" testID="loading-indicator" />
          </View>
        ) : (
          <>
            {/* Top Stats */}
            <View className="flex-row-reverse gap-3 px-4 mt-4 mb-6">
              <StatBox
                icon={<Clock size={22} color="#2563EB" />}
                label={'\u05E1\u05D4\u05F4\u05DB \u05E9\u05E2\u05D5\u05EA'}
                value={monthStats ? monthStats.totalHours.toFixed(1) : '0'}
                delay={0}
              />
              <StatBox
                icon={<DollarSign size={22} color="#059669" />}
                label={'\u05E1\u05D4\u05F4\u05DB \u05E9\u05DB\u05E8'}
                value={monthStats ? formatCurrency(monthStats.totalPay, currency) : formatCurrency(0, currency)}
                delay={100}
              />
            </View>

            <View className="flex-row-reverse gap-3 px-4 mb-6">
              <StatBox
                icon={<TrendingUp size={22} color="#D97706" />}
                label={'\u05DE\u05DE\u05D5\u05E6\u05E2 \u05DC\u05D9\u05D5\u05DD'}
                value={monthStats ? `${monthStats.avgHoursPerDay.toFixed(1)}h` : '0h'}
                delay={200}
              />
              <StatBox
                icon={<Calendar size={22} color="#7C3AED" />}
                label={'\u05D9\u05DE\u05D9 \u05E2\u05D1\u05D5\u05D3\u05D4'}
                value={String(monthStats?.workDaysCount ?? 0)}
                delay={300}
              />
            </View>

            {/* Goal Progress */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mx-4 mb-6">
              <View
                className="rounded-2xl p-5"
                style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}
              >
                <View className="flex-row-reverse items-center gap-2 mb-4">
                  <Target size={20} color="#2563EB" />
                  <Text className="text-base font-bold" style={{ color: '#0F172A' }}>
                    {'\u05D9\u05E2\u05D3\u05D9\u05DD'}
                  </Text>
                </View>
                <ProgressBar
                  progress={monthStats?.dailyGoalProgress ?? 0}
                  color="#2563EB"
                  label={`\u05D9\u05E2\u05D3 \u05D9\u05D5\u05DE\u05D9 (${dailyGoal} \u05E9\u05E2\u05D5\u05EA)`}
                />
                <ProgressBar
                  progress={monthStats?.weeklyGoalProgress ?? 0}
                  color="#059669"
                  label={`\u05D9\u05E2\u05D3 \u05E9\u05D1\u05D5\u05E2\u05D9 (${weeklyGoal} \u05E9\u05E2\u05D5\u05EA)`}
                />
              </View>
            </Animated.View>

            {/* Weekly Chart */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mx-4 mb-6">
              <View
                className="rounded-2xl p-5"
                style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}
              >
                <Text className="text-base font-bold mb-2" style={{ color: '#0F172A', textAlign: 'right' }}>
                  {'\u05E9\u05E2\u05D5\u05EA \u05DC\u05E4\u05D9 \u05D9\u05D5\u05DD'}
                </Text>
                {weekStats?.dailyData && weekStats.dailyData.length > 0 ? (
                  <BarChart data={weekStats.dailyData} />
                ) : (
                  <Text className="text-center py-8 text-sm" style={{ color: '#94A3B8' }}>
                    {'\u05D0\u05D9\u05DF \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05DC\u05D4\u05E6\u05D9\u05D2'}
                  </Text>
                )}
              </View>
            </Animated.View>

            {/* Export */}
            <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mx-4 mb-6">
              <View className="flex-row-reverse gap-3">
                <Pressable
                  onPress={() => {
                    if (!isPro) {
                      router.push('/premium' as never);
                    } else {
                      showToast('\u05D9\u05D9\u05E6\u05D5\u05D0 PDF \u05D1\u05E7\u05E8\u05D5\u05D1', 'info');
                    }
                  }}
                  className="flex-1 rounded-2xl py-3 items-center"
                  style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE' }}
                  testID="export-pdf-button"
                >
                  <View className="flex-row-reverse items-center gap-2">
                    <Download size={16} color="#2563EB" />
                    <Text className="text-sm font-semibold" style={{ color: '#2563EB' }}>
                      {'\u05D9\u05D9\u05E6\u05D5\u05D0 PDF'}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!isPro) {
                      router.push('/premium' as never);
                    } else {
                      showToast('\u05D9\u05D9\u05E6\u05D5\u05D0 CSV \u05D1\u05E7\u05E8\u05D5\u05D1', 'info');
                    }
                  }}
                  className="flex-1 rounded-2xl py-3 items-center"
                  style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#DCFCE7' }}
                  testID="export-csv-button"
                >
                  <View className="flex-row-reverse items-center gap-2">
                    <Download size={16} color="#059669" />
                    <Text className="text-sm font-semibold" style={{ color: '#059669' }}>
                      {'\u05D9\u05D9\u05E6\u05D5\u05D0 CSV'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
