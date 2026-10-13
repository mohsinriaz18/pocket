import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect, Line, G } from 'react-native-svg';
import { usePalette, chartColors } from '@/constants/theme';
import { Txt } from '@/components/ui';

export interface Slice { label: string; value: number }

export function Donut({ data, size = 150, centerLabel, centerValue }: { data: Slice[]; size?: number; centerLabel?: string; centerValue?: string }) {
  const p = usePalette();
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.cardAlt} strokeWidth={18} fill="none" />
          {total > 0 && data.map((d, i) => {
            const len = (Math.max(0, d.value) / total) * c;
            const el = (
              <Circle key={d.label} cx={size / 2} cy={size / 2} r={r} stroke={chartColors[i % chartColors.length]} strokeWidth={18} fill="none"
                strokeDasharray={`${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`} strokeDashoffset={-acc} />
            );
            acc += len;
            return el;
          })}
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', paddingHorizontal: 30 }}>
        {centerLabel ? <Txt v="label" muted>{centerLabel}</Txt> : null}
        {centerValue ? <Txt v="small" style={{ textAlign: 'center' }} numberOfLines={1}>{centerValue}</Txt> : null}
      </View>
    </View>
  );
}

export function Legend({ data, fmt }: { data: Slice[]; fmt: (v: number) => string }) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
  return (
    <View style={{ gap: 8, flex: 1 }}>
      {data.slice(0, 7).map((d, i) => (
        <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: chartColors[i % chartColors.length] }} />
          <View style={{ flex: 1 }}><Txt v="small" numberOfLines={1}>{d.label}</Txt></View>
          <Txt v="small" muted>{Math.round((d.value / total) * 100)}%</Txt>
          <Txt v="small">{fmt(d.value)}</Txt>
        </View>
      ))}
    </View>
  );
}

export function DonutBlock({ data, fmt, centerLabel }: { data: Slice[]; fmt: (v: number) => string; centerLabel: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Donut data={data} centerLabel={centerLabel} centerValue={fmt(total)} />
      <View style={{ alignSelf: 'stretch' }}><Legend data={data} fmt={fmt} /></View>
    </View>
  );
}

export function InOutBars({ data, height = 140 }: { data: { label: string; income: number; spending: number }[]; height?: number }) {
  const p = usePalette();
  const [w, setW] = React.useState<number>(300);
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.spending]));
  const n = Math.max(1, data.length);
  const slot = w / n;
  const bw = Math.max(3, Math.min(14, slot / 3));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={height + 22}>
        <Line x1={0} x2={w} y1={height} y2={height} stroke={p.border} strokeWidth={1} />
        {data.map((d, i) => {
          const x = i * slot + slot / 2;
          const hi = (d.income / max) * (height - 8);
          const hs = (d.spending / max) * (height - 8);
          return (
            <G key={i}>
              <Rect x={x - bw - 1} y={height - hi} width={bw} height={hi} rx={3} fill={p.teal} />
              <Rect x={x + 1} y={height - hs} width={bw} height={hs} rx={3} fill={p.gold} />
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: 'row' }}>
        {data.map((d, i) => (
          <View key={i} style={{ width: slot, alignItems: 'center', marginTop: -18 }}>
            {(n <= 8 || i % Math.ceil(n / 6) === 0) ? <Txt v="label" muted style={{ fontSize: 9 }}>{d.label}</Txt> : null}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 24 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.teal }} /><Txt v="small" muted>Money in</Txt></View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.gold }} /><Txt v="small" muted>Money out</Txt></View>
      </View>
    </View>
  );
}

export function LineChart({ points, height = 110 }: { points: number[]; height?: number }) {
  const p = usePalette();
  const [w, setW] = React.useState<number>(300);
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((v, i) => [(i / (points.length - 1)) * (w - 8) + 4, height - 8 - ((v - min) / span) * (height - 20)]);
  const d = xy.map((q, i) => `${i === 0 ? 'M' : 'L'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
  const area = `${d} L${xy[xy.length - 1][0]},${height} L${xy[0][0]},${height} Z`;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={height}>
        <Path d={area} fill={p.teal} opacity={0.14} />
        <Path d={d} stroke={p.teal} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r={5} fill={p.lime} stroke={p.primary} strokeWidth={2} />
      </Svg>
    </View>
  );
}
