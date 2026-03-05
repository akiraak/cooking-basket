import { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  NestableDraggableFlatList,
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../theme/theme-provider';
import { ShoppingItemRow } from './ShoppingItemRow';
import type { Dish, DishItem } from '../../types/models';

interface DishGroupProps {
  dish: Dish;
  onToggleCheck: (id: number, checked: number) => void;
  onDeleteItem: (id: number) => void;
  onDeleteDish: (dish: Dish) => void;
  onAddItem: (dishId: number) => void;
  onPressDishName: (dish: Dish) => void;
  onDragStart?: () => void;
  isActive?: boolean;
  onReorderItems?: (dishId: number, data: DishItem[]) => void;
}

export function DishGroup({
  dish,
  onToggleCheck,
  onDeleteItem,
  onDeleteDish,
  onAddItem,
  onPressDishName,
  onDragStart,
  isActive,
  onReorderItems,
}: DishGroupProps) {
  const colors = useThemeColors();

  const uncheckedItems = dish.items.filter((i) => !i.checked);
  const checkedItems = dish.items.filter((i) => i.checked);
  const allItems = [...uncheckedItems, ...checkedItems];

  const handleItemDrag = useCallback((drag: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    drag();
  }, []);

  const renderItem = useCallback(({ item, drag }: RenderItemParams<DishItem>) => (
    <ScaleDecorator activeScale={1.03}>
      <ShoppingItemRow
        id={item.id}
        name={item.name}
        checked={item.checked}
        onToggleCheck={onToggleCheck}
        onDelete={onDeleteItem}
        onDragStart={() => handleItemDrag(drag)}
      />
    </ScaleDecorator>
  ), [onToggleCheck, onDeleteItem, handleItemDrag]);

  const handleDragEnd = useCallback(({ data }: { data: DishItem[] }) => {
    onReorderItems?.(dish.id, data);
  }, [dish.id, onReorderItems]);

  return (
    <ScaleDecorator activeScale={1.02}>
      <View
        style={[
          styles.container,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isActive && { opacity: 0.9, elevation: 8, shadowOpacity: 0.5 },
        ]}
      >
        <View style={[styles.leftBorder, { backgroundColor: colors.primary }]} />
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.dishNameArea}
              onPress={() => onPressDishName(dish)}
              onLongPress={onDragStart}
              delayLongPress={200}
            >
              <Text style={[styles.dishName, { color: colors.primaryLight }]} numberOfLines={1}>
                {dish.name}
              </Text>
            </TouchableOpacity>
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={() => onAddItem(dish.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.headerBtn, { color: colors.primaryLight }]}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDeleteDish(dish)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.headerBtn, { color: colors.textMuted }]}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
          {allItems.length > 0 && (
            <NestableDraggableFlatList
              data={allItems}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              onDragEnd={handleDragEnd}
              scrollEnabled={false}
            />
          )}
        </View>
      </View>
    </ScaleDecorator>
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
  headerBtn: {
    fontSize: 22,
    fontWeight: '500',
  },
});
