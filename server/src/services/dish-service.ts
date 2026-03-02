import { getDatabase } from '../database';

export interface Dish {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface DishWithItems extends Dish {
  items: DishItem[];
}

export interface DishItem {
  id: number;
  name: string;
  category: string;
  checked: number;
}

export function getAllDishes(): DishWithItems[] {
  const db = getDatabase();
  const dishes = db.prepare('SELECT * FROM dishes ORDER BY created_at DESC').all() as Dish[];
  return dishes.map(dish => ({
    ...dish,
    items: getItemsForDish(dish.id),
  }));
}

export function getDish(id: number): DishWithItems | null {
  const db = getDatabase();
  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id) as Dish | undefined;
  if (!dish) return null;
  return { ...dish, items: getItemsForDish(dish.id) };
}

export function createDish(name: string): DishWithItems {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO dishes (name) VALUES (?)').run(name);
  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(result.lastInsertRowid) as Dish;
  return { ...dish, items: [] };
}

export function deleteDish(id: number): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM dishes WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getItemsForDish(dishId: number): DishItem[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT si.id, si.name, si.category, si.checked
    FROM shopping_items si
    JOIN dish_items di ON di.item_id = si.id
    WHERE di.dish_id = ?
    ORDER BY si.created_at DESC
  `).all(dishId) as DishItem[];
}

export function linkItemToDish(dishId: number, itemId: number): boolean {
  const db = getDatabase();
  try {
    db.prepare('INSERT OR IGNORE INTO dish_items (dish_id, item_id) VALUES (?, ?)').run(dishId, itemId);
    return true;
  } catch {
    return false;
  }
}

export function unlinkItemFromDish(dishId: number, itemId: number): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM dish_items WHERE dish_id = ? AND item_id = ?').run(dishId, itemId);
  return result.changes > 0;
}
