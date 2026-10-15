import React, { ReactNode } from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaletteContext, palettes } from '@/constants/theme';
import { Txt, Logo } from '@/components/ui';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

type Icon = React.ComponentProps<typeof Feather>['name'];

/** Light themed shell with optional back / progress / skip header, keyboard aware. */
export function StepShell({ children, step, total = 5, onBack, onSkip, footer, backTestID = 'onboarding-back', skipTestID = 'onboarding-skip', logo }: {
  children: ReactNode; step?: number; total?: number; onBack?: () => void; onSkip?: () => void; footer?: ReactNode;
  backTestID?: string; skipTestID?: string; logo?: boolean;
}) {
  const p = palettes.light;
  const insets = useSafeAreaInsets();
  const top = (Platform.OS === 'web' ? 67 : insets.top) + 6;
  const bottom = (Platform.OS === 'web' ? 34 : insets.bottom) + 12;
  return (
    <PaletteContext.Provider value={p}>
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <View style={{ position: 'absolute', top: -70, right: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: p.lime, opacity: 0.45 }} />
        <View style={{ paddingTop: top, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <View style={{ width: 44, height: 44 }}>
            {onBack ? (
              <Pressable testID={backTestID} accessibilityRole="button" accessibilityLabel="Back" onPress={onBack}
                style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: p.cardAlt }, pressed && { opacity: 0.7 }]}>
                <Feather name="arrow-left" size={20} color={p.ink} />
              </Pressable>
            ) : logo ? <Logo size={40} /> : null}
          </View>
          <View style={{ flex: 1, flexDirection: 'row', gap: 5 }} accessibilityRole="progressbar" accessibilityLabel={step ? `Step ${step} of ${total}` : undefined}>
            {step ? Array.from({ length: total }).map((_, k) => (
              <View key={k} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: k < step ? p.primary : '#D6D9C8' }} />
            )) : null}
          </View>
          <View style={{ minWidth: 44, alignItems: 'flex-end' }}>
            {onSkip ? (
              <Pressable testID={skipTestID} accessibilityRole="button" onPress={onSkip} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                <Txt v="small" color={p.primary}>Skip</Txt>
              </Pressable>
            ) : null}
          </View>
        </View>
        <KeyboardAwareScrollViewCompat bottomOffset={24} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          {children}
        </KeyboardAwareScrollViewCompat>
        {footer ? <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: bottom, gap: 8, maxWidth: 560, width: '100%', alignSelf: 'center' }}>{footer}</View> : <View style={{ height: bottom }} />}
      </View>
    </PaletteContext.Provider>
  );
}

export function Question({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string }) {
  return (
    <View style={{ gap: 8, marginBottom: 6 }}>
      <Txt v="label" color={palettes.light.primary}>{eyebrow}</Txt>
      <Txt v="h1" style={{ fontSize: 30, lineHeight: 36 }}>{title}</Txt>
      {hint ? <Txt muted>{hint}</Txt> : null}
    </View>
  );
}

export function Option({ label, detail, icon, selected, onPress, testID }: {
  label: string; detail?: string; icon?: Icon; selected: boolean; onPress: () => void; testID: string;
}) {
  const p = palettes.light;
  return (
    <Pressable testID={testID} accessibilityRole="radio" accessibilityState={{ selected, checked: selected }} accessibilityLabel={detail ? `${label}. ${detail}` : label} onPress={onPress}
      style={({ pressed }) => [{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, borderWidth: 2, borderColor: selected ? p.primary : p.border, backgroundColor: selected ? '#EAF3D2' : p.card }, pressed && { transform: [{ scale: 0.985 }] }]}>
      {icon ? (
        <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: selected ? p.primary : p.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={icon} size={19} color={selected ? p.lime : p.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt v="h3">{label}</Txt>
        {detail ? <Txt v="small" muted>{detail}</Txt> : null}
      </View>
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selected ? p.primary : '#B9BFAE', backgroundColor: selected ? p.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <Feather name="check" size={14} color={p.lime} /> : null}
      </View>
    </Pressable>
  );
}

export function TextLink({ label, onPress, testID, disabled, color }: { label: string; onPress: () => void; testID?: string; disabled?: boolean; color?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, opacity: disabled ? 0.55 : 1 }}>
      <Txt v="small" color={color ?? palettes.light.primary} style={{ textDecorationLine: 'underline' }}>{label}</Txt>
    </Pressable>
  );
}
