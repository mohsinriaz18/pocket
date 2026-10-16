import React, { ReactNode, useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, Modal, StyleSheet, Platform, Animated,
  RefreshControl, TextInputProps, ViewStyle, StyleProp, Image, ActivityIndicator, TextStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '@/constants/theme';
import { usePocket } from '@/providers/PocketProvider';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

type IconName = React.ComponentProps<typeof Feather>['name'];
export type { IconName };

const sizes: Record<string, TextStyle> = {
  h1: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
  h2: { fontSize: 20, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  h3: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  body: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  small: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.9, textTransform: 'uppercase' },
  num: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
};

export function Txt({ v = 'body', muted, color, style, children, numberOfLines }: {
  v?: keyof typeof sizes; muted?: boolean; color?: string; style?: StyleProp<TextStyle>; children?: ReactNode; numberOfLines?: number;
}) {
  const p = usePalette();
  return (
    <Text numberOfLines={numberOfLines} style={[sizes[v], { color: color ?? (muted ? p.muted : p.ink) }, style]}>{children}</Text>
  );
}

export function FadeIn({ i = 0, children, style }: { i?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 380, delay: Math.min(i, 8) * 55, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [a, i]);
  return (
    <Animated.View style={[{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

export function Card({ children, style, onPress, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: 'dark' | 'lime' }) {
  const p = usePalette();
  const bg = tone === 'dark' ? p.primary : tone === 'lime' ? p.lime : p.card;
  const base: ViewStyle = { backgroundColor: bg, borderRadius: 22, padding: 16, borderWidth: tone ? 0 : 1, borderColor: p.border };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, style, pressed && { transform: [{ scale: 0.98 }] }]}>{children}</Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Btn({ label, onPress, kind = 'lime', icon, loading, disabled, small, style, testID }: {
  label: string; onPress: () => void; kind?: 'lime' | 'dark' | 'ghost' | 'danger'; icon?: IconName; loading?: boolean; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const p = usePalette();
  const bg = kind === 'lime' ? p.lime : kind === 'dark' ? p.primary : kind === 'danger' ? p.bad : 'transparent';
  const fg = kind === 'lime' ? p.onLime : kind === 'dark' ? p.onPrimary : kind === 'danger' ? '#fff' : p.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        { height: small ? 40 : 52, borderRadius: 26, paddingHorizontal: 20, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.45 : 1 },
        kind === 'ghost' && { borderWidth: 1, borderColor: p.border },
        pressed && { transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          <Text style={{ color: fg, fontFamily: 'Inter_600SemiBold', fontSize: small ? 14 : 16 }}>{label}</Text>
          {icon ? <Feather name={icon} size={small ? 16 : 18} color={fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function IconBtn({ icon, onPress, tone, label }: { icon: IconName; onPress: () => void; tone?: 'lime'; label?: string }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: tone === 'lime' ? p.lime : p.cardAlt }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Feather name={icon} size={18} color={tone === 'lime' ? p.onLime : p.ink} />
    </Pressable>
  );
}

export function Logo({ size = 64 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.8, overflow: 'hidden', backgroundColor: '#F5F3EA', alignItems: 'center', justifyContent: 'center' }}>
      <Image source={require('../assets/images/pocket/logo.png')} style={{ width: size * 1.05, height: size * 1.05 }} resizeMode="cover" />
    </View>
  );
}

export function Screen({ title, subtitle, back, right, children, tabbed, onRefresh, noScroll }: {
  title: string; subtitle?: string; back?: boolean; right?: ReactNode; children: ReactNode; tabbed?: boolean; onRefresh?: () => Promise<void>; noScroll?: boolean;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const top = Platform.OS === 'web' ? 67 : insets.top + 8;
  const bottom = tabbed ? 28 : (Platform.OS === 'web' ? 34 : insets.bottom) + 28;
  const head = (
    <View style={{ paddingTop: top, paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {back ? <IconBtn icon="arrow-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
      <View style={{ flex: 1 }}>
        <Txt v="h1">{title}</Txt>
        {subtitle ? <Txt v="small" muted>{subtitle}</Txt> : null}
      </View>
      {right}
    </View>
  );
  if (noScroll) return <View style={{ flex: 1, backgroundColor: p.bg }}>{head}{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom }}
        refreshControl={onRefresh ? (
          <RefreshControl refreshing={refreshing} tintColor={p.primary} onRefresh={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }} />
        ) : undefined}
      >
        {head}
        <View style={{ paddingHorizontal: 20, gap: 14 }}>{children}</View>
      </ScrollView>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
      <Txt v="h2">{title}</Txt>
      {action ? <Pressable onPress={onAction} hitSlop={8}><Text style={{ color: p.primary, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange, labels }: { options: T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: p.cardAlt, borderRadius: 18, padding: 4 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={{ flex: 1, paddingVertical: 9, borderRadius: 14, alignItems: 'center', backgroundColor: on ? p.primary : 'transparent' }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: on ? p.onPrimary : p.muted }}>{labels?.[o] ?? o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips({ options, value, onChange, scroll }: { options: string[]; value: string; onChange: (v: string) => void; scroll?: boolean }) {
  const p = usePalette();
  const items = options.map((o) => {
    const on = o === value;
    return (
      <Pressable key={o} onPress={() => onChange(o)} style={({ pressed }) => [{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: on ? p.primary : p.border, backgroundColor: on ? p.primary : p.input }, pressed && { transform: [{ scale: 0.96 }] }]}>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: on ? p.onPrimary : p.ink }}>{o}</Text>
      </Pressable>
    );
  });
  if (scroll) return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{items}</ScrollView>;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{items}</View>;
}

export function Field({ label, error, icon, right, style, ...rest }: TextInputProps & { label?: string; error?: string; icon?: IconName; right?: ReactNode }) {
  const p = usePalette();
  const [focus, setFocus] = useState<boolean>(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt v="label" muted>{label}</Txt> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: p.input, borderRadius: 16, borderWidth: 1.5, borderColor: error ? p.bad : focus ? p.teal : p.border, paddingHorizontal: 14, minHeight: 50 }}>
        {icon ? <Feather name={icon} size={17} color={p.muted} style={{ marginRight: 10 }} /> : null}
        <TextInput
          placeholderTextColor={p.muted}
          {...rest}
          onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
          style={[{ flex: 1, color: p.ink, fontFamily: 'Inter_500Medium', fontSize: 15, paddingVertical: 12, outlineStyle: 'none' } as unknown as TextStyle, rest.multiline && { minHeight: 70, textAlignVertical: 'top' }, style]}
        />
        {right}
      </View>
      {error ? <Txt v="small" color={p.bad}>{error}</Txt> : null}
    </View>
  );
}

export function Sheet({ visible, onClose, title, children, dirty, busy }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; dirty?: boolean; busy?: boolean }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [discard, setDiscard] = useState<boolean>(false);
  useEffect(() => { if (!visible) setDiscard(false); }, [visible]);
  const attempt = () => {
    if (busy) return;
    if (dirty) setDiscard(true); else onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={attempt}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: p.overlay }]} onPress={attempt} />
        <View style={{ maxHeight: '92%', backgroundColor: p.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <View style={{ alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: p.border, marginBottom: 10 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 }}>
            <View style={{ flex: 1 }}><Txt v="h2">{title}</Txt></View>
            <IconBtn icon="x" label="Close" onPress={attempt} />
          </View>
          <KeyboardAwareScrollViewCompat bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 34 }}>
            {discard ? (
              <>
                <Txt v="h3">Discard your changes?</Txt>
                <Txt muted>You have unsaved changes. Closing now will lose them.</Txt>
                <Btn kind="danger" label="Discard changes" onPress={() => { setDiscard(false); onClose(); }} />
                <Btn kind="ghost" label="Keep editing" onPress={() => setDiscard(false)} />
              </>
            ) : children}
          </KeyboardAwareScrollViewCompat>
        </View>
      </View>
    </Modal>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: string; label: string; run: () => Promise<void> | void } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const lock = useRef<boolean>(false);
  const ask = useCallback((title: string, body: string, label: string, run: () => Promise<void> | void) => setState({ title, body, label, run }), []);
  const el = (
    <Sheet visible={!!state} onClose={() => setState(null)} title={state?.title ?? ''} busy={busy}>
      <Txt muted>{state?.body}</Txt>
      <Btn kind="danger" label={state?.label ?? 'Confirm'} loading={busy} onPress={async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        try { await state?.run(); } finally { lock.current = false; setBusy(false); setState(null); }
      }} />
      <Btn kind="ghost" label="Cancel" disabled={busy} onPress={() => setState(null)} />
    </Sheet>
  );
  return { ask, el };
}

export function Empty({ icon, title, body, action, onAction }: { icon: IconName; title: string; body: string; action?: string; onAction?: () => void }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: 'center', padding: 28, gap: 10, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.border }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={24} color={p.primary} />
      </View>
      <Txt v="h3">{title}</Txt>
      <Txt v="small" muted style={{ textAlign: 'center' }}>{body}</Txt>
      {action ? <Btn small label={action} onPress={onAction ?? (() => {})} style={{ marginTop: 6 }} /> : null}
    </View>
  );
}

export function Skeleton({ h = 80, w }: { h?: number; w?: number | `${number}%` }) {
  const p = usePalette();
  const a = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(a, { toValue: 0.45, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    l.start();
    return () => l.stop();
  }, [a]);
  return <Animated.View style={{ height: h, width: w ?? '100%', borderRadius: 20, backgroundColor: p.cardAlt, opacity: a }} />;
}

export function SkeletonList({ n = 3, h = 84 }: { n?: number; h?: number }) {
  return <View style={{ gap: 12 }}>{Array.from({ length: n }).map((_, i) => <Skeleton key={i} h={h} />)}</View>;
}

export function Banner({ kind, message, onRetry }: { kind: 'error' | 'warn' | 'ok'; message: string; onRetry?: () => void }) {
  const p = usePalette();
  const c = kind === 'error' ? p.bad : kind === 'warn' ? p.gold : p.good;
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c, backgroundColor: p.card }}>
      <Feather name={kind === 'ok' ? 'check-circle' : 'alert-triangle'} size={18} color={c} />
      <View style={{ flex: 1 }}><Txt v="small">{message}</Txt></View>
      {onRetry ? <Pressable onPress={onRetry}><Text style={{ color: p.primary, fontFamily: 'Inter_600SemiBold' }}>Retry</Text></Pressable> : null}
    </View>
  );
}

export function DataState() {
  const { loading, error, refresh, signOut } = usePocket();
  if (error) {
    return (
      <View style={{ gap: 10 }}>
        <Banner kind="error" message={/PGRST205|schema cache|does not exist|relation/i.test(error) ? `Setup required: the Pocket database tables have not been created yet, so nothing can be loaded or saved. Apply the SQL migration, then retry. (${error})` : `Pocket could not load your data. ${error}`} onRetry={refresh} />
        <Btn small kind="ghost" label="Log out" icon="log-out" onPress={() => { void signOut(); }} />
      </View>
    );
  }
  if (loading) return <SkeletonList n={3} />;
  return null;
}

export function Progress({ pct, color }: { pct: number; color?: string }) {
  const p = usePalette();
  const w = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: p.cardAlt, overflow: 'hidden' }}>
      <View style={{ width: `${w}%`, height: 8, borderRadius: 4, backgroundColor: color ?? p.teal }} />
    </View>
  );
}

export function Stat({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: IconName }) {
  const p = usePalette();
  return (
    <Card style={{ flex: 1, minWidth: '45%', gap: 6, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Feather name={icon} size={13} color={p.muted} /> : null}
        <Txt v="label" muted>{label}</Txt>
      </View>
      <Txt v="h2" color={tone} numberOfLines={1}>{value}</Txt>
    </Card>
  );
}

export function Row({ icon, title, sub, value, valueColor, onPress, onLongPress, trailing }: {
  icon: IconName; title: string; sub?: string; value?: string; valueColor?: string; onPress?: () => void; onLongPress?: () => void; trailing?: ReactNode;
}) {
  const p = usePalette();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: p.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={18} color={p.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="h3" numberOfLines={1}>{title}</Txt>
        {sub ? <Txt v="small" muted numberOfLines={1}>{sub}</Txt> : null}
      </View>
      {value ? <Txt v="h3" color={valueColor}>{value}</Txt> : null}
      {trailing}
    </View>
  );
  if (onPress || onLongPress) {
    return <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [{ backgroundColor: p.card, borderRadius: 20, borderWidth: 1, borderColor: p.border, padding: 12 }, pressed && { transform: [{ scale: 0.985 }] }]}>{body}</Pressable>;
  }
  return <View style={{ backgroundColor: p.card, borderRadius: 20, borderWidth: 1, borderColor: p.border, padding: 12 }}>{body}</View>;
}

export function MissingRates({ list, error }: { list: string[]; error?: string | null }) {
  if ((!list || !list.length) && !error) return null;
  return (
    <View style={{ gap: 8 }}>
      {list?.length ? <Banner kind="warn" message={`No exchange rate for ${list.join(', ')}. That money is left out of the totals below.`} /> : null}
      {error ? <Banner kind="warn" message={error} /> : null}
    </View>
  );
}

export function Switch2({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const p = usePalette();
  return (
    <Pressable onPress={() => onChange(!on)} style={{ width: 52, height: 30, borderRadius: 15, padding: 3, backgroundColor: on ? p.teal : p.border, justifyContent: 'center' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignSelf: on ? 'flex-end' : 'flex-start' }} />
    </Pressable>
  );
}
