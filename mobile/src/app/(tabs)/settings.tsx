import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { useAuthStore } from '@/lib/state/auth-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { Crown, ChevronLeft, ChevronRight, Trash2, Plus, Check, Shield, UserX, ExternalLink, Star } from 'lucide-react-native';
import { useSettingsStore, Deduction, OneTimeAddition } from '@/lib/state/settings-store';
import { useAuthUpdateSettings, useSubscriptionStatus } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import { fetch } from 'expo/fetch';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import i18next from 'i18next';

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

const REGIONS = [
  { code: 'IL', label: 'ישראל', flag: '🇮🇱', currency: 'ILS' },
  { code: 'US', label: 'United States', flag: '🇺🇸', currency: 'USD' },
  { code: 'UK', label: 'United Kingdom', flag: '🇬🇧', currency: 'GBP' },
  { code: 'EU', label: 'Europe', flag: '🇪🇺', currency: 'EUR' },
];

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
  const year = parseInt(parts[0] ?? '2026', 10);
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
  const { t } = useTranslation();
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
          <Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '700' }}>{t('settings.saved_indicator')}</Text>
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

// ─── Flag Chip ────────────────────────────────────────────────────────────────

function FlagChip({
  label,
  active,
  onPress,
  color = '#3B82F6',
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? `${color}25` : 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: active ? color : 'rgba(255,255,255,0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {active ? <Check size={10} color={color} /> : null}
      <Text style={{ fontSize: 11, fontWeight: '600', color: active ? color : 'rgba(255,255,255,0.35)' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Derive default flags from a type preset */
function defaultFlagsForType(type: 'bonus' | 'gift' | 'custom'): { isGross: boolean; isTaxOnly: boolean; isPension: boolean } {
  if (type === 'gift') return { isGross: false, isTaxOnly: true, isPension: false };
  return { isGross: true, isTaxOnly: false, isPension: false };
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
  const [newType, setNewType] = useState<'bonus' | 'gift' | 'custom'>('bonus');
  const [newIsGross, setNewIsGross] = useState(true);
  const [newIsTaxOnly, setNewIsTaxOnly] = useState(false);
  const [newIsPension, setNewIsPension] = useState(false);

  const handleTypeChange = useCallback((t: 'bonus' | 'gift' | 'custom') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNewType(t);
    const flags = defaultFlagsForType(t);
    setNewIsGross(flags.isGross);
    setNewIsTaxOnly(flags.isTaxOnly);
    setNewIsPension(flags.isPension);
  }, []);

  const handleToggleIsGross = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNewIsGross((v) => {
      const next = !v;
      if (next) setNewIsTaxOnly(false); // mutual exclusivity
      return next;
    });
  }, []);

  const handleToggleIsTaxOnly = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNewIsTaxOnly((v) => {
      const next = !v;
      if (next) setNewIsGross(false); // mutual exclusivity
      return next;
    });
  }, []);

  const handleToggleIsPension = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNewIsPension((v) => !v);
  }, []);

  const handleAdd = useCallback(() => {
    const amount = parseFloat(newAmount.replace(',', '.'));
    if (!newName.trim() || isNaN(amount) || amount < 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addOneTimeAddition({
      name: newName.trim(),
      amount,
      month: newMonth,
      type: newType,
      isGross: newIsGross,
      isTaxOnly: newIsTaxOnly,
      isPension: newIsPension,
    });
    setNewName('');
    setNewAmount('');
    setNewMonth(getCurrentMonth());
    setNewType('bonus');
    setNewIsGross(true);
    setNewIsTaxOnly(false);
    setNewIsPension(false);
    setExpanded(false);
  }, [newName, newAmount, newMonth, newType, newIsGross, newIsTaxOnly, newIsPension, addOneTimeAddition]);

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
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
              gap: 6,
            }}
            testID={`one-time-addition-row-${a.id}`}
          >
            {/* Row 1: Name + amount + delete */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, textAlign: 'right' }}>
                  {a.name}
                </Text>
                <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                  {getHebrewMonthLabel(a.month)}
                </Text>
              </View>
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
            {/* Row 2: behavior flag chips (read-only display) */}
            <View style={{ flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' }}>
              <FlagChip label="נכנס לברוטו" active={a.isGross} onPress={() => {}} color="#22C55E" />
              <FlagChip label="לצורכי מס בלבד" active={a.isTaxOnly} onPress={() => {}} color="#F59E0B" />
              <FlagChip label="נגזר לפנסיה" active={a.isPension} onPress={() => {}} color="#14B8A6" />
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
            <Pressable onPress={() => setNewMonth((m) => offsetMonth(m, -1))} testID="month-picker-older" hitSlop={8}>
              <ChevronRight size={20} color={TEXT_SECONDARY} />
            </Pressable>
            <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY }}>
              {getHebrewMonthLabel(newMonth)}
            </Text>
            <Pressable onPress={() => setNewMonth((m) => offsetMonth(m, 1))} testID="month-picker-newer" hitSlop={8}>
              <ChevronLeft size={20} color={TEXT_SECONDARY} />
            </Pressable>
          </View>

          {/* Type selector — 3 options */}
          <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
            {(['bonus', 'gift', 'custom'] as const).map((t) => {
              const labels = { bonus: 'בונוס', gift: 'מתנה/שי', custom: 'מותאם' };
              const active = newType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => handleTypeChange(t)}
                  testID={`one-time-type-${t}`}
                  style={{
                    flex: 1,
                    backgroundColor: active ? ACCENT_BLUE : BG_INPUT,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: active ? ACCENT_BLUE : BORDER,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFF' : TEXT_SECONDARY }}>
                    {labels[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Behavioral flags */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right' }}>
              {'התנהגות'}
            </Text>
            <View style={{ flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' }}>
              <FlagChip
                label="נכנס לברוטו"
                active={newIsGross}
                onPress={handleToggleIsGross}
                color="#22C55E"
              />
              <FlagChip
                label="לצורכי מס בלבד"
                active={newIsTaxOnly}
                onPress={handleToggleIsTaxOnly}
                color="#F59E0B"
              />
              <FlagChip
                label="נגזר לפנסיה"
                active={newIsPension}
                onPress={handleToggleIsPension}
                color="#14B8A6"
              />
            </View>
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
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const { t } = useTranslation();

  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const currency = useSettingsStore((s) => s.currency);
  const region = useSettingsStore((s) => s.region);
  const dailyGoalHours = useSettingsStore((s) => s.dailyGoalHours);
  const weeklyGoalHours = useSettingsStore((s) => s.weeklyGoalHours);
  const defaultBreakMinutes = useSettingsStore((s) => s.defaultBreakMinutes);
  const showSalaryOnDashboard = useSettingsStore((s) => s.showSalaryOnDashboard);
  const showCharacter = useSettingsStore((s) => s.showCharacter);
  const taxCreditPoints = useSettingsStore((s) => s.taxCreditPoints);
  const carBenefitMonthly = useSettingsStore((s) => s.carBenefitMonthly);
  const carGrossupMonthly = useSettingsStore((s) => s.carGrossupMonthly);
  const employerPensionRate = useSettingsStore((s) => s.employerPensionRate);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const isPremium = useSettingsStore((s) => s.isPremium);

  const authToken = useAuthStore((s) => s.token) ?? '';
  const authIsGuest = useAuthStore((s) => s.isGuest);
  const authLogout = useAuthStore((s) => s.logout);
  const authUserRole = useAuthStore((s) => s.user?.role);
  const authUser = useAuthStore((s) => s.user);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  // Sync subscription status from API
  const token = useAuthStore((s) => s.token);
  const { data: subStatus } = useSubscriptionStatus(token);

  useEffect(() => {
    if (subStatus) {
      updateSettings({
        isPremium: subStatus.isPremium || subStatus.subscriptionStatus === 'admin',
        subscriptionStatus: subStatus.subscriptionStatus,
        planType: subStatus.planType,
      });
    }
  }, [subStatus, updateSettings]);

  // Delete account modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');

  const updateSettingsMut = useAuthUpdateSettings(authToken);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      if (authToken) {
        const { logout: logoutApi } = await import('@/lib/api/auth-api');
        await logoutApi();
      }
    } catch {
      // ignore errors on logout
    } finally {
      authLogout();
      setLoggingOut(false);
      router.replace('/auth/login' as any);
    }
  }, [authToken, authLogout, router]);

  const handleDeleteAccount = useCallback(async () => {
    if (!deletePassword.trim()) {
      setDeleteError('יש להזין סיסמה');
      return;
    }
    setDeletingAccount(true);
    setDeleteError('');
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;
      const response = await fetch(`${baseUrl}/api/auth/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (response.ok || response.status === 200 || response.status === 204) {
        setDeleteModalVisible(false);
        authLogout();
        router.replace('/auth/login' as any);
      } else {
        const json = await response.json().catch(() => ({}));
        const msg = (json as any)?.error?.message ?? 'שגיאה במחיקת החשבון';
        setDeleteError(msg);
      }
    } catch {
      setDeleteError('שגיאת רשת, נסה שוב');
    } finally {
      setDeletingAccount(false);
    }
  }, [deletePassword, authToken, authLogout, router]);

  const openDeleteModal = useCallback(() => {
    setDeletePassword('');
    setDeleteError('');
    setDeleteModalVisible(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

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

        {/* Profile card — authenticated users only */}
        {!authIsGuest && authUser ? (
          <Animated.View entering={FadeInDown.delay(40).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <Pressable
              testID="profile-card-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/profile' as any);
              }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#141F36' : BG_CARD,
                borderRadius: 20,
                padding: 18,
                borderWidth: 1,
                borderColor: 'rgba(96,165,250,0.18)',
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 14,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              {/* Avatar */}
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  backgroundColor: '#3B82F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#3B82F6',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>
                  {(authUser.username ?? authUser.email).slice(0, 2).toUpperCase()}
                </Text>
              </View>
              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right', marginBottom: 2 }}>
                  {authUser.username ?? 'משתמש'}
                </Text>
                <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right' }}>
                  {authUser.email}
                </Text>
              </View>
              {/* Chevron */}
              <ChevronLeft size={18} color={TEXT_SECONDARY} />
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Language & Region section */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <SectionCard title={t('settings.language_section')}>

            {/* Language */}
            <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10 }}>
                {t('settings.language')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['he', 'en'] as const).map((lang) => (
                  <Pressable
                    key={lang}
                    onPress={() => {
                      if (lang === i18next.language) return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      Alert.alert(
                        lang === 'en' ? 'Switch to English' : 'עבור לעברית',
                        lang === 'en' ? 'The app will switch language. Some screens may need a reload.' : 'האפליקציה תעבור לעברית. ייתכן שחלק מהמסכים יצטרכו טעינה מחדש.',
                        [
                          { text: lang === 'en' ? 'Cancel' : 'ביטול', style: 'cancel' },
                          {
                            text: lang === 'en' ? 'Switch' : 'שנה',
                            onPress: async () => {
                              await i18next.changeLanguage(lang);
                              save({ language: lang });
                            },
                          },
                        ]
                      );
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: i18next.language === lang ? ACCENT_BLUE : BG_INPUT,
                      borderRadius: 14,
                      paddingVertical: 12,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: i18next.language === lang ? ACCENT_BLUE : BORDER,
                    }}
                    testID={`language-${lang}`}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: i18next.language === lang ? '#FFF' : TEXT_SECONDARY }}>
                      {lang === 'he' ? '🇮🇱  עברית' : '🇬🇧  English'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Region */}
            <View style={{ paddingTop: 12 }}>
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10 }}>
                {t('settings.region')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {REGIONS.map((r) => (
                  <Pressable
                    key={r.code}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      save({ region: r.code, currency: r.currency });
                    }}
                    style={{
                      backgroundColor: region === r.code ? 'rgba(59,130,246,0.15)' : BG_INPUT,
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: region === r.code ? ACCENT_BLUE : BORDER,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    testID={`region-${r.code}`}
                  >
                    <Text style={{ fontSize: 14 }}>{r.flag}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: region === r.code ? '#60A5FA' : TEXT_SECONDARY }}>
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

          </SectionCard>
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

            <SettingRow label={'הצג שכר בדשבורד'}>
              <Switch
                value={showSalaryOnDashboard}
                onValueChange={(val) => save({ showSalaryOnDashboard: val })}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(59,130,246,0.5)' }}
                thumbColor={showSalaryOnDashboard ? ACCENT_BLUE : 'rgba(255,255,255,0.4)'}
                testID="show-salary-toggle"
              />
            </SettingRow>

            <SettingRow label={'דמות שטר חיה'} last>
              <Switch
                value={showCharacter}
                onValueChange={(val) => save({ showCharacter: val })}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(59,130,246,0.5)' }}
                thumbColor={showCharacter ? ACCENT_BLUE : 'rgba(255,255,255,0.4)'}
                testID="show-character-toggle"
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
            onPress={() => !isPremium && router.push('/premium' as never)}
            disabled={isPremium}
            style={{
              backgroundColor: isPremium ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: isPremium ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)',
            }}
            testID="premium-link"
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <Crown size={24} color={isPremium ? '#22C55E' : '#F59E0B'} />
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isPremium ? '#34D399' : '#FCD34D', textAlign: 'right' }}>
                    {isPremium ? t('settings.premium_active') : t('settings.upgrade_to_premium')}
                  </Text>
                  {isPremium ? (
                    <View style={{ backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4, alignSelf: 'flex-end' }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#22C55E' }}>{t('premium.subscription_active')}</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 12, color: 'rgba(252,211,77,0.6)', textAlign: 'right', marginTop: 2 }}>
                      {t('premium.subtitle')}
                    </Text>
                  )}
                </View>
              </View>
              {!isPremium ? <ChevronLeft size={18} color="#F59E0B" /> : null}
            </View>
          </Pressable>
        </Animated.View>
        {/* Admin Panel */}
        {authUserRole === 'ADMIN' ? (
          <Animated.View entering={FadeInDown.delay(410).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <Pressable
              testID="admin-panel-button"
              onPress={() => router.push('/admin' as any)}
              style={{
                backgroundColor: 'rgba(251,191,36,0.08)',
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(251,191,36,0.2)',
              }}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                  <Shield size={24} color="#FBBF24" />
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#FCD34D', textAlign: 'right' }}>
                      {'פאנל ניהול'}
                    </Text>
                    <Text style={{ fontSize: 12, color: 'rgba(252,211,77,0.6)', textAlign: 'right', marginTop: 2 }}>
                      {'ניהול משתמשים והגדרות מערכת'}
                    </Text>
                  </View>
                </View>
                <ChevronLeft size={18} color="#FBBF24" />
              </View>
            </Pressable>
          </Animated.View>
        ) : null}
        {/* Account / Auth section */}
        <Animated.View entering={FadeInDown.delay(420).duration(400)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          {!authToken ? (
            <Pressable
              testID="login-button"
              onPress={() => router.push('/auth/login' as any)}
              style={{
                backgroundColor: 'rgba(96,165,250,0.1)',
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(96,165,250,0.25)',
              }}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#60A5FA', textAlign: 'right' }}>
                    {'התחבר / הרשמה'}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(96,165,250,0.6)', textAlign: 'right', marginTop: 2 }}>
                    {'שמור את הנתונים שלך בענן'}
                  </Text>
                </View>
                <ChevronLeft size={18} color="#60A5FA" />
              </View>
            </Pressable>
          ) : (
            <Pressable
              testID="logout-button"
              onPress={handleLogout}
              disabled={loggingOut}
              style={{
                backgroundColor: 'rgba(248,113,113,0.08)',
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(248,113,113,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row-reverse',
                gap: 10,
              }}
            >
              {loggingOut
                ? <ActivityIndicator color="#F87171" size="small" testID="logout-loading" />
                : (
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#F87171', textAlign: 'center' }}>
                    {'התנתקות'}
                  </Text>
                )
              }
            </Pressable>
          )}
        </Animated.View>

        {/* Delete Account button — shown only for authenticated non-guest users */}
        {authToken && !authIsGuest ? (
          <>
            <Animated.View entering={FadeInDown.delay(430).duration(400)} style={{ marginHorizontal: 16, marginBottom: 8 }}>
              <Pressable
                testID="delete-account-button"
                onPress={openDeleteModal}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.07)',
                  borderRadius: 20,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: 'rgba(239,68,68,0.25)',
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 12,
                })}
              >
                <UserX size={20} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#EF4444', textAlign: 'right' }}>
                    {'מחיקת חשבון'}
                  </Text>
                  <Text style={{ fontSize: 11, color: 'rgba(239,68,68,0.6)', textAlign: 'right', marginTop: 2 }}>
                    {'פעולה בלתי הפיכה — כל הנתונים יימחקו'}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
            <Pressable
              testID="delete-account-web-link"
              onPress={() => Linking.openURL((process.env.EXPO_PUBLIC_BACKEND_URL ?? '') + '/delete-account')}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, alignItems: 'center', marginHorizontal: 16, marginBottom: 12 })}
            >
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                {'הצג הוראות מחיקה באינטרנט'}
              </Text>
            </Pressable>
          </>
        ) : null}

        {/* Delete Account Modal */}
        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteModalVisible(false)}
          testID="delete-account-modal"
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
            onPress={() => setDeleteModalVisible(false)}
          >
            <Pressable
              onPress={() => {/* stop propagation */}}
              style={{
                backgroundColor: '#0F1729',
                borderRadius: 24,
                padding: 24,
                width: '100%',
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.3)',
              }}
            >
              {/* Modal header */}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <UserX size={22} color="#EF4444" />
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#F0F6FF', textAlign: 'right', flex: 1 }}>
                  {'מחיקת חשבון'}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'right', lineHeight: 20, marginBottom: 20 }}>
                {'פעולה זו תמחק לצמיתות את החשבון שלך ואת כל הנתונים המשויכים אליו. הזן את הסיסמה שלך לאישור.'}
              </Text>

              {/* Password input */}
              <TextInput
                value={deletePassword}
                onChangeText={(t) => { setDeletePassword(t); setDeleteError(''); }}
                placeholder="סיסמה"
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry
                testID="delete-account-password-input"
                style={{
                  backgroundColor: '#1A2540',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  color: '#F0F6FF',
                  textAlign: 'right',
                  borderWidth: 1,
                  borderColor: deleteError ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.08)',
                  marginBottom: 8,
                }}
              />
              {deleteError ? (
                <Text style={{ fontSize: 12, color: '#EF4444', textAlign: 'right', marginBottom: 12 }}>
                  {deleteError}
                </Text>
              ) : <View style={{ marginBottom: 12 }} />}

              {/* Confirm button */}
              <Pressable
                testID="delete-account-confirm"
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
                style={{
                  backgroundColor: 'rgba(239,68,68,0.9)',
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                {deletingAccount
                  ? <ActivityIndicator color="#fff" size="small" testID="delete-account-loading" />
                  : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{'מחק את החשבון שלי'}</Text>
                }
              </Pressable>

              {/* Cancel button */}
              <Pressable
                testID="delete-account-cancel"
                onPress={() => setDeleteModalVisible(false)}
                style={{ paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>{'ביטול'}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
        <Animated.View entering={FadeInDown.delay(450).duration(400)} style={{ marginHorizontal: 16, marginBottom: 16, alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.3)' }}>
            {'WorkClock v1.0.0'}
          </Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
            {'מס 2026 | \u00A9 2026 WorkClock'}
          </Text>
          <View style={{ flexDirection: 'row-reverse', gap: 16, marginTop: 4 }}>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Pressable
                testID="privacy-link"
                onPress={() => router.push('/privacy' as never)}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <Text style={{ fontSize: 11, color: ACCENT_BLUE, fontWeight: '600' }}>
                  {'פרטיות ותנאי שימוש'}
                </Text>
              </Pressable>
              <Pressable
                testID="privacy-link-browser"
                onPress={() => Linking.openURL((process.env.EXPO_PUBLIC_BACKEND_URL ?? '') + '/privacy')}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, flexDirection: 'row', alignItems: 'center', gap: 3 })}
              >
                <ExternalLink size={10} color="rgba(59,130,246,0.6)" />
                <Text style={{ fontSize: 10, color: 'rgba(59,130,246,0.6)' }}>{'פתח בדפדפן'}</Text>
              </Pressable>
            </View>
            <Pressable
              testID="support-link"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                showToast('support@workclock.app');
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Text style={{ fontSize: 11, color: ACCENT_BLUE, fontWeight: '600' }}>
                {'עזרה ויצירת קשר'}
              </Text>
            </Pressable>
          </View>
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
