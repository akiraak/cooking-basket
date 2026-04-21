import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import {
  getDashboardStats,
  getAllUsers,
  deleteUser,
  getAllShoppingItems,
  updateShoppingItem,
  deleteShoppingItem,
  getAllDishes,
  deleteDish,
  getAllPurchaseHistory,
  getAllSavedRecipesAdmin,
  deleteSavedRecipeAdmin,
  getSystemInfo,
} from '../services/admin-service';

export const adminRouter = Router();

const DOCS_DIR = path.join(__dirname, '../../../docs');
const DOC_CATEGORIES = ['plans', 'specs'] as const;
type DocCategory = typeof DOC_CATEGORIES[number];

function extractTitle(raw: string, fallback: string): string {
  const fm = raw.match(/^---[\s\S]*?title:\s*(.+?)\s*\n[\s\S]*?---/);
  if (fm) return fm[1].trim();
  const stripped = raw.replace(/^---[\s\S]*?---\n*/, '');
  const h1 = stripped.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return fallback;
}

// ダッシュボード統計
adminRouter.get('/dashboard', (_req: Request, res: Response) => {
  const stats = getDashboardStats();
  res.json({ success: true, data: stats, error: null });
});

// ユーザー一覧
adminRouter.get('/users', (_req: Request, res: Response) => {
  const users = getAllUsers();
  res.json({ success: true, data: users, error: null });
});

// ユーザー削除
adminRouter.delete('/users/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const deleted = deleteUser(id);
  if (!deleted) {
    res.status(404).json({ success: false, data: null, error: 'ユーザーが見つかりません' });
    return;
  }
  res.json({ success: true, data: null, error: null });
});

// 買い物食材一覧（全ユーザー）
adminRouter.get('/shopping', (_req: Request, res: Response) => {
  const items = getAllShoppingItems();
  res.json({ success: true, data: items, error: null });
});

// 買い物食材更新
adminRouter.put('/shopping/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const item = updateShoppingItem(id, req.body);
  if (!item) {
    res.status(404).json({ success: false, data: null, error: '食材が見つかりません' });
    return;
  }
  res.json({ success: true, data: item, error: null });
});

// 買い物食材削除
adminRouter.delete('/shopping/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const deleted = deleteShoppingItem(id);
  if (!deleted) {
    res.status(404).json({ success: false, data: null, error: '食材が見つかりません' });
    return;
  }
  res.json({ success: true, data: null, error: null });
});

// 料理一覧（全ユーザー）
adminRouter.get('/dishes', (_req: Request, res: Response) => {
  const dishes = getAllDishes();
  res.json({ success: true, data: dishes, error: null });
});

// 料理削除
adminRouter.delete('/dishes/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const deleted = deleteDish(id);
  if (!deleted) {
    res.status(404).json({ success: false, data: null, error: '料理が見つかりません' });
    return;
  }
  res.json({ success: true, data: null, error: null });
});

// 購入履歴
adminRouter.get('/purchase-history', (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 500;
  const history = getAllPurchaseHistory(limit);
  res.json({ success: true, data: history, error: null });
});

// 料理レシピ一覧
adminRouter.get('/saved-recipes', (_req: Request, res: Response) => {
  const recipes = getAllSavedRecipesAdmin();
  res.json({ success: true, data: recipes, error: null });
});

// 料理レシピ削除
adminRouter.delete('/saved-recipes/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const deleted = deleteSavedRecipeAdmin(id);
  if (!deleted) {
    res.status(404).json({ success: false, data: null, error: 'レシピが見つかりません' });
    return;
  }
  res.json({ success: true, data: null, error: null });
});

// システム情報
adminRouter.get('/system', (_req: Request, res: Response) => {
  const info = getSystemInfo();
  res.json({ success: true, data: info, error: null });
});

// docs/plans, docs/specs ドキュメント一覧
adminRouter.get('/docs-files', (_req: Request, res: Response) => {
  const result: Record<string, { file: string; title: string }[]> = {};
  for (const category of DOC_CATEGORIES) {
    const dir = path.join(DOCS_DIR, category);
    if (!fs.existsSync(dir)) { result[category] = []; continue; }
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .sort();
    result[category] = files.map(file => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      return { file, title: extractTitle(raw, file.replace(/\.md$/, '')) };
    });
  }
  res.json({ success: true, data: result, error: null });
});

// docs/plans, docs/specs 個別ドキュメントの HTML を返す
adminRouter.get('/docs-files/:category/:file', (req: Request, res: Response) => {
  const category = req.params.category as string;
  const file = req.params.file as string;

  if (!DOC_CATEGORIES.includes(category as DocCategory)) {
    res.status(400).json({ success: false, data: null, error: '不正なカテゴリです' });
    return;
  }
  if (file.includes('..') || file.includes('/') || file.includes('\\') || !file.endsWith('.md')) {
    res.status(400).json({ success: false, data: null, error: '不正なファイル名です' });
    return;
  }

  const filePath = path.join(DOCS_DIR, category, file);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, data: null, error: 'ファイルが見つかりません' });
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const title = extractTitle(raw, file.replace(/\.md$/, ''));
  const md = raw.replace(/^---[\s\S]*?---\n*/, '');
  const html = marked(md) as string;
  res.json({ success: true, data: { title, html }, error: null });
});
