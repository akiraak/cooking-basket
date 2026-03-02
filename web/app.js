const API = '/api/shopping';
const DISH_API = '/api/dishes';

const listEl = document.getElementById('shopping-list');
const countEl = document.getElementById('item-count');
const emptyEl = document.getElementById('empty-message');

// FAB
const fabItem = document.getElementById('fab-item');
const fabDish = document.getElementById('fab-dish');

// モーダル
const modalOverlay = document.getElementById('modal-overlay');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalInput = document.getElementById('modal-input');
const modalDishRow = document.getElementById('modal-dish-row');
const modalDishSelect = document.getElementById('modal-dish-select');
const modalOk = document.getElementById('modal-ok');
const modalCancel = document.getElementById('modal-cancel');

let items = [];
let dishes = [];
let modalMode = null; // 'item' | 'dish'

// API 通信
async function api(method, path = '', body = null, base = API) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(base + path, opts);
  return res.json();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// アイテムがどの料理に紐づくか逆引きマップを作成
function buildItemDishMap() {
  const map = {};
  dishes.forEach(dish => {
    (dish.items || []).forEach(item => {
      if (!map[item.id]) map[item.id] = [];
      map[item.id].push(dish.id);
    });
  });
  return map;
}

// 描画
function render() {
  listEl.innerHTML = '';
  const unchecked = items.filter(i => !i.checked);
  const itemDishMap = buildItemDishMap();

  // 料理ごとにグループ化
  const grouped = {};
  const ungrouped = [];

  unchecked.forEach(item => {
    const dishIds = itemDishMap[item.id];
    if (dishIds && dishIds.length > 0) {
      dishIds.forEach(dishId => {
        if (!grouped[dishId]) grouped[dishId] = [];
        grouped[dishId].push(item);
      });
    } else {
      ungrouped.push(item);
    }
  });

  // 料理グループを表示
  dishes.forEach(dish => {
    const dishItems = grouped[dish.id] || [];

    const group = document.createElement('div');
    group.className = 'dish-group';

    const header = document.createElement('div');
    header.className = dishItems.length > 0 ? 'dish-header' : 'dish-header dish-header-empty';
    header.innerHTML = `
      <span class="dish-name">${escapeHtml(dish.name)}</span>
      <button class="btn-delete-dish" title="料理を削除">&times;</button>
    `;
    header.querySelector('.btn-delete-dish').addEventListener('click', () => removeDish(dish.id));
    group.appendChild(header);

    if (dishItems.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'dish-items';
      dishItems.forEach(item => {
        ul.appendChild(createItemEl(item));
      });
      group.appendChild(ul);
    }
    listEl.appendChild(group);
  });

  // 未分類アイテム
  if (ungrouped.length > 0) {
    if (dishes.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'ungrouped-label';
      divider.textContent = '未分類';
      listEl.appendChild(divider);
    }

    const ul = document.createElement('ul');
    ul.className = 'ungrouped-items';
    ungrouped.forEach(item => {
      ul.appendChild(createItemEl(item));
    });
    listEl.appendChild(ul);
  }

  countEl.textContent = `${unchecked.length} 件`;
  emptyEl.style.display = (unchecked.length === 0 && dishes.length === 0) ? '' : 'none';
}

function createItemEl(item) {
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
  return li;
}

// 料理ドロップダウンを更新
function updateDishSelect() {
  modalDishSelect.innerHTML = '<option value="">未分類</option>';
  dishes.forEach(dish => {
    const opt = document.createElement('option');
    opt.value = dish.id;
    opt.textContent = dish.name;
    modalDishSelect.appendChild(opt);
  });
}

// データ読み込み
async function loadItems() {
  const res = await api('GET');
  if (res.success) {
    items = res.data;
    render();
  }
}

async function loadDishes() {
  const res = await api('GET', '', null, DISH_API);
  if (res.success) {
    dishes = res.data;
    updateDishSelect();
    render();
  }
}

async function loadAll() {
  await loadDishes();
  await loadItems();
}

// アイテム操作
async function addItem(name, dishId) {
  const res = await api('POST', '', { name });
  if (res.success) {
    items.unshift(res.data);
    if (dishId) {
      await api('POST', `/${dishId}/items`, { itemId: res.data.id }, DISH_API);
      await loadDishes();
    }
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
    await loadDishes();
    render();
  }
}

// 料理操作
async function addDish(name) {
  const res = await api('POST', '', { name }, DISH_API);
  if (res.success) {
    dishes.unshift(res.data);
    updateDishSelect();
    render();
  }
}

async function removeDish(id) {
  const res = await api('DELETE', `/${id}`, null, DISH_API);
  if (res.success) {
    dishes = dishes.filter(d => d.id !== id);
    updateDishSelect();
    render();
  }
}

// モーダル
function openModal(mode) {
  modalMode = mode;
  modalInput.value = '';
  if (mode === 'item') {
    modalTitle.textContent = 'アイテムを追加';
    modalInput.placeholder = 'アイテム名';
    modalDishRow.style.display = '';
    modalDishSelect.value = '';
  } else {
    modalTitle.textContent = '料理を追加';
    modalInput.placeholder = '料理名';
    modalDishRow.style.display = 'none';
  }
  modalOverlay.classList.add('active');
  setTimeout(() => modalInput.focus(), 100);
}

function closeModal() {
  modalOverlay.classList.remove('active');
  modalMode = null;
}

function submitModal() {
  const name = modalInput.value.trim();
  if (!name) return;
  if (modalMode === 'item') {
    const dishId = modalDishSelect.value || null;
    addItem(name, dishId);
  } else {
    addDish(name);
  }
  closeModal();
}

// イベント
fabItem.addEventListener('click', () => openModal('item'));
fabDish.addEventListener('click', () => openModal('dish'));
modalCancel.addEventListener('click', closeModal);
modalOk.addEventListener('click', submitModal);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

modalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitModal();
  }
});

// 画面回転ロック（対応ブラウザのみ）
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('portrait').catch(() => {});
}

// 初期読み込み
loadAll();
