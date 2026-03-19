import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Clock, BarChart3, SlidersHorizontal } from 'lucide-react-native';
import { Platform } from 'react-native';

export default function TabLayout() {
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
          title: '\u05D1\u05D9\u05EA',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D4',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Clock size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: '\u05E1\u05D9\u05DB\u05D5\u05DE\u05D9\u05DD',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <SlidersHorizontal size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
