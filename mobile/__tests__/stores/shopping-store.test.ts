import type { Dish, ShoppingItem } from '../../src/types/models';

jest.mock('../../src/api/shopping', () => ({
  getAllItems: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  deleteCheckedItems: jest.fn(),
  reorderItems: jest.fn(),
}));

jest.mock('../../src/api/dishes', () => ({
  getAllDishes: jest.fn(),
  createDish: jest.fn(),
  updateDish: jest.fn(),
  deleteDish: jest.fn(),
  updateDishAiCache: jest.fn(),
  linkItemToDish: jest.fn(),
  unlinkItemFromDish: jest.fn(),
  reorderDishes: jest.fn(),
  reorderDishItems: jest.fn(),
}));

jest.mock('../../src/api/ai', () => {
  class AiQuotaError extends Error {
    remaining = 0;
    resetAt: string | null;
    constructor(resetAt: string | null = null) {
      super('ai_quota_exceeded');
      this.name = 'AiQuotaError';
      this.resetAt = resetAt;
    }
  }
  return {
    suggestAi: jest.fn(),
    AiQuotaError,
  };
});

import * as shoppingApi from '../../src/api/shopping';
import * as dishesApi from '../../src/api/dishes';
import * as aiApi from '../../src/api/ai';
import { useShoppingStore } from '../../src/stores/shopping-store';
import { useRecipeStore } from '../../src/stores/recipe-store';
import { useAiStore } from '../../src/stores/ai-store';

const shopping = shoppingApi as jest.Mocked<typeof shoppingApi>;
const dishes = dishesApi as jest.Mocked<typeof dishesApi>;
const ai = aiApi as jest.Mocked<typeof aiApi>;

function makeItem(partial: Partial<ShoppingItem> & { id: number; name: string }): ShoppingItem {
  return {
    id: partial.id,
    name: partial.name,
    category: partial.category ?? '',
    checked: partial.checked ?? 0,
    dish_id: partial.dish_id ?? null,
    position: partial.position ?? 0,
    created_at: partial.created_at ?? '2026-01-01T00:00:00Z',
    updated_at: partial.updated_at ?? '2026-01-01T00:00:00Z',
  };
}

function makeDish(partial: Partial<Dish> & { id: number; name: string }): Dish {
  return {
    id: partial.id,
    name: partial.name,
    ingredients_json: partial.ingredients_json ?? null,
    recipes_json: partial.recipes_json ?? null,
    items: partial.items ?? [],
    created_at: partial.created_at ?? '2026-01-01T00:00:00Z',
    updated_at: partial.updated_at ?? '2026-01-01T00:00:00Z',
  };
}

function resetStore(mode: 'local' | 'server') {
  useShoppingStore.setState({
    mode,
    items: [],
    dishes: [],
    loading: false,
    nextLocalId: -1,
  });
  useRecipeStore.setState({
    mode,
    savedRecipes: [],
    loading: false,
    nextLocalId: -1,
  });
  useAiStore.setState({ remaining: null, quotaExceeded: false, resetAt: null });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// State mutations
//
// 各アクションの state 遷移は **mode に依存しない**（store 本体は backend を
// 切り替えるだけで、`set(...)` の中身は両モードで同一）。重複を避けるため、
// 状態遷移のテストは server モード一択で書く。backend 自体の挙動は
// `backends/shopping-backend.test.ts` で別途カバー。
// ---------------------------------------------------------------------------
describe('shopping-store / state mutations', () => {
  beforeEach(() => resetStore('server'));

  it('addItem prepends the new item and rebuilds dish.items', async () => {
    const existing = makeItem({ id: 1, name: 'たまねぎ' });
    const created = makeItem({ id: 2, name: 'にんじん' });
    shopping.createItem.mockResolvedValue(created);
    useShoppingStore.setState({ items: [existing] });

    const result = await useShoppingStore.getState().addItem('にんじん', '野菜');

    expect(shopping.createItem).toHaveBeenCalledWith('にんじん', '野菜');
    expect(shopping.getAllItems).not.toHaveBeenCalled();
    expect(result).toEqual(created);
    expect(useShoppingStore.getState().items.map((i) => i.id)).toEqual([2, 1]);
  });

  it('addDish prepends the new dish', async () => {
    const existing = makeDish({ id: 10, name: 'カレー' });
    const created = makeDish({ id: 20, name: '豚汁' });
    dishes.createDish.mockResolvedValue(created);
    useShoppingStore.setState({ dishes: [existing] });

    const result = await useShoppingStore.getState().addDish('豚汁');

    expect(dishes.createDish).toHaveBeenCalledWith('豚汁');
    expect(dishes.getAllDishes).not.toHaveBeenCalled();
    expect(result).toEqual(created);
    expect(useShoppingStore.getState().dishes.map((d) => d.id)).toEqual([20, 10]);
  });

  it('updateItemName updates the name in items and nested dish.items', async () => {
    shopping.updateItem.mockResolvedValue(makeItem({ id: 1, name: 'にんじん（小）' }));
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', dish_id: 10 })],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [{ id: 1, name: 'にんじん', category: '', checked: 0 }],
        }),
      ],
    });

    await useShoppingStore.getState().updateItemName(1, 'にんじん（小）');

    expect(shopping.updateItem).toHaveBeenCalledWith(1, { name: 'にんじん（小）' });
    const state = useShoppingStore.getState();
    expect(state.items[0].name).toBe('にんじん（小）');
    expect(state.dishes[0].items[0].name).toBe('にんじん（小）');
  });

  it('toggleCheck flips checked in items and nested dish.items', async () => {
    shopping.updateItem.mockResolvedValue(makeItem({ id: 1, name: 'にんじん', checked: 1 }));
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', checked: 0 })],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [{ id: 1, name: 'にんじん', category: '', checked: 0 }],
        }),
      ],
    });

    await useShoppingStore.getState().toggleCheck(1, 1);

    expect(shopping.updateItem).toHaveBeenCalledWith(1, { checked: 1 });
    const state = useShoppingStore.getState();
    expect(state.items[0].checked).toBe(1);
    expect(state.dishes[0].items[0].checked).toBe(1);
  });

  it('toggleCheck does not touch unrelated items', async () => {
    shopping.updateItem.mockResolvedValue(makeItem({ id: 2, name: 'たまねぎ', checked: 1 }));
    useShoppingStore.setState({
      items: [
        makeItem({ id: 1, name: 'にんじん', checked: 0 }),
        makeItem({ id: 2, name: 'たまねぎ', checked: 0 }),
      ],
    });

    await useShoppingStore.getState().toggleCheck(2, 1);

    const state = useShoppingStore.getState();
    expect(state.items[0].checked).toBe(0);
    expect(state.items[1].checked).toBe(1);
  });

  it('deleteItem removes the item from state and nested dishes', async () => {
    shopping.deleteItem.mockResolvedValue(null);
    useShoppingStore.setState({
      items: [
        makeItem({ id: 1, name: 'にんじん' }),
        makeItem({ id: 2, name: 'たまねぎ' }),
      ],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [
            { id: 1, name: 'にんじん', category: '', checked: 0 },
            { id: 2, name: 'たまねぎ', category: '', checked: 0 },
          ],
        }),
      ],
    });

    await useShoppingStore.getState().deleteItem(1);

    expect(shopping.deleteItem).toHaveBeenCalledWith(1);
    expect(shopping.getAllItems).not.toHaveBeenCalled();
    const state = useShoppingStore.getState();
    expect(state.items.map((i) => i.id)).toEqual([2]);
    expect(state.dishes[0].items.map((i) => i.id)).toEqual([2]);
  });

  it('deleteCheckedItems returns the backend count and filters checked items + dish.items', async () => {
    shopping.deleteCheckedItems.mockResolvedValue(2);
    useShoppingStore.setState({
      items: [
        makeItem({ id: 1, name: 'A', checked: 1 }),
        makeItem({ id: 2, name: 'B', checked: 0 }),
        makeItem({ id: 3, name: 'C', checked: 1, dish_id: 10 }),
      ],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [{ id: 3, name: 'C', category: '', checked: 1 }],
        }),
      ],
    });

    const count = await useShoppingStore.getState().deleteCheckedItems();

    expect(shopping.deleteCheckedItems).toHaveBeenCalled();
    expect(shopping.getAllItems).not.toHaveBeenCalled();
    expect(count).toBe(2);
    const state = useShoppingStore.getState();
    expect(state.items.map((i) => i.id)).toEqual([2]);
    expect(state.dishes[0].items).toEqual([]);
  });

  it('deleteDish removes the dish and unlinks its items (dish_id -> null)', async () => {
    dishes.deleteDish.mockResolvedValue(null);
    useShoppingStore.setState({
      items: [
        makeItem({ id: 1, name: 'にんじん', dish_id: 10 }),
        makeItem({ id: 2, name: 'たまねぎ', dish_id: null }),
      ],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [{ id: 1, name: 'にんじん', category: '', checked: 0 }],
        }),
      ],
    });

    await useShoppingStore.getState().deleteDish(10);

    expect(dishes.deleteDish).toHaveBeenCalledWith(10);
    expect(dishes.getAllDishes).not.toHaveBeenCalled();
    const state = useShoppingStore.getState();
    expect(state.dishes).toEqual([]);
    expect(state.items.find((i) => i.id === 1)?.dish_id).toBeNull();
  });

  it('updateDish updates the dish name', async () => {
    dishes.updateDish.mockResolvedValue(makeDish({ id: 10, name: '豚汁' }));
    useShoppingStore.setState({
      dishes: [makeDish({ id: 10, name: 'カレー' })],
    });

    await useShoppingStore.getState().updateDish(10, '豚汁');

    expect(dishes.updateDish).toHaveBeenCalledWith(10, '豚汁');
    expect(useShoppingStore.getState().dishes[0].name).toBe('豚汁');
  });

  it('linkItemToDish updates dish_id and rebuilds dish.items', async () => {
    dishes.linkItemToDish.mockResolvedValue(makeDish({ id: 10, name: 'カレー' }));
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', dish_id: null })],
      dishes: [makeDish({ id: 10, name: 'カレー', items: [] })],
    });

    await useShoppingStore.getState().linkItemToDish(10, 1);

    expect(dishes.linkItemToDish).toHaveBeenCalledWith(10, 1);
    expect(dishes.getAllDishes).not.toHaveBeenCalled();
    const state = useShoppingStore.getState();
    expect(state.items[0].dish_id).toBe(10);
    expect(state.dishes[0].items.map((i) => i.id)).toEqual([1]);
  });

  it('unlinkItemFromDish clears dish_id and rebuilds dish.items', async () => {
    dishes.unlinkItemFromDish.mockResolvedValue(null);
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', dish_id: 10 })],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [{ id: 1, name: 'にんじん', category: '', checked: 0 }],
        }),
      ],
    });

    await useShoppingStore.getState().unlinkItemFromDish(10, 1);

    expect(dishes.unlinkItemFromDish).toHaveBeenCalledWith(10, 1);
    expect(dishes.getAllDishes).not.toHaveBeenCalled();
    const state = useShoppingStore.getState();
    expect(state.items[0].dish_id).toBeNull();
    expect(state.dishes[0].items).toEqual([]);
  });

  it('loadAll fetches items + dishes and toggles the loading flag', async () => {
    const items = [makeItem({ id: 1, name: 'A' })];
    const ds = [makeDish({ id: 10, name: 'カレー' })];
    shopping.getAllItems.mockResolvedValue(items);
    dishes.getAllDishes.mockResolvedValue(ds);

    await useShoppingStore.getState().loadAll();

    expect(shopping.getAllItems).toHaveBeenCalled();
    expect(dishes.getAllDishes).toHaveBeenCalled();
    const state = useShoppingStore.getState();
    expect(state.items).toEqual(items);
    expect(state.dishes).toEqual(ds);
    expect(state.loading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Backend selection
//
// state 遷移は mode に依存しないが、「mode フラグが正しい backend を選んでいるか」
// は別途検証しておく。詳細な backend 挙動は backends/ 側のテストでカバー済み。
// ---------------------------------------------------------------------------
describe('shopping-store / backend selection', () => {
  it('local mode: addItem allocates a negative id and skips the api', async () => {
    resetStore('local');
    const item = await useShoppingStore.getState().addItem('豚肉', '肉');

    expect(shopping.createItem).not.toHaveBeenCalled();
    expect(item.id).toBe(-1);
    expect(item.name).toBe('豚肉');
    expect(useShoppingStore.getState().items.map((i) => i.id)).toEqual([-1]);
    expect(useShoppingStore.getState().nextLocalId).toBe(-2);
  });

  it('local mode: deleteItem skips the api but still mutates state', async () => {
    resetStore('local');
    const item = await useShoppingStore.getState().addItem('牛乳');
    await useShoppingStore.getState().deleteItem(item.id);

    expect(shopping.deleteItem).not.toHaveBeenCalled();
    expect(useShoppingStore.getState().items).toHaveLength(0);
  });

  it('local mode: reorderItems mutates state but does not call the api', async () => {
    resetStore('local');
    useShoppingStore.setState({
      items: [
        makeItem({ id: 1, name: 'A', position: 0 }),
        makeItem({ id: 2, name: 'B', position: 1 }),
      ],
    });

    await useShoppingStore.getState().reorderItems([2, 1]);

    expect(shopping.reorderItems).not.toHaveBeenCalled();
    expect(useShoppingStore.getState().items.map((i) => i.id)).toEqual([2, 1]);
  });

  it('local mode: reorderDishes mutates state but does not call the api', async () => {
    resetStore('local');
    useShoppingStore.setState({
      dishes: [makeDish({ id: 10, name: 'A' }), makeDish({ id: 20, name: 'B' })],
    });

    await useShoppingStore.getState().reorderDishes([20, 10]);

    expect(dishes.reorderDishes).not.toHaveBeenCalled();
    expect(useShoppingStore.getState().dishes.map((d) => d.id)).toEqual([20, 10]);
  });

  it('local mode: addDish + linkItemToDish wires the item via negative ids end-to-end', async () => {
    resetStore('local');
    const dish = await useShoppingStore.getState().addDish('豚汁');
    const item = await useShoppingStore.getState().addItem('豚肉', '肉');
    await useShoppingStore.getState().linkItemToDish(dish.id, item.id);

    expect(dishes.linkItemToDish).not.toHaveBeenCalled();
    expect(dish.id).toBeLessThan(0);
    expect(item.id).toBeLessThan(0);
    const state = useShoppingStore.getState();
    expect(state.dishes[0].items.map((i) => i.id)).toEqual([item.id]);
    expect(state.items.find((i) => i.id === item.id)?.dish_id).toBe(dish.id);
  });
});

// ---------------------------------------------------------------------------
// reorder symmetry
//
// reorder 系は refactor-09 Phase 3 で両モード対称化された:
// - 楽観更新で state を反映 → backend を呼ぶ → 失敗時はスナップショット復元 → 再 throw
// 状態遷移は他のアクションと同じく mode に依存しないので、state 検証は
// server モード一択で書く（backend 自体の挙動は backends/ 側のテストで担保）。
// 「mode に応じて backend が呼ばれる / 呼ばれない」だけは backend selection 節で確認。
// ---------------------------------------------------------------------------
describe('shopping-store / reorder symmetry', () => {
  beforeEach(() => resetStore('server'));

  it('reorderItems: reorders the subset slots in the items array and updates positions', async () => {
    shopping.reorderItems.mockResolvedValue(null);
    useShoppingStore.setState({
      items: [
        makeItem({ id: 1, name: 'A', position: 0 }),
        makeItem({ id: 2, name: 'B', position: 1 }),
        makeItem({ id: 3, name: 'C', position: 2 }),
      ],
    });

    await useShoppingStore.getState().reorderItems([3, 1, 2]);

    expect(shopping.reorderItems).toHaveBeenCalledWith([3, 1, 2]);
    const state = useShoppingStore.getState();
    expect(state.items.map((i) => i.id)).toEqual([3, 1, 2]);
    const positionById = new Map(state.items.map((i) => [i.id, i.position]));
    expect(positionById.get(3)).toBe(0);
    expect(positionById.get(1)).toBe(1);
    expect(positionById.get(2)).toBe(2);
  });

  it('reorderItems: keeps non-subset items in their original slots', async () => {
    // 並び替え対象は ungrouped（dish_id null）で、料理に紐付く X / Y のスロット位置は
    // 不変であることを確認する
    shopping.reorderItems.mockResolvedValue(null);
    useShoppingStore.setState({
      items: [
        makeItem({ id: 1, name: 'A', dish_id: null, position: 0 }),
        makeItem({ id: 10, name: 'X', dish_id: 100, position: 5 }),
        makeItem({ id: 2, name: 'B', dish_id: null, position: 1 }),
        makeItem({ id: 20, name: 'Y', dish_id: 100, position: 6 }),
        makeItem({ id: 3, name: 'C', dish_id: null, position: 2 }),
      ],
    });

    await useShoppingStore.getState().reorderItems([3, 1, 2]);

    const state = useShoppingStore.getState();
    expect(state.items.map((i) => i.id)).toEqual([3, 10, 1, 20, 2]);
    // 非 subset 要素 (X, Y) は position も不変
    const xy = state.items.filter((i) => i.dish_id === 100);
    expect(xy.map((i) => i.position)).toEqual([5, 6]);
  });

  it('reorderItems: restores items snapshot on failure and rethrows', async () => {
    shopping.reorderItems.mockRejectedValue(new Error('reorder failed'));
    useShoppingStore.setState({
      items: [
        makeItem({ id: 1, name: 'A', position: 0 }),
        makeItem({ id: 2, name: 'B', position: 1 }),
      ],
    });
    const before = useShoppingStore.getState();

    await expect(useShoppingStore.getState().reorderItems([2, 1])).rejects.toThrow(
      'reorder failed',
    );

    const after = useShoppingStore.getState();
    expect(after.items).toEqual(before.items);
  });

  it('reorderDishes: sorts dishes by ordered ids', async () => {
    dishes.reorderDishes.mockResolvedValue(null);
    useShoppingStore.setState({
      dishes: [
        makeDish({ id: 10, name: 'A' }),
        makeDish({ id: 20, name: 'B' }),
        makeDish({ id: 30, name: 'C' }),
      ],
    });

    await useShoppingStore.getState().reorderDishes([30, 10, 20]);

    expect(dishes.reorderDishes).toHaveBeenCalledWith([30, 10, 20]);
    expect(useShoppingStore.getState().dishes.map((d) => d.id)).toEqual([30, 10, 20]);
  });

  it('reorderDishes: restores dishes snapshot on failure and rethrows', async () => {
    dishes.reorderDishes.mockRejectedValue(new Error('reorder dishes failed'));
    useShoppingStore.setState({
      dishes: [
        makeDish({ id: 10, name: 'A' }),
        makeDish({ id: 20, name: 'B' }),
      ],
    });
    const before = useShoppingStore.getState();

    await expect(useShoppingStore.getState().reorderDishes([20, 10])).rejects.toThrow(
      'reorder dishes failed',
    );

    const after = useShoppingStore.getState();
    expect(after.dishes).toEqual(before.dishes);
  });

  it('reorderDishItems: sorts a dish.items by ordered ids and updates positions', async () => {
    dishes.reorderDishItems.mockResolvedValue(null);
    useShoppingStore.setState({
      items: [
        makeItem({ id: 1, name: 'A', dish_id: 10, position: 0 }),
        makeItem({ id: 2, name: 'B', dish_id: 10, position: 1 }),
      ],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [
            { id: 1, name: 'A', category: '', checked: 0 },
            { id: 2, name: 'B', category: '', checked: 0 },
          ],
        }),
      ],
    });

    await useShoppingStore.getState().reorderDishItems(10, [2, 1]);

    expect(dishes.reorderDishItems).toHaveBeenCalledWith(10, [2, 1]);
    const state = useShoppingStore.getState();
    expect(state.dishes[0].items.map((i) => i.id)).toEqual([2, 1]);
    const positionById = new Map(state.items.map((i) => [i.id, i.position]));
    expect(positionById.get(2)).toBe(0);
    expect(positionById.get(1)).toBe(1);
  });

  it('reorderDishItems: restores items + dishes snapshot on failure and rethrows', async () => {
    dishes.reorderDishItems.mockRejectedValue(new Error('reorder dish items failed'));
    useShoppingStore.setState({
      items: [
        makeItem({ id: 1, name: 'A', dish_id: 10, position: 0 }),
        makeItem({ id: 2, name: 'B', dish_id: 10, position: 1 }),
      ],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [
            { id: 1, name: 'A', category: '', checked: 0 },
            { id: 2, name: 'B', category: '', checked: 0 },
          ],
        }),
      ],
    });
    const before = useShoppingStore.getState();

    await expect(
      useShoppingStore.getState().reorderDishItems(10, [2, 1]),
    ).rejects.toThrow('reorder dish items failed');

    const after = useShoppingStore.getState();
    expect(after.items).toEqual(before.items);
    expect(after.dishes).toEqual(before.dishes);
  });
});

// ---------------------------------------------------------------------------
// moveItemToDish
//
// 料理間 / その他⇔料理 の移動を unlink → link の合成として扱うアクション。
// 失敗時は操作前のスナップショットへ復元してから throw を再送出する
// （refactor-08 の「ロールバックなし」方針からの限定的方針転換、refactor-09 で
// moveItemToDish と reorder 系に限り適用）。
// ---------------------------------------------------------------------------
describe('shopping-store / moveItemToDish', () => {
  beforeEach(() => resetStore('server'));

  it('null -> dishId: links only (no unlink call)', async () => {
    dishes.linkItemToDish.mockResolvedValue(makeDish({ id: 10, name: 'カレー' }));
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', dish_id: null })],
      dishes: [makeDish({ id: 10, name: 'カレー', items: [] })],
    });

    await useShoppingStore.getState().moveItemToDish(1, 10);

    expect(dishes.unlinkItemFromDish).not.toHaveBeenCalled();
    expect(dishes.linkItemToDish).toHaveBeenCalledWith(10, 1);
    const state = useShoppingStore.getState();
    expect(state.items[0].dish_id).toBe(10);
    expect(state.dishes[0].items.map((i) => i.id)).toEqual([1]);
  });

  it('dishId -> null: unlinks only (no link call)', async () => {
    dishes.unlinkItemFromDish.mockResolvedValue(null);
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', dish_id: 10 })],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [{ id: 1, name: 'にんじん', category: '', checked: 0 }],
        }),
      ],
    });

    await useShoppingStore.getState().moveItemToDish(1, null);

    expect(dishes.unlinkItemFromDish).toHaveBeenCalledWith(10, 1);
    expect(dishes.linkItemToDish).not.toHaveBeenCalled();
    const state = useShoppingStore.getState();
    expect(state.items[0].dish_id).toBeNull();
    expect(state.dishes[0].items).toEqual([]);
  });

  it('dishId -> otherDishId: unlinks then links and rebuilds both dishes\' items', async () => {
    dishes.unlinkItemFromDish.mockResolvedValue(null);
    dishes.linkItemToDish.mockResolvedValue(makeDish({ id: 20, name: '豚汁' }));
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', dish_id: 10 })],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [{ id: 1, name: 'にんじん', category: '', checked: 0 }],
        }),
        makeDish({ id: 20, name: '豚汁', items: [] }),
      ],
    });

    await useShoppingStore.getState().moveItemToDish(1, 20);

    expect(dishes.unlinkItemFromDish).toHaveBeenCalledWith(10, 1);
    expect(dishes.linkItemToDish).toHaveBeenCalledWith(20, 1);
    const unlinkOrder = dishes.unlinkItemFromDish.mock.invocationCallOrder[0];
    const linkOrder = dishes.linkItemToDish.mock.invocationCallOrder[0];
    expect(unlinkOrder).toBeLessThan(linkOrder);
    const state = useShoppingStore.getState();
    expect(state.items[0].dish_id).toBe(20);
    expect(state.dishes.find((d) => d.id === 10)?.items).toEqual([]);
    expect(state.dishes.find((d) => d.id === 20)?.items.map((i) => i.id)).toEqual([1]);
  });

  it('same dish (from === to): no-op (no api call, state unchanged)', async () => {
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', dish_id: 10 })],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [{ id: 1, name: 'にんじん', category: '', checked: 0 }],
        }),
      ],
    });
    const before = useShoppingStore.getState();

    await useShoppingStore.getState().moveItemToDish(1, 10);

    expect(dishes.unlinkItemFromDish).not.toHaveBeenCalled();
    expect(dishes.linkItemToDish).not.toHaveBeenCalled();
    const after = useShoppingStore.getState();
    expect(after.items).toBe(before.items);
    expect(after.dishes).toBe(before.dishes);
  });

  it('null -> null: no-op (both ungrouped)', async () => {
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', dish_id: null })],
    });

    await useShoppingStore.getState().moveItemToDish(1, null);

    expect(dishes.unlinkItemFromDish).not.toHaveBeenCalled();
    expect(dishes.linkItemToDish).not.toHaveBeenCalled();
  });

  it('unknown itemId: silently no-op (no api call, no throw)', async () => {
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', dish_id: null })],
    });

    await useShoppingStore.getState().moveItemToDish(999, 10);

    expect(dishes.unlinkItemFromDish).not.toHaveBeenCalled();
    expect(dishes.linkItemToDish).not.toHaveBeenCalled();
  });

  it('failure on link restores state from snapshot and rethrows (null -> dishId)', async () => {
    dishes.linkItemToDish.mockRejectedValue(new Error('network'));
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', dish_id: null })],
      dishes: [makeDish({ id: 10, name: 'カレー', items: [] })],
    });
    const before = useShoppingStore.getState();

    await expect(useShoppingStore.getState().moveItemToDish(1, 10)).rejects.toThrow('network');

    const after = useShoppingStore.getState();
    expect(after.items).toEqual(before.items);
    expect(after.dishes).toEqual(before.dishes);
  });

  it('mid-step failure (unlink ok, link fails) restores state from snapshot and rethrows', async () => {
    dishes.unlinkItemFromDish.mockResolvedValue(null);
    dishes.linkItemToDish.mockRejectedValue(new Error('link failed'));
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'にんじん', dish_id: 10 })],
      dishes: [
        makeDish({
          id: 10,
          name: 'カレー',
          items: [{ id: 1, name: 'にんじん', category: '', checked: 0 }],
        }),
        makeDish({ id: 20, name: '豚汁', items: [] }),
      ],
    });
    const before = useShoppingStore.getState();

    await expect(useShoppingStore.getState().moveItemToDish(1, 20)).rejects.toThrow('link failed');

    expect(dishes.unlinkItemFromDish).toHaveBeenCalledWith(10, 1);
    expect(dishes.linkItemToDish).toHaveBeenCalledWith(20, 1);
    const after = useShoppingStore.getState();
    expect(after.items).toEqual(before.items);
    expect(after.dishes).toEqual(before.dishes);
  });
});

// ---------------------------------------------------------------------------
// suggestIngredients
//
// AI 呼出は mode に依らないが、`updateDishAiCache` の挙動が mode で分岐する
// （local backend は no-op、server backend は best-effort で API を叩く）。
// ---------------------------------------------------------------------------
describe('shopping-store / suggestIngredients', () => {
  it('calls suggestAi, caches result on the dish, and auto-saves recipes', async () => {
    resetStore('local');
    const dish = await useShoppingStore.getState().addDish('カレー');
    ai.suggestAi.mockResolvedValue({
      ingredients: [{ name: 'じゃがいも', category: '野菜' }],
      recipes: [
        {
          title: '基本のカレー',
          summary: 'おいしい',
          steps: ['切る', '煮る'],
          ingredients: [{ name: 'じゃがいも', category: '野菜' }],
        },
      ],
      remaining: 2,
    });

    const result = await useShoppingStore.getState().suggestIngredients(dish.id);

    expect(ai.suggestAi).toHaveBeenCalledWith('カレー', undefined);
    // local backend では updateDishAiCache は no-op (api を叩かない)
    expect(dishes.updateDishAiCache).not.toHaveBeenCalled();
    expect(result.ingredients).toHaveLength(1);
    expect(result.recipes).toHaveLength(1);
    expect(useAiStore.getState().remaining).toBe(2);

    const updated = useShoppingStore.getState().dishes.find((d) => d.id === dish.id);
    expect(updated?.ingredients_json).toContain('じゃがいも');

    const saved = useRecipeStore.getState().savedRecipes;
    expect(saved).toHaveLength(1);
    expect(saved[0].dish_name).toBe('カレー');
    expect(saved[0].id).toBeLessThan(0);
  });

  it('server mode: writes the ai cache best-effort to the api', async () => {
    resetStore('server');
    useShoppingStore.setState({
      dishes: [makeDish({ id: 10, name: 'カレー' })],
    });
    ai.suggestAi.mockResolvedValue({
      ingredients: [{ name: 'じゃがいも', category: '野菜' }],
      recipes: [],
      remaining: 5,
    });
    dishes.updateDishAiCache.mockResolvedValue(null);

    await useShoppingStore.getState().suggestIngredients(10);

    expect(dishes.updateDishAiCache).toHaveBeenCalledWith(
      10,
      [{ name: 'じゃがいも', category: '野菜' }],
      [],
    );
  });

  it('server mode: swallows updateDishAiCache failures (best-effort)', async () => {
    resetStore('server');
    useShoppingStore.setState({
      dishes: [makeDish({ id: 10, name: 'カレー' })],
    });
    ai.suggestAi.mockResolvedValue({
      ingredients: [{ name: 'A', category: '' }],
      recipes: [],
      remaining: 5,
    });
    dishes.updateDishAiCache.mockRejectedValue(new Error('cache write failed'));

    await expect(useShoppingStore.getState().suggestIngredients(10)).resolves.toBeDefined();

    // 失敗しても dish.ingredients_json は更新済み
    const updated = useShoppingStore.getState().dishes.find((d) => d.id === 10);
    expect(updated?.ingredients_json).toContain('A');
  });

  it('throws AiQuotaError and marks quota exceeded without calling the cache', async () => {
    resetStore('local');
    const dish = await useShoppingStore.getState().addDish('カレー');
    const resetAt = '2026-04-23T00:00:00+09:00';
    ai.suggestAi.mockRejectedValue(new aiApi.AiQuotaError(resetAt));

    await expect(useShoppingStore.getState().suggestIngredients(dish.id)).rejects.toBeInstanceOf(
      aiApi.AiQuotaError,
    );

    const aiState = useAiStore.getState();
    expect(aiState.quotaExceeded).toBe(true);
    expect(aiState.remaining).toBe(0);
    expect(aiState.resetAt).toBe(resetAt);
  });
});

// ---------------------------------------------------------------------------
// setMode
// ---------------------------------------------------------------------------
describe('shopping-store / setMode', () => {
  beforeEach(() => resetStore('local'));

  it('clears items/dishes when switching modes', async () => {
    await useShoppingStore.getState().addItem('A');
    expect(useShoppingStore.getState().items).toHaveLength(1);

    useShoppingStore.getState().setMode('server');

    const state = useShoppingStore.getState();
    expect(state.mode).toBe('server');
    expect(state.items).toHaveLength(0);
    expect(state.dishes).toHaveLength(0);
  });

  it('is a no-op when the mode is unchanged', async () => {
    await useShoppingStore.getState().addItem('A');
    useShoppingStore.getState().setMode('local');
    expect(useShoppingStore.getState().items).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// logout pathway: setState mode bypass
//
// auth-store.logout は items/dishes を画面に残すため、`setMode('local')` ではなく
// `useShoppingStore.setState({ mode: 'local' })` を直接呼ぶ意図的迂回を持つ。
// Phase 3 で backend 抽象を入れた後も、この迂回が正しく機能すること
// （= mode 切替後のアクションが local backend を選ぶこと）を担保する。
// ---------------------------------------------------------------------------
describe('shopping-store / logout pathway: setState mode bypass', () => {
  it('keeps items/dishes when mode is flipped via setState', () => {
    resetStore('server');
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'A' })],
      dishes: [makeDish({ id: 10, name: 'カレー' })],
    });

    useShoppingStore.setState({ mode: 'local' });

    const state = useShoppingStore.getState();
    expect(state.mode).toBe('local');
    expect(state.items).toHaveLength(1);
    expect(state.dishes).toHaveLength(1);
  });

  it('routes subsequent actions through the local backend after setState bypass', async () => {
    resetStore('server');
    useShoppingStore.setState({
      items: [makeItem({ id: 1, name: 'A' })],
      dishes: [],
      nextLocalId: -1,
    });

    useShoppingStore.setState({ mode: 'local' });
    const item = await useShoppingStore.getState().addItem('B');

    expect(shopping.createItem).not.toHaveBeenCalled();
    expect(item.id).toBe(-1);
    expect(useShoppingStore.getState().items.map((i) => i.id)).toEqual([-1, 1]);
    expect(useShoppingStore.getState().nextLocalId).toBe(-2);
  });
});
