import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  ChevronRight,
  Smartphone,
  Monitor,
  Tablet,
  Trash2,
  CheckCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getActiveSessions, revokeSession, Session } from '@/lib/api/auth-api';
import { useToastStore } from '@/lib/state/toast-store';

const BG = '#080E1A';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT = '#60A5FA';
const ACCENT_GREEN = '#22C55E';
const ERROR_COLOR = '#F87171';

function formatLastSeen(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays === 1) return 'אתמול';
  return `לפני ${diffDays} ימים`;
}

function getPlatformIcon(platform: string | null) {
  if (!platform) return <Smartphone size={20} color={ACCENT} />;
  const p = platform.toLowerCase();
  if (p.includes('android') || p.includes('ios') || p.includes('mobile')) {
    return <Smartphone size={20} color={ACCENT} />;
  }
  if (p.includes('tablet') || p.includes('ipad')) {
    return <Tablet size={20} color={ACCENT} />;
  }
  return <Monitor size={20} color={ACCENT} />;
}

function getPlatformLabel(platform: string | null): string {
  if (!platform) return 'לא ידוע';
  const p = platform.toLowerCase();
  if (p.includes('ios')) return 'iOS';
  if (p.includes('android')) return 'Android';
  if (p.includes('web')) return 'דפדפן';
  return platform;
}

interface SessionRowProps {
  session: Session;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}

function SessionRow({ session, onRevoke, isRevoking }: SessionRowProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      style={{
        backgroundColor: BG_CARD,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: session.isCurrent ? 'rgba(96,165,250,0.25)' : BORDER,
        marginHorizontal: 16,
        marginBottom: 10,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
        {/* Platform icon */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: session.isCurrent ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.06)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {getPlatformIcon(session.platform)}
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY }}>
              {session.deviceName ?? 'מכשיר לא ידוע'}
            </Text>
            {session.isCurrent ? (
              <View
                style={{
                  backgroundColor: 'rgba(34,197,94,0.15)',
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <CheckCircle size={10} color={ACCENT_GREEN} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: ACCENT_GREEN }}>{'נוכחי'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right' }}>
            {getPlatformLabel(session.platform)} · {formatLastSeen(session.lastSeenAt)}
          </Text>
        </View>

        {/* Revoke button */}
        {!session.isCurrent ? (
          <Pressable
            testID={`revoke-session-${session.id}`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onRevoke(session.id);
            }}
            disabled={isRevoking}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: pressed ? 'rgba(248,113,113,0.2)' : 'rgba(248,113,113,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(248,113,113,0.2)',
            })}
          >
            {isRevoking ? (
              <ActivityIndicator color={ERROR_COLOR} size="small" />
            ) : (
              <Trash2 size={16} color={ERROR_COLOR} />
            )}
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function ActiveSessionsScreen() {
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const { data: sessions, isLoading, isError, refetch } = useQuery<Session[]>({
    queryKey: ['active-sessions'],
    queryFn: getActiveSessions,
  });

  const { mutate: doRevoke, isPending: isRevokePending, variables: revokeVariables } = useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-sessions'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('הסשן בוטל', 'success');
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'שגיאה בביטול הסשן';
      showToast(msg, 'error');
    },
  });

  const handleRevoke = useCallback((id: string) => {
    doRevoke(id);
  }, [doRevoke]);

  const currentSession = sessions?.find((s) => s.isCurrent);
  const otherSessions = sessions?.filter((s) => !s.isCurrent) ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['top']} testID="active-sessions-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'right' }}>
              {'סשנים פעילים'}
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_SECONDARY, textAlign: 'right', marginTop: 4 }}>
              {'כל ההתחברויות הפעילות שלך'}
            </Text>
          </View>
          <Pressable
            testID="back-button"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 15, color: ACCENT, fontWeight: '500' }}>{'חזרה'}</Text>
            <ChevronRight size={20} color={ACCENT} />
          </Pressable>
        </Animated.View>

        <View style={{ height: 16 }} />

        {isLoading ? (
          <View style={{ padding: 60, alignItems: 'center' }}>
            <ActivityIndicator color={ACCENT} size="large" testID="loading-indicator" />
          </View>
        ) : isError ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={{
              marginHorizontal: 16,
              backgroundColor: 'rgba(248,113,113,0.08)',
              borderRadius: 14,
              padding: 20,
              borderWidth: 1,
              borderColor: 'rgba(248,113,113,0.2)',
            }}
          >
            <Text style={{ color: ERROR_COLOR, textAlign: 'center', fontSize: 14 }}>
              {'שגיאה בטעינת הסשנים'}
            </Text>
            <Pressable onPress={() => refetch()} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600' }}>{'נסה שוב'}</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* Current session */}
            {currentSession ? (
              <>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: TEXT_SECONDARY,
                    textAlign: 'right',
                    paddingHorizontal: 20,
                    marginBottom: 10,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  {'הסשן הנוכחי'}
                </Text>
                <SessionRow
                  session={currentSession}
                  onRevoke={handleRevoke}
                  isRevoking={Boolean(isRevokePending && revokeVariables === currentSession.id)}
                />
              </>
            ) : null}

            {/* Other sessions */}
            {otherSessions.length > 0 ? (
              <>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: TEXT_SECONDARY,
                    textAlign: 'right',
                    paddingHorizontal: 20,
                    marginTop: 16,
                    marginBottom: 10,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  {`סשנים אחרים (${otherSessions.length})`}
                </Text>
                {otherSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onRevoke={handleRevoke}
                    isRevoking={Boolean(isRevokePending && revokeVariables === session.id)}
                  />
                ))}
              </>
            ) : null}

            {sessions && sessions.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center' }}>
                  {'אין סשנים פעילים'}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
