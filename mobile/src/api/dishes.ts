import { request } from './client';
import type { Dish } from '../types/models';

export const getAllDishes = () => request<Dish[]>('get', '/api/dishes');

export const createDish = (name: string) => request<Dish>('post', '/api/dishes', { name });

export const updateDish = (id: number, name: string) =>
  request<Dish>('put', `/api/dishes/${id}`, { name });

export const deleteDish = (id: number) => request<null>('delete', `/api/dishes/${id}`);

export const updateDishAiCache = (
  dishId: number,
  ingredients: unknown[],
  recipes: unknown[],
) => request<null>('put', `/api/dishes/${dishId}/ai-cache`, { ingredients, recipes });

export const linkItemToDish = (dishId: number, itemId: number) =>
  request<Dish>('post', `/api/dishes/${dishId}/items`, { itemId });

export const unlinkItemFromDish = (dishId: number, itemId: number) =>
  request<null>('delete', `/api/dishes/${dishId}/items/${itemId}`);

export const reorderDishes = (orderedIds: number[]) =>
  request<null>('put', '/api/dishes/reorder', { orderedIds });

export const reorderDishItems = (dishId: number, orderedItemIds: number[]) =>
  request<null>('put', `/api/dishes/${dishId}/items/reorder`, { orderedItemIds });
