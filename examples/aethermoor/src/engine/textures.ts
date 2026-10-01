// Процедурные текстуры на canvas: камень, дерево, трава, ковры, витражи, знамёна.
// Никаких внешних ассетов — всё генерируется при запуске и кешируется.
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

function noiseFill(ctx: CanvasRenderingContext2D, w: number, h: number, base: [number, number, number], amp: number, r: () => number, alpha = 1): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amp;
    d[i] = Math.max(0, Math.min(255, d[i] * (1 - alpha) + (base[0] + n) * alpha));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * (1 - alpha) + (base[1] + n) * alpha));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * (1 - alpha) + (base[2] + n) * alpha));
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], r: () => number, size = 2): void {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = size * (0.5 + r());
    ctx.fillRect(r() * w, r() * h, s, s);
  }
}

function finish(c: HTMLCanvasElement, key: string, repeat = 1, srgb = true): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

export type WallStyle = 'castle' | 'dungeon' | 'ruins' | 'library' | 'tower' | 'village' | 'sanctum' | 'hedge';

const WALL_COLORS: Record<WallStyle, { base: [number, number, number]; mortar: string; tint: string[] }> = {
  castle: { base: [148, 134, 112], mortar: '#4a4036', tint: ['#a8977a', '#8c7a62', '#b5a283', '#7d6d58'] },
  library: { base: [132, 112, 92], mortar: '#3a2e24', tint: ['#9a8470', '#86705a', '#a89078'] },
  tower: { base: [120, 116, 128], mortar: '#38343e', tint: ['#8a8698', '#7a7488', '#9a96a6'] },
  dungeon: { base: [78, 76, 82], mortar: '#1e1c22', tint: ['#5a5860', '#4a4850', '#66646c'] },
  ruins: { base: [110, 108, 92], mortar: '#2e3026', tint: ['#7a8064', '#6a6e54', '#8a8a70', '#5a6a48'] },
  village: { base: [150, 128, 100], mortar: '#5a4630', tint: ['#b09070', '#9a7a5a', '#c0a080'] },
  sanctum: { base: [46, 52, 70], mortar: '#0e1018', tint: ['#3a4260', '#2e3450', '#46507a'] },
  hedge: { base: [44, 78, 46], mortar: '#1a2e1a', tint: ['#3a6a3a', '#2e5a32', '#4a7a44'] },
};

export function wallTexture(style: WallStyle): THREE.Texture {
  const key = 'wall_' + style;
  if (cache.has(key)) return cache.get(key)!;
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  const r = rng(style.length * 977 + 13);
  const pal = WALL_COLORS[style];
  noiseFill(ctx, W, H, pal.base, 26, r);
  if (style === 'hedge') {
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = pal.tint[Math.floor(r() * pal.tint.length)];
      ctx.beginPath();
      ctx.ellipse(r() * W, r() * H, 3 + r() * 6, 2 + r() * 4, r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    speckle(ctx, W, H, 300, ['#1a2a18', '#5a8a4a'], r, 2);
    return finish(c, key);
  }
  // кладка: ряды блоков со смещением
  const rows = 6;
  const rh = H / rows;
  ctx.fillStyle = pal.mortar;
  for (let y = 0; y < rows; y++) {
    const offset = (y % 2) * 0.5;
    const n = 3;
    for (let x = -1; x < n + 1; x++) {
      const bw = W / n;
      const bx = (x + offset) * bw;
      const by = y * rh;
      ctx.fillStyle = pal.tint[Math.floor(r() * pal.tint.length)];
      ctx.globalAlpha = 0.55;
      ctx.fillRect(bx + 2, by + 2, bw - 4, rh - 4);
      ctx.globalAlpha = 1;
      // светлая кромка сверху, тень снизу
      ctx.fillStyle = 'rgba(255,240,210,0.10)';
      ctx.fillRect(bx + 2, by + 2, bw - 4, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(bx + 2, by + rh - 5, bw - 4, 3);
      ctx.strokeStyle = pal.mortar;
      ctx.lineWidth = 3;
      ctx.strokeRect(bx + 1, by + 1, bw - 2, rh - 2);
    }
  }
  speckle(ctx, W, H, 1400, ['rgba(0,0,0,0.25)', 'rgba(255,255,255,0.08)'], r, 2);
  if (style === 'ruins' || style === 'dungeon') {
    // мох и подтёки
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = style === 'ruins' ? 'rgba(70,110,50,0.35)' : 'rgba(40,60,50,0.3)';
      const x = r() * W;
      ctx.fillRect(x, 0, 2 + r() * 4, r() * H * 0.6);
    }
  }
  return finish(c, key);
}

export function wallTopTexture(): THREE.Texture {
  const key = 'walltop';
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = canvas(64, 64);
  const r = rng(5);
  noiseFill(ctx, 64, 64, [58, 52, 46], 20, r);
  return finish(c, key);
}

export type FloorStyle =
  | 'stone' | 'flag' | 'wood' | 'carpet' | 'grass' | 'dirt' | 'cobble' | 'sand' | 'dungeon' | 'ruins' | 'sanctum' | 'snow' | 'marble';

export function floorTexture(style: FloorStyle): THREE.Texture {
  const key = 'floor_' + style;
  if (cache.has(key)) return cache.get(key)!;
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  const r = rng(style.length * 131 + 7);
  switch (style) {
    case 'stone':
    case 'flag':
    case 'dungeon':
    case 'ruins':
    case 'sanctum':
    case 'marble': {
      const base: [number, number, number] =
        style === 'dungeon' ? [70, 68, 72] : style === 'ruins' ? [104, 104, 88] : style === 'sanctum' ? [40, 46, 64]
          : style === 'marble' ? [176, 166, 150] : [124, 114, 98];
      noiseFill(ctx, W, H, base, 22, r);
      const n = style === 'flag' || style === 'marble' ? 2 : 4;
      const s = W / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const v = (r() - 0.5) * 30;
        ctx.fillStyle = `rgba(${base[0] + v},${base[1] + v},${base[2] + v},0.6)`;
        ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
        ctx.strokeStyle = 'rgba(20,16,12,0.55)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x * s + 1, y * s + 1, s - 2, s - 2);
      }
      if (style === 'marble') {
        ctx.strokeStyle = 'rgba(90,80,70,0.25)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 14; i++) {
          ctx.beginPath();
          let x = r() * W, y = r() * H;
          ctx.moveTo(x, y);
          for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; ctx.lineTo(x, y); }
          ctx.stroke();
        }
      }
      if (style === 'ruins') speckle(ctx, W, H, 400, ['rgba(70,110,50,0.5)', 'rgba(50,80,40,0.5)'], r, 3);
      if (style === 'sanctum') speckle(ctx, W, H, 200, ['rgba(120,160,255,0.35)'], r, 1.5);
      speckle(ctx, W, H, 1600, ['rgba(0,0,0,0.18)', 'rgba(255,255,255,0.06)'], r, 2);
      break;
    }
    case 'wood': {
      noiseFill(ctx, W, H, [104, 70, 44], 18, r);
      const planks = 5;
      const ph = H / planks;
      for (let i = 0; i < planks; i++) {
        const v = (r() - 0.5) * 30;
        ctx.fillStyle = `rgba(${110 + v},${74 + v * 0.7},${46 + v * 0.5},0.75)`;
        ctx.fillRect(0, i * ph + 1, W, ph - 2);
        ctx.strokeStyle = 'rgba(40,24,12,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-2, i * ph, W + 4, ph);
        const cut = r() * W;
        ctx.beginPath(); ctx.moveTo(cut, i * ph); ctx.lineTo(cut, (i + 1) * ph); ctx.stroke();
        ctx.strokeStyle = 'rgba(60,36,20,0.25)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 6; k++) {
          ctx.beginPath();
          const y = i * ph + r() * ph;
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 6, W * 0.6, y + (r() - 0.5) * 6, W, y);
          ctx.stroke();
        }
      }
      break;
    }
    case 'carpet': {
      noiseFill(ctx, W, H, [118, 28, 34], 14, r);
      ctx.strokeStyle = 'rgba(220,170,80,0.55)';
      ctx.lineWidth = 6;
      ctx.strokeRect(14, -10, W - 28, H + 20);
      ctx.lineWidth = 2;
      ctx.strokeRect(26, -10, W - 52, H + 20);
      ctx.fillStyle = 'rgba(220,170,80,0.35)';
      for (let y = 0; y < H; y += 64) {
        ctx.beginPath();
        ctx.moveTo(W / 2, y + 12); ctx.lineTo(W / 2 + 22, y + 32); ctx.lineTo(W / 2, y + 52); ctx.lineTo(W / 2 - 22, y + 32);
        ctx.closePath(); ctx.fill();
      }
      speckle(ctx, W, H, 2000, ['rgba(0,0,0,0.12)', 'rgba(255,200,200,0.05)'], r, 1.5);
      break;
    }
    case 'grass': {
      noiseFill(ctx, W, H, [62, 88, 48], 26, r);
      for (let i = 0; i < 2600; i++) {
        const g = 70 + r() * 70;
        ctx.strokeStyle = `rgba(${30 + r() * 40},${g},${30 + r() * 20},0.7)`;
        ctx.lineWidth = 1;
        const x = r() * W, y = r() * H;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 5); ctx.stroke();
      }
      speckle(ctx, W, H, 60, ['#d8d070', '#e8e8f0', '#c070a0'], r, 2);
      break;
    }
    case 'dirt': {
      noiseFill(ctx, W, H, [108, 84, 58], 30, r);
      speckle(ctx, W, H, 1200, ['rgba(60,44,30,0.5)', 'rgba(160,130,100,0.4)', 'rgba(90,80,70,0.6)'], r, 3);
      break;
    }
    case 'cobble': {
      noiseFill(ctx, W, H, [96, 92, 86], 18, r);
      for (let i = 0; i < 90; i++) {
        const v = 80 + r() * 60;
        ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
        ctx.beginPath();
        ctx.ellipse(r() * W, r() * H, 10 + r() * 10, 8 + r() * 8, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(30,26,22,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    }
    case 'sand': {
      noiseFill(ctx, W, H, [176, 160, 120], 22, r);
      speckle(ctx, W, H, 800, ['rgba(120,100,70,0.4)', 'rgba(240,230,200,0.4)'], r, 1.5);
      break;
    }
    case 'snow': {
      noiseFill(ctx, W, H, [226, 232, 240], 12, r);
      speckle(ctx, W, H, 500, ['rgba(180,195,215,0.5)', 'rgba(255,255,255,0.8)'], r, 2);
      break;
    }
  }
  return finish(c, key);
}

export function waterNormal(): THREE.Texture {
  const key = 'water_n';
  if (cache.has(key)) return cache.get(key)!;
  const W = 128;
  const [c, ctx] = canvas(W, W);
  const img = ctx.createImageData(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const nx = Math.sin((x / W) * Math.PI * 6 + Math.sin((y / W) * Math.PI * 4) * 1.5) * 0.5;
    const ny = Math.cos((y / W) * Math.PI * 6 + Math.cos((x / W) * Math.PI * 2) * 1.2) * 0.5;
    const i = (y * W + x) * 4;
    img.data[i] = 128 + nx * 90;
    img.data[i + 1] = 128 + ny * 90;
    img.data[i + 2] = 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, key, 1, false);
}

export function bookshelfTexture(): THREE.Texture {
  const key = 'books';
  if (cache.has(key)) return cache.get(key)!;
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  const r = rng(77);
  ctx.fillStyle = '#3a2416';
  ctx.fillRect(0, 0, W, H);
  const shelves = 4;
  const sh = H / shelves;
  const colors = ['#7a2a24', '#2a4a6a', '#3a5a2a', '#6a4a1a', '#4a2a5a', '#8a6a2a', '#2a2a2a', '#5a1a1a', '#1a3a4a'];
  for (let s = 0; s < shelves; s++) {
    let x = 6;
    while (x < W - 8) {
      const bw = 6 + r() * 12;
      const bh = sh * (0.6 + r() * 0.3);
      ctx.fillStyle = colors[Math.floor(r() * colors.length)];
      ctx.fillRect(x, s * sh + sh - bh - 6, bw, bh);
      ctx.fillStyle = 'rgba(230,200,120,0.5)';
      ctx.fillRect(x + 1, s * sh + sh - bh + 4, bw - 2, 2);
      ctx.fillRect(x + 1, s * sh + sh - 16, bw - 2, 2);
      x += bw + 1;
      if (r() < 0.06) x += 10;
    }
    ctx.fillStyle = '#24160c';
    ctx.fillRect(0, s * sh + sh - 6, W, 6);
  }
  ctx.strokeStyle = '#24160c';
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, W, H);
  return finish(c, key);
}

export function windowTexture(): THREE.Texture {
  const key = 'window';
  if (cache.has(key)) return cache.get(key)!;
  const W = 128, H = 256;
  const [c, ctx] = canvas(W, H);
  const r = rng(9);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  // стрельчатое окно с витражом
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(10, H);
  ctx.lineTo(10, 70);
  ctx.quadraticCurveTo(W / 2, -20, W - 10, 70);
  ctx.lineTo(W - 10, H);
  ctx.closePath();
  ctx.clip();
  const pal = ['#f0d080', '#80b0f0', '#f08060', '#a0e0a0', '#e0e0f8', '#d0a0f0'];
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = pal[Math.floor(r() * pal.length)];
    ctx.globalAlpha = 0.5 + r() * 0.5;
    ctx.fillRect(r() * W, r() * H, 18 + r() * 20, 18 + r() * 20);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  for (let y = 40; y < H; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let x = 10; x < W; x += 22) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#1a140e';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(10, H); ctx.lineTo(10, 70); ctx.quadraticCurveTo(W / 2, -20, W - 10, 70); ctx.lineTo(W - 10, H);
  ctx.stroke();
  return finish(c, key);
}

export function bannerTexture(color: string, trim: string, sigil: number): THREE.Texture {
  const key = `banner_${color}_${sigil}`;
  if (cache.has(key)) return cache.get(key)!;
  const W = 128, H = 256;
  const [c, ctx] = canvas(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H - 40); ctx.lineTo(W / 2, H); ctx.lineTo(0, H - 40); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = trim;
  ctx.strokeStyle = trim;
  ctx.lineWidth = 5;
  const cx = W / 2, cy = 110;
  ctx.beginPath();
  if (sigil === 0) { // пламя
    ctx.moveTo(cx, cy - 40); ctx.quadraticCurveTo(cx + 30, cy, cx + 14, cy + 34); ctx.quadraticCurveTo(cx, cy + 10, cx - 14, cy + 34);
    ctx.quadraticCurveTo(cx - 30, cy, cx, cy - 40); ctx.fill();
  } else if (sigil === 1) { // щит-бастион
    ctx.moveTo(cx - 28, cy - 30); ctx.lineTo(cx + 28, cy - 30); ctx.lineTo(cx + 24, cy + 10); ctx.lineTo(cx, cy + 36); ctx.lineTo(cx - 24, cy + 10);
    ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 26); ctx.lineTo(cx, cy + 30); ctx.stroke();
  } else if (sigil === 2) { // дерево-корень
    ctx.moveTo(cx, cy + 36); ctx.lineTo(cx, cy - 10); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - 18, 22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy + 30); ctx.lineTo(cx - 18, cy + 40); ctx.moveTo(cx, cy + 30); ctx.lineTo(cx + 18, cy + 40); ctx.stroke();
  } else { // звезда
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? 38 : 12;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }
  const t = finish(c, key);
  return t;
}

export function glowTexture(): THREE.Texture {
  const key = 'glow';
  if (cache.has(key)) return cache.get(key)!;
  const W = 64;
  const [c, ctx] = canvas(W, W);
  const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);
  return finish(c, key, 1, false);
}

export function runeCircleTexture(color = '#e3c46b'): THREE.Texture {
  const key = 'runecircle_' + color;
  if (cache.has(key)) return cache.get(key)!;
  const W = 256;
  const [c, ctx] = canvas(W, W);
  ctx.clearRect(0, 0, W, W);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(W / 2, W / 2, 118, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W / 2, W / 2, 96, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, W / 2, 50, 0, Math.PI * 2); ctx.stroke();
  ctx.font = 'bold 20px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    ctx.save();
    ctx.translate(W / 2 + Math.cos(a) * 107, W / 2 + Math.sin(a) * 107);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(glyphs[i % glyphs.length], 0, 0);
    ctx.restore();
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = ((i + 2) / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 + Math.cos(a) * 96, W / 2 + Math.sin(a) * 96);
    ctx.lineTo(W / 2 + Math.cos(b) * 96, W / 2 + Math.sin(b) * 96);
    ctx.stroke();
  }
  return finish(c, key, 1);
}

export function telegraphTexture(): THREE.Texture {
  const key = 'telegraph';
  if (cache.has(key)) return cache.get(key)!;
  const W = 128;
  const [c, ctx] = canvas(W, W);
  const g = ctx.createRadialGradient(W / 2, W / 2, W * 0.3, W / 2, W / 2, W / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.15)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.95, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); ctx.fill();
  return finish(c, key, 1, false);
}

export function signTexture(text: string): THREE.Texture {
  const key = 'sign_' + text;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = canvas(256, 96);
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#2a1a0a';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 90);
  ctx.fillStyle = '#f0d8a0';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 50, 236);
  return finish(c, key);
}
