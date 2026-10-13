import React, { ReactNode, useState } from 'react';
import { View, ScrollView, Pressable, Text, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaletteContext, palettes, usePalette } from '@/constants/theme';
import { Logo, Txt, Btn, Banner } from '@/components/ui';

export function AuthShell({ dark, subtitle, children }: { dark?: boolean; subtitle: string; children: ReactNode }) {
  const p = dark ? palettes.dark : palettes.light;
  const insets = useSafeAreaInsets();
  return (
    <PaletteContext.Provider value={p}>
      <View style={{ flex: 1, backgroundColor: dark ? '#071A17' : p.bg }}>
        <View style={{ position: 'absolute', top: -60, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: p.lime, opacity: dark ? 0.9 : 0.6 }} />
        <View style={{ position: 'absolute', bottom: -70, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: p.gold, opacity: 0.7 }} />
        <View style={{ position: 'absolute', bottom: -40, right: -70, width: 170, height: 170, borderRadius: 85, backgroundColor: p.teal, opacity: 0.8 }} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 24, paddingHorizontal: 24, paddingBottom: 60, gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <Logo size={72} />
            <Txt v="h1" style={{ fontSize: 36 }}>Pocket</Txt>
            <Txt muted>{subtitle}</Txt>
          </View>
          {children}
        </ScrollView>
      </View>
    </PaletteContext.Provider>
  );
}

export function OAuthButtons() {
  const [msg, setMsg] = useState<string | null>(null);
  const p = usePalette();
  const b = (label: string, icon: 'globe' | 'smartphone') => (
    <Pressable onPress={() => setMsg(`${label.replace('Continue with ', '')} sign-in is not configured for this project yet. Please use email and password.`)}
      style={({ pressed }) => [{ height: 50, borderRadius: 25, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, pressed && { transform: [{ scale: 0.98 }] }]}>
      <Feather name={icon} size={17} color={p.ink} />
      <Text style={{ color: p.ink, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: p.border }} /><Txt v="small" muted>or</Txt><View style={{ flex: 1, height: 1, backgroundColor: p.border }} />
      </View>
      {b('Continue with Google', 'globe')}
      {b('Continue with Apple', 'smartphone')}
      {msg ? <Banner kind="warn" message={msg} /> : null}
    </View>
  );
}

export { Btn };
