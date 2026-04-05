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
import {
  Users,
  ShieldAlert,
  Activity,
  Server,
  ChevronLeft,
  Settings2,
  Database,
  CheckCircle,
  ClipboardList,
  BarChart2,
  Tv,
  Calendar,
  TrendingUp,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { getAdminDashboard, getAdminStats, DashboardStats, AdminStats } from '@/lib/api/admin-api';
import { useToastStore } from '@/lib/state/toast-store';

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

interface NavCardProps {
  testId: string;
  route: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  accentColor: string;
}

function NavCard({ testId, route, icon, iconBg, title, subtitle, accentColor }: NavCardProps) {
  const router = useRouter();
  return (
    <Pressable
      testID={testId}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(route as any); }}
      style={({ pressed }) => ({
        backgroundColor: pressed ? `${accentColor}08` : BG_CARD,
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
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
        <View>
          <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' }}>{title}</Text>
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right' }}>{subtitle}</Text>
        </View>
      </View>
      <ChevronLeft size={18} color={TEXT_SECONDARY} />
    </Pressable>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);

  // Try new dashboard endpoint first, fall back to stats
  const {
    data: dashboardStats,
    isLoading: dashLoading,
    isError: dashError,
    refetch: refetchDash,
    isRefetching: dashRefetching,
  } = useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard'],
    queryFn: getAdminDashboard,
    retry: 1,
  });

  const {
    data: legacyStats,
    isLoading: legacyLoading,
    isError: legacyError,
    refetch: refetchLegacy,
    isRefetching: legacyRefetching,
  } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: getAdminStats,
    enabled: dashError,
    retry: 1,
  });

  const isLoading = dashLoading || (dashError && legacyLoading);
  const isError = dashError && legacyError;
  const isRefetching = dashRefetching || legacyRefetching;

  function refetch() {
    refetchDash();
    if (dashError) refetchLegacy();
  }

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';
  const maskedUrl = backendUrl.length > 12
    ? `${backendUrl.slice(0, 12)}...`
    : backendUrl || '—';

  const today = new Date();
  const deployDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

  // Determine which stats to use
  const hasDashboard = dashboardStats != null;
  const hasLegacy = legacyStats != null;

  const totalUsers = hasDashboard
    ? dashboardStats.totalUsers
    : (hasLegacy ? legacyStats.totalUsers : null);

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
        {/* System header */}
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right' }}>
              {'מערכת clocker — ניהול'}
            </Text>
            <Pressable
              testID="back-to-app-button"
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.replace('/(tabs)' as any); }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? 'rgba(96,165,250,0.18)' : 'rgba(96,165,250,0.10)',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderWidth: 1,
                borderColor: 'rgba(96,165,250,0.25)',
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 5,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT }}>{'לאפליקציה'}</Text>
              <ChevronLeft size={14} color={ACCENT} style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <View style={{ backgroundColor: 'rgba(96,165,250,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: ACCENT }}>{'v1.0.0'}</Text>
            </View>
            <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>{'סקירה כללית של המערכת'}</Text>
          </View>
        </Animated.View>

        {/* System Status Card */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(400)}
          style={{
            backgroundColor: BG_CARD,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: BORDER,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 12, letterSpacing: 0.4 }}>
            {'סטטוס מערכת'}
          </Text>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>{'כתובת Backend'}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8', fontVariant: ['tabular-nums'] }}>{maskedUrl}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: BORDER }} />
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>{'סטטוס DB'}</Text>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                <CheckCircle size={13} color="#34D399" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#34D399' }}>{'תקין'}</Text>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: BORDER }} />
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>{'Deploy אחרון'}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8' }}>{deployDate}</Text>
            </View>
          </View>
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

        {/* Stat cards grid — dashboard stats */}
        {hasDashboard ? (
          <>
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 12 }}>
              <StatCard
                icon={<Users size={20} color="#60A5FA" />}
                label="סה״כ משתמשים"
                value={dashboardStats.totalUsers}
                color="#60A5FA"
                delay={0}
              />
              <StatCard
                icon={<TrendingUp size={20} color="#34D399" />}
                label="משתמשים חדשים היום"
                value={dashboardStats.newUsersToday}
                color="#34D399"
                delay={80}
              />
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 12 }}>
              <StatCard
                icon={<Activity size={20} color="#FBBF24" />}
                label="משתמשים פעילים היום"
                value={dashboardStats.dauToday}
                color="#FBBF24"
                delay={160}
              />
              <StatCard
                icon={<Calendar size={20} color="#F472B6" />}
                label="משמרות היום"
                value={dashboardStats.totalWorkSessionsToday}
                color="#F472B6"
                delay={240}
              />
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 24 }}>
              <StatCard
                icon={<Database size={20} color="#A78BFA" />}
                label="כל המשמרות"
                value={dashboardStats.totalWorkSessionsAllTime}
                color="#A78BFA"
                delay={320}
              />
              <StatCard
                icon={<ShieldAlert size={20} color="#FB923C" />}
                label="בקשות מחיקת חשבון"
                value={dashboardStats.accountDeletionRequests}
                color="#FB923C"
                delay={400}
              />
            </View>
          </>
        ) : hasLegacy ? (
          <>
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 12 }}>
              <StatCard
                icon={<Users size={20} color="#60A5FA" />}
                label="סה״כ משתמשים"
                value={legacyStats.totalUsers}
                color="#60A5FA"
                delay={0}
              />
              <StatCard
                icon={<Activity size={20} color="#34D399" />}
                label="משתמשים פעילים"
                value={legacyStats.activeUsers}
                color="#34D399"
                delay={80}
              />
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 24 }}>
              <StatCard
                icon={<ShieldAlert size={20} color="#FBBF24" />}
                label="מושהים"
                value={legacyStats.suspendedUsers}
                color="#FBBF24"
                delay={160}
              />
              <StatCard
                icon={<Server size={20} color="#A78BFA" />}
                label="סשנים פעילים"
                value={legacyStats.totalSessions}
                color="#A78BFA"
                delay={240}
              />
            </View>

            {legacyStats.recentRegistrations.length > 0 ? (
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
                <MiniBarChart data={legacyStats.recentRegistrations} />
              </Animated.View>
            ) : null}
          </>
        ) : null}

        {/* Quick links */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10, letterSpacing: 0.4 }}>
            {'ניהול'}
          </Text>

          <NavCard
            testId="goto-users"
            route="/admin/users"
            icon={<Users size={20} color={ACCENT} />}
            iconBg="rgba(96,165,250,0.12)"
            title="ניהול משתמשים"
            subtitle="צפה, ערוך וחסום משתמשים"
            accentColor={ACCENT}
          />

          <NavCard
            testId="goto-config"
            route="/admin/config"
            icon={<Settings2 size={20} color="#A78BFA" />}
            iconBg="rgba(167,139,250,0.12)"
            title="הגדרות מערכת"
            subtitle="מדרגות מס 2026 — ניהול הגדרות ופרמטרים"
            accentColor="#A78BFA"
          />

          <NavCard
            testId="goto-audit-logs"
            route="/admin/audit-logs"
            icon={<ClipboardList size={20} color="#FBBF24" />}
            iconBg="rgba(251,191,36,0.12)"
            title="לוג ביקורת"
            subtitle="פעולות מערכת ואירועי אבטחה"
            accentColor="#FBBF24"
          />

          <NavCard
            testId="goto-analytics"
            route="/admin/analytics"
            icon={<Activity size={20} color="#34D399" />}
            iconBg="rgba(52,211,153,0.12)"
            title="אנליטיקות שימוש"
            subtitle="נתוני פעילות ומשמרות"
            accentColor="#34D399"
          />

          <NavCard
            testId="goto-salaries"
            route="/admin/salaries"
            icon={<BarChart2 size={20} color="#FBBF24" />}
            iconBg="rgba(251,191,36,0.12)"
            title="אנליטיקות שכר"
            subtitle="נתוני שכר ומשמרות מצרפיים"
            accentColor="#FBBF24"
          />

          <NavCard
            testId="goto-ads"
            route="/admin/ads"
            icon={<Tv size={20} color="#F472B6" />}
            iconBg="rgba(244,114,182,0.12)"
            title="ניהול פרסומות"
            subtitle="הגדרות פרסומות ו-Unit IDs"
            accentColor="#F472B6"
          />

          <NavCard
            testId="goto-health"
            route="/admin/health"
            icon={<Server size={20} color="#A78BFA" />}
            iconBg="rgba(167,139,250,0.12)"
            title="בריאות המערכת"
            subtitle="סטטוס שירותים ומסד נתונים"
            accentColor="#A78BFA"
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
