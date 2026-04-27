import { describe, expect, it } from 'vitest';
import {
  createSavedRecipe,
  deleteSavedRecipe,
  getAllSavedRecipes,
  getSavedRecipe,
} from '../../src/services/saved-recipe-service';
import { createTestUser } from '../helpers/auth';
import { setupTestDatabase } from '../helpers/db';

setupTestDatabase();

const sampleInput = {
  dishName: 'カレー',
  title: '定番チキンカレー',
  summary: 'スパイスから作る基本のカレー',
  steps: ['玉ねぎを炒める', 'スパイスを加える', '煮込む'],
  ingredients: [
    { name: '玉ねぎ', category: '野菜' },
    { name: '鶏肉', category: '肉' },
  ],
};

describe('saved-recipe-service', () => {
  describe('create / getAll / get / delete', () => {
    it('saves a recipe and returns it via getAllSavedRecipes', () => {
      const user = createTestUser();
      const created = createSavedRecipe(user.id, sampleInput);

      expect(created.title).toBe('定番チキンカレー');
      expect(JSON.parse(created.steps_json)).toEqual(sampleInput.steps);

      const list = getAllSavedRecipes(user.id);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(created.id);
    });

    it('fetches a single recipe scoped to the owner', () => {
      const alice = createTestUser('alice@example.com');
      const bob = createTestUser('bob@example.com');
      const aliceRecipe = createSavedRecipe(alice.id, sampleInput);

      expect(getSavedRecipe(alice.id, aliceRecipe.id)?.id).toBe(aliceRecipe.id);
      expect(getSavedRecipe(bob.id, aliceRecipe.id)).toBeNull();
    });

    it('deletes a recipe owned by the user and refuses foreign ones', () => {
      const alice = createTestUser('alice@example.com');
      const bob = createTestUser('bob@example.com');
      const recipe = createSavedRecipe(alice.id, sampleInput);

      expect(deleteSavedRecipe(bob.id, recipe.id)).toBe(false);
      expect(getSavedRecipe(alice.id, recipe.id)).not.toBeNull();

      expect(deleteSavedRecipe(alice.id, recipe.id)).toBe(true);
      expect(getSavedRecipe(alice.id, recipe.id)).toBeNull();
    });
  });
});
