/**
 * Add/Edit Session Screen
 *
 * - TimeSpinner: inline up/down steppers for hours/minutes (no modal needed for time)
 * - CalendarPickerSheet: modal grid for date selection
 * - Edit mode: when sessionId param is present, populates from params + calls PATCH
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  X,
  Plus,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Calendar,
} from 'lucide-react-native';
import { useAuthStore } from '@/lib/state/auth-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useAuthCreateSession, useAuthEditSession } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import { formatCurrency } from '@/lib/utils';

// ─── Dark theme ───────────────────────────────────────────────────────────────

const BG_DEEP = '#080E1A';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT_BLUE = '#3B82F6';
const ACCENT_AMBER = '#F59E0B';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BreakEntry {
  id: string;
  startTime: Date;
  endTime: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

let _idCounter = 0;
function newId() {
  return String(++_idCounter);
}

// ─── Time Spinner ─────────────────────────────────────────────────────────────
// Two-column inline spinner: hours [00-23] | minutes [00-59, step 5]

function TimeSpinner({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const h = value.getHours();
  const m = value.getMinutes();

  const setH = useCallback((newH: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date(value);
    d.setHours(((newH % 24) + 24) % 24);
    onChange(d);
  }, [value, onChange]);

  const setM = useCallback((newM: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date(value);
    d.setMinutes(((newM % 60) + 60) % 60);
    onChange(d);
  }, [value, onChange]);

  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
      {/* Hours column */}
      <SpinColumn
        val={h}
        maxVal={23}
        onUp={() => setH(h + 1)}
        onDown={() => setH(h - 1)}
        onChange={(n) => setH(n)}
        testPrefix="hour"
      />
      <Text style={{ fontSize: 28, fontWeight: '700', color: TEXT_SECONDARY }}>:</Text>
      {/* Minutes column */}
      <SpinColumn
        val={m}
        maxVal={59}
        onUp={() => setM(m + 5)}
        onDown={() => setM(m - 5)}
        onChange={(n) => setM(n)}
        testPrefix="min"
      />
    </View>
  );
}

function SpinColumn({
  val,
  maxVal,
  onUp,
  onDown,
  onChange,
  testPrefix,
}: {
  val: number;
  maxVal: number;
  onUp: () => void;
  onDown: () => void;
  onChange: (n: number) => void;
  testPrefix: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(String(val).padStart(2, '0'));
  const latestText = React.useRef(String(val).padStart(2, '0'));

  React.useEffect(() => {
    if (!focused) {
      const s = String(val).padStart(2, '0');
      setText(s);
      latestText.current = s;
    }
  }, [val, focused]);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      const clamped = Math.min(Math.max(0, n), maxVal);
      onChange(clamped);
      const s = String(clamped).padStart(2, '0');
      setText(s);
      latestText.current = s;
    } else {
      const s = String(val).padStart(2, '0');
      setText(s);
      latestText.current = s;
    }
  };

  return (
    <View style={{ alignItems: 'center', gap: 4, width: 56 }}>
      <Pressable
        onPress={onUp}
        testID={`${testPrefix}-up`}
        style={{
          width: 48, height: 36, borderRadius: 10,
          backgroundColor: BG_INPUT, borderWidth: 1, borderColor: BORDER,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ChevronUp size={18} color={ACCENT_BLUE} strokeWidth={2.5} />
      </Pressable>

      <View
        style={{
          width: 56, height: 52, borderRadius: 12,
          backgroundColor: BG_INPUT, borderWidth: 1,
          borderColor: focused ? ACCENT_BLUE : 'rgba(59,130,246,0.35)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <TextInput
          value={focused ? text : String(val).padStart(2, '0')}
          onChangeText={(t) => { setText(t); latestText.current = t; }}
          onFocus={() => { setFocused(true); setText(''); latestText.current = ''; }}
          onBlur={() => { setFocused(false); commit(latestText.current); }}
          onSubmitEditing={() => commit(latestText.current)}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          style={{
            fontSize: 26, fontWeight: '700',
            color: focused ? ACCENT_BLUE : TEXT_PRIMARY,
            fontVariant: ['tabular-nums'],
            width: 50, textAlign: 'center',
          }}
          testID={`${testPrefix}-input`}
        />
      </View>

      <Pressable
        onPress={onDown}
        testID={`${testPrefix}-down`}
        style={{
          width: 48, height: 36, borderRadius: 10,
          backgroundColor: BG_INPUT, borderWidth: 1, borderColor: BORDER,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ChevronDown size={18} color={ACCENT_BLUE} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

// ─── Calendar Picker Sheet ────────────────────────────────────────────────────

const HEBREW_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const HEBREW_DAYS = ['א','ב','ג','ד','ה','ו','ש'];

function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startBlank = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startBlank; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function CalendarPickerSheet({
  visible, value, onConfirm, onCancel,
}: {
  visible: boolean;
  value: Date;
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  React.useEffect(() => {
    if (visible) { setViewYear(value.getFullYear()); setViewMonth(value.getMonth()); }
  }, [visible, value]);

  const grid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goPrev = useCallback(() => {
    setViewMonth((m) => { if (m === 0) { setViewYear((y) => y - 1); return 11; } return m - 1; });
  }, []);
  const goNext = useCallback(() => {
    setViewMonth((m) => { if (m === 11) { setViewYear((y) => y + 1); return 0; } return m + 1; });
  }, []);
  const handleDayPress = useCallback((day: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = new Date(day);
    result.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onConfirm(result);
  }, [value, onConfirm]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={onCancel} />
      <Animated.View
        entering={FadeInDown.duration(280)}
        style={{
          backgroundColor: BG_CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingBottom: insets.bottom + 12, paddingHorizontal: 16,
          borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: BORDER,
        }}
      >
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 16 }}>
          <Pressable onPress={goPrev} testID="calendar-prev-month"
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: BG_INPUT, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER }}>
            <ChevronLeft size={20} color={TEXT_PRIMARY} />
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY }}>
            {`${HEBREW_MONTHS[viewMonth]} ${viewYear}`}
          </Text>
          <Pressable onPress={goNext} testID="calendar-next-month"
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: BG_INPUT, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER }}>
            <ChevronRight size={20} color={TEXT_PRIMARY} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row-reverse', marginBottom: 6 }}>
          {HEBREW_DAYS.map((name) => (
            <View key={name} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY }}>{name}</Text>
            </View>
          ))}
        </View>

        {grid.map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row-reverse', marginBottom: 2 }}>
            {row.map((day, colIdx) => {
              if (!day) return <View key={colIdx} style={{ flex: 1, height: 40 }} />;
              const isSelected = isSameDay(day, value);
              const isToday = isSameDay(day, today);
              const isOtherMonth = day.getMonth() !== viewMonth;
              return (
                <Pressable
                  key={colIdx} onPress={() => handleDayPress(day)}
                  style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  testID={`calendar-day-${day.getDate()}`}
                >
                  <View style={{
                    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSelected ? ACCENT_BLUE : 'transparent',
                    borderWidth: !isSelected && isToday ? 1.5 : 0, borderColor: ACCENT_BLUE,
                  }}>
                    <Text style={{
                      fontSize: 15, fontWeight: isSelected || isToday ? '700' : '400',
                      color: isSelected ? '#FFFFFF' : isOtherMonth ? 'rgba(255,255,255,0.2)' : TEXT_PRIMARY,
                    }}>
                      {day.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <Pressable onPress={onCancel} testID="calendar-cancel"
          style={{ marginTop: 12, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 12, backgroundColor: BG_INPUT, borderWidth: 1, borderColor: BORDER }}>
          <Text style={{ color: TEXT_SECONDARY, fontWeight: '600', fontSize: 15 }}>{'ביטול'}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: BG_CARD, borderRadius: 20, paddingHorizontal: 20, paddingBottom: 16, borderWidth: 1, borderColor: BORDER }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', paddingTop: 14, paddingBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

// ─── Calc Row ─────────────────────────────────────────────────────────────────

function CalcRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <Text style={{ fontSize: 14, color: TEXT_SECONDARY }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddEditSessionScreen() {
  const token = useAuthStore((s) => s.token) ?? '';
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const currency = useSettingsStore((s) => s.currency);
  const createSession = useAuthCreateSession(token);
  const editSession = useAuthEditSession(token);

  // ── Edit-mode params ────────────────────────────────────────────────────────
  const params = useLocalSearchParams<{
    sessionId?: string;
    editStartTime?: string;
    editEndTime?: string;
    editDate?: string;
    editNotes?: string;
  }>();

  const isEditMode = !!params.sessionId;

  const initStart = useMemo<Date>(() => {
    if (params.editStartTime) {
      const d = new Date(decodeURIComponent(params.editStartTime));
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(); d.setHours(9, 0, 0, 0); return d;
  }, [params.editStartTime]);

  const initEnd = useMemo<Date>(() => {
    if (params.editEndTime) {
      const d = new Date(decodeURIComponent(params.editEndTime));
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(); d.setHours(17, 0, 0, 0); return d;
  }, [params.editEndTime]);

  const initDate = useMemo<Date>(() => {
    if (params.editDate) {
      const d = new Date(params.editDate + 'T12:00:00');
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [params.editDate]);

  const initNotes = params.editNotes ? decodeURIComponent(params.editNotes) : '';

  // ── Form state ──────────────────────────────────────────────────────────────
  const [date, setDate] = useState<Date>(initDate);
  const [startTime, setStartTime] = useState<Date>(initStart);
  const [endTime, setEndTime] = useState<Date>(initEnd);
  // Refs mirror state so handleSave always reads the latest value
  // even when TextInput onBlur and the save button press race each other
  const startTimeRef = React.useRef<Date>(initStart);
  const endTimeRef   = React.useRef<Date>(initEnd);
  const setStartTimeSafe = (d: Date) => { startTimeRef.current = d; setStartTime(d); };
  const setEndTimeSafe   = (d: Date) => { endTimeRef.current   = d; setEndTime(d); };
  const [breaks, setBreaks] = useState<BreakEntry[]>([]);
  const [notes, setNotes] = useState(initNotes);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Derived ─────────────────────────────────────────────────────────────────

  const calculations = useMemo(() => {
    const grossMs = endTime.getTime() - startTime.getTime();
    const grossMinutes = Math.max(0, grossMs / 60000);
    const breakMinutes = breaks.reduce((sum, b) => sum + Math.max(0, (b.endTime.getTime() - b.startTime.getTime()) / 60000), 0);
    const netMinutes = Math.max(0, grossMinutes - breakMinutes);
    const netHours = netMinutes / 60;
    const totalPay = netHours * hourlyRate;
    return { grossMinutes, breakMinutes, netMinutes, netHours, totalPay };
  }, [startTime, endTime, breaks, hourlyRate]);

  const isValid = useMemo(() => endTime > startTime, [startTime, endTime]);

  // ── Breaks ──────────────────────────────────────────────────────────────────

  const addBreak = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const bStart = new Date(startTime); bStart.setHours(12, 0, 0, 0);
    const bEnd = new Date(startTime); bEnd.setHours(12, 30, 0, 0);
    setBreaks((prev) => [...prev, { id: newId(), startTime: bStart, endTime: bEnd }]);
  }, [startTime]);

  const removeBreak = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBreaks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!isValid) {
      setErrors({ time: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה' });
      showToast('שעת סיום חייבת להיות אחרי שעת התחלה', 'error');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const toLocalDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const sTime = new Date(date);
    sTime.setHours(startTimeRef.current.getHours(), startTimeRef.current.getMinutes(), 0, 0);
    const eTime = new Date(date);
    eTime.setHours(endTimeRef.current.getHours(), endTimeRef.current.getMinutes(), 0, 0);

    if (eTime <= sTime) { showToast('שעת סיום חייבת להיות אחרי שעת התחלה', 'error'); return; }

    const sessionDate = toLocalDate(date);
    const breakPayload = breaks.map((b) => {
      const bs = new Date(date); bs.setHours(b.startTime.getHours(), b.startTime.getMinutes(), 0, 0);
      const be = new Date(date); be.setHours(b.endTime.getHours(), b.endTime.getMinutes(), 0, 0);
      return { startTime: bs.toISOString(), endTime: be.toISOString() };
    });

    if (isEditMode && params.sessionId) {
      editSession.mutate(
        { sessionId: params.sessionId, data: { date: sessionDate, startTime: sTime.toISOString(), endTime: eTime.toISOString(), notes: notes.trim() || undefined, breaks: breakPayload } },
        {
          onSuccess: () => { showToast('המשמרת עודכנה בהצלחה!'); router.back(); },
          onError: (err: unknown) => { showToast(err instanceof Error ? err.message : 'שגיאה בשמירה, נסו שוב', 'error'); },
        }
      );
    } else {
      createSession.mutate(
        { date: sessionDate, startTime: sTime.toISOString(), endTime: eTime.toISOString(), notes: notes.trim() || undefined, breaks: breakPayload },
        {
          onSuccess: () => { showToast('הרשומה נשמרה בהצלחה!'); router.back(); },
          onError: (err: unknown) => { showToast(err instanceof Error ? err.message : 'שגיאה בשמירה, נסו שוב', 'error'); },
        }
      );
    }
  }, [isValid, date, startTime, endTime, breaks, notes, isEditMode, params.sessionId, createSession, editSession, showToast, router]);

  const isPending = isEditMode ? editSession.isPending : createSession.isPending;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_DEEP }} testID="add-edit-session-screen">
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: BG_CARD,
      }}>
        <Pressable onPress={() => router.back()} testID="close-add-session" style={{ padding: 4 }}>
          <X size={22} color={TEXT_SECONDARY} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY }}>
          {isEditMode ? 'עריכת משמרת' : 'הוספת משמרת'}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 48, paddingTop: 16 }}
      >
        {/* Date & Time Card */}
        <Animated.View entering={FadeInDown.duration(350)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <SectionCard title={'תאריך ושעות'}>

            {/* Date button */}
            <Pressable
              onPress={() => setCalendarVisible(true)}
              testID="date-picker-button"
              style={{
                flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: BG_INPUT, borderRadius: 14,
                paddingHorizontal: 16, paddingVertical: 12,
                borderWidth: 1, borderColor: BORDER, marginBottom: 20,
              }}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} color={ACCENT_BLUE} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_SECONDARY }}>{'תאריך'}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY }}>{fmtDate(date)}</Text>
            </Pressable>

            {/* Start Time */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10 }}>
                {'שעת התחלה'}
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                <TimeSpinner value={startTime} onChange={(d) => { setStartTimeSafe(d); setErrors((e) => ({ ...e, time: '' })); }} />
              </View>
            </View>

            {/* End Time */}
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10 }}>
                {'שעת סיום'}
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                <TimeSpinner value={endTime} onChange={(d) => { setEndTimeSafe(d); setErrors((e) => ({ ...e, time: '' })); }} />
              </View>
            </View>

            {errors.time ? (
              <Text style={{ color: '#F87171', fontSize: 12, textAlign: 'right', paddingTop: 8 }}>{errors.time}</Text>
            ) : null}
          </SectionCard>
        </Animated.View>

        {/* Breaks Card */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <View style={{ backgroundColor: BG_CARD, borderRadius: 20, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, borderWidth: 1, borderColor: BORDER }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {'הפסקות'}
              </Text>
              <Pressable onPress={addBreak} testID="add-break-button"
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' }}>
                <Plus size={14} color={ACCENT_AMBER} />
                <Text style={{ color: ACCENT_AMBER, fontWeight: '600', fontSize: 13 }}>{'הוסף'}</Text>
              </Pressable>
            </View>

            {breaks.length === 0 ? (
              <Text style={{ color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>{'אין הפסקות'}</Text>
            ) : (
              breaks.map((b, idx) => (
                <View key={b.id} style={{ paddingVertical: 12, borderBottomWidth: idx < breaks.length - 1 ? 1 : 0, borderBottomColor: BORDER }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Break spinners */}
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 8 }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, color: TEXT_SECONDARY, marginBottom: 4 }}>{'התחלה'}</Text>
                        <TimeSpinner
                          value={b.startTime}
                          onChange={(d) => setBreaks((prev) => prev.map((x, i) => i === idx ? { ...x, startTime: d } : x))}
                        />
                      </View>
                      <Text style={{ color: TEXT_SECONDARY, fontSize: 18, paddingBottom: 14 }}>{'\u2013'}</Text>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, color: TEXT_SECONDARY, marginBottom: 4 }}>{'סיום'}</Text>
                        <TimeSpinner
                          value={b.endTime}
                          onChange={(d) => setBreaks((prev) => prev.map((x, i) => i === idx ? { ...x, endTime: d } : x))}
                        />
                      </View>
                    </View>
                    {/* Duration + delete */}
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 12, color: TEXT_SECONDARY, fontVariant: ['tabular-nums'] }}>
                        {`${Math.round(Math.max(0, (b.endTime.getTime() - b.startTime.getTime()) / 60000))} דק'`}
                      </Text>
                      <Pressable onPress={() => removeBreak(b.id)} testID={`remove-break-${idx}`} style={{ padding: 4 }}>
                        <Trash2 size={16} color="#F87171" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </Animated.View>

        {/* Notes Card */}
        <Animated.View entering={FadeInDown.delay(160).duration(350)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <View style={{ backgroundColor: BG_CARD, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12, textAlign: 'right' }}>
              {'הערות'}
            </Text>
            <TextInput
              value={notes} onChangeText={setNotes}
              placeholder={'הוסיפו הערות...'}
              placeholderTextColor={TEXT_SECONDARY}
              multiline numberOfLines={3}
              style={{ backgroundColor: BG_INPUT, borderRadius: 12, padding: 14, fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right', minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: BORDER }}
              testID="notes-input"
            />
          </View>
        </Animated.View>

        {/* Summary */}
        <Animated.View entering={FadeInUp.delay(240).duration(350)} style={{ marginHorizontal: 16, marginBottom: 24 }}>
          <View style={{
            backgroundColor: isValid ? 'rgba(59,130,246,0.08)' : BG_CARD,
            borderRadius: 20, padding: 20,
            borderWidth: 1, borderColor: isValid ? 'rgba(59,130,246,0.25)' : BORDER,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14, textAlign: 'right' }}>
              {'סיכום'}
            </Text>
            <CalcRow label={'שעות ברוטו'} value={isValid ? `${(calculations.grossMinutes / 60).toFixed(2)}h` : '--'} color={TEXT_PRIMARY} />
            <CalcRow label={'הפסקות'} value={isValid ? `${(calculations.breakMinutes / 60).toFixed(2)}h` : '--'} color={ACCENT_AMBER} />
            <CalcRow label={'שעות נטו'} value={isValid ? `${calculations.netHours.toFixed(2)}h` : '--'} color="#22C55E" />
            <View style={{ height: 1, backgroundColor: isValid ? 'rgba(59,130,246,0.25)' : BORDER, marginVertical: 12 }} />
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY }}>{'שכר'}</Text>
              <Text style={{ fontSize: 26, fontWeight: '800', color: isValid ? ACCENT_BLUE : TEXT_SECONDARY, fontVariant: ['tabular-nums'] }}>
                {isValid ? formatCurrency(calculations.totalPay, currency) : formatCurrency(0, currency)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Save Button */}
        <View style={{ marginHorizontal: 16 }}>
          <Pressable
            onPress={handleSave}
            disabled={isPending || !isValid}
            testID="save-session-button"
            style={{
              backgroundColor: isValid ? ACCENT_BLUE : 'rgba(255,255,255,0.15)',
              borderRadius: 18, height: 56, alignItems: 'center', justifyContent: 'center',
              opacity: isPending ? 0.7 : 1,
              shadowColor: isValid ? ACCENT_BLUE : 'transparent',
              shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14,
              elevation: isValid ? 6 : 0,
            }}
          >
            {isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>
                  {isEditMode ? 'עדכן' : 'שמור'}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <CalendarPickerSheet
        visible={calendarVisible}
        value={date}
        onConfirm={(d) => { setDate(d); setCalendarVisible(false); }}
        onCancel={() => setCalendarVisible(false)}
      />
    </SafeAreaView>
  );
}
