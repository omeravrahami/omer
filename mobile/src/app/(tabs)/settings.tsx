import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Crown, ChevronLeft } from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useUpdateSettings } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';

const CURRENCIES = ['ILS', 'USD', 'EUR'];

export default function SettingsScreen() {
  const deviceId = useDeviceId();
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const updateSettingsMut = useUpdateSettings(deviceId);

  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const currency = useSettingsStore((s) => s.currency);
  const dailyGoalHours = useSettingsStore((s) => s.dailyGoalHours);
  const weeklyGoalHours = useSettingsStore((s) => s.weeklyGoalHours);
  const defaultBreakMinutes = useSettingsStore((s) => s.defaultBreakMinutes);
  const showSalaryOnDashboard = useSettingsStore((s) => s.showSalaryOnDashboard);
  const isPro = useSettingsStore((s) => s.isPro);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (partial: Record<string, unknown>) => {
      updateSettings(partial);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        updateSettingsMut.mutate(partial, {
          onSuccess: () => showToast('\u05D4\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA \u05E0\u05E9\u05DE\u05E8\u05D5'),
          onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E9\u05DE\u05D9\u05E8\u05D4', 'error'),
        });
      }, 800);
    },
    [updateSettings, updateSettingsMut, showToast]
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8FAFC' }} testID="settings-screen">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} className="px-5 pt-4 pb-4">
          <Text className="text-2xl font-bold" style={{ color: '#0F172A', textAlign: 'right' }}>
            {'\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA'}
          </Text>
        </Animated.View>

        {/* Salary Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mx-4 mb-4">
          <View className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
            <Text className="text-base font-bold mb-4" style={{ color: '#0F172A', textAlign: 'right' }}>
              {'\u05E9\u05DB\u05E8 \u05D5\u05DE\u05D8\u05D1\u05E2'}
            </Text>

            {/* Hourly Rate */}
            <SettingRow label={'\u05E9\u05DB\u05E8 \u05DC\u05E9\u05E2\u05D4'}>
              <TextInput
                value={String(hourlyRate)}
                onChangeText={(t) => {
                  const val = parseInt(t, 10);
                  if (!isNaN(val)) save({ hourlyRate: val });
                }}
                keyboardType="numeric"
                className="text-left text-base font-bold rounded-xl px-4 py-2"
                style={{ backgroundColor: '#F1F5F9', color: '#0F172A', minWidth: 80, textAlign: 'left' }}
                testID="hourly-rate-input"
              />
            </SettingRow>

            {/* Currency */}
            <SettingRow label={'\u05DE\u05D8\u05D1\u05E2'}>
              <View className="flex-row gap-2">
                {CURRENCIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      save({ currency: c });
                    }}
                    className="rounded-xl px-4 py-2"
                    style={{ backgroundColor: currency === c ? '#2563EB' : '#F1F5F9' }}
                    testID={`currency-${c}`}
                  >
                    <Text className="text-sm font-semibold" style={{ color: currency === c ? '#FFF' : '#64748B' }}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </SettingRow>
          </View>
        </Animated.View>

        {/* Goals Section */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mx-4 mb-4">
          <View className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
            <Text className="text-base font-bold mb-4" style={{ color: '#0F172A', textAlign: 'right' }}>
              {'\u05D9\u05E2\u05D3\u05D9\u05DD'}
            </Text>

            <SettingRow label={'\u05D9\u05E2\u05D3 \u05E9\u05E2\u05D5\u05EA \u05D9\u05D5\u05DE\u05D9'}>
              <TextInput
                value={String(dailyGoalHours)}
                onChangeText={(t) => {
                  const val = parseInt(t, 10);
                  if (!isNaN(val)) save({ dailyGoalHours: val });
                }}
                keyboardType="numeric"
                className="text-left text-base font-bold rounded-xl px-4 py-2"
                style={{ backgroundColor: '#F1F5F9', color: '#0F172A', minWidth: 60, textAlign: 'left' }}
                testID="daily-goal-input"
              />
            </SettingRow>

            <SettingRow label={'\u05D9\u05E2\u05D3 \u05E9\u05E2\u05D5\u05EA \u05E9\u05D1\u05D5\u05E2\u05D9'}>
              <TextInput
                value={String(weeklyGoalHours)}
                onChangeText={(t) => {
                  const val = parseInt(t, 10);
                  if (!isNaN(val)) save({ weeklyGoalHours: val });
                }}
                keyboardType="numeric"
                className="text-left text-base font-bold rounded-xl px-4 py-2"
                style={{ backgroundColor: '#F1F5F9', color: '#0F172A', minWidth: 60, textAlign: 'left' }}
                testID="weekly-goal-input"
              />
            </SettingRow>

            <SettingRow label={'\u05D3\u05E7\u05D5\u05EA \u05D4\u05E4\u05E1\u05E7\u05D4 \u05D1\u05E8\u05D9\u05E8\u05EA \u05DE\u05D7\u05D3\u05DC'}>
              <TextInput
                value={String(defaultBreakMinutes)}
                onChangeText={(t) => {
                  const val = parseInt(t, 10);
                  if (!isNaN(val)) save({ defaultBreakMinutes: val });
                }}
                keyboardType="numeric"
                className="text-left text-base font-bold rounded-xl px-4 py-2"
                style={{ backgroundColor: '#F1F5F9', color: '#0F172A', minWidth: 60, textAlign: 'left' }}
                testID="break-minutes-input"
              />
            </SettingRow>
          </View>
        </Animated.View>

        {/* Toggles */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mx-4 mb-4">
          <View className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
            <Text className="text-base font-bold mb-4" style={{ color: '#0F172A', textAlign: 'right' }}>
              {'\u05EA\u05E6\u05D5\u05D2\u05D4'}
            </Text>

            <SettingRow label={'\u05D4\u05E6\u05D2 \u05E9\u05DB\u05E8 \u05D1\u05D3\u05E9\u05D1\u05D5\u05E8\u05D3'}>
              <Switch
                value={showSalaryOnDashboard}
                onValueChange={(val) => save({ showSalaryOnDashboard: val })}
                trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
                thumbColor={showSalaryOnDashboard ? '#2563EB' : '#94A3B8'}
                testID="show-salary-toggle"
              />
            </SettingRow>
          </View>
        </Animated.View>

        {/* Premium */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mx-4 mb-4">
          <Pressable
            onPress={() => router.push('/premium' as never)}
            className="rounded-2xl p-5"
            style={{
              backgroundColor: '#FEF3C7',
              borderWidth: 1,
              borderColor: '#FDE68A',
            }}
            testID="premium-link"
          >
            <View className="flex-row-reverse items-center justify-between">
              <View className="flex-row-reverse items-center gap-3">
                <Crown size={24} color="#D97706" />
                <View>
                  <Text className="text-base font-bold" style={{ color: '#92400E', textAlign: 'right' }}>
                    {isPro ? 'PRO \u05E4\u05E2\u05D9\u05DC' : '\u05E9\u05D3\u05E8\u05D2\u05D5 \u05DC-PRO'}
                  </Text>
                  <Text className="text-xs mt-0.5" style={{ color: '#B45309', textAlign: 'right' }}>
                    {isPro ? '\u05D0\u05EA\u05DD \u05E0\u05D4\u05E0\u05D9\u05DD \u05DE\u05DB\u05DC \u05D4\u05EA\u05DB\u05D5\u05E0\u05D5\u05EA' : '\u05D9\u05D9\u05E6\u05D5\u05D0, \u05D1\u05DC\u05D9 \u05E4\u05E8\u05E1\u05D5\u05DE\u05D5\u05EA \u05D5\u05E2\u05D5\u05D3'}
                  </Text>
                </View>
              </View>
              <ChevronLeft size={20} color="#D97706" />
            </View>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between py-3" style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
      {children}
      <Text className="text-sm font-medium flex-1 mr-3" style={{ color: '#374151', textAlign: 'right' }}>
        {label}
      </Text>
    </View>
  );
}
