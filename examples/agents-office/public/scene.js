/* Изометрическая сцена офиса: острова-отделы, рабочие места с мониторами,
   камера с плавным подлётом. Данные приходят снаружи через Office.update(). */
(function (global) {
  const NS = 'http://www.w3.org/2000/svg';
  const K = 7.2;
  const ORIGIN = { x: 1400, y: 760 };
  const R = 72, HALF = 14, THICK = 34;

  const proj = (x, y, z = 0) => [
    ORIGIN.x + (x - y) * 0.866 * K,
    ORIGIN.y + ((x + y) * 0.5 - z) * K,
  ];
  const mk = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const pts = (arr) => arr.map((p) => p.join(',')).join(' ');
  const shade = (hex, f) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    const n = parseInt(m ? m[1] : '6366F1', 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
    return `rgb(${c.join(',')})`;
  };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // рабочие места внутри острова
  const SPOTS = {
    1: [[0, 0]],
    2: [[-6, -3.5], [5, 4]],
    3: [[-6.5, -4.5], [5.5, -2], [-0.5, 6.5]],
    4: [[-6.5, -5], [5.5, -3], [-5, 5], [6, 5]],
  };

  const Office = {
    agents: [],
    blocks: [],
    layout: [],
    state: { tasks: [], stats: { byAgent: {} }, runtime: {} },
    focusedBlock: null,
    focusedAgent: null,
    hooks: {},
    view: { tx: 0, ty: 0, scale: 1 },
    nodes: { screens: {}, plates: {}, cards: {}, tags: {}, monitors: {} },
  };

  /* ---------------- построение ---------------- */

  Office.build = function (agents, hooks = {}) {
    this.agents = agents;
    this.hooks = hooks;
    this.blocks = [...new Set(agents.map((a) => a.block))];
    this.layout = this.blocks.map((name, i) => {
      const a = (i / this.blocks.length) * Math.PI * 2 - Math.PI / 2;
      return { name, cx: Math.cos(a) * R, cy: Math.sin(a) * R };
    });

    this.viewport = document.getElementById('viewport');
    this.world = document.getElementById('world');
    this.svg = document.getElementById('scene');
    this.overlay = document.getElementById('sceneOverlay');

    this.svg.textContent = '';
    this.overlay.textContent = '';
    this.nodes = { screens: {}, plates: {}, cards: {}, tags: {}, monitors: {} };

    const defs = mk('defs');
    defs.innerHTML =
      '<filter id="glow" x="-70%" y="-70%" width="240%" height="240%">' +
      '<feGaussianBlur stdDeviation="6" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    this.svg.appendChild(defs);

    const gWires = mk('g', { id: 'wires' });
    const gPlates = mk('g');
    this.svg.appendChild(gWires);
    this.svg.appendChild(gPlates);

    const c = proj(0, 0, 7);
    this.layout.forEach((b, i) => {
      const p = proj(b.cx * 0.84, b.cy * 0.84, 3);
      const mid = [(c[0] + p[0]) / 2, (c[1] + p[1]) / 2 + 26];
      gWires.appendChild(mk('path', {
        id: 'wire-' + i,
        d: `M ${c[0]} ${c[1]} Q ${mid[0]} ${mid[1]} ${p[0]} ${p[1]}`,
        fill: 'none', stroke: '#22344F', 'stroke-width': 1.4, 'data-wire': b.name,
      }));
    });

    gPlates.appendChild(buildBrain(c));

    [...this.layout].sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy))
      .forEach((b) => gPlates.appendChild(this.buildIsland(b)));

    const bl = document.createElement('div');
    bl.className = 'brain-label';
    bl.dataset.brain = '1';
    bl.style.left = c[0] + 'px';
    bl.style.top = (c[1] - 56) + 'px';
    bl.innerHTML = 'МОЗГ · знания магазина';
    this.overlay.appendChild(bl);

    this.layout.forEach((b) => {
      const card = this.buildCard(b);
      this.nodes.cards[b.name] = card;
      this.overlay.appendChild(card);
    });

    this.bindNavigation();
    this.fit(true);
  };

  function buildBrain(c) {
    const g = mk('g', { 'data-brain': '1', style: 'cursor:pointer' });
    g.appendChild(mk('circle', { cx: c[0], cy: c[1], r: 58, fill: '#4C8DFF', opacity: 0.07, filter: 'url(#glow)' }));
    const nodes = Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2;
      const rr = 12 + (i % 3) * 5;
      return proj(Math.cos(a) * rr, Math.sin(a) * rr, 7 + (i % 4) * 2.5);
    });
    nodes.forEach((n, i) => nodes.slice(i + 1).forEach((m) => {
      if (Math.hypot(n[0] - m[0], n[1] - m[1]) < 92) {
        g.appendChild(mk('line', { x1: n[0], y1: n[1], x2: m[0], y2: m[1], stroke: '#6B82A6', 'stroke-width': 0.7, opacity: 0.35 }));
      }
    }));
    nodes.forEach((n) => g.appendChild(mk('circle', { cx: n[0], cy: n[1], r: 3.2, fill: '#DCE8F8', opacity: 0.95 })));
    g.appendChild(mk('circle', { cx: c[0], cy: c[1], r: 7, fill: '#FFF', filter: 'url(#glow)' }));
    return g;
  }

  Office.buildIsland = function (b) {
    const list = this.agents.filter((a) => a.block === b.name);
    const tint = list[0] ? list[0].color : '#4C8DFF';
    const g = mk('g', { 'data-block': b.name, class: 'plate', style: 'cursor:pointer' });
    this.nodes.plates[b.name] = g;

    const N = proj(b.cx - HALF, b.cy - HALF), E = proj(b.cx + HALF, b.cy - HALF),
          S = proj(b.cx + HALF, b.cy + HALF), W = proj(b.cx - HALF, b.cy + HALF);
    const down = (p) => [p[0], p[1] + THICK];

    g.appendChild(mk('polygon', { points: pts([E, S, down(S), down(E)]), fill: shade(tint, 0.34) }));
    g.appendChild(mk('polygon', { points: pts([S, W, down(W), down(S)]), fill: shade(tint, 0.22) }));
    g.appendChild(mk('polygon', { points: pts([N, E, S, W]), fill: shade(tint, 0.62), stroke: shade(tint, 1.25), 'stroke-width': 1, opacity: 0.94 }));

    const spots = SPOTS[list.length] || SPOTS[4];
    list.forEach((agent, i) => {
      const [dx, dy] = spots[i] || [0, 0];
      g.appendChild(this.buildWorkstation(agent, b.cx + dx, b.cy + dy));
    });
    return g;
  };

  /* Рабочее место: стол, монитор, кресло и сидящий сотрудник. */
  Office.buildWorkstation = function (agent, x, y) {
    const p = proj(x, y, 0);
    const g = mk('g', { 'data-agent': agent.id, style: 'cursor:pointer' });

    // стол
    const d = 4.4;
    const t = [proj(x - d, y - d), proj(x + d, y - d), proj(x + d, y + d), proj(x - d, y + d)];
    g.appendChild(mk('ellipse', { cx: p[0], cy: p[1] + 3, rx: 16, ry: 7, fill: '#03060C', opacity: 0.4 }));
    g.appendChild(mk('polygon', { points: pts(t.map((q) => [q[0], q[1] + 7])), fill: '#0A111D' }));
    g.appendChild(mk('polygon', { points: pts(t), fill: '#162134', stroke: '#26385A', 'stroke-width': 0.8 }));

    // кресло
    g.appendChild(mk('rect', { x: p[0] - 24, y: p[1] - 14, width: 9, height: 12, rx: 3, fill: '#101A2B', stroke: '#22344F', 'stroke-width': 0.7 }));

    // сотрудник — сидит за столом
    const fig = mk('g', { class: 'fig', style: `animation-delay:${(Math.abs(x * 7 + y * 3) % 20) / 10}s` });
    fig.appendChild(mk('rect', { x: p[0] - 19, y: p[1] - 20, width: 11, height: 13, rx: 4.5, fill: agent.color, opacity: 0.94, class: 'body' }));
    fig.appendChild(mk('circle', { cx: p[0] - 13.5, cy: p[1] - 24, r: 4.4, fill: '#E7EEF9' }));
    g.appendChild(fig);

    // монитор
    const mx = p[0] + 2, my = p[1] - 40;
    g.appendChild(mk('rect', { x: mx + 15, y: my + 21, width: 2, height: 7, fill: '#26385A' }));
    g.appendChild(mk('rect', { x: mx + 8, y: my + 27, width: 16, height: 2, rx: 1, fill: '#26385A' }));
    const face = mk('rect', {
      x: mx, y: my, width: 32, height: 22, rx: 2.5,
      fill: '#070C16', stroke: shade(agent.color, 1.1), 'stroke-width': 1, class: 'screenface',
    });
    g.appendChild(face);
    // строки «текста» на экране — оживают, когда агент пишет
    const lines = mk('g', { class: 'codelines' });
    for (let i = 0; i < 4; i++) {
      lines.appendChild(mk('rect', {
        x: mx + 3, y: my + 4 + i * 4.4, width: 8 + (i * 7) % 19, height: 1.6, rx: 0.8,
        fill: shade(agent.color, 1.4), opacity: 0.25,
      }));
    }
    g.appendChild(lines);
    this.nodes.monitors[agent.id] = { g, lines, face, at: [mx + 16, my] };

    // экран во «мире» — читается, когда камера подлетела
    const scr = document.createElement('div');
    scr.className = 'deskscreen';
    scr.dataset.agent = agent.id;
    scr.style.left = (mx + 16) + 'px';
    scr.style.top = (my + 11) + 'px';
    scr.innerHTML = '<b></b><i></i>';
    this.overlay.appendChild(scr);
    this.nodes.screens[agent.id] = scr;

    // подпись
    const tag = document.createElement('div');
    tag.className = 'atag';
    tag.dataset.agent = agent.id;
    tag.style.left = p[0] + 'px';
    tag.style.top = (my - 6) + 'px';
    tag.innerHTML = `${esc(agent.emoji)} ${esc(agent.name)}${agent.custom ? ' <em>СВОЙ</em>' : ''}`;
    this.overlay.appendChild(tag);
    this.nodes.tags[agent.id] = tag;

    return g;
  };

  Office.buildCard = function (b) {
    const list = this.agents.filter((a) => a.block === b.name);
    const p = proj(b.cx - HALF, b.cy - HALF);
    const d = document.createElement('div');
    d.className = 'card';
    d.dataset.block = b.name;
    d.style.left = p[0] + 'px';
    d.style.top = (p[1] - 18) + 'px';
    d.style.setProperty('--dot', list[0] ? list[0].color : '#4C8DFF');
    return d;
  };

  /* ---------------- обновление данными ---------------- */

  Office.statsOf = function (agentId) {
    return this.state.stats?.byAgent?.[agentId] || { active: 0, waiting: 0, done: 0 };
  };

  Office.taskOf = function (agentId) {
    const t = this.state.tasks || [];
    return t.find((x) => x.agentId === agentId && (x.status === 'working' || x.status === 'routing'))
        || t.find((x) => x.agentId === agentId && x.status === 'waiting_approval')
        || t.find((x) => x.agentId === agentId) || null;
  };

  Office.blockStats = function (name) {
    const acc = { active: 0, waiting: 0, done: 0, next: 0 };
    for (const a of this.agents.filter((x) => x.block === name)) {
      const s = this.statsOf(a.id);
      acc.active += s.active; acc.waiting += s.waiting; acc.done += s.done;
    }
    acc.next = (this.state.tasks || []).filter((t) =>
      t.status === 'queued' && this.agents.find((a) => a.id === t.agentId)?.block === name).length;
    return acc;
  };

  Office.update = function (state) {
    this.state = state;

    for (const name of this.blocks) {
      const s = this.blockStats(name);
      const n = this.agents.filter((a) => a.block === name).length;
      const card = this.nodes.cards[name];
      card.classList.toggle('hot', s.active > 0);
      card.innerHTML =
        `<div class="card-head"><i></i><h3>${esc(name)}</h3></div>
         <div class="card-count"><b>${n}</b><span>${n === 1 ? 'агент' : 'агента'}</span></div>
         <div class="card-foot"><span>в работе <b>${s.active}</b></span><span>след. <b>${s.next}</b></span><span>готово <b>${s.done}</b></span></div>
         ${s.waiting ? `<div class="card-alert">⚠ ${s.waiting} ждёт подтверждения</div>` : ''}`;
    }

    for (const a of this.agents) {
      const s = this.statsOf(a.id);
      const busy = s.active > 0;
      const mon = this.nodes.monitors[a.id];
      const fig = mon.g.querySelector('.fig');
      fig.classList.toggle('busy-now', busy);
      mon.lines.classList.toggle('typing', busy);
      mon.face.setAttribute('fill', busy ? '#0B1830' : '#070C16');
      mon.face.style.filter = busy ? 'url(#glow)' : '';

      const task = this.taskOf(a.id);
      const scr = this.nodes.screens[a.id];
      const text = busy ? (task?.partial || '') : (task?.output || '');
      scr.classList.toggle('live', busy);
      scr.querySelector('b').textContent = busy
        ? (task?.title || 'работает')
        : s.waiting ? 'ждёт решения' : 'свободен';
      const body = scr.querySelector('i');
      body.textContent = text ? text.slice(-460) : (busy ? '…' : '');
      if (this.hooks.onScreen) this.hooks.onScreen(a.id, { busy, task, text });
    }

    const gWires = this.svg.querySelector('#wires');
    this.blocks.forEach((name, i) => {
      const w = this.svg.querySelector(`[data-wire="${CSS.escape(name)}"]`);
      if (!w) return;
      const on = this.blockStats(name).active > 0;
      w.setAttribute('stroke', on ? '#4C8DFF' : '#22344F');
      w.setAttribute('stroke-width', on ? 2 : 1.4);
      w.setAttribute('stroke-dasharray', on ? '6 8' : '');
      w.querySelectorAll('animate').forEach((n) => n.remove());
      if (on) w.appendChild(mk('animate', { attributeName: 'stroke-dashoffset', from: '28', to: '0', dur: '1s', repeatCount: 'indefinite' }));

      const pid = 'pulse-wire-' + i;
      const has = this.svg.querySelector('#' + pid);
      if (on && !has) {
        const dot = mk('circle', { id: pid, r: 3.4, fill: '#8FBEFF' });
        const motion = mk('animateMotion', { dur: '1.8s', repeatCount: 'indefinite' });
        motion.appendChild(mk('mpath', { href: '#wire-' + i }));
        dot.appendChild(motion);
        gWires.appendChild(dot);
      } else if (!on && has) has.remove();
    });

    if (this.focusedAgent) this.refreshFocusPanel();
  };

  /* ---------------- камера ---------------- */

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let flight = null;

  Office.applyView = function () {
    this.world.style.transform = `translate(${this.view.tx}px, ${this.view.ty}px) scale(${this.view.scale})`;
    this.world.classList.toggle('near', this.view.scale > 1.05);
    this.world.classList.toggle('close', this.view.scale > 2);
  };

  Office.flyTo = function (wx, wy, scale, ms = 760) {
    const r = this.viewport.getBoundingClientRect();
    const to = { scale, tx: r.width / 2 - wx * scale, ty: r.height / 2 - wy * scale };
    const from = { ...this.view };
    if (flight) cancelAnimationFrame(flight);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      Object.assign(this.view, to); this.applyView(); return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const k = ease(Math.min(1, (now - t0) / ms));
      this.view.tx = from.tx + (to.tx - from.tx) * k;
      this.view.ty = from.ty + (to.ty - from.ty) * k;
      this.view.scale = from.scale + (to.scale - from.scale) * k;
      this.applyView();
      flight = k < 1 ? requestAnimationFrame(step) : null;
    };
    flight = requestAnimationFrame(step);
  };

  Office.fitScale = function () {
    const r = this.viewport.getBoundingClientRect();
    return Math.min(1, Math.max(0.34, Math.min(r.width / 1750, r.height / 1120)));
  };

  Office.fit = function (instant = false) {
    const s = this.fitScale();
    if (instant) {
      const r = this.viewport.getBoundingClientRect();
      this.view.scale = s;
      this.view.tx = r.width / 2 - ORIGIN.x * s;
      this.view.ty = r.height / 2 - (ORIGIN.y - 30) * s;
      this.applyView();
    } else this.flyTo(ORIGIN.x, ORIGIN.y - 30, s);
  };

  Office.focusBlock = function (name) {
    this.focusedBlock = name;
    this.focusedAgent = null;
    document.getElementById('agentPanel').hidden = true;
    const b = this.layout.find((x) => x.name === name);
    const [wx, wy] = proj(b.cx, b.cy);
    this.flyTo(wx, wy + 10, 1.55);
    this.world.classList.add('focused');
    for (const [n, g] of Object.entries(this.nodes.plates)) g.classList.toggle('on', n === name);
    for (const [n, c] of Object.entries(this.nodes.cards)) c.classList.toggle('focused', n === name);
    const ids = new Set(this.agents.filter((a) => a.block === name).map((a) => a.id));
    for (const [id, t] of Object.entries(this.nodes.tags)) t.classList.toggle('on', ids.has(id));
    for (const [id, s] of Object.entries(this.nodes.screens)) s.classList.toggle('on', ids.has(id));
    this.showBar(`${name} · ${ids.size} ${ids.size === 1 ? 'агент' : 'агента'}`);
  };

  /* Подлёт вплотную к рабочему месту: видно монитор и что на нём. */
  Office.focusAgent = function (id) {
    const agent = this.agents.find((a) => a.id === id);
    if (!agent) return;
    this.focusedBlock = agent.block;
    this.focusedAgent = id;
    const mon = this.nodes.monitors[id];
    this.flyTo(mon.at[0], mon.at[1] + 10, 2.55, 820);
    this.world.classList.add('focused');
    for (const [n, g] of Object.entries(this.nodes.plates)) g.classList.toggle('on', n === agent.block);
    for (const [n, c] of Object.entries(this.nodes.cards)) c.classList.toggle('focused', false);
    for (const [aid, t] of Object.entries(this.nodes.tags)) t.classList.toggle('on', aid === id);
    for (const [aid, s] of Object.entries(this.nodes.screens)) s.classList.toggle('on', aid === id);
    this.showBar(`${agent.name}`);
    this.refreshFocusPanel();
  };

  Office.refreshFocusPanel = function () {
    const id = this.focusedAgent;
    const agent = this.agents.find((a) => a.id === id);
    if (!agent) return;
    const s = this.statsOf(id);
    const task = this.taskOf(id);
    const busy = s.active > 0;
    const panel = document.getElementById('agentPanel');
    panel.hidden = false;
    panel.querySelector('.ap-name').textContent = `${agent.emoji} ${agent.name}`;
    panel.querySelector('.ap-role').textContent = agent.description;
    const status = panel.querySelector('.ap-status');
    status.textContent = busy ? 'пишет ответ' : s.waiting ? 'ждёт вашего решения' : 'свободен';
    status.className = 'ap-status ' + (busy ? 'work' : s.waiting ? 'wait' : '');
    panel.querySelector('.ap-task').textContent = task ? task.title : 'задач пока не было';
    const body = panel.querySelector('.ap-text');
    const text = busy ? (task?.partial || '') : (task?.output || '');
    body.textContent = text || (busy ? 'думает…' : '—');
    body.classList.toggle('typing', busy);
    body.scrollTop = body.scrollHeight;
  };

  Office.showBar = function (label) {
    document.getElementById('focusbar').hidden = false;
    document.getElementById('crumb').textContent = label;
  };

  Office.clearFocus = function () {
    this.focusedBlock = null;
    this.focusedAgent = null;
    this.world.classList.remove('focused');
    Object.values(this.nodes.plates).forEach((g) => g.classList.remove('on'));
    Object.values(this.nodes.cards).forEach((c) => c.classList.remove('focused'));
    Object.values(this.nodes.tags).forEach((t) => t.classList.remove('on'));
    Object.values(this.nodes.screens).forEach((s) => s.classList.remove('on'));
    document.getElementById('focusbar').hidden = true;
    document.getElementById('agentPanel').hidden = true;
    this.fit();
  };

  /* ---------------- навигация мышью и пальцем ---------------- */

  Office.bindNavigation = function () {
    const vp = this.viewport;
    let drag = null, downTarget = null, pinch = null;

    vp.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.zoom, .focusbar, .agent-panel')) return;
      downTarget = e.target;
      drag = { x: e.clientX, y: e.clientY, tx: this.view.tx, ty: this.view.ty, moved: false, id: e.pointerId, held: false };
    });
    vp.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) <= 4) return;
      if (!drag.held) {
        // захват включаем только при реальном перетаскивании: иначе браузер
        // переадресует click контейнеру и клики по объектам перестают работать
        drag.held = drag.moved = true;
        vp.setPointerCapture(drag.id);
        vp.classList.add('dragging');
      }
      this.view.tx = drag.tx + (e.clientX - drag.x);
      this.view.ty = drag.ty + (e.clientY - drag.y);
      this.applyView();
    });
    const end = () => { vp.classList.remove('dragging'); setTimeout(() => { drag = null; }, 0); };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);

    const zoomAt = (factor, px, py) => {
      const next = Math.min(4, Math.max(0.28, this.view.scale * factor));
      const k = next / this.view.scale;
      this.view.tx = px - (px - this.view.tx) * k;
      this.view.ty = py - (py - this.view.ty) * k;
      this.view.scale = next;
      this.applyView();
    };
    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    vp.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const r = vp.getBoundingClientRect();
      if (pinch) zoomAt(d / pinch, (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
                                   (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top);
      pinch = d;
    }, { passive: false });
    vp.addEventListener('touchend', () => { pinch = null; });

    vp.addEventListener('click', (e) => {
      if (drag && drag.moved) return;
      const src = (downTarget && downTarget.isConnected) ? downTarget : e.target;
      const agent = src.closest('[data-agent]');
      if (agent) return this.focusAgent(agent.dataset.agent);
      if (src.closest('[data-brain]')) {
        this.clearFocus();
        this.flyTo(ORIGIN.x, ORIGIN.y, 1.3);
        this.hooks.onBrain?.();
        return;
      }
      const block = src.closest('[data-block], .card');
      if (block) {
        const name = block.dataset.block;
        return this.focusedBlock === name && !this.focusedAgent
          ? this.hooks.onBlock?.(name)
          : this.focusBlock(name);
      }
      if (this.focusedBlock) this.clearFocus();
    });

    document.getElementById('backBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.focusedAgent) return this.focusBlock(this.focusedBlock);
      this.clearFocus();
    });
    document.getElementById('zIn').addEventListener('click', () => {
      const r = vp.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2);
    });
    document.getElementById('zOut').addEventListener('click', () => {
      const r = vp.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2);
    });
    document.getElementById('zFit').addEventListener('click', () => this.clearFocus());
    window.addEventListener('resize', () => {
      if (this.focusedAgent) this.focusAgent(this.focusedAgent);
      else if (this.focusedBlock) this.focusBlock(this.focusedBlock);
      else this.fit(true);
    });
  };

  global.Office = Office;
})(window);
