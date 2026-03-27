import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/state/auth-store';

export default function AdminLayout() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token || role !== 'ADMIN') {
      router.replace('/(tabs)');
    }
  }, [token, role, router]);

  if (!token || role !== 'ADMIN') {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0B1020' },
        headerTintColor: '#F0F6FF',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#0B1020' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'לוח בקרה', headerBackTitle: 'חזרה' }}
      />
      <Stack.Screen
        name="users"
        options={{ title: 'משתמשים', headerBackTitle: 'חזרה' }}
      />
      <Stack.Screen
        name="user/[id]"
        options={{ title: 'פרטי משתמש', headerBackTitle: 'חזרה' }}
      />
      <Stack.Screen
        name="config"
        options={{ title: 'הגדרות מערכת', headerBackTitle: 'חזרה' }}
      />
      <Stack.Screen
        name="audit-logs"
        options={{ title: 'לוג ביקורת', headerBackTitle: 'חזרה' }}
      />
    </Stack>
  );
}
