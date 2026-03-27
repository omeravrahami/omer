import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getAdminAuditLogs, AuditLogEntry, AuditLogsResult } from '@/lib/api/admin-api';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';

function getActionColor(action: string): string {
  const a = action.toUpperCase();
  if (a.includes('DELETE') || a.includes('SUSPEND') || a.includes('DISABLE') || a.includes('BLOCK')) return '#F87171';
  if (a.includes('CREATE') || a.includes('REGISTER') || a.includes('ADD')) return '#34D399';
  if (a.includes('LOGIN') || a.includes('AUTH') || a.includes('TOKEN')) return '#60A5FA';
  if (a.includes('UPDATE') || a.includes('EDIT') || a.includes('CHANGE')) return '#FBBF24';
  if (a.includes('ADMIN') || a.includes('RESET') || a.includes('OVERRIDE')) return '#F472B6';
  return '#94A3B8';
}

function ActionBadge({ action }: { action: string }) {
  const color = getActionColor(action);
  return (
    <View
      style={{
        backgroundColor: `${color}18`,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: `${color}40`,
        alignSelf: 'flex-end',
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color, letterSpacing: 0.3 }}>
        {action}
      </Text>
    </View>
  );
}

function truncateUserId(userId: string | null): string {
  if (!userId) return '—';
  if (userId.length <= 12) return userId;
  return `${userId.slice(0, 6)}...${userId.slice(-4)}`;
}

function formatTimestamp(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return dateStr;
  }
}

function AuditLogItem({ item, index }: { item: AuditLogEntry; index: number }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index < 10 ? index * 40 : 0).duration(300)}
      style={{
        backgroundColor: BG_CARD,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: BORDER,
        marginBottom: 8,
      }}
    >
      {/* Top row: action badge + timestamp */}
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <ActionBadge action={item.action} />
        <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
          {formatTimestamp(item.createdAt)}
        </Text>
      </View>

      {/* Resource */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 4, gap: 6 }}>
        <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'משאב:'}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right', flex: 1 }}>
          {item.resource || '—'}
        </Text>
      </View>

      {/* Bottom row: userId + IP */}
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'משתמש:'}</Text>
          <Text style={{ fontSize: 11, color: '#94A3B8', fontVariant: ['tabular-nums'] }}>
            {truncateUserId(item.userId)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>{'IP:'}</Text>
          <Text style={{ fontSize: 11, color: '#94A3B8', fontVariant: ['tabular-nums'] }}>
            {item.ipAddress ?? '—'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function AuditLogsScreen() {
  const [page, setPage] = useState<number>(1);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<AuditLogsResult>({
    queryKey: ['admin', 'audit-logs', page],
    queryFn: () => getAdminAuditLogs(page),
    placeholderData: keepPreviousData,
  });

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPage(1);
    refetch();
  }, [refetch]);

  const logs = data?.logs ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="audit-logs-screen">
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <AuditLogItem item={item} index={index} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
          />
        }
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(400)} style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right', marginBottom: 4 }}>
              {'לוג ביקורת'}
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right' }}>
              {'פעולות מערכת ואירועי אבטחה'}
            </Text>
            {data !== undefined ? (
              <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
                {`סה״כ ${data.total} רשומות`}
              </Text>
            ) : null}
          </Animated.View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ padding: 60, alignItems: 'center' }}>
              <ActivityIndicator color={ACCENT} size="large" testID="loading-indicator" />
            </View>
          ) : isError ? (
            <View
              style={{
                backgroundColor: 'rgba(248,113,113,0.08)',
                borderRadius: 14,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(248,113,113,0.2)',
              }}
            >
              <Text style={{ color: '#F87171', textAlign: 'center', fontSize: 14 }}>
                {'שגיאה בטעינת לוג הביקורת'}
              </Text>
              <Pressable onPress={() => refetch()} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600' }}>{'נסה שוב'}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: TEXT_SECONDARY, fontSize: 14 }}>{'אין רשומות ביקורת'}</Text>
            </View>
          )
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16 }}>
              <Pressable
                testID="prev-page-button"
                disabled={page <= 1}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPage((p) => Math.max(1, p - 1));
                }}
                style={({ pressed }) => ({
                  opacity: page <= 1 ? 0.3 : pressed ? 0.6 : 1,
                  backgroundColor: BG_CARD,
                  borderRadius: 10,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: BORDER,
                })}
              >
                <ChevronRight size={18} color={TEXT_PRIMARY} />
              </Pressable>

              <Text style={{ fontSize: 13, color: TEXT_SECONDARY, fontVariant: ['tabular-nums'] }}>
                {`עמוד ${page} / ${totalPages}`}
              </Text>

              <Pressable
                testID="next-page-button"
                disabled={page >= totalPages}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                style={({ pressed }) => ({
                  opacity: page >= totalPages ? 0.3 : pressed ? 0.6 : 1,
                  backgroundColor: BG_CARD,
                  borderRadius: 10,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: BORDER,
                })}
              >
                <ChevronLeft size={18} color={TEXT_PRIMARY} />
              </Pressable>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
