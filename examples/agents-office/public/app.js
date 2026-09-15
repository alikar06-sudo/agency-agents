// Панель: состояние тянем из /api/state, изменения слушаем через SSE.
const token = new URLSearchParams(location.search).get('token') || '';
const withToken = (path) => (token ? `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : path);

const el = (id) => document.getElementById(id);
const STATUS_LABEL = {
  queued: 'в очереди', routing: 'подбор агента', working: 'в работе',
  waiting_approval: 'ждёт решения', approved: 'принято', rejected: 'отклонено', failed: 'сбой',
};

let state = { agents: [], tasks: [], events: [], stats: { byAgent: {} }, runtime: {} };
let openTaskId = null;
const prevMetrics = {};

/* ---------- сеть ---------- */
async function api(path, options = {}) {
  const res = await fetch(withToken(path), {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Ошибка ${res.status}`);
  return body;
}

async function refresh() {
  try {
    state = await api('/api/state');
    render();
  } catch (err) {
    el('modeText').textContent = `нет связи: ${err.message}`;
  }
}

function connectStream() {
  const source = new EventSource(withToken('/api/stream'));
  source.addEventListener('change', refresh);
  source.addEventListener('error', () => {
    el('modeChip').classList.remove('live');
    setTimeout(() => { source.close(); connectStream(); }, 4000);
  });
}

/* ---------- отрисовка ---------- */
function setMetric(id, value) {
  const node = el(id);
  if (node.textContent === String(value)) return;
  node.textContent = value;
  if (prevMetrics[id] !== undefined) {
    const box = node.closest('.metric');
    box.classList.add('tick');
    setTimeout(() => box.classList.remove('tick'), 600);
  }
  prevMetrics[id] = value;
}

function agentStatus(agentId) {
  const slot = state.stats.byAgent?.[agentId] || { done: 0, active: 0, waiting: 0 };
  if (slot.active) return { cls: 'on', text: 'работает', ...slot };
  if (slot.waiting) return { cls: 'wait', text: 'ждёт решения', ...slot };
  return { cls: '', text: 'свободен', ...slot };
}

function renderAgents() {
  const byBlock = new Map();
  for (const agent of state.agents) {
    if (!byBlock.has(agent.block)) byBlock.set(agent.block, []);
    byBlock.get(agent.block).push(agent);
  }
  el('agentCount').textContent = `${state.agents.length} ролей`;

  el('blocks').innerHTML = [...byBlock.entries()].map(([block, list]) => `
    <div>
      <p class="block-title">${escapeHtml(block)}</p>
      <div class="grid">
        ${list.map((agent) => {
          const s = agentStatus(agent.id);
          return `
          <button class="agent ${s.cls === 'on' ? 'working' : ''}" data-agent="${agent.id}"
                  style="--agent-color:${escapeHtml(agent.color)}">
            <div class="agent-top">
              <span class="agent-emoji">${escapeHtml(agent.emoji)}</span>
              ${agent.custom ? '<span class="tag-custom">СВОЙ</span>' : ''}
            </div>
            <div class="agent-name">${escapeHtml(agent.name)}</div>
            <p class="agent-desc">${escapeHtml(agent.description)}</p>
            <span class="state ${s.cls}"><i></i>${s.text}</span>
            <div class="agent-stats">
              <div>в работе <b>${s.active}</b></div>
              <div>на проверке <b>${s.waiting}</b></div>
              <div>принято <b>${s.done}</b></div>
            </div>
          </button>`;
        }).join('')}
      </div>
    </div>`).join('');

  for (const node of document.querySelectorAll('[data-agent]')) {
    node.addEventListener('click', () => showAgent(node.dataset.agent));
  }
  drawWires();
}

function renderApprovals() {
  const waiting = state.tasks.filter((t) => t.status === 'waiting_approval');
  const badge = el('approvalCount');
  badge.textContent = waiting.length;
  badge.classList.toggle('zero', waiting.length === 0);

  el('approvalList').innerHTML = waiting.length
    ? waiting.map((task) => {
        const agent = state.agents.find((a) => a.id === task.agentId);
        return `
        <div class="approval">
          <span class="who">${escapeHtml(agent?.name || 'без агента')}${task.mock ? ' · ДЕМО' : ''}</span>
          <h4>${escapeHtml(task.title)}</h4>
          <p class="preview">${escapeHtml((task.output || '').slice(0, 220))}</p>
          <div class="acts">
            <button class="ok" data-approve="${task.id}">Принять</button>
            <button class="ghost" data-open="${task.id}">Открыть</button>
            <button class="ghost" data-reject="${task.id}">Отклонить</button>
          </div>
        </div>`;
      }).join('')
    : '<p class="empty">Пока ничего не ждёт подтверждения.</p>';

  bindTaskButtons(el('approvalList'));
}

function bindTaskButtons(scope) {
  scope.querySelectorAll('[data-approve]').forEach((b) =>
    b.addEventListener('click', () => act(`/api/tasks/${b.dataset.approve}/approve`)));
  scope.querySelectorAll('[data-open]').forEach((b) =>
    b.addEventListener('click', () => showTask(b.dataset.open)));
  scope.querySelectorAll('[data-reject]').forEach((b) =>
    b.addEventListener('click', () => {
      const reason = prompt('Что не так? (необязательно)') ?? '';
      act(`/api/tasks/${b.dataset.reject}/reject`, { reason });
    }));
  scope.querySelectorAll('[data-retry]').forEach((b) =>
    b.addEventListener('click', () => act(`/api/tasks/${b.dataset.retry}/retry`)));
}

async function act(path, body) {
  try {
    await api(path, { method: 'POST', body: JSON.stringify(body || {}) });
    closeSheet();
    refresh();
  } catch (err) { alert(err.message); }
}

const LOG_KIND = {
  'task.created': ['НОВАЯ', 'k-work'], 'task.routing': ['ПОДБОР', 'k-work'],
  'task.routed': ['МАРШРУТ', 'k-work'], 'task.started': ['СТАРТ', 'k-work'],
  'task.waiting_approval': ['НА ПРОВЕРКУ', 'k-wait'], 'task.approved': ['ПРИНЯТО', 'k-ok'],
  'task.rejected': ['ОТКЛОНЕНО', 'k-bad'], 'task.failed': ['СБОЙ', 'k-bad'],
  'task.requeued': ['ПОВТОР', 'k-work'], 'brain.updated': ['КОНТЕКСТ', 'k-ok'],
};

function renderLog() {
  el('logCount').textContent = `последние ${state.events.length}`;
  el('log').innerHTML = state.events.map((e) => {
    const [label, cls] = LOG_KIND[e.type] || [e.type.toUpperCase(), ''];
    const time = new Date(e.ts).toLocaleTimeString('ru-RU', { hour12: false });
    return `<li><time>${time}</time><span class="msg"><span class="kind ${cls}">${label}</span> ${escapeHtml(e.message || '')}</span></li>`;
  }).join('');
}

function renderRuntime() {
  const chip = el('modeChip');
  const live = state.runtime.live;
  chip.className = `mode-chip ${live ? 'live' : 'demo'}`;
  el('modeText').textContent = live ? 'система работает' : 'демо-режим — нет ключа';
  if (state.runtime.shop) el('shopName').textContent = state.runtime.shop;
  setMetric('mModel', live ? state.runtime.model : 'демо');

  const byStatus = state.stats.byStatus || {};
  setMetric('mRoutes', state.stats.total || 0);
  setMetric('mDone', byStatus.approved || 0);
  setMetric('mWaiting', byStatus.waiting_approval || 0);
}

function renderAgentOptions() {
  const select = el('taskAgent');
  if (select.options.length - 1 === state.agents.length) return;
  const current = select.value;
  select.innerHTML = '<option value="">Выбрать агента автоматически</option>' +
    state.agents.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  select.value = current;
}

function render() {
  renderRuntime();
  renderAgents();
  renderApprovals();
  renderLog();
  renderAgentOptions();
  if (openTaskId) showTask(openTaskId, true);
}

/* ---------- линии от оркестратора ---------- */
function drawWires() {
  const svg = el('wires');
  const active = state.agents.filter((a) => (state.stats.byAgent?.[a.id]?.active || 0) > 0).length;
  const lanes = Math.max(active, 3);
  svg.innerHTML = Array.from({ length: lanes }, (_, i) => {
    const y = 18 + i * 22;
    const on = i < active;
    return `<path d="M 0 ${y} C 180 ${y}, 260 ${y + 14}, 900 ${y + 14}" fill="none"
      stroke="${on ? '#4C8DFF' : '#1E2B44'}" stroke-width="${on ? 1.4 : 1}"
      stroke-dasharray="${on ? '5 7' : '2 9'}" opacity="${on ? 0.75 : 0.35}">
      ${on ? '<animate attributeName="stroke-dashoffset" from="24" to="0" dur="1.1s" repeatCount="indefinite"/>' : ''}
    </path>`;
  }).join('');
}

/* ---------- модалка ---------- */
function showAgent(agentId) {
  const agent = state.agents.find((a) => a.id === agentId);
  if (!agent) return;
  const tasks = state.tasks.filter((t) => t.agentId === agentId).slice(0, 8);
  openTaskId = null;
  el('sheetAgent').textContent = `${agent.block} · волна ${agent.wave}`;
  el('sheetTitle').textContent = `${agent.emoji} ${agent.name}`;
  el('sheetBody').textContent =
    `${agent.description}\n\n${agent.vibe ? agent.vibe + '\n\n' : ''}` +
    `Файл: ${agent.file}\n\nПоследние задачи:\n` +
    (tasks.length
      ? tasks.map((t) => `• [${STATUS_LABEL[t.status]}] ${t.title}`).join('\n')
      : '— пока не было —');
  el('sheetActions').innerHTML = `<button class="ghost" id="sheetDismiss">Закрыть</button>`;
  el('sheetDismiss').addEventListener('click', closeSheet);
  el('overlay').hidden = false;
}

function showTask(taskId, keepScroll = false) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return closeSheet();
  const agent = state.agents.find((a) => a.id === task.agentId);
  const body = el('sheetBody');
  const scroll = keepScroll ? body.scrollTop : 0;
  openTaskId = taskId;

  el('sheetAgent').textContent =
    `${agent?.name || 'агент не назначен'} · ${STATUS_LABEL[task.status]}${task.mock ? ' · ДЕМО' : ''}`;
  el('sheetTitle').textContent = task.title;
  body.textContent = task.output || task.error || 'Задача ещё выполняется…';
  body.scrollTop = scroll;

  const actions = [];
  if (task.status === 'waiting_approval') {
    actions.push(`<button class="ok" data-approve="${task.id}">Принять</button>`);
    actions.push(`<button class="ghost" data-reject="${task.id}">Отклонить</button>`);
  }
  if (task.status === 'failed' || task.status === 'rejected') {
    actions.push(`<button data-retry="${task.id}">Запустить заново</button>`);
  }
  actions.push('<button class="ghost" id="sheetDismiss">Закрыть</button>');
  el('sheetActions').innerHTML = actions.join('');
  bindTaskButtons(el('sheetActions'));
  el('sheetDismiss').addEventListener('click', closeSheet);
  el('overlay').hidden = false;
}

function closeSheet() {
  openTaskId = null;
  el('overlay').hidden = true;
}

/* ---------- прочее ---------- */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

el('taskForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = el('submitBtn');
  button.disabled = true;
  try {
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: el('taskTitle').value,
        input: el('taskInput').value,
        agentId: el('taskAgent').value || null,
      }),
    });
    el('taskTitle').value = '';
    el('taskInput').value = '';
    refresh();
  } catch (err) { alert(err.message); }
  finally { button.disabled = false; }
});

el('sheetClose').addEventListener('click', closeSheet);
el('overlay').addEventListener('click', (e) => { if (e.target === el('overlay')) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
window.addEventListener('resize', drawWires);

setInterval(() => {
  el('clock').textContent = new Date().toLocaleTimeString('ru-RU', { hour12: false });
}, 1000);

refresh();
connectStream();
setInterval(refresh, 15000);
