import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Screen, Row, Txt, Card, Logo } from '@/components/ui';
import { usePocket } from '@/providers/PocketProvider';
import { usePalette } from '@/constants/theme';

export default function More() {
  const router = useRouter();
  const p = usePalette();
  const { data, session } = usePocket();
  const chev = <Feather name="chevron-right" size={18} color={p.muted} />;
  const items = [
    { icon: 'alert-circle', title: 'Debts & Loans', sub: 'What you owe and what you lent', to: '/debts' },
    { icon: 'file-text', title: 'Bills', sub: 'Recurring payments and due dates', to: '/bills' },
    { icon: 'bar-chart', title: 'Reports & export', sub: 'Trends, categories, Excel, CSV, PDF', to: '/reports' },
    { icon: 'list', title: 'All activity', sub: 'Every transaction, searchable', to: '/activity' },
    { icon: 'settings', title: 'Profile & settings', sub: 'Currency, appearance, reminders', to: '/settings' },
  ] as const;
  return (
    <Screen title="More" tabbed>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Logo size={56} />
        <View style={{ flex: 1 }}>
          <Txt v="h3" numberOfLines={1}>{data.profile?.name || 'Your Pocket'}</Txt>
          <Txt v="small" muted numberOfLines={1}>{data.profile?.email || session?.user?.email}</Txt>
        </View>
      </Card>
      <View style={{ gap: 10 }}>
        {items.map((it) => <Row key={it.to} icon={it.icon} title={it.title} sub={it.sub} trailing={chev} onPress={() => router.push(it.to)} />)}
      </View>
    </Screen>
  );
}
