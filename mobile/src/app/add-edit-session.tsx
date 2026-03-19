/**
 * Add/Edit Session Screen
 *
 * Time picker strategy (cross-platform):
 * - A single `pickerTarget` state describes WHICH field is open.
 * - A separate `pendingTime` state holds the in-progress value the user is
 *   scrolling through on iOS (spinner fires onChange on every tick).
 * - On iOS: picker renders inline inside a bottom sheet with a "אישור" button.
 *   Only on confirm do we commit the value to real state.
 * - On Android: the picker opens as a native dialog that fires once and
 *   auto-closes.  We use event.type === 'set' to distinguish confirm from cancel.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { X, Plus, Trash2, ChevronDown, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useCreateSession } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import { formatCurrency } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BreakEntry {
  id: string; // local key only
  startTime: Date;
  endTime: Date;
}

type PickerTarget =
  | 'date'
  | 'startTime'
  | 'endTime'
  | `break-start-${number}`
  | `break-end-${number}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(d: Date) {
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

let _idCounter = 0;
function newId() {
  return String(++_idCounter);
}

// ─── Time Picker Overlay (iOS only) ──────────────────────────────────────────

function IOSPickerSheet({
  visible,
  label,
  mode,
  value,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  label: string;
  mode: 'date' | 'time';
  value: Date;
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Hold the "in-progress" value while user scrolls
  const pendingRef = useRef<Date>(value);
  // Reset pending ref every time we open
  React.useEffect(() => {
    if (visible) pendingRef.current = value;
  }, [visible, value]);

  const handleChange = useCallback((_event: DateTimePickerEvent, d?: Date) => {
    if (d) pendingRef.current = d;
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(pendingRef.current);
  }, [onConfirm]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={onCancel}
      />
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: insets.bottom + 8,
        }}
      >
        {/* Handle */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' }} />
        </View>

        {/* Header row */}
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 4,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{label}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={onCancel}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: '#F1F5F9',
              }}
            >
              <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 15 }}>
                {'ביטול'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: '#2563EB',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                {'אישור'}
              </Text>
            </Pressable>
          </View>
        </View>

        <DateTimePicker
          value={value}
          mode={mode}
          display="spinner"
          locale="he-IL"
          onChange={handleChange}
          style={{ height: 200 }}
        />
      </View>
    </Modal>
  );
}

// ─── Calendar Picker Sheet (iOS date mode) ────────────────────────────────────

const HEBREW_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
// RTL order: index 0 = Sunday (rightmost when direction is RTL)
const HEBREW_DAYS = ['א','ב','ג','ד','ה','ו','ש'];

function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  // month is 0-based
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Sunday = 0, so firstDay.getDay() tells us how many blanks at the start
  const startBlank = firstDay.getDay(); // 0=Sun ... 6=Sat
  const totalDays = lastDay.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startBlank; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  // Pad to full rows of 7
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
  visible,
  value,
  onConfirm,
  onCancel,
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

  // Reset view when sheet opens
  React.useEffect(() => {
    if (visible) {
      setViewYear(value.getFullYear());
      setViewMonth(value.getMonth());
    }
  }, [visible, value]);

  const grid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goPrev = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const goNext = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const handleDayPress = useCallback((day: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Preserve the time component of the original value
    const result = new Date(day);
    result.setHours(value.getHours(), value.getMinutes(), value.getSeconds(), 0);
    onConfirm(result);
  }, [value, onConfirm]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={onCancel}
      />
      <Animated.View
        entering={FadeInDown.duration(280)}
        style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingBottom: insets.bottom + 12,
          paddingHorizontal: 16,
        }}
      >
        {/* Handle bar */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' }} />
        </View>

        {/* Month navigation header — RTL: right arrow = next, left arrow = prev */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
            marginBottom: 16,
          }}
        >
          {/* Left arrow = PREVIOUS month */}
          <Pressable
            onPress={goPrev}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            testID="calendar-prev-month"
          >
            <ChevronLeft size={20} color="#0F172A" />
          </Pressable>

          {/* Month + Year centered */}
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#0F172A' }}>
            {`${HEBREW_MONTHS[viewMonth]} ${viewYear}`}
          </Text>

          {/* Right arrow = NEXT month */}
          <Pressable
            onPress={goNext}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            testID="calendar-next-month"
          >
            <ChevronRight size={20} color="#0F172A" />
          </Pressable>
        </View>

        {/* Day-of-week row — RTL, Sun first so Sunday appears on the right */}
        <View style={{ flexDirection: 'row-reverse', marginBottom: 6 }}>
          {HEBREW_DAYS.map((name) => (
            <View key={name} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8' }}>{name}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid rows */}
        {grid.map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row-reverse', marginBottom: 2 }}>
            {row.map((day, colIdx) => {
              if (!day) {
                return <View key={colIdx} style={{ flex: 1, height: 40 }} />;
              }
              const isSelected = isSameDay(day, value);
              const isToday = isSameDay(day, today);
              const isOtherMonth = day.getMonth() !== viewMonth;

              return (
                <Pressable
                  key={colIdx}
                  onPress={() => handleDayPress(day)}
                  style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  testID={`calendar-day-${day.getDate()}`}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? '#2563EB' : 'transparent',
                      borderWidth: !isSelected && isToday ? 1.5 : 0,
                      borderColor: '#2563EB',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: isSelected || isToday ? '700' : '400',
                        color: isSelected
                          ? '#FFFFFF'
                          : isOtherMonth
                          ? '#CBD5E1'
                          : '#0F172A',
                      }}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Cancel button */}
        <Pressable
          onPress={onCancel}
          style={{
            marginTop: 12,
            alignSelf: 'center',
            paddingHorizontal: 28,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: '#F1F5F9',
          }}
          testID="calendar-cancel"
        >
          <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 15 }}>{'ביטול'}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── Field Button ─────────────────────────────────────────────────────────────

function FieldButton({
  label,
  value,
  onPress,
  testID,
}: {
  label: string;
  value: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
      }}
    >
      <Text style={{ fontSize: 14, color: '#64748B', fontWeight: '500' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <ChevronDown size={14} color="#94A3B8" />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#0F172A', fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AddEditSessionScreen() {
  const deviceId = useDeviceId();
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const currency = useSettingsStore((s) => s.currency);
  const createSession = useCreateSession(deviceId);

  // Form state
  const [date, setDate] = useState(() => new Date());
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [endTime, setEndTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(17, 0, 0, 0);
    return d;
  });
  const [breaks, setBreaks] = useState<BreakEntry[]>([]);
  const [notes, setNotes] = useState('');

  // Picker state
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Derived ────────────────────────────────────────────────────────────────

  const calculations = useMemo(() => {
    const grossMs = endTime.getTime() - startTime.getTime();
    const grossMinutes = Math.max(0, grossMs / 60000);
    const breakMinutes = breaks.reduce((sum, b) => {
      return sum + Math.max(0, (b.endTime.getTime() - b.startTime.getTime()) / 60000);
    }, 0);
    const netMinutes = Math.max(0, grossMinutes - breakMinutes);
    const netHours = netMinutes / 60;
    const totalPay = netHours * hourlyRate;
    return { grossMinutes, breakMinutes, netMinutes, netHours, totalPay };
  }, [startTime, endTime, breaks, hourlyRate]);

  const isValid = useMemo(() => endTime > startTime, [startTime, endTime]);

  // ── Picker helpers ─────────────────────────────────────────────────────────

  // Returns the current Date value for the open picker field
  const pickerValue = useMemo<Date>(() => {
    if (!pickerTarget) return new Date();
    if (pickerTarget === 'date') return date;
    if (pickerTarget === 'startTime') return startTime;
    if (pickerTarget === 'endTime') return endTime;
    const m = pickerTarget.match(/^break-(start|end)-(\d+)$/);
    if (m) {
      const idx = Number(m[2]);
      const b = breaks[idx];
      return b ? (m[1] === 'start' ? b.startTime : b.endTime) : new Date();
    }
    return new Date();
  }, [pickerTarget, date, startTime, endTime, breaks]);

  const pickerMode = useMemo<'date' | 'time'>(() => {
    return pickerTarget === 'date' ? 'date' : 'time';
  }, [pickerTarget]);

  const pickerLabel = useMemo<string>(() => {
    if (!pickerTarget) return '';
    if (pickerTarget === 'date') return 'תאריך';
    if (pickerTarget === 'startTime') return 'שעת התחלה';
    if (pickerTarget === 'endTime') return 'שעת סיום';
    const m = pickerTarget.match(/^break-(start|end)-(\d+)$/);
    if (m) return m[1] === 'start' ? 'התחלת הפסקה' : 'סיום הפסקה';
    return '';
  }, [pickerTarget]);

  // Commit the chosen value to the right piece of state
  const commitValue = useCallback(
    (d: Date) => {
      if (!pickerTarget) return;
      if (pickerTarget === 'date') {
        setDate(d);
      } else if (pickerTarget === 'startTime') {
        setStartTime(d);
        setErrors((e) => ({ ...e, time: '' }));
      } else if (pickerTarget === 'endTime') {
        setEndTime(d);
        setErrors((e) => ({ ...e, time: '' }));
      } else {
        const m = pickerTarget.match(/^break-(start|end)-(\d+)$/);
        if (m) {
          const idx = Number(m[2]);
          setBreaks((prev) =>
            prev.map((b, i) => {
              if (i !== idx) return b;
              return m[1] === 'start' ? { ...b, startTime: d } : { ...b, endTime: d };
            })
          );
        }
      }
    },
    [pickerTarget]
  );

  // Android: onChange fires once with either 'set' (user confirmed) or 'dismissed'
  const handleAndroidChange = useCallback(
    (event: DateTimePickerEvent, d?: Date) => {
      setPickerTarget(null); // always close immediately on Android
      if (event.type === 'set' && d) {
        commitValue(d);
      }
    },
    [commitValue]
  );

  // iOS: confirm pressed in sheet
  const handleIOSConfirm = useCallback(
    (d: Date) => {
      commitValue(d);
      setPickerTarget(null);
    },
    [commitValue]
  );

  // ── Breaks ──────────────────────────────────────────────────────────────────

  const addBreak = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const bStart = new Date(startTime);
    bStart.setHours(12, 0, 0, 0);
    const bEnd = new Date(startTime);
    bEnd.setHours(12, 30, 0, 0);
    setBreaks((prev) => [...prev, { id: newId(), startTime: bStart, endTime: bEnd }]);
  }, [startTime]);

  const removeBreak = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBreaks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!isValid) {
      setErrors({ time: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה' });
      showToast('שעת סיום חייבת להיות אחרי שעת התחלה', 'error');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Build start/end by overlaying the time onto the chosen date
    const sTime = new Date(date);
    sTime.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

    const eTime = new Date(date);
    eTime.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

    // If end time is "earlier" in the clock but was meant for "next day" wrap isn't
    // supported in this simple form — just validate
    if (eTime <= sTime) {
      showToast('שעת סיום חייבת להיות אחרי שעת התחלה', 'error');
      return;
    }

    const sessionDate = sTime.toISOString().slice(0, 10);

    createSession.mutate(
      {
        date: sessionDate,
        startTime: sTime.toISOString(),
        endTime: eTime.toISOString(),
        notes: notes.trim() || undefined,
        breaks: breaks.map((b) => {
          const bs = new Date(date);
          bs.setHours(b.startTime.getHours(), b.startTime.getMinutes(), 0, 0);
          const be = new Date(date);
          be.setHours(b.endTime.getHours(), b.endTime.getMinutes(), 0, 0);
          return { startTime: bs.toISOString(), endTime: be.toISOString() };
        }),
      },
      {
        onSuccess: () => {
          showToast('הרשומה נשמרה בהצלחה!');
          router.back();
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error ? err.message : 'שגיאה בשמירה, נסו שוב';
          showToast(msg, 'error');
        },
      }
    );
  }, [isValid, date, startTime, endTime, breaks, notes, createSession, showToast, router]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
      testID="add-edit-session-screen"
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#F1F5F9',
          backgroundColor: '#FFFFFF',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          testID="close-add-session"
          style={{ padding: 4 }}
        >
          <X size={22} color="#64748B" />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#0F172A' }}>
          {'הוספת משמרת'}
        </Text>
        {/* Right placeholder for centering */}
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 48, paddingTop: 16 }}
      >
        {/* Date & Time Card */}
        <Animated.View entering={FadeInDown.duration(350)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              paddingHorizontal: 20,
              paddingTop: 4,
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
                fontSize: 12,
                fontWeight: '600',
                color: '#94A3B8',
                textAlign: 'right',
                paddingTop: 14,
                paddingBottom: 2,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {'תאריך ושעות'}
            </Text>

            <FieldButton
              label={'תאריך'}
              value={fmtDate(date)}
              onPress={() => setPickerTarget('date')}
              testID="date-picker-button"
            />
            <FieldButton
              label={'שעת התחלה'}
              value={fmtTime(startTime)}
              onPress={() => setPickerTarget('startTime')}
              testID="start-time-button"
            />
            <FieldButton
              label={'שעת סיום'}
              value={fmtTime(endTime)}
              onPress={() => setPickerTarget('endTime')}
              testID="end-time-button"
            />

            {errors.time ? (
              <Text style={{ color: '#DC2626', fontSize: 12, textAlign: 'right', paddingBottom: 8, paddingTop: 4 }}>
                {errors.time}
              </Text>
            ) : null}
          </View>
        </Animated.View>

        {/* Breaks Card */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              paddingHorizontal: 20,
              paddingTop: 4,
              paddingBottom: 12,
              shadowColor: '#0B1020',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 10,
              elevation: 3,
            }}
          >
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 14,
                paddingBottom: 8,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {'הפסקות'}
              </Text>
              <Pressable
                onPress={addBreak}
                testID="add-break-button"
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: '#EFF6FF',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Plus size={14} color="#2563EB" />
                <Text style={{ color: '#2563EB', fontWeight: '600', fontSize: 13 }}>{'הוסף'}</Text>
              </Pressable>
            </View>

            {breaks.length === 0 ? (
              <Text style={{ color: '#CBD5E1', fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                {'אין הפסקות'}
              </Text>
            ) : (
              breaks.map((b, idx) => (
                <View
                  key={b.id}
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: idx < breaks.length - 1 ? 1 : 0,
                    borderBottomColor: '#F1F5F9',
                  }}
                >
                  {/* Time selectors */}
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                    <Pressable
                      onPress={() => setPickerTarget(`break-start-${idx}`)}
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                      testID={`break-start-${idx}`}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A', fontVariant: ['tabular-nums'] }}>
                        {fmtTime(b.startTime)}
                      </Text>
                    </Pressable>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>{'\u2013'}</Text>
                    <Pressable
                      onPress={() => setPickerTarget(`break-end-${idx}`)}
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                      testID={`break-end-${idx}`}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A', fontVariant: ['tabular-nums'] }}>
                        {fmtTime(b.endTime)}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Duration label + delete */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 12, color: '#94A3B8', fontVariant: ['tabular-nums'] }}>
                      {`${Math.round(Math.max(0, (b.endTime.getTime() - b.startTime.getTime()) / 60000))} דק'`}
                    </Text>
                    <Pressable
                      onPress={() => removeBreak(b.id)}
                      testID={`remove-break-${idx}`}
                      style={{ padding: 4 }}
                    >
                      <Trash2 size={16} color="#DC2626" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        </Animated.View>

        {/* Notes Card */}
        <Animated.View entering={FadeInDown.delay(160).duration(350)} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 20,
              shadowColor: '#0B1020',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 10,
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12, textAlign: 'right' }}>
              {'הערות'}
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={'הוסיפו הערות...'}
              placeholderTextColor="#CBD5E1"
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 12,
                padding: 14,
                fontSize: 15,
                color: '#0F172A',
                textAlign: 'right',
                minHeight: 80,
                textAlignVertical: 'top',
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
              testID="notes-input"
            />
          </View>
        </Animated.View>

        {/* Live Calculation Preview */}
        <Animated.View entering={FadeInUp.delay(240).duration(350)} style={{ marginHorizontal: 16, marginBottom: 24 }}>
          <View
            style={{
              backgroundColor: isValid ? '#EFF6FF' : '#F8FAFC',
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: isValid ? '#BFDBFE' : '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14, textAlign: 'right' }}>
              {'סיכום'}
            </Text>

            <CalcRow
              label={'שעות ברוטו'}
              value={isValid ? `${(calculations.grossMinutes / 60).toFixed(2)}h` : '--'}
              color="#0F172A"
            />
            <CalcRow
              label={'הפסקות'}
              value={isValid ? `${(calculations.breakMinutes / 60).toFixed(2)}h` : '--'}
              color="#D97706"
            />
            <CalcRow
              label={'שעות נטו'}
              value={isValid ? `${calculations.netHours.toFixed(2)}h` : '--'}
              color="#059669"
            />

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: isValid ? '#BFDBFE' : '#E2E8F0', marginVertical: 12 }} />

            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>{'שכר'}</Text>
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '800',
                  color: isValid ? '#2563EB' : '#CBD5E1',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {isValid ? formatCurrency(calculations.totalPay, currency) : formatCurrency(0, currency)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Save Button */}
        <View style={{ marginHorizontal: 16 }}>
          <Pressable
            onPress={handleSave}
            disabled={createSession.isPending || !isValid}
            testID="save-session-button"
            style={{
              backgroundColor: isValid ? '#2563EB' : '#94A3B8',
              borderRadius: 18,
              height: 56,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: createSession.isPending ? 0.7 : 1,
              shadowColor: isValid ? '#2563EB' : 'transparent',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 14,
              elevation: isValid ? 6 : 0,
            }}
          >
            {createSession.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>{'שמור'}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Time Picker ──────────────────────────────────────────────────────── */}

      {Platform.OS === 'ios' ? (
        pickerTarget === 'date' ? (
          /* iOS date: custom calendar grid */
          <CalendarPickerSheet
            visible={true}
            value={pickerValue}
            onConfirm={handleIOSConfirm}
            onCancel={() => setPickerTarget(null)}
          />
        ) : (
          /* iOS time: spinner bottom sheet */
          <IOSPickerSheet
            visible={pickerTarget !== null}
            label={pickerLabel}
            mode={pickerMode}
            value={pickerValue}
            onConfirm={handleIOSConfirm}
            onCancel={() => setPickerTarget(null)}
          />
        )
      ) : pickerTarget !== null ? (
        /* Android: native dialog, auto-closes */
        <DateTimePicker
          value={pickerValue}
          mode={pickerMode}
          display={pickerTarget === 'date' ? 'calendar' : 'default'}
          onChange={handleAndroidChange}
          testID="android-date-picker"
        />
      ) : null}
    </SafeAreaView>
  );
}

// ─── Calc Row ─────────────────────────────────────────────────────────────────

function CalcRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 14, color: '#64748B' }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}
