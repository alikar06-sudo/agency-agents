/* Живые данные: состояние тянем из /api/state, изменения слушаем через SSE,
   сцену рисует scene.js. */
const token = new URLSearchParams(location.search).get('token') || '';
const withToken = (path) => (token ? `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : path);

const el = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUS = {
  queued: 'в очереди', routing: 'подбор агента', working: 'в работе',
  waiting_approval: 'ждёт решения', approved: 'принято', rejected: 'отклонено', failed: 'сбой',
};

let state = { agents: [], tasks: [], stats: { byAgent: {} }, runtime: {} };
let built = false;
let filter = 'all';
let openTaskId = null;

async function api(path, options = {}) {
  const res = await fetch(withToken(path), { headers: { 'content-type': 'application/json' }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Ошибка ${res.status}`);
  return body;
}

async function refresh() {
  try {
    state = await api('/api/state');
    if (!built) {
      Office.build(state.agents, {
        onBlock: showBlock,
        onBrain: showBrain,
      });
      el('tAgent').innerHTML = '<option value="">агент — автоматически</option>' +
        state.agents.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
      built = true;
    }
    Office.update(state);
    renderRuntime();
    renderTasks();
    if (openTaskId) showTask(openTaskId, true);
  } catch (err) {
    el('modeText').textContent = `нет связи: ${err.message}`;
  }
}

/* Прогресс печати прилетает часто — обновляем только экраны, без перерисовки списка. */
function applyProgress(event) {
  const task = state.tasks.find((t) => t.id === event.taskId);
  if (!task) return refresh();
  task.partial = event.partial;
  Office.update(state);
}

function connectStream() {
  const source = new EventSource(withToken('/api/stream'));
  source.addEventListener('change', (e) => {
    let payload = null;
    try { payload = JSON.parse(e.data); } catch { /* пропускаем битое событие */ }
    if (payload && payload.type === 'task.progress') return applyProgress(payload);
    refresh();
  });
  source.addEventListener('error', () => {
    el('modeChip').classList.remove('live');
    setTimeout(() => { source.close(); connectStream(); }, 4000);
  });
}

function renderRuntime() {
  const live = state.runtime.live;
  el('shopName').textContent = state.runtime.shop || '';
  el('modeChip').className = 'chip' + (live ? ' live' : '');
  el('modeText').textContent = live ? 'система работает' : 'демо-режим — нет ключа';
  const slot = el('slotModel');
  slot.classList.toggle('on', Boolean(live));
  slot.title = live ? `Модель: ${state.runtime.model}` : 'Модель не подключена — нет ANTHROPIC_API_KEY';
}

function renderTasks() {
  const waiting = state.tasks.filter((t) => t.status === 'waiting_approval');
  const badge = el('waitBadge');
  badge.textContent = waiting.length;
  badge.classList.toggle('zero', !waiting.length);

  const list = state.tasks.filter((t) =>
    filter === 'all' ? true
    : filter === 'active' ? ['working', 'routing', 'queued'].includes(t.status)
    : t.status === filter);

  el('tasks').innerHTML = list.length ? list.map((t) => {
    const agent = state.agents.find((a) => a.id === t.agentId);
    const cls = t.status === 'waiting_approval' ? 'wait'
      : t.status === 'approved' ? 'done'
      : ['rejected', 'failed'].includes(t.status) ? 'off' : 'work';
    const preview = t.status === 'working' ? (t.partial || 'думает…') : (t.output || t.error || t.input || '—');
    return `<div class="task ${t.status === 'waiting_approval' ? 'wait' : ''}" data-open="${t.id}">
      <div class="task-top">
        <span class="st ${cls}">${STATUS[t.status]}</span>
        <span class="task-who">${esc(agent?.name || 'подбор…')}${t.mock ? ' · демо' : ''}</span>
      </div>
      <h4>${esc(t.title)}</h4>
      <p>${esc(String(preview).slice(0, 130))}</p>
      ${t.status === 'waiting_approval' ? `<div class="task-acts">
        <button class="mini ok" data-ok="${t.id}">Принять</button>
        <button class="mini ghost" data-no="${t.id}">Отклонить</button></div>` : ''}
    </div>`;
  }).join('') : '<p class="empty">Здесь пока пусто.</p>';

  bind(el('tasks'));
}

function bind(scope) {
  scope.querySelectorAll('[data-open]').forEach((n) => n.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    showTask(n.dataset.open);
  }));
  scope.querySelectorAll('[data-ok]').forEach((n) =>
    n.addEventListener('click', () => act(`/api/tasks/${n.dataset.ok}/approve`)));
  scope.querySelectorAll('[data-no]').forEach((n) => n.addEventListener('click', () => {
    const reason = prompt('Что не так? (необязательно)') ?? '';
    act(`/api/tasks/${n.dataset.no}/reject`, { reason });
  }));
  scope.querySelectorAll('[data-retry]').forEach((n) =>
    n.addEventListener('click', () => act(`/api/tasks/${n.dataset.retry}/retry`)));
}

async function act(path, body) {
  try {
    await api(path, { method: 'POST', body: JSON.stringify(body || {}) });
    closeSheet();
    refresh();
  } catch (err) { alert(err.message); }
}

/* ---------- модальные окна ---------- */

function showTask(id, keep = false) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return closeSheet();
  const agent = state.agents.find((a) => a.id === t.agentId);
  const body = el('sheetBody');
  const scroll = keep ? body.scrollTop : 0;
  openTaskId = id;
  el('sheetKicker').textContent =
    `${agent?.name || 'подбор агента'} · ${STATUS[t.status]}${t.mock ? ' · демо' : ''}`;
  el('sheetTitle').textContent = t.title;
  body.textContent = t.output || t.partial || t.error || 'Задача выполняется…';
  body.scrollTop = scroll;

  const acts = [];
  if (t.status === 'waiting_approval') {
    acts.push(`<button class="mini ok" data-ok="${t.id}">Принять</button>`);
    acts.push(`<button class="mini ghost" data-no="${t.id}">Отклонить</button>`);
  }
  if (['rejected', 'failed'].includes(t.status)) {
    acts.push(`<button class="mini ok" data-retry="${t.id}">Запустить заново</button>`);
  }
  acts.push('<button class="mini ghost" data-close="1">Закрыть</button>');
  el('sheetActs').innerHTML = acts.join('');
  bind(el('sheetActs'));
  el('sheetActs').querySelector('[data-close]').addEventListener('click', closeSheet);
  el('overlay').hidden = false;
}

function showBlock(name) {
  const list = state.agents.filter((a) => a.block === name);
  openTaskId = null;
  el('sheetKicker').textContent = `отдел · ${list.length} ${list.length === 1 ? 'агент' : 'агента'}`;
  el('sheetTitle').textContent = name;
  el('sheetBody').textContent = list
    .map((a) => `${a.emoji} ${a.name}${a.custom ? '  [написан под этот магазин]' : ''}\n${a.description}\n`)
    .join('\n');
  el('sheetActs').innerHTML = '<button class="mini ghost" data-close="1">Закрыть</button>';
  el('sheetActs').querySelector('[data-close]').addEventListener('click', closeSheet);
  el('overlay').hidden = false;
}

async function showBrain() {
  openTaskId = null;
  el('sheetKicker').textContent = 'общая память · знания магазина';
  el('sheetTitle').textContent = 'Мозг';
  el('sheetBody').textContent = 'Загружаю…';
  el('sheetActs').innerHTML = '<button class="mini ghost" data-close="1">Закрыть</button>';
  el('sheetActs').querySelector('[data-close]').addEventListener('click', closeSheet);
  el('overlay').hidden = false;
  try {
    const brain = await api('/api/brain');
    if (!brain.present) {
      el('sheetBody').textContent = brain.text?.trim()
        ? brain.text
        : 'Пакет знаний не найден. Пока его нет, агенты будут отвечать «не хватает данных» — ' +
          'и это правильно: иначе они начнут выдумывать состав и цены.';
      return;
    }
    el('sheetBody').textContent =
      `Папка: ${brain.dir}\nФайлы: ${brain.files.join(', ')}\n` +
      `\nЭто единственный источник фактов для агентов. Обновляется скриптом ` +
      `«python3 знания/обновить.py» из базы магазина — руками не правим.\n` +
      `\n${'─'.repeat(48)}\n\n${brain.text}`;
    el('sheetActs').insertAdjacentHTML('afterbegin',
      '<button class="mini ok" id="reloadBrain">Перечитать знания</button>');
    el('reloadBrain').addEventListener('click', async () => {
      try {
        const r = await api('/api/brain/reload', { method: 'POST' });
        alert(`Перечитано: ${r.files.length} файлов`);
        showBrain();
      } catch (err) { alert(err.message); }
    });
  } catch (err) {
    el('sheetBody').textContent = `Не удалось прочитать: ${err.message}`;
  }
}

function closeSheet() { openTaskId = null; el('overlay').hidden = true; }

/* ---------- управление ---------- */

el('filters').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  filter = b.dataset.f;
  for (const n of el('filters').children) n.setAttribute('aria-pressed', String(n === b));
  renderTasks();
});

el('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = el('tTitle').value.trim();
  if (!title) return;
  const btn = el('goBtn');
  btn.disabled = true;
  try {
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, input: el('tInput').value.trim(), agentId: el('tAgent').value || null }),
    });
    el('tTitle').value = '';
    el('tInput').value = '';
    refresh();
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; }
});

el('sheetX').addEventListener('click', closeSheet);
el('overlay').addEventListener('click', (e) => { if (e.target === el('overlay')) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
setInterval(() => { el('clock').textContent = new Date().toLocaleTimeString('ru-RU', { hour12: false }); }, 1000);

refresh();
connectStream();
setInterval(refresh, 20000);
