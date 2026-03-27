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
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Users, ShieldAlert, Activity, Server, ChevronLeft, Settings2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { getAdminStats, AdminStats } from '@/lib/api/admin-api';

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

function MiniBarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 6, height: 60 }}>
      {data.map((item, i) => {
        const height = Math.max((item.count / max) * 52, 4);
        const dayLabel = new Date(item.date).getDate();
        return (
          <View key={item.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: '100%',
                height,
                backgroundColor: i === data.length - 1 ? ACCENT : 'rgba(96,165,250,0.35)',
                borderRadius: 4,
              }}
            />
            <Text style={{ fontSize: 9, color: TEXT_SECONDARY }}>{dayLabel}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function AdminDashboard() {
  const router = useRouter();

  const { data: stats, isLoading, isError, refetch, isRefetching } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: getAdminStats,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="admin-dashboard-screen">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refetch(); }}
            tintColor={ACCENT}
          />
        }
      >
        {/* Welcome header */}
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right' }}>
            {'לוח בקרה'}
          </Text>
          <Text style={{ fontSize: 14, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
            {'סקירה כללית של המערכת'}
          </Text>
        </Animated.View>

        {isLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={ACCENT} size="large" testID="loading-indicator" />
          </View>
        ) : isError ? (
          <Animated.View entering={FadeInDown.duration(300)} style={{
            backgroundColor: 'rgba(248,113,113,0.08)',
            borderRadius: 14,
            padding: 20,
            borderWidth: 1,
            borderColor: 'rgba(248,113,113,0.2)',
            marginBottom: 20,
          }}>
            <Text style={{ color: '#F87171', textAlign: 'center', fontSize: 14 }}>{'שגיאה בטעינת הנתונים'}</Text>
            <Pressable onPress={() => refetch()} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600' }}>{'נסה שוב'}</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Stat cards grid */}
        {stats !== null && stats !== undefined ? (
          <>
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 12 }}>
              <StatCard
                icon={<Users size={20} color="#60A5FA" />}
                label="סה״כ משתמשים"
                value={stats.totalUsers}
                color="#60A5FA"
                delay={0}
              />
              <StatCard
                icon={<Activity size={20} color="#34D399" />}
                label="משתמשים פעילים"
                value={stats.activeUsers}
                color="#34D399"
                delay={80}
              />
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 24 }}>
              <StatCard
                icon={<ShieldAlert size={20} color="#FBBF24" />}
                label="מושהים"
                value={stats.suspendedUsers}
                color="#FBBF24"
                delay={160}
              />
              <StatCard
                icon={<Server size={20} color="#A78BFA" />}
                label="סשנים פעילים"
                value={stats.totalSessions}
                color="#A78BFA"
                delay={240}
              />
            </View>

            {/* Recent registrations chart */}
            {stats.recentRegistrations.length > 0 ? (
              <Animated.View
                entering={FadeInDown.delay(320).duration(400)}
                style={{
                  backgroundColor: BG_CARD,
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: BORDER,
                  marginBottom: 24,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right', marginBottom: 16 }}>
                  {'הרשמות ב-7 ימים אחרונים'}
                </Text>
                <MiniBarChart data={stats.recentRegistrations} />
              </Animated.View>
            ) : null}
          </>
        ) : null}

        {/* Quick links */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 12 }}>
            {'ניהול'}
          </Text>

          <Pressable
            testID="goto-users"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/admin/users' as any); }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(96,165,250,0.08)' : BG_CARD,
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: BORDER,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            })}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(96,165,250,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} color={ACCENT} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' }}>{'ניהול משתמשים'}</Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right' }}>{'צפה, ערוך וחסום משתמשים'}</Text>
              </View>
            </View>
            <ChevronLeft size={18} color={TEXT_SECONDARY} />
          </Pressable>

          <Pressable
            testID="goto-config"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/admin/config' as any); }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(96,165,250,0.08)' : BG_CARD,
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: BORDER,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
            })}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Settings2 size={20} color="#A78BFA" />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' }}>{'הגדרות מערכת'}</Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right' }}>{'ניהול הגדרות ופרמטרים'}</Text>
              </View>
            </View>
            <ChevronLeft size={18} color={TEXT_SECONDARY} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
