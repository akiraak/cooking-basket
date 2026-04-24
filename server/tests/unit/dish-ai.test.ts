import { describe, expect, it } from 'vitest';
import {
  buildDishInfoPrompt,
  buildIngredientsOnlyPrompt,
  parseDishInfo,
} from '../../src/services/dish-ai';

describe('buildDishInfoPrompt', () => {
  it('contains the dish name and the recipes JSON skeleton', () => {
    const prompt = buildDishInfoPrompt('カレー');
    expect(prompt).toContain('「カレー」');
    expect(prompt).toContain('"recipes"');
    expect(prompt).toContain('"steps"');
  });

  it('includes extra ingredients section when provided', () => {
    const prompt = buildDishInfoPrompt('カレー', ['牛肉', 'じゃがいも']);
    expect(prompt).toContain('牛肉');
    expect(prompt).toContain('じゃがいも');
  });

  it('omits extra ingredients section when array is empty', () => {
    const prompt = buildDishInfoPrompt('カレー', []);
    expect(prompt).not.toContain('ユーザーが以下の食材');
  });
});

describe('buildIngredientsOnlyPrompt', () => {
  it('asks for an ingredients-only JSON shape and excludes recipes', () => {
    const prompt = buildIngredientsOnlyPrompt('肉じゃが');
    expect(prompt).toContain('「肉じゃが」');
    expect(prompt).toContain('"ingredients"');
    expect(prompt).not.toContain('"recipes"');
    expect(prompt).not.toContain('"steps"');
  });

  it('includes extra ingredients when provided', () => {
    const prompt = buildIngredientsOnlyPrompt('肉じゃが', ['豚肉']);
    expect(prompt).toContain('豚肉');
  });

  it('omits extras section when not given', () => {
    const prompt = buildIngredientsOnlyPrompt('肉じゃが');
    expect(prompt).not.toContain('ユーザーが以下の食材');
  });
});

describe('parseDishInfo', () => {
  it('parses recipes JSON and merges ingredients across recipes', () => {
    const raw = JSON.stringify({
      recipes: [
        {
          title: 'カレー1',
          summary: '王道',
          steps: ['切る', '煮る'],
          ingredients: [
            { name: '玉ねぎ', category: '野菜' },
            { name: '牛肉', category: '肉類' },
          ],
        },
        {
          title: 'カレー2',
          summary: 'シーフード',
          steps: ['切る', '煮る'],
          ingredients: [
            { name: '玉ねぎ', category: '野菜' },
            { name: 'えび', category: '魚介類' },
          ],
        },
      ],
    });
    const info = parseDishInfo(raw);
    expect(info.recipes).toHaveLength(2);
    expect(info.ingredients.map((i) => i.name).sort()).toEqual(['えび', '牛肉', '玉ねぎ']);
  });

  it('parses ingredients-only JSON (no recipes key)', () => {
    const raw = JSON.stringify({
      ingredients: [
        { name: '豚肉', category: '肉類' },
        { name: 'じゃがいも', category: '野菜' },
      ],
    });
    const info = parseDishInfo(raw);
    expect(info.recipes).toEqual([]);
    expect(info.ingredients).toHaveLength(2);
    expect(info.ingredients[0].name).toBe('豚肉');
  });

  it('handles markdown code fences around JSON', () => {
    const raw = '```json\n{ "ingredients": [{ "name": "豚肉", "category": "肉類" }] }\n```';
    const info = parseDishInfo(raw);
    expect(info.ingredients).toHaveLength(1);
    expect(info.recipes).toEqual([]);
  });

  it('falls back to bare-array legacy format', () => {
    const raw = JSON.stringify([
      { name: '玉ねぎ', category: '野菜' },
    ]);
    const info = parseDishInfo(raw);
    expect(info.ingredients).toHaveLength(1);
    expect(info.recipes).toEqual([]);
  });

  it('returns empty result on garbage input', () => {
    const info = parseDishInfo('not json at all');
    expect(info).toEqual({ ingredients: [], recipes: [] });
  });

  it('treats recipes with non-array ingredients as empty', () => {
    const raw = JSON.stringify({
      recipes: [
        { title: 'x', summary: 'y', steps: [], ingredients: 'oops' },
      ],
    });
    const info = parseDishInfo(raw);
    expect(info.recipes).toHaveLength(1);
    expect(info.recipes[0].ingredients).toEqual([]);
    expect(info.ingredients).toEqual([]);
  });
});
