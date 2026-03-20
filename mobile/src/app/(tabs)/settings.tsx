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

// ─── Dark theme colors ────────────────────────────────────────────────────────

const BG_DEEP = '#080E1A';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT_BLUE = '#3B82F6';
const ACCENT_GREEN = '#22C55E';

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
        backgroundColor: BG_INPUT,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 16,
        fontWeight: '700',
        color: TEXT_PRIMARY,
        minWidth: 80,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: BORDER,
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
        <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right' }}>
            אין ניכויים מוגדרים
          </Text>
        </View>
      ) : (
        deductions.map((d: Deduction) => (
          <View
            key={d.id}
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
            }}
            testID={`deduction-row-${d.id}`}
          >
            {/* Name + badge on the right */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, textAlign: 'right' }}>
                {d.name}
              </Text>
              <View
                style={{
                  backgroundColor: d.type === 'percent' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: d.type === 'percent' ? ACCENT_BLUE : ACCENT_GREEN,
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
      <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 8 }}>
          הוסף מהיר
        </Text>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((preset) => (
            <Pressable
              key={preset.name}
              onPress={() => handlePreset(preset)}
              testID={`preset-${preset.name}`}
              style={{
                backgroundColor: BG_INPUT,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
                borderWidth: 1,
                borderColor: BORDER,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: TEXT_PRIMARY }}>
                {preset.name}
              </Text>
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
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
          <Plus size={16} color={ACCENT_BLUE} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: ACCENT_BLUE, textAlign: 'right' }}>
            הוסף ניכוי
          </Text>
        </View>
        <Text style={{ fontSize: 14, color: TEXT_SECONDARY }}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded ? (
        <View style={{ paddingBottom: 12, gap: 12 }}>
          {/* Name input */}
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="שם הניכוי"
            placeholderTextColor={TEXT_SECONDARY}
            returnKeyType="next"
            testID="deduction-name-input"
            style={{
              backgroundColor: BG_INPUT,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 15,
              color: TEXT_PRIMARY,
              textAlign: 'right',
              borderWidth: 1,
              borderColor: BORDER,
            }}
          />

          {/* Amount input + type toggle in one row */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
            {/* Amount */}
            <TextInput
              value={newAmount}
              onChangeText={setNewAmount}
              placeholder="סכום"
              placeholderTextColor={TEXT_SECONDARY}
              keyboardType="decimal-pad"
              returnKeyType="done"
              testID="deduction-amount-input"
              style={{
                flex: 1,
                backgroundColor: BG_INPUT,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 15,
                fontWeight: '700',
                color: TEXT_PRIMARY,
                textAlign: 'right',
                borderWidth: 1,
                borderColor: BORDER,
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
                  backgroundColor: newType === 'fixed' ? ACCENT_BLUE : BG_INPUT,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: newType === 'fixed' ? ACCENT_BLUE : BORDER,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: newType === 'fixed' ? '#FFF' : TEXT_SECONDARY,
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
                  backgroundColor: newType === 'percent' ? ACCENT_BLUE : BG_INPUT,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: newType === 'percent' ? ACCENT_BLUE : BORDER,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: newType === 'percent' ? '#FFF' : TEXT_SECONDARY,
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
              backgroundColor: ACCENT_BLUE,
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
  const taxCreditPoints = useSettingsStore((s) => s.taxCreditPoints);
  const carBenefitMonthly = useSettingsStore((s) => s.carBenefitMonthly);
  const trainingFundValue = useSettingsStore((s) => s.trainingFundValue);
  const trainingFundType = useSettingsStore((s) => s.trainingFundType);
  const transportationValue = useSettingsStore((s) => s.transportationValue);
  const transportationType = useSettingsStore((s) => s.transportationType);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_DEEP }} testID="settings-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>
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
                      backgroundColor: currency === c ? ACCENT_BLUE : BG_INPUT,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: currency === c ? ACCENT_BLUE : BORDER,
                    }}
                    testID={`currency-${c}`}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: currency === c ? '#FFF' : TEXT_SECONDARY }}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </SettingRow>

          </SectionCard>
        </Animated.View>

        {/* Tax calculation section */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <SectionCard title={'חישוב מס'}>

            <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <SettingRow label={'נקודות זיכוי'}>
                <NumericInput
                  storeValue={taxCreditPoints}
                  onCommit={(val) => save({ taxCreditPoints: val })}
                  testID="tax-credit-points-input"
                />
              </SettingRow>
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
                {'ברירת מחדל: 2.25 לרווק/ה'}
              </Text>
            </View>

            <View style={{ paddingVertical: 14 }}>
              <SettingRow label={'שווי שימוש ברכב (חודשי)'} last>
                <NumericInput
                  storeValue={carBenefitMonthly}
                  onCommit={(val) => save({ carBenefitMonthly: val })}
                  testID="car-benefit-input"
                />
              </SettingRow>
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
                {'מגדיל את הברוטו החייב במס בלבד'}
              </Text>
            </View>

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
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(59,130,246,0.5)' }}
                thumbColor={showSalaryOnDashboard ? ACCENT_BLUE : 'rgba(255,255,255,0.4)'}
                testID="show-salary-toggle"
              />
            </SettingRow>

          </SectionCard>
        </Animated.View>

        {/* Deductions section */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <DeductionsSection />
        </Animated.View>

        {/* Training Fund & Transportation section */}
        <Animated.View entering={FadeInDown.delay(340).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <SectionCard title={'קרן השתלמות ונסיעות'}>

            {/* Training Fund */}
            <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, textAlign: 'right' }}>
                  {'קרן השתלמות (עובד)'}
                </Text>
                {/* Segmented pill: % / ₪ */}
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 2, borderWidth: 1, borderColor: BORDER }}>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); save({ trainingFundType: 'percent' }); }}
                    testID="training-fund-type-percent"
                    style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: trainingFundType === 'percent' ? ACCENT_BLUE : 'transparent' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: trainingFundType === 'percent' ? '#FFF' : TEXT_SECONDARY }}>{'%'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); save({ trainingFundType: 'fixed' }); }}
                    testID="training-fund-type-fixed"
                    style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: trainingFundType === 'fixed' ? ACCENT_BLUE : 'transparent' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: trainingFundType === 'fixed' ? '#FFF' : TEXT_SECONDARY }}>{'₪'}</Text>
                  </Pressable>
                </View>
              </View>
              <NumericInput
                storeValue={trainingFundValue}
                onCommit={(val) => save({ trainingFundValue: val })}
                testID="training-fund-value-input"
              />
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 6 }}>
                {trainingFundType === 'percent'
                  ? `ניכוי חודשי: ${trainingFundValue}% מהברוטו`
                  : `ניכוי חודשי קבוע: ₪${trainingFundValue}`}
              </Text>
            </View>

            {/* Transportation */}
            <View style={{ paddingVertical: 14 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, textAlign: 'right' }}>
                  {'דמי נסיעות'}
                </Text>
                {/* Segmented pill: % / ₪ */}
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 2, borderWidth: 1, borderColor: BORDER }}>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); save({ transportationType: 'percent' }); }}
                    testID="transportation-type-percent"
                    style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: transportationType === 'percent' ? ACCENT_BLUE : 'transparent' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: transportationType === 'percent' ? '#FFF' : TEXT_SECONDARY }}>{'%'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); save({ transportationType: 'fixed' }); }}
                    testID="transportation-type-fixed"
                    style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: transportationType === 'fixed' ? ACCENT_BLUE : 'transparent' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: transportationType === 'fixed' ? '#FFF' : TEXT_SECONDARY }}>{'₪'}</Text>
                  </Pressable>
                </View>
              </View>
              <NumericInput
                storeValue={transportationValue}
                onCommit={(val) => save({ transportationValue: val })}
                testID="transportation-value-input"
              />
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 6 }}>
                {transportationType === 'percent'
                  ? `תוספת חודשית: ${transportationValue}% מהברוטו`
                  : `תוספת נסיעות קבועה: ₪${transportationValue}`}
              </Text>
            </View>

          </SectionCard>
        </Animated.View>

        {/* Premium */}
        <Animated.View entering={FadeInDown.delay(380).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <Pressable
            onPress={() => router.push('/premium' as never)}
            style={{
              backgroundColor: 'rgba(245,158,11,0.1)',
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: 'rgba(245,158,11,0.25)',
            }}
            testID="premium-link"
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <Crown size={24} color="#F59E0B" />
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#FCD34D', textAlign: 'right' }}>
                    {isPro ? 'PRO פעיל' : 'שדרגו ל-PRO'}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(252,211,77,0.6)', textAlign: 'right', marginTop: 2 }}>
                    {isPro ? 'אתם נהנים מכל התכונות' : 'ייצוא, ללא פרסומות ועוד'}
                  </Text>
                </View>
              </View>
              <ChevronLeft size={18} color="#F59E0B" />
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
        backgroundColor: BG_CARD,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: 4,
        borderWidth: 1,
        borderColor: BORDER,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: TEXT_SECONDARY,
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

// ─── Setting Row (RTL fixed) ──────────────────────────────────────────────────

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
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: BORDER,
      }}
    >
      {/* Label on the right (RTL: first child in row-reverse) */}
      <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, flex: 1, textAlign: 'right' }}>
        {label}
      </Text>
      {/* Value/control shrinks to content, does not compress label */}
      <View style={{ flexShrink: 0 }}>
        {children}
      </View>
    </View>
  );
}
