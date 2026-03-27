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
import { DollarSign, Clock, BarChart2, CheckCircle, Info } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { getSalaryAnalytics, SalaryAnalytics } from '@/lib/api/admin-api';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
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
      <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right' }}>
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
        {label}
      </Text>
    </Animated.View>
  );
}

export default function SalariesScreen() {
  const {
    data: analytics,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<SalaryAnalytics>({
    queryKey: ['admin', 'analytics', 'salary'],
    queryFn: getSalaryAnalytics,
  });

  const engineActive = analytics != null && analytics.avgHourlyRate > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="salaries-screen">
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
            {'אנליטיקות שכר'}
          </Text>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
            {'נתוני שכר ומשמרות — מצרפי בלבד'}
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
            {/* Stat cards */}
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 12 }}>
              <StatCard
                icon={<DollarSign size={20} color="#60A5FA" />}
                label="משתמשים עם שכר מוגדר"
                value={String(analytics.totalUsersWithSalaryConfigured)}
                color="#60A5FA"
                delay={0}
              />
              <StatCard
                icon={<BarChart2 size={20} color="#34D399" />}
                label="ממוצע שכר לשעה"
                value={`₪${analytics.avgHourlyRate.toFixed(2)}`}
                color="#34D399"
                delay={80}
              />
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 24 }}>
              <StatCard
                icon={<CheckCircle size={20} color="#FBBF24" />}
                label="משמרות שהושלמו"
                value={String(analytics.totalCompletedSessions)}
                color="#FBBF24"
                delay={160}
              />
              <StatCard
                icon={<Clock size={20} color="#F472B6" />}
                label="משך משמרת ממוצע"
                value={`${Math.round(analytics.avgSessionDurationMinutes)} דק'`}
                color="#F472B6"
                delay={240}
              />
            </View>

            {/* Summary card */}
            <Animated.View
              entering={FadeInDown.delay(320).duration(400)}
              style={{
                backgroundColor: BG_CARD,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: BORDER,
                gap: 14,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>
                {'סיכום'}
              </Text>

              {/* Engine status */}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>{'סטטוס מנוע שכר'}</Text>
                <View style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: engineActive ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: engineActive ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)',
                }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: engineActive ? '#34D399' : '#F87171' }} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: engineActive ? '#34D399' : '#F87171' }}>
                    {engineActive ? 'מנוע השכר פעיל' : 'מנוע השכר לא פעיל'}
                  </Text>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: BORDER }} />

              {/* Privacy note */}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 }}>
                <Info size={16} color={TEXT_SECONDARY} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', lineHeight: 18 }}>
                  {'נתונים מצרפיים — ללא פרטי משתמש ספציפי'}
                </Text>
              </View>
            </Animated.View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
