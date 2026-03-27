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
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Eye, EyeOff, ChevronRight, Lock, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { resetPassword } from '@/lib/api/auth-api';

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

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: '', color: 'transparent' };
  if (pw.length < 6) return { level: 1, label: 'חלשה', color: '#F87171' };
  if (pw.length < 8) return { level: 2, label: 'בינונית', color: '#FBBF24' };
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return { level: 4, label: 'חזקה מאוד', color: '#34D399' };
  return { level: 3, label: 'טובה', color: '#60A5FA' };
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState<string>(params.token ?? '');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNew, setShowNew] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const [tokenFocused, setTokenFocused] = useState<boolean>(false);
  const [newFocused, setNewFocused] = useState<boolean>(false);
  const [confirmFocused, setConfirmFocused] = useState<boolean>(false);

  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async () => {
    if (!token.trim()) {
      setError('נא להכניס את קוד האיפוס');
      return;
    }
    if (newPassword.length < 8) {
      setError('הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(token.trim(), newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      setTimeout(() => {
        router.replace('/auth/login' as any);
      }, 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'שגיאה באיפוס הסיסמה';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }} testID="reset-password-screen">
        <Animated.View entering={FadeInUp.duration(500)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
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
            {'הסיסמה שונתה בהצלחה!'}
          </Text>
          <Text style={{ fontSize: 15, color: TEXT_SECONDARY, textAlign: 'center' }}>
            {'מיד תועבר לדף הכניסה...'}
          </Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} testID="reset-password-screen">
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
              testID="back-button"
              onPress={() => router.back()}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 15, color: ACCENT, fontWeight: '500' }}>{'חזרה'}</Text>
              <ChevronRight size={20} color={ACCENT} />
            </Pressable>
          </Animated.View>

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
              <Lock size={28} color={ACCENT} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right', letterSpacing: -0.5 }}>
              {'סיסמה חדשה'}
            </Text>
            <Text style={{ fontSize: 15, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 8 }}>
              {'הגדר סיסמה חדשה לחשבונך'}
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
            {/* Token input – only show if no token from params */}
            {!params.token ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 8 }}>
                  {'קוד איפוס'}
                </Text>
                <View
                  style={{
                    backgroundColor: BG_INPUT,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: tokenFocused ? BORDER_FOCUS : BORDER,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                >
                  <TextInput
                    testID="token-input"
                    value={token}
                    onChangeText={setToken}
                    placeholder={'הכנס את קוד האיפוס'}
                    placeholderTextColor={TEXT_SECONDARY}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setTokenFocused(true)}
                    onBlur={() => setTokenFocused(false)}
                    returnKeyType="next"
                    onSubmitEditing={() => newRef.current?.focus()}
                    style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right' }}
                  />
                </View>
              </View>
            ) : null}

            {/* New password */}
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 8 }}>
                {'סיסמה חדשה'}
              </Text>
              <View
                style={{
                  backgroundColor: BG_INPUT,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: newFocused ? BORDER_FOCUS : BORDER,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <TextInput
                  ref={newRef}
                  testID="new-password-input"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={'לפחות 8 תווים'}
                  placeholderTextColor={TEXT_SECONDARY}
                  secureTextEntry={!showNew}
                  onFocus={() => setNewFocused(true)}
                  onBlur={() => setNewFocused(false)}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right' }}
                />
                <Pressable onPress={() => setShowNew((v) => !v)} style={{ marginRight: 8 }} testID="toggle-new-password">
                  {showNew ? <Eye size={18} color={TEXT_SECONDARY} /> : <EyeOff size={18} color={TEXT_SECONDARY} />}
                </Pressable>
              </View>
            </View>

            {/* Strength */}
            {newPassword.length > 0 ? (
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

            {/* Confirm password */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 8 }}>
                {'אישור סיסמה חדשה'}
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
                  onSubmitEditing={handleSubmit}
                  style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right' }}
                />
                <Pressable onPress={() => setShowConfirm((v) => !v)} style={{ marginRight: 8 }} testID="toggle-confirm-password">
                  {showConfirm ? <Eye size={18} color={TEXT_SECONDARY} /> : <EyeOff size={18} color={TEXT_SECONDARY} />}
                </Pressable>
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
                : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{'שמור סיסמה חדשה'}</Text>
              }
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
