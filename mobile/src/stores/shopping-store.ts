import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Dish, DishItem, Ingredient, Recipe, ShoppingItem } from '../types/models';
import { suggestAi, AiQuotaError } from '../api/ai';
import { useAiStore } from './ai-store';
import { useRecipeStore } from './recipe-store';
import {
  createLocalShoppingBackend,
  createServerShoppingBackend,
  type ShoppingBackend,
} from './backends/shopping-backend';

export type Mode = 'local' | 'server';

export interface SuggestIngredientsResult {
  dishId: number;
  dishName: string;
  ingredients: Ingredient[];
  recipes: Recipe[];
}

interface ShoppingState {
  mode: Mode;
  items: ShoppingItem[];
  dishes: Dish[];
  loading: boolean;
  nextLocalId: number;

  setMode: (mode: Mode) => void;
  clearLocalData: () => void;

  loadAll: () => Promise<void>;

  // 食材
  addItem: (name: string, category?: string) => Promise<ShoppingItem>;
  updateItemName: (id: number, name: string) => Promise<void>;
  toggleCheck: (id: number, checked: number) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
  deleteCheckedItems: () => Promise<number>;
  reorderItems: (orderedIds: number[]) => Promise<void>;

  // 料理
  addDish: (name: string) => Promise<Dish>;
  updateDish: (id: number, name: string) => Promise<void>;
  deleteDish: (id: number) => Promise<void>;
  reorderDishes: (orderedIds: number[]) => Promise<void>;
  reorderDishItems: (dishId: number, orderedItemIds: number[]) => Promise<void>;

  // AI
  suggestIngredients: (
    dishId: number,
    extraIngredients?: string[],
  ) => Promise<SuggestIngredientsResult>;

  // 料理⇔食材
  linkItemToDish: (dishId: number, itemId: number) => Promise<void>;
  unlinkItemFromDish: (dishId: number, itemId: number) => Promise<void>;
  // 食材を別の料理（または「その他」= null）に移動する合成アクション。
  // 失敗時は操作前のスナップショットへ復元してから throw を再送出する。
  moveItemToDish: (itemId: number, toDishId: number | null) => Promise<void>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toDishItem(item: ShoppingItem): DishItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    checked: item.checked,
  };
}

function rebuildDishItems(dishes: Dish[], items: ShoppingItem[]): Dish[] {
  return dishes.map((d) => ({
    ...d,
    items: items
      .filter((i) => i.dish_id === d.id)
      .sort((a, b) => a.position - b.position)
      .map(toDishItem),
  }));
}

export const useShoppingStore = create<ShoppingState>()(
  persist(
    (set, get) => {
      // backend インスタンスは store 構築時に 1 回だけ作って使い回す。
      // mode は毎アクション呼び出し時に `get().mode` で読むので、auth-store.logout が
      // `setState({ mode: 'local' })` で迂回しても、次のアクションは local backend を選ぶ。
      const localBackend = createLocalShoppingBackend({
        next: () => {
          const id = get().nextLocalId;
          set((s) => ({ nextLocalId: s.nextLocalId - 1 }));
          return id;
        },
      });
      const serverBackend = createServerShoppingBackend();
      const backendFor = (): ShoppingBackend =>
        get().mode === 'local' ? localBackend : serverBackend;

      return {
        mode: 'local',
        items: [],
        dishes: [],
        loading: false,
        nextLocalId: -1,

        setMode: (mode) => {
          if (get().mode === mode) return;
          set({ mode, items: [], dishes: [] });
        },

        clearLocalData: () => {
          set({ items: [], dishes: [], nextLocalId: -1 });
        },

        loadAll: async () => {
          // local backend は loadAll で null を返す（リモートに取りに行かない）。
          // 既存挙動を保つため、その場合 loading フラグは立てずに dish.items の
          // 再構築のみ行う。
          if (get().mode === 'local') {
            set((s) => ({ dishes: rebuildDishItems(s.dishes, s.items) }));
            return;
          }
          set({ loading: true });
          try {
            const result = await backendFor().loadAll();
            if (result !== null) {
              set({ items: result.items, dishes: result.dishes });
            }
          } finally {
            set({ loading: false });
          }
        },

        addItem: async (name, category) => {
          const item = await backendFor().createItem(name, category);
          // サーバ側 createItem は position=0 を採番し既存を +1 する。表示順を
          // 「新しいものが先頭」に揃えるため両モードとも先頭に挿入する
          set((s) => {
            const items = [item, ...s.items];
            return { items, dishes: rebuildDishItems(s.dishes, items) };
          });
          return item;
        },

        updateItemName: async (id, name) => {
          await backendFor().updateItem(id, { name });
          set((s) => ({
            items: s.items.map((i) =>
              i.id === id ? { ...i, name, updated_at: nowIso() } : i,
            ),
            dishes: s.dishes.map((d) => ({
              ...d,
              items: d.items.map((i) => (i.id === id ? { ...i, name } : i)),
            })),
          }));
        },

        toggleCheck: async (id, checked) => {
          await backendFor().updateItem(id, { checked });
          set((s) => ({
            items: s.items.map((i) =>
              i.id === id ? { ...i, checked, updated_at: nowIso() } : i,
            ),
            dishes: s.dishes.map((d) => ({
              ...d,
              items: d.items.map((i) => (i.id === id ? { ...i, checked } : i)),
            })),
          }));
        },

        deleteItem: async (id) => {
          await backendFor().deleteItem(id);
          set((s) => ({
            items: s.items.filter((i) => i.id !== id),
            dishes: s.dishes.map((d) => ({
              ...d,
              items: d.items.filter((i) => i.id !== id),
            })),
          }));
        },

        deleteCheckedItems: async () => {
          const checkedIds = get()
            .items.filter((i) => i.checked)
            .map((i) => i.id);
          const idSet = new Set(checkedIds);
          const count = await backendFor().deleteCheckedItems(checkedIds);
          set((s) => {
            const items = s.items.filter((i) => !idSet.has(i.id));
            return { items, dishes: rebuildDishItems(s.dishes, items) };
          });
          return count;
        },

        // reorder 系は両モードで楽観更新する（refactor-09 で対称化）。
        // 失敗時は操作前のスナップショットへ復元してから throw を再送出する
        // （moveItemToDish と同じく、refactor-08 の「ロールバックなし」方針からの
        // 限定的方針転換）。
        // orderedIds は ungrouped 部分の subset を想定し、items 配列内では
        // 「subset が現在占めているスロット」を新しい順で埋め直すことで、
        // 非 subset 要素のスロット位置を保つ。position フィールドは subset 内の
        // 0..N-1 に揃える（サーバ側の position と一致）。
        reorderItems: async (orderedIds) => {
          const snapshotItems = get().items;

          set((s) => {
            const subsetSet = new Set(orderedIds);
            const subsetById = new Map(
              s.items.filter((i) => subsetSet.has(i.id)).map((i) => [i.id, i]),
            );
            const positionMap = new Map(orderedIds.map((id, idx) => [id, idx]));
            let cursor = 0;
            const items = s.items.map((i) => {
              if (!subsetSet.has(i.id)) return i;
              const nextId = orderedIds[cursor++];
              const next = subsetById.get(nextId);
              if (!next) return i;
              return { ...next, position: positionMap.get(next.id) as number };
            });
            return { items };
          });

          try {
            await backendFor().reorderItems(orderedIds);
          } catch (e) {
            set({ items: snapshotItems });
            throw e;
          }
        },

        addDish: async (name) => {
          const dish = await backendFor().createDish(name);
          // サーバ側 createDish は position=0 を採番し既存を +1 するので先頭に挿入する
          set((s) => ({ dishes: [dish, ...s.dishes] }));
          return dish;
        },

        updateDish: async (id, name) => {
          await backendFor().updateDish(id, name);
          set((s) => ({
            dishes: s.dishes.map((d) =>
              d.id === id ? { ...d, name, updated_at: nowIso() } : d,
            ),
          }));
        },

        deleteDish: async (id) => {
          await backendFor().deleteDish(id);
          set((s) => {
            const items = s.items.map((i) =>
              i.dish_id === id ? { ...i, dish_id: null } : i,
            );
            const dishes = s.dishes.filter((d) => d.id !== id);
            return { items, dishes: rebuildDishItems(dishes, items) };
          });
        },

        reorderDishes: async (orderedIds) => {
          const snapshotDishes = get().dishes;

          set((s) => {
            const order = new Map(orderedIds.map((id, idx) => [id, idx]));
            return {
              dishes: [...s.dishes].sort(
                (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
              ),
            };
          });

          try {
            await backendFor().reorderDishes(orderedIds);
          } catch (e) {
            set({ dishes: snapshotDishes });
            throw e;
          }
        },

        reorderDishItems: async (dishId, orderedItemIds) => {
          const snapshotItems = get().items;
          const snapshotDishes = get().dishes;

          set((s) => {
            const order = new Map(orderedItemIds.map((id, idx) => [id, idx]));
            const items = s.items.map((i) =>
              i.dish_id === dishId && order.has(i.id)
                ? { ...i, position: order.get(i.id) as number }
                : i,
            );
            const dishes = s.dishes.map((d) =>
              d.id === dishId
                ? {
                    ...d,
                    items: [...d.items].sort(
                      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
                    ),
                  }
                : d,
            );
            return { items, dishes };
          });

          try {
            await backendFor().reorderDishItems(dishId, orderedItemIds);
          } catch (e) {
            set({ items: snapshotItems, dishes: snapshotDishes });
            throw e;
          }
        },

        suggestIngredients: async (dishId, extraIngredients) => {
          const dish = get().dishes.find((d) => d.id === dishId);
          if (!dish) throw new Error('料理が見つかりません');

          let result;
          try {
            result = await suggestAi(dish.name, extraIngredients);
          } catch (e) {
            if (e instanceof AiQuotaError) {
              useAiStore.getState().markQuotaExceeded(e.resetAt);
            }
            throw e;
          }
          useAiStore.getState().setRemaining(result.remaining);

          const { ingredients, recipes } = result;

          set((s) => ({
            dishes: s.dishes.map((d) =>
              d.id === dishId
                ? {
                    ...d,
                    ingredients_json: JSON.stringify(ingredients),
                    recipes_json: JSON.stringify(recipes),
                    updated_at: nowIso(),
                  }
                : d,
            ),
          }));

          // server モードでは best-effort で AI cache をサーバに書き戻す。
          // local backend は no-op。失敗は黙って潰す（ユーザー体験を阻害しない）。
          try {
            await backendFor().updateDishAiCache(dishId, ingredients, recipes);
          } catch {
            /* noop */
          }

          if (recipes.length > 0) {
            await useRecipeStore.getState().autoSaveRecipes(dish.name, recipes, dishId);
          }

          return {
            dishId,
            dishName: dish.name,
            ingredients,
            recipes,
          };
        },

        linkItemToDish: async (dishId, itemId) => {
          await backendFor().linkItemToDish(dishId, itemId);
          set((s) => {
            const items = s.items.map((i) =>
              i.id === itemId ? { ...i, dish_id: dishId } : i,
            );
            return { items, dishes: rebuildDishItems(s.dishes, items) };
          });
        },

        unlinkItemFromDish: async (dishId, itemId) => {
          await backendFor().unlinkItemFromDish(dishId, itemId);
          set((s) => {
            const items = s.items.map((i) =>
              i.id === itemId && i.dish_id === dishId ? { ...i, dish_id: null } : i,
            );
            return { items, dishes: rebuildDishItems(s.dishes, items) };
          });
        },

        // 移動元 dish_id は store の現在 state から推定し、unlink → link を順に呼ぶ。
        // 失敗時のロールバックは loadAll() ではなく snapshot 復元で行う
        // （refactor-08 の「ロールバックなし」方針からの限定的方針転換、refactor-09 で
        // moveItemToDish と reorder 系に限り適用）。中間失敗（unlink 成功 / link 失敗）は
        // 復元するがサーバ側の整合性はサーバが担保する前提。
        moveItemToDish: async (itemId, toDishId) => {
          const state = get();
          const item = state.items.find((i) => i.id === itemId);
          if (!item) return;
          const fromDishId = item.dish_id;
          if (fromDishId === toDishId) return;

          const snapshot = { items: state.items, dishes: state.dishes };

          set((s) => {
            const items = s.items.map((i) =>
              i.id === itemId ? { ...i, dish_id: toDishId, updated_at: nowIso() } : i,
            );
            return { items, dishes: rebuildDishItems(s.dishes, items) };
          });

          try {
            if (fromDishId !== null) {
              await backendFor().unlinkItemFromDish(fromDishId, itemId);
            }
            if (toDishId !== null) {
              await backendFor().linkItemToDish(toDishId, itemId);
            }
          } catch (e) {
            set({ items: snapshot.items, dishes: snapshot.dishes });
            throw e;
          }
        },
      };
    },
    {
      name: 'cb-shopping-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) =>
        state.mode === 'local'
          ? {
              mode: state.mode,
              items: state.items,
              dishes: state.dishes,
              nextLocalId: state.nextLocalId,
            }
          : { mode: state.mode, nextLocalId: state.nextLocalId },
    },
  ),
);
