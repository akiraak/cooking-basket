import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Recipe, SavedRecipe } from '../types/models';
import {
  createLocalRecipeBackend,
  createServerRecipeBackend,
  type RecipeBackend,
} from './backends/recipe-backend';

export type Mode = 'local' | 'server';

interface RecipeState {
  mode: Mode;
  savedRecipes: SavedRecipe[];
  loading: boolean;
  nextLocalId: number;

  setMode: (mode: Mode) => void;
  clearLocalData: () => void;

  loadSavedRecipes: () => Promise<void>;
  deleteSavedRecipe: (id: number) => Promise<void>;

  autoSaveRecipes: (
    dishName: string,
    recipes: Recipe[],
    sourceDishId: number,
  ) => Promise<SavedRecipe[]>;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => {
      // backend インスタンスは store 構築時に 1 回だけ作って使い回す。
      // mode は毎アクション呼び出し時に `get().mode` で読むので、auth-store.logout が
      // `setState({ mode: 'local' })` で迂回しても、次のアクションは local backend を選ぶ。
      const localBackend = createLocalRecipeBackend({
        next: () => {
          const id = get().nextLocalId;
          set((s) => ({ nextLocalId: s.nextLocalId - 1 }));
          return id;
        },
      });
      const serverBackend = createServerRecipeBackend();
      const backendFor = (): RecipeBackend =>
        get().mode === 'local' ? localBackend : serverBackend;

      return {
        mode: 'local',
        savedRecipes: [],
        loading: false,
        nextLocalId: -1,

        setMode: (mode) => {
          if (get().mode === mode) return;
          set({ mode, savedRecipes: [] });
        },

        clearLocalData: () => {
          set({ savedRecipes: [], nextLocalId: -1 });
        },

        loadSavedRecipes: async () => {
          // local backend は loadAll で null を返す（リモートに取りに行かない）。
          // 既存挙動を保つため、その場合 loading フラグは立てずに早期 return する。
          if (get().mode === 'local') return;
          set({ loading: true });
          try {
            const result = await backendFor().loadAll();
            if (result !== null) {
              set({ savedRecipes: result });
            }
          } finally {
            set({ loading: false });
          }
        },

        deleteSavedRecipe: async (id) => {
          await backendFor().deleteSavedRecipe(id);
          set((s) => ({
            savedRecipes: s.savedRecipes.filter((r) => r.id !== id),
          }));
        },

        autoSaveRecipes: async (dishName, recipes, sourceDishId) => {
          if (recipes.length === 0) return [];
          const created = await backendFor().createSavedRecipes(
            dishName,
            recipes,
            sourceDishId,
          );
          set((s) => ({
            savedRecipes: [...created, ...s.savedRecipes],
          }));
          return created;
        },
      };
    },
    {
      name: 'cb-recipe-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) =>
        state.mode === 'local'
          ? {
              mode: state.mode,
              savedRecipes: state.savedRecipes,
              nextLocalId: state.nextLocalId,
            }
          : { mode: state.mode, nextLocalId: state.nextLocalId },
    },
  ),
);
