import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Clock, TrendingUp, SlidersHorizontal } from 'lucide-react-native';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#60A5FA',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.28)',
        tabBarStyle: {
          backgroundColor: '#0B1020',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 80 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('nav.history'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Clock size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t('nav.reports'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TrendingUp size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <SlidersHorizontal size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
