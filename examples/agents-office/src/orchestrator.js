// Оркестратор: очередь задач, маршрутизация на агента, запуск, статусы.
import { runAgent, routeTask, hasApiKey, modelName } from './llm.js';

const CONCURRENCY = Number(process.env.AO_CONCURRENCY || 2);

export class Orchestrator {
  constructor({ store, agents, getContext }) {
    this.store = store;
    this.agents = agents;
    this.getContext = getContext;
    this.queue = [];
    this.running = 0;
  }

  agentById(id) { return this.agents.find((a) => a.id === id) || null; }

  submit({ title, input, agentId }) {
    if (agentId && !this.agentById(agentId)) {
      throw new Error(`Неизвестный агент: ${agentId}`);
    }
    const task = this.store.createTask({ title, input, agentId: agentId || null });
    this.queue.push(task.id);
    this.#pump();
    return task;
  }

  retry(taskId) {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error('Задача не найдена');
    this.store.updateTask(taskId, { status: 'queued', error: null, output: null, finishedAt: null },
      { event: 'task.requeued', message: task.title });
    this.queue.push(taskId);
    this.#pump();
    return this.store.getTask(taskId);
  }

  approve(taskId) {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error('Задача не найдена');
    if (task.status !== 'waiting_approval') throw new Error('Задача не ждёт подтверждения');
    return this.store.updateTask(taskId, { status: 'approved', approvedAt: new Date().toISOString() },
      { event: 'task.approved', message: task.title });
  }

  reject(taskId, reason = '') {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error('Задача не найдена');
    if (task.status !== 'waiting_approval') throw new Error('Задача не ждёт подтверждения');
    return this.store.updateTask(taskId, { status: 'rejected', rejectReason: reason },
      { event: 'task.rejected', message: reason ? `${task.title} — ${reason}` : task.title });
  }

  #pump() {
    while (this.running < CONCURRENCY && this.queue.length) {
      const id = this.queue.shift();
      this.running += 1;
      this.#run(id).finally(() => {
        this.running -= 1;
        this.#pump();
      });
    }
  }

  async #run(taskId) {
    const task = this.store.getTask(taskId);
    if (!task || task.status === 'approved' || task.status === 'rejected') return;

    try {
      let agentId = task.agentId;
      if (!agentId) {
        this.store.updateTask(taskId, { status: 'routing' }, { event: 'task.routing', message: task.title });
        const routed = await routeTask({ agents: this.agents, task });
        agentId = routed.agentId;
        this.store.updateTask(taskId, { agentId, routedReason: routed.reason },
          { event: 'task.routed', message: `${this.agentById(agentId)?.name}: ${routed.reason}` });
      }

      const agent = this.agentById(agentId);
      if (!agent) throw new Error(`Агент ${agentId} пропал из реестра`);

      this.store.updateTask(taskId, { status: 'working', startedAt: new Date().toISOString() },
        { event: 'task.started', message: `${agent.name} — ${task.title}` });

      let buffer = '';
      let lastPush = 0;
      const result = await runAgent({
        agent,
        task,
        context: this.getContext(agent),
        onText: (delta) => {
          buffer += delta;
          const now = Date.now();
          if (now - lastPush < 250) return;   // не чаще четырёх раз в секунду
          lastPush = now;
          this.store.progress(taskId, buffer);
        },
      });

      this.store.updateTask(
        taskId,
        {
          status: 'waiting_approval',
          output: result.text,
          partial: '',
          usage: result.usage,
          mock: result.mock,
          finishedAt: new Date().toISOString(),
        },
        { event: 'task.waiting_approval', message: `${agent.name} — ${task.title}` },
      );
    } catch (err) {
      this.store.updateTask(
        taskId,
        { status: 'failed', error: err.message, finishedAt: new Date().toISOString() },
        { event: 'task.failed', message: `${task.title}: ${err.message}` },
      );
    }
  }

  snapshot() {
    return {
      agents: this.agents.map(({ systemPrompt, path, ...rest }) => rest),
      tasks: this.store.listTasks(),
      events: this.store.recentEvents(60),
      stats: this.store.stats(this.agents),
      runtime: {
        shop: process.env.AO_SHOP || 'Vitaflow · американские витамины',
        model: modelName,
        live: hasApiKey(),
        concurrency: CONCURRENCY,
        running: this.running,
        queued: this.queue.length,
      },
    };
  }
}
