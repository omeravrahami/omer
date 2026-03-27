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
import { Server, Database, Users, ShieldCheck, CheckCircle, XCircle, Clock, Info } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { getSystemStats, SystemStats } from '@/lib/api/admin-api';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours} שע' ${mins} דק'`;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

interface DataCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  delay?: number;
}

function DataCard({ icon, label, value, color, delay = 0 }: DataCardProps) {
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
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: `${color}18`,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
          alignSelf: 'flex-end',
        }}
      >
        {icon}
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right' }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
        {label}
      </Text>
    </Animated.View>
  );
}

interface ServiceRowProps {
  name: string;
  status: 'ok' | 'error' | 'pending';
  label: string;
}

function ServiceRow({ name, status, label }: ServiceRowProps) {
  const color = status === 'ok' ? '#34D399' : status === 'error' ? '#F87171' : '#94A3B8';
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
      }}
    >
      <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>{name}</Text>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
        <Text style={{ fontSize: 12, fontWeight: '600', color }}>{label}</Text>
      </View>
    </View>
  );
}

export default function HealthScreen() {
  const {
    data: stats,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<SystemStats>({
    queryKey: ['admin', 'system-stats'],
    queryFn: getSystemStats,
  });

  const allGood = stats != null && stats.databaseConnected;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="health-screen">
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
            {'בריאות המערכת'}
          </Text>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
            {'סטטוס שירותים ומסד נתונים'}
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
            <Text style={{ color: '#F87171', fontSize: 14, marginBottom: 12 }}>{'שגיאה בטעינת נתוני מערכת'}</Text>
            <Pressable onPress={() => refetch()} testID="retry-button">
              <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600' }}>{'נסה שוב'}</Text>
            </Pressable>
          </Animated.View>
        ) : stats != null ? (
          <>
            {/* Status overview card */}
            <Animated.View
              entering={FadeInDown.delay(60).duration(400)}
              style={{
                backgroundColor: BG_CARD,
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: allGood ? 'rgba(52,211,153,0.2)' : 'rgba(251,146,60,0.2)',
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14 }}>
                <View style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: allGood ? 'rgba(52,211,153,0.12)' : 'rgba(251,146,60,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {allGood
                    ? <CheckCircle size={28} color="#34D399" />
                    : <XCircle size={28} color="#FB923C" />
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: allGood ? '#34D399' : '#FB923C', textAlign: 'right' }}>
                    {allGood ? 'מערכת תקינה' : 'תשומת לב נדרשת'}
                  </Text>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: stats.databaseConnected ? '#34D399' : '#F87171' }} />
                    <Text style={{ fontSize: 12, color: stats.databaseConnected ? '#34D399' : '#F87171', fontWeight: '600' }}>
                      {stats.databaseConnected ? 'מסד נתונים מחובר' : 'מסד נתונים מנותק'}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* System info */}
            <Animated.View
              entering={FadeInDown.delay(140).duration(400)}
              style={{
                backgroundColor: BG_CARD,
                borderRadius: 16,
                paddingHorizontal: 20,
                borderWidth: 1,
                borderColor: BORDER,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'right', paddingTop: 16, paddingBottom: 4, letterSpacing: 0.4 }}>
                {'מידע מערכת'}
              </Text>

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
                <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>{'סביבה'}</Text>
                <View style={{
                  backgroundColor: stats.environment === 'production' ? 'rgba(248,113,113,0.12)' : 'rgba(96,165,250,0.12)',
                  borderRadius: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: stats.environment === 'production' ? '#F87171' : ACCENT }}>
                    {stats.environment}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
                <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>{'גרסת Node'}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY }}>{stats.nodeVersion}</Text>
              </View>

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
                <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>{'זמן פעילות'}</Text>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                  <Clock size={13} color={TEXT_SECONDARY} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY }}>{formatUptime(stats.uptime)}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
                <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>{'נבדק לאחרונה'}</Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>{formatTimestamp(stats.timestamp)}</Text>
              </View>
            </Animated.View>

            {/* DB data */}
            <Animated.View entering={FadeInDown.delay(220).duration(400)}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10, letterSpacing: 0.4 }}>
                {'נתוני מסד נתונים'}
              </Text>
              <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 12 }}>
                <DataCard icon={<Users size={18} color="#60A5FA" />} label="משתמשים" value={stats.totalUsers} color="#60A5FA" delay={240} />
                <DataCard icon={<Server size={18} color="#34D399" />} label="משמרות" value={stats.totalWorkSessions} color="#34D399" delay={300} />
              </View>
              <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 24 }}>
                <DataCard icon={<ShieldCheck size={18} color="#FBBF24" />} label="סשני משתמשים" value={stats.totalUserSessions} color="#FBBF24" delay={360} />
                <DataCard icon={<Info size={18} color="#A78BFA" />} label="לוגי ביקורת" value={stats.totalAuditLogs} color="#A78BFA" delay={420} />
              </View>
            </Animated.View>

            {/* Services */}
            <Animated.View
              entering={FadeInDown.delay(480).duration(400)}
              style={{
                backgroundColor: BG_CARD,
                borderRadius: 16,
                paddingHorizontal: 20,
                borderWidth: 1,
                borderColor: BORDER,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'right', paddingTop: 16, paddingBottom: 4, letterSpacing: 0.4 }}>
                {'שירותים'}
              </Text>
              <ServiceRow
                name="מסד נתונים"
                status={stats.databaseConnected ? 'ok' : 'error'}
                label={stats.databaseConnected ? 'מחובר' : 'מנותק'}
              />
              <ServiceRow name="Auth" status="ok" label="תקין" />
              <ServiceRow name="אימייל" status="pending" label="ממתין לחיבור" />
              <ServiceRow name="פרסומות" status="pending" label="ממתין לחיבור" />
              <View style={{ borderBottomWidth: 0 }}>
                <ServiceRow name="דיווח קריסות" status="pending" label="ממתין לחיבור" />
              </View>
              <View style={{ height: 4 }} />
            </Animated.View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
