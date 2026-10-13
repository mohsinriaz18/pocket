import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { usePalette } from '@/constants/theme';

export default function TabLayout() {
  const p = usePalette();
  const icon = (name: React.ComponentProps<typeof Feather>['name']) => ({ color, size }: { color: unknown; size: number }) => <Feather name={name} size={size - 2} color={color as string} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.mode === 'dark' ? p.lime : p.primary,
        tabBarInactiveTintColor: p.muted,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
        tabBarStyle: { backgroundColor: p.card, borderTopColor: p.border, ...(Platform.OS === 'web' ? { height: 84 } : {}) },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarIcon: icon('credit-card') }} />
      <Tabs.Screen name="invest" options={{ title: 'Invest', tabBarIcon: icon('trending-up') }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals', tabBarIcon: icon('target') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('grid') }} />
    </Tabs>
  );
}
