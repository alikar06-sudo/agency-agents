import { useEffect, useRef } from 'react';
import { engine, decodeBits } from '@/engine/Engine';
import { G, hasGame, setUI } from '@/state/store';
import { waypoints } from '@/systems/quests';
import { resolveWaypoint } from '@/systems/navigation';
import { TS } from '@/engine/world';
import { ZONES } from '@/data/zones';

const S = 4; // пикселей мини-карты на клетку в исходном изображении

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const fog = document.createElement('canvas');
    let fogKey = '';
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 66) return;
      last = t;
      const cv = ref.current;
      const z = engine.zone;
      if (!cv || !z || !hasGame()) return;
      const ctx = cv.getContext('2d')!;
      const W = cv.width = cv.clientWidth * 2;
      const H = cv.height = cv.clientHeight * 2;
      const scale = 2.2; // экранных пикселей на исходный пиксель
      const px = (engine.player.x / TS) * S, pz = (engine.player.z / TS) * S;
      ctx.fillStyle = '#08070b';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-px, -pz);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(z.minimap, 0, 0);
      // туман неизведанного
      const g = G();
      const key = z.def.id + (g.explored[z.def.id] ?? '').length + (g.explored[z.def.id] ?? '').slice(-16);
      if (key !== fogKey) {
        fogKey = key;
        fog.width = z.grid.w * S; fog.height = z.grid.h * S;
        const fctx = fog.getContext('2d')!;
        fctx.fillStyle = '#08070b';
        fctx.fillRect(0, 0, fog.width, fog.height);
        const bits = decodeBits(g.explored[z.def.id], z.grid.w * z.grid.h);
        for (let i = 0; i < z.grid.w * z.grid.h; i++) {
          if (bits[i >> 3] & (1 << (i & 7))) fctx.clearRect((i % z.grid.w) * S, Math.floor(i / z.grid.w) * S, S, S);
        }
      }
      ctx.globalAlpha = 0.92;
      ctx.drawImage(fog, 0, 0);
      ctx.globalAlpha = 1;
      const dot = (x: number, zz: number, r: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc((x / TS) * S, (zz / TS) * S, r, 0, Math.PI * 2); ctx.fill();
      };
      for (const it of engine.interact.items) {
        if (it.kind === 'exit') { ctx.fillStyle = '#e3c46b'; ctx.fillRect((it.x / TS) * S - 2, (it.z / TS) * S - 2, 4, 4); }
        else if ((it.kind === 'herb' || it.kind === 'ore') && it.obj.visible) dot(it.x, it.z, 1.2, '#8ae07a');
        else if ((it.kind === 'chest' && !it.isOpened()) || it.kind === 'waystone' || it.kind === 'station' || it.kind === 'board') dot(it.x, it.z, 1.4, '#c8a8ff');
      }
      for (const n of engine.npcs.list) dot(n.x, n.z, n.mark ? 2.2 : 1.5, n.mark === '!' ? '#ffd34a' : n.mark === '?' ? '#8ad8ff' : '#e8e0d0');
      for (const e of engine.enemies) if (!e.dead && (e.aggro || Math.hypot(e.x - engine.player.x, e.z - engine.player.z) < 16)) dot(e.x, e.z, e.def.boss ? 3 : 1.6, '#ff5a4a');
      // метки задания
      for (const w of waypoints(true)) {
        const tgt = resolveWaypoint(w.where);
        if (!tgt) continue;
        const tx = (tgt.x / TS) * S, tz = (tgt.z / TS) * S;
        const dx = tx - px, dz = tz - pz;
        const dist = Math.hypot(dx, dz);
        const maxR = (Math.min(W, H) / 2 - 10) / scale;
        ctx.save();
        if (dist > maxR) {
          ctx.translate(px + (dx / dist) * maxR, pz + (dz / dist) * maxR);
          ctx.rotate(Math.atan2(dz, dx));
          ctx.fillStyle = '#ffd34a';
          ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -3.5); ctx.lineTo(-3, 3.5); ctx.fill();
        } else {
          ctx.translate(tx, tz);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#ffd34a';
          ctx.shadowColor = '#ffb000'; ctx.shadowBlur = 6;
          const s = 3 + Math.sin(t / 200) * 0.6;
          ctx.fillRect(-s, -s, s * 2, s * 2);
        }
        ctx.restore();
      }
      // игрок
      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(-engine.player.facing + Math.PI);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#e3c46b'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(0, -4.5); ctx.lineTo(3.2, 3.5); ctx.lineTo(0, 2); ctx.lineTo(-3.2, 3.5); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  const zone = hasGame() ? G().pos.zone : 'gates';
  return (
    <div className="minimap" onClick={() => setUI({ menu: 'map' })} title="Карта (M)">
      <canvas ref={ref} />
      <div className="n">{ZONES[zone].outdoor ? 'С' : ''}</div>
    </div>
  );
}
