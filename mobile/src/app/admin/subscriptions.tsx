import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Crown, Users, TrendingUp, ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/lib/state/auth-store';
import { useQuery } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';
import Animated, { FadeInDown } from 'react-native-reanimated';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';
const GOLD = '#F59E0B';
const GOLD_LIGHT = '#FCD34D';

const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;

interface SubscriptionStats {
  totalUsers: number;
  premiumUsers: number;
  freeUsers: number;
  conversionRate: string;
  recentPremiumUsers: Array<{
    id: string;
    username: string | null;
    email: string;
    subscriptionStartDate: string | null;
    planType: string;
  }>;
}

function StatCard({
  label,
  value,
  color,
  icon,
  delay,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ReactNode;
  delay: number;
}) {
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
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: `${color}18`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY }}>{value}</Text>
      <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{label}</Text>
    </Animated.View>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function AdminSubscriptionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<SubscriptionStats>({
    queryKey: ['admin', 'subscription-stats', token],
    queryFn: async () => {
      const response = await fetch(`${baseUrl}/api/admin/subscriptions/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await response.json() as {
        data: {
          totalUsers: number;
          premiumUsers: number;
          freeUsers: number;
          conversionRate: string;
          recentPremium: Array<{
            userId: string;
            email: string;
            username: string | null;
            startDate: string | null;
            endDate: string | null;
            planType: string;
          }>;
        }
      };
      const raw = json.data;
      return {
        totalUsers: raw.totalUsers,
        premiumUsers: raw.premiumUsers,
        freeUsers: raw.freeUsers,
        conversionRate: raw.conversionRate,
        recentPremiumUsers: (raw.recentPremium ?? []).map((u) => ({
          id: u.userId,
          username: u.username,
          email: u.email,
          subscriptionStartDate: u.startDate,
          planType: u.planType,
        })),
      };
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="admin-subscriptions-screen">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ACCENT} size="large" testID="loading-indicator" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="admin-subscriptions-screen">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#F87171', fontSize: 15, textAlign: 'center', marginBottom: 16 }}>
            {'שגיאה בטעינת נתוני מנויים'}
          </Text>
          <Pressable onPress={() => refetch()} testID="retry-button">
            <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '600' }}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const conversionPct = data.conversionRate != null
    ? `${data.conversionRate}%`
    : data.totalUsers > 0
      ? `${((data.premiumUsers / data.totalUsers) * 100).toFixed(1)}%`
      : '0%';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="admin-subscriptions-screen">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={ACCENT}
          />
        }
      >
        {/* Stats grid */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard
            label={'סה"כ משתמשים'}
            value={String(data.totalUsers)}
            color={ACCENT}
            icon={<Users size={16} color={ACCENT} />}
            delay={0}
          />
          <StatCard
            label={'פרמיום'}
            value={String(data.premiumUsers)}
            color={GOLD}
            icon={<Crown size={16} color={GOLD} />}
            delay={60}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <StatCard
            label={'חינמי'}
            value={String(data.freeUsers)}
            color={'#94A3B8'}
            icon={<Users size={16} color={'#94A3B8'} />}
            delay={120}
          />
          <StatCard
            label={'המרה'}
            value={conversionPct}
            color={'#34D399'}
            icon={<TrendingUp size={16} color={'#34D399'} />}
            delay={180}
          />
        </View>

        {/* Recent premium subscribers */}
        <Animated.View
          entering={FadeInDown.delay(240).duration(400)}
          style={{
            backgroundColor: BG_CARD,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: BORDER,
            overflow: 'hidden',
          }}
        >
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: GOLD_LIGHT, textAlign: 'right' }}>
              {'מנויים פרמיום אחרונים'}
            </Text>
          </View>

          {data.recentPremiumUsers.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Crown size={32} color={TEXT_SECONDARY} />
              <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 10 }}>{'אין מנויים פרמיום עדיין'}</Text>
            </View>
          ) : (
            data.recentPremiumUsers.map((user, i) => (
              <Pressable
                key={user.id}
                testID={`premium-user-row-${user.id}`}
                onPress={() => router.push(`/admin/user/${user.id}` as any)}
                style={({ pressed }) => ({
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : 'transparent',
                  borderBottomWidth: i < data.recentPremiumUsers.length - 1 ? 1 : 0,
                  borderBottomColor: BORDER,
                })}
              >
                {/* Right: avatar + name */}
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: 'rgba(245,158,11,0.15)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(245,158,11,0.3)',
                    }}
                  >
                    <Crown size={16} color={GOLD} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' }} numberOfLines={1}>
                      {user.username ?? user.email}
                    </Text>
                    <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
                      {`הצטרף: ${formatDate(user.subscriptionStartDate)}`}
                    </Text>
                  </View>
                </View>

                {/* Left: plan badge + chevron */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      backgroundColor: 'rgba(245,158,11,0.12)',
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderWidth: 1,
                      borderColor: 'rgba(245,158,11,0.25)',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: GOLD }}>
                      {user.planType === 'monthly' ? 'חודשי' : user.planType}
                    </Text>
                  </View>
                  <ChevronLeft size={14} color={TEXT_SECONDARY} />
                </View>
              </Pressable>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
