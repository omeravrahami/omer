import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Search, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { getUsers, AdminUser } from '@/lib/api/admin-api';

const BG = '#0B1020';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.45)';
const ACCENT = '#60A5FA';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#34D399',
  SUSPENDED: '#FBBF24',
  DISABLED: '#F87171',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'פעיל',
  SUSPENDED: 'מושהה',
  DISABLED: 'מושבת',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#FBBF24',
  USER: '#60A5FA',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'אדמין',
  USER: 'משתמש',
};

function getInitials(user: AdminUser): string {
  const name = user.username ?? user.email;
  return name.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function UserRow({ user, onPress }: { user: AdminUser; onPress: () => void }) {
  const initials = getInitials(user);
  const statusColor = STATUS_COLORS[user.status] ?? '#60A5FA';
  const roleColor = ROLE_COLORS[user.role] ?? '#60A5FA';
  const activeSessionCount = user.sessions?.length ?? 0;

  return (
    <Pressable
      testID={`user-row-${user.id}`}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? 'rgba(96,165,250,0.06)' : BG_CARD,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
      })}
    >
      {/* Avatar */}
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: `${roleColor}20`,
          borderWidth: 1.5,
          borderColor: `${roleColor}40`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: roleColor }}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY }} numberOfLines={1}>
            {user.username ?? user.email}
          </Text>
          {/* Role badge */}
          <View style={{
            backgroundColor: `${roleColor}18`,
            borderRadius: 6,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderWidth: 1,
            borderColor: `${roleColor}30`,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: roleColor }}>
              {ROLE_LABELS[user.role] ?? user.role}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: TEXT_SECONDARY }} numberOfLines={1}>{user.email}</Text>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {/* Status badge */}
          <View style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 4,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
            <Text style={{ fontSize: 11, color: statusColor }}>
              {STATUS_LABELS[user.status] ?? user.status}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{' • '}</Text>
          <Text style={{ fontSize: 11, color: TEXT_SECONDARY }}>
            {formatDate(user.createdAt)}
          </Text>
          {activeSessionCount > 0 ? (
            <>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{' • '}</Text>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#34D399' }} />
                <Text style={{ fontSize: 11, color: '#34D399', fontWeight: '600' }}>
                  {`${activeSessionCount} מכשיר${activeSessionCount !== 1 ? 'ים' : ''} פעיל${activeSessionCount !== 1 ? 'ים' : ''}`}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </View>

      <ChevronLeft size={16} color={TEXT_SECONDARY} />
    </Pressable>
  );
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [searchFocused, setSearchFocused] = useState<boolean>(false);

  const { isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: async () => {
      const result = await getUsers(page, 20, search);
      if (page === 1) {
        setAllUsers(result.users);
      } else {
        setAllUsers((prev) => [...prev, ...result.users]);
      }
      setHasMore(page < result.pages);
      return result;
    },
  });

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    setPage(1);
    setAllUsers([]);
    setHasMore(true);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isFetching && hasMore) {
      setPage((p) => p + 1);
    }
  }, [isFetching, hasMore]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPage(1);
    setAllUsers([]);
    setHasMore(true);
    refetch();
  }, [refetch]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['bottom']} testID="admin-users-screen">
      {/* Search bar */}
      <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View
          style={{
            backgroundColor: BG_INPUT,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: searchFocused ? 'rgba(96,165,250,0.5)' : BORDER,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 12,
            gap: 10,
          }}
        >
          <Search size={18} color={TEXT_SECONDARY} />
          <TextInput
            testID="search-input"
            value={search}
            onChangeText={handleSearch}
            placeholder={'חיפוש לפי אימייל או שם משתמש'}
            placeholderTextColor={TEXT_SECONDARY}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{ flex: 1, fontSize: 14, color: TEXT_PRIMARY, textAlign: 'right' }}
          />
        </View>
      </Animated.View>

      <FlatList
        data={allUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        testID="users-list"
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
            <UserRow
              user={item}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/admin/user/[id]' as any, params: { id: item.id } });
              }}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator color={ACCENT} size="large" testID="loading-indicator" />
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, color: TEXT_SECONDARY }}>{'לא נמצאו משתמשים'}</Text>
            </View>
          )
        }
        ListFooterComponent={
          isFetching && allUsers.length > 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator color={ACCENT} size="small" testID="load-more-indicator" />
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={!!isLoading && allUsers.length === 0}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
          />
        }
      />
    </SafeAreaView>
  );
}
