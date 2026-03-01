const API = '/api/shopping';

const listEl = document.getElementById('shopping-list');
const formEl = document.getElementById('add-form');
const nameInput = document.getElementById('item-name');
const quantityInput = document.getElementById('item-quantity');
const countEl = document.getElementById('item-count');
const deleteCheckedBtn = document.getElementById('delete-checked');
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
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'list-item' + (item.checked ? ' checked' : '');
    li.innerHTML = `
      <input type="checkbox" ${item.checked ? 'checked' : ''}>
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.name)}</div>
        ${item.quantity > 1 ? `<div class="item-quantity">x${item.quantity}</div>` : ''}
      </div>
      <button class="btn-delete">&times;</button>
    `;
    li.querySelector('input[type="checkbox"]').addEventListener('change', () => toggleCheck(item));
    li.querySelector('.btn-delete').addEventListener('click', () => removeItem(item.id));
    listEl.appendChild(li);
  });

  const checkedCount = items.filter(i => i.checked).length;
  countEl.textContent = `${items.length} 件`;
  deleteCheckedBtn.style.display = checkedCount > 0 ? '' : 'none';
  emptyEl.style.display = items.length === 0 ? '' : 'none';
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

async function addItem(name, quantity) {
  const res = await api('POST', '', { name, quantity });
  if (res.success) {
    items.unshift(res.data);
    render();
  }
}

async function toggleCheck(item) {
  const res = await api('PUT', `/${item.id}`, { checked: item.checked ? 0 : 1 });
  if (res.success) {
    item.checked = res.data.checked;
    // チェック済みを下に並べ替え
    items.sort((a, b) => a.checked - b.checked);
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

async function removeChecked() {
  const res = await api('DELETE', '/checked');
  if (res.success) {
    items = items.filter(i => !i.checked);
    render();
  }
}

// イベント
formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  const quantity = parseInt(quantityInput.value, 10) || 1;
  addItem(name, quantity);
  nameInput.value = '';
  quantityInput.value = '1';
  nameInput.focus();
});

deleteCheckedBtn.addEventListener('click', removeChecked);

// 初期読み込み
loadItems();
