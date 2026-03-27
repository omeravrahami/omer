import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Settings2, Check, Edit3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConfig, updateConfig, AdminConfig } from '@/lib/api/admin-api';
import { useToastStore } from '@/lib/state/toast-store';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function ConfigRow({
  config,
  onSave,
  isSaving,
}: {
  config: AdminConfig;
  onSave: (key: string, value: string) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>(config.value);
  const inputRef = useRef<TextInput>(null);

  const handleEdit = () => {
    setDraft(config.value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 100);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = () => {
    if (draft.trim() !== config.value) {
      onSave(config.key, draft.trim());
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(config.value);
    setEditing(false);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      style={{
        backgroundColor: BG_CARD,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: editing ? 'rgba(96,165,250,0.4)' : BORDER,
        marginBottom: 10,
      }}
    >
      {/* Key + edit button */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: ACCENT, fontFamily: 'monospace' }}>
          {config.key}
        </Text>
        {!editing ? (
          <Pressable
            testID={`config-edit-${config.key}`}
            onPress={handleEdit}
            style={{ padding: 6 }}
          >
            <Edit3 size={16} color={TEXT_SECONDARY} />
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              testID={`config-cancel-${config.key}`}
              onPress={handleCancel}
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY }}>{'ביטול'}</Text>
            </Pressable>
            <Pressable
              testID={`config-save-${config.key}`}
              onPress={handleSave}
              disabled={isSaving}
              style={{
                backgroundColor: ACCENT,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Check size={14} color="#fff" />
              }
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{'שמור'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Description */}
      {config.description !== null ? (
        <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 8 }}>
          {config.description}
        </Text>
      ) : null}

      {/* Value */}
      {editing ? (
        <TextInput
          ref={inputRef}
          testID={`config-input-${config.key}`}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleSave}
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: BG_INPUT,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 14,
            color: TEXT_PRIMARY,
            textAlign: 'right',
            borderWidth: 1,
            borderColor: 'rgba(96,165,250,0.3)',
          }}
        />
      ) : (
        <View
          style={{
            backgroundColor: BG_INPUT,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ fontSize: 14, color: TEXT_PRIMARY, textAlign: 'right' }}>
            {config.value}
          </Text>
        </View>
      )}

      {/* Updated at */}
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'left', marginTop: 8 }}>
        {`עודכן: ${formatDate(config.updatedAt)}`}
      </Text>
    </Animated.View>
  );
}

export default function AdminConfigScreen() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<{ configs: AdminConfig[] }>({
    queryKey: ['admin', 'config'],
    queryFn: getConfig,
  });

  const updateMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      updateConfig(key, value),
    onMutate: ({ key }) => setSavingKey(key),
    onSuccess: (updated) => {
      setSavingKey(null);
      // Update the cached config
      queryClient.setQueryData<{ configs: AdminConfig[] }>(['admin', 'config'], (old) => {
        if (!old) return old;
        return {
          configs: old.configs.map((c) =>
            c.key === updated.key ? updated : c
          ),
        };
      });
      showToast('ההגדרה נשמרה', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: Error) => {
      setSavingKey(null);
      showToast(e.message ?? 'שגיאה בשמירה', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleSave = (key: string, value: string) => {
    updateMut.mutate({ key, value });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="admin-config-screen">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refetch(); }}
            tintColor={ACCENT}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: 'rgba(167,139,250,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings2 size={20} color="#A78BFA" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY }}>
              {'הגדרות מערכת'}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right' }}>
            {'ניהול פרמטרים והגדרות של האפליקציה'}
          </Text>
        </Animated.View>

        {isLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={ACCENT} size="large" testID="loading-indicator" />
          </View>
        ) : isError ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={{
              backgroundColor: 'rgba(248,113,113,0.08)',
              borderRadius: 14,
              padding: 20,
              borderWidth: 1,
              borderColor: 'rgba(248,113,113,0.2)',
            }}
          >
            <Text style={{ color: '#F87171', textAlign: 'center', fontSize: 14 }}>
              {'שגיאה בטעינת ההגדרות'}
            </Text>
            <Pressable onPress={() => refetch()} style={{ marginTop: 12, alignItems: 'center' }} testID="retry-button">
              <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600' }}>{'נסה שוב'}</Text>
            </Pressable>
          </Animated.View>
        ) : data && data.configs.length > 0 ? (
          data.configs.map((config, index) => (
            <Animated.View key={config.key} entering={FadeInDown.delay(index * 60).duration(350)}>
              <ConfigRow
                config={config}
                onSave={handleSave}
                isSaving={savingKey === config.key}
              />
            </Animated.View>
          ))
        ) : (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: TEXT_SECONDARY }}>{'אין הגדרות מערכת'}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
