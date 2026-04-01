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
import { Eye, EyeOff, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/lib/state/auth-store';
import { login as loginApi } from '@/lib/api/auth-api';
import { useToastStore } from '@/lib/state/toast-store';
import { useTranslation } from 'react-i18next';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const BORDER_FOCUS = 'rgba(96,165,250,0.5)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';
const ERROR_COLOR = '#F87171';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setGuest = useAuthStore((s) => s.setGuest);
  const showToast = useToastStore((s) => s.showToast);

  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [identifierFocused, setIdentifierFocused] = useState<boolean>(false);
  const [passwordFocused, setPasswordFocused] = useState<boolean>(false);

  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError(t('errors.validation'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await loginApi(identifier.trim(), password);
      if (result?.token && result?.user) {
        if (result.user.status === 'SUSPENDED') {
          setError(t('auth.login.error_suspended'));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        if (result.user.status === 'DISABLED') {
          setError(t('auth.login.error_disabled'));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        setAuth(result.token, result.user);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(t('auth.login.subtitle'), 'success');
        router.replace('/(tabs)');
      } else {
        setError(t('auth.login.error_invalid'));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.server_error');
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGuest();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} testID="login-screen">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo & Title */}
          <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center', marginBottom: 48 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                backgroundColor: 'rgba(96,165,250,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(96,165,250,0.25)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Clock size={40} color={ACCENT} />
            </View>
            <Text
              style={{
                fontSize: 30,
                fontWeight: '800',
                color: TEXT_PRIMARY,
                letterSpacing: -0.5,
                textAlign: 'center',
              }}
            >
              {'WorkClock'}
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: TEXT_SECONDARY,
                marginTop: 6,
                textAlign: 'center',
              }}
            >
              {t('onboarding.subtitle')}
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
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: TEXT_PRIMARY,
                textAlign: 'right',
                marginBottom: 24,
              }}
            >
              {t('auth.login.title')}
            </Text>

            {/* Identifier input */}
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
                {t('auth.login.email_or_username')}
              </Text>
              <View
                style={{
                  backgroundColor: BG_INPUT,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: identifierFocused ? BORDER_FOCUS : BORDER,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <TextInput
                  testID="email-input"
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder={t('auth.login.email_or_username')}
                  placeholderTextColor={TEXT_SECONDARY}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setIdentifierFocused(true)}
                  onBlur={() => setIdentifierFocused(false)}
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

            {/* Password input */}
            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: TEXT_SECONDARY,
                  textAlign: 'right',
                  marginBottom: 8,
                }}
              >
                {t('auth.login.password')}
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
                  placeholder={t('auth.login.password')}
                  placeholderTextColor={TEXT_SECONDARY}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
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

            {/* Forgot password */}
            <View style={{ alignItems: 'flex-start', marginBottom: 20 }}>
              <Pressable
                testID="forgot-password-link"
                onPress={() => router.push('/auth/forgot-password' as any)}
              >
                <Text style={{ fontSize: 13, color: ACCENT, fontWeight: '500' }}>
                  {t('auth.login.forgot_password')}
                </Text>
              </Pressable>
            </View>

            {/* Error message */}
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

            {/* Login button */}
            <Pressable
              testID="login-button"
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => ({
                backgroundColor: loading ? 'rgba(96,165,250,0.5)' : pressed ? 'rgba(96,165,250,0.85)' : ACCENT,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              })}
            >
              {loading
                ? <ActivityIndicator color="#fff" testID="loading-indicator" />
                : (
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
                    {t('auth.login.login_button')}
                  </Text>
                )
              }
            </Pressable>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
              <Text style={{ fontSize: 13, color: TEXT_SECONDARY, marginHorizontal: 12 }}>{t('common.or')}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
            </View>

            {/* Register link */}
            <View style={{ alignItems: 'center' }}>
              <Pressable
                testID="go-to-register"
                onPress={() => router.push('/auth/register' as any)}
              >
                <Text style={{ fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center' }}>
                  {t('auth.login.no_account')}{' '}
                  <Text style={{ color: ACCENT, fontWeight: '600' }}>{t('auth.login.register_link')}</Text>
                </Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Continue as guest */}
          <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ marginTop: 16 }}>
            <Pressable
              testID="continue-as-guest"
              onPress={handleGuest}
              style={({ pressed }) => ({
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: pressed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent',
              })}
            >
              <Text style={{ fontSize: 14, color: TEXT_SECONDARY, fontWeight: '500' }}>
                {t('auth.login.continue_as_guest')}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
