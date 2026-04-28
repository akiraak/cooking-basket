export interface DishGroupLayout {
  pageY: number;
  height: number;
}

// pageY を含む料理 id を返す。0 は「その他」セクションを表す。どこにも含まれなければ null。
// 複数領域に重なる場合は Map の挿入順で最後にマッチした id が勝つ。
export function pickTargetDishId(
  layouts: Map<number, DishGroupLayout>,
  pageY: number,
): number | null {
  let targetId: number | null = null;
  layouts.forEach((layout, dishId) => {
    if (pageY >= layout.pageY && pageY <= layout.pageY + layout.height) {
      targetId = dishId;
    }
  });
  return targetId;
}
