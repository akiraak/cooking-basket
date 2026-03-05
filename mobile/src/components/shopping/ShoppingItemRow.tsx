import { useRef } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../theme/theme-provider';

interface ShoppingItemRowProps {
  id: number;
  name: string;
  checked: number;
  onToggleCheck: (id: number, checked: number) => void;
  onDelete: (id: number) => void;
  showReorder?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (direction: 'up' | 'down') => void;
}

export function ShoppingItemRow({ id, name, checked, onToggleCheck, onDelete, showReorder, canMoveUp, canMoveDown, onMove }: ShoppingItemRowProps) {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(1)).current;

  const handleCheck = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newChecked = checked ? 0 : 1;
    if (newChecked === 1) {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        onToggleCheck(id, newChecked);
      });
    } else {
      onToggleCheck(id, newChecked);
    }
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      onDelete(id);
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      {showReorder && onMove && (
        <View style={styles.reorderButtons}>
          <TouchableOpacity
            onPress={() => canMoveUp && onMove('up')}
            disabled={!canMoveUp}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={[styles.reorderBtn, { color: canMoveUp ? colors.textMuted : colors.border }]}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => canMoveDown && onMove('down')}
            disabled={!canMoveDown}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={[styles.reorderBtn, { color: canMoveDown ? colors.textMuted : colors.border }]}>▼</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity style={styles.checkRow} onPress={handleCheck} activeOpacity={0.6}>
        <View
          style={[
            styles.checkbox,
            { borderColor: checked ? colors.primaryLight : colors.textMuted },
            !!checked && { backgroundColor: colors.primaryLight },
          ]}
        >
          {checked ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text
          style={[
            styles.name,
            { color: checked ? colors.checked : colors.text },
            !!checked && styles.nameChecked,
          ]}
        >
          {name}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[styles.deleteBtn, { color: colors.textMuted }]}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  reorderButtons: {
    marginRight: 8,
    gap: 2,
  },
  reorderBtn: {
    fontSize: 10,
    lineHeight: 14,
  },
  checkRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: -1,
  },
  name: {
    fontSize: 15,
    flex: 1,
  },
  nameChecked: {
    textDecorationLine: 'line-through',
  },
  deleteBtn: {
    fontSize: 20,
    paddingHorizontal: 8,
  },
});
