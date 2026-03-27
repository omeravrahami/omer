import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Lock, Eye, EyeOff, ChevronRight, Check, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { changePassword } from '@/lib/api/auth-api';
import { useToastStore } from '@/lib/state/toast-store';

const BG = '#080E1A';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const BORDER_FOCUS = 'rgba(96,165,250,0.5)';
const BORDER_ERROR = 'rgba(248,113,113,0.5)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT = '#60A5FA';
const ERROR_COLOR = '#F87171';
const ACCENT_GREEN = '#22C55E';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  testID: string;
  hasError?: boolean;
}

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  testID,
  hasError = false,
}: PasswordFieldProps) {
  const [focused, setFocused] = useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(false);

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: hasError ? ERROR_COLOR : TEXT_SECONDARY,
          textAlign: 'right',
          marginBottom: 8,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          backgroundColor: BG_INPUT,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: hasError ? BORDER_ERROR : focused ? BORDER_FOCUS : BORDER,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 13,
        }}
      >
        <Lock size={16} color={hasError ? ERROR_COLOR : TEXT_SECONDARY} style={{ marginLeft: 10 }} />
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={TEXT_SECONDARY}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            fontSize: 15,
            color: TEXT_PRIMARY,
            textAlign: 'right',
          }}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          style={{ paddingHorizontal: 4 }}
          testID={`${testID}-toggle`}
        >
          {visible ? (
            <EyeOff size={16} color={TEXT_SECONDARY} />
          ) : (
            <Eye size={16} color={TEXT_SECONDARY} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);

  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const passwordsMatch = newPassword.length === 0 || newPassword === confirmPassword;
  const newPasswordLong = newPassword.length === 0 || newPassword.length >= 8;

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !loading;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('הסיסמה שונתה בהצלחה', 'success');
      setTimeout(() => router.back(), 1200);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'שגיאה בשינוי הסיסמה';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [canSubmit, currentPassword, newPassword, showToast, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['top']} testID="change-password-screen">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
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
              paddingBottom: 28,
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

          {/* Title */}
          <Animated.View
            entering={FadeInDown.delay(60).duration(400)}
            style={{ paddingHorizontal: 20, marginBottom: 32 }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: 'rgba(96,165,250,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(96,165,250,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                alignSelf: 'flex-end',
              }}
            >
              <Lock size={28} color={ACCENT} />
            </View>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: TEXT_PRIMARY,
                textAlign: 'right',
                marginBottom: 6,
              }}
            >
              {'שינוי סיסמה'}
            </Text>
            <Text style={{ fontSize: 14, color: TEXT_SECONDARY, textAlign: 'right', lineHeight: 20 }}>
              {'הזן את הסיסמה הנוכחית שלך ובחר סיסמה חדשה'}
            </Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View
            entering={FadeInDown.delay(120).duration(400)}
            style={{
              marginHorizontal: 16,
              backgroundColor: BG_CARD,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: BORDER,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <PasswordField
              label={'סיסמה נוכחית'}
              value={currentPassword}
              onChangeText={(t) => { setCurrentPassword(t); setError(null); }}
              placeholder={'הסיסמה הנוכחית שלך'}
              testID="current-password-input"
            />

            <PasswordField
              label={'סיסמה חדשה'}
              value={newPassword}
              onChangeText={(t) => { setNewPassword(t); setError(null); }}
              placeholder={'לפחות 8 תווים'}
              testID="new-password-input"
              hasError={!newPasswordLong}
            />

            {!newPasswordLong ? (
              <Text
                style={{
                  fontSize: 11,
                  color: ERROR_COLOR,
                  textAlign: 'right',
                  marginTop: -10,
                  marginBottom: 12,
                }}
              >
                {'הסיסמה חייבת להכיל לפחות 8 תווים'}
              </Text>
            ) : null}

            <PasswordField
              label={'אימות סיסמה חדשה'}
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
              placeholder={'הזן שוב את הסיסמה החדשה'}
              testID="confirm-password-input"
              hasError={!passwordsMatch}
            />

            {!passwordsMatch ? (
              <Text
                style={{
                  fontSize: 11,
                  color: ERROR_COLOR,
                  textAlign: 'right',
                  marginTop: -10,
                  marginBottom: 4,
                }}
              >
                {'הסיסמאות אינן תואמות'}
              </Text>
            ) : null}
          </Animated.View>

          {/* Error banner */}
          {error ? (
            <Animated.View
              entering={FadeInDown.duration(250)}
              style={{
                marginHorizontal: 16,
                marginBottom: 16,
                backgroundColor: 'rgba(248,113,113,0.08)',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(248,113,113,0.2)',
                padding: 14,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <AlertCircle size={16} color={ERROR_COLOR} />
              <Text style={{ fontSize: 13, color: ERROR_COLOR, textAlign: 'right', flex: 1 }}>
                {error}
              </Text>
            </Animated.View>
          ) : null}

          {/* Strength hints */}
          <Animated.View
            entering={FadeInDown.delay(160).duration(400)}
            style={{ marginHorizontal: 16, marginBottom: 24 }}
          >
            {[
              { label: 'לפחות 8 תווים', met: newPassword.length >= 8 },
              { label: 'הסיסמאות תואמות', met: newPassword.length > 0 && newPassword === confirmPassword },
            ].map((hint) => (
              <View
                key={hint.label}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 6 }}
              >
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: hint.met ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: hint.met ? 'rgba(34,197,94,0.4)' : BORDER,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {hint.met ? <Check size={9} color={ACCENT_GREEN} /> : null}
                </View>
                <Text style={{ fontSize: 12, color: hint.met ? ACCENT_GREEN : TEXT_SECONDARY }}>
                  {hint.label}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* Submit button */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={{ marginHorizontal: 16 }}
          >
            <Pressable
              testID="submit-button"
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => ({
                backgroundColor: success
                  ? ACCENT_GREEN
                  : !canSubmit
                    ? 'rgba(96,165,250,0.3)'
                    : pressed
                      ? 'rgba(96,165,250,0.85)'
                      : ACCENT,
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row-reverse',
                gap: 8,
              })}
            >
              {loading ? (
                <ActivityIndicator color="#fff" testID="loading-indicator" />
              ) : success ? (
                <>
                  <Check size={18} color="#fff" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{'הסיסמה שונתה!'}</Text>
                </>
              ) : (
                <>
                  <Lock size={18} color={canSubmit ? '#fff' : 'rgba(255,255,255,0.4)'} />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: canSubmit ? '#fff' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {'שנה סיסמה'}
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
