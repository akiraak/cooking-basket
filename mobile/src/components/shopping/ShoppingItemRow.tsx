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
  onDragStart?: () => void;
}

export function ShoppingItemRow({ id, name, checked, onToggleCheck, onDelete, onDragStart }: ShoppingItemRowProps) {
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
      <TouchableOpacity style={styles.checkRow} onPress={handleCheck} onLongPress={onDragStart} delayLongPress={200} activeOpacity={0.6}>
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
