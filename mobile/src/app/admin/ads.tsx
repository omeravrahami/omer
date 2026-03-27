import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Tv, Save } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdsConfig, updateAdsConfig, AdsConfig } from '@/lib/api/admin-api';
import { useToastStore } from '@/lib/state/toast-store';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';

interface SwitchRowProps {
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  testId: string;
}

function SwitchRow({ label, value, onValueChange, testId }: SwitchRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
      }}
    >
      <Text style={{ fontSize: 14, color: TEXT_PRIMARY }}>{label}</Text>
      <Switch
        testID={testId}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(96,165,250,0.4)' }}
        thumbColor={value ? ACCENT : '#888'}
        ios_backgroundColor="rgba(255,255,255,0.1)"
      />
    </View>
  );
}

interface UnitIdRowProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  testId: string;
}

function UnitIdRow({ label, value, onChangeText, testId }: UnitIdRowProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        testID={testId}
        value={value}
        onChangeText={onChangeText}
        placeholder="השאר ריק לשימוש ב-Unit IDs של בדיקה"
        placeholderTextColor={TEXT_SECONDARY}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          backgroundColor: BG_INPUT,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: BORDER,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 13,
          color: TEXT_PRIMARY,
          textAlign: 'right',
        }}
      />
    </View>
  );
}

const DEFAULT_CONFIG: AdsConfig = {
  adsEnabled: false,
  testMode: true,
  bannerEnabled: false,
  interstitialEnabled: false,
  rewardedEnabled: false,
  bannerUnitId: '',
  interstitialUnitId: '',
  rewardedUnitId: '',
};

export default function AdsScreen() {
  const showToast = useToastStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const [localConfig, setLocalConfig] = useState<AdsConfig>(DEFAULT_CONFIG);

  const {
    data: serverConfig,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<AdsConfig>({
    queryKey: ['admin', 'ads-config'],
    queryFn: getAdsConfig,
  });

  useEffect(() => {
    if (serverConfig != null) {
      setLocalConfig(serverConfig);
    }
  }, [serverConfig]);

  const updateMut = useMutation({
    mutationFn: (body: Partial<AdsConfig>) => updateAdsConfig(body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'ads-config'], updated);
      showToast('הגדרות פרסומות עודכנו', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: Error) => {
      showToast(e.message ?? 'שגיאה בשמירה', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Revert local state on error
      if (serverConfig != null) setLocalConfig(serverConfig);
    },
  });

  function handleToggle(key: keyof AdsConfig, value: boolean) {
    const updated = { ...localConfig, [key]: value };
    setLocalConfig(updated);
    updateMut.mutate({ [key]: value });
  }

  function handleSaveUnitIds() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateMut.mutate({
      bannerUnitId: localConfig.bannerUnitId,
      interstitialUnitId: localConfig.interstitialUnitId,
      rewardedUnitId: localConfig.rewardedUnitId,
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="ads-screen">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              refetch();
            }}
            tintColor={ACCENT}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginBottom: 20, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(244,114,182,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Tv size={24} color="#F472B6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right' }}>
              {'ניהול פרסומות'}
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 2 }}>
              {'הגדרות פרסומות ו-Unit IDs'}
            </Text>
          </View>
        </Animated.View>

        {isLoading ? (
          <View style={{ padding: 60, alignItems: 'center' }}>
            <ActivityIndicator color={ACCENT} size="large" testID="loading-indicator" />
          </View>
        ) : isError ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={{
              backgroundColor: 'rgba(248,113,113,0.08)',
              borderRadius: 14,
              padding: 24,
              borderWidth: 1,
              borderColor: 'rgba(248,113,113,0.2)',
              alignItems: 'center',
            }}
            testID="error-view"
          >
            <Text style={{ color: '#F87171', fontSize: 14, marginBottom: 12 }}>{'שגיאה בטעינת ההגדרות'}</Text>
            <Pressable onPress={() => refetch()} testID="retry-button">
              <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600' }}>{'נסה שוב'}</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* Status badge */}
            <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ flexDirection: 'row-reverse', marginBottom: 20 }}>
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 6,
                backgroundColor: localConfig.adsEnabled ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: localConfig.adsEnabled ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)',
              }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: localConfig.adsEnabled ? '#34D399' : '#F87171' }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: localConfig.adsEnabled ? '#34D399' : '#F87171' }}>
                  {localConfig.adsEnabled ? 'פרסומות פעילות' : 'פרסומות כבויות'}
                </Text>
              </View>
            </Animated.View>

            {/* Main toggles */}
            <Animated.View
              entering={FadeInDown.delay(120).duration(400)}
              style={{
                backgroundColor: BG_CARD,
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingTop: 4,
                borderWidth: 1,
                borderColor: BORDER,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'right', paddingTop: 16, paddingBottom: 4, letterSpacing: 0.4 }}>
                {'הגדרות ראשיות'}
              </Text>
              <SwitchRow
                label="פרסומות מופעלות"
                value={localConfig.adsEnabled}
                onValueChange={(val) => handleToggle('adsEnabled', val)}
                testId="toggle-ads-enabled"
              />
              <SwitchRow
                label="מצב בדיקות"
                value={localConfig.testMode}
                onValueChange={(val) => handleToggle('testMode', val)}
                testId="toggle-test-mode"
              />
              <View style={{ height: 4 }} />
            </Animated.View>

            {/* Ad type toggles */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              style={{
                backgroundColor: BG_CARD,
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingTop: 4,
                borderWidth: 1,
                borderColor: BORDER,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'right', paddingTop: 16, paddingBottom: 4, letterSpacing: 0.4 }}>
                {'סוגי פרסומות'}
              </Text>
              <SwitchRow
                label="באנר"
                value={localConfig.bannerEnabled}
                onValueChange={(val) => handleToggle('bannerEnabled', val)}
                testId="toggle-banner"
              />
              <SwitchRow
                label="מלא מסך"
                value={localConfig.interstitialEnabled}
                onValueChange={(val) => handleToggle('interstitialEnabled', val)}
                testId="toggle-interstitial"
              />
              <SwitchRow
                label="תגמול"
                value={localConfig.rewardedEnabled}
                onValueChange={(val) => handleToggle('rewardedEnabled', val)}
                testId="toggle-rewarded"
              />
              <View style={{ height: 4 }} />
            </Animated.View>

            {/* Unit IDs */}
            <Animated.View
              entering={FadeInDown.delay(280).duration(400)}
              style={{
                backgroundColor: BG_CARD,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: BORDER,
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'right', marginBottom: 16, letterSpacing: 0.4 }}>
                {'Unit IDs'}
              </Text>
              <UnitIdRow
                label="באנר"
                value={localConfig.bannerUnitId}
                onChangeText={(text) => setLocalConfig((c) => ({ ...c, bannerUnitId: text }))}
                testId="input-banner-unit-id"
              />
              <UnitIdRow
                label="מלא מסך"
                value={localConfig.interstitialUnitId}
                onChangeText={(text) => setLocalConfig((c) => ({ ...c, interstitialUnitId: text }))}
                testId="input-interstitial-unit-id"
              />
              <UnitIdRow
                label="תגמול"
                value={localConfig.rewardedUnitId}
                onChangeText={(text) => setLocalConfig((c) => ({ ...c, rewardedUnitId: text }))}
                testId="input-rewarded-unit-id"
              />
              <Text style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
                {'השאר ריק לשימוש ב-Unit IDs של בדיקה'}
              </Text>
            </Animated.View>

            {/* Save button */}
            <Animated.View entering={FadeInDown.delay(360).duration(400)}>
              <Pressable
                testID="save-unit-ids-button"
                onPress={handleSaveUnitIds}
                disabled={updateMut.isPending}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? 'rgba(96,165,250,0.3)' : ACCENT,
                  borderRadius: 16,
                  paddingVertical: 16,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: updateMut.isPending ? 0.7 : 1,
                })}
              >
                {updateMut.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Save size={18} color="#fff" />
                )}
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{'שמור Unit IDs'}</Text>
              </Pressable>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
