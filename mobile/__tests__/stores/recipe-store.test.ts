import type { Recipe, SavedRecipe } from '../../src/types/models';

jest.mock('../../src/api/saved-recipes', () => ({
  getSavedRecipes: jest.fn(),
  deleteSavedRecipe: jest.fn(),
  createSavedRecipesBulk: jest.fn(),
}));

import * as savedRecipesApi from '../../src/api/saved-recipes';
import { useRecipeStore } from '../../src/stores/recipe-store';
import { useAuthStore } from '../../src/stores/auth-store';

const api = savedRecipesApi as jest.Mocked<typeof savedRecipesApi>;

function makeRecipe(partial?: Partial<Recipe>): Recipe {
  return {
    title: partial?.title ?? 'タイトル',
    summary: partial?.summary ?? '概要',
    steps: partial?.steps ?? ['step1', 'step2'],
    ingredients: partial?.ingredients ?? [{ name: '材料', category: '' }],
  };
}

function resetStore(mode: 'local' | 'server') {
  useRecipeStore.setState({
    mode,
    savedRecipes: [],
    loading: false,
    nextLocalId: -1,
  });
  useAuthStore.setState({
    isAuthenticated: false,
    isLoading: false,
    email: null,
    userId: null,
    authModalVisible: false,
    authModalReason: null,
    authModalOnSuccess: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('recipe-store (server mode)', () => {
  beforeEach(() => resetStore('server'));

  it('loadSavedRecipes fetches from the server', async () => {
    const recipes = [{ id: 1 } as SavedRecipe];
    api.getSavedRecipes.mockResolvedValue(recipes);
    await useRecipeStore.getState().loadSavedRecipes();
    expect(api.getSavedRecipes).toHaveBeenCalled();
    expect(useRecipeStore.getState().savedRecipes).toEqual(recipes);
  });

  it('autoSaveRecipes posts bulk and prepends to state', async () => {
    const recipes = [makeRecipe({ title: 'R1' }), makeRecipe({ title: 'R2' })];
    const created = [
      { id: 100, title: 'R1' } as SavedRecipe,
      { id: 101, title: 'R2' } as SavedRecipe,
    ];
    api.createSavedRecipesBulk.mockResolvedValue(created);

    const result = await useRecipeStore.getState().autoSaveRecipes('カレー', recipes, 10);

    expect(api.createSavedRecipesBulk).toHaveBeenCalledWith([
      expect.objectContaining({ dishName: 'カレー', title: 'R1', sourceDishId: 10 }),
      expect.objectContaining({ dishName: 'カレー', title: 'R2', sourceDishId: 10 }),
    ]);
    expect(result).toEqual(created);
    expect(useRecipeStore.getState().savedRecipes).toEqual(created);
  });

  it('deleteSavedRecipe optimistically removes the item from state', async () => {
    api.deleteSavedRecipe.mockResolvedValue(null);
    useRecipeStore.setState({
      savedRecipes: [
        { id: 100, title: 'A' } as SavedRecipe,
        { id: 101, title: 'B' } as SavedRecipe,
      ],
    });

    await useRecipeStore.getState().deleteSavedRecipe(100);

    expect(api.deleteSavedRecipe).toHaveBeenCalledWith(100);
    expect(api.getSavedRecipes).not.toHaveBeenCalled();
    expect(useRecipeStore.getState().savedRecipes.map((r) => r.id)).toEqual([101]);
  });
});

describe('recipe-store (local mode)', () => {
  beforeEach(() => resetStore('local'));

  it('loadSavedRecipes is a no-op (uses persisted state)', async () => {
    useRecipeStore.setState({ savedRecipes: [{ id: -1 } as SavedRecipe] });
    await useRecipeStore.getState().loadSavedRecipes();
    expect(api.getSavedRecipes).not.toHaveBeenCalled();
    expect(useRecipeStore.getState().savedRecipes).toHaveLength(1);
  });

  it('autoSaveRecipes assigns negative ids locally without hitting the server', async () => {
    const recipes = [makeRecipe({ title: 'A' }), makeRecipe({ title: 'B' })];
    const result = await useRecipeStore.getState().autoSaveRecipes('鍋', recipes, 42);

    expect(api.createSavedRecipesBulk).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(-1);
    expect(result[1].id).toBe(-2);
    expect(result[0].source_dish_id).toBe(42);
    const state = useRecipeStore.getState();
    expect(state.savedRecipes).toHaveLength(2);
    expect(state.nextLocalId).toBe(-3);
  });

  it('deleteSavedRecipe removes locally only', async () => {
    useRecipeStore.setState({
      savedRecipes: [
        { id: -1, title: 'A' } as SavedRecipe,
        { id: -2, title: 'B' } as SavedRecipe,
      ],
    });
    await useRecipeStore.getState().deleteSavedRecipe(-1);
    expect(api.deleteSavedRecipe).not.toHaveBeenCalled();
    expect(useRecipeStore.getState().savedRecipes.map((r) => r.id)).toEqual([-2]);
  });
});

describe('recipe-store (setMode)', () => {
  it('clears state when switching modes', () => {
    resetStore('local');
    useRecipeStore.setState({ savedRecipes: [{ id: -1 } as SavedRecipe] });
    useRecipeStore.getState().setMode('server');
    const state = useRecipeStore.getState();
    expect(state.mode).toBe('server');
    expect(state.savedRecipes).toHaveLength(0);
  });
});

// auth-store.logout は savedRecipes を画面に残すため、`setMode('local')` ではなく
// `useRecipeStore.setState({ mode: 'local' })` を直接呼ぶ意図的迂回を持つ。
// Phase 4 で backend 抽象を入れた後も、この迂回が正しく機能すること
// （= mode 切替後のアクションが local backend を選ぶこと）を担保する。
describe('recipe-store (logout pathway: setState mode bypass)', () => {
  it('keeps savedRecipes when mode is flipped via setState', () => {
    resetStore('server');
    useRecipeStore.setState({
      savedRecipes: [{ id: 1, title: 'A' } as SavedRecipe],
    });

    useRecipeStore.setState({ mode: 'local' });

    const state = useRecipeStore.getState();
    expect(state.mode).toBe('local');
    expect(state.savedRecipes).toHaveLength(1);
  });

  it('routes subsequent autoSaveRecipes through the local backend after setState bypass', async () => {
    resetStore('server');
    useRecipeStore.setState({
      savedRecipes: [{ id: 1, title: 'A' } as SavedRecipe],
      nextLocalId: -1,
    });

    useRecipeStore.setState({ mode: 'local' });
    const result = await useRecipeStore
      .getState()
      .autoSaveRecipes('鍋', [makeRecipe({ title: 'B' })], 42);

    expect(api.createSavedRecipesBulk).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(-1);
    const state = useRecipeStore.getState();
    expect(state.savedRecipes.map((r) => r.id)).toEqual([-1, 1]);
    expect(state.nextLocalId).toBe(-2);
  });

  it('routes subsequent deleteSavedRecipe through the local backend after setState bypass', async () => {
    resetStore('server');
    useRecipeStore.setState({
      savedRecipes: [
        { id: 1, title: 'A' } as SavedRecipe,
        { id: 2, title: 'B' } as SavedRecipe,
      ],
    });

    useRecipeStore.setState({ mode: 'local' });
    await useRecipeStore.getState().deleteSavedRecipe(1);

    expect(api.deleteSavedRecipe).not.toHaveBeenCalled();
    expect(useRecipeStore.getState().savedRecipes.map((r) => r.id)).toEqual([2]);
  });
});
