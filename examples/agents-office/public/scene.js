/* Изометрический офис: этажи-отделы, рабочие места с мониторами, перегородки,
   растения и камера с плавным подлётом. Данные приходят через Office.update(). */
(function (global) {
  const NS = 'http://www.w3.org/2000/svg';
  const K = 7.2;                       // масштаб мировой единицы в пикселях
  const ORIGIN = { x: 1500, y: 820 };
  const R = 86, HALF = 17, THICK = 30; // радиус кольца, половина этажа, толщина плиты

  /* ---------- изометрия ---------- */
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
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const hex2rgb = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    const n = parseInt(m ? m[1] : '4C8DFF', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const shade = (hex, f) => {
    const c = hex2rgb(hex).map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
    return `rgb(${c.join(',')})`;
  };
  const mixDark = (hex, t) => {
    const c = hex2rgb(hex).map((v) => Math.round(v * (1 - t) + 10 * t));
    return `rgb(${c.join(',')})`;
  };

  /* ---------- палитра отделов ---------- */
  const PALETTE = ['#E05A4E', '#3D7DF0', '#34A86B', '#9B6BE0', '#E0A03A', '#34AFC4', '#DB5FA8', '#8CBF3F'];
  const PLANT_AT = [0, 2, 4, 6];   // на каких этажах ставим растение

  // Раскладка рабочих мест внутри этажа
  const SPOTS = {
    1: [[0, -1]],
    2: [[-7, -4], [6, 4]],
    3: [[-8, -5], [7, -3], [-1, 7]],
    4: [[-8, -6], [7, -4], [-6, 6], [8, 5]],
    5: [[-9, -7], [6, -6], [-8, 3], [7, 3], [-1, 9]],
  };

  const Office = {
    agents: [], blocks: [], layout: [],
    state: { tasks: [], stats: { byAgent: {} }, runtime: {} },
    focusedBlock: null, focusedAgent: null,
    hooks: {},
    view: { tx: 0, ty: 0, scale: 1 },
    nodes: { screens: {}, plates: {}, cards: {}, tags: {}, monitors: {}, wires: {} },
  };

  /* ================= построение ================= */

  Office.build = function (agents, hooks = {}) {
    this.agents = agents;
    this.hooks = hooks;
    this.blocks = [...new Set(agents.map((a) => a.block))];
    this.color = {};
    this.blocks.forEach((b, i) => { this.color[b] = PALETTE[i % PALETTE.length]; });

    this.layout = this.blocks.map((name, i) => {
      const a = (i / this.blocks.length) * Math.PI * 2 - Math.PI / 2;
      return { name, cx: Math.cos(a) * R, cy: Math.sin(a) * R, i };
    });

    this.viewport = document.getElementById('viewport');
    this.world = document.getElementById('world');
    this.svg = document.getElementById('scene');
    this.overlay = document.getElementById('sceneOverlay');

    this.svg.textContent = '';
    this.overlay.textContent = '';
    this.nodes = { screens: {}, plates: {}, cards: {}, tags: {}, monitors: {}, wires: {} };

    this.svg.appendChild(buildDefs());

    const gGround = mk('g');             // общий пол под всем офисом
    const gWires = mk('g', { id: 'wires' });
    const gPlates = mk('g');
    this.svg.append(gGround, gWires, gPlates);

    gGround.appendChild(buildGround());

    const c = proj(0, 0, 8);
    this.layout.forEach((b) => {
      const p = proj(b.cx * 0.8, b.cy * 0.8, 4);
      const mid = [(c[0] + p[0]) / 2, (c[1] + p[1]) / 2 + 30];
      const wire = mk('path', {
        id: 'wire-' + b.i,
        d: `M ${c[0]} ${c[1]} Q ${mid[0]} ${mid[1]} ${p[0]} ${p[1]}`,
        fill: 'none', stroke: '#1E2C45', 'stroke-width': 1.6, 'stroke-linecap': 'round',
      });
      this.nodes.wires[b.name] = wire;
      gWires.appendChild(wire);
    });

    gPlates.appendChild(this.buildCore(c));

    // дальние этажи рисуем первыми — правильное перекрытие
    [...this.layout].sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy))
      .forEach((b) => gPlates.appendChild(this.buildFloor(b)));

    const brainLabel = document.createElement('div');
    brainLabel.className = 'brain-label';
    brainLabel.dataset.brain = '1';
    brainLabel.style.left = c[0] + 'px';
    brainLabel.style.top = (c[1] - 62) + 'px';
    brainLabel.innerHTML = '<b>МОЗГ</b><span>знания магазина</span>';
    this.overlay.appendChild(brainLabel);

    this.layout.forEach((b) => {
      const card = this.buildCard(b);
      this.nodes.cards[b.name] = card;
      this.overlay.appendChild(card);
    });

    this.buildMinimap();
    this.bindNavigation();
    this.fit(true);
  };

  function buildDefs() {
    const defs = mk('defs');
    defs.innerHTML = `
      <filter id="glow" x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="softglow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="ground" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#16233C" stop-opacity="0.85"/>
        <stop offset="70%" stop-color="#0C1526" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#070B14" stop-opacity="0"/>
      </radialGradient>`;
    return defs;
  }

  /** Общий пол офиса — мягкое пятно света под кольцом этажей. */
  function buildGround() {
    const g = mk('g');
    const [cx, cy] = proj(0, 0, 0);
    g.appendChild(mk('ellipse', { cx, cy: cy + 40, rx: 1150, ry: 640, fill: 'url(#ground)' }));
    // сетка пола
    const grid = mk('g', { opacity: 0.16 });
    for (let i = -10; i <= 10; i++) {
      const s = 14;
      const a = proj(i * s, -150), b = proj(i * s, 150);
      const c2 = proj(-150, i * s), d = proj(150, i * s);
      grid.appendChild(mk('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#26385A', 'stroke-width': 0.7 }));
      grid.appendChild(mk('line', { x1: c2[0], y1: c2[1], x2: d[0], y2: d[1], stroke: '#26385A', 'stroke-width': 0.7 }));
    }
    g.appendChild(grid);
    return g;
  }

  function buildBrain(c) {
    const g = mk('g', { 'data-brain': '1', style: 'cursor:pointer' });
    g.appendChild(mk('circle', { cx: c[0], cy: c[1], r: 72, fill: '#4C8DFF', opacity: 0.08, filter: 'url(#glow)' }));
    const nodes = Array.from({ length: 13 }, (_, i) => {
      const a = (i / 13) * Math.PI * 2;
      const rr = 11 + (i % 3) * 6;
      return proj(Math.cos(a) * rr, Math.sin(a) * rr, 8 + (i % 4) * 3);
    });
    nodes.forEach((n, i) => nodes.slice(i + 1).forEach((m) => {
      if (Math.hypot(n[0] - m[0], n[1] - m[1]) < 96) {
        g.appendChild(mk('line', {
          x1: n[0], y1: n[1], x2: m[0], y2: m[1],
          stroke: '#6B82A6', 'stroke-width': 0.7, opacity: 0.32,
        }));
      }
    }));
    nodes.forEach((n, i) => {
      const dot = mk('circle', { cx: n[0], cy: n[1], r: 3, fill: '#DCE8F8', opacity: 0.9 });
      dot.appendChild(mk('animate', {
        attributeName: 'opacity', values: '0.9;0.45;0.9',
        dur: `${2.4 + (i % 5) * 0.4}s`, repeatCount: 'indefinite',
      }));
      g.appendChild(dot);
    });
    g.appendChild(mk('circle', { cx: c[0], cy: c[1], r: 8, fill: '#FFF', filter: 'url(#glow)' }));
    return g;
  }

  /* ---------- командный центр ---------- */

  /** В середине офиса сидят двое: оркестратор раздаёт задачи,
      управляющий принимает работу или возвращает её. Над ними — общая память. */
  Office.buildCore = function (c) {
    const g = mk('g');
    const tint = '#8FA8D8';
    const H = 26;

    const N = proj(-H, -H), E = proj(H, -H), S = proj(H, H), W = proj(-H, H);
    const down = (p) => [p[0], p[1] + 22];
    g.appendChild(mk('polygon', { points: pts([E, S, down(S), down(E)]), fill: mixDark(tint, 0.78) }));
    g.appendChild(mk('polygon', { points: pts([S, W, down(W), down(S)]), fill: mixDark(tint, 0.86) }));
    g.appendChild(mk('polygon', {
      points: pts([N, E, S, W]), fill: mixDark(tint, 0.7),
      stroke: shade(tint, 0.95), 'stroke-width': 1.2, opacity: 0.97,
    }));
    g.appendChild(mk('polygon', {
      points: pts([proj(-H + 4, -H + 4), proj(H - 4, -H + 4), proj(H - 4, H - 4), proj(-H + 4, H - 4)]),
      fill: mixDark(tint, 0.58), opacity: 0.55,
    }));

    const label = mk('text', {
      fill: shade(tint, 1.1), opacity: 0.55,
      'font-size': 8.5, 'font-family': 'JetBrains Mono, monospace',
      'letter-spacing': 2, 'font-weight': 700,
      transform: `translate(${proj(-H + 6, H - 6)[0]} ${proj(-H + 6, H - 6)[1]}) matrix(0.866 0.5 -0.866 0.5 0 0)`,
    });
    label.textContent = 'КОМАНДНЫЙ ЦЕНТР';
    g.appendChild(label);

    g.appendChild(buildBrain(c));

    const CORE = [
      { id: '__router', name: 'Оркестратор', emoji: '🎛️', color: '#6F8FE8', x: -13, y: -6,
        description: 'Принимает задачу, выбирает исполнителя, ведёт очередь' },
      { id: '__reviewer', name: 'Управляющий', emoji: '🧐', color: '#E0A03A', x: 13, y: 8,
        description: 'Проверяет работу по правилам магазина: принять или вернуть' },
    ];
    for (const a of CORE) g.appendChild(this.buildWorkstation(a, a.x, a.y, tint));
    this.core = CORE;

    return g;
  };

  /** Сколько задач сейчас у оркестратора и управляющего. */
  Office.coreStats = function () {
    const t = this.state.tasks || [];
    return {
      __router: {
        active: t.filter((x) => x.stage === 'routing').length,
        waiting: 0,
        done: t.filter((x) => x.agentId).length,
      },
      __reviewer: {
        active: t.filter((x) => x.stage === 'review').length,
        waiting: t.filter((x) => x.review?.verdict === 'rework').length,
        done: t.filter((x) => x.review?.verdict === 'ok').length,
      },
    };
  };

  /* ---------- этаж отдела ---------- */

  Office.buildFloor = function (b) {
    const list = this.agents.filter((a) => a.block === b.name);
    const tint = this.color[b.name];
    const g = mk('g', { 'data-block': b.name, class: 'plate', style: 'cursor:pointer' });
    this.nodes.plates[b.name] = g;

    const N = proj(b.cx - HALF, b.cy - HALF), E = proj(b.cx + HALF, b.cy - HALF),
          S = proj(b.cx + HALF, b.cy + HALF), W = proj(b.cx - HALF, b.cy + HALF);
    const down = (p) => [p[0], p[1] + THICK];

    // боковые грани плиты
    g.appendChild(mk('polygon', { points: pts([E, S, down(S), down(E)]), fill: mixDark(tint, 0.72) }));
    g.appendChild(mk('polygon', { points: pts([S, W, down(W), down(S)]), fill: mixDark(tint, 0.82) }));
    // торец с подсветкой
    g.appendChild(mk('polygon', {
      points: pts([E, S, [S[0], S[1] + 3], [E[0], E[1] + 3]]), fill: shade(tint, 0.9), opacity: 0.55,
    }));
    // верх
    g.appendChild(mk('polygon', {
      points: pts([N, E, S, W]), fill: mixDark(tint, 0.62),
      stroke: shade(tint, 1.1), 'stroke-width': 1.2, opacity: 0.97,
    }));
    // ковровая вставка
    const inset = 3.5;
    g.appendChild(mk('polygon', {
      points: pts([
        proj(b.cx - HALF + inset, b.cy - HALF + inset), proj(b.cx + HALF - inset, b.cy - HALF + inset),
        proj(b.cx + HALF - inset, b.cy + HALF - inset), proj(b.cx - HALF + inset, b.cy + HALF - inset),
      ]),
      fill: mixDark(tint, 0.5), opacity: 0.5,
    }));
    // разметка пола
    const marks = mk('g', { opacity: 0.22 });
    for (let i = -HALF + 6; i < HALF - 2; i += 6) {
      const a = proj(b.cx + i, b.cy - HALF + inset), c2 = proj(b.cx + i, b.cy + HALF - inset);
      marks.appendChild(mk('line', { x1: a[0], y1: a[1], x2: c2[0], y2: c2[1], stroke: shade(tint, 1.4), 'stroke-width': 0.6 }));
    }
    g.appendChild(marks);

    // перегородки по дальним сторонам
    g.appendChild(partition(proj(b.cx - HALF, b.cy - HALF), proj(b.cx + HALF, b.cy - HALF), tint));
    g.appendChild(partition(proj(b.cx - HALF, b.cy + HALF), proj(b.cx - HALF, b.cy - HALF), tint));

    // название отдела прямо на полу
    g.appendChild(floorLabel(b, tint));

    // растение в углу — на части этажей
    if (PLANT_AT.includes(b.i)) g.appendChild(plant(proj(b.cx + HALF - 4, b.cy - HALF + 4)));

    const spots = SPOTS[list.length] || SPOTS[5];
    list.forEach((agent, i) => {
      const [dx, dy] = spots[i] || [0, 0];
      g.appendChild(this.buildWorkstation(agent, b.cx + dx, b.cy + dy, tint));
    });
    return g;
  };

  /** Низкая перегородка вдоль ребра этажа. */
  function partition(a, b, tint) {
    const h = 16;
    const g = mk('g');
    g.appendChild(mk('polygon', {
      points: pts([a, b, [b[0], b[1] - h], [a[0], a[1] - h]]),
      fill: mixDark(tint, 0.55), opacity: 0.9,
    }));
    g.appendChild(mk('line', {
      x1: a[0], y1: a[1] - h, x2: b[0], y2: b[1] - h,
      stroke: shade(tint, 1.2), 'stroke-width': 1, opacity: 0.6,
    }));
    return g;
  }

  /** Название отдела, лежащее в плоскости пола. */
  function floorLabel(b, tint) {
    const [x, y] = proj(b.cx - HALF + 5, b.cy + HALF - 5);
    const t = mk('text', {
      x: 0, y: 0, fill: shade(tint, 1.7), opacity: 0.62,
      'font-size': 8.5, 'font-family': 'JetBrains Mono, monospace',
      'letter-spacing': 2, 'font-weight': 700,
      transform: `translate(${x} ${y}) matrix(0.866 0.5 -0.866 0.5 0 0)`,
    });
    t.textContent = b.name.toUpperCase();
    return t;
  }

  function plant(p) {
    const g = mk('g');
    g.appendChild(mk('ellipse', { cx: p[0], cy: p[1] + 1, rx: 7, ry: 3, fill: '#03060C', opacity: 0.45 }));
    g.appendChild(mk('path', {
      d: `M ${p[0] - 4} ${p[1]} L ${p[0] + 4} ${p[1]} L ${p[0] + 3} ${p[1] - 8} L ${p[0] - 3} ${p[1] - 8} Z`,
      fill: '#5A4230',
    }));
    for (const [dx, dy, r] of [[-4, -14, 4.5], [3, -16, 4], [0, -19, 4.2], [-1, -12, 3.6]]) {
      g.appendChild(mk('ellipse', {
        cx: p[0] + dx, cy: p[1] + dy, rx: r, ry: r * 0.78, fill: '#2E7D52', opacity: 0.92,
      }));
    }
    return g;
  }

  /* ---------- рабочее место ---------- */

  Office.buildWorkstation = function (agent, x, y, tint) {
    const p = proj(x, y, 0);
    const g = mk('g', { 'data-agent': agent.id, class: 'desk', style: 'cursor:pointer' });

    // тень
    g.appendChild(mk('ellipse', { cx: p[0], cy: p[1] + 4, rx: 22, ry: 9, fill: '#03060C', opacity: 0.45 }));

    // стол: верх и боковины
    const d = 5.2, top = [
      proj(x - d, y - d), proj(x + d, y - d), proj(x + d, y + d), proj(x - d, y + d),
    ];
    const legH = 9;
    g.appendChild(mk('polygon', {
      points: pts([top[1], top[2], [top[2][0], top[2][1] + legH], [top[1][0], top[1][1] + legH]]),
      fill: '#0D1524',
    }));
    g.appendChild(mk('polygon', {
      points: pts([top[2], top[3], [top[3][0], top[3][1] + legH], [top[2][0], top[2][1] + legH]]),
      fill: '#0A111D',
    }));
    g.appendChild(mk('polygon', {
      points: pts(top), fill: '#1A2740', stroke: '#2C4166', 'stroke-width': 0.9,
    }));

    // кресло
    const chair = proj(x - 8.5, y + 1);
    g.appendChild(mk('ellipse', { cx: chair[0], cy: chair[1] + 2, rx: 7, ry: 3, fill: '#03060C', opacity: 0.4 }));
    g.appendChild(mk('rect', {
      x: chair[0] - 5, y: chair[1] - 9, width: 10, height: 9, rx: 3,
      fill: '#141F33', stroke: '#2A3E60', 'stroke-width': 0.7,
    }));
    g.appendChild(mk('rect', {
      x: chair[0] - 6, y: chair[1] - 20, width: 12, height: 12, rx: 4,
      fill: '#182741', stroke: '#2A3E60', 'stroke-width': 0.7,
    }));

    // сотрудник — сидит спиной к нам, лицом к монитору
    const fig = mk('g', { class: 'fig', style: `animation-delay:${(Math.abs(x * 7 + y * 3) % 24) / 10}s` });
    fig.appendChild(mk('rect', {
      x: chair[0] - 5, y: chair[1] - 22, width: 10, height: 14, rx: 4.5,
      fill: agent.color, opacity: 0.95, class: 'body',
    }));
    // руки к столу
    fig.appendChild(mk('path', {
      d: `M ${chair[0] + 4} ${chair[1] - 17} Q ${chair[0] + 10} ${chair[1] - 14} ${p[0] - 4} ${p[1] - 1}`,
      stroke: agent.color, 'stroke-width': 1.8, fill: 'none', opacity: 0.45, 'stroke-linecap': 'round',
    }));
    fig.appendChild(mk('circle', { cx: chair[0], cy: chair[1] - 26, r: 4.6, fill: '#E9EFFA' }));
    fig.appendChild(mk('path', {
      d: `M ${chair[0] - 4.6} ${chair[1] - 27} a 4.6 4.6 0 0 1 9.2 0 z`,
      fill: shade(agent.color, 0.75),
    }));
    g.appendChild(fig);

    // клавиатура и кружка
    const kb = proj(x - 1, y + 2.5);
    g.appendChild(mk('polygon', {
      points: pts([proj(x - 4, y + 1), proj(x + 2, y + 1), proj(x + 2, y + 4), proj(x - 4, y + 4)]),
      fill: '#0E1828', stroke: '#2C4166', 'stroke-width': 0.5,
    }));
    const mug = proj(x + 4, y + 3.5);
    g.appendChild(mk('ellipse', { cx: mug[0], cy: mug[1] - 3, rx: 2.4, ry: 1.3, fill: '#C9D6EA' }));
    g.appendChild(mk('rect', { x: mug[0] - 2.4, y: mug[1] - 6, width: 4.8, height: 4, rx: 1, fill: '#94A7C4' }));

    // монитор
    const mx = p[0] + 3, my = p[1] - 44;
    g.appendChild(mk('rect', { x: mx + 16, y: my + 23, width: 2.4, height: 8, fill: '#2C4166' }));
    g.appendChild(mk('rect', { x: mx + 8, y: my + 30, width: 18, height: 2.4, rx: 1.2, fill: '#2C4166' }));
    g.appendChild(mk('rect', {
      x: mx - 1.4, y: my - 1.4, width: 37, height: 27, rx: 3.4,
      fill: '#0B1220', stroke: '#2C4166', 'stroke-width': 1,
    }));
    const face = mk('rect', {
      x: mx, y: my, width: 34, height: 24, rx: 2.4,
      fill: '#060B14', stroke: shade(agent.color, 1.15), 'stroke-width': 0.9, class: 'screenface',
    });
    g.appendChild(face);

    const lines = mk('g', { class: 'codelines' });
    for (let i = 0; i < 5; i++) {
      lines.appendChild(mk('rect', {
        x: mx + 3, y: my + 3.4 + i * 4.1, width: 7 + ((i * 9) % 22), height: 1.7, rx: 0.85,
        fill: shade(agent.color, 1.5), opacity: 0.22,
      }));
    }
    g.appendChild(lines);
    this.nodes.monitors[agent.id] = { g, lines, face, at: [mx + 17, my + 6] };

    // читаемый экран — проявляется, когда камера рядом
    const scr = document.createElement('div');
    scr.className = 'deskscreen';
    scr.dataset.agent = agent.id;
    scr.style.left = (mx + 17) + 'px';
    scr.style.top = (my + 12) + 'px';
    scr.innerHTML = '<b></b><i></i>';
    this.overlay.appendChild(scr);
    this.nodes.screens[agent.id] = scr;

    // табличка с именем
    const tag = document.createElement('div');
    tag.className = 'atag';
    tag.dataset.agent = agent.id;
    tag.style.left = p[0] + 'px';
    tag.style.top = (my - 8) + 'px';
    tag.innerHTML = `${esc(agent.emoji)} ${esc(agent.name)}${agent.custom ? ' <em>СВОЙ</em>' : ''}`;
    this.overlay.appendChild(tag);
    this.nodes.tags[agent.id] = tag;

    return g;
  };

  Office.buildCard = function (b) {
    const p = proj(b.cx - HALF, b.cy - HALF);
    const d = document.createElement('div');
    d.className = 'card';
    d.dataset.block = b.name;
    d.style.left = p[0] + 'px';
    d.style.top = (p[1] - 26) + 'px';
    d.style.setProperty('--dot', this.color[b.name]);
    return d;
  };

  /* ================= обновление данными ================= */

  Office.statsOf = function (id) {
    if (id === '__router' || id === '__reviewer') return this.coreStats()[id];
    return this.state.stats?.byAgent?.[id] || { active: 0, waiting: 0, done: 0 };
  };

  Office.taskOf = function (id) {
    const t = this.state.tasks || [];
    if (id === '__router') return t.find((x) => x.stage === 'routing') || null;
    if (id === '__reviewer') return t.find((x) => x.stage === 'review')
      || t.find((x) => x.review) || null;
    return t.find((x) => x.agentId === id && (x.status === 'working' || x.status === 'routing'))
        || t.find((x) => x.agentId === id && x.status === 'waiting_approval')
        || t.find((x) => x.agentId === id) || null;
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
         <div class="card-count"><b>${n}</b><span>${plural(n, 'агент', 'агента', 'агентов')}</span></div>
         <div class="card-foot">
           <span>в работе <b>${s.active}</b></span>
           <span>след. <b>${s.next}</b></span>
           <span>готово <b>${s.done}</b></span>
         </div>
         ${s.waiting ? `<div class="card-alert">⚠ ${s.waiting} ${plural(s.waiting, 'ждёт', 'ждут', 'ждут')} решения</div>` : ''}`;
    }

    for (const a of [...this.agents, ...(this.core || [])]) {
      const s = this.statsOf(a.id);
      const busy = s.active > 0;
      const mon = this.nodes.monitors[a.id];
      if (!mon) continue;
      mon.g.querySelector('.fig').classList.toggle('busy-now', busy);
      mon.lines.classList.toggle('typing', busy);
      mon.face.setAttribute('fill', busy ? '#0C1B36' : '#060B14');
      mon.face.style.filter = busy ? 'url(#softglow)' : '';

      const scr = this.nodes.screens[a.id];
      if (a.id === '__router' || a.id === '__reviewer') {
        const routing = (this.state.tasks || []).find((x) =>
          x.stage === (a.id === '__router' ? 'routing' : 'review'));
        scr.classList.toggle('live', busy);
        scr.querySelector('b').textContent = busy
          ? (a.id === '__router' ? 'подбираю исполнителя' : 'проверяю работу')
          : 'свободен';
        scr.querySelector('i').textContent = routing
          ? routing.title
          : `принято ${s.done}${s.waiting ? ` · возвращено ${s.waiting}` : ''}`;
        continue;
      }
      const task = this.taskOf(a.id);
      const text = busy ? (task?.partial || '') : (task?.output || '');
      scr.classList.toggle('live', busy);
      scr.querySelector('b').textContent = busy ? (task?.title || 'работает')
        : s.waiting ? 'ждёт решения' : 'свободен';
      scr.querySelector('i').textContent = text ? text.slice(-520) : (busy ? '…' : '');
    }

    for (const b of this.layout) {
      const on = this.blockStats(b.name).active > 0;
      const w = this.nodes.wires[b.name];
      w.setAttribute('stroke', on ? '#4C8DFF' : '#1E2C45');
      w.setAttribute('stroke-width', on ? 2.2 : 1.6);
      w.setAttribute('stroke-dasharray', on ? '6 9' : '');
      w.querySelectorAll('animate').forEach((n) => n.remove());
      if (on) w.appendChild(mk('animate', {
        attributeName: 'stroke-dashoffset', from: '30', to: '0', dur: '1s', repeatCount: 'indefinite',
      }));

      const pid = 'pulse-' + b.i;
      const has = this.svg.querySelector('#' + pid);
      if (on && !has) {
        const dot = mk('circle', { id: pid, r: 3.6, fill: '#9CC8FF', filter: 'url(#softglow)' });
        const motion = mk('animateMotion', { dur: '1.9s', repeatCount: 'indefinite' });
        motion.appendChild(mk('mpath', { href: '#wire-' + b.i }));
        dot.appendChild(motion);
        this.svg.querySelector('#wires').appendChild(dot);
      } else if (!on && has) has.remove();
    }

    this.paintMinimap();
    if (this.focusedAgent) this.refreshFocusPanel();
  };

  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  };

  /* ================= мини-карта ================= */

  Office.buildMinimap = function () {
    const box = document.getElementById('minimap');
    if (!box) return;
    box.innerHTML = '';
    const svg = mk('svg', { viewBox: '0 0 120 120', width: '100%', height: '100%' });
    this.miniDots = {};
    for (const b of this.layout) {
      const x = 60 + b.cx * 0.45, y = 60 + b.cy * 0.45;
      const dot = mk('circle', {
        cx: x, cy: y, r: 7, fill: mixDark(this.color[b.name], 0.35),
        stroke: this.color[b.name], 'stroke-width': 1.2, style: 'cursor:pointer',
      });
      dot.addEventListener('click', () => this.focusBlock(b.name));
      const title = mk('title');
      title.textContent = b.name;
      dot.appendChild(title);
      this.miniDots[b.name] = dot;
      svg.appendChild(dot);
    }
    svg.appendChild(mk('circle', { cx: 60, cy: 60, r: 3.4, fill: '#DCE8F8' }));
    this.miniView = mk('rect', {
      x: 20, y: 20, width: 80, height: 80, rx: 3,
      fill: 'none', stroke: '#4C8DFF', 'stroke-width': 1.2, opacity: 0.8,
    });
    svg.appendChild(this.miniView);
    box.appendChild(svg);
  };

  Office.paintMinimap = function () {
    if (!this.miniDots) return;
    for (const b of this.layout) {
      const s = this.blockStats(b.name);
      const dot = this.miniDots[b.name];
      dot.setAttribute('r', s.active ? 9 : 7);
      dot.setAttribute('fill', s.active ? this.color[b.name]
        : s.waiting ? mixDark(this.color[b.name], 0.2) : mixDark(this.color[b.name], 0.45));
    }
  };

  Office.paintMiniView = function () {
    if (!this.miniView) return;
    const r = this.viewport.getBoundingClientRect();
    const w = (r.width / this.view.scale) / (R * 4.2 * K / 120);
    const h = (r.height / this.view.scale) / (R * 4.2 * K / 120);
    const cx = 60 + ((ORIGIN.x - (r.width / 2 - this.view.tx) / this.view.scale) * -0.45) / K * 0.9;
    const cy = 60 + ((ORIGIN.y - (r.height / 2 - this.view.ty) / this.view.scale) * -0.45) / K * 0.9;
    this.miniView.setAttribute('x', Math.max(0, Math.min(120, cx - w / 2)));
    this.miniView.setAttribute('y', Math.max(0, Math.min(120, cy - h / 2)));
    this.miniView.setAttribute('width', Math.max(6, Math.min(120, w)));
    this.miniView.setAttribute('height', Math.max(6, Math.min(120, h)));
  };

  /* ================= камера ================= */

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let flight = null;

  Office.applyView = function () {
    this.world.style.transform = `translate(${this.view.tx}px, ${this.view.ty}px) scale(${this.view.scale})`;
    this.world.classList.toggle('near', this.view.scale > 1.05);
    this.world.classList.toggle('close', this.view.scale > 1.9);
    this.paintMiniView();
  };

  Office.flyTo = function (wx, wy, scale, ms = 780) {
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

  Office.fit = function (instant = false) {
    const r = this.viewport.getBoundingClientRect();
    const s = Math.min(1, Math.max(0.28, Math.min(r.width / 2000, r.height / 1260)));
    if (instant) {
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
    this.flyTo(wx, wy + 6, 1.5);
    this.world.classList.add('focused');
    for (const [n, g] of Object.entries(this.nodes.plates)) g.classList.toggle('on', n === name);
    for (const [n, c] of Object.entries(this.nodes.cards)) c.classList.toggle('focused', n === name);
    const ids = new Set(this.agents.filter((a) => a.block === name).map((a) => a.id));
    for (const [id, t] of Object.entries(this.nodes.tags)) t.classList.toggle('on', ids.has(id));
    for (const [id, s] of Object.entries(this.nodes.screens)) s.classList.toggle('on', ids.has(id));
    const n = ids.size;
    this.showBar(`${name} · ${n} ${plural(n, 'агент', 'агента', 'агентов')}`);
  };

  Office.focusAgent = function (id) {
    const agent = this.agents.find((a) => a.id === id)
      || (this.core || []).find((a) => a.id === id);
    if (!agent) return;
    if (id === '__router' || id === '__reviewer') {
      const mon = this.nodes.monitors[id];
      this.focusedAgent = id;
      this.flyTo(mon.at[0], mon.at[1] + 14, 2.4, 860);
      this.showBar(agent.name);
      this.refreshFocusPanel();
      return;
    }
    this.focusedBlock = agent.block;
    this.focusedAgent = id;
    const mon = this.nodes.monitors[id];
    this.flyTo(mon.at[0], mon.at[1] + 14, 2.6, 860);
    this.world.classList.add('focused');
    for (const [n, g] of Object.entries(this.nodes.plates)) g.classList.toggle('on', n === agent.block);
    for (const c of Object.values(this.nodes.cards)) c.classList.remove('focused');
    for (const [aid, t] of Object.entries(this.nodes.tags)) t.classList.toggle('on', aid === id);
    for (const [aid, s] of Object.entries(this.nodes.screens)) s.classList.toggle('on', aid === id);
    this.showBar(agent.name);
    this.refreshFocusPanel();
  };

  Office.refreshFocusPanel = function () {
    const agent = this.agents.find((a) => a.id === this.focusedAgent)
      || (this.core || []).find((a) => a.id === this.focusedAgent);
    if (!agent) return;
    const s = this.statsOf(agent.id);
    const task = this.taskOf(agent.id);
    const busy = s.active > 0;
    const panel = document.getElementById('agentPanel');
    panel.hidden = false;
    panel.querySelector('.ap-name').textContent = `${agent.emoji} ${agent.name}`;
    panel.querySelector('.ap-role').textContent = agent.description;

    const status = panel.querySelector('.ap-status');
    status.textContent = busy ? 'пишет ответ' : s.waiting ? 'ждёт решения' : 'свободен';
    status.className = 'ap-status ' + (busy ? 'work' : s.waiting ? 'wait' : '');

    panel.querySelector('.ap-task').textContent = task ? task.title : 'задач пока не было';
    const tools = panel.querySelector('.ap-tools');
    const used = task?.tools || [];
    tools.hidden = !used.length;
    tools.textContent = used.length ? '⚙ ' + used[used.length - 1] : '';

    const body = panel.querySelector('.ap-text');
    const text = busy ? (task?.partial || '') : (task?.output || '');
    body.textContent = text || (busy ? 'думает…' : '—');
    body.classList.toggle('typing', busy);
    body.scrollTop = body.scrollHeight;

    const done = this.statsOf(agent.id).done;
    panel.querySelector('.ap-meta').textContent = agent.block
      ? `${agent.block} · волна ${agent.wave} · принято ${done}` + (agent.custom ? ' · написан под Vitaflow' : '')
      : `командный центр · через него прошло ${done}`;
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

  /* ================= навигация ================= */

  Office.bindNavigation = function () {
    const vp = this.viewport;
    let drag = null, downTarget = null, pinch = null;

    vp.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.zoom, .focusbar, .agent-panel, .minimap')) return;
      downTarget = e.target;
      drag = { x: e.clientX, y: e.clientY, tx: this.view.tx, ty: this.view.ty, moved: false, id: e.pointerId, held: false };
    });
    vp.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) <= 4) return;
      if (!drag.held) {
        // захват включаем только при настоящем перетаскивании: иначе браузер
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
      const next = Math.min(4, Math.max(0.22, this.view.scale * factor));
      const k = next / this.view.scale;
      this.view.tx = px - (px - this.view.tx) * k;
      this.view.ty = py - (py - this.view.ty) * k;
      this.view.scale = next;
      this.applyView();
    };
    this.zoomAt = zoomAt;

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
      if (pinch) zoomAt(d / pinch,
        (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
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
        this.flyTo(ORIGIN.x, ORIGIN.y, 1.25);
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

  /** Следующий/предыдущий сотрудник — для стрелок на клавиатуре. */
  Office.step = function (dir) {
    if (!this.agents.length) return;
    const i = this.agents.findIndex((a) => a.id === this.focusedAgent);
    const next = this.agents[(i + dir + this.agents.length) % this.agents.length];
    this.focusAgent(next.id);
  };

  global.Office = Office;
})(window);
