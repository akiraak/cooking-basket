import { Router, Request, Response, NextFunction } from 'express';
import { askGemini } from '../services/gemini-service';
import {
  buildDishInfoPrompt,
  buildIngredientsOnlyPrompt,
  parseDishInfo,
} from '../services/dish-ai';

export const aiRouter = Router();

type SuggestMode = 'ingredients' | 'recipes' | 'both';
const VALID_MODES: SuggestMode[] = ['ingredients', 'recipes', 'both'];

// POST /api/ai/suggest — 料理名から具材・レシピを生成（ステートレス）
//   mode='ingredients' : 具材のみ生成（レシピは [] で返す）
//   mode='recipes'     : レシピ + 具材（レシピから派生）を生成
//   mode='both'        : 既存挙動（後方互換）。省略時のデフォルト
aiRouter.post('/suggest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dishName, extraIngredients, mode } = req.body;
    if (!dishName || typeof dishName !== 'string' || dishName.trim() === '') {
      res.status(400).json({ success: false, data: null, error: 'dishName は必須です' });
      return;
    }

    const requestedMode: SuggestMode = mode === undefined ? 'both' : mode;
    if (!VALID_MODES.includes(requestedMode)) {
      res.status(400).json({ success: false, data: null, error: 'invalid_mode' });
      return;
    }

    const extras = Array.isArray(extraIngredients)
      ? (extraIngredients as unknown[]).filter((e): e is string => typeof e === 'string' && e.trim() !== '')
      : [];

    const prompt = requestedMode === 'ingredients'
      ? buildIngredientsOnlyPrompt(dishName.trim(), extras.length > 0 ? extras : undefined)
      : buildDishInfoPrompt(dishName.trim(), extras.length > 0 ? extras : undefined);
    const raw = await askGemini(prompt);
    const info = parseDishInfo(raw);

    res.json({
      success: true,
      data: { ingredients: info.ingredients, recipes: info.recipes },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});
