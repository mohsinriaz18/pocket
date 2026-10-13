import React from 'react';
import { View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePalette } from '@/constants/theme';

export function Actions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {onEdit ? <Pressable accessibilityLabel="Edit" hitSlop={6} onPress={onEdit} style={{ padding: 6 }}><Feather name="edit-2" size={16} color={p.muted} /></Pressable> : null}
      {onDelete ? <Pressable accessibilityLabel="Delete" hitSlop={6} onPress={onDelete} style={{ padding: 6 }}><Feather name="trash-2" size={16} color={p.bad} /></Pressable> : null}
    </View>
  );
}
