import { useState, useRef, useCallback, type ReactNode } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  type GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';

export interface DragOverlayState {
  renderFloating: () => ReactNode;
  dragYAnim: Animated.Value;
  onMove: (pageY: number) => void;
  onEnd: () => void;
}

interface DraggableListProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onReorder: (data: T[]) => void;
  onDragStateChange?: (overlay: DragOverlayState | null) => void;
}

interface ItemLayout {
  pageY: number;
  height: number;
}

export function DraggableList<T>({ data, keyExtractor, renderItem, onReorder, onDragStateChange }: DraggableListProps<T>) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [displayOrder, setDisplayOrder] = useState<T[] | null>(null);

  const itemRefs = useRef<Map<string, View>>(new Map());
  const dragYAnim = useRef(new Animated.Value(0)).current;
  const currentIndexRef = useRef(-1);
  const orderRef = useRef<T[]>([]);
  const dragHeightRef = useRef(0);
  const orderedLayoutsRef = useRef<ItemLayout[]>([]);
  const dragActiveRef = useRef(false);

  const measureAllItems = useCallback((): Promise<Map<string, ItemLayout>> => {
    return new Promise((resolve) => {
      const result = new Map<string, ItemLayout>();
      const keys = data.map(keyExtractor);
      let measured = 0;
      const total = keys.length;
      if (total === 0) { resolve(result); return; }

      keys.forEach((key) => {
        const ref = itemRefs.current.get(key);
        if (ref) {
          ref.measureInWindow((_x, y, _w, height) => {
            result.set(key, { pageY: y, height });
            measured++;
            if (measured === total) resolve(result);
          });
        } else {
          measured++;
          if (measured === total) resolve(result);
        }
      });
    });
  }, [data, keyExtractor]);

  const handleDragEnd = useCallback(() => {
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    const finalOrder = orderRef.current;
    setActiveKey(null);
    setDisplayOrder(null);
    onDragStateChange?.(null);
    onReorder(finalOrder);
  }, [onReorder, onDragStateChange]);

  const handleDragMove = useCallback((pageY: number) => {
    if (!dragActiveRef.current) return;

    dragYAnim.setValue(pageY - dragHeightRef.current / 2);

    const fromIdx = currentIndexRef.current;
    const layouts = orderedLayoutsRef.current;

    let targetIdx = fromIdx;
    for (let i = 0; i < layouts.length; i++) {
      const midY = layouts[i].pageY + layouts[i].height / 2;
      if (pageY < midY) {
        targetIdx = i;
        break;
      }
      if (i === layouts.length - 1) {
        targetIdx = layouts.length - 1;
      }
    }

    if (targetIdx !== fromIdx) {
      const newOrder = [...orderRef.current];
      const [moved] = newOrder.splice(fromIdx, 1);
      newOrder.splice(targetIdx, 0, moved);

      const newLayouts = [...layouts];
      const [movedL] = newLayouts.splice(fromIdx, 1);
      newLayouts.splice(targetIdx, 0, movedL);

      // pageYを再計算
      let accY = newLayouts[0]?.pageY ?? 0;
      for (let i = 0; i < newLayouts.length; i++) {
        newLayouts[i] = { ...newLayouts[i], pageY: accY };
        accY += newLayouts[i].height;
      }

      orderRef.current = newOrder;
      orderedLayoutsRef.current = newLayouts;
      currentIndexRef.current = targetIdx;
      setActiveKey(keyExtractor(newOrder[targetIdx]));
      setDisplayOrder([...newOrder]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [dragYAnim, keyExtractor]);

  const handleLongPress = useCallback(async (index: number, pageY: number) => {
    if (dragActiveRef.current) return;

    const layoutMap = await measureAllItems();

    const order = [...data];
    orderRef.current = order;
    currentIndexRef.current = index;

    const key = keyExtractor(order[index]);
    const layout = layoutMap.get(key);
    dragHeightRef.current = layout?.height ?? 50;

    orderedLayoutsRef.current = order.map((item) => {
      const l = layoutMap.get(keyExtractor(item));
      return l ?? { pageY: 0, height: 50 };
    });

    dragYAnim.setValue(pageY - dragHeightRef.current / 2);
    dragActiveRef.current = true;

    setActiveKey(key);
    setDisplayOrder(order);

    // 親に「オーバーレイを出してくれ」と伝える
    onDragStateChange?.({
      renderFloating: () => renderItem(order[index], index),
      dragYAnim,
      onMove: handleDragMove,
      onEnd: handleDragEnd,
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [data, keyExtractor, measureAllItems, dragYAnim, renderItem, handleDragMove, handleDragEnd, onDragStateChange]);

  const items = displayOrder ?? data;

  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const key = keyExtractor(item);
        const isBeingDragged = key === activeKey;
        return (
          <View
            key={key}
            ref={(ref) => { if (ref) itemRefs.current.set(key, ref); }}
            style={isBeingDragged ? styles.placeholder : undefined}
            collapsable={false}
          >
            <DraggableItem
              index={index}
              onLongPress={handleLongPress}
              disabled={dragActiveRef.current}
            >
              {renderItem(item, index)}
            </DraggableItem>
          </View>
        );
      })}
    </View>
  );
}

// 親コンポーネントが使うオーバーレイ描画ヘルパー
export function DragOverlay({ state }: { state: DragOverlayState | null }) {
  if (!state) return null;

  return (
    <View
      style={styles.overlay}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderMove={(e) => state.onMove(e.nativeEvent.pageY)}
      onResponderRelease={() => state.onEnd()}
      onResponderTerminate={() => state.onEnd()}
    >
      <Animated.View
        style={[
          styles.floating,
          { transform: [{ translateY: state.dragYAnim }] },
        ]}
        pointerEvents="none"
      >
        {state.renderFloating()}
      </Animated.View>
    </View>
  );
}

interface DraggableItemProps {
  index: number;
  children: ReactNode;
  onLongPress: (index: number, pageY: number) => void;
  disabled: boolean;
}

function DraggableItem({ index, children, onLongPress, disabled }: DraggableItemProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startYRef = useRef(0);

  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    if (disabled) return;
    startYRef.current = e.nativeEvent.pageY;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onLongPress(index, startYRef.current);
    }, 400);
  }, [index, onLongPress, disabled]);

  const handleTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    if (timerRef.current) {
      const dy = Math.abs(e.nativeEvent.pageY - startYRef.current);
      if (dy > 8) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  return (
    <View
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  placeholder: {
    opacity: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  floating: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
});
