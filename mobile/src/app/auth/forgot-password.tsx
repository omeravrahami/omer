import React, { useState } from 'react';
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
import { ChevronRight, Mail, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { forgotPassword } from '@/lib/api/auth-api';
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
const SUCCESS_COLOR = '#34D399';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [email, setEmail] = useState<string>('');
  const [emailFocused, setEmailFocused] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError(t('errors.validation'));
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError(t('errors.validation'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await forgotPassword(email.trim().toLowerCase());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      setSuccessMessage(result.message ?? t('auth.forgot_password.success_message'));
      if (result.resetToken) {
        setDevResetToken(result.resetToken);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.server_error');
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} testID="forgot-password-screen">
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
          <Animated.View entering={FadeInDown.duration(300)} style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 32 }}>
            <Pressable
              testID="back-to-login"
              onPress={() => router.back()}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 15, color: ACCENT, fontWeight: '500' }}>{t('auth.forgot_password.back_to_login')}</Text>
              <ChevronRight size={20} color={ACCENT} />
            </Pressable>
          </Animated.View>

          {success ? (
            /* Success state */
            <Animated.View entering={FadeInUp.duration(500)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: 'rgba(52,211,153,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(52,211,153,0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 24,
                }}
              >
                <CheckCircle size={40} color={SUCCESS_COLOR} />
              </View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'center', marginBottom: 12 }}>
                {t('common.success')}
              </Text>
              <Text style={{ fontSize: 15, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 8 }}>
                {successMessage}
              </Text>

              {devResetToken !== null ? (
                <Pressable
                  testID="use-dev-token"
                  onPress={() => router.push({ pathname: '/auth/reset-password' as any, params: { token: devResetToken } })}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? 'rgba(96,165,250,0.2)' : 'rgba(96,165,250,0.1)',
                    borderRadius: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    borderWidth: 1,
                    borderColor: 'rgba(96,165,250,0.3)',
                    marginBottom: 16,
                  })}
                >
                  <Text style={{ fontSize: 15, color: ACCENT, fontWeight: '600', textAlign: 'center' }}>
                    {'הזן קוד ידנית (פיתוח)'}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable testID="back-to-login-success" onPress={() => router.replace('/auth/login' as any)}>
                <Text style={{ fontSize: 14, color: TEXT_SECONDARY }}>{t('auth.forgot_password.back_to_login')}</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
              {/* Title */}
              <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginBottom: 32 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    backgroundColor: 'rgba(96,165,250,0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(96,165,250,0.25)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    alignSelf: 'flex-end',
                  }}
                >
                  <Mail size={28} color={ACCENT} />
                </View>
                <Text style={{ fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right', letterSpacing: -0.5 }}>
                  {t('auth.forgot_password.title')}
                </Text>
                <Text style={{ fontSize: 15, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 8, lineHeight: 22 }}>
                  {t('auth.forgot_password.subtitle')}
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
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 8 }}>
                    {t('auth.forgot_password.email')}
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
                      placeholder={t('auth.forgot_password.email')}
                      placeholderTextColor={TEXT_SECONDARY}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                      style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right' }}
                    />
                  </View>
                </View>

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

                <Pressable
                  testID="submit-button"
                  onPress={handleSubmit}
                  disabled={loading}
                  style={({ pressed }) => ({
                    backgroundColor: loading ? 'rgba(96,165,250,0.5)' : pressed ? 'rgba(96,165,250,0.85)' : ACCENT,
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  })}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" testID="loading-indicator" />
                    : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{t('auth.forgot_password.send_button')}</Text>
                  }
                </Pressable>
              </Animated.View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
