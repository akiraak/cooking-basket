const API = '/api/shopping';

const listEl = document.getElementById('shopping-list');
const formEl = document.getElementById('add-form');
const nameInput = document.getElementById('item-name');
const countEl = document.getElementById('item-count');
const emptyEl = document.getElementById('empty-message');

let items = [];

// API 通信
async function api(method, path = '', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

// 描画
function render() {
  listEl.innerHTML = '';
  const unchecked = items.filter(i => !i.checked);
  unchecked.forEach(item => {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.innerHTML = `
      <input type="checkbox">
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.name)}</div>
      </div>
      <button class="btn-delete">&times;</button>
    `;
    li.querySelector('input[type="checkbox"]').addEventListener('change', () => toggleCheck(item));
    li.querySelector('.btn-delete').addEventListener('click', () => removeItem(item.id));
    listEl.appendChild(li);
  });

  countEl.textContent = `${unchecked.length} 件`;
  emptyEl.style.display = unchecked.length === 0 ? '' : 'none';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 操作
async function loadItems() {
  const res = await api('GET');
  if (res.success) {
    items = res.data;
    render();
  }
}

async function addItem(name) {
  const res = await api('POST', '', { name });
  if (res.success) {
    items.unshift(res.data);
    render();
  }
}

async function toggleCheck(item) {
  const res = await api('PUT', `/${item.id}`, { checked: 1 });
  if (res.success) {
    items = items.filter(i => i.id !== item.id);
    render();
  }
}

async function removeItem(id) {
  const res = await api('DELETE', `/${id}`);
  if (res.success) {
    items = items.filter(i => i.id !== id);
    render();
  }
}

// イベント
formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  addItem(name);
  nameInput.value = '';
  nameInput.focus();
});

// 初期読み込み
loadItems();
