import { getDatabase } from '../database';

export interface SavedRecipe {
  id: number;
  user_id: number;
  dish_name: string;
  title: string;
  summary: string;
  steps_json: string;
  ingredients_json: string;
  source_dish_id: number | null;
  created_at: string;
}

export interface SavedRecipeInput {
  dishName: string;
  title: string;
  summary: string;
  steps: string[];
  ingredients: { name: string; category: string }[];
  sourceDishId?: number;
}

export function getAllSavedRecipes(userId: number): SavedRecipe[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT *
    FROM saved_recipes
    WHERE user_id = ?
    ORDER BY dish_name ASC, created_at DESC
  `).all(userId) as SavedRecipe[];
}

export function getSavedRecipe(userId: number, id: number): SavedRecipe | null {
  const db = getDatabase();
  return (db.prepare(
    'SELECT * FROM saved_recipes WHERE id = ? AND user_id = ?'
  ).get(id, userId) as SavedRecipe) || null;
}

export function createSavedRecipe(userId: number, input: SavedRecipeInput): SavedRecipe {
  const db = getDatabase();
  const result = db.prepare(
    `INSERT INTO saved_recipes (user_id, dish_name, title, summary, steps_json, ingredients_json, source_dish_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    input.dishName,
    input.title,
    input.summary,
    JSON.stringify(input.steps),
    JSON.stringify(input.ingredients),
    input.sourceDishId ?? null
  );
  return db.prepare(
    'SELECT * FROM saved_recipes WHERE id = ?'
  ).get(result.lastInsertRowid) as SavedRecipe;
}

export function createSavedRecipesBulk(userId: number, inputs: SavedRecipeInput[]): SavedRecipe[] {
  const db = getDatabase();
  const insert = db.prepare(
    `INSERT INTO saved_recipes (user_id, dish_name, title, summary, steps_json, ingredients_json, source_dish_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectOne = db.prepare('SELECT * FROM saved_recipes WHERE id = ?');
  const created: SavedRecipe[] = [];
  const runAll = db.transaction((items: SavedRecipeInput[]) => {
    for (const input of items) {
      const result = insert.run(
        userId,
        input.dishName,
        input.title,
        input.summary,
        JSON.stringify(input.steps),
        JSON.stringify(input.ingredients),
        input.sourceDishId ?? null,
      );
      created.push(selectOne.get(result.lastInsertRowid) as SavedRecipe);
    }
  });
  runAll(inputs);
  return created;
}

export function deleteSavedRecipe(userId: number, id: number): boolean {
  const db = getDatabase();
  const result = db.prepare(
    'DELETE FROM saved_recipes WHERE id = ? AND user_id = ?'
  ).run(id, userId);
  return result.changes > 0;
}

export function getSavedRecipeStates(userId: number, dishId: number): { id: number }[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT id
    FROM saved_recipes
    WHERE user_id = ? AND source_dish_id = ?
    ORDER BY id ASC
  `).all(userId, dishId) as { id: number }[];
}

// AI レシピ取得時に自動保存（同じ料理 ID の既存分は置き換え）
export function autoSaveRecipes(
  userId: number,
  dishName: string,
  dishId: number,
  recipes: { title: string; summary: string; steps: string[]; ingredients?: { name: string; category: string }[] }[],
  ingredients: { name: string; category: string }[]
): void {
  const db = getDatabase();

  db.prepare('DELETE FROM saved_recipes WHERE user_id = ? AND source_dish_id = ?').run(userId, dishId);

  const stmt = db.prepare(
    `INSERT INTO saved_recipes (user_id, dish_name, title, summary, steps_json, ingredients_json, source_dish_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const fallbackIngredientsJson = JSON.stringify(ingredients);

  for (const r of recipes) {
    const recipeIngredientsJson = r.ingredients && r.ingredients.length > 0
      ? JSON.stringify(r.ingredients)
      : fallbackIngredientsJson;
    stmt.run(userId, dishName, r.title, r.summary || '', JSON.stringify(r.steps || []), recipeIngredientsJson, dishId);
  }
}
