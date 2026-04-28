import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';
import { useShoppingStore } from '../stores/shopping-store';
import { pickTargetDishId, type DishGroupLayout } from './dish-drag-helpers';

interface UseDishDragCoordinatorOptions {
  // targetDishId === 0 は「その他」セクションを表す
  onMoveSuccess: (targetDishId: number) => void;
  onMoveError: () => void;
}

export function useDishDragCoordinator({
  onMoveSuccess,
  onMoveError,
}: UseDishDragCoordinatorOptions) {
  const [scrollEnabled, setScrollEnabled] = useState(true);
  // 0 = ungrouped, null = 候補なし
  const [dropTargetDishId, setDropTargetDishId] = useState<number | null>(null);
  const [draggingFromDishId, setDraggingFromDishId] = useState<number | null>(null);
  const dishGroupRefs = useRef<Map<number, View>>(new Map());
  const dishGroupLayouts = useRef<Map<number, DishGroupLayout>>(new Map());

  const measureDishGroups = useCallback(() => {
    dishGroupLayouts.current.clear();
    const promises: Promise<void>[] = [];
    dishGroupRefs.current.forEach((ref, dishId) => {
      promises.push(new Promise((resolve) => {
        ref.measureInWindow((_x, y, _w, height) => {
          dishGroupLayouts.current.set(dishId, { pageY: y, height });
          resolve();
        });
      }));
    });
    return Promise.all(promises);
  }, []);

  const registerDishGroup = useCallback(
    (id: number) => (ref: View | null) => {
      if (ref) dishGroupRefs.current.set(id, ref);
    },
    [],
  );

  // 料理リスト並び替え用（dish 自体が drag されているとき）
  const handleOuterDragStart = useCallback(() => setScrollEnabled(false), []);
  const handleOuterDragEnd = useCallback(() => setScrollEnabled(true), []);

  // 料理内食材のドラッグ
  const handleItemDragStart = useCallback((dishId: number) => {
    setScrollEnabled(false);
    setDraggingFromDishId(dishId);
    measureDishGroups();
  }, [measureDishGroups]);

  const handleItemDragEnd = useCallback(() => {
    setScrollEnabled(true);
    setDraggingFromDishId(null);
  }, []);

  const handleItemDragMove = useCallback((pageY: number) => {
    const targetId = pickTargetDishId(dishGroupLayouts.current, pageY);
    setDropTargetDishId((prev) => (prev !== targetId ? targetId : prev));
  }, []);

  const handleItemDrop = useCallback(async (sourceDishId: number, itemId: number, _pageY: number) => {
    setDraggingFromDishId(null);
    const targetDishId = dropTargetDishId;
    setDropTargetDishId(null);

    if (targetDishId !== null && targetDishId !== sourceDishId) {
      try {
        await useShoppingStore.getState().moveItemToDish(itemId, targetDishId === 0 ? null : targetDishId);
        onMoveSuccess(targetDishId);
      } catch {
        onMoveError();
      }
    }
  }, [dropTargetDishId, onMoveSuccess, onMoveError]);

  // その他食材のドラッグ
  const handleUngroupedDragStart = useCallback(() => {
    setScrollEnabled(false);
    setDraggingFromDishId(0);
    measureDishGroups();
  }, [measureDishGroups]);

  const handleUngroupedDragEnd = useCallback(() => {
    setScrollEnabled(true);
    setDraggingFromDishId(null);
  }, []);

  const handleUngroupedDrop = useCallback((item: { id: number }, pageY: number) => {
    handleItemDrop(0, item.id, pageY);
  }, [handleItemDrop]);

  return {
    scrollEnabled,
    dropTargetDishId,
    draggingFromDishId,
    registerDishGroup,
    outerDragHandlers: {
      onDragStart: handleOuterDragStart,
      onDragEnd: handleOuterDragEnd,
    },
    dishGroupHandlers: {
      onDragStart: handleItemDragStart,
      onDragEnd: handleItemDragEnd,
      onItemDragMove: handleItemDragMove,
      onItemDrop: handleItemDrop,
    },
    ungroupedHandlers: {
      onDragStart: handleUngroupedDragStart,
      onDragEnd: handleUngroupedDragEnd,
      onDragMoveY: handleItemDragMove,
      onDragDrop: handleUngroupedDrop,
    },
  };
}
