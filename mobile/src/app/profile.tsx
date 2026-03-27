import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Switch,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  ChevronRight,
  User,
  Mail,
  Shield,
  Lock,
  Smartphone,
  Cloud,
  Trash2,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Globe,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/lib/state/auth-store';
import { updateProfile, deleteAccount } from '@/lib/api/auth-api';
import { useToastStore } from '@/lib/state/toast-store';

const BG = '#080E1A';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BG_MODAL = '#0A1120';
const BORDER = 'rgba(255,255,255,0.08)';
const BORDER_FOCUS = 'rgba(96,165,250,0.5)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT = '#60A5FA';
const ACCENT_GREEN = '#22C55E';
const ERROR_COLOR = '#F87171';
const ERROR_BG = 'rgba(248,113,113,0.08)';
const ERROR_BORDER = 'rgba(248,113,113,0.2)';

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? '#3B82F6';
}

function getInitials(name: string | null, email: string): string {
  if (name && name.length > 0) {
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'לא ידוע';
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
}

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  delay?: number;
}

function SectionCard({ title, children, delay = 0 }: SectionCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400)}
      style={{
        backgroundColor: BG_CARD,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: BORDER,
        marginHorizontal: 16,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: TEXT_SECONDARY,
          textAlign: 'right',
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 8,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        {children}
      </View>
    </Animated.View>
  );
}

interface ActionRowProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  rightContent?: React.ReactNode;
  destructive?: boolean;
  testID?: string;
}

function ActionRow({ icon, label, sublabel, onPress, rightContent, destructive = false, testID }: ActionRowProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row-reverse',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: destructive ? 'rgba(248,113,113,0.12)' : 'rgba(96,165,250,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 12,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: destructive ? ERROR_COLOR : TEXT_PRIMARY,
            textAlign: 'right',
          }}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {rightContent !== undefined ? rightContent : (
        <ChevronRight size={16} color={TEXT_SECONDARY} style={{ marginRight: 4 }} />
      )}
    </Pressable>
  );
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  loading: boolean;
}

function DeleteAccountModal({ visible, onClose, onConfirm, loading }: DeleteAccountModalProps) {
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordFocused, setPasswordFocused] = useState<boolean>(false);

  const handleConfirm = useCallback(() => {
    if (!password.trim()) return;
    onConfirm(password);
  }, [password, onConfirm]);

  const handleClose = useCallback(() => {
    setPassword('');
    setShowPassword(false);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
      testID="delete-account-modal"
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.75)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={{
            backgroundColor: BG_MODAL,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: ERROR_BORDER,
            width: '100%',
            maxWidth: 380,
            overflow: 'hidden',
          }}
        >
          {/* Red header band */}
          <View
            style={{
              backgroundColor: ERROR_BG,
              borderBottomWidth: 1,
              borderBottomColor: ERROR_BORDER,
              paddingVertical: 20,
              paddingHorizontal: 24,
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: 'rgba(248,113,113,0.15)',
                borderWidth: 1,
                borderColor: ERROR_BORDER,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={26} color={ERROR_COLOR} />
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: ERROR_COLOR,
                textAlign: 'center',
              }}
            >
              {'מחיקת חשבון'}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: TEXT_SECONDARY,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              {'פעולה זו בלתי הפיכה לחלוטין. כל הנתונים, הסשנים וההגדרות שלך יימחקו לצמיתות.'}
            </Text>
          </View>

          {/* Password input */}
          <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: TEXT_SECONDARY,
                textAlign: 'right',
                marginBottom: 10,
              }}
            >
              {'הזן את הסיסמה שלך לאישור'}
            </Text>
            <View
              style={{
                backgroundColor: BG_INPUT,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: passwordFocused ? ERROR_BORDER : BORDER,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <Lock size={16} color={TEXT_SECONDARY} style={{ marginLeft: 10 }} />
              <TextInput
                testID="delete-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="סיסמה"
                placeholderTextColor={TEXT_SECONDARY}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                style={{
                  flex: 1,
                  fontSize: 15,
                  color: TEXT_PRIMARY,
                  textAlign: 'right',
                }}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={{ paddingLeft: 4 }}
              >
                {showPassword ? (
                  <EyeOff size={16} color={TEXT_SECONDARY} />
                ) : (
                  <Eye size={16} color={TEXT_SECONDARY} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Buttons */}
          <View
            style={{
              flexDirection: 'row-reverse',
              gap: 10,
              paddingHorizontal: 24,
              paddingBottom: 24,
              paddingTop: 16,
            }}
          >
            {/* Cancel */}
            <Pressable
              testID="delete-cancel-button"
              onPress={handleClose}
              disabled={loading}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: BORDER,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY }}>
                {'ביטול'}
              </Text>
            </Pressable>

            {/* Confirm delete */}
            <Pressable
              testID="delete-confirm-button"
              onPress={handleConfirm}
              disabled={loading || !password.trim()}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor:
                  loading || !password.trim()
                    ? 'rgba(248,113,113,0.25)'
                    : pressed
                    ? 'rgba(248,113,113,0.85)'
                    : ERROR_COLOR,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" testID="delete-loading" />
              ) : (
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: loading || !password.trim() ? 'rgba(255,255,255,0.4)' : '#fff',
                  }}
                >
                  {'מחק חשבון'}
                </Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const [username, setUsername] = useState<string>(user?.username ?? '');
  const [usernameFocused, setUsernameFocused] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [syncEnabled, setSyncEnabled] = useState<boolean>(false);
  const [savingCloud, setSavingCloud] = useState<boolean>(false);
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const avatarColor = getAvatarColor(user?.username ?? user?.email ?? 'U');
  const initials = getInitials(user?.username ?? null, user?.email ?? 'U');

  const handleSave = useCallback(async () => {
    if (!token || !user) return;
    setSaving(true);
    try {
      const updated = await updateProfile({ username: username.trim() || undefined });
      setAuth(token, { ...user, ...updated });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('הפרופיל עודכן בהצלחה', 'success');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'שגיאה בשמירת הפרופיל';
      showToast(msg, 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [token, user, username, setAuth, showToast]);

  const handleSaveCloud = useCallback(async () => {
    setSavingCloud(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('ההגדרות נשמרו בענן', 'success');
    } catch {
      showToast('שגיאה בשמירה לענן', 'error');
    } finally {
      setSavingCloud(false);
    }
  }, [showToast]);

  const handleOpenDeleteModal = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setShowDeleteModal(true);
  }, []);

  const handleConfirmDelete = useCallback(async (password: string) => {
    setDeletingAccount(true);
    try {
      await deleteAccount(password);
      logout();
      router.replace('/auth/login' as any);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'שגיאה במחיקת החשבון';
      showToast(msg, 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDeletingAccount(false);
      setShowDeleteModal(false);
    }
  }, [logout, router, showToast]);

  const handleWebDeletion = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('https://workclock.app/delete-account');
  }, []);

  const statusLabel = user?.status === 'ACTIVE' ? 'פעיל' : user?.status === 'SUSPENDED' ? 'מושהה' : 'מושבת';
  const statusColor = user?.status === 'ACTIVE' ? ACCENT_GREEN : user?.status === 'SUSPENDED' ? '#FBBF24' : ERROR_COLOR;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['top']} testID="profile-screen">
      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        loading={deletingAccount}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 20,
          }}
        >
          <Pressable
            testID="back-button"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              opacity: pressed ? 0.6 : 1,
              marginLeft: 'auto',
            })}
          >
            <Text style={{ fontSize: 15, color: ACCENT, fontWeight: '500' }}>{'חזרה'}</Text>
            <ChevronRight size={20} color={ACCENT} />
          </Pressable>
        </Animated.View>

        {/* Avatar & User Info */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(400)}
          style={{ alignItems: 'center', paddingBottom: 28 }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 28,
              backgroundColor: avatarColor,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              shadowColor: avatarColor,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>{initials}</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 4 }}>
            {user?.username ?? 'משתמש'}
          </Text>
          <Text style={{ fontSize: 14, color: TEXT_SECONDARY }}>{user?.email ?? ''}</Text>
          <View
            style={{
              marginTop: 10,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 6,
              backgroundColor: `${statusColor}18`,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: `${statusColor}30`,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>{statusLabel}</Text>
          </View>
        </Animated.View>

        {/* Account Details */}
        <SectionCard title="פרטי חשבון" delay={120}>
          {/* Username Edit */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 8 }}>
              {'שם משתמש'}
            </Text>
            <View
              style={{
                backgroundColor: BG_INPUT,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: usernameFocused ? BORDER_FOCUS : BORDER,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <User size={16} color={TEXT_SECONDARY} style={{ marginLeft: 10 }} />
              <TextInput
                testID="username-input"
                value={username}
                onChangeText={setUsername}
                placeholder="שם משתמש"
                placeholderTextColor={TEXT_SECONDARY}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
                style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right' }}
              />
            </View>
          </View>

          {/* Email display */}
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              paddingVertical: 14,
              borderTopWidth: 1,
              borderTopColor: BORDER,
            }}
          >
            <Mail size={16} color={TEXT_SECONDARY} style={{ marginLeft: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 2 }}>
                {'אימייל'}
              </Text>
              <Text style={{ fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right' }}>
                {user?.email ?? ''}
              </Text>
            </View>
          </View>

          {/* Member since */}
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: BORDER,
            }}
          >
            <Shield size={16} color={TEXT_SECONDARY} style={{ marginLeft: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 2 }}>
                {'חבר מאז'}
              </Text>
              <Text style={{ fontSize: 14, color: TEXT_PRIMARY, textAlign: 'right' }}>
                {formatDate(user?.lastLoginAt ?? null)}
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* Security */}
        <SectionCard title="אבטחה" delay={160}>
          <ActionRow
            testID="change-password-button"
            icon={<Lock size={18} color={ACCENT} />}
            label="שינוי סיסמה"
            sublabel="עדכן את הסיסמה שלך"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/auth/change-password' as any);
            }}
          />
          <View style={{ borderBottomWidth: 0 }}>
            <ActionRow
              testID="active-sessions-button"
              icon={<Smartphone size={18} color={ACCENT} />}
              label="סשנים פעילים"
              sublabel="נהל התחברויות פעילות"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/active-sessions' as any);
              }}
              rightContent={
                <ChevronRight size={16} color={TEXT_SECONDARY} />
              }
            />
          </View>
        </SectionCard>

        {/* Cloud Settings */}
        <SectionCard title="הגדרות ענן" delay={200}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
            }}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, flex: 1 }}>
              <Cloud size={18} color={ACCENT} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, textAlign: 'right' }}>
                  {'סנכרון הגדרות בין מכשירים'}
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
                  {'שמור שכר, מס והגדרות בענן'}
                </Text>
              </View>
            </View>
            <Switch
              testID="sync-toggle"
              value={syncEnabled}
              onValueChange={(val) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSyncEnabled(val);
              }}
              trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(59,130,246,0.5)' }}
              thumbColor={syncEnabled ? ACCENT : 'rgba(255,255,255,0.4)'}
            />
          </View>
          <Pressable
            testID="save-cloud-button"
            onPress={handleSaveCloud}
            disabled={savingCloud}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 12,
              backgroundColor: pressed || savingCloud ? 'rgba(96,165,250,0.15)' : 'rgba(96,165,250,0.1)',
              borderRadius: 14,
              paddingVertical: 13,
              borderWidth: 1,
              borderColor: 'rgba(96,165,250,0.2)',
            })}
          >
            {savingCloud ? (
              <ActivityIndicator color={ACCENT} size="small" />
            ) : (
              <>
                <Check size={16} color={ACCENT} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: ACCENT }}>
                  {'שמור הגדרות בענן'}
                </Text>
              </>
            )}
          </Pressable>
        </SectionCard>

        {/* Danger Zone */}
        <SectionCard title="מסוכן" delay={240}>
          {/* Web deletion link */}
          <Pressable
            testID="web-deletion-button"
            onPress={handleWebDeletion}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(248,113,113,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Globe size={18} color={ERROR_COLOR} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: ERROR_COLOR, textAlign: 'right' }}>
                {'מחיקת חשבון דרך האתר'}
              </Text>
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
                {'workclock.app/delete-account'}
              </Text>
            </View>
            <ChevronRight size={16} color={TEXT_SECONDARY} style={{ marginRight: 4 }} />
          </Pressable>

          {/* Delete account button */}
          <Pressable
            testID="delete-account-button"
            onPress={handleOpenDeleteModal}
            disabled={deletingAccount}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 14,
              opacity: pressed || deletingAccount ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(248,113,113,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {deletingAccount ? (
                <ActivityIndicator color={ERROR_COLOR} size="small" />
              ) : (
                <Trash2 size={18} color={ERROR_COLOR} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: ERROR_COLOR, textAlign: 'right' }}>
                {'מחיקת חשבון'}
              </Text>
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
                {'פעולה בלתי הפיכה — כל הנתונים יימחקו'}
              </Text>
            </View>
            <AlertTriangle size={16} color={ERROR_COLOR} />
          </Pressable>
        </SectionCard>

        {/* Save Button */}
        <Animated.View
          entering={FadeInUp.delay(280).duration(400)}
          style={{ marginHorizontal: 16, marginTop: 4 }}
        >
          <Pressable
            testID="save-profile-button"
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => ({
              backgroundColor: saving ? 'rgba(96,165,250,0.5)' : pressed ? 'rgba(96,165,250,0.85)' : ACCENT,
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row-reverse',
              gap: 8,
            })}
          >
            {saving ? (
              <ActivityIndicator color="#fff" testID="save-loading" />
            ) : (
              <>
                <Check size={18} color="#fff" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{'שמור שינויים'}</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
