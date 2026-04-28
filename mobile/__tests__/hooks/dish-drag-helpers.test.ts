import { pickTargetDishId, type DishGroupLayout } from '../../src/hooks/dish-drag-helpers';

describe('pickTargetDishId', () => {
  it('returns null when pageY is outside every layout', () => {
    const layouts = new Map<number, DishGroupLayout>([
      [1, { pageY: 100, height: 80 }],
      [2, { pageY: 200, height: 80 }],
    ]);
    expect(pickTargetDishId(layouts, 50)).toBeNull();
    expect(pickTargetDishId(layouts, 1000)).toBeNull();
  });

  it('matches the upper edge inclusively', () => {
    const layouts = new Map<number, DishGroupLayout>([
      [7, { pageY: 100, height: 50 }],
    ]);
    expect(pickTargetDishId(layouts, 100)).toBe(7);
  });

  it('matches the lower edge inclusively', () => {
    const layouts = new Map<number, DishGroupLayout>([
      [7, { pageY: 100, height: 50 }],
    ]);
    expect(pickTargetDishId(layouts, 150)).toBe(7);
  });

  it('returns the last matching id when layouts overlap (insertion order wins)', () => {
    const layouts = new Map<number, DishGroupLayout>();
    layouts.set(1, { pageY: 100, height: 100 });
    layouts.set(2, { pageY: 150, height: 100 }); // 150-200 で 1 と重なる
    // pageY=170 は両方に含まれる: 後勝ちで 2 が返る
    expect(pickTargetDishId(layouts, 170)).toBe(2);
  });

  it('treats 0 as a valid dish id (ungrouped section)', () => {
    const layouts = new Map<number, DishGroupLayout>([
      [0, { pageY: 300, height: 60 }],
    ]);
    expect(pickTargetDishId(layouts, 320)).toBe(0);
  });
});
