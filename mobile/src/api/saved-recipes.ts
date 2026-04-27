import { request } from './client';
import type { Ingredient, SavedRecipe } from '../types/models';

export const getSavedRecipes = () => request<SavedRecipe[]>('get', '/api/saved-recipes');

export const deleteSavedRecipe = (id: number) =>
  request<null>('delete', `/api/saved-recipes/${id}`);

export interface BulkSavedRecipeInput {
  dishName: string;
  title: string;
  summary?: string;
  steps?: string[];
  ingredients?: Ingredient[];
  sourceDishId?: number;
}

export const createSavedRecipesBulk = (recipes: BulkSavedRecipeInput[]) =>
  request<SavedRecipe[]>('post', '/api/saved-recipes/bulk', { recipes });
