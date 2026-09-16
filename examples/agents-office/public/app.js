/* Живые данные: состояние из /api/state, изменения через SSE, сцену рисует scene.js. */
const token = new URLSearchParams(location.search).get('token') || '';
const withToken = (p) => (token ? `${p}${p.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : p);

const el = (id) => document.getElementById(id);

// Встроенный режим: панель живёт внутри чужой страницы, поэтому своя шапка
// и часы там лишние — место отдаём сцене.
const EMBED = new URLSearchParams(location.search).get('embed') === '1';
if (EMBED) document.documentElement.classList.add('embed');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n) => Number(n || 0).toLocaleString('ru-RU');

const STATUS = {
  queued: 'в очереди', routing: 'подбор агента', working: 'в работе',
  waiting_approval: 'ждёт решения', approved: 'принято', rejected: 'отклонено', failed: 'сбой',
};

let state = { agents: [], tasks: [], stats: { byAgent: {} }, runtime: {}, catalog: null };
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
      Office.build(state.agents, { onBlock: showBlock, onBrain: showBrain });
      el('tAgent').innerHTML = '<option value="">агент — автоматически</option>' +
        state.agents.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
      built = true;
    }
    Office.update(state);
    renderTop();
    renderTasks();
    if (openTaskId) showTask(openTaskId, true);
  } catch (err) {
    el('modeText').textContent = `нет связи: ${err.message}`;
  }
}

/* Прогресс печати приходит часто — трогаем только сцену, список не перерисовываем. */
function applyProgress(event) {
  const task = state.tasks.find((t) => t.id === event.taskId);
  if (!task) return refresh();
  task.partial = event.partial;
  task.tools = event.tools || task.tools;
  Office.update(state);
}

/* Поток событий — основной канал, но не единственный. Обратный прокси или
   корпоративная сеть умеют молча резать SSE: соединение висит, событий нет,
   и панель замирает на состоянии, каким оно было при загрузке страницы.
   Поэтому рядом идёт опрос: часто, пока поток молчит, и редко — как страховка,
   когда он живой. */
let streamLive = false;
let lastEventAt = Date.now();

function connectStream() {
  const source = new EventSource(withToken('/api/stream'));
  source.addEventListener('hello', () => { streamLive = true; lastEventAt = Date.now(); });
  source.addEventListener('change', (e) => {
    streamLive = true;
    lastEventAt = Date.now();
    let payload = null;
    try { payload = JSON.parse(e.data); } catch { /* битое событие пропускаем */ }
    if (payload && payload.type === 'task.progress') return applyProgress(payload);
    refresh();
  });
  source.addEventListener('error', () => {
    streamLive = false;
    el('modeChip').classList.remove('live');
    setTimeout(() => { source.close(); connectStream(); }, 4000);
  });
}

function startPolling() {
  setInterval(() => {
    if (document.hidden) return;                 // вкладка свёрнута — не дёргаем сервер
    const silent = Date.now() - lastEventAt;
    if (!streamLive || silent > 45000) refresh();
  }, 8000);
  // Вернулись на вкладку с админкой — показываем свежее состояние сразу
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

/* ---------- шапка ---------- */

function renderTop() {
  const live = state.runtime.live;
  el('shopName').textContent = state.runtime.shop || '';
  el('modeChip').className = 'chip' + (live ? ' live' : '');
  el('modeText').textContent = live ? `${state.runtime.model}` : 'демо — нет ключа';

  const c = state.catalog;
  el('kAgents').textContent = state.agents.length;
  el('kCatalog').textContent = c ? nf(c.total) : '—';
  el('kStock').textContent = c ? nf(c.inStock) : '—';

  const waiting = state.tasks.filter((t) => t.status === 'waiting_approval').length;
  const busy = state.tasks.filter((t) => t.status === 'working' || t.status === 'routing').length;
  el('kWait').textContent = waiting;
  el('kWaitBox').classList.toggle('on', waiting > 0);
  el('kBusy').textContent = busy;
  el('kBusy').closest('.kpi').classList.toggle('on', busy > 0);
  el('kBusy').closest('.kpi').classList.add('busy');
  const spend = state.spend || 0;
  el('kSpend').textContent = spend < 0.01 && spend > 0 ? '<$0.01' : '$' + spend.toFixed(2);
}

/* ---------- список задач ---------- */

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
    const tool = t.status === 'working' && t.tools?.length ? `⚙ ${t.tools[t.tools.length - 1]}` : '';
    const rv = t.review
      ? `<div class="verdict ${t.review.verdict === 'ok' ? 'ok' : 'rework'}">${
          t.review.verdict === 'ok'
            ? '✓ управляющий принял'
            : '↺ управляющий вернул: ' + esc(t.review.notes[0] || '')}</div>`
      : '';
    const preview = t.status === 'working'
      ? (tool || t.partial || 'думает…')
      : (t.output || t.error || t.input || '—');
    return `<div class="task ${t.status === 'waiting_approval' ? 'wait' : ''}" data-open="${t.id}">
      <div class="task-top">
        <span class="st ${cls}">${STATUS[t.status]}</span>
        <span class="task-who">${esc(agent?.name || 'подбор…')}${t.mock ? ' · демо' : ''}</span>
      </div>
      <h4>${esc(t.title)}</h4>
      <p>${esc(String(preview).slice(0, 140))}</p>
      ${rv}
      ${t.status === 'waiting_approval' ? `<div class="task-acts">
        <button class="mini ok" data-ok="${t.id}">Принять</button>
        <button class="mini ghost" data-no="${t.id}">Отклонить</button></div>` : ''}
    </div>`;
  }).join('') : '<p class="empty">Здесь пока пусто.<br>Поставьте задачу или нажмите ⌘K.</p>';

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

async function submit({ title, input = '', agentId = null }) {
  if (!title.trim()) return;
  await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title, input, agentId }) });
  refresh();
}

/* ---------- модальные окна ---------- */

function showTask(id, keep = false) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return closeSheet();
  const agent = state.agents.find((a) => a.id === t.agentId);
  const body = el('sheetBody');
  const scroll = keep ? body.scrollTop : 0;
  openTaskId = id;

  const bits = [agent?.name || 'подбор агента', STATUS[t.status]];
  if (t.steps > 1) bits.push(`${t.steps} шага с инструментами`);
  if (t.round > 1) bits.push(`${t.round}-я версия`);
  if (t.review) bits.push(t.review.verdict === 'ok' ? 'управляющий принял' : 'после доработки');
  if (t.cost) bits.push('$' + t.cost.toFixed(3));
  if (t.mock) bits.push('демо');
  el('sheetKicker').textContent = bits.join(' · ');
  el('sheetTitle').textContent = t.title;
  const verdictText = t.review && t.review.notes?.length
    ? `— Замечания управляющего —\n` + t.review.notes.map((n) => `• ${n}`).join('\n') + `\n\n${'─'.repeat(40)}\n\n`
    : '';
  body.textContent = verdictText + (t.output || t.partial || t.error || 'Задача выполняется…');
  body.scrollTop = scroll;

  const acts = [];
  if (t.status === 'waiting_approval') {
    acts.push(`<button class="mini ok" data-ok="${t.id}">Принять</button>`);
    acts.push(`<button class="mini ghost" data-no="${t.id}">Отклонить</button>`);
  }
  if (['rejected', 'failed'].includes(t.status)) {
    acts.push(`<button class="mini ok" data-retry="${t.id}">Запустить заново</button>`);
  }
  if (t.output) acts.push('<button class="mini ghost" data-copy="1">Скопировать</button>');
  acts.push('<button class="mini ghost" data-close="1">Закрыть</button>');
  el('sheetActs').innerHTML = acts.join('');
  bind(el('sheetActs'));
  el('sheetActs').querySelector('[data-close]').addEventListener('click', closeSheet);
  el('sheetActs').querySelector('[data-copy]')?.addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(t.output);
      e.target.textContent = 'Скопировано';
    } catch { e.target.textContent = 'Не вышло — выделите вручную'; }
  });
  el('overlay').hidden = false;
}

function showBlock(name) {
  const list = state.agents.filter((a) => a.block === name);
  openTaskId = null;
  el('sheetKicker').textContent = `отдел · ${list.length} в штате`;
  el('sheetTitle').textContent = name;
  el('sheetBody').textContent = list
    .map((a) => `${a.emoji} ${a.name}${a.custom ? '  [написан под Vitaflow]' : ''}\n${a.description}\n`)
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
      el('sheetBody').textContent = brain.text?.trim() || 'Пакет знаний не найден.';
      return;
    }
    const c = brain.catalog || {};
    el('sheetBody').textContent =
      `Папка: ${brain.dir}\nФайлы: ${brain.files.join(', ')}\n\n` +
      `Каталог: ${nf(c.total)} позиций, ${nf(c.inStock)} в наличии, ` +
      `${nf(c.noBrand)} без бренда, себестоимость у ${nf(c.withCost)}.\n` +
      `Категорий ${c.categories?.length || 0}, брендов ${c.brands?.length || 0}.\n\n` +
      `Агенты не держат каталог в памяти — они ищут по нему инструментом ` +
      `и получают готовые карточки на русском и узбекском.\n` +
      `Обновляется скриптом «python3 знания/обновить.py», руками не правим.\n\n` +
      `${'─'.repeat(52)}\n\n${brain.text}`;
    el('sheetActs').insertAdjacentHTML('afterbegin',
      '<button class="mini ok" id="reloadBrain">Перечитать знания</button>');
    el('reloadBrain').addEventListener('click', async () => {
      try {
        const r = await api('/api/brain/reload', { method: 'POST' });
        alert(`Перечитано: ${r.files.length} файлов, ${r.catalog?.total ?? '?'} позиций`);
        showBrain();
        refresh();
      } catch (err) { alert(err.message); }
    });
  } catch (err) {
    el('sheetBody').textContent = `Не удалось прочитать: ${err.message}`;
  }
}

function closeSheet() { openTaskId = null; el('overlay').hidden = true; }

/* ---------- быстрая задача (⌘K) ---------- */

let pSel = 0;

/* В поле пишут ЗАДАЧУ, а список — это «кому поручить». Поэтому мы никого не
   выбрасываем, а поднимаем наверх тех, кто ближе к тексту задачи. */
function paletteMatches() {
  const q = el('pQuery').value.toLowerCase().trim();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const auto = {
    id: null, name: 'Подобрать агента автоматически', emoji: '✨',
    block: 'оркестратор', description: 'Задачу получит тот, чья роль ближе',
  };
  const scored = state.agents.map((a) => {
    const hay = `${a.name} ${a.block} ${a.description}`.toLowerCase();
    return { a, score: words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0) };
  });
  scored.sort((x, y) => y.score - x.score);
  return [auto, ...scored.map((s) => s.a)];
}

function renderPalette() {
  const items = paletteMatches();
  pSel = Math.max(0, Math.min(pSel, items.length - 1));
  el('pList').innerHTML = items.map((a, i) => `
    <div class="palette-item ${i === pSel ? 'sel' : ''}" data-i="${i}">
      <span class="pi-emoji">${esc(a.emoji)}</span>
      <span class="pi-main">
        <span class="pi-name">${esc(a.name)}</span>
        <span class="pi-desc">${esc(a.description)}</span>
      </span>
      <span class="pi-block">${esc(a.block)}</span>
    </div>`).join('');
  el('pList').querySelectorAll('.palette-item').forEach((n) =>
    n.addEventListener('click', () => { pSel = Number(n.dataset.i); runPalette(); }));
}

function openPalette() {
  el('palette').hidden = false;
  el('pQuery').value = '';
  pSel = 0;
  renderPalette();
  el('pQuery').focus();
}
function closePalette() { el('palette').hidden = true; }

async function runPalette() {
  const items = paletteMatches();
  const chosen = items[pSel];
  const title = el('pQuery').value.trim();
  if (!title) return el('pQuery').focus();
  closePalette();
  try {
    await submit({ title, agentId: chosen?.id || null });
    if (chosen?.id) Office.focusAgent(chosen.id);
  } catch (err) { alert(err.message); }
}

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
  const btn = el('goBtn');
  btn.disabled = true;
  try {
    await submit({
      title: el('tTitle').value,
      input: el('tInput').value.trim(),
      agentId: el('tAgent').value || null,
    });
    el('tTitle').value = '';
    el('tInput').value = '';
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; }
});

el('cmdOpen').addEventListener('click', openPalette);
el('pQuery').addEventListener('input', renderPalette);
el('palette').addEventListener('click', (e) => { if (e.target === el('palette')) closePalette(); });

el('sheetX').addEventListener('click', closeSheet);
el('overlay').addEventListener('click', (e) => { if (e.target === el('overlay')) closeSheet(); });

document.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    return el('palette').hidden ? openPalette() : closePalette();
  }
  if (!el('palette').hidden) {
    if (e.key === 'Escape') return closePalette();
    if (e.key === 'ArrowDown') { e.preventDefault(); pSel += 1; return renderPalette(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); pSel -= 1; return renderPalette(); }
    if (e.key === 'Enter') { e.preventDefault(); return runPalette(); }
    return;
  }
  if (e.key === 'Escape') {
    if (!el('overlay').hidden) return closeSheet();
    return Office.clearFocus();
  }
  if (typing) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); Office.step(1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); Office.step(-1); }
});

setInterval(() => { el('clock').textContent = new Date().toLocaleTimeString('ru-RU', { hour12: false }); }, 1000);

refresh();
connectStream();
startPolling();
