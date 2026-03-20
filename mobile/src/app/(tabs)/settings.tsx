import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
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
import Animated, { FadeInDown, FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { Crown, ChevronLeft, ChevronRight, Trash2, Plus, Check } from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore, Deduction, OneTimeAddition } from '@/lib/state/settings-store';
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

const STATIC_PRESETS: Preset[] = [
  { name: 'פנסיה', type: 'percent', amount: 6 },
  { name: 'קרן השלמות', type: 'percent', amount: 2.5 },
];

// ─── Hebrew month helper ──────────────────────────────────────────────────────

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function getHebrewMonthLabel(month: string): string {
  const parts = month.split('-');
  const monthNum = parseInt(parts[1] ?? '1', 10);
  const year = parts[0] ?? '';
  const label = HEBREW_MONTHS[monthNum - 1] ?? month;
  return `${label} ${year}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function offsetMonth(month: string, delta: number): string {
  const parts = month.split('-');
  const year = parseInt(parts[0] ?? '2024', 10);
  const m = parseInt(parts[1] ?? '1', 10);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Numeric field — debounced live-commit with "נשמר ✓" indicator ─────────────

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
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const borderOpacity = useSharedValue(0);

  // Keep in sync if store value changes externally
  const prevStoreRef = useRef(storeValue);
  if (prevStoreRef.current !== storeValue) {
    prevStoreRef.current = storeValue;
    setLocal(String(storeValue));
  }

  const commit = useCallback((text: string) => {
    const parsed = parseFloat(text.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      onCommit(parsed);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Flash green border
      borderOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(1, { duration: 800 }),
        withTiming(0, { duration: 400 }),
      );
      setSaved(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 1800);
    }
  }, [onCommit, borderOpacity]);

  const handleChangeText = useCallback((text: string) => {
    setLocal(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commit(text), 700);
  }, [commit]);

  const handleBlur = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit(local);
  }, [local, commit]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
  }, []);

  const animBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(34,197,94,${borderOpacity.value})`,
  }));

  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
      {saved ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(300)}
          style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }}
        >
          <Check size={13} color="#22C55E" />
          <Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '700' }}>{'נשמר'}</Text>
        </Animated.View>
      ) : null}
      <Animated.View style={[{ borderRadius: 12, borderWidth: 1.5 }, animBorderStyle]}>
        <TextInput
          value={local}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          keyboardType="decimal-pad"
          returnKeyType="done"
          testID={testID}
          style={{
            backgroundColor: BG_INPUT,
            borderRadius: 11,
            paddingHorizontal: 16,
            paddingVertical: 8,
            fontSize: 16,
            fontWeight: '700',
            color: TEXT_PRIMARY,
            minWidth: 80,
            textAlign: 'center',
          }}
        />
      </Animated.View>
    </View>
  );
}

// ─── One-Time Additions Section ───────────────────────────────────────────────

function OneTimeAdditionsSection() {
  const oneTimeAdditions = useSettingsStore((s) => s.oneTimeAdditions);
  const addOneTimeAddition = useSettingsStore((s) => s.addOneTimeAddition);
  const removeOneTimeAddition = useSettingsStore((s) => s.removeOneTimeAddition);

  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newMonth, setNewMonth] = useState(getCurrentMonth);
  const [newType, setNewType] = useState<'bonus' | 'gift'>('bonus');

  const handleAdd = useCallback(() => {
    const amount = parseFloat(newAmount.replace(',', '.'));
    if (!newName.trim() || isNaN(amount) || amount < 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addOneTimeAddition({ name: newName.trim(), amount, month: newMonth, type: newType });
    setNewName('');
    setNewAmount('');
    setNewMonth(getCurrentMonth());
    setNewType('bonus');
    setExpanded(false);
  }, [newName, newAmount, newMonth, newType, addOneTimeAddition]);

  const handleDelete = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      removeOneTimeAddition(id);
    },
    [removeOneTimeAddition]
  );

  const sortedAdditions = useMemo(
    () => [...oneTimeAdditions].sort((a, b) => b.month.localeCompare(a.month)),
    [oneTimeAdditions]
  );

  return (
    <SectionCard title={'תוספות חד פעמיות'}>
      {/* Existing additions list */}
      {sortedAdditions.length === 0 ? (
        <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right' }}>
            {'אין תוספות חד פעמיות'}
          </Text>
        </View>
      ) : (
        sortedAdditions.map((a: OneTimeAddition) => (
          <View
            key={a.id}
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
            }}
            testID={`one-time-addition-row-${a.id}`}
          >
            {/* Name + type badge + month on the right */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, textAlign: 'right' }}>
                {a.name}
              </Text>
              <View
                style={{
                  backgroundColor: a.type === 'bonus' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: a.type === 'bonus' ? ACCENT_BLUE : '#F59E0B',
                  }}
                >
                  {a.type === 'bonus' ? 'בונוס — נכנס לנטו' : 'מתנה — מס בלבד'}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                {getHebrewMonthLabel(a.month)}
              </Text>
            </View>

            {/* Amount + delete on the left */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY, fontVariant: ['tabular-nums'] }}>
                {`₪${a.amount.toLocaleString()}`}
              </Text>
              <Pressable
                onPress={() => handleDelete(a.id)}
                hitSlop={8}
                testID={`one-time-addition-delete-${a.id}`}
                style={{ padding: 6 }}
              >
                <Trash2 size={18} color="#F87171" />
              </Pressable>
            </View>
          </View>
        ))
      )}

      {/* Expand toggle */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setExpanded((v) => !v);
        }}
        testID="one-time-addition-expand-toggle"
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
            {'הוסף'}
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
            placeholder="שם התוספת"
            placeholderTextColor={TEXT_SECONDARY}
            returnKeyType="next"
            testID="one-time-addition-name-input"
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

          {/* Amount input */}
          <TextInput
            value={newAmount}
            onChangeText={setNewAmount}
            placeholder="סכום"
            placeholderTextColor={TEXT_SECONDARY}
            keyboardType="decimal-pad"
            returnKeyType="done"
            testID="one-time-addition-amount-input"
            style={{
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

          {/* Month picker */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BG_INPUT, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: BORDER }}>
            {/* Right arrow = older month */}
            <Pressable
              onPress={() => setNewMonth((m) => offsetMonth(m, -1))}
              testID="month-picker-older"
              hitSlop={8}
            >
              <ChevronRight size={20} color={TEXT_SECONDARY} />
            </Pressable>

            <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY }}>
              {getHebrewMonthLabel(newMonth)}
            </Text>

            {/* Left arrow = newer month */}
            <Pressable
              onPress={() => setNewMonth((m) => offsetMonth(m, 1))}
              testID="month-picker-newer"
              hitSlop={8}
            >
              <ChevronLeft size={20} color={TEXT_SECONDARY} />
            </Pressable>
          </View>

          {/* Type toggle */}
          <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setNewType('bonus');
              }}
              testID="one-time-type-bonus"
              style={{
                flex: 1,
                backgroundColor: newType === 'bonus' ? ACCENT_BLUE : BG_INPUT,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: newType === 'bonus' ? ACCENT_BLUE : BORDER,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: newType === 'bonus' ? '#FFF' : TEXT_SECONDARY }}>
                {'בונוס'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setNewType('gift');
              }}
              testID="one-time-type-gift"
              style={{
                flex: 1,
                backgroundColor: newType === 'gift' ? ACCENT_GREEN : BG_INPUT,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: newType === 'gift' ? ACCENT_GREEN : BORDER,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: newType === 'gift' ? '#FFF' : TEXT_SECONDARY }}>
                {'מתנה'}
              </Text>
            </Pressable>
          </View>

          {/* Confirm button */}
          <Pressable
            onPress={handleAdd}
            testID="one-time-addition-confirm"
            style={{
              backgroundColor: ACCENT_BLUE,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>{'אישור'}</Text>
          </Pressable>
        </View>
      ) : null}
    </SectionCard>
  );
}

// ─── Deductions Section ───────────────────────────────────────────────────────

function DeductionsSection() {
  const deductions = useSettingsStore((s) => s.deductions);
  const addDeduction = useSettingsStore((s) => s.addDeduction);
  const removeDeduction = useSettingsStore((s) => s.removeDeduction);
  const carBenefitMonthly = useSettingsStore((s) => s.carBenefitMonthly);
  const transportationValue = useSettingsStore((s) => s.transportationValue);
  const transportationType = useSettingsStore((s) => s.transportationType);

  const PRESETS: Preset[] = [
    { name: 'שווי שימוש ברכב', type: 'fixed', amount: carBenefitMonthly },
    { name: 'סיבוס', type: transportationType, amount: transportationValue },
    ...STATIC_PRESETS,
  ];

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

// ─── Training Fund & Transportation Section ───────────────────────────────────

function TrainingTransportSection() {
  const trainingFundValue = useSettingsStore((s) => s.trainingFundValue);
  const trainingFundType = useSettingsStore((s) => s.trainingFundType);
  const transportationValue = useSettingsStore((s) => s.transportationValue);
  const transportationType = useSettingsStore((s) => s.transportationType);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <SectionCard title={'ניכויים ותוספות'}>
      {/* Training Fund */}
      <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, textAlign: 'right' }}>
              {'קרן השתלמות (עובד)'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSettings({ trainingFundType: 'percent' }); }}
                testID="training-fund-type-percent"
                style={{ backgroundColor: trainingFundType === 'percent' ? ACCENT_BLUE : BG_INPUT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: trainingFundType === 'percent' ? ACCENT_BLUE : BORDER }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{'%'}</Text>
              </Pressable>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSettings({ trainingFundType: 'fixed' }); }}
                testID="training-fund-type-fixed"
                style={{ backgroundColor: trainingFundType === 'fixed' ? ACCENT_BLUE : BG_INPUT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: trainingFundType === 'fixed' ? ACCENT_BLUE : BORDER }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{'₪'}</Text>
              </Pressable>
            </View>
            <NumericInput
              storeValue={trainingFundValue}
              onCommit={(n) => updateSettings({ trainingFundValue: n })}
              testID="training-fund-input"
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>
          <View style={{ backgroundColor: 'rgba(148,163,184,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8' }}>{'ניכוי מברוטו רגיל'}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
          {'ניכוי מחושב על ברוטו רגיל — חוסך גם ממס הכנסה'}
        </Text>
      </View>

      {/* Transportation (Sibos) */}
      <View style={{ paddingVertical: 14 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, textAlign: 'right' }}>
              {'נסיעות / החזר הוצאות'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSettings({ transportationType: 'percent' }); }}
                testID="transportation-type-percent"
                style={{ backgroundColor: transportationType === 'percent' ? ACCENT_GREEN : BG_INPUT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: transportationType === 'percent' ? ACCENT_GREEN : BORDER }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{'%'}</Text>
              </Pressable>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSettings({ transportationType: 'fixed' }); }}
                testID="transportation-type-fixed"
                style={{ backgroundColor: transportationType === 'fixed' ? ACCENT_GREEN : BG_INPUT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: transportationType === 'fixed' ? ACCENT_GREEN : BORDER }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{'₪'}</Text>
              </Pressable>
            </View>
            <NumericInput
              storeValue={transportationValue}
              onCommit={(n) => updateSettings({ transportationValue: n })}
              testID="transportation-input"
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>
          <View style={{ backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#22C55E' }}>{'נכנס לנטו'}</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#818CF8' }}>{'הטבת מעסיק'}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
          {'מתווסף לנטו לאחר המס — אינו נחשב הכנסה חייבת'}
        </Text>
      </View>
    </SectionCard>
  );
}

// ─── Overtime Section ─────────────────────────────────────────────────────────

function OvertimeSection() {
  const overtimeEnabled = useSettingsStore((s) => s.overtimeEnabled);
  const overtimeMode = useSettingsStore((s) => s.overtimeMode);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <SectionCard title={'שעות נוספות'}>
      {/* Enable toggle */}
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          borderBottomWidth: overtimeEnabled ? 1 : 0,
          borderBottomColor: BORDER,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, flex: 1, textAlign: 'right' }}>
          {'חישוב שעות נוספות'}
        </Text>
        <Switch
          value={overtimeEnabled}
          onValueChange={(val) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            updateSettings({ overtimeEnabled: val });
          }}
          trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(59,130,246,0.5)' }}
          thumbColor={overtimeEnabled ? ACCENT_BLUE : 'rgba(255,255,255,0.4)'}
          testID="overtime-enabled-switch"
        />
      </View>

      {overtimeEnabled ? (
        <View style={{ paddingVertical: 14 }}>
          {/* Mode selector */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, textAlign: 'right' }}>
              {'שיטת חישוב'}
            </Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateSettings({ overtimeMode: 'daily' });
                }}
                testID="overtime-mode-daily"
                style={{
                  backgroundColor: overtimeMode === 'daily' ? ACCENT_BLUE : BG_INPUT,
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: overtimeMode === 'daily' ? ACCENT_BLUE : BORDER,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: overtimeMode === 'daily' ? '#FFF' : TEXT_SECONDARY }}>
                  {'יומי'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateSettings({ overtimeMode: 'monthly' });
                }}
                testID="overtime-mode-monthly"
                style={{
                  backgroundColor: overtimeMode === 'monthly' ? ACCENT_BLUE : BG_INPUT,
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: overtimeMode === 'monthly' ? ACCENT_BLUE : BORDER,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: overtimeMode === 'monthly' ? '#FFF' : TEXT_SECONDARY }}>
                  {'חודשי'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Info text */}
          <View style={{ backgroundColor: 'rgba(59,130,246,0.07)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)' }}>
            {overtimeMode === 'daily' ? (
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', lineHeight: 18 }}>
                {'יומי: 8-10 שעות × 125%, מעל 10 שעות × 150%'}
              </Text>
            ) : (
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', lineHeight: 18 }}>
                {'חודשי: מעל 182 שעות × 125%, מעל 210 שעות × 150%'}
              </Text>
            )}
          </View>
        </View>
      ) : null}
    </SectionCard>
  );
}



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
  const carGrossupMonthly = useSettingsStore((s) => s.carGrossupMonthly);
  const employerPensionRate = useSettingsStore((s) => s.employerPensionRate);
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
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
                {'ברירת מחדל: 2.25 (רווק/ה). כל נקודה = ₪242/חודש הנחה במס'}
              </Text>
            </View>

            <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <SettingRow label={'שווי שימוש ברכב (חודשי)'}>
                <NumericInput
                  storeValue={carBenefitMonthly}
                  onCommit={(val) => save({ carBenefitMonthly: val })}
                  testID="car-benefit-input"
                />
              </SettingRow>
              <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <View style={{ backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#F59E0B' }}>{'לצורכי מס בלבד'}</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(148,163,184,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8' }}>{'לא נכלל בפנסיה'}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
                {'זקיפת שווי — מגדיל את בסיס המס אך לא נכנס לנטו שלך'}
              </Text>
            </View>

            <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <SettingRow label={'גילום רכב (חודשי)'}>
                <NumericInput
                  storeValue={carGrossupMonthly}
                  onCommit={(val) => save({ carGrossupMonthly: val })}
                  testID="car-grossup-input"
                />
              </SettingRow>
              <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <View style={{ backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#22C55E' }}>{'נכנס לנטו'}</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#3B82F6' }}>{'מגדיל בסיס מס'}</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(148,163,184,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8' }}>{'לא נכלל בפנסיה'}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
                {'תשלום מהמעסיק לכיסוי עלות המס על הרכב — נכנס לנטו בפועל'}
              </Text>
            </View>

            <View style={{ paddingVertical: 14 }}>
              <SettingRow label={'הפרשות מעסיק לפנסיה (%)'} last>
                <NumericInput
                  storeValue={employerPensionRate}
                  onCommit={(val) => save({ employerPensionRate: val })}
                  testID="employer-pension-input"
                />
              </SettingRow>
              <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <View style={{ backgroundColor: 'rgba(20,184,166,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#14B8A6' }}>{'בסיס פנסיוני'}</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#818CF8' }}>{'הטבת מעסיק'}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
                {'מחושב על שכר בסיס בלבד (לא על בונוסים וגילום). ברירת מחדל: 6.5%'}
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
          <TrainingTransportSection />
        </Animated.View>

        {/* Overtime section */}
        <Animated.View entering={FadeInDown.delay(360).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <OvertimeSection />
        </Animated.View>

        {/* One-Time Additions section */}
        <Animated.View entering={FadeInDown.delay(380).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <OneTimeAdditionsSection />
        </Animated.View>

        {/* Premium */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
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
