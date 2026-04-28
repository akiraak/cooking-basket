import type { Dish, Ingredient, Recipe, ShoppingItem } from '../../../src/types/models';

jest.mock('../../../src/api/shopping', () => ({
  getAllItems: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  deleteCheckedItems: jest.fn(),
  reorderItems: jest.fn(),
}));

jest.mock('../../../src/api/dishes', () => ({
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

import * as shoppingApi from '../../../src/api/shopping';
import * as dishesApi from '../../../src/api/dishes';
import {
  createLocalShoppingBackend,
  createServerShoppingBackend,
  type ShoppingBackend,
} from '../../../src/stores/backends/shopping-backend';

const shopping = shoppingApi as jest.Mocked<typeof shoppingApi>;
const dishes = dishesApi as jest.Mocked<typeof dishesApi>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createLocalShoppingBackend', () => {
  function makeBackend(start = -1): ShoppingBackend {
    let next = start;
    return createLocalShoppingBackend({
      next: () => {
        const id = next;
        next -= 1;
        return id;
      },
    });
  }

  it('loadAll returns null (does not fetch from remote)', async () => {
    expect(await makeBackend().loadAll()).toBeNull();
  });

  it('createItem allocates a negative id and returns a fully formed record', async () => {
    const backend = makeBackend();
    const a = await backend.createItem('にんじん', '野菜');

    expect(a.id).toBe(-1);
    expect(a.name).toBe('にんじん');
    expect(a.category).toBe('野菜');
    expect(a.checked).toBe(0);
    expect(a.dish_id).toBeNull();
    expect(a.position).toBe(0);
    expect(typeof a.created_at).toBe('string');
    expect(a.updated_at).toBe(a.created_at);

    const b = await backend.createItem('たまねぎ');
    expect(b.id).toBe(-2);
    expect(b.category).toBe('');
  });

  it('createDish allocates a negative id and returns a fully formed record', async () => {
    const backend = makeBackend();
    const dish = await backend.createDish('カレー');

    expect(dish.id).toBe(-1);
    expect(dish.name).toBe('カレー');
    expect(dish.items).toEqual([]);
    expect(dish.ingredients_json).toBeNull();
    expect(dish.recipes_json).toBeNull();
    expect(typeof dish.created_at).toBe('string');
  });

  it('deleteCheckedItems echoes back the input length', async () => {
    expect(await makeBackend().deleteCheckedItems([1, 2, 3])).toBe(3);
    expect(await makeBackend().deleteCheckedItems([])).toBe(0);
  });

  it('mutation operations are no-ops and never touch the api modules', async () => {
    const backend = makeBackend();

    await backend.updateItem(1, { name: 'X', checked: 1 });
    await backend.deleteItem(1);
    await backend.linkItemToDish(10, 1);
    await backend.unlinkItemFromDish(10, 1);
    await backend.reorderItems([1, 2]);
    await backend.reorderDishes([10, 11]);
    await backend.reorderDishItems(10, [1, 2]);
    await backend.updateDish(10, 'カレー（改）');
    await backend.deleteDish(10);
    await backend.updateDishAiCache(10, [] as Ingredient[], [] as Recipe[]);

    // shopping api
    expect(shopping.getAllItems).not.toHaveBeenCalled();
    expect(shopping.createItem).not.toHaveBeenCalled();
    expect(shopping.updateItem).not.toHaveBeenCalled();
    expect(shopping.deleteItem).not.toHaveBeenCalled();
    expect(shopping.deleteCheckedItems).not.toHaveBeenCalled();
    expect(shopping.reorderItems).not.toHaveBeenCalled();
    // dishes api
    expect(dishes.getAllDishes).not.toHaveBeenCalled();
    expect(dishes.createDish).not.toHaveBeenCalled();
    expect(dishes.updateDish).not.toHaveBeenCalled();
    expect(dishes.deleteDish).not.toHaveBeenCalled();
    expect(dishes.linkItemToDish).not.toHaveBeenCalled();
    expect(dishes.unlinkItemFromDish).not.toHaveBeenCalled();
    expect(dishes.reorderDishes).not.toHaveBeenCalled();
    expect(dishes.reorderDishItems).not.toHaveBeenCalled();
    expect(dishes.updateDishAiCache).not.toHaveBeenCalled();
  });
});

describe('createServerShoppingBackend', () => {
  let backend: ShoppingBackend;

  beforeEach(() => {
    backend = createServerShoppingBackend();
  });

  it('loadAll fetches items and dishes in parallel', async () => {
    const items: ShoppingItem[] = [];
    const ds: Dish[] = [];
    shopping.getAllItems.mockResolvedValue(items);
    dishes.getAllDishes.mockResolvedValue(ds);

    const result = await backend.loadAll();

    expect(result).toEqual({ items, dishes: ds });
    expect(shopping.getAllItems).toHaveBeenCalledTimes(1);
    expect(dishes.getAllDishes).toHaveBeenCalledTimes(1);
  });

  it('createItem forwards name + category to api.createItem', async () => {
    const item = { id: 1, name: 'にんじん' } as ShoppingItem;
    shopping.createItem.mockResolvedValue(item);

    const result = await backend.createItem('にんじん', '野菜');

    expect(shopping.createItem).toHaveBeenCalledWith('にんじん', '野菜');
    expect(result).toBe(item);
  });

  it('updateItem / deleteItem / reorderItems forward to api', async () => {
    await backend.updateItem(1, { checked: 1 });
    expect(shopping.updateItem).toHaveBeenCalledWith(1, { checked: 1 });

    await backend.deleteItem(1);
    expect(shopping.deleteItem).toHaveBeenCalledWith(1);

    await backend.reorderItems([3, 1, 2]);
    expect(shopping.reorderItems).toHaveBeenCalledWith([3, 1, 2]);
  });

  it('deleteCheckedItems calls the bulk endpoint without forwarding the local id list', async () => {
    shopping.deleteCheckedItems.mockResolvedValue(2);

    const count = await backend.deleteCheckedItems([1, 2, 3]);

    // local 側で集めた id は楽観 filter 用なので backend は使わない
    expect(shopping.deleteCheckedItems).toHaveBeenCalledWith();
    expect(count).toBe(2);
  });

  it('createDish / updateDish / deleteDish forward to api', async () => {
    const dish = { id: 10, name: 'カレー' } as Dish;
    dishes.createDish.mockResolvedValue(dish);

    expect(await backend.createDish('カレー')).toBe(dish);
    expect(dishes.createDish).toHaveBeenCalledWith('カレー');

    await backend.updateDish(10, '豚汁');
    expect(dishes.updateDish).toHaveBeenCalledWith(10, '豚汁');

    await backend.deleteDish(10);
    expect(dishes.deleteDish).toHaveBeenCalledWith(10);
  });

  it('linkItemToDish / unlinkItemFromDish forward to api', async () => {
    await backend.linkItemToDish(10, 1);
    expect(dishes.linkItemToDish).toHaveBeenCalledWith(10, 1);

    await backend.unlinkItemFromDish(10, 1);
    expect(dishes.unlinkItemFromDish).toHaveBeenCalledWith(10, 1);
  });

  it('reorderDishes / reorderDishItems forward to api', async () => {
    await backend.reorderDishes([11, 10]);
    expect(dishes.reorderDishes).toHaveBeenCalledWith([11, 10]);

    await backend.reorderDishItems(10, [2, 1]);
    expect(dishes.reorderDishItems).toHaveBeenCalledWith(10, [2, 1]);
  });

  it('updateDishAiCache forwards to api', async () => {
    const ingredients = [{ name: 'にんじん', category: '野菜' }] as Ingredient[];
    const recipes = [
      { title: 'A', summary: '', steps: [], ingredients: [] },
    ] as Recipe[];

    await backend.updateDishAiCache(10, ingredients, recipes);

    expect(dishes.updateDishAiCache).toHaveBeenCalledWith(10, ingredients, recipes);
  });
});
