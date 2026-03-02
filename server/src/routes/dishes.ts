import { Router, Request, Response, NextFunction } from 'express';
import {
  getAllDishes,
  getDish,
  createDish,
  deleteDish,
  linkItemToDish,
  unlinkItemFromDish,
  getDishSuggestions,
} from '../services/dish-service';
import { askGemini } from '../services/gemini-service';

interface Ingredient {
  name: string;
  category: string;
}

function buildIngredientPrompt(dishName: string): string {
  return `あなたは料理の専門家です。「${dishName}」を作るために必要な具材をリストアップしてください。

以下の条件を守ってください:
- 一般的な調味料（塩、胡椒、醤油、砂糖、油など）は含めない
- 主要な食材のみをリストアップする
- 各具材にはカテゴリ（野菜、肉類、魚介類、乳製品、穀類、その他）を付ける
- 回答は以下のJSON形式のみで返してください。JSON以外のテキストは含めないでください:

[
  { "name": "具材名", "category": "カテゴリ" }
]`;
}

function parseIngredients(raw: string): Ingredient[] | null {
  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed as Ingredient[];
    }
    return null;
  } catch {
    return null;
  }
}

export const dishesRouter = Router();

// 全料理取得
dishesRouter.get('/', (_req: Request, res: Response) => {
  try {
    const dishes = getAllDishes();
    res.json({ success: true, data: dishes, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: String(err) });
  }
});

// 料理名サジェスト (/:id より先に定義)
dishesRouter.get('/suggestions', (req: Request, res: Response) => {
  const q = req.query.q;
  const query = (typeof q === 'string') ? q.trim() : '';
  const limit = query ? 10 : 3;
  const suggestions = getDishSuggestions(query, limit);
  res.json({ success: true, data: suggestions, error: null });
});

// 料理追加
dishesRouter.post('/', (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ success: false, data: null, error: 'name は必須です' });
      return;
    }
    const dish = createDish(name.trim());
    res.status(201).json({ success: true, data: dish, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: String(err) });
  }
});

// 料理削除
dishesRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const deleted = deleteDish(id);
    if (!deleted) {
      res.status(404).json({ success: false, data: null, error: '料理が見つかりません' });
      return;
    }
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: String(err) });
  }
});

// AI 具材提案
dishesRouter.post('/:id/suggest-ingredients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const dish = getDish(id);
    if (!dish) {
      res.status(404).json({ success: false, data: null, error: '料理が見つかりません' });
      return;
    }

    const prompt = buildIngredientPrompt(dish.name);
    const raw = await askGemini(prompt);
    const ingredients = parseIngredients(raw);

    res.json({
      success: true,
      data: {
        dishId: dish.id,
        dishName: dish.name,
        ingredients: ingredients ?? [],
        rawResponse: ingredients ? undefined : raw,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// 料理に食材をリンク
dishesRouter.post('/:id/items', (req: Request, res: Response) => {
  try {
    const dishId = Number(req.params.id);
    const { itemId } = req.body;
    if (!itemId) {
      res.status(400).json({ success: false, data: null, error: 'itemId は必須です' });
      return;
    }
    const linked = linkItemToDish(dishId, Number(itemId));
    if (!linked) {
      res.status(400).json({ success: false, data: null, error: 'リンクに失敗しました' });
      return;
    }
    const dish = getDish(dishId);
    res.json({ success: true, data: dish, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: String(err) });
  }
});

// 料理から食材をリンク解除
dishesRouter.delete('/:id/items/:itemId', (req: Request, res: Response) => {
  try {
    const dishId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const unlinked = unlinkItemFromDish(dishId, itemId);
    if (!unlinked) {
      res.status(404).json({ success: false, data: null, error: 'リンクが見つかりません' });
      return;
    }
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: String(err) });
  }
});
