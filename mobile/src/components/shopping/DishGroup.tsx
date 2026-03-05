import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme/theme-provider';
import { ShoppingItemRow } from './ShoppingItemRow';
import type { Dish } from '../../types/models';

interface DishGroupProps {
  dish: Dish;
  onToggleCheck: (id: number, checked: number) => void;
  onDeleteItem: (id: number) => void;
  onDeleteDish: (dish: Dish) => void;
  onAddItem: (dishId: number) => void;
  onPressDishName: (dish: Dish) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveDish?: (dishId: number, direction: 'up' | 'down') => void;
  onMoveItem?: (dishId: number, itemId: number, direction: 'up' | 'down') => void;
}

export function DishGroup({
  dish,
  onToggleCheck,
  onDeleteItem,
  onDeleteDish,
  onAddItem,
  onPressDishName,
  canMoveUp,
  canMoveDown,
  onMoveDish,
  onMoveItem,
}: DishGroupProps) {
  const colors = useThemeColors();
  const [reorderMode, setReorderMode] = useState(false);

  const uncheckedItems = dish.items.filter((i) => !i.checked);
  const checkedItems = dish.items.filter((i) => i.checked);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.leftBorder, { backgroundColor: colors.primary }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.dishNameArea} onPress={() => onPressDishName(dish)}>
            <Text style={[styles.dishName, { color: colors.primaryLight }]} numberOfLines={1}>
              {dish.name}
            </Text>
          </TouchableOpacity>
          <View style={styles.headerButtons}>
            {onMoveDish && (
              <TouchableOpacity
                onPress={() => setReorderMode(!reorderMode)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.reorderToggle, { color: reorderMode ? colors.primary : colors.textMuted }]}>
                  ⇅
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => onAddItem(dish.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.headerBtn, { color: colors.primaryLight }]}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDeleteDish(dish)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.headerBtn, { color: colors.textMuted }]}>×</Text>
            </TouchableOpacity>
          </View>
        </View>

        {reorderMode && onMoveDish && (
          <View style={styles.dishMoveRow}>
            <TouchableOpacity
              style={[styles.moveBtn, { borderColor: colors.border }, !canMoveUp && styles.moveBtnDisabled]}
              onPress={() => canMoveUp && onMoveDish(dish.id, 'up')}
              disabled={!canMoveUp}
            >
              <Text style={[styles.moveBtnText, { color: canMoveUp ? colors.text : colors.textMuted }]}>▲ 上へ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moveBtn, { borderColor: colors.border }, !canMoveDown && styles.moveBtnDisabled]}
              onPress={() => canMoveDown && onMoveDish(dish.id, 'down')}
              disabled={!canMoveDown}
            >
              <Text style={[styles.moveBtnText, { color: canMoveDown ? colors.text : colors.textMuted }]}>▼ 下へ</Text>
            </TouchableOpacity>
          </View>
        )}

        {uncheckedItems.map((item, idx) => (
          <ShoppingItemRow
            key={item.id}
            id={item.id}
            name={item.name}
            checked={item.checked}
            onToggleCheck={onToggleCheck}
            onDelete={onDeleteItem}
            showReorder={reorderMode}
            canMoveUp={idx > 0}
            canMoveDown={idx < uncheckedItems.length - 1}
            onMove={onMoveItem ? (dir) => onMoveItem(dish.id, item.id, dir) : undefined}
          />
        ))}
        {checkedItems.map((item) => (
          <ShoppingItemRow
            key={item.id}
            id={item.id}
            name={item.name}
            checked={item.checked}
            onToggleCheck={onToggleCheck}
            onDelete={onDeleteItem}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  leftBorder: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dishNameArea: {
    flex: 1,
  },
  dishName: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  reorderToggle: {
    fontSize: 18,
    fontWeight: '500',
  },
  headerBtn: {
    fontSize: 22,
    fontWeight: '500',
  },
  dishMoveRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  moveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  moveBtnDisabled: {
    opacity: 0.3,
  },
  moveBtnText: {
    fontSize: 12,
  },
});
