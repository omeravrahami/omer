import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Shield, ShieldOff, LogOut, Key, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUser,
  updateUser,
  resetUserPassword,
  logoutUserSessions,
  AdminUser,
} from '@/lib/api/admin-api';
import { useToastStore } from '@/lib/state/toast-store';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#34D399',
  SUSPENDED: '#FBBF24',
  DISABLED: '#F87171',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'פעיל',
  SUSPENDED: 'מושהה',
  DISABLED: 'מושבת',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#FBBF24',
  USER: '#60A5FA',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'אדמין',
  USER: 'משתמש',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
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
      <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY }}>{value}</Text>
    </View>
  );
}

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const { data: user, isLoading, isError, refetch, isRefetching } = useQuery<AdminUser>({
    queryKey: ['admin', 'user', id],
    queryFn: () => getUser(id ?? ''),
    enabled: !!id,
  });

  const updateMut = useMutation({
    mutationFn: (data: { status?: AdminUser['status']; role?: AdminUser['role'] }) =>
      updateUser(id ?? '', data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'user', id], updated);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      showToast('המשתמש עודכן בהצלחה', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: Error) => {
      showToast(e.message ?? 'שגיאה בעדכון', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const resetPwMut = useMutation({
    mutationFn: () => resetUserPassword(id ?? ''),
    onSuccess: (result) => {
      setResetToken(result.resetToken);
      showToast('קישור איפוס נוצר', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: Error) => {
      showToast(e.message ?? 'שגיאה', 'error');
    },
  });

  const logoutMut = useMutation({
    mutationFn: () => logoutUserSessions(id ?? ''),
    onSuccess: (result) => {
      showToast(`${result.deletedCount} סשנים נמחקו`, 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: Error) => {
      showToast(e.message ?? 'שגיאה', 'error');
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="user-detail-screen">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ACCENT} size="large" testID="loading-indicator" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="user-detail-screen">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#F87171', fontSize: 15, textAlign: 'center', marginBottom: 16 }}>
            {'שגיאה בטעינת המשתמש'}
          </Text>
          <Pressable onPress={() => refetch()} testID="retry-button">
            <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '600' }}>{'נסה שוב'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLORS[user.status] ?? ACCENT;
  const roleColor = ROLE_COLORS[user.role] ?? ACCENT;
  const initials = (user.username ?? user.email).slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="user-detail-screen">
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
        {/* Avatar + name card */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{
            backgroundColor: BG_CARD,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: BORDER,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: `${roleColor}20`,
              borderWidth: 2,
              borderColor: `${roleColor}50`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: '800', color: roleColor }}>{initials}</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 4 }}>
            {user.username ?? user.email}
          </Text>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 12 }}>{user.email}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Status badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: `${statusColor}18`,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: `${statusColor}30`,
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: statusColor }}>
                {STATUS_LABELS[user.status] ?? user.status}
              </Text>
            </View>
            {/* Role badge */}
            <View
              style={{
                backgroundColor: `${roleColor}18`,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: `${roleColor}30`,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: roleColor }}>
                {ROLE_LABELS[user.role] ?? user.role}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Info */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(400)}
          style={{
            backgroundColor: BG_CARD,
            borderRadius: 20,
            paddingHorizontal: 20,
            borderWidth: 1,
            borderColor: BORDER,
            marginBottom: 16,
          }}
        >
          <InfoRow label={'מזהה'} value={user.id.slice(0, 12) + '...'} />
          <InfoRow label={'אימייל מאומת'} value={user.isEmailVerified ? 'כן' : 'לא'} />
          <InfoRow label={'נרשם'} value={formatDate(user.createdAt)} />
          {user.lastLoginAt !== null ? (
            <InfoRow label={'כניסה אחרונה'} value={formatDate(user.lastLoginAt)} />
          ) : null}
        </Animated.View>

        {/* Status change */}
        <Animated.View
          entering={FadeInDown.delay(160).duration(400)}
          style={{
            backgroundColor: BG_CARD,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: BORDER,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 12 }}>
            {'סטטוס משתמש'}
          </Text>
          <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
            {(['ACTIVE', 'SUSPENDED', 'DISABLED'] as AdminUser['status'][]).map((s) => (
              <Pressable
                key={s}
                testID={`status-btn-${s}`}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  updateMut.mutate({ status: s });
                }}
                disabled={updateMut.isPending || user.status === s}
                style={{
                  flex: 1,
                  backgroundColor: user.status === s ? `${STATUS_COLORS[s]}25` : 'rgba(255,255,255,0.04)',
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: user.status === s ? `${STATUS_COLORS[s]}60` : BORDER,
                  opacity: updateMut.isPending ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: user.status === s ? (STATUS_COLORS[s] ?? ACCENT) : TEXT_SECONDARY,
                  }}
                >
                  {STATUS_LABELS[s]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Role change */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={{
            backgroundColor: BG_CARD,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: BORDER,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 12 }}>
            {'תפקיד'}
          </Text>
          <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
            {(['USER', 'ADMIN'] as AdminUser['role'][]).map((r) => (
              <Pressable
                key={r}
                testID={`role-btn-${r}`}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  updateMut.mutate({ role: r });
                }}
                disabled={updateMut.isPending || user.role === r}
                style={{
                  flex: 1,
                  backgroundColor: user.role === r ? `${ROLE_COLORS[r]}25` : 'rgba(255,255,255,0.04)',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: user.role === r ? `${ROLE_COLORS[r]}60` : BORDER,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: updateMut.isPending ? 0.6 : 1,
                }}
              >
                {r === 'ADMIN' ? (
                  <Shield size={14} color={user.role === r ? (ROLE_COLORS[r] ?? ACCENT) : TEXT_SECONDARY} />
                ) : (
                  <ShieldOff size={14} color={user.role === r ? (ROLE_COLORS[r] ?? ACCENT) : TEXT_SECONDARY} />
                )}
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: user.role === r ? (ROLE_COLORS[r] ?? ACCENT) : TEXT_SECONDARY,
                  }}
                >
                  {ROLE_LABELS[r]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(280).duration(400)}>
          {/* Reset password */}
          <Pressable
            testID="reset-password-btn"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              resetPwMut.mutate();
            }}
            disabled={resetPwMut.isPending}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(96,165,250,0.12)' : BG_CARD,
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: BORDER,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              opacity: resetPwMut.isPending ? 0.6 : 1,
            })}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(96,165,250,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={18} color={ACCENT} />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' }}>
                  {'איפוס סיסמה'}
                </Text>
                <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right' }}>
                  {'צור קישור איפוס ידני'}
                </Text>
              </View>
            </View>
            {resetPwMut.isPending
              ? <ActivityIndicator color={ACCENT} size="small" />
              : <ChevronLeft size={16} color={TEXT_SECONDARY} />
            }
          </Pressable>

          {/* Show reset token if available */}
          {resetToken !== null ? (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={{
                backgroundColor: 'rgba(96,165,250,0.08)',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: 'rgba(96,165,250,0.25)',
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 4 }}>
                {'טוקן איפוס (חד-פעמי):'}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: ACCENT,
                  textAlign: 'right',
                  fontFamily: 'monospace',
                }}
                selectable
              >
                {resetToken}
              </Text>
            </Animated.View>
          ) : null}

          {/* Logout sessions */}
          <Pressable
            testID="logout-sessions-btn"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              logoutMut.mutate();
            }}
            disabled={logoutMut.isPending}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(248,113,113,0.08)' : BG_CARD,
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: logoutMut.isPending ? 'rgba(248,113,113,0.2)' : BORDER,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: logoutMut.isPending ? 0.6 : 1,
            })}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(248,113,113,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <LogOut size={18} color="#F87171" />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#F87171', textAlign: 'right' }}>
                  {'ניתוק כל הסשנים'}
                </Text>
                <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right' }}>
                  {'מנתק את המשתמש מכל המכשירים'}
                </Text>
              </View>
            </View>
            {logoutMut.isPending
              ? <ActivityIndicator color="#F87171" size="small" />
              : <ChevronLeft size={16} color={TEXT_SECONDARY} />
            }
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
