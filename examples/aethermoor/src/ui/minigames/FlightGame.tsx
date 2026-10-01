import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameProps } from './MinigameHost';
import { Result } from './MinigameHost';
import { bus } from '@/core/bus';
import { G, mutate } from '@/state/store';

// Гонка на парящем диске над озером: пролетите сквозь все кольца.
export function FlightGame({ req, onFinish, onCancel }: GameProps) {
  const host = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState({ rings: 0, total: 0, left: 0, boost: 1 });
  const [done, setDone] = useState<number | null>(null);
  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    renderer.domElement.className = 'flight-canvas';
    const scene = new THREE.Scene();
    const sky = new THREE.Color(0xd89a6a);
    scene.background = sky;
    scene.fog = new THREE.Fog(sky, 30, 170);
    const cam = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
    scene.add(new THREE.HemisphereLight(0xffd8b0, 0x2a3a5a, 1.4));
    const sun = new THREE.DirectionalLight(0xffc890, 2.2);
    sun.position.set(-30, 40, -100);
    scene.add(sun);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 2000, 60, 200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a5a7a, roughness: 0.15, metalness: 0.4, flatShading: true }));
    water.position.z = -900;
    scene.add(water);
    const pos = water.geometry.attributes.position as THREE.BufferAttribute;
    const base = Float32Array.from(pos.array as Float32Array);
    // горы по берегам
    for (let i = 0; i < 60; i++) {
      const side = i % 2 ? 1 : -1;
      const m = new THREE.Mesh(new THREE.ConeGeometry(14 + Math.random() * 20, 30 + Math.random() * 50, 6), new THREE.MeshStandardMaterial({ color: 0x3a3a4a, flatShading: true }));
      m.position.set(side * (70 + Math.random() * 60), 10, -i * 30 - Math.random() * 20);
      scene.add(m);
    }
    // замок на горизонте
    const castle = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 30 + i * 6, 8), new THREE.MeshStandardMaterial({ color: 0x5a5060 }));
      t.position.set(-30 + i * 12, 15 + i * 3, 0);
      const r = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 8), new THREE.MeshStandardMaterial({ color: 0x2a2e40 }));
      r.position.set(-30 + i * 12, 36 + i * 6, 0);
      castle.add(t, r);
    }
    castle.position.set(0, 0, -1100);
    scene.add(castle);
    const diff = req.difficulty ?? 2;
    const N = 12 + diff * 2;
    const rings: { m: THREE.Mesh; x: number; y: number; z: number; hit: boolean }[] = [];
    let x = 0, y = 8;
    for (let i = 0; i < N; i++) {
      x = Math.max(-26, Math.min(26, x + (Math.random() - 0.5) * 22));
      y = Math.max(3, Math.min(20, y + (Math.random() - 0.5) * 9));
      const m = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.35, 10, 32), new THREE.MeshBasicMaterial({ color: 0xffd86a }));
      const z = -40 - i * 55;
      m.position.set(x, y, z);
      scene.add(m);
      rings.push({ m, x, y, z, hit: false });
    }
    const disk = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 0.18, 24), new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 0.8, roughness: 0.3, emissive: 0x4a3010 }));
    const rune = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9ad8ff }));
    rune.position.y = 0.1;
    const rider = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.5, 10), new THREE.MeshStandardMaterial({ color: 0x1e1a22 }));
    rider.position.y = 0.85;
    disk.add(plate, rune, rider);
    scene.add(disk);
    const keys = new Set<string>();
    const kd = (e: KeyboardEvent) => { keys.add(e.code); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); };
    const ku = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    let mouse: { x: number; y: number } | null = null;
    const mm = (e: PointerEvent) => { const r = renderer.domElement.getBoundingClientRect(); mouse = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }; };
    renderer.domElement.addEventListener('pointermove', mm);
    const resize = () => { const w = el.clientWidth, h = Math.min(460, window.innerHeight * 0.6); renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    resize();
    window.addEventListener('resize', resize);
    let px = 0, py = 8, pz = 0, vx = 0, vy = 0, boost = 1, t = 0, hits = 0;
    const limit = 50 + N * 1.5;
    let last = performance.now();
    let raf = 0;
    let finished = false;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      t += dt;
      let ix = 0, iy = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) iy += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) iy -= 1;
      if (mouse && !ix && !iy) { ix = mouse.x * 1.4; iy = mouse.y * 1.4; }
      const boosting = keys.has('Space') && boost > 0;
      boost = Math.max(0, Math.min(1, boost + (boosting ? -0.5 : 0.15) * dt));
      const speed = (26 + diff * 2) * (boosting ? 1.6 : 1);
      vx += (ix * 22 - vx) * Math.min(1, dt * 4);
      vy += (iy * 16 - vy) * Math.min(1, dt * 4);
      px = Math.max(-34, Math.min(34, px + vx * dt));
      py = Math.max(1.2, Math.min(26, py + vy * dt));
      pz -= speed * dt;
      disk.position.set(px, py, pz);
      disk.rotation.z = -vx * 0.03;
      disk.rotation.x = vy * 0.02;
      cam.position.lerp(new THREE.Vector3(px * 0.85, py + 3.2, pz + 9), Math.min(1, dt * 5));
      cam.lookAt(px, py + 0.5, pz - 12);
      for (const r of rings) {
        r.m.rotation.z += dt;
        if (!r.hit && Math.abs(pz - r.z) < 1.2) {
          const d = Math.hypot(px - r.x, py - r.y);
          if (d < 3.4) { r.hit = true; hits++; (r.m.material as THREE.MeshBasicMaterial).color.set(0x8aff9a); bus.emit('sfx', { id: 'objective' }); }
          else { r.hit = true; (r.m.material as THREE.MeshBasicMaterial).color.set(0xff5a4a); (r.m.material as THREE.MeshBasicMaterial).transparent = true; (r.m.material as THREE.MeshBasicMaterial).opacity = 0.4; bus.emit('sfx', { id: 'ui_error' }); }
        }
      }
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) arr[i + 1] = base[i + 1] + Math.sin(base[i] * 0.1 + t * 1.5) * 0.4 + Math.cos(base[i + 2] * 0.08 + t) * 0.4;
      pos.needsUpdate = true;
      renderer.render(scene, cam);
      const left = Math.max(0, limit - t);
      if (Math.random() < 0.2) setHud({ rings: hits, total: N, left, boost });
      const passed = rings[rings.length - 1].z > pz + 5;
      if (!finished && (passed || left <= 0)) {
        finished = true;
        const score = Math.min(1, (hits / N) * 0.85 + (passed ? Math.max(0, left / limit) * 0.3 : 0));
        if (passed) mutate((g) => { g.records.flight = Math.max(g.records.flight ?? 0, Math.round(score * 100)); });
        setTimeout(() => setDone(score), 400);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize);
      renderer.dispose();
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
      el.innerHTML = '';
    };
  }, [req.difficulty]);
  if (done !== null) return <div className="mg panel panel-frame"><Result score={done} title={req.title ?? 'Гонка над озером'} onDone={() => onFinish(done)} extra={`колец: ${hud.rings}/${hud.total} · рекорд ${G().records.flight ?? 0}%`} /></div>;
  return (
    <div className="mg panel panel-frame" style={{ width: 'min(960px, calc(100vw - 24px))' }}>
      <div className="mg-head"><div className="t">{req.title ?? 'Гонка над озером'}</div><div className="dim">Кольца {hud.rings}/{hud.total} · ⏳ {Math.ceil(hud.left)} с · ускорение {Math.round(hud.boost * 100)}%</div></div>
      <div className="mg-help">WASD / стрелки или мышь — управление, <span className="kbd">Пробел</span> — ускорение. Пролетайте сквозь золотые кольца.</div>
      <div ref={host} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn small ghost" onClick={onCancel}>Сойти с дистанции</button></div>
    </div>
  );
}
