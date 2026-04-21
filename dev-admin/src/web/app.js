'use strict';

const CATEGORY_LABELS = {
  plans: 'Plans',
  specs: 'Specs',
  design: 'Design',
};

const sidebarNav = document.getElementById('sidebar-nav');
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
const topbarSub = document.getElementById('topbar-sub');

let docsIndex = { plans: [], specs: [], design: [] };

async function fetchJson(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '読み込みに失敗しました');
  return json.data;
}

function renderSidebar() {
  const frag = document.createDocumentFragment();
  for (const category of ['plans', 'specs', 'design']) {
    const items = docsIndex[category] || [];
    if (items.length === 0) continue;

    const label = document.createElement('div');
    label.className = 'nav-group-label';
    label.textContent = `${CATEGORY_LABELS[category]} (${items.length})`;
    frag.appendChild(label);

    for (const item of items) {
      const a = document.createElement('a');
      a.className = 'nav-item';
      a.href = `#${category}/${encodeURIComponent(item.file)}`;
      a.dataset.category = category;
      a.dataset.file = item.file;

      const title = document.createElement('div');
      title.textContent = item.title;
      a.appendChild(title);

      const file = document.createElement('div');
      file.className = 'nav-item-file';
      file.textContent = item.file;
      a.appendChild(file);

      frag.appendChild(a);
    }
  }

  sidebarNav.innerHTML = '';
  sidebarNav.appendChild(frag);
}

function updateActive(category, file) {
  const items = sidebarNav.querySelectorAll('.nav-item');
  items.forEach(el => {
    if (el.dataset.category === category && el.dataset.file === file) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

async function renderMarkdown(category, file) {
  contentArea.innerHTML = '<div class="loading-text">読み込み中...</div>';
  try {
    const data = await fetchJson(`/api/docs/${category}/${encodeURIComponent(file)}`);
    pageTitle.textContent = data.title;
    topbarSub.textContent = `${category}/${file}`;
    const div = document.createElement('div');
    div.className = 'md-content';
    div.innerHTML = data.html;
    contentArea.innerHTML = '';
    contentArea.appendChild(div);
  } catch (err) {
    showError(err.message);
  }
}

function renderDesign(file) {
  const meta = (docsIndex.design || []).find(d => d.file === file);
  pageTitle.textContent = meta ? meta.title : file;
  topbarSub.textContent = `design/${file}`;

  const wrap = document.createElement('div');
  wrap.className = 'design-frame-wrap';

  const toolbar = document.createElement('div');
  toolbar.className = 'design-frame-toolbar';
  const left = document.createElement('span');
  left.textContent = file;
  const right = document.createElement('a');
  right.className = 'design-frame-open';
  right.href = `/api/design/${encodeURIComponent(file)}`;
  right.target = '_blank';
  right.rel = 'noopener';
  right.textContent = '別タブで開く ↗';
  toolbar.appendChild(left);
  toolbar.appendChild(right);

  const iframe = document.createElement('iframe');
  iframe.className = 'design-frame';
  iframe.src = `/api/design/${encodeURIComponent(file)}`;
  iframe.title = file;

  wrap.appendChild(toolbar);
  wrap.appendChild(iframe);

  contentArea.innerHTML = '';
  contentArea.appendChild(wrap);
}

function showError(message) {
  contentArea.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'error-text';
  div.textContent = message;
  contentArea.appendChild(div);
}

function showEmpty() {
  pageTitle.textContent = 'ドキュメント';
  topbarSub.textContent = '';
  contentArea.innerHTML = '<div class="empty-state">サイドバーからドキュメントを選択してください。</div>';
}

function handleRoute() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) {
    updateActive('', '');
    showEmpty();
    return;
  }
  const slash = hash.indexOf('/');
  if (slash < 0) {
    showEmpty();
    return;
  }
  const category = hash.slice(0, slash);
  const file = decodeURIComponent(hash.slice(slash + 1));

  if (!['plans', 'specs', 'design'].includes(category)) {
    showError('不正なカテゴリです');
    return;
  }

  updateActive(category, file);

  if (category === 'design') {
    renderDesign(file);
  } else {
    renderMarkdown(category, file);
  }
}

async function init() {
  try {
    docsIndex = await fetchJson('/api/docs');
    renderSidebar();
    handleRoute();
  } catch (err) {
    sidebarNav.innerHTML = '';
    showError(err.message);
  }
}

window.addEventListener('hashchange', handleRoute);
init();
