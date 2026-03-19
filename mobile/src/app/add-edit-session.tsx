import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X, Plus, Trash2 } from 'lucide-react-native';
import { useDeviceId } from '@/lib/state/device-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useCreateSession } from '@/lib/api/workclock-api';
import { useToastStore } from '@/lib/state/toast-store';
import { formatCurrency } from '@/lib/utils';

interface BreakEntry {
  startTime: Date;
  endTime: Date;
}

export default function AddEditSessionScreen() {
  const deviceId = useDeviceId();
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const hourlyRate = useSettingsStore((s) => s.hourlyRate);
  const currency = useSettingsStore((s) => s.currency);
  const createSession = useCreateSession(deviceId);

  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setHours(17, 0, 0, 0);
    return d;
  });
  const [breaks, setBreaks] = useState<BreakEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const calculations = useMemo(() => {
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();
    const grossMinutes = Math.max(0, (endMs - startMs) / 60000);

    let breakMinutes = 0;
    for (const b of breaks) {
      breakMinutes += Math.max(0, (b.endTime.getTime() - b.startTime.getTime()) / 60000);
    }

    const netMinutes = Math.max(0, grossMinutes - breakMinutes);
    const netHours = netMinutes / 60;
    const totalPay = netHours * hourlyRate;

    return { grossMinutes, breakMinutes, netMinutes, netHours, totalPay };
  }, [startTime, endTime, breaks, hourlyRate]);

  const addBreak = () => {
    const bStart = new Date(startTime);
    bStart.setHours(12, 0, 0, 0);
    const bEnd = new Date(startTime);
    bEnd.setHours(12, 30, 0, 0);
    setBreaks((prev) => [...prev, { startTime: bStart, endTime: bEnd }]);
  };

  const removeBreak = (idx: number) => {
    setBreaks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (endTime <= startTime) {
      showToast('\u05E9\u05E2\u05EA \u05E1\u05D9\u05D5\u05DD \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05D9\u05D5\u05EA \u05D0\u05D7\u05E8\u05D9 \u05E9\u05E2\u05EA \u05D4\u05EA\u05D7\u05DC\u05D4', 'error');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const sessionDate = date.toISOString().split('T')[0];
    const sTime = new Date(date);
    sTime.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    const eTime = new Date(date);
    eTime.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

    createSession.mutate(
      {
        date: sessionDate ?? date.toISOString(),
        startTime: sTime.toISOString(),
        endTime: eTime.toISOString(),
        notes: notes || undefined,
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
          showToast('\u05D4\u05DE\u05E9\u05DE\u05E8\u05EA \u05E0\u05D5\u05E6\u05E8\u05D4 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4!');
          router.back();
        },
        onError: () => showToast('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E9\u05DE\u05D9\u05E8\u05D4', 'error'),
      }
    );
  };

  const formatTimeDisplay = (d: Date) =>
    d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  const formatDateDisplay = (d: Date) =>
    d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8FAFC' }} testID="add-edit-session-screen">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable onPress={() => router.back()} testID="close-add-session">
          <X size={24} color="#0F172A" />
        </Pressable>
        <Text className="text-lg font-bold" style={{ color: '#0F172A' }}>{'\u05D4\u05D5\u05E1\u05E4\u05EA \u05DE\u05E9\u05DE\u05E8\u05EA'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Date & Time */}
        <Animated.View entering={FadeInDown.duration(400)} className="mx-4 mb-4">
          <View className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
            <Text className="text-base font-bold mb-4" style={{ color: '#0F172A', textAlign: 'right' }}>{'\u05EA\u05D0\u05E8\u05D9\u05DA \u05D5\u05E9\u05E2\u05D5\u05EA'}</Text>

            {/* Date */}
            <FormRow label={'\u05EA\u05D0\u05E8\u05D9\u05DA'}>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="rounded-xl px-4 py-2"
                style={{ backgroundColor: '#F1F5F9' }}
                testID="date-picker-button"
              >
                <Text className="text-base font-semibold" style={{ color: '#0F172A' }}>{formatDateDisplay(date)}</Text>
              </Pressable>
            </FormRow>
            {showDatePicker ? (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (d) setDate(d);
                }}
                testID="date-picker"
              />
            ) : null}

            {/* Start Time */}
            <FormRow label={'\u05E9\u05E2\u05EA \u05D4\u05EA\u05D7\u05DC\u05D4'}>
              <Pressable
                onPress={() => setShowStartPicker(true)}
                className="rounded-xl px-4 py-2"
                style={{ backgroundColor: '#F1F5F9' }}
                testID="start-time-button"
              >
                <Text className="text-base font-semibold" style={{ color: '#0F172A' }}>{formatTimeDisplay(startTime)}</Text>
              </Pressable>
            </FormRow>
            {showStartPicker ? (
              <DateTimePicker
                value={startTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  setShowStartPicker(Platform.OS === 'ios');
                  if (d) setStartTime(d);
                }}
                testID="start-time-picker"
              />
            ) : null}

            {/* End Time */}
            <FormRow label={'\u05E9\u05E2\u05EA \u05E1\u05D9\u05D5\u05DD'}>
              <Pressable
                onPress={() => setShowEndPicker(true)}
                className="rounded-xl px-4 py-2"
                style={{ backgroundColor: '#F1F5F9' }}
                testID="end-time-button"
              >
                <Text className="text-base font-semibold" style={{ color: '#0F172A' }}>{formatTimeDisplay(endTime)}</Text>
              </Pressable>
            </FormRow>
            {showEndPicker ? (
              <DateTimePicker
                value={endTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  setShowEndPicker(Platform.OS === 'ios');
                  if (d) setEndTime(d);
                }}
                testID="end-time-picker"
              />
            ) : null}
          </View>
        </Animated.View>

        {/* Breaks */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mx-4 mb-4">
          <View className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
            <View className="flex-row-reverse items-center justify-between mb-3">
              <Text className="text-base font-bold" style={{ color: '#0F172A' }}>{'\u05D4\u05E4\u05E1\u05E7\u05D5\u05EA'}</Text>
              <Pressable
                onPress={addBreak}
                className="flex-row-reverse items-center gap-1 px-3 py-1.5 rounded-xl"
                style={{ backgroundColor: '#EFF6FF' }}
                testID="add-break-button"
              >
                <Plus size={16} color="#2563EB" />
                <Text className="text-sm font-semibold" style={{ color: '#2563EB' }}>{'\u05D4\u05D5\u05E1\u05E3'}</Text>
              </Pressable>
            </View>
            {breaks.length === 0 ? (
              <Text className="text-sm py-4 text-center" style={{ color: '#94A3B8' }}>{'\u05D0\u05D9\u05DF \u05D4\u05E4\u05E1\u05E7\u05D5\u05EA'}</Text>
            ) : (
              breaks.map((b, idx) => (
                <BreakRow
                  key={idx}
                  breakEntry={b}
                  onUpdate={(updated) => setBreaks((prev) => prev.map((item, i) => (i === idx ? updated : item)))}
                  onRemove={() => removeBreak(idx)}
                  index={idx}
                />
              ))
            )}
          </View>
        </Animated.View>

        {/* Notes */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mx-4 mb-4">
          <View className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
            <Text className="text-base font-bold mb-3" style={{ color: '#0F172A', textAlign: 'right' }}>{'\u05D4\u05E2\u05E8\u05D5\u05EA'}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={'\u05D4\u05D5\u05E1\u05D9\u05E4\u05D5 \u05D4\u05E2\u05E8\u05D5\u05EA...'}
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              className="rounded-xl p-4 text-base"
              style={{ backgroundColor: '#F1F5F9', color: '#0F172A', textAlign: 'right', minHeight: 80, textAlignVertical: 'top' }}
              testID="notes-input"
            />
          </View>
        </Animated.View>

        {/* Calculation Preview */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mx-4 mb-6">
          <View className="rounded-2xl p-5" style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE' }}>
            <Text className="text-base font-bold mb-3" style={{ color: '#0F172A', textAlign: 'right' }}>{'\u05E1\u05D9\u05DB\u05D5\u05DD'}</Text>
            <View className="flex-row-reverse justify-between mb-2">
              <Text className="text-sm" style={{ color: '#64748B' }}>{'\u05E9\u05E2\u05D5\u05EA \u05D1\u05E8\u05D5\u05D8\u05D5'}</Text>
              <Text className="text-sm font-bold" style={{ color: '#0F172A', fontVariant: ['tabular-nums'] }}>{(calculations.grossMinutes / 60).toFixed(1)}h</Text>
            </View>
            <View className="flex-row-reverse justify-between mb-2">
              <Text className="text-sm" style={{ color: '#64748B' }}>{'\u05D4\u05E4\u05E1\u05E7\u05D5\u05EA'}</Text>
              <Text className="text-sm font-bold" style={{ color: '#D97706', fontVariant: ['tabular-nums'] }}>{(calculations.breakMinutes / 60).toFixed(1)}h</Text>
            </View>
            <View className="flex-row-reverse justify-between mb-2">
              <Text className="text-sm" style={{ color: '#64748B' }}>{'\u05E9\u05E2\u05D5\u05EA \u05E0\u05D8\u05D5'}</Text>
              <Text className="text-sm font-bold" style={{ color: '#059669', fontVariant: ['tabular-nums'] }}>{calculations.netHours.toFixed(1)}h</Text>
            </View>
            <View className="flex-row-reverse justify-between pt-2" style={{ borderTopWidth: 1, borderTopColor: '#BFDBFE' }}>
              <Text className="text-base font-bold" style={{ color: '#0F172A' }}>{'\u05E9\u05DB\u05E8'}</Text>
              <Text className="text-xl font-bold" style={{ color: '#2563EB', fontVariant: ['tabular-nums'] }}>{formatCurrency(calculations.totalPay, currency)}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Save Button */}
        <View className="mx-4">
          <Pressable
            onPress={handleSave}
            disabled={createSession.isPending}
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: '#2563EB', opacity: createSession.isPending ? 0.6 : 1 }}
            testID="save-session-button"
          >
            {createSession.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text className="text-white font-bold text-lg">{'\u05E9\u05DE\u05D5\u05E8'}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between py-3" style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
      {children}
      <Text className="text-sm font-medium" style={{ color: '#374151', textAlign: 'right' }}>{label}</Text>
    </View>
  );
}

function BreakRow({
  breakEntry,
  onUpdate,
  onRemove,
  index,
}: {
  breakEntry: BreakEntry;
  onUpdate: (b: BreakEntry) => void;
  onRemove: () => void;
  index: number;
}) {
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const formatT = (d: Date) =>
    d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  return (
    <View className="flex-row items-center justify-between py-2" style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
      <Pressable onPress={onRemove} testID={`remove-break-${index}`}>
        <Trash2 size={18} color="#DC2626" />
      </Pressable>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => setShowEnd(true)}
          className="rounded-lg px-3 py-1.5"
          style={{ backgroundColor: '#F1F5F9' }}
        >
          <Text className="text-sm font-semibold" style={{ color: '#0F172A' }}>{formatT(breakEntry.endTime)}</Text>
        </Pressable>
        <Text className="text-sm" style={{ color: '#94A3B8' }}>-</Text>
        <Pressable
          onPress={() => setShowStart(true)}
          className="rounded-lg px-3 py-1.5"
          style={{ backgroundColor: '#F1F5F9' }}
        >
          <Text className="text-sm font-semibold" style={{ color: '#0F172A' }}>{formatT(breakEntry.startTime)}</Text>
        </Pressable>
      </View>
      {showStart ? (
        <DateTimePicker
          value={breakEntry.startTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowStart(Platform.OS === 'ios');
            if (d) onUpdate({ ...breakEntry, startTime: d });
          }}
        />
      ) : null}
      {showEnd ? (
        <DateTimePicker
          value={breakEntry.endTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowEnd(Platform.OS === 'ios');
            if (d) onUpdate({ ...breakEntry, endTime: d });
          }}
        />
      ) : null}
    </View>
  );
}
