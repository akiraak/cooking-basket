import type { Recipe, SavedRecipe } from '../../types/models';
import * as savedRecipesApi from '../../api/saved-recipes';

// ShoppingBackend と同型の抽象。永続化先（in-memory only / server）の差分を吸収する。
//
// 戻り値の規約:
// - loadAll は `null` を返したら「リモートに取りに行かない」を意味する（local backend）
// - createSavedRecipes は新規レコードを返す（local は負 ID を採番、server は API 戻り値）
// - deleteSavedRecipe は副作用のみ。local backend では no-op
export interface RecipeBackend {
  loadAll(): Promise<SavedRecipe[] | null>;
  createSavedRecipes(
    dishName: string,
    recipes: Recipe[],
    sourceDishId: number,
  ): Promise<SavedRecipe[]>;
  deleteSavedRecipe(id: number): Promise<void>;
}

// ID 採番の責務だけを LocalRecipeBackend に注入する。`nextLocalId` は
// store 側で永続化される値なので、allocator は store の get/set 経由で値を読み書きする
// 関数として渡される（recipe-store.ts 内で組み立て）。
export interface LocalIdAllocator {
  next(): number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildLocalSavedRecipe(
  id: number,
  dishName: string,
  recipe: Recipe,
  sourceDishId: number,
): SavedRecipe {
  return {
    id,
    user_id: 0,
    dish_name: dishName,
    title: recipe.title,
    summary: recipe.summary,
    steps_json: JSON.stringify(recipe.steps ?? []),
    ingredients_json: JSON.stringify(recipe.ingredients ?? []),
    source_dish_id: sourceDishId,
    created_at: nowIso(),
  };
}

export function createLocalRecipeBackend(
  allocator: LocalIdAllocator,
): RecipeBackend {
  return {
    async loadAll() {
      // ローカルは AsyncStorage に永続化されており、リモートから取り直さない。
      return null;
    },

    async createSavedRecipes(dishName, recipes, sourceDishId) {
      return recipes.map((r) =>
        buildLocalSavedRecipe(allocator.next(), dishName, r, sourceDishId),
      );
    },

    async deleteSavedRecipe() {
      // local モードでは state mutation を呼び出し側で行うため副作用なし
    },
  };
}

export function createServerRecipeBackend(): RecipeBackend {
  return {
    async loadAll() {
      return savedRecipesApi.getSavedRecipes();
    },

    async createSavedRecipes(dishName, recipes, sourceDishId) {
      const inputs: savedRecipesApi.BulkSavedRecipeInput[] = recipes.map((r) => ({
        dishName,
        title: r.title,
        summary: r.summary,
        steps: r.steps,
        ingredients: r.ingredients,
        sourceDishId,
      }));
      return savedRecipesApi.createSavedRecipesBulk(inputs);
    },

    async deleteSavedRecipe(id) {
      await savedRecipesApi.deleteSavedRecipe(id);
    },
  };
}
