// Хранилище состояния: журнал событий в JSONL + индекс в памяти.
// Никаких native-зависимостей — работает на любом сервере с Node 18+.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = process.env.AO_DATA_DIR || join(process.cwd(), 'data');
const LOG_PATH = join(DATA_DIR, 'events.jsonl');
const SNAPSHOT_PATH = join(DATA_DIR, 'tasks.json');

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

export class Store {
  constructor() {
    ensureDir(DATA_DIR);
    /** @type {Map<string, any>} */
    this.tasks = new Map();
    /** @type {Array<any>} */
    this.events = [];
    this.listeners = new Set();
    this.#restore();
  }

  #restore() {
    if (existsSync(SNAPSHOT_PATH)) {
      try {
        const rows = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
        for (const t of rows) this.tasks.set(t.id, t);
      } catch (err) {
        console.error('[store] снимок задач повреждён, начинаю с пустого:', err.message);
      }
    }
    if (existsSync(LOG_PATH)) {
      const lines = readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean);
      for (const line of lines.slice(-500)) {
        try { this.events.push(JSON.parse(line)); } catch { /* пропускаем битую строку */ }
      }
    }
    // Задачи, застрявшие в работе после перезапуска, честно помечаем сбойными.
    for (const t of this.tasks.values()) {
      if (t.status === 'working' || t.status === 'routing' || t.status === 'queued') {
        t.status = 'failed';
        t.error = 'Прервано перезапуском сервера';
      }
    }
  }

  #persistTasks() {
    ensureDir(dirname(SNAPSHOT_PATH));
    writeFileSync(SNAPSHOT_PATH, JSON.stringify([...this.tasks.values()], null, 2));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #emit(event) {
    this.events.push(event);
    if (this.events.length > 500) this.events.shift();
    ensureDir(dirname(LOG_PATH));
    appendFileSync(LOG_PATH, JSON.stringify(event) + '\n');
    for (const fn of this.listeners) {
      try { fn(event); } catch (err) { console.error('[store] подписчик упал:', err.message); }
    }
  }

  log(type, payload = {}) {
    const event = { id: randomUUID(), ts: new Date().toISOString(), type, ...payload };
    this.#emit(event);
    return event;
  }

  createTask({ title, input, agentId = null, requestedBy = 'owner' }) {
    const task = {
      id: randomUUID(),
      title,
      input,
      agentId,
      status: 'queued',
      requestedBy,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      output: null,
      error: null,
      routedReason: null,
      usage: null,
      mock: false,
    };
    this.tasks.set(task.id, task);
    this.#persistTasks();
    this.log('task.created', { taskId: task.id, agentId, message: title });
    return task;
  }

  updateTask(id, patch, { event, message } = {}) {
    const task = this.tasks.get(id);
    if (!task) return null;
    Object.assign(task, patch);
    this.#persistTasks();
    if (event) this.log(event, { taskId: id, agentId: task.agentId, message: message ?? task.title });
    return task;
  }

  getTask(id) { return this.tasks.get(id) || null; }

  listTasks() {
    return [...this.tasks.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  recentEvents(limit = 60) { return this.events.slice(-limit).reverse(); }

  stats(agents) {
    const byStatus = {};
    for (const t of this.tasks.values()) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    const byAgent = {};
    for (const a of agents) byAgent[a.id] = { done: 0, active: 0, waiting: 0 };
    for (const t of this.tasks.values()) {
      const slot = byAgent[t.agentId];
      if (!slot) continue;
      if (t.status === 'approved') slot.done += 1;
      else if (t.status === 'working' || t.status === 'routing') slot.active += 1;
      else if (t.status === 'waiting_approval') slot.waiting += 1;
    }
    return { byStatus, byAgent, total: this.tasks.size, events: this.events.length };
  }
}
