import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
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

// ─── Numeric field with local string state ────────────────────────────────────
// The key fix: never bind TextInput.value directly to a Zustand number.
// Doing so causes the picker to re-render mid-keystroke, resetting the cursor.
// Instead we keep a local string, commit on blur, and only then update the store.

function NumericInput({
  storeValue,
  onCommit,
  testID,
}: {
  storeValue: number;
  onCommit: (n: number) => void;
  testID?: string;
}) {
  const [local, setLocal] = useState(String(storeValue));

  // Keep in sync if the store value changes from somewhere else
  const prevStoreRef = useRef(storeValue);
  if (prevStoreRef.current !== storeValue) {
    prevStoreRef.current = storeValue;
    setLocal(String(storeValue));
  }

  const handleBlur = useCallback(() => {
    const parsed = parseFloat(local.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      onCommit(parsed);
    } else {
      // Revert to current store value if invalid
      setLocal(String(storeValue));
    }
  }, [local, storeValue, onCommit]);

  return (
    <TextInput
      value={local}
      onChangeText={setLocal}
      onBlur={handleBlur}
      keyboardType="decimal-pad"
      returnKeyType="done"
      testID={testID}
      style={{
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        minWidth: 80,
        textAlign: 'left',
      }}
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

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
          onSuccess: () => showToast('ההגדרות נשמרו'),
          onError: () => showToast('שגיאה בשמירה', 'error'),
        });
      }, 600);
    },
    [updateSettings, updateSettingsMut, showToast]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} testID="settings-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#0F172A', textAlign: 'right' }}>
            {'הגדרות'}
          </Text>
        </Animated.View>

        {/* Salary section */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <SectionCard title={'שכר ומטבע'}>

            <SettingRow label={'שכר לשעה'}>
              <NumericInput
                storeValue={hourlyRate}
                onCommit={(val) => save({ hourlyRate: val })}
                testID="hourly-rate-input"
              />
            </SettingRow>

            <SettingRow label={'מטבע'} last>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CURRENCIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      save({ currency: c });
                    }}
                    style={{
                      backgroundColor: currency === c ? '#2563EB' : '#F1F5F9',
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                    }}
                    testID={`currency-${c}`}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: currency === c ? '#FFF' : '#64748B' }}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </SettingRow>

          </SectionCard>
        </Animated.View>

        {/* Goals section */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <SectionCard title={'יעדים'}>

            <SettingRow label={'יעד שעות יומי'}>
              <NumericInput
                storeValue={dailyGoalHours}
                onCommit={(val) => save({ dailyGoalHours: val })}
                testID="daily-goal-input"
              />
            </SettingRow>

            <SettingRow label={'יעד שעות שבועי'}>
              <NumericInput
                storeValue={weeklyGoalHours}
                onCommit={(val) => save({ weeklyGoalHours: val })}
                testID="weekly-goal-input"
              />
            </SettingRow>

            <SettingRow label={"דק' הפסקה ברירת מחדל"} last>
              <NumericInput
                storeValue={defaultBreakMinutes}
                onCommit={(val) => save({ defaultBreakMinutes: Math.round(val) })}
                testID="break-minutes-input"
              />
            </SettingRow>

          </SectionCard>
        </Animated.View>

        {/* Display section */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <SectionCard title={'תצוגה'}>

            <SettingRow label={'הצג שכר בדשבורד'} last>
              <Switch
                value={showSalaryOnDashboard}
                onValueChange={(val) => save({ showSalaryOnDashboard: val })}
                trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
                thumbColor={showSalaryOnDashboard ? '#2563EB' : '#94A3B8'}
                testID="show-salary-toggle"
              />
            </SettingRow>

          </SectionCard>
        </Animated.View>

        {/* Premium */}
        <Animated.View entering={FadeInDown.delay(320).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <Pressable
            onPress={() => router.push('/premium' as never)}
            style={{
              backgroundColor: '#FEF3C7',
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: '#FDE68A',
            }}
            testID="premium-link"
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <Crown size={24} color="#D97706" />
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#92400E', textAlign: 'right' }}>
                    {isPro ? 'PRO פעיל' : 'שדרגו ל-PRO'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#B45309', textAlign: 'right', marginTop: 2 }}>
                    {isPro ? 'אתם נהנים מכל התכונות' : 'ייצוא, ללא פרסומות ועוד'}
                  </Text>
                </View>
              </View>
              <ChevronLeft size={18} color="#D97706" />
            </View>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: 4,
        shadowColor: '#0B1020',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: '#94A3B8',
          textAlign: 'right',
          paddingTop: 14,
          paddingBottom: 4,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

// ─── Setting Row ──────────────────────────────────────────────────────────────

function SettingRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#F1F5F9',
      }}
    >
      {/* Label on the right (RTL) */}
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', flex: 1, textAlign: 'right', marginLeft: 12 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}
