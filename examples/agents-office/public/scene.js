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
    nodes: { screens: {}, plates: {}, cards: {}, tags: {}, monitors: {}, wires: {}, figs: {}, boards: null },
    lounge: null, dock: null, droneCount: 0, lastServed: {},
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
    this.nodes = { screens: {}, plates: {}, cards: {}, tags: {}, monitors: {}, wires: {}, figs: {}, boards: null };
    this.droneCount = 0;
    this.lastServed = {};

    this.svg.appendChild(buildDefs());

    const gGround = mk('g');             // общий пол под всем офисом
    const gWires = mk('g', { id: 'wires' });
    const gPlates = mk('g');
    const gAir = mk('g', { id: 'air' });      // дроны летят поверх всей сцены
    this.gAir = gAir;
    this.svg.append(gGround, gWires, gPlates, gAir);

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

    gPlates.appendChild(this.buildLounge());

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

    clearInterval(this.loungeTimer);
    this.loungeTimer = setInterval(() => this.tickLounge(), 2600);
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
    for (const a of CORE) g.appendChild(this.buildWorkstation(a, a.x, a.y, tint, { exec: true }));
    this.core = CORE;

    // Табло над столами: у оркестратора — очередь задач, у управляющего —
    // счётчики принятых и возвращённых работ. Данные подставляет update().
    const boards = { queue: [], ok: null, rework: null, okText: null, rwText: null };
    const rAt = this.nodes.monitors.__router.at;
    const vAt = this.nodes.monitors.__reviewer.at;

    const holo = mk('g', { class: 'holo', filter: 'url(#softglow)' });
    holo.appendChild(mk('rect', {
      x: rAt[0] - 24, y: rAt[1] - 40, width: 48, height: 20, rx: 3,
      fill: '#0A1A34', opacity: 0.55, stroke: '#4C8DFF', 'stroke-width': 0.5,
    }));
    const qLabel = mk('text', {
      x: rAt[0] - 20, y: rAt[1] - 32, fill: '#8FBEFF', 'font-size': 4,
      'font-family': 'JetBrains Mono, monospace', 'letter-spacing': 0.6,
    });
    qLabel.textContent = 'ОЧЕРЕДЬ';
    holo.appendChild(qLabel);
    for (let i = 0; i < 5; i++) {
      const bar = mk('rect', {
        x: rAt[0] - 20 + i * 8, y: rAt[1] - 29, width: 6, height: 5, rx: 1.2,
        fill: '#4C8DFF', opacity: 0.16,
      });
      boards.queue.push(bar);
      holo.appendChild(bar);
    }
    g.appendChild(holo);

    const panel = mk('g', { class: 'holo', filter: 'url(#softglow)' });
    panel.appendChild(mk('rect', {
      x: vAt[0] - 24, y: vAt[1] - 40, width: 48, height: 20, rx: 3,
      fill: '#241A06', opacity: 0.6, stroke: '#E0A03A', 'stroke-width': 0.5,
    }));
    const lamp = (cx, color) => mk('circle', { cx, cy: vAt[1] - 32, r: 2.6, fill: color, opacity: 0.2 });
    boards.ok = lamp(vAt[0] - 17, '#3ED598');
    boards.rework = lamp(vAt[0] + 5, '#E0A03A');
    panel.append(boards.ok, boards.rework);
    const mkText = (x2, color) => {
      const t = mk('text', {
        x: x2, y: vAt[1] - 30.4, fill: color, 'font-size': 4.6, 'font-weight': 700,
        'font-family': 'JetBrains Mono, monospace',
      });
      t.textContent = '0';
      return t;
    };
    boards.okText = mkText(vAt[0] - 13, '#8CE8C4');
    boards.rwText = mkText(vAt[0] + 9, '#F0C980');
    panel.append(boards.okText, boards.rwText);
    const vLabel = mk('text', {
      x: vAt[0] - 20, y: vAt[1] - 23, fill: '#C9A14A', 'font-size': 3.6,
      'font-family': 'JetBrains Mono, monospace', 'letter-spacing': 0.4,
    });
    vLabel.textContent = 'ПРИНЯТО · ВОЗВРАТ';
    panel.appendChild(vLabel);
    g.appendChild(panel);

    this.nodes.boards = boards;
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

  /* ---------- объёмные примитивы ---------- */

  /** Коробка в изометрии: верх и две ближние грани.
      top/base — высоты в мировых единицах, fills — [верх, грань X, грань Y, контур]. */
  function box(x, y, w, d, top, base, fills) {
    const A = proj(x - w / 2, y - d / 2, top), B = proj(x + w / 2, y - d / 2, top),
          C = proj(x + w / 2, y + d / 2, top), D = proj(x - w / 2, y + d / 2, top);
    const B0 = proj(x + w / 2, y - d / 2, base), C0 = proj(x + w / 2, y + d / 2, base),
          D0 = proj(x - w / 2, y + d / 2, base);
    const g = mk('g');
    g.appendChild(mk('polygon', { points: pts([B, C, C0, B0]), fill: fills[1] }));
    g.appendChild(mk('polygon', { points: pts([C, D, D0, C0]), fill: fills[2] }));
    g.appendChild(mk('polygon', {
      points: pts([A, B, C, D]), fill: fills[0],
      stroke: fills[3] || 'none', 'stroke-width': 0.7,
    }));
    return g;
  }
  /** Накладка на ближнюю грань (+Y) коробки: дверь холодильника, стекло витрины. */
  function faceY(x, y, w, ztop, zbase, attrs) {
    return mk('polygon', {
      points: pts([
        proj(x - w / 2, y, ztop), proj(x + w / 2, y, ztop),
        proj(x + w / 2, y, zbase), proj(x - w / 2, y, zbase),
      ]),
      ...attrs,
    });
  }
  const boxFills = (hex, s1 = 0.42) => [
    mixDark(hex, s1), mixDark(hex, s1 + 0.24), mixDark(hex, s1 + 0.34), shade(hex, 1.05),
  ];

  /* ---------- что приносят дроны ---------- */

  /** Каждый предмет нарисован вокруг нуля и стоит на поверхности. */
  const PAYLOAD = {
    coffee: () => {
      const g = mk('g');
      g.appendChild(mk('path', { d: 'M -2.1 -6.4 L 2.1 -6.4 L 1.5 0 L -1.5 0 Z', fill: '#F0F4FA' }));
      g.appendChild(mk('rect', { x: -2.5, y: -7.4, width: 5, height: 1.4, rx: 0.7, fill: '#8A5A2B' }));
      g.appendChild(mk('rect', { x: -2.1, y: -4.4, width: 4.2, height: 1.2, fill: '#C08A4A', opacity: 0.8 }));
      return g;
    },
    energy: () => {
      const g = mk('g');
      g.appendChild(mk('rect', { x: -1.9, y: -7, width: 3.8, height: 7, rx: 1.3, fill: '#1FCBA0' }));
      g.appendChild(mk('rect', { x: -1.9, y: -4.4, width: 3.8, height: 1.4, fill: '#0B1220', opacity: 0.55 }));
      g.appendChild(mk('rect', { x: -1.9, y: -7, width: 3.8, height: 1, rx: 0.5, fill: '#9FF0DA' }));
      return g;
    },
    donut: () => {
      const g = mk('g');
      g.appendChild(mk('circle', { cx: 0, cy: -2.6, r: 2.8, fill: '#D99A55' }));
      g.appendChild(mk('path', { d: 'M -2.8 -3.2 a 2.8 2.8 0 0 1 5.6 0 z', fill: '#E86FA8' }));
      g.appendChild(mk('circle', { cx: 0, cy: -2.6, r: 0.9, fill: '#0B1220' }));
      return g;
    },
    meal: () => {
      const g = mk('g');
      g.appendChild(mk('ellipse', { cx: 0, cy: -1, rx: 3.8, ry: 1.7, fill: '#E4EBF6' }));
      g.appendChild(mk('ellipse', { cx: -1.2, cy: -1.6, rx: 1.4, ry: 0.8, fill: '#C8663E' }));
      g.appendChild(mk('ellipse', { cx: 1.1, cy: -1.4, rx: 1.2, ry: 0.7, fill: '#5EA757' }));
      return g;
    },
    water: () => {
      const g = mk('g');
      g.appendChild(mk('rect', { x: -1.5, y: -7.2, width: 3, height: 7.2, rx: 1.2, fill: '#7FC8F5', opacity: 0.85 }));
      g.appendChild(mk('rect', { x: -0.9, y: -8.4, width: 1.8, height: 1.4, rx: 0.5, fill: '#2F6FA8' }));
      return g;
    },
    cake: () => {
      const g = mk('g');
      g.appendChild(mk('path', { d: 'M -2.8 0 L 2.8 0 L 1.6 -4.6 L -1.6 -4.6 Z', fill: '#F0C9A0' }));
      g.appendChild(mk('path', { d: 'M -1.9 -4.6 L 1.9 -4.6 L 1.5 -6 L -1.5 -6 Z', fill: '#E86FA8' }));
      g.appendChild(mk('circle', { cx: 0, cy: -6.6, r: 0.9, fill: '#D6493F' }));
      return g;
    },
  };
  const PAYLOAD_KEYS = Object.keys(PAYLOAD);

  /* ---------- человек за столом ---------- */

  const SKINS = ['#E8C6A4', '#D6A176', '#F0D9C2', '#C08B60', '#EAD0B4'];
  const HAIRS = ['#241C14', '#4A3220', '#171722', '#6B4A2A', '#3A2A3A'];
  const hashOf = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  };

  /** Кисть: ладонь и три пальца — именно они стучат по клавишам. */
  function hand(px, py, skin, delay) {
    const g = mk('g', { class: 'hand', style: `animation-delay:${delay.toFixed(2)}s` });
    g.appendChild(mk('ellipse', { cx: px, cy: py, rx: 2.1, ry: 1.3, fill: skin }));
    for (let i = 0; i < 3; i++) {
      g.appendChild(mk('rect', {
        class: 'fin', x: px - 1.6 + i * 1.5, y: py - 2.4, width: 0.95, height: 2.4, rx: 0.45,
        fill: skin, style: `animation-delay:${(delay + i * 0.11).toFixed(2)}s`,
      }));
    }
    return g;
  }

  /** Монитор: корпус, нога, стекло и строки текста. */
  function monitor(mx, my, w, h, color, rows) {
    const g = mk('g');
    g.appendChild(mk('rect', { x: mx + w / 2 - 1.2, y: my + h - 1, width: 2.4, height: 8, fill: '#2C4166' }));
    g.appendChild(mk('rect', { x: mx + w / 2 - 9, y: my + h + 6, width: 18, height: 2.4, rx: 1.2, fill: '#2C4166' }));
    g.appendChild(mk('rect', {
      x: mx - 1.4, y: my - 1.4, width: w + 2.8, height: h + 2.8, rx: 3.4,
      fill: '#0B1220', stroke: '#2C4166', 'stroke-width': 1,
    }));
    const face = mk('rect', {
      x: mx, y: my, width: w, height: h, rx: 2.4,
      fill: '#060B14', stroke: shade(color, 1.15), 'stroke-width': 0.9, class: 'screenface',
    });
    g.appendChild(face);
    const lines = mk('g');
    for (let i = 0; i < rows; i++) {
      lines.appendChild(mk('rect', {
        x: mx + 3, y: my + 3.4 + i * 4.1, width: 7 + ((i * 9) % Math.max(8, w - 12)), height: 1.7, rx: 0.85,
        fill: shade(color, 1.5), opacity: 0.22,
      }));
    }
    g.appendChild(lines);
    return { g, face, lines };
  }

  /* ---------- рабочее место ---------- */

  Office.buildWorkstation = function (agent, x, y, tint, opts = {}) {
    const exec = !!opts.exec;
    const z0 = exec ? 1.8 : 0;                 // начальство сидит на подиуме
    const zd = z0 + 3.4;                       // высота столешницы над полом
    const p = proj(x, y, zd);
    const g = mk('g', { 'data-agent': agent.id, class: 'desk' + (exec ? ' exec' : ''), style: 'cursor:pointer' });
    const h = hashOf(agent.id);
    const skin = SKINS[h % SKINS.length];
    const hair = HAIRS[(h >> 3) % HAIRS.length];

    // подиум с золотым ограждением — место начальства видно издалека
    if (exec) {
      g.appendChild(box(x - 1, y + 1, 20, 18, 1.8, 0, boxFills('#8A6A34', 0.34)));
      const posts = [[x - 11, y - 8], [x + 9, y - 8], [x + 9, y + 10], [x - 11, y + 10]];
      for (let i = 0; i < posts.length; i++) {
        const t1 = proj(posts[i][0], posts[i][1], 5.2);
        const t2 = proj(posts[(i + 1) % posts.length][0], posts[(i + 1) % posts.length][1], 5.2);
        g.appendChild(mk('line', {
          x1: t1[0], y1: t1[1], x2: t2[0], y2: t2[1],
          stroke: '#C9A14A', 'stroke-width': 0.9, opacity: 0.55,
        }));
      }
      for (const [qx, qy] of posts) {
        const a1 = proj(qx, qy, 1.8), a2 = proj(qx, qy, 5.2);
        g.appendChild(mk('line', {
          x1: a1[0], y1: a1[1], x2: a2[0], y2: a2[1],
          stroke: '#C9A14A', 'stroke-width': 1.2, opacity: 0.85,
        }));
        g.appendChild(mk('circle', { cx: a2[0], cy: a2[1], r: 1.3, fill: '#E8C978' }));
      }
    }

    // тень на полу
    const fp = proj(x, y, z0);
    g.appendChild(mk('ellipse', {
      cx: fp[0], cy: fp[1] + 4, rx: exec ? 27 : 22, ry: exec ? 11 : 9, fill: '#03060C', opacity: 0.45,
    }));

    // стол: столешница на ножках
    const d = exec ? 6.6 : 5.2;
    g.appendChild(box(x, y, d * 2, d * 2, zd, z0, [
      exec ? '#2A2013' : '#1A2740',
      exec ? '#241B0E' : '#16223A',
      exec ? '#1B1409' : '#111A2C',
      exec ? '#C9A14A' : '#2C4166',
    ]));
    if (exec) {
      // тонкая золотая окантовка столешницы
      const in2 = d - 1;
      g.appendChild(mk('polygon', {
        points: pts([proj(x - in2, y - in2, zd), proj(x + in2, y - in2, zd), proj(x + in2, y + in2, zd), proj(x - in2, y + in2, zd)]),
        fill: 'none', stroke: '#E8C978', 'stroke-width': 0.5, opacity: 0.55,
      }));
    }

    /* Человека и кресло рисуем в собственных координатах и увеличиваем целиком:
       рядом с большим столом фигурка в масштабе сцены выглядела бы игрушечной. */
    const chair = proj(x - 6, y + 0.2, z0);
    const SC = exec ? 1.95 : 1.7;
    const wrap = mk('g', { transform: `translate(${chair[0]} ${chair[1]}) scale(${SC})` });
    const loc = (pt) => [(pt[0] - chair[0]) / SC, (pt[1] - chair[1]) / SC];
    const backH = exec ? 17 : 12;

    wrap.appendChild(mk('ellipse', { cx: 0, cy: 2, rx: 7, ry: 3, fill: '#03060C', opacity: 0.4 }));
    wrap.appendChild(mk('rect', {
      x: -5, y: -9, width: 10, height: 9, rx: 3,
      fill: exec ? '#1B1508' : '#141F33', stroke: exec ? '#6E5526' : '#2A3E60', 'stroke-width': 0.7,
    }));
    wrap.appendChild(mk('rect', {
      x: -6, y: -8 - backH, width: 12, height: backH, rx: 4,
      fill: exec ? '#221A0C' : '#182741', stroke: exec ? '#6E5526' : '#2A3E60', 'stroke-width': 0.7,
    }));
    if (exec) {
      wrap.appendChild(mk('rect', {
        x: -5, y: -30, width: 10, height: 5, rx: 2.4, fill: '#2A2013', stroke: '#6E5526', 'stroke-width': 0.6,
      }));
      for (const s2 of [-1, 1]) {
        wrap.appendChild(mk('rect', { x: s2 < 0 ? -7.4 : 5.4, y: -12, width: 2, height: 5, rx: 1, fill: '#2A2013' }));
      }
    }

    /* Сотрудник сидит спиной к нам, лицом к монитору. Руки лежат на
       клавиатуре — во время работы по ней стучат пальцы. */
    const fig = mk('g', { class: 'fig', style: `animation-delay:${(Math.abs(x * 7 + y * 3) % 24) / 10}s` });
    const shoulderY = -19;

    fig.appendChild(mk('rect', {
      x: -5, y: -22, width: 10, height: 14, rx: 4.5,
      fill: agent.color, opacity: 0.95, class: 'body',
    }));
    // плечи и воротник
    fig.appendChild(mk('path', {
      d: `M -5 ${shoulderY + 1} q 5 -3.6 10 0`,
      fill: 'none', stroke: exec ? '#F2F5FA' : shade(agent.color, 1.4),
      'stroke-width': exec ? 1.3 : 1, opacity: exec ? 0.9 : 0.6,
    }));
    if (exec) {
      fig.appendChild(mk('rect', { x: -5, y: -16, width: 10, height: 1, fill: '#C9A14A', opacity: 0.7 }));
    }

    // руки: от плеча к клавиатуре, на концах — работающие кисти
    const [hAx, hAy] = loc(proj(x - 4, y + 1, zd));
    const [hBx, hBy] = loc(proj(x - 3.6, y + 2.8, zd));
    const armColor = mixDark(agent.color, 0.34);
    const armPath = (sx, sy, hx, hy) => mk('path', {
      d: `M ${sx} ${sy} Q ${(sx + hx) / 2 + 3.2} ${(sy + hy) / 2 + 1.4} ${hx} ${hy}`,
      stroke: armColor, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', opacity: 0.95,
    });
    const armL = mk('g', { class: 'arm arm-l' });
    armL.appendChild(armPath(4.6, shoulderY + 0.5, hBx, hBy));
    armL.appendChild(hand(hBx, hBy, skin, 0.18));
    const armR = mk('g', { class: 'arm arm-r' });
    armR.appendChild(armPath(5.2, shoulderY - 1.5, hAx, hAy));
    armR.appendChild(hand(hAx, hAy, skin, 0));
    fig.append(armL, armR);

    // вторая правая рука — она поднимает кружку, когда сотрудник делает глоток
    const cupX = 10, cupY = -28.5;
    const armSip = mk('g', { class: 'arm-sip' });
    armSip.appendChild(mk('path', {
      d: `M 5.2 ${shoulderY - 1.5} Q 10 ${shoulderY - 6} ${cupX} ${cupY + 2}`,
      stroke: armColor, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', opacity: 0.95,
    }));
    armSip.appendChild(mk('rect', { x: cupX - 1.7, y: cupY - 1, width: 3.4, height: 4, rx: 1, fill: '#E4EBF6' }));

    // шея, голова, волосы и наушники
    const head = mk('g', { class: 'head' });
    head.appendChild(mk('rect', { x: -1.6, y: -25, width: 3.2, height: 3.4, rx: 1.2, fill: skin }));
    head.appendChild(mk('circle', { cx: 0, cy: -26, r: 4.6, fill: skin }));
    head.appendChild(mk('path', { d: 'M -4.6 -26.6 a 4.6 4.6 0 0 1 9.2 0 q -4.6 -1.6 -9.2 0 z', fill: hair }));
    head.appendChild(mk('path', {
      d: 'M -5 -27 a 5 5 0 0 1 10 0', fill: 'none', stroke: '#26344E', 'stroke-width': 0.9,
    }));
    for (const s2 of [-1, 1]) {
      head.appendChild(mk('rect', {
        x: s2 * 5 - 1.1, y: -28, width: 2.2, height: 3.2, rx: 1,
        fill: '#31415F', stroke: '#516A96', 'stroke-width': 0.4,
      }));
    }
    fig.appendChild(head);
    armSip.appendChild(mk('rect', { x: cupX - 2, y: cupY - 2, width: 4, height: 1.2, rx: 0.6, fill: '#8A5A2B' }));
    fig.appendChild(armSip);
    wrap.appendChild(fig);

    // клавиатура, мышь и кружка
    g.appendChild(mk('polygon', {
      points: pts([proj(x - 4.8, y + 0.6, zd), proj(x + 1.2, y + 0.6, zd), proj(x + 1.2, y + 3.6, zd), proj(x - 4.8, y + 3.6, zd)]),
      fill: '#0E1828', stroke: '#2C4166', 'stroke-width': 0.5,
    }));
    const keys = mk('g', { class: 'keys', opacity: 0.55 });
    for (let r = 0; r < 3; r++) {
      for (let c2 = 0; c2 < 6; c2++) {
        const kp = proj(x - 4.4 + c2 * 0.95, y + 1.1 + r * 0.9, zd);
        keys.appendChild(mk('rect', { x: kp[0] - 1.6, y: kp[1] - 0.7, width: 3.2, height: 1.4, rx: 0.4, fill: '#24375A' }));
      }
    }
    g.appendChild(keys);
    const mouse = proj(x + 2.6, y + 1.8, zd);
    g.appendChild(mk('ellipse', { cx: mouse[0], cy: mouse[1], rx: 1.6, ry: 1.1, fill: '#1A2740', stroke: '#2C4166', 'stroke-width': 0.4 }));

    const mug = proj(x + 3.4, y + 4, zd);
    const deskMug = mk('g', { class: 'deskmug' });
    deskMug.appendChild(mk('ellipse', { cx: mug[0], cy: mug[1] - 3, rx: 2.4, ry: 1.3, fill: '#C9D6EA' }));
    deskMug.appendChild(mk('rect', { x: mug[0] - 2.4, y: mug[1] - 6, width: 4.8, height: 4, rx: 1, fill: '#94A7C4' }));
    g.appendChild(deskMug);

    // сюда дрон кладёт то, что принёс
    const tp = proj(x + 0.4, y + 4.4, zd);
    const treat = mk('g', { class: 'treat', transform: `translate(${tp[0]} ${tp[1]}) scale(0.72)` });
    g.appendChild(treat);

    // человек поверх столешницы — кисти должны лежать на клавишах, а не под ними
    g.appendChild(wrap);

    // мониторы
    const mx = p[0] + 3, my = p[1] - 44;
    const lines = mk('g', { class: 'codelines' });
    if (exec) {
      const side = monitor(mx - 40, my + 8, 24, 18, agent.color, 3);
      g.appendChild(side.g);
      side.lines.setAttribute('class', '');
      lines.appendChild(side.lines);
    }
    const main = monitor(mx, my, exec ? 42 : 34, exec ? 29 : 24, agent.color, exec ? 6 : 5);
    g.appendChild(main.g);
    lines.appendChild(main.lines);
    g.appendChild(lines);

    if (exec) {
      // настольная лампа с тёплым светом
      const lp = proj(x + 4.4, y - 4.4, zd);
      g.appendChild(mk('rect', { x: lp[0] - 2.4, y: lp[1] - 1, width: 4.8, height: 1.6, rx: 0.8, fill: '#3A2E16' }));
      g.appendChild(mk('line', { x1: lp[0], y1: lp[1] - 1, x2: lp[0] + 3, y2: lp[1] - 12, stroke: '#C9A14A', 'stroke-width': 0.9 }));
      g.appendChild(mk('path', { d: `M ${lp[0] - 1} ${lp[1] - 12} l 8 0 l -2.6 5 l -3 0 z`, fill: '#C9A14A' }));
      g.appendChild(mk('ellipse', { cx: lp[0] + 3.4, cy: lp[1] - 5, rx: 6, ry: 3.4, fill: '#FFD98A', opacity: 0.18, filter: 'url(#softglow)' }));
      // табличка с должностью на торце стола
      const np = proj(x - 1, y + d - 0.4, zd);
      g.appendChild(mk('polygon', {
        points: pts([[np[0] - 13, np[1] + 1], [np[0] + 13, np[1] + 1], [np[0] + 13, np[1] + 6], [np[0] - 13, np[1] + 6]]),
        fill: '#2A2013', stroke: '#C9A14A', 'stroke-width': 0.6,
      }));
      const plate = mk('text', {
        x: np[0], y: np[1] + 5, fill: '#E8C978', 'font-size': 3.4, 'text-anchor': 'middle',
        'font-family': 'JetBrains Mono, monospace', 'letter-spacing': 0.4, 'font-weight': 700,
      });
      plate.textContent = agent.name.toUpperCase();
      g.appendChild(plate);
    }

    this.nodes.monitors[agent.id] = { g, lines, face: main.face, at: [mx + 17, my + 6], world: [x, y, zd] };
    this.nodes.figs[agent.id] = { fig, treat };

    // читаемый экран — проявляется, когда камера рядом
    const scr = document.createElement('div');
    scr.className = 'deskscreen';
    scr.dataset.agent = agent.id;
    scr.style.left = (mx + 17) + 'px';
    scr.style.top = (my + 12) + 'px';
    if (exec) { scr.style.width = '40px'; scr.style.height = '27px'; }
    scr.innerHTML = '<b></b><i></i>';
    this.overlay.appendChild(scr);
    this.nodes.screens[agent.id] = scr;

    // табличка с именем
    const tag = document.createElement('div');
    tag.className = 'atag' + (exec ? ' exec' : '');
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

  /* ================= бар, кухня и дроны-курьеры ================= */

  const LR = 152;           // как далеко островок стоит от кольца отделов
  const LH = 22;            // половина плиты островка
  const BAR = '#E0A03A';
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Отдельный островок: барная стойка, кофемашина, витрина со сладостями,
      холодильник с энергетиками, столики и док-станция дронов. */
  Office.buildLounge = function () {
    // ставим в самый «передний» промежуток между этажами — там ничего не закрывает
    const n = this.layout.length || 1;
    let best = null;
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
      const cx = Math.cos(a) * LR, cy = Math.sin(a) * LR;
      if (!best || cx + cy > best.cx + best.cy) best = { cx, cy };
    }
    const L = this.lounge = best;
    const g = mk('g', { 'data-lounge': '1', class: 'plate lounge', style: 'cursor:pointer' });

    // плита
    const N = proj(L.cx - LH, L.cy - LH), E = proj(L.cx + LH, L.cy - LH),
          S = proj(L.cx + LH, L.cy + LH), W = proj(L.cx - LH, L.cy + LH);
    const down = (q) => [q[0], q[1] + THICK];
    g.appendChild(mk('polygon', { points: pts([E, S, down(S), down(E)]), fill: mixDark(BAR, 0.72) }));
    g.appendChild(mk('polygon', { points: pts([S, W, down(W), down(S)]), fill: mixDark(BAR, 0.82) }));
    g.appendChild(mk('polygon', {
      points: pts([N, E, S, W]), fill: mixDark(BAR, 0.62),
      stroke: shade(BAR, 1.1), 'stroke-width': 1.2, opacity: 0.97,
    }));
    const ins = 4;
    g.appendChild(mk('polygon', {
      points: pts([
        proj(L.cx - LH + ins, L.cy - LH + ins), proj(L.cx + LH - ins, L.cy - LH + ins),
        proj(L.cx + LH - ins, L.cy + LH - ins), proj(L.cx - LH + ins, L.cy + LH - ins),
      ]),
      fill: mixDark(BAR, 0.5), opacity: 0.5,
    }));
    g.appendChild(floorLabel({ cx: L.cx, cy: L.cy, name: 'бар · кухня' }, BAR));

    // задняя полка с бутылками и банками
    g.appendChild(box(L.cx - 2, L.cy - 17, 26, 1.6, 21, 0, boxFills('#3A2A16', 0.3)));
    for (let i = 0; i < 11; i++) {
      const bx = L.cx - 13.5 + i * 2.5;
      const cols = ['#5ED6B4', '#E86FA8', '#7FC8F5', '#F0C24A', '#B58CF0'];
      const hgt = 3 + (i % 3) * 1.4;
      g.appendChild(box(bx, L.cy - 17, 1.6, 1.2, 11 + hgt, 11, boxFills(cols[i % cols.length], 0.18)));
    }
    g.appendChild(box(L.cx - 2, L.cy - 17, 26, 1.8, 11, 10.4, boxFills('#5A4226', 0.3)));

    // барная стойка
    g.appendChild(box(L.cx - 2, L.cy - 11, 26, 5, 9, 0, boxFills('#6B4A28', 0.32)));
    g.appendChild(box(L.cx - 2, L.cy - 11, 27.4, 6.2, 9.7, 9, boxFills('#C08A4A', 0.22)));
    g.appendChild(mk('polygon', {
      points: pts([proj(L.cx - 15, L.cy - 14.1, 9.72), proj(L.cx + 11, L.cy - 14.1, 9.72),
                   proj(L.cx + 11, L.cy - 7.9, 9.72), proj(L.cx - 15, L.cy - 7.9, 9.72)]),
      fill: '#E8C978', opacity: 0.12,
    }));

    // кофемашина: корпус, тёплое табло и поднимающийся пар
    g.appendChild(box(L.cx + 7, L.cy - 11, 4.4, 3.4, 16.4, 9.7, boxFills('#5A6A86', 0.3)));
    const cm = proj(L.cx + 7, L.cy - 9.3, 13);
    g.appendChild(mk('rect', { x: cm[0] - 4, y: cm[1] - 10, width: 8, height: 3, rx: 1, fill: '#FFC96B', opacity: 0.85 }));
    g.appendChild(mk('rect', { x: cm[0] - 2, y: cm[1] - 4, width: 4, height: 4, rx: 0.8, fill: '#0B1220' }));
    const steam = mk('g', { class: 'steam' });
    for (let i = 0; i < 3; i++) {
      steam.appendChild(mk('circle', {
        cx: cm[0] - 3 + i * 3, cy: cm[1] - 14, r: 1.8, fill: '#DCE8F8', opacity: 0.35,
        style: `animation-delay:${(i * 0.7).toFixed(1)}s`,
      }));
    }
    g.appendChild(steam);

    // витрина со сладостями
    g.appendChild(box(L.cx - 13, L.cy - 11, 5.6, 4, 15.4, 9.7, boxFills('#48606F', 0.34)));
    g.appendChild(faceY(L.cx - 13, L.cy - 9, 4.8, 14.8, 10.3, {
      fill: '#9FE0FF', opacity: 0.2, stroke: '#9FE0FF', 'stroke-width': 0.5, class: 'fridge',
    }));
    for (let i = 0; i < 3; i++) {
      const sp2 = proj(L.cx - 14.6 + i * 1.6, L.cy - 9, 11.4);
      const sweet = (i === 1 ? PAYLOAD.cake : PAYLOAD.donut)();
      sweet.setAttribute('transform', `translate(${sp2[0]} ${sp2[1]}) scale(0.6)`);
      g.appendChild(sweet);
    }

    // холодильник с энергетиками
    g.appendChild(box(L.cx + 15, L.cy - 12, 6, 5, 13, 0, boxFills('#243A52', 0.3)));
    g.appendChild(faceY(L.cx + 15, L.cy - 9.5, 5.2, 12.2, 1.4, {
      fill: '#5EE0FF', opacity: 0.16, stroke: '#5EE0FF', 'stroke-width': 0.6, class: 'fridge',
    }));
    for (let r = 0; r < 3; r++) {
      for (let c2 = 0; c2 < 4; c2++) {
        const cp = proj(L.cx + 13.2 + c2 * 1.2, L.cy - 9.5, 3 + r * 3.4);
        g.appendChild(mk('rect', {
          x: cp[0] - 1.4, y: cp[1] - 7, width: 2.8, height: 7, rx: 1.1,
          fill: ['#E86FA8', '#F0C24A', '#1FCBA0'][r], opacity: 0.9,
        }));
      }
    }

    // на стойке — чашки и сладости
    for (let i = 0; i < 5; i++) {
      const item = [PAYLOAD.coffee, PAYLOAD.donut, PAYLOAD.coffee, PAYLOAD.cake, PAYLOAD.energy][i]();
      const ip = proj(L.cx - 11 + i * 5, L.cy - 11.6, 9.7);
      item.setAttribute('transform', `translate(${ip[0]} ${ip[1]}) scale(1.15)`);
      g.appendChild(item);
    }

    // барные стулья: нога на крестовине и мягкое сиденье
    for (let i = 0; i < 4; i++) {
      const sx = L.cx - 11 + i * 6.5, sy = L.cy - 5.5;
      const fp = proj(sx, sy, 0);
      g.appendChild(mk('ellipse', { cx: fp[0], cy: fp[1] + 1, rx: 5, ry: 2.6, fill: '#03060C', opacity: 0.45 }));
      g.appendChild(mk('ellipse', { cx: fp[0], cy: fp[1], rx: 4.6, ry: 2.4, fill: '#3A414F' }));
      g.appendChild(box(sx, sy, 0.8, 0.8, 4.6, 0, boxFills('#8A94A6', 0.2)));
      const sp = proj(sx, sy, 4.6);
      g.appendChild(mk('ellipse', { cx: sp[0], cy: sp[1] + 2, rx: 7.4, ry: 4, fill: '#5A3016' }));
      g.appendChild(mk('ellipse', { cx: sp[0], cy: sp[1], rx: 7.4, ry: 4, fill: '#A8622E' }));
      g.appendChild(mk('ellipse', { cx: sp[0] - 1.4, cy: sp[1] - 0.8, rx: 3.4, ry: 1.7, fill: '#C9853F', opacity: 0.7 }));
    }

    // два столика с чашками
    for (const [tx, ty] of [[L.cx - 12, L.cy + 5], [L.cx + 1, L.cy + 12]]) {
      const fp = proj(tx, ty, 0);
      g.appendChild(mk('ellipse', { cx: fp[0], cy: fp[1] + 1, rx: 7, ry: 3.6, fill: '#03060C', opacity: 0.45 }));
      g.appendChild(mk('ellipse', { cx: fp[0], cy: fp[1], rx: 5.6, ry: 3, fill: '#3A414F' }));
      g.appendChild(box(tx, ty, 1.1, 1.1, 4.2, 0, boxFills('#8A94A6', 0.2)));
      const tp = proj(tx, ty, 4.2);
      g.appendChild(mk('ellipse', { cx: tp[0], cy: tp[1] + 2.2, rx: 11, ry: 6, fill: '#5A4226' }));
      g.appendChild(mk('ellipse', { cx: tp[0], cy: tp[1], rx: 11, ry: 6, fill: '#C08A4A' }));
      const cup = PAYLOAD.coffee();
      cup.setAttribute('transform', `translate(${tp[0] + 3.4} ${tp[1] - 0.6}) scale(1)`);
      g.appendChild(cup);
      const plate = PAYLOAD.donut();
      plate.setAttribute('transform', `translate(${tp[0] - 4.4} ${tp[1] + 1.4}) scale(0.9)`);
      g.appendChild(plate);
    }

    // док-станция: отсюда дроны вылетают и сюда же возвращаются
    const dock = this.dock = { x: L.cx + 12, y: L.cy + 9 };
    g.appendChild(box(dock.x, dock.y, 11, 9, 1, 0, boxFills('#2A3550', 0.3)));
    for (let i = 0; i < 3; i++) {
      const pd = proj(dock.x - 3.6 + i * 3.6, dock.y, 1);
      g.appendChild(mk('ellipse', { cx: pd[0], cy: pd[1], rx: 7, ry: 4, fill: 'none', stroke: '#5EE0FF', 'stroke-width': 0.7, opacity: 0.45 }));
      g.appendChild(mk('ellipse', {
        cx: pd[0], cy: pd[1], rx: 3, ry: 1.7, fill: '#5EE0FF', opacity: 0.6, class: 'pad',
        style: `animation-delay:${(i * 0.5).toFixed(1)}s`,
      }));
    }
    // два курьера всегда стоят на зарядке — док не выглядит пустым
    for (const [i, kind] of [[0, 'coffee'], [2, 'donut']]) {
      const pd = proj(dock.x - 3.6 + i * 3.6, dock.y, 1);
      const idle = buildDrone(kind);
      idle.setAttribute('transform', `translate(${pd[0]} ${pd[1] - 9}) scale(0.9)`);
      g.appendChild(idle);
    }
    const dl = proj(dock.x, dock.y + 5, 1);
    const dtext = mk('text', {
      fill: '#5EE0FF', opacity: 0.6, 'font-size': 4.4, 'font-family': 'JetBrains Mono, monospace',
      'letter-spacing': 1, 'text-anchor': 'middle',
      transform: `translate(${dl[0]} ${dl[1]}) matrix(0.866 0.5 -0.866 0.5 0 0)`,
    });
    dtext.textContent = 'ДОК КУРЬЕРОВ';
    g.appendChild(dtext);

    // вывеска над баром
    const sign = document.createElement('div');
    sign.className = 'brain-label bar-label';
    sign.dataset.lounge = '1';
    const sp = proj(L.cx - 2, L.cy - 17, 22);
    sign.style.left = sp[0] + 'px';
    sign.style.top = sp[1] + 'px';
    sign.innerHTML = '<b>БАР · КУХНЯ</b><span>кофе · энергетики · перекус</span>';
    this.overlay.appendChild(sign);

    return g;
  };

  /* ---------- дроны ---------- */

  /** Робот-курьер: корпус, винты, трос и поднос с заказом. */
  function buildDrone(kind) {
    const outer = mk('g', { class: 'drone' });
    // отдельный слой масштаба: на .drone-body висит CSS-анимация зависания,
    // и свой transform она бы затёрла
    const scaler = mk('g', { class: 'drone-scale' });
    const inner = mk('g', { class: 'drone-body' });
    for (const s2 of [-1, 1]) {
      inner.appendChild(mk('line', {
        x1: s2 * 3.6, y1: -1.4, x2: s2 * 8, y2: -4.4, stroke: '#6E86B4', 'stroke-width': 0.8,
      }));
      inner.appendChild(mk('ellipse', {
        cx: s2 * 8, cy: -4.6, rx: 4.4, ry: 1.1, fill: '#9FC0F0', opacity: 0.5, class: 'rotor',
      }));
      inner.appendChild(mk('circle', { cx: s2 * 8, cy: -4.6, r: 0.8, fill: '#6E86B4' }));
    }
    inner.appendChild(mk('rect', {
      x: -5.4, y: -3.2, width: 10.8, height: 5.6, rx: 2.6,
      fill: '#33405C', stroke: '#7E96C4', 'stroke-width': 0.6,
    }));
    inner.appendChild(mk('rect', { x: -3.4, y: -2, width: 6.8, height: 2.2, rx: 1.1, fill: '#0B1220', opacity: 0.8 }));
    inner.appendChild(mk('circle', { cx: 0, cy: -0.9, r: 1, fill: '#9CD8FF', class: 'eye' }));
    inner.appendChild(mk('ellipse', { cx: 0, cy: 3, rx: 9, ry: 4, fill: '#7FC8F5', opacity: 0.1, filter: 'url(#softglow)' }));
    inner.appendChild(mk('line', { x1: 0, y1: 2.4, x2: 0, y2: 6.4, stroke: '#6E86B4', 'stroke-width': 0.5 }));
    const tray = mk('g', { transform: 'translate(0,7.6)' });
    tray.appendChild(mk('ellipse', { cx: 0, cy: 0.8, rx: 5, ry: 1.6, fill: '#2A3550', stroke: '#7E96C4', 'stroke-width': 0.5 }));
    const item = PAYLOAD[kind]();
    item.setAttribute('transform', 'translate(0,0.4) scale(0.8)');
    tray.appendChild(item);
    inner.appendChild(tray);
    scaler.appendChild(inner);
    outer.appendChild(scaler);
    return outer;
  }

  /** Отправить курьера к сотруднику: взлёт, полёт по дуге, выдача, возврат. */
  Office.sendDrone = function (agentId) {
    const mon = this.nodes.monitors[agentId];
    if (!mon || !this.dock || !this.gAir) return;
    const kind = PAYLOAD_KEYS[Math.floor(Math.random() * PAYLOAD_KEYS.length)];
    const [ax, ay, az] = mon.world;

    const P0 = proj(this.dock.x, this.dock.y, 2);
    const P1 = proj(this.dock.x, this.dock.y, 20);
    const P2 = proj(ax - 1, ay - 5, 20);
    const P3 = proj(ax - 1, ay - 5, az + 11);
    const arc = (a, b) => [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 70];
    const out = `M ${P0} L ${P1} Q ${arc(P1, P2)} ${P2} L ${P3}`;
    const back = `M ${P3} L ${P2} Q ${arc(P2, P1)} ${P1} L ${P0}`;

    const g = buildDrone(kind);
    g.querySelector('.drone-scale').setAttribute('transform', 'scale(1.35)');
    this.gAir.appendChild(g);
    this.droneCount = (this.droneCount || 0) + 1;
    const fly = (d, dur) => {
      const m = mk('animateMotion', { path: d, dur: `${dur}s`, fill: 'freeze', rotate: '0' });
      g.appendChild(m);
      return m;
    };
    const first = fly(out, 2.8);

    const later = (ms, fn) => setTimeout(() => { if (g.isConnected) fn(); }, ms);
    later(2850, () => {
      this.deliver(agentId, kind);
      later(1400, () => {
        first.remove();
        fly(back, 2.6);
        later(2700, () => { g.remove(); this.droneCount = Math.max(0, this.droneCount - 1); });
      });
    });
  };

  /** Заказ приехал: предмет появляется на столе, следом сотрудник делает глоток. */
  Office.deliver = function (agentId, kind) {
    const f = this.nodes.figs[agentId];
    if (!f) return;
    f.treat.textContent = '';
    const item = PAYLOAD[kind]();
    item.setAttribute('class', 'pop');
    f.treat.appendChild(item);
    clearTimeout(f.clearTimer);
    f.clearTimer = setTimeout(() => { if (f.treat.isConnected) f.treat.textContent = ''; }, 26000);
    setTimeout(() => this.sip(agentId), 1600);
  };

  /** Короткий глоток: рука с кружкой поднимается к голове. */
  Office.sip = function (agentId) {
    const f = this.nodes.figs[agentId];
    if (!f || f.fig.classList.contains('sipping')) return;
    f.fig.classList.add('sipping');
    setTimeout(() => f.fig.classList.remove('sipping'), 2600);
  };

  /** Жизнь бара: пока кто-то работает, курьеры возят заказы, а люди — пьют кофе. */
  Office.tickLounge = function () {
    if (!this.lounge || reduced() || document.hidden) return;
    const ids = [...this.agents.map((a) => a.id), ...(this.core || []).map((a) => a.id)];
    const busy = ids.filter((id) => this.statsOf(id).active > 0);

    if (busy.length && Math.random() < 0.5) this.sip(busy[Math.floor(Math.random() * busy.length)]);
    else if (Math.random() < 0.12 && ids.length) this.sip(ids[Math.floor(Math.random() * ids.length)]);

    if ((this.droneCount || 0) >= 3) return;
    const pool = busy.length ? busy : ids;
    if (!pool.length) return;
    if (!busy.length && Math.random() > 0.3) return;   // в тишине летают редко
    const id = pool[Math.floor(Math.random() * pool.length)];
    const now = Date.now();
    if (now - (this.lastServed[id] || 0) < 22000) return;
    this.lastServed[id] = now;
    this.sendDrone(id);
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

    const boards = this.nodes.boards;
    if (boards) {
      const t = this.state.tasks || [];
      const queued = t.filter((x) => x.status === 'queued' || x.status === 'routing').length;
      boards.queue.forEach((bar, i) => bar.setAttribute('opacity', i < queued ? 0.95 : 0.16));
      const ok = t.filter((x) => x.review?.verdict === 'ok').length;
      const rw = t.filter((x) => x.review?.verdict === 'rework').length;
      boards.ok.setAttribute('opacity', ok ? 0.95 : 0.2);
      boards.rework.setAttribute('opacity', rw ? 0.95 : 0.2);
      boards.okText.textContent = String(ok);
      boards.rwText.textContent = String(rw);
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
    if (this.lounge) {
      const bar = mk('circle', {
        cx: 60 + this.lounge.cx * 0.45, cy: 60 + this.lounge.cy * 0.45, r: 5,
        fill: mixDark(BAR, 0.35), stroke: BAR, 'stroke-width': 1.2, style: 'cursor:pointer',
      });
      bar.addEventListener('click', () => this.focusLounge());
      const bt = mk('title');
      bt.textContent = 'Бар · кухня';
      bar.appendChild(bt);
      svg.appendChild(bar);
    }
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
    // кадр должен вмещать и кольцо отделов, и вынесенный вперёд бар
    const s = Math.min(1, Math.max(0.24, Math.min(r.width / 2060, r.height / 1620)));
    const cy = ORIGIN.y + 120;
    if (instant) {
      this.view.scale = s;
      this.view.tx = r.width / 2 - ORIGIN.x * s;
      this.view.ty = r.height / 2 - cy * s;
      this.applyView();
    } else this.flyTo(ORIGIN.x, cy, s);
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

  Office.focusLounge = function () {
    if (!this.lounge) return;
    this.focusedBlock = null;
    this.focusedAgent = null;
    this.world.classList.remove('focused');
    Object.values(this.nodes.plates).forEach((g) => g.classList.remove('on'));
    Object.values(this.nodes.cards).forEach((c) => c.classList.remove('focused'));
    Object.values(this.nodes.tags).forEach((t) => t.classList.remove('on'));
    Object.values(this.nodes.screens).forEach((s) => s.classList.remove('on'));
    document.getElementById('agentPanel').hidden = true;
    const [wx, wy] = proj(this.lounge.cx, this.lounge.cy);
    this.flyTo(wx, wy + 4, 1.6);
    this.showBar('Бар · кухня · дроны-курьеры');
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
      if (src.closest('[data-lounge]')) return this.focusLounge();
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
