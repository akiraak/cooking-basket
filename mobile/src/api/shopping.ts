import { request } from './client';
import type { ShoppingItem } from '../types/models';

export const getAllItems = () => request<ShoppingItem[]>('get', '/api/shopping');

export const createItem = (name: string, category?: string) =>
  request<ShoppingItem>('post', '/api/shopping', { name, category });

export const updateItem = (
  id: number,
  data: { name?: string; category?: string; checked?: number },
) => request<ShoppingItem>('put', `/api/shopping/${id}`, data);

export const deleteItem = (id: number) => request<null>('delete', `/api/shopping/${id}`);

export async function deleteCheckedItems(): Promise<number> {
  const result = await request<{ deleted: number }>('delete', '/api/shopping/checked');
  return result.deleted;
}

export const reorderItems = (orderedIds: number[]) =>
  request<null>('put', '/api/shopping/reorder', { orderedIds });
