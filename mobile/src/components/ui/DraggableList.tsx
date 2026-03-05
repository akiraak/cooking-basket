import { useState, useRef, useCallback, type ReactNode } from 'react';
import {
  View,
  PanResponder,
  Animated,
  StyleSheet,
  type LayoutChangeEvent,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface DraggableListProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onReorder: (data: T[]) => void;
}

export function DraggableList<T>({ data, keyExtractor, renderItem, onReorder }: DraggableListProps<T>) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [currentOrder, setCurrentOrder] = useState<T[] | null>(null);

  // レイアウト情報（各アイテムのY座標と高さ）
  const layoutsRef = useRef<Map<number, { y: number; height: number }>>(new Map());
  const containerRef = useRef<View>(null);
  const containerYRef = useRef(0);

  // ドラッグ中のアニメーション値
  const dragY = useRef(new Animated.Value(0)).current;
  const dragOpacity = useRef(new Animated.Value(0)).current;
  const draggedItemYRef = useRef(0);
  const draggedIndexRef = useRef(-1);
  const orderRef = useRef<T[]>(data);

  const handleLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    layoutsRef.current.set(index, { y, height });
  }, []);

  const startDrag = useCallback((index: number, pageY: number) => {
    // コンテナのページ上の位置を取得
    containerRef.current?.measureInWindow((_x, y) => {
      containerYRef.current = y;

      const layout = layoutsRef.current.get(index);
      if (!layout) return;

      draggedIndexRef.current = index;
      draggedItemYRef.current = layout.y;
      orderRef.current = [...data];

      // ドラッグ開始位置を設定
      dragY.setValue(layout.y);
      dragOpacity.setValue(1);

      setDraggingIndex(index);
      setCurrentOrder([...data]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });
  }, [data, dragY, dragOpacity]);

  const moveDrag = useCallback((moveY: number) => {
    const relativeY = moveY - containerYRef.current;
    const layouts = layoutsRef.current;
    const order = orderRef.current;
    const fromIdx = draggedIndexRef.current;

    // フローティングアイテムの位置を更新
    dragY.setValue(relativeY - (layouts.get(fromIdx)?.height ?? 40) / 2);

    // どの位置に入るか計算
    let targetIdx = fromIdx;
    let accY = 0;
    for (let i = 0; i < order.length; i++) {
      const h = layouts.get(i)?.height ?? 40;
      if (relativeY < accY + h / 2) {
        targetIdx = i;
        break;
      }
      accY += h;
      if (i === order.length - 1) {
        targetIdx = order.length - 1;
      }
    }

    if (targetIdx !== fromIdx) {
      // 配列を入れ替え
      const newOrder = [...order];
      const [moved] = newOrder.splice(fromIdx, 1);
      newOrder.splice(targetIdx, 0, moved);
      orderRef.current = newOrder;
      draggedIndexRef.current = targetIdx;
      setCurrentOrder(newOrder);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [dragY]);

  const endDrag = useCallback(() => {
    dragOpacity.setValue(0);
    const finalOrder = orderRef.current;
    setDraggingIndex(null);
    setCurrentOrder(null);
    onReorder(finalOrder);
  }, [dragOpacity, onReorder]);

  const displayData = currentOrder ?? data;

  return (
    <View ref={containerRef} style={styles.container}>
      {displayData.map((item, index) => {
        const key = keyExtractor(item);
        const isDragged = draggingIndex !== null && currentOrder !== null &&
          keyExtractor(currentOrder[draggingIndex]) === key;
        // Temporarily show original at reduced opacity while dragging
        // Actually: hide the dragged item in place, show it as floating
        return (
          <DraggableItem
            key={key}
            index={index}
            onLayout={(e) => handleLayout(index, e)}
            onLongPress={(pageY) => startDrag(index, pageY)}
            onMove={moveDrag}
            onRelease={endDrag}
            isDragging={draggingIndex !== null}
            isDraggedItem={isDragged}
          >
            {renderItem(item, index)}
          </DraggableItem>
        );
      })}

      {/* フローティング（ドラッグ中のアイテム） */}
      {draggingIndex !== null && currentOrder !== null && (
        <Animated.View
          style={[
            styles.floating,
            {
              opacity: dragOpacity,
              transform: [{ translateY: dragY }],
            },
          ]}
          pointerEvents="none"
        >
          {renderItem(currentOrder[draggedIndexRef.current], draggedIndexRef.current)}
        </Animated.View>
      )}
    </View>
  );
}

interface DraggableItemProps {
  index: number;
  children: ReactNode;
  onLayout: (e: LayoutChangeEvent) => void;
  onLongPress: (pageY: number) => void;
  onMove: (moveY: number) => void;
  onRelease: () => void;
  isDragging: boolean;
  isDraggedItem: boolean;
}

function DraggableItem({
  children,
  onLayout,
  onLongPress,
  onMove,
  onRelease,
  isDragging,
  isDraggedItem,
}: DraggableItemProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveDrag = useRef(false);
  const startPageY = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, gs) => {
        // 長押し後にドラッグ開始していればキャプチャ
        return isActiveDrag.current && Math.abs(gs.dy) > 2;
      },
      onPanResponderGrant: () => {},
      onPanResponderMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
        if (isActiveDrag.current) {
          onMove(gs.moveY);
        }
      },
      onPanResponderRelease: () => {
        if (isActiveDrag.current) {
          isActiveDrag.current = false;
          onRelease();
        }
      },
      onPanResponderTerminate: () => {
        if (isActiveDrag.current) {
          isActiveDrag.current = false;
          onRelease();
        }
      },
    })
  ).current;

  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    startPageY.current = e.nativeEvent.pageY;
    longPressTimer.current = setTimeout(() => {
      isActiveDrag.current = true;
      onLongPress(startPageY.current);
    }, 300);
  }, [onLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isActiveDrag.current) {
      isActiveDrag.current = false;
      onRelease();
    }
  }, [onRelease]);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    // 長押し判定中に指が動いたらキャンセル
    if (!isActiveDrag.current && longPressTimer.current) {
      const dy = Math.abs(e.nativeEvent.pageY - startPageY.current);
      if (dy > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  return (
    <View
      onLayout={onLayout}
      style={[isDraggedItem && styles.draggedPlaceholder]}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      {...panResponder.panHandlers}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  floating: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  draggedPlaceholder: {
    opacity: 0.3,
  },
});
