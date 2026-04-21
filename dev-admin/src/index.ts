import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

const app = express();
const PORT = Number(process.env.DEV_ADMIN_PORT) || 3010;
const HOST = '127.0.0.1';

const DOCS_DIR = path.join(__dirname, '../../docs');
const MD_CATEGORIES = ['plans', 'specs'] as const;
type MdCategory = typeof MD_CATEGORIES[number];
const ALL_CATEGORIES = ['plans', 'specs', 'design'] as const;
type Category = typeof ALL_CATEGORIES[number];

function extractMdTitle(raw: string, fallback: string): string {
  const fm = raw.match(/^---[\s\S]*?title:\s*(.+?)\s*\n[\s\S]*?---/);
  if (fm) return fm[1].trim();
  const stripped = raw.replace(/^---[\s\S]*?---\n*/, '');
  const h1 = stripped.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return fallback;
}

function extractHtmlTitle(raw: string, fallback: string): string {
  const t = raw.match(/<title>([^<]+)<\/title>/i);
  if (t) return t[1].trim();
  const h1 = raw.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) return h1[1].trim();
  return fallback;
}

function listMdFiles(category: MdCategory): { file: string; title: string }[] {
  const dir = path.join(DOCS_DIR, category);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(file => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      return { file, title: extractMdTitle(raw, file.replace(/\.md$/, '')) };
    });
}

function listDesignFiles(): { file: string; title: string }[] {
  const dir = path.join(DOCS_DIR, 'specs', 'design');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html'))
    .sort()
    .map(file => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      return { file, title: extractHtmlTitle(raw, file.replace(/\.html$/, '')) };
    });
}

function isSafeName(file: string, ext: string): boolean {
  return !file.includes('..') && !file.includes('/') && !file.includes('\\') && file.endsWith(ext);
}

// ドキュメント一覧
app.get('/api/docs', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      plans: listMdFiles('plans'),
      specs: listMdFiles('specs'),
      design: listDesignFiles(),
    },
    error: null,
  });
});

// markdown ドキュメント取得（HTML 変換）
app.get('/api/docs/:category/:file', (req: Request, res: Response) => {
  const category = req.params.category as string;
  const file = req.params.file as string;

  if (!MD_CATEGORIES.includes(category as MdCategory)) {
    res.status(400).json({ success: false, data: null, error: '不正なカテゴリです' });
    return;
  }
  if (!isSafeName(file, '.md')) {
    res.status(400).json({ success: false, data: null, error: '不正なファイル名です' });
    return;
  }

  const filePath = path.join(DOCS_DIR, category, file);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, data: null, error: 'ファイルが見つかりません' });
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const title = extractMdTitle(raw, file.replace(/\.md$/, ''));
  const md = raw.replace(/^---[\s\S]*?---\n*/, '');
  const html = marked(md) as string;
  res.json({ success: true, data: { title, html }, error: null });
});

// design HTML をそのまま返す（iframe 用）
app.get('/api/design/:file', (req: Request, res: Response) => {
  const file = req.params.file as string;
  if (!isSafeName(file, '.html')) {
    res.status(400).send('不正なファイル名です');
    return;
  }
  const filePath = path.join(DOCS_DIR, 'specs', 'design', file);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('ファイルが見つかりません');
    return;
  }
  res.type('html').sendFile(filePath);
});

// 静的配信（dev-admin/src/web/）
app.use(express.static(path.join(__dirname, 'web')));

app.listen(PORT, HOST, () => {
  console.log(`[dev-admin] running at http://${HOST}:${PORT}`);
});
