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

// ─── Dark theme ───────────────────────────────────────────────────────────────

const BG_DEEP = '#080E1A';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT_BLUE = '#3B82F6';
const ACCENT_GREEN = '#22C55E';
const ACCENT_AMBER = '#F59E0B';
const ACCENT_PURPLE = '#A78BFA';

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress, color, label }: { progress: number; color: string; label: string }) {
  const pct = Math.min(100, Math.max(0, progress * 100));
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '500', color: TEXT_PRIMARY, textAlign: 'right' }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color, fontVariant: ['tabular-nums'] }}>{Math.round(pct)}%</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.07)' }}>
        <View style={{ height: 8, borderRadius: 4, width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function BarChart({ data }: { data: { date: string; hours: number }[] }) {
  const maxHours = Math.max(...data.map((d) => d.hours), 1);
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', justifyContent: 'space-between', height: 128, marginTop: 8 }}>
      {data.slice(-7).map((item, i) => {
        const height = Math.max(4, (item.hours / maxHours) * 100);
        const dayLabel = new Date(item.date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'narrow' });
        return (
          <View key={item.date || i} style={{ alignItems: 'center', flex: 1, marginHorizontal: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', marginBottom: 4, color: item.hours > 0 ? TEXT_PRIMARY : 'transparent', fontVariant: ['tabular-nums'] }}>
              {item.hours > 0 ? item.hours.toFixed(1) : ' '}
            </Text>
            <View
              style={{
                width: '100%', borderRadius: 6,
                height: `${height}%`,
                backgroundColor: item.hours > 0 ? ACCENT_BLUE : 'rgba(255,255,255,0.06)',
                minHeight: 4,
              }}
            />
            <Text style={{ fontSize: 11, marginTop: 6, color: TEXT_SECONDARY }}>{dayLabel}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Stat Box ─────────────────────────────────────────────────────────────────

function StatBox({ icon, label, value, delay }: { icon: React.ReactNode; label: string; value: string; delay: number }) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} style={{ flex: 1 }}>
      <View style={{ backgroundColor: BG_CARD, borderRadius: 20, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: BORDER }}>
        <View style={{ marginBottom: 8 }}>{icon}</View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, fontVariant: ['tabular-nums'] }}>{value}</Text>
        <Text style={{ fontSize: 11, marginTop: 4, color: TEXT_SECONDARY, textAlign: 'center' }}>{label}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

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
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_DEEP }} testID="reports-screen">
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>
            {'סיכומים'}
          </Text>
          <Text style={{ fontSize: 13, marginTop: 2, color: TEXT_SECONDARY, textAlign: 'right' }}>
            {getHebrewMonthYear(now)}
          </Text>
        </Animated.View>

        {monthLoading ? (
          <View style={{ padding: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={ACCENT_BLUE} testID="loading-indicator" />
          </View>
        ) : (
          <>
            {/* Stats row 1 */}
            <View style={{ flexDirection: 'row-reverse', gap: 12, paddingHorizontal: 16, marginTop: 16, marginBottom: 12 }}>
              <StatBox
                icon={<Clock size={22} color={ACCENT_BLUE} />}
                label={'סה״כ שעות'}
                value={monthStats ? monthStats.totalHours.toFixed(1) : '0'}
                delay={0}
              />
              <StatBox
                icon={<DollarSign size={22} color={ACCENT_GREEN} />}
                label={'סה״כ שכר'}
                value={monthStats ? formatCurrency(monthStats.totalPay, currency) : formatCurrency(0, currency)}
                delay={100}
              />
            </View>

            {/* Stats row 2 */}
            <View style={{ flexDirection: 'row-reverse', gap: 12, paddingHorizontal: 16, marginBottom: 16 }}>
              <StatBox
                icon={<TrendingUp size={22} color={ACCENT_AMBER} />}
                label={'ממוצע ליום'}
                value={monthStats ? `${monthStats.avgHoursPerDay.toFixed(1)}h` : '0h'}
                delay={200}
              />
              <StatBox
                icon={<Calendar size={22} color={ACCENT_PURPLE} />}
                label={'ימי עבודה'}
                value={String(monthStats?.workDaysCount ?? 0)}
                delay={300}
              />
            </View>

            {/* Goal Progress */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginHorizontal: 16, marginBottom: 16 }}>
              <View style={{ backgroundColor: BG_CARD, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: BORDER }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Target size={20} color={ACCENT_BLUE} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY }}>{'יעדים'}</Text>
                </View>
                <ProgressBar
                  progress={monthStats?.dailyGoalProgress ?? 0}
                  color={ACCENT_BLUE}
                  label={`יעד יומי (${dailyGoal} שעות)`}
                />
                <ProgressBar
                  progress={monthStats?.weeklyGoalProgress ?? 0}
                  color={ACCENT_GREEN}
                  label={`יעד שבועי (${weeklyGoal} שעות)`}
                />
              </View>
            </Animated.View>

            {/* Weekly Chart */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginHorizontal: 16, marginBottom: 16 }}>
              <View style={{ backgroundColor: BG_CARD, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: BORDER }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right', marginBottom: 4 }}>
                  {'שעות לפי יום'}
                </Text>
                {weekStats?.dailyData && weekStats.dailyData.length > 0 ? (
                  <BarChart data={weekStats.dailyData} />
                ) : (
                  <Text style={{ textAlign: 'center', paddingVertical: 32, fontSize: 13, color: TEXT_SECONDARY }}>
                    {'אין נתונים להציג'}
                  </Text>
                )}
              </View>
            </Animated.View>

            {/* Export buttons */}
            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={{ marginHorizontal: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
                <Pressable
                  onPress={() => { isPro ? showToast('ייצוא PDF בקרוב', 'info') : router.push('/premium' as never); }}
                  style={{ flex: 1, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}
                  testID="export-pdf-button"
                >
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                    <Download size={16} color={ACCENT_BLUE} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: ACCENT_BLUE }}>{'ייצוא PDF'}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => { isPro ? showToast('ייצוא CSV בקרוב', 'info') : router.push('/premium' as never); }}
                  style={{ flex: 1, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' }}
                  testID="export-csv-button"
                >
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                    <Download size={16} color={ACCENT_GREEN} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: ACCENT_GREEN }}>{'ייצוא CSV'}</Text>
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
