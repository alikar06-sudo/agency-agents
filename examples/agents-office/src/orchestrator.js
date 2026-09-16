// Оркестратор: очередь задач, маршрутизация на агента, запуск, статусы.
import { runAgent, routeTask, hasApiKey, modelName, costOf } from './llm.js';
import { review, reviewEnabled, reviewRounds } from './review.js';

const CONCURRENCY = Number(process.env.AO_CONCURRENCY || 2);

export class Orchestrator {
  constructor({ store, agents, getContext, getCatalog }) {
    this.store = store;
    this.agents = agents;
    this.getContext = getContext;
    this.getCatalog = getCatalog;
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
      let routedCost = 0;
      if (!agentId) {
        this.store.updateTask(taskId, { status: 'routing' }, { event: 'task.routing', message: task.title });
        const routed = await routeTask({ agents: this.agents, task });
        agentId = routed.agentId;
        routedCost = routed.model ? costOf(routed.model, routed.usage) : 0;
        this.store.updateTask(taskId, { agentId, routedReason: routed.reason },
          { event: 'task.routed', message: `${this.agentById(agentId)?.name}: ${routed.reason}` });
      }

      const agent = this.agentById(agentId);
      if (!agent) throw new Error(`Агент ${agentId} пропал из реестра`);

      this.store.updateTask(taskId, { status: 'working', startedAt: new Date().toISOString() },
        { event: 'task.started', message: `${agent.name} — ${task.title}` });

      const tools = [];
      let cost = routedCost;
      let result = null;
      let verdict = null;
      let notes = [];

      // Специалист пишет, управляющий проверяет. Если есть замечания —
      // отправляем на доработку с ними на руках, но не бесконечно.
      for (let round = 0; round <= (reviewEnabled() ? reviewRounds() : 0); round++) {
        let buffer = '';
        let lastPush = 0;
        const taskForRun = round === 0 ? task : {
          ...task,
          input: `${task.input || ''}\n\nУправляющий вернул работу на доработку. Замечания:\n` +
                 notes.map((n) => `- ${n}`).join('\n') +
                 `\n\nПредыдущая версия:\n${result.text}`,
        };

        this.store.updateTask(taskId, { round: round + 1 });
        result = await runAgent({
          agent,
          task: taskForRun,
          context: this.getContext(agent),
          catalog: this.getCatalog?.(),
          onText: (delta) => {
            buffer += delta;
            const now = Date.now();
            if (now - lastPush < 250) return;   // не чаще четырёх раз в секунду
            lastPush = now;
            this.store.progress(taskId, buffer, tools);
          },
          onTool: (label) => {
            tools.push(label);
            this.store.progress(taskId, buffer, tools);
          },
        });
        cost += result.mock ? 0 : costOf(modelName, result.usage);

        if (!reviewEnabled() || result.mock) { verdict = null; break; }

        this.store.progress(taskId, buffer + '\n\n[управляющий проверяет работу]\n', tools);
        const checked = await review({ agent, task, text: result.text });
        cost += checked.cost;
        verdict = checked.verdict;
        notes = checked.notes;

        if (verdict === 'ok') break;
        this.store.log('task.rework', {
          taskId, agentId: agent.id,
          message: `${agent.name}: ${notes[0] || 'управляющий вернул работу'}`,
        });
      }

      this.store.updateTask(
        taskId,
        {
          status: 'waiting_approval',
          output: result.text,
          partial: '',
          usage: result.usage,
          steps: result.steps,
          tools,
          cost,
          review: verdict ? { verdict, notes } : null,
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
      catalog: this.getCatalog?.()?.stats() || null,
      spend: [...this.store.tasks.values()].reduce((sum, t) => sum + (t.cost || 0), 0),
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
