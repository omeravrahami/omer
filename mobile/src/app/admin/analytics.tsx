import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Users, BarChart2, CheckCircle, Edit3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { getUsageAnalytics, UsageAnalytics } from '@/lib/api/admin-api';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  delay?: number;
}

function StatCard({ icon, label, value, color, delay = 0 }: StatCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400)}
      style={{
        flex: 1,
        backgroundColor: BG_CARD,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER,
        minWidth: '45%',
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: `${color}18`,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          alignSelf: 'flex-end',
        }}
      >
        {icon}
      </View>
      <Text style={{ fontSize: 26, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right' }}>
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
        {label}
      </Text>
    </Animated.View>
  );
}

function MiniBarChart({ data, accentColor = ACCENT }: { data: { date: string; count: number }[]; accentColor?: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 4, height: 64 }}>
      {data.map((item, i) => {
        const height = Math.max((item.count / max) * 52, 4);
        const dayLabel = new Date(item.date).getDate();
        return (
          <View key={`${item.date}-${i}`} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: '100%',
                height,
                backgroundColor: i === data.length - 1 ? accentColor : `${accentColor}40`,
                borderRadius: 4,
              }}
            />
            <Text style={{ fontSize: 8, color: TEXT_SECONDARY }}>{dayLabel}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function AnalyticsScreen() {
  const {
    data: analytics,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<UsageAnalytics>({
    queryKey: ['admin', 'analytics', 'usage'],
    queryFn: getUsageAnalytics,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="analytics-screen">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              refetch();
            }}
            tintColor={ACCENT}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right' }}>
            {'אנליטיקות שימוש'}
          </Text>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
            {'נתוני פעילות ומשמרות כלל המערכת'}
          </Text>
        </Animated.View>

        {isLoading ? (
          <View style={{ padding: 60, alignItems: 'center' }}>
            <ActivityIndicator color={ACCENT} size="large" testID="loading-indicator" />
          </View>
        ) : isError ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={{
              backgroundColor: 'rgba(248,113,113,0.08)',
              borderRadius: 14,
              padding: 24,
              borderWidth: 1,
              borderColor: 'rgba(248,113,113,0.2)',
              alignItems: 'center',
            }}
            testID="error-view"
          >
            <Text style={{ color: '#F87171', fontSize: 14, marginBottom: 12 }}>{'שגיאה בטעינת הנתונים'}</Text>
            <Pressable onPress={() => refetch()} testID="retry-button">
              <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600' }}>{'נסה שוב'}</Text>
            </Pressable>
          </Animated.View>
        ) : analytics != null ? (
          <>
            {/* Top stat cards */}
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 12 }}>
              <StatCard
                icon={<BarChart2 size={20} color="#60A5FA" />}
                label="סה״כ משמרות"
                value={analytics.totalWorkSessions}
                color="#60A5FA"
                delay={0}
              />
              <StatCard
                icon={<CheckCircle size={20} color="#34D399" />}
                label="משמרות שהושלמו"
                value={analytics.completedSessions}
                color="#34D399"
                delay={80}
              />
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 24 }}>
              <StatCard
                icon={<Users size={20} color="#FBBF24" />}
                label="הפסקות"
                value={analytics.totalBreakSessions}
                color="#FBBF24"
                delay={160}
              />
              <StatCard
                icon={<Edit3 size={20} color="#F472B6" />}
                label="משמרות ידניות"
                value={analytics.manualSessions}
                color="#F472B6"
                delay={240}
              />
            </View>

            {/* DAU chart */}
            {analytics.dailyActiveUsers.length > 0 ? (
              <Animated.View
                entering={FadeInDown.delay(320).duration(400)}
                style={{
                  backgroundColor: BG_CARD,
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: BORDER,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right', marginBottom: 4 }}>
                  {'משתמשים פעילים יומיים — 30 יום'}
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 16 }}>
                  {'DAU — Daily Active Users'}
                </Text>
                <MiniBarChart data={analytics.dailyActiveUsers} accentColor={ACCENT} />
              </Animated.View>
            ) : null}

            {/* Sessions per day chart */}
            {analytics.sessionsPerDay.length > 0 ? (
              <Animated.View
                entering={FadeInDown.delay(400).duration(400)}
                style={{
                  backgroundColor: BG_CARD,
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: BORDER,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right', marginBottom: 4 }}>
                  {'משמרות ליום — 14 ימים'}
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 16 }}>
                  {'מספר משמרות שנפתחו בכל יום'}
                </Text>
                <MiniBarChart data={analytics.sessionsPerDay} accentColor="#34D399" />
              </Animated.View>
            ) : null}

            {/* Avg sessions per user */}
            <Animated.View
              entering={FadeInDown.delay(480).duration(400)}
              style={{
                backgroundColor: BG_CARD,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: BORDER,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY }}>
                {'ממוצע משמרות למשתמש'}
              </Text>
              <View style={{
                backgroundColor: 'rgba(96,165,250,0.12)',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: ACCENT }}>
                  {analytics.avgSessionsPerUser.toFixed(1)}
                </Text>
              </View>
            </Animated.View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
