import React, { useState, useMemo } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, Modal,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X, Heart, Sun, Clock, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useCreateDayRecord } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';

const BG_DEEP = '#080E1A';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT_BLUE = '#3B82F6';
const COLOR_RED = '#F87171';
const COLOR_AMBER = '#FBBF24';

type SessionType = 'shift' | 'sick' | 'vacation';

const HEBREW_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const HEBREW_DAYS_SHORT = ['א','ב','ג','ד','ה','ו','ש'];

export default function AddDayRecordScreen() {
  const router = useRouter();
  const { month } = useLocalSearchParams<{ month: string }>();
  const deviceId = useDeviceId();
  const showToast = useToastStore((s) => s.showToast);
  const createDayRecord = useCreateDayRecord(deviceId);

  const [sessionType, setSessionType] = useState<SessionType>('shift');

  // Initialize date to today or first day of specified month
  const initialDate = useMemo(() => {
    const today = new Date();
    if (month) {
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      if (todayKey === month) return today;
      const [y, m] = month.split('-').map(Number);
      return new Date(y!, m!, 0);
    }
    return today;
  }, [month]);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(initialDate);

  // Shift time state — refs mirror state so handleSubmit always reads latest value
  // even if TextInput onBlur fires concurrently with the submit press
  const startHRef = React.useRef(9);
  const startMRef = React.useRef(0);
  const endHRef   = React.useRef(17);
  const endMRef   = React.useRef(0);

  const [startHour, _setStartHour] = useState(9);
  const [startMin,  _setStartMin]  = useState(0);
  const [endHour,   _setEndHour]   = useState(17);
  const [endMin,    _setEndMin]    = useState(0);

  const setStartHour = (v: number) => { startHRef.current = v; _setStartHour(v); };
  const setStartMin  = (v: number) => { startMRef.current = v; _setStartMin(v); };
  const setEndHour   = (v: number) => { endHRef.current   = v; _setEndHour(v); };
  const setEndMin    = (v: number) => { endMRef.current   = v; _setEndMin(v); };

  const [notes, setNotes] = useState('');

  const dateLabel = selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Local date string (no UTC offset shift)
  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleSubmit = () => {
    const dateStr = toLocalDate(selectedDate);

    if (sessionType === 'shift') {
      // Read from refs — guaranteed latest even if state update is still pending
      const start = new Date(selectedDate);
      start.setHours(startHRef.current, startMRef.current, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(endHRef.current, endMRef.current, 0, 0);

      if (end <= start) {
        Alert.alert('שגיאה', 'שעת סיום חייבת להיות אחרי שעת התחלה');
        return;
      }

      createDayRecord.mutate(
        { date: dateStr, sessionType: 'shift', startTime: start.toISOString(), endTime: end.toISOString(), notes },
        {
          onSuccess: () => { showToast('המשמרת נוספה'); router.back(); },
          onError: () => showToast('שגיאה בשמירה', 'error'),
        }
      );
    } else {
      createDayRecord.mutate(
        { date: dateStr, sessionType, notes },
        {
          onSuccess: () => {
            showToast(sessionType === 'sick' ? 'יום מחלה נרשם' : 'יום חופשה נרשם');
            router.back();
          },
          onError: () => showToast('שגיאה בשמירה', 'error'),
        }
      );
    }
  };

  // Build calendar days for calendarMonth
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const mon = calendarMonth.getMonth();
    const firstDay = new Date(year, mon, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, mon + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return { cells, year, mon };
  }, [calendarMonth]);

  const typeColor = sessionType === 'sick' ? COLOR_RED : sessionType === 'vacation' ? COLOR_AMBER : ACCENT_BLUE;

  return (
    <View style={{ flex: 1, backgroundColor: BG_DEEP }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY }}>הוסף רישום יומי</Text>
          <Pressable onPress={() => router.back()} hitSlop={8} testID="close-button">
            <X size={22} color={TEXT_SECONDARY} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {/* Type Selector */}
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10, fontWeight: '600', letterSpacing: 0.3 }}>סוג הרישום</Text>
          <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 24 }}>
            {([['shift', 'משמרת', ACCENT_BLUE], ['sick', 'יום מחלה', COLOR_RED], ['vacation', 'יום חופשה', COLOR_AMBER]] as [SessionType, string, string][]).map(([type, label, color]) => (
              <Pressable
                key={type}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSessionType(type); }}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center',
                  backgroundColor: sessionType === type ? `${color}22` : BG_CARD,
                  borderWidth: 1.5, borderColor: sessionType === type ? color : BORDER,
                }}
                testID={`type-${type}`}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: sessionType === type ? color : TEXT_SECONDARY }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Date Picker */}
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10, fontWeight: '600', letterSpacing: 0.3 }}>תאריך</Text>
          <Pressable
            onPress={() => setShowCalendar(true)}
            style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}
            testID="date-picker-button"
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY }}>{dateLabel}</Text>
            <Clock size={16} color={TEXT_SECONDARY} />
          </Pressable>

          {/* Shift Times */}
          {sessionType === 'shift' && (
            <>
              <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10, fontWeight: '600', letterSpacing: 0.3 }}>שעות עבודה</Text>
              <View style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 24, gap: 16 }}>
                <TimeRow label="שעת התחלה" hour={startHour} min={startMin} onHourChange={setStartHour} onMinChange={setStartMin} color={ACCENT_BLUE} />
                <View style={{ height: 1, backgroundColor: BORDER }} />
                <TimeRow label="שעת סיום" hour={endHour} min={endMin} onHourChange={setEndHour} onMinChange={setEndMin} color={ACCENT_BLUE} />
              </View>
            </>
          )}

          {/* Notes */}
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10, fontWeight: '600', letterSpacing: 0.3 }}>הערות (אופציונלי)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="הוסף הערה..."
            placeholderTextColor={TEXT_SECONDARY}
            multiline
            style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, color: TEXT_PRIMARY, fontSize: 15, textAlign: 'right', minHeight: 80, textAlignVertical: 'top', marginBottom: 32 }}
            testID="notes-input"
          />
        </ScrollView>

        {/* Submit Button */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          <Pressable
            onPress={handleSubmit}
            disabled={createDayRecord.isPending}
            style={{ backgroundColor: typeColor, borderRadius: 18, padding: 18, alignItems: 'center' }}
            testID="submit-button"
          >
            {createDayRecord.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>שמור</Text>
            }
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowCalendar(false)}>
          <Pressable style={{ backgroundColor: BG_CARD, borderRadius: 24, padding: 20, width: 320, borderWidth: 1, borderColor: BORDER }} onPress={() => {}}>
            {/* Calendar header */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Pressable onPress={() => { const d = new Date(calendarMonth); d.setMonth(d.getMonth() + 1); setCalendarMonth(d); }}>
                <ChevronLeft size={20} color={TEXT_PRIMARY} />
              </Pressable>
              <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY }}>
                {HEBREW_MONTHS[calendarDays.mon]} {calendarDays.year}
              </Text>
              <Pressable onPress={() => { const d = new Date(calendarMonth); d.setMonth(d.getMonth() - 1); setCalendarMonth(d); }}>
                <ChevronRight size={20} color={TEXT_PRIMARY} />
              </Pressable>
            </View>
            {/* Day headers */}
            <View style={{ flexDirection: 'row-reverse', marginBottom: 8 }}>
              {HEBREW_DAYS_SHORT.map((d) => (
                <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' }}>{d}</Text>
              ))}
            </View>
            {/* Calendar grid */}
            {Array.from({ length: Math.ceil(calendarDays.cells.length / 7) }, (_, row) => (
              <View key={row} style={{ flexDirection: 'row-reverse', marginBottom: 4 }}>
                {calendarDays.cells.slice(row * 7, row * 7 + 7).concat(Array(7 - Math.min(7, calendarDays.cells.length - row * 7)).fill(null) as null[]).slice(0, 7).map((day, col) => {
                  if (!day) return <View key={col} style={{ flex: 1 }} />;
                  const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === calendarDays.mon && selectedDate.getFullYear() === calendarDays.year;
                  return (
                    <Pressable key={col} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: isSelected ? typeColor : 'transparent' }}
                      onPress={() => {
                        setSelectedDate(new Date(calendarDays.year, calendarDays.mon, day));
                        setShowCalendar(false);
                      }}>
                      <Text style={{ fontSize: 14, color: isSelected ? '#fff' : TEXT_PRIMARY, fontWeight: isSelected ? '700' : '400' }}>{day}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function TimeField({ value, maxVal, step, onChange, color }: {
  value: number; maxVal: number; step: number;
  onChange: (v: number) => void; color: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(String(value).padStart(2, '0'));
  const latestText = React.useRef(String(value).padStart(2, '0'));

  React.useEffect(() => {
    if (!focused) {
      const s = String(value).padStart(2, '0');
      setText(s);
      latestText.current = s;
    }
  }, [value, focused]);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      const clamped = Math.min(Math.max(0, n), maxVal);
      onChange(clamped);
      const s = String(clamped).padStart(2, '0');
      setText(s);
      latestText.current = s;
    } else {
      const s = String(value).padStart(2, '0');
      setText(s);
      latestText.current = s;
    }
  };

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Pressable onPress={() => onChange((value + step) % (maxVal + 1))} hitSlop={10}
        style={{ padding: 4 }}>
        <ChevronLeft size={16} color={color} style={{ transform: [{ rotate: '90deg' }] }} />
      </Pressable>
      <TextInput
        value={focused ? text : String(value).padStart(2, '0')}
        onChangeText={(t) => { setText(t); latestText.current = t; }}
        onFocus={() => { setFocused(true); setText(''); latestText.current = ''; }}
        onBlur={() => { setFocused(false); commit(latestText.current); }}
        onSubmitEditing={() => commit(latestText.current)}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        style={{
          fontSize: 24, fontWeight: '700', color: focused ? color : TEXT_PRIMARY,
          fontVariant: ['tabular-nums'], width: 40, textAlign: 'center',
          borderBottomWidth: focused ? 2 : 0, borderBottomColor: color,
          paddingVertical: 2,
        }}
        testID={`time-field-${maxVal}`}
      />
      <Pressable onPress={() => onChange((value - step + maxVal + 1) % (maxVal + 1))} hitSlop={10}
        style={{ padding: 4 }}>
        <ChevronRight size={16} color={color} style={{ transform: [{ rotate: '90deg' }] }} />
      </Pressable>
    </View>
  );
}

function TimeRow({ label, hour, min, onHourChange, onMinChange, color }: {
  label: string; hour: number; min: number;
  onHourChange: (h: number) => void; onMinChange: (m: number) => void; color: string;
}) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 14, color: TEXT_SECONDARY, flex: 1, textAlign: 'right' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TimeField value={hour} maxVal={23} step={1} onChange={onHourChange} color={color} />
        <Text style={{ fontSize: 24, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 2 }}>:</Text>
        <TimeField value={min} maxVal={59} step={5} onChange={onMinChange} color={color} />
      </View>
    </View>
  );
}
