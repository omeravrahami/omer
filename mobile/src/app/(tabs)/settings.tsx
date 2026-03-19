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
import { Crown, ChevronLeft, Trash2, Plus } from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore, Deduction } from '@/lib/state/settings-store';
import { useUpdateSettings } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';

const CURRENCIES = ['ILS', 'USD', 'EUR'];

// ─── Quick-add presets ────────────────────────────────────────────────────────

interface Preset {
  name: string;
  type: 'fixed' | 'percent';
  amount: number;
}

const PRESETS: Preset[] = [
  { name: 'שווי שימוש ברכב', type: 'fixed', amount: 0 },
  { name: 'סיבוס', type: 'fixed', amount: 0 },
  { name: 'פנסיה', type: 'percent', amount: 6 },
  { name: 'קרן השלמות', type: 'percent', amount: 2.5 },
];

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

// ─── Deductions Section ───────────────────────────────────────────────────────

function DeductionsSection() {
  const deductions = useSettingsStore((s) => s.deductions);
  const addDeduction = useSettingsStore((s) => s.addDeduction);
  const removeDeduction = useSettingsStore((s) => s.removeDeduction);

  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'fixed' | 'percent'>('fixed');

  const handleAdd = useCallback(() => {
    const amount = parseFloat(newAmount.replace(',', '.'));
    if (!newName.trim() || isNaN(amount) || amount < 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addDeduction({ name: newName.trim(), amount, type: newType });
    setNewName('');
    setNewAmount('');
    setNewType('fixed');
    setExpanded(false);
  }, [newName, newAmount, newType, addDeduction]);

  const handleDelete = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      removeDeduction(id);
    },
    [removeDeduction]
  );

  const handlePreset = useCallback(
    (preset: Preset) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addDeduction({ name: preset.name, amount: preset.amount, type: preset.type });
    },
    [addDeduction]
  );

  return (
    <SectionCard title={'ניכויים'}>
      {/* Existing deductions list */}
      {deductions.length === 0 ? (
        <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
          <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'right' }}>
            אין ניכויים מוגדרים
          </Text>
        </View>
      ) : (
        deductions.map((d: Deduction, index: number) => (
          <View
            key={d.id}
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
            testID={`deduction-row-${d.id}`}
          >
            {/* Name + badge on the right */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', textAlign: 'right' }}>
                {d.name}
              </Text>
              <View
                style={{
                  backgroundColor: d.type === 'percent' ? '#EFF6FF' : '#F0FDF4',
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: d.type === 'percent' ? '#2563EB' : '#16A34A',
                  }}
                >
                  {d.type === 'percent' ? `${d.amount}%` : `₪${d.amount}`}
                </Text>
              </View>
            </View>

            {/* Delete button on the left */}
            <Pressable
              onPress={() => handleDelete(d.id)}
              hitSlop={8}
              testID={`deduction-delete-${d.id}`}
              style={{ padding: 6 }}
            >
              <Trash2 size={18} color="#F87171" />
            </Pressable>
          </View>
        ))
      )}

      {/* Quick-add preset buttons */}
      <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#94A3B8', textAlign: 'right', marginBottom: 8 }}>
          הוסף מהיר
        </Text>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((preset) => (
            <Pressable
              key={preset.name}
              onPress={() => handlePreset(preset)}
              testID={`preset-${preset.name}`}
              style={{
                backgroundColor: '#F1F5F9',
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>
                {preset.name}
              </Text>
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                {preset.type === 'percent' ? `${preset.amount}%` : '₪'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Expandable add form */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setExpanded((v) => !v);
        }}
        testID="deduction-expand-toggle"
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
        }}
      >
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
          <Plus size={16} color="#2563EB" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#2563EB', textAlign: 'right' }}>
            הוסף ניכוי
          </Text>
        </View>
        <Text style={{ fontSize: 14, color: '#94A3B8' }}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded ? (
        <View style={{ paddingBottom: 12, gap: 12 }}>
          {/* Name input */}
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="שם הניכוי"
            placeholderTextColor="#94A3B8"
            returnKeyType="next"
            testID="deduction-name-input"
            style={{
              backgroundColor: '#F1F5F9',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 15,
              color: '#0F172A',
              textAlign: 'right',
            }}
          />

          {/* Amount input + type toggle in one row */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
            {/* Amount */}
            <TextInput
              value={newAmount}
              onChangeText={setNewAmount}
              placeholder="סכום"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              returnKeyType="done"
              testID="deduction-amount-input"
              style={{
                flex: 1,
                backgroundColor: '#F1F5F9',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 15,
                fontWeight: '700',
                color: '#0F172A',
                textAlign: 'right',
              }}
            />

            {/* Type toggle */}
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setNewType('fixed');
                }}
                testID="deduction-type-fixed"
                style={{
                  backgroundColor: newType === 'fixed' ? '#2563EB' : '#F1F5F9',
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: newType === 'fixed' ? '#FFF' : '#64748B',
                  }}
                >
                  ₪ קבוע
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setNewType('percent');
                }}
                testID="deduction-type-percent"
                style={{
                  backgroundColor: newType === 'percent' ? '#2563EB' : '#F1F5F9',
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: newType === 'percent' ? '#FFF' : '#64748B',
                  }}
                >
                  % מברוטו
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Confirm button */}
          <Pressable
            onPress={handleAdd}
            testID="deduction-add-confirm"
            style={{
              backgroundColor: '#2563EB',
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>הוסף</Text>
          </Pressable>
        </View>
      ) : null}
    </SectionCard>
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

        {/* Deductions section */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <DeductionsSection />
        </Animated.View>

        {/* Premium */}
        <Animated.View entering={FadeInDown.delay(380).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
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
