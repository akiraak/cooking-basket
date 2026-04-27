import { Router, Request, Response, NextFunction } from 'express';
import {
  getAllItems,
  createItem,
  updateItem,
  deleteItem,
  deleteCheckedItems,
  reorderItems,
} from '../services/shopping-service';
import { ERR } from '../lib/errors';

export const shoppingRouter = Router();

// 全食材取得
shoppingRouter.get('/', (req: Request, res: Response) => {
  const items = getAllItems(req.userId!);
  res.json({ success: true, data: items, error: null });
});

// 食材追加
shoppingRouter.post('/', (req: Request, res: Response) => {
  const { name, category } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ success: false, data: null, error: ERR.NAME_REQUIRED });
    return;
  }
  const item = createItem(req.userId!, { name: name.trim(), category });
  res.status(201).json({ success: true, data: item, error: null });
});

// 並べ替え (/:id より先に定義)
shoppingRouter.put('/reorder', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ success: false, data: null, error: 'orderedIds は配列で指定してください' });
      return;
    }
    reorderItems(req.userId!, orderedIds);
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

// チェック済み一括削除 (/:id より先に定義)
shoppingRouter.delete('/checked', (req: Request, res: Response) => {
  const count = deleteCheckedItems(req.userId!);
  res.json({ success: true, data: { deleted: count }, error: null });
});

// 食材更新
shoppingRouter.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const item = updateItem(req.userId!, id, req.body);
  if (!item) {
    res.status(404).json({ success: false, data: null, error: ERR.ITEM_NOT_FOUND });
    return;
  }
  res.json({ success: true, data: item, error: null });
});

// 食材削除
shoppingRouter.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const deleted = deleteItem(req.userId!, id);
  if (!deleted) {
    res.status(404).json({ success: false, data: null, error: ERR.ITEM_NOT_FOUND });
    return;
  }
  res.json({ success: true, data: null, error: null });
});
