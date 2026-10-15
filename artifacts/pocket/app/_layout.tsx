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
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { PocketProvider, usePocket } from '@/providers/PocketProvider';
import { SubscriptionProvider, useSubscription } from '@/providers/SubscriptionProvider';
import { OnboardingProvider, useOnboarding } from '@/providers/OnboardingProvider';
import { usePalette } from '@/constants/theme';
import { Logo, Skeleton, Txt } from '@/components/ui';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
function RootLayoutNav() {
  const { session, authLoading } = usePocket();
  const { loading, hasAccess } = useSubscription();
  const onboarding = useOnboarding();
  const p = usePalette();
  const blocked = authLoading || onboarding.loading ||
    (!!session && (onboarding.authTransition || (!onboarding.needsFinish && loading)));

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={p.mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="reset" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && onboarding.needsFinish}>
          <Stack.Screen name="complete-setup" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !onboarding.needsFinish && !onboarding.authTransition && (loading || !hasAccess)}>
          <Stack.Screen name="subscribe" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !onboarding.needsFinish && !onboarding.authTransition && !loading && hasAccess}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="activity" />
          <Stack.Screen name="bills" />
          <Stack.Screen name="debts" />
          <Stack.Screen name="reports" />
          <Stack.Screen name="settings" />
        </Stack.Protected>
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="+not-found" />
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
            <OnboardingProvider>
            <SubscriptionProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
            </SubscriptionProvider>
            </OnboardingProvider>
          </PocketProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
