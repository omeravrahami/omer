import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BookOpen, Plus, X, Calendar } from 'lucide-react-native';
import { useJournalStore, JournalEntry, Mood } from '@/lib/state/journal-store';

// ─── Dark theme ───────────────────────────────────────────────────────────────

const BG_DEEP = '#080E1A';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT_BLUE = '#3B82F6';

// ─── Constants ────────────────────────────────────────────────────────────────

const MOOD_CONFIG: { value: Mood; emoji: string; label: string }[] = [
  { value: 'great', emoji: '😄', label: 'מעולה' },
  { value: 'good',  emoji: '😊', label: 'טוב' },
  { value: 'okay',  emoji: '😐', label: 'סביר' },
  { value: 'bad',   emoji: '😔', label: 'קשה' },
];

const HEBREW_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];
const HEBREW_DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function formatHebrewDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = HEBREW_DAYS[d.getDay()];
  return `יום ${dayName}, ${day} ב${HEBREW_MONTHS[month - 1]}`;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthLabel(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number);
  return `${HEBREW_MONTHS[month - 1]} ${year}`;
}

// ─── Entry Card ───────────────────────────────────────────────────────────────

function EntryCard({
  entry, index, onPress, onLongPress,
}: {
  entry: JournalEntry;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const moodInfo = entry.mood ? MOOD_CONFIG.find((m) => m.value === entry.mood) : null;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        testID={`journal-entry-${entry.id}`}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#152030' : BG_CARD,
          borderRadius: 18,
          padding: 16,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: BORDER,
        })}
      >
        {/* Top row: date + mood */}
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: ACCENT_BLUE, textAlign: 'right' }}>
            {formatHebrewDate(entry.date)}
          </Text>
          {moodInfo ? (
            <View style={{
              backgroundColor: BG_INPUT,
              borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
              flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
              borderWidth: 1, borderColor: BORDER,
            }}>
              <Text style={{ fontSize: 16 }}>{moodInfo.emoji}</Text>
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY, fontWeight: '500' }}>{moodInfo.label}</Text>
            </View>
          ) : null}
        </View>
        {/* Content preview */}
        <Text numberOfLines={2} style={{ fontSize: 14, color: TEXT_SECONDARY, textAlign: 'right', lineHeight: 20 }}>
          {entry.content || '...'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

interface EntryModalProps {
  visible: boolean;
  editingEntry: JournalEntry | null;
  onClose: () => void;
  onSave: (date: string, content: string, mood: Mood | null) => void;
}

function EntryModal({ visible, editingEntry, onClose, onSave }: EntryModalProps) {
  const [date, setDate] = useState(editingEntry?.date ?? todayISO());
  const [content, setContent] = useState(editingEntry?.content ?? '');
  const [mood, setMood] = useState<Mood | null>(editingEntry?.mood ?? null);
  const [dateEditing, setDateEditing] = useState(false);
  const [rawDate, setRawDate] = useState(editingEntry?.date ?? todayISO());

  React.useEffect(() => {
    if (visible) {
      setDate(editingEntry?.date ?? todayISO());
      setContent(editingEntry?.content ?? '');
      setMood(editingEntry?.mood ?? null);
      setRawDate(editingEntry?.date ?? todayISO());
      setDateEditing(false);
    }
  }, [visible, editingEntry]);

  const handleSave = useCallback(() => {
    if (!content.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(date, content.trim(), mood);
  }, [date, content, mood, onSave]);

  const handleMoodSelect = useCallback((m: Mood) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMood((prev) => (prev === m ? null : m));
  }, []);

  const handleDateCommit = useCallback(() => {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
    if (valid) setDate(rawDate);
    else setRawDate(date);
    setDateEditing(false);
  }, [rawDate, date]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      testID="journal-modal"
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={{ flex: 1, backgroundColor: BG_DEEP }}>
          {/* Modal header */}
          <View style={{
            flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
            borderBottomWidth: 1, borderBottomColor: BORDER,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY }}>
              {editingEntry ? 'עריכת רשומה' : 'רשומה חדשה'}
            </Text>
            <Pressable
              onPress={onClose}
              testID="journal-modal-close"
              style={{ padding: 6, borderRadius: 20, backgroundColor: BG_INPUT, borderWidth: 1, borderColor: BORDER }}
            >
              <X size={18} color={TEXT_SECONDARY} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Date row */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                תאריך
              </Text>
              {dateEditing ? (
                <TextInput
                  value={rawDate}
                  onChangeText={setRawDate}
                  onBlur={handleDateCommit}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={TEXT_SECONDARY}
                  returnKeyType="done"
                  onSubmitEditing={handleDateCommit}
                  autoFocus
                  testID="journal-date-input"
                  style={{
                    backgroundColor: BG_INPUT, borderRadius: 14,
                    paddingHorizontal: 16, paddingVertical: 12,
                    fontSize: 15, color: TEXT_PRIMARY, textAlign: 'right',
                    borderWidth: 2, borderColor: ACCENT_BLUE,
                  }}
                />
              ) : (
                <Pressable
                  onPress={() => setDateEditing(true)}
                  testID="journal-date-picker"
                  style={{
                    backgroundColor: BG_INPUT, borderRadius: 14,
                    paddingHorizontal: 16, paddingVertical: 12,
                    flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
                    borderWidth: 1, borderColor: BORDER,
                  }}
                >
                  <Calendar size={16} color={ACCENT_BLUE} />
                  <Text style={{ fontSize: 15, color: TEXT_PRIMARY, fontWeight: '500' }}>
                    {formatHebrewDate(date)}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Mood selector */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                מצב רוח
              </Text>
              <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                {MOOD_CONFIG.map((m) => (
                  <Pressable
                    key={m.value}
                    onPress={() => handleMoodSelect(m.value)}
                    testID={`mood-${m.value}`}
                    style={{
                      flex: 1,
                      backgroundColor: mood === m.value ? 'rgba(59,130,246,0.15)' : BG_INPUT,
                      borderRadius: 14, paddingVertical: 12, alignItems: 'center',
                      borderWidth: 2,
                      borderColor: mood === m.value ? ACCENT_BLUE : BORDER,
                    }}
                  >
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{m.emoji}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: mood === m.value ? ACCENT_BLUE : TEXT_SECONDARY }}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Content input */}
            <View style={{ marginBottom: 28 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                פרטים
              </Text>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="מה עבר עליך היום?"
                placeholderTextColor={TEXT_SECONDARY}
                multiline
                numberOfLines={6}
                textAlign="right"
                testID="journal-content-input"
                style={{
                  backgroundColor: BG_INPUT, borderRadius: 16,
                  paddingHorizontal: 16, paddingVertical: 14,
                  fontSize: 15, color: TEXT_PRIMARY,
                  minHeight: 140, textAlignVertical: 'top',
                  borderWidth: 1, borderColor: BORDER,
                  lineHeight: 22,
                }}
              />
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
              <Pressable
                onPress={handleSave}
                testID="journal-save-button"
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? '#2563EB' : ACCENT_BLUE,
                  borderRadius: 16, paddingVertical: 16, alignItems: 'center',
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>שמור</Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                testID="journal-cancel-button"
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? '#1A2540' : BG_INPUT,
                  borderRadius: 16, paddingVertical: 16, alignItems: 'center',
                  borderWidth: 1, borderColor: BORDER,
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_SECONDARY }}>ביטול</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Animated.View
      entering={FadeInDown.duration(500)}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}
      testID="journal-empty-state"
    >
      <View style={{
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: 'rgba(59,130,246,0.1)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
      }}>
        <BookOpen size={36} color={ACCENT_BLUE} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center', marginBottom: 8 }}>
        עדיין אין רשומות ביומן
      </Text>
      <Text style={{ fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 20 }}>
        הוסף את הרשומה הראשונה שלך
      </Text>
    </Animated.View>
  );
}

// ─── FAB ──────────────────────────────────────────────────────────────────────

function FAB({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[animStyle, { position: 'absolute', bottom: 28, left: 20 }]}>
      <Pressable
        onPress={() => {
          scale.value = withSpring(0.88, {}, () => { scale.value = withSpring(1); });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        testID="journal-fab"
        style={{
          width: 58, height: 58, borderRadius: 29,
          backgroundColor: ACCENT_BLUE,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: ACCENT_BLUE,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
        }}
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function JournalScreen() {
  const entries = useJournalStore((s) => s.entries);
  const addEntry = useJournalStore((s) => s.addEntry);
  const updateEntry = useJournalStore((s) => s.updateEntry);
  const deleteEntry = useJournalStore((s) => s.deleteEntry);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, JournalEntry[]> = {};
    for (const e of entries) {
      const key = getMonthLabel(e.date);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map);
  }, [entries]);

  const openAdd = useCallback(() => {
    setEditingEntry(null);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((entry: JournalEntry) => {
    setEditingEntry(entry);
    setModalVisible(true);
  }, []);

  const handleDelete = useCallback((entry: JournalEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'מחיקת רשומה',
      `האם למחוק את הרשומה מ-${formatHebrewDate(entry.date)}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteEntry(entry.id);
          },
        },
      ]
    );
  }, [deleteEntry]);

  const handleSave = useCallback(
    (date: string, content: string, mood: Mood | null) => {
      if (editingEntry) {
        updateEntry(editingEntry.id, { date, content, mood });
      } else {
        addEntry({ date, content, mood });
      }
      setModalVisible(false);
    },
    [editingEntry, addEntry, updateEntry]
  );

  let cardIndex = 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_DEEP }} testID="journal-screen">
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' }}>
          יומן עבודה
        </Text>
      </Animated.View>

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          testID="journal-scroll"
        >
          {grouped.map(([month, monthEntries]) => (
            <View key={month} style={{ marginBottom: 8 }}>
              <Animated.View entering={FadeInDown.delay(40).duration(300)}>
                <Text style={{
                  fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY,
                  textAlign: 'right', textTransform: 'uppercase',
                  letterSpacing: 0.8, marginBottom: 10, marginTop: 4,
                }}>
                  {month}
                </Text>
              </Animated.View>
              {monthEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  index={cardIndex++}
                  onPress={() => openEdit(entry)}
                  onLongPress={() => handleDelete(entry)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <FAB onPress={openAdd} />

      <EntryModal
        visible={modalVisible}
        editingEntry={editingEntry}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}
