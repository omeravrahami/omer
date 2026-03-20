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
import { Eye, EyeOff, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/lib/state/auth-store';
import { register as registerApi } from '@/lib/api/auth-api';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const BORDER_FOCUS = 'rgba(96,165,250,0.5)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';
const ERROR_COLOR = '#F87171';

export default function RegisterScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [emailFocused, setEmailFocused] = useState<boolean>(false);
  const [passwordFocused, setPasswordFocused] = useState<boolean>(false);
  const [confirmFocused, setConfirmFocused] = useState<boolean>(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const validate = (): string | null => {
    if (!email.trim()) return 'נא להכניס אימייל';
    if (!email.includes('@')) return 'כתובת אימייל אינה תקינה';
    if (password.length < 6) return 'הסיסמה חייבת להכיל לפחות 6 תווים';
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
      const result = await registerApi(email.trim().toLowerCase(), password);
      if (result?.token && result?.user) {
        setAuth(result.token, result.user);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      } else {
        setError('שגיאה ביצירת החשבון, נסה שוב');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setError('שגיאה בחיבור לשרת, נסה שוב');
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
          <Animated.View entering={FadeInDown.duration(300)} style={{ flexDirection: 'row-reverse', marginBottom: 24 }}>
            <Pressable
              testID="back-to-login"
              onPress={() => router.back()}
              style={({ pressed }) => ({
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <ChevronLeft size={20} color={ACCENT} />
              <Text style={{ fontSize: 15, color: ACCENT, fontWeight: '500' }}>{'חזרה'}</Text>
            </Pressable>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginBottom: 32 }}>
            <Text
              style={{
                fontSize: 30,
                fontWeight: '800',
                color: TEXT_PRIMARY,
                textAlign: 'right',
                letterSpacing: -0.5,
              }}
            >
              {'הרשמה'}
            </Text>
            <Text style={{ fontSize: 15, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 6 }}>
              {'צור חשבון חדש ב־WorkClock'}
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
            {/* Email */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: TEXT_SECONDARY,
                  textAlign: 'right',
                  marginBottom: 8,
                }}
              >
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
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: TEXT_PRIMARY,
                    textAlign: 'right',
                  }}
                />
              </View>
            </View>

            {/* Password */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: TEXT_SECONDARY,
                  textAlign: 'right',
                  marginBottom: 8,
                }}
              >
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
                  placeholder={'לפחות 6 תווים'}
                  placeholderTextColor={TEXT_SECONDARY}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: TEXT_PRIMARY,
                    textAlign: 'right',
                  }}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={{ marginRight: 8 }}
                  testID="toggle-password-visibility"
                >
                  {showPassword
                    ? <Eye size={18} color={TEXT_SECONDARY} />
                    : <EyeOff size={18} color={TEXT_SECONDARY} />
                  }
                </Pressable>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: TEXT_SECONDARY,
                  textAlign: 'right',
                  marginBottom: 8,
                }}
              >
                {'אימות סיסמה'}
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
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: TEXT_PRIMARY,
                    textAlign: 'right',
                  }}
                />
                <Pressable
                  onPress={() => setShowConfirm((v) => !v)}
                  style={{ marginRight: 8 }}
                  testID="toggle-confirm-visibility"
                >
                  {showConfirm
                    ? <Eye size={18} color={TEXT_SECONDARY} />
                    : <EyeOff size={18} color={TEXT_SECONDARY} />
                  }
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
                : (
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
                    {'הרשמה'}
                  </Text>
                )
              }
            </Pressable>

            {/* Login link */}
            <View style={{ alignItems: 'center' }}>
              <Pressable
                testID="go-to-login"
                onPress={() => router.back()}
              >
                <Text style={{ fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center' }}>
                  {'יש לי כבר חשבון '}
                  <Text style={{ color: ACCENT, fontWeight: '600' }}>{'כניסה'}</Text>
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
