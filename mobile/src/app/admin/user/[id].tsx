import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Shield, ShieldOff, LogOut, Key, ChevronLeft, Smartphone, Trash2, CheckCircle, XCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUser,
  resetUserPassword,
  logoutUserSessions,
  patchUserStatus,
  patchUserRole,
  deleteUser,
  AdminUser,
} from '@/lib/api/admin-api';
import { useToastStore } from '@/lib/state/toast-store';
import { useAuthStore } from '@/lib/state/auth-store';

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
  ADMIN: '#60A5FA',
  USER: '#94A3B8',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'אדמין',
  USER: 'משתמש',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'מעולם לא';
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

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  dangerous?: boolean;
}

function ConfirmModal({ visible, title, message, confirmLabel, onConfirm, onCancel, dangerous = false }: ConfirmModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{
          backgroundColor: '#121B30',
          borderRadius: 20,
          padding: 24,
          width: '100%',
          maxWidth: 360,
          borderWidth: 1,
          borderColor: BORDER,
        }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right', marginBottom: 10 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, color: TEXT_SECONDARY, textAlign: 'right', lineHeight: 20, marginBottom: 24 }}>
            {message}
          </Text>
          <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
            <Pressable
              testID="confirm-modal-confirm"
              onPress={onConfirm}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: pressed
                  ? (dangerous ? 'rgba(248,113,113,0.4)' : 'rgba(96,165,250,0.4)')
                  : (dangerous ? 'rgba(248,113,113,0.15)' : 'rgba(96,165,250,0.15)'),
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: dangerous ? 'rgba(248,113,113,0.4)' : 'rgba(96,165,250,0.4)',
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: dangerous ? '#F87171' : ACCENT }}>
                {confirmLabel}
              </Text>
            </Pressable>
            <Pressable
              testID="confirm-modal-cancel"
              onPress={onCancel}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: BORDER,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_SECONDARY }}>{'ביטול'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const { data: user, isLoading, isError, refetch, isRefetching } = useQuery<AdminUser>({
    queryKey: ['admin', 'user', id],
    queryFn: () => getUser(id ?? ''),
    enabled: !!id,
  });

  const statusMut = useMutation({
    mutationFn: (status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED') =>
      patchUserStatus(id ?? '', status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      refetch();
      showToast('סטטוס המשתמש עודכן', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: Error) => {
      showToast(e.message ?? 'שגיאה בעדכון סטטוס', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const roleMut = useMutation({
    mutationFn: (role: 'USER' | 'ADMIN') =>
      patchUserRole(id ?? '', role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      refetch();
      showToast('תפקיד המשתמש עודכן', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: Error) => {
      showToast(e.message ?? 'שגיאה בעדכון תפקיד', 'error');
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
      refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: Error) => {
      showToast(e.message ?? 'שגיאה', 'error');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteUser(id ?? ''),
    onSuccess: () => {
      showToast('המשתמש נמחק', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (e: Error) => {
      showToast(e.message ?? 'שגיאה במחיקה', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
  const isSelf = currentUserId === user.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="user-detail-screen">
      <ConfirmModal
        visible={showDeleteModal}
        title="מחיקת משתמש"
        message={`האם אתה בטוח שברצונך למחוק את המשתמש ${user.username ?? user.email}? פעולה זו אינה הפיכה.`}
        confirmLabel="מחק"
        dangerous
        onConfirm={() => {
          setShowDeleteModal(false);
          deleteMut.mutate();
        }}
        onCancel={() => setShowDeleteModal(false)}
      />

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
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
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
            {/* Email verified badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: user.isEmailVerified ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: user.isEmailVerified ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)',
              }}
            >
              {user.isEmailVerified
                ? <CheckCircle size={11} color="#34D399" />
                : <XCircle size={11} color="#F87171" />
              }
              <Text style={{ fontSize: 12, fontWeight: '600', color: user.isEmailVerified ? '#34D399' : '#F87171' }}>
                {user.isEmailVerified ? 'מאומת' : 'לא מאומת'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Section 1: פרופיל */}
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
          <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'right', paddingTop: 16, paddingBottom: 4, letterSpacing: 0.4 }}>
            {'פרופיל'}
          </Text>
          <InfoRow label={'מזהה'} value={user.id.slice(0, 12) + '...'} />
          <InfoRow label={'שם משתמש'} value={user.username ?? '—'} />
          <InfoRow label={'אימייל'} value={user.email} />
          <InfoRow label={'נרשם'} value={formatDate(user.createdAt)} />
          <InfoRow label={'כניסה אחרונה'} value={formatDate(user.lastLoginAt)} />
          <View style={{ height: 4 }} />
        </Animated.View>

        {/* Section 2: מכשירים פעילים */}
        <Animated.View
          entering={FadeInDown.delay(140).duration(400)}
          style={{
            backgroundColor: BG_CARD,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: BORDER,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 12, letterSpacing: 0.4 }}>
            {'מכשירים פעילים'}
          </Text>
          {user.sessions && user.sessions.length > 0 ? (
            user.sessions.slice(0, 5).map((session, i) => (
              <View
                key={session.id}
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 10,
                  borderBottomWidth: i < Math.min(user.sessions!.length, 5) - 1 ? 1 : 0,
                  borderBottomColor: BORDER,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(96,165,250,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Smartphone size={16} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' }}>
                    {session.deviceName ?? session.platform ?? 'מכשיר לא ידוע'}
                  </Text>
                  <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
                    {`נראה: ${formatDate(session.lastSeenAt)}`}
                  </Text>
                </View>
                {session.platform != null ? (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, color: TEXT_SECONDARY }}>{session.platform}</Text>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Smartphone size={28} color={TEXT_SECONDARY} />
              <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 8 }}>{'אין מכשירים פעילים'}</Text>
            </View>
          )}
        </Animated.View>

        {/* Section 3: סטטוס משתמש */}
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
            {'סטטוס משתמש'}
          </Text>
          <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
            {(['ACTIVE', 'SUSPENDED', 'DISABLED'] as AdminUser['status'][]).map((s) => (
              <Pressable
                key={s}
                testID={`status-btn-${s}`}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  statusMut.mutate(s);
                }}
                disabled={statusMut.isPending || user.status === s}
                style={{
                  flex: 1,
                  backgroundColor: user.status === s ? `${STATUS_COLORS[s]}25` : 'rgba(255,255,255,0.04)',
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: user.status === s ? `${STATUS_COLORS[s]}60` : BORDER,
                  opacity: statusMut.isPending ? 0.6 : 1,
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

        {/* Role change — don't show for self */}
        {!isSelf ? (
          <Animated.View
            entering={FadeInDown.delay(260).duration(400)}
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
                    roleMut.mutate(r);
                  }}
                  disabled={roleMut.isPending || user.role === r}
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
                    opacity: roleMut.isPending ? 0.6 : 1,
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
        ) : null}

        {/* Section 4: פעולות */}
        <Animated.View entering={FadeInDown.delay(320).duration(400)}>
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
                  {'שלח איפוס סיסמה'}
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
              marginBottom: 10,
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

          {/* Delete user — don't show for self */}
          {!isSelf ? (
            <Pressable
              testID="delete-user-btn"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setShowDeleteModal(true);
              }}
              disabled={deleteMut.isPending}
              style={({ pressed }) => ({
                backgroundColor: pressed ? 'rgba(248,113,113,0.12)' : 'rgba(248,113,113,0.06)',
                borderRadius: 16,
                padding: 18,
                borderWidth: 1,
                borderColor: 'rgba(248,113,113,0.25)',
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: deleteMut.isPending ? 0.6 : 1,
              })}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(248,113,113,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={18} color="#F87171" />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#F87171', textAlign: 'right' }}>
                    {'מחק משתמש'}
                  </Text>
                  <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right' }}>
                    {'פעולה בלתי הפיכה — מחיקה מוחלטת'}
                  </Text>
                </View>
              </View>
              {deleteMut.isPending
                ? <ActivityIndicator color="#F87171" size="small" />
                : <ChevronLeft size={16} color="#F87171" />
              }
            </Pressable>
          ) : null}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
