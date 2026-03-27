import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Eye, EyeOff, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/lib/state/auth-store';
import { register as registerApi, syncUserSettings } from '@/lib/api/auth-api';
import { useToastStore } from '@/lib/state/toast-store';
import { useSettingsStore } from '@/lib/state/settings-store';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const BORDER_FOCUS = 'rgba(96,165,250,0.5)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';
const ERROR_COLOR = '#F87171';

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: '', color: 'transparent' };
  if (pw.length < 6) return { level: 1, label: 'חלשה', color: '#F87171' };
  if (pw.length < 8) return { level: 2, label: 'בינונית', color: '#FBBF24' };
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return { level: 4, label: 'חזקה מאוד', color: '#34D399' };
  return { level: 3, label: 'טובה', color: '#60A5FA' };
}

export default function RegisterScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const showToast = useToastStore((s) => s.showToast);
  const localSettings = useSettingsStore((s) => ({
    hourlyRate: s.hourlyRate,
    currency: s.currency,
    dailyGoalHours: s.dailyGoalHours,
    weeklyGoalHours: s.weeklyGoalHours,
    defaultBreakMinutes: s.defaultBreakMinutes,
    showSalaryOnDashboard: s.showSalaryOnDashboard,
    themeMode: s.themeMode,
    onboardingCompleted: s.onboardingCompleted,
  }));

  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [usernameFocused, setUsernameFocused] = useState<boolean>(false);
  const [emailFocused, setEmailFocused] = useState<boolean>(false);
  const [passwordFocused, setPasswordFocused] = useState<boolean>(false);
  const [confirmFocused, setConfirmFocused] = useState<boolean>(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const strength = getPasswordStrength(password);

  const validate = (): string | null => {
    if (username.trim() && (username.trim().length < 3 || username.trim().length > 20)) {
      return 'שם משתמש חייב להיות בין 3 ל-20 תווים';
    }
    if (username.trim() && !/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      return 'שם משתמש יכול להכיל אותיות אנגליות, מספרים וקו תחתון בלבד';
    }
    if (!email.trim()) return 'נא להכניס אימייל';
    if (!email.includes('@') || !email.includes('.')) return 'כתובת אימייל אינה תקינה';
    if (password.length < 8) return 'הסיסמה חייבת להכיל לפחות 8 תווים';
    if (password !== confirmPassword) return 'הסיסמאות אינן תואמות';
    return null;
  };

  const handleRegister = async () => {
    const validationError = validate();
    if (validationError !== null) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await registerApi(
        email.trim().toLowerCase(),
        password,
        username.trim() || undefined,
      );
      if (result?.token && result?.user) {
        setAuth(result.token, result.user);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('החשבון נוצר בהצלחה!', 'success');
        // Sync local settings to the new account in the background
        try {
          await syncUserSettings(localSettings as Record<string, unknown>);
          if (localSettings.hourlyRate > 0) {
            showToast('הנתונים שלך גובו בהצלחה', 'success');
          }
        } catch {
          // Sync failure is non-critical — user is still logged in
        }
        router.replace('/(tabs)');
      } else {
        setError('שגיאה ביצירת החשבון, נסה שוב');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'שגיאה בחיבור לשרת, נסה שוב';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} testID="register-screen">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Animated.View entering={FadeInDown.duration(300)} style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 24 }}>
            <Pressable
              testID="back-to-login"
              onPress={() => router.back()}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 15, color: ACCENT, fontWeight: '500' }}>{'חזרה'}</Text>
              <ChevronRight size={20} color={ACCENT} />
            </Pressable>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginBottom: 28 }}>
            <Text
              style={{
                fontSize: 30,
                fontWeight: '800',
                color: TEXT_PRIMARY,
                textAlign: 'right',
                letterSpacing: -0.5,
              }}
            >
              {'יצירת חשבון'}
            </Text>
            <Text style={{ fontSize: 15, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 6 }}>
              {'הצטרף ל-WorkClock ונהל את שעות העבודה שלך'}
            </Text>
          </Animated.View>

          {/* Card */}
          <Animated.View
            entering={FadeInUp.delay(150).duration(500)}
            style={{
              backgroundColor: BG_CARD,
              borderRadius: 24,
              padding: 24,
              borderWidth: 1,
              borderColor: BORDER,
            }}
          >
            {/* Username (optional) */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY }}>
                  {'שם משתמש'}
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                  {'אופציונלי, לפחות 3 תווים'}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: BG_INPUT,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: usernameFocused ? BORDER_FOCUS : BORDER,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <TextInput
                  testID="username-input"
                  value={username}
                  onChangeText={setUsername}
                  placeholder={'לדוגמה: david123'}
                  placeholderTextColor={TEXT_SECONDARY}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setUsernameFocused(true)}
                  onBlur={() => setUsernameFocused(false)}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right' }}
                />
              </View>
            </View>

            {/* Email */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 8 }}>
                {'אימייל'}
              </Text>
              <View
                style={{
                  backgroundColor: BG_INPUT,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: emailFocused ? BORDER_FOCUS : BORDER,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <TextInput
                  ref={emailRef}
                  testID="email-input"
                  value={email}
                  onChangeText={setEmail}
                  placeholder={'הכנס אימייל'}
                  placeholderTextColor={TEXT_SECONDARY}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right' }}
                />
              </View>
            </View>

            {/* Password */}
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 8 }}>
                {'סיסמה'}
              </Text>
              <View
                style={{
                  backgroundColor: BG_INPUT,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: passwordFocused ? BORDER_FOCUS : BORDER,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <TextInput
                  ref={passwordRef}
                  testID="password-input"
                  value={password}
                  onChangeText={setPassword}
                  placeholder={'לפחות 8 תווים'}
                  placeholderTextColor={TEXT_SECONDARY}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right' }}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={{ marginRight: 8 }} testID="toggle-password-visibility">
                  {showPassword ? <Eye size={18} color={TEXT_SECONDARY} /> : <EyeOff size={18} color={TEXT_SECONDARY} />}
                </Pressable>
              </View>
            </View>

            {/* Password strength */}
            {password.length > 0 ? (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row-reverse', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: i <= strength.level ? strength.color : 'rgba(255,255,255,0.08)',
                      }}
                    />
                  ))}
                </View>
                <Text style={{ fontSize: 11, color: strength.color, textAlign: 'right' }}>{strength.label}</Text>
              </View>
            ) : (
              <View style={{ marginBottom: 16 }} />
            )}

            {/* Confirm Password */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 8 }}>
                {'אישור סיסמה'}
              </Text>
              <View
                style={{
                  backgroundColor: BG_INPUT,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: confirmFocused ? BORDER_FOCUS : BORDER,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <TextInput
                  ref={confirmRef}
                  testID="confirm-password-input"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={'הכנס סיסמה שוב'}
                  placeholderTextColor={TEXT_SECONDARY}
                  secureTextEntry={!showConfirm}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                  style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right' }}
                />
                <Pressable onPress={() => setShowConfirm((v) => !v)} style={{ marginRight: 8 }} testID="toggle-confirm-visibility">
                  {showConfirm ? <Eye size={18} color={TEXT_SECONDARY} /> : <EyeOff size={18} color={TEXT_SECONDARY} />}
                </Pressable>
              </View>
            </View>

            {/* Error */}
            {error !== null ? (
              <Animated.View entering={FadeInDown.duration(300)} style={{ marginBottom: 16 }}>
                <Text
                  testID="error-message"
                  style={{
                    fontSize: 13,
                    color: ERROR_COLOR,
                    textAlign: 'right',
                    backgroundColor: 'rgba(248,113,113,0.08)',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(248,113,113,0.2)',
                  }}
                >
                  {error}
                </Text>
              </Animated.View>
            ) : null}

            {/* Register button */}
            <Pressable
              testID="register-button"
              onPress={handleRegister}
              disabled={loading}
              style={({ pressed }) => ({
                backgroundColor: loading ? 'rgba(96,165,250,0.5)' : pressed ? 'rgba(96,165,250,0.85)' : ACCENT,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              })}
            >
              {loading
                ? <ActivityIndicator color="#fff" testID="loading-indicator" />
                : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{'הירשם'}</Text>
              }
            </Pressable>

            {/* Login link */}
            <View style={{ alignItems: 'center' }}>
              <Pressable testID="go-to-login" onPress={() => router.back()}>
                <Text style={{ fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center' }}>
                  {'יש לך חשבון? '}
                  <Text style={{ color: ACCENT, fontWeight: '600' }}>{'התחבר'}</Text>
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
