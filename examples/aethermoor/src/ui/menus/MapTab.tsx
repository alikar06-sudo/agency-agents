import { useEffect, useRef, useState } from 'react';
import { useGame, G } from '@/state/store';
import { ZONES } from '@/data/zones';
import type { ZoneId } from '@/data/types';
import { checkAll } from '@/systems/logic';
import { waypoints } from '@/systems/quests';
import { engine, decodeBits } from '@/engine/Engine';
import { npcsInZone } from '@/systems/schedule';
import { NPCS } from '@/data/npcs';
import { TS } from '@/engine/world';
import { buildZone } from '@/engine/world';

function links(): [ZoneId, ZoneId][] {
  const out: [ZoneId, ZoneId][] = [];
  for (const z of Object.keys(ZONES) as ZoneId[]) {
    for (const m of Object.values(ZONES[z].markers)) {
      if (m.kind === 'exit' && m.to && z < m.to && !out.some(([a, b]) => a === z && b === m.to)) out.push([z, m.to]);
    }
  }
  return out;
}

const minimapCache = new Map<ZoneId, HTMLCanvasElement>();
function zoneMinimap(z: ZoneId): HTMLCanvasElement {
  if (engine.zone?.def.id === z) return engine.zone.minimap;
  let c = minimapCache.get(z);
  if (!c) {
    const built = buildZone(ZONES[z], { snow: false });
    c = built.minimap;
    built.dispose();
    minimapCache.set(z, c);
  }
  return c;
}

export function MapTab() {
  const here = useGame((s) => s.g!.pos.zone);
  const visited = useGame((s) => s.g!.visited);
  const [sel, setSel] = useState<ZoneId>(here);
  const cv = useRef<HTMLCanvasElement>(null);
  const targets = new Set(waypoints(false).map((w) => w.where.zone));

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const def = ZONES[sel];
    const src = visited.includes(sel) ? zoneMinimap(sel) : null;
    const w = Math.max(...def.map.map((r) => r.length)), h = def.map.length;
    const S = 4, K = 3;
    c.width = w * S * K; c.height = h * S * K;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a090e';
    ctx.fillRect(0, 0, c.width, c.height);
    if (!src) { ctx.fillStyle = '#6a6058'; ctx.font = '28px Georgia'; ctx.textAlign = 'center'; ctx.fillText('Вы здесь ещё не бывали', c.width / 2, c.height / 2); return; }
    ctx.drawImage(src, 0, 0, c.width, c.height);
    const bits = decodeBits(G().explored[sel], w * h);
    ctx.fillStyle = 'rgba(10,9,14,0.93)';
    for (let i = 0; i < w * h; i++) if (!(bits[i >> 3] & (1 << (i & 7)))) ctx.fillRect((i % w) * S * K, Math.floor(i / w) * S * K, S * K, S * K);
    const pt = (x: number, z: number) => [(x / TS) * S * K, (z / TS) * S * K];
    // подписи выходов и важных мест
    def.map.forEach((row, r) => {
      for (let col = 0; col < row.length; col++) {
        const m = def.markers[row[col]];
        if (!m) continue;
        const x = col * S * K + S * K / 2, y = r * S * K + S * K / 2;
        if (m.kind === 'exit') {
          ctx.fillStyle = '#e3c46b'; ctx.fillRect(x - 6, y - 6, 12, 12);
          ctx.font = 'bold 22px Georgia'; ctx.fillStyle = '#f5dc95';
          const label = m.label ?? ZONES[m.to!]?.name ?? '';
          const tw = ctx.measureText(label).width;
          // подпись не выходит за края плана
          const lx = Math.max(tw / 2 + 4, Math.min(c.width - tw / 2 - 4, x));
          const ly = y - 14 < 24 ? y + 34 : y - 14;
          ctx.textAlign = 'center';
          ctx.fillText(label, lx, ly);
        } else if (m.kind === 'waystone') { ctx.fillStyle = '#8ad8ff'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); }
        else if (m.kind === 'station' || m.kind === 'board' || m.kind === 'bed') { ctx.fillStyle = '#c8a8ff'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); }
      }
    });
    if (sel === here) {
      const placed: [number, number, number][] = [];
      for (const n of engine.npcs.list) {
        const [x, y] = pt(n.x, n.z);
        ctx.fillStyle = n.mark ? '#ffd34a' : '#e8e0d0';
        ctx.beginPath(); ctx.arc(x, y, n.mark ? 8 : 6, 0, Math.PI * 2); ctx.fill();
        ctx.font = '18px Georgia'; ctx.fillStyle = '#e8e0d0'; ctx.textAlign = 'center';
        const name = n.def.name.split(' ')[0];
        const tw = ctx.measureText(name).width;
        // разводим подписи стоящих рядом NPC
        let ly = y + 24;
        while (placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + tw) / 2 + 4 && Math.abs(py - ly) < 20)) ly += 20;
        placed.push([x, ly, tw]);
        ctx.fillText(name, x, ly);
      }
      const [px, pz] = pt(engine.player.x, engine.player.z);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e3c46b'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(px, pz, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    for (const wp of waypoints(true)) {
      if (wp.where.zone !== sel || !wp.where.marker) continue;
      def.map.forEach((row, r) => {
        for (let col = 0; col < row.length; col++) {
          const m = def.markers[row[col]];
          if (m && m.id === wp.where.marker) {
            ctx.save(); ctx.translate(col * S * K + S * K / 2, r * S * K + S * K / 2); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = '#ffd34a'; ctx.shadowColor = '#ffb000'; ctx.shadowBlur = 16; ctx.fillRect(-10, -10, 20, 20); ctx.restore();
          }
        }
      });
    }
  }, [sel, here, visited]);

  const people = npcsInZone(sel).filter((l) => G().flags[`met_${l.npc}`]);
  return (
    <div className="cols two">
      <div className="col">
        <div className="h3">Долина Этер</div>
        <div className="world-map">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="wm-glow"><stop offset="0%" stopColor="#ffd34a" stopOpacity="0.8" /><stop offset="100%" stopColor="#ffd34a" stopOpacity="0" /></radialGradient>
            </defs>
            <path d="M5 70 Q20 55 30 62 T55 58 T80 66 T98 60" stroke="#2a3a2a" strokeWidth="9" fill="none" opacity="0.6" />
            <ellipse cx="16" cy="68" rx="13" ry="8" fill="#1a3040" opacity="0.8" />
            {links().map(([a, b]) => {
              const A = ZONES[a].mapPos, B = ZONES[b].mapPos;
              return <line key={a + b} x1={A[0] * 100} y1={A[1] * 100} x2={B[0] * 100} y2={B[1] * 100} stroke="#6a5a3a" strokeWidth="0.6" strokeDasharray="1.5 1" />;
            })}
            {(Object.keys(ZONES) as ZoneId[]).map((z) => {
              const d = ZONES[z];
              const [x, y] = d.mapPos;
              const known = visited.includes(z);
              const locked = d.unlock && !checkAll(d.unlock);
              return (
                <g key={z} transform={`translate(${x * 100} ${y * 100})`} style={{ cursor: 'pointer' }} onClick={() => setSel(z)}>
                  {targets.has(z) && <circle r="6" fill="url(#wm-glow)" />}
                  <circle r={sel === z ? 3.2 : 2.4} fill={z === here ? '#ffffff' : known ? '#e3c46b' : locked ? '#4a3a3a' : '#7a6a4a'} stroke="#000" strokeWidth="0.4" />
                  <text y="-4" textAnchor="middle" fontSize="3" fill={known ? '#f5dc95' : '#8a7a5a'} style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>{known || !locked ? d.name : '???'}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="faint" style={{ fontSize: 13, marginTop: 6 }}>Белым — вы здесь. Золотой ореол — цель активного задания. Нажмите на область, чтобы рассмотреть её план.</div>
      </div>
      <div className="col">
        <div className="h3">{ZONES[sel].name} <span className="faint" style={{ fontSize: 16 }}>{ZONES[sel].subtitle}</span></div>
        <div className="zone-map"><canvas ref={cv} /></div>
        {people.length > 0 && <div className="faint" style={{ fontSize: 13, marginTop: 6 }}>Сейчас здесь: {people.map((p) => NPCS[p.npc].name).join(', ')}</div>}
      </div>
    </div>
  );
}
