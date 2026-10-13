import React, { useRef, useState } from 'react';
import { View, FlatList, ScrollView, Image, Pressable, useWindowDimensions, Platform, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaletteContext, palettes } from '@/constants/theme';
import { Txt, Logo, Btn } from '@/components/ui';

const slides = [
  { title: 'Track Your Expenses', body: 'See where your money goes and take control of your spending.', img: require('../assets/images/pocket/s1.png'), bg: '#F7F4E8' },
  { title: 'Grow Your Wealth', body: 'Save smarter, invest better, and build the future you want.', img: require('../assets/images/pocket/s2.png'), bg: '#EEF0E6' },
  { title: 'All in One Place', body: 'Expenses, savings, investments, assets, liabilities and net worth.', img: require('../assets/images/pocket/s3.png'), bg: '#E8F1EC' },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [i, setI] = useState<number>(0);
  const [intro, setIntro] = useState<boolean>(true);
  const ref = useRef<FlatList>(null);
  const p = palettes.light;
  const w = Math.min(width, 560);
  const next = () => {
    if (i >= slides.length - 1) router.replace('/signup');
    else ref.current?.scrollToIndex({ index: i + 1, animated: true });
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setI(Math.round(e.nativeEvent.contentOffset.x / width));
  if (intro) {
    const d = palettes.dark;
    return (
      <View style={{ flex: 1, backgroundColor: '#071A17' }}>
        <View style={{ position: 'absolute', top: -60, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: d.lime, opacity: 0.9 }} />
        <View style={{ position: 'absolute', bottom: -70, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: d.gold, opacity: 0.7 }} />
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
          <Logo size={96} />
          <Txt v="h1" color="#EEF1E3" style={{ fontSize: 48, marginTop: 14 }}>Pocket</Txt>
          <Txt v="small" color="#93AFA5" style={{ letterSpacing: 2 }}>Wealth & Expense Tracker</Txt>
          <Txt color="#EEF1E3" style={{ marginTop: 40 }}>Your money. All in one place.</Txt>
          <View style={{ alignSelf: 'stretch', marginTop: 24, maxWidth: 420, width: '100%' }}><Btn label="Get started" icon="arrow-right" onPress={() => setIntro(false)} testID="intro-start" /></View>
          <Pressable onPress={() => router.replace('/login')} style={{ padding: 10 }}><Txt v="small" color="#C8F34F">I already have an account</Txt></Pressable>
        </ScrollView>
      </View>
    );
  }
  return (
    <PaletteContext.Provider value={p}>
      <View style={{ flex: 1, backgroundColor: slides[i].bg }}>
        <Pressable onPress={() => router.replace('/login')} style={{ position: 'absolute', right: 24, top: (Platform.OS === 'web' ? 67 : insets.top) + 8, zIndex: 5 }}>
          <Txt v="small" color={p.primary}>Log in</Txt>
        </Pressable>
        <FlatList
          ref={ref} data={slides} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(s) => s.title}
          onMomentumScrollEnd={onEnd} style={{ flex: 1 }}
          getItemLayout={(_, k) => ({ length: width, offset: width * k, index: k })}
          renderItem={({ item }) => (
            <ScrollView style={{ width }} contentContainerStyle={{ alignItems: 'center', paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 50, paddingBottom: 16 }}>
              <View style={{ width: w - 48 }}>
                <Image source={item.img} style={{ width: '100%', height: Math.min(300, w * 0.8), borderRadius: 32 }} resizeMode="contain" />
                <Txt v="h1" style={{ fontSize: 34, marginTop: 36 }}>{item.title}</Txt>
                <Txt style={{ fontSize: 17, lineHeight: 25, marginTop: 12 }} muted>{item.body}</Txt>
              </View>
            </ScrollView>
          )}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 28 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {slides.map((s, k) => <View key={s.title} style={{ width: k === i ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? p.primary : '#C9CFC2' }} />)}
          </View>
          <Pressable testID="onboarding-next" onPress={next} style={({ pressed }) => [{ width: 58, height: 58, borderRadius: 29, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.93 }] }]}>
            <Feather name="arrow-right" size={24} color={p.lime} />
          </Pressable>
        </View>
      </View>
    </PaletteContext.Provider>
  );
}
