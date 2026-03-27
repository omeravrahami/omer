import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { useDeviceStore } from '@/lib/state/device-store';
import { useSettingsStore } from '@/lib/state/settings-store';
import { useAuthStore } from '@/lib/state/auth-store';
import { Toast } from '@/components/Toast';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AdminGuard() {
  const segments = useSegments();
  const router = useRouter();
  const userRole = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    const isAdminRoute = segments[0] === 'admin';
    if (isAdminRoute && userRole !== 'ADMIN') {
      router.replace('/(tabs)');
    }
  }, [segments, userRole, router]);

  return null;
}

function RootLayoutNav({ colorScheme }: { colorScheme: 'light' | 'dark' | null | undefined }) {
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const isAuthenticated = token !== null || isGuest;

  const getInitialRoute = () => {
    if (!onboardingCompleted) return 'onboarding';
    if (!isAuthenticated) return 'auth/login';
    return '(tabs)';
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AdminGuard />
      <Stack initialRouteName={getInitialRoute()}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="auth/login"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="auth/register"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="auth/forgot-password"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="auth/reset-password"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="auth/change-password"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="active-sessions"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="session-detail/[id]"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="add-edit-session"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="premium"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="add-day-record"
          options={{
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.85, 1.0],
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="tax-brackets"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="simulation"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="privacy"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
      <Toast />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const initDevice = useDeviceStore((s) => s.initDevice);
  const hasHydrated = useDeviceStore((s) => s._hasHydrated);

  // RTL: set once on first mount
  useEffect(() => {
    if (!I18nManager.isRTL) {
      I18nManager.forceRTL(true);
    }
  }, []);

  // Wait for AsyncStorage to load before initialising the device ID.
  // Without this guard, a hot-reload could call initDevice() before the
  // stored deviceId is available, creating a fresh UUID and making all
  // existing sessions appear to be gone.
  useEffect(() => {
    if (!hasHydrated) return;
    initDevice();
    SplashScreen.hideAsync();
  }, [hasHydrated, initDevice]);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <RootLayoutNav colorScheme={colorScheme} />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
