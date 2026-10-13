import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { usePocket } from '@/providers/PocketProvider';

export const palettes = {
  light: {
    mode: 'light' as 'light' | 'dark',
    bg: '#F5F3EA',
    card: '#FCFBF6',
    cardAlt: '#EBEFE2',
    ink: '#0D2A25',
    muted: '#66797400'.slice(0, 7),
    border: '#E1DED0',
    primary: '#0F5C4D',
    onPrimary: '#F5F3EA',
    teal: '#1FA58C',
    lime: '#C8F34F',
    onLime: '#0D2A25',
    gold: '#EEB032',
    good: '#12805F',
    bad: '#CF4F3A',
    input: '#F0EEE3',
    overlay: 'rgba(8,26,22,0.55)',
  },
  dark: {
    mode: 'dark' as 'light' | 'dark',
    bg: '#09201D',
    card: '#102B28',
    cardAlt: '#16382F',
    ink: '#EEF1E3',
    muted: '#93AFA5',
    border: '#1F4540',
    primary: '#2BB59A',
    onPrimary: '#06201B',
    teal: '#2BB59A',
    lime: '#C8F34F',
    onLime: '#0D2A25',
    gold: '#F2B93F',
    good: '#5FD3A4',
    bad: '#F27D68',
    input: '#0C2421',
    overlay: 'rgba(0,0,0,0.6)',
  },
};
palettes.light.muted = '#667974';

export type Palette = typeof palettes.light;
export const PaletteContext = createContext<Palette | null>(null);

export function usePalette(): Palette {
  const forced = useContext(PaletteContext);
  const scheme = useColorScheme();
  const { data } = usePocket();
  if (forced) return forced;
  const a = data.profile?.appearance ?? 'system';
  const mode = a === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : a;
  return palettes[mode];
}

export const chartColors = ['#0F5C4D', '#C8F34F', '#1FA58C', '#EEB032', '#7BD389', '#CF4F3A', '#4B8F8C', '#A8B545', '#E58E5A', '#2F7E6B'];
