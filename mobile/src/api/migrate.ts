import { request } from './client';
import type { Ingredient } from '../types/models';

export interface MigrateItemInput {
  localId: number;
  name: string;
  category?: string;
  checked?: number;
  dishLocalId?: number | null;
}

export interface MigrateDishInput {
  localId: number;
  name: string;
  ingredients?: unknown[];
  recipes?: unknown[];
  position?: number;
}

export interface MigrateSavedRecipeInput {
  localId: number;
  dishName: string;
  title: string;
  summary?: string;
  steps?: string[];
  ingredients?: Ingredient[];
  sourceDishLocalId?: number | null;
}

export interface MigratePayload {
  items?: MigrateItemInput[];
  dishes?: MigrateDishInput[];
  savedRecipes?: MigrateSavedRecipeInput[];
}

export interface MigrateResult {
  dishIdMap: Record<string, number>;
  itemIdMap: Record<string, number>;
  savedRecipeIdMap: Record<string, number>;
}

export const migrate = (payload: MigratePayload) =>
  request<MigrateResult>('post', '/api/migrate', payload);
