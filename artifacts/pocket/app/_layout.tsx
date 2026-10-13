import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { PocketProvider, usePocket } from '@/providers/PocketProvider';
import { usePalette } from '@/constants/theme';
import { Logo, Skeleton, Txt } from '@/components/ui';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const AUTH_ROUTES = ['onboarding', 'login', 'signup', 'reset'];
const OPEN_ROUTES = ['reset-password'];

function RootLayoutNav() {
  const { session, authLoading } = usePocket();
  const p = usePalette();
  const segments = useSegments();
  const router = useRouter();
  const first = String(segments[0] ?? '');
  const inAuth = AUTH_ROUTES.includes(first);

  useEffect(() => {
    if (authLoading || OPEN_ROUTES.includes(first)) return;
    if (!session && !inAuth) router.replace('/onboarding');
    else if (session && inAuth) router.replace('/');
  }, [authLoading, session, inAuth, router, first]);

  const open = OPEN_ROUTES.includes(first);
  const blocked = authLoading || (!open && ((!session && !inAuth) || (!!session && inAuth)));

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={p.mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      {blocked ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', gap: 20 }]}>
          <Logo size={84} />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Txt v="h1" style={{ fontSize: 34 }}>Pocket</Txt>
            <Txt v="small" muted>Wealth & Expense Tracker</Txt>
            <Txt v="small" muted>Your money. All in one place.</Txt>
          </View>
          <Skeleton h={10} w={120} />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <PocketProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </PocketProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
