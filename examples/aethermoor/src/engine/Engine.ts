// Ядро движка: рендер, камера, свет суток, загрузка зон, игровой цикл.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { ZoneId } from '@/data/types';
import { ZONES } from '@/data/zones';
import { buildZone, TS, cellCenter } from './world';
import type { BuiltZone, MarkerInstance } from './world';
import { cutaway } from './materials';
import { Particles, GlowField, Weather } from './particles';
import { FloaterLayer } from './floaters';
import { PlayerEntity } from './player';
import { NpcManager } from './npc';
import { EnemyEntity } from './enemy';
import { Combat } from './combat';
import { InteractManager } from './interact';
import { input } from '@/core/input';
import { audio } from '@/core/audio';
import type { Mood } from '@/core/audio';
import { bus } from '@/core/bus';
import { G, hasGame, isModalOpen, mutate, setUI, ui, useSettings, banner, toast } from '@/state/store';
import { tickTime, daylight, hour, currentWeather, isNight } from '@/systems/time';
import { derived } from '@/systems/player';
import { checkAll } from '@/systems/logic';
import { autosave } from '@/systems/save';
import type { LightSource } from './props';
import { blockedCell } from './physics';

const POOL = 8;

interface PoolLight { light: THREE.PointLight; src: LightSource | null; level: number }

export interface DynLight { x: number; y: number; z: number; color: number; intensity: number; distance: number; until: number }

export class Engine {
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.5, 220);
  composer: EffectComposer | null = null;
  bloom: UnrealBloomPass | null = null;
  canvas!: HTMLCanvasElement;
  container!: HTMLElement;
  zone: BuiltZone | null = null;
  player!: PlayerEntity;
  npcs!: NpcManager;
  enemies: EnemyEntity[] = [];
  combat!: Combat;
  interact!: InteractManager;
  particles = new Particles(3500, true);
  smoke = new Particles(1200, false);
  glow: GlowField | null = null;
  weather = new Weather();
  floaters!: FloaterLayer;
  sky!: THREE.Mesh;
  skyUniforms = {
    uTop: { value: new THREE.Color(0x1a2a50) }, uHorizon: { value: new THREE.Color(0x6a7a9a) },
    uNight: { value: 0 }, uMoonDir: { value: new THREE.Vector3(-0.4, 0.5, -0.75).normalize() }, uTime: { value: 0 },
  };
  sun = new THREE.DirectionalLight(0xffffff, 1);
  hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.5);
  pool: PoolLight[] = [];
  dynLights: DynLight[] = [];
  now = 0;            // время движка в секундах (для перезарядок, льда, анимаций)
  running = false;
  loading = false;
  private raf = 0;
  private clock = new THREE.Clock();
  private width = 1;
  private height = 1;
  private shake = 0;
  private camTarget = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private syncT = 0;
  private exploreT = 0;
  private reached = new Set<string>();
  private exitArmed = true;
  private lastExitMsg = 0;
  private stepRaycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
  aim = new THREE.Vector3();
  focus: { x: number; z: number } | null = null;
  title = false;
  private titleT = 0;
  private zoneMood: Mood = 'castle';
  private combatMusicT = 0;
  private frameHooks = new Set<(dt: number) => void>();
  fps = 60;
  private fpsAcc = 0;
  private fpsN = 0;

  mount(container: HTMLElement): void {
    this.container = container;
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    container.appendChild(canvas);
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.floaters = new FloaterLayer(container);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.04;
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
    for (let i = 0; i < POOL; i++) {
      const light = new THREE.PointLight(0xffaa66, 0, 10, 1.6);
      this.scene.add(light);
      this.pool.push({ light, src: null, level: 0 });
    }
    this.scene.add(this.particles.points, this.smoke.points, this.weather.group);
    this.buildSky();
    this.player = new PlayerEntity(this);
    this.npcs = new NpcManager(this);
    this.combat = new Combat(this);
    this.interact = new InteractManager(this);
    input.attach(canvas);
    this.applyQuality();
    this.resize();
    window.addEventListener('resize', this.resize);
    useSettings.subscribe(() => { this.applyQuality(); this.floaters.enabled = useSettings.getState().showDamage; });
  }

  private buildSky(): void {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uHorizon; uniform float uNight; uniform vec3 uMoonDir; uniform float uTime;
        varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
          vec2 uv = vec2(atan(d.z, d.x) * 260.0, d.y * 260.0);
          vec2 cell = floor(uv);
          vec2 f = fract(uv) - 0.5 - (vec2(hash(cell + 7.0), hash(cell + 11.0)) - 0.5) * 0.6;
          float star = smoothstep(0.16, 0.0, length(f));
          float s = step(0.985, hash(cell)) * star * smoothstep(0.02, 0.25, h) * uNight;
          s *= 0.55 + 0.45 * sin(uTime * 2.0 + hash(cell + 3.0) * 30.0);
          col += s * vec3(0.9, 0.92, 1.0);
          float md = dot(d, uMoonDir);
          col += smoothstep(0.9972, 0.9982, md) * uNight * vec3(0.95, 0.95, 0.85);
          col += smoothstep(0.96, 1.0, md) * uNight * 0.12 * vec3(0.6, 0.7, 1.0);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), mat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);
  }

  applyQuality(): void {
    if (!this.renderer) return;
    const q = useSettings.getState().quality;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? Math.min(1, dpr) : q === 'medium' ? Math.min(1.25, dpr) : Math.min(2, dpr));
    this.renderer.shadowMap.enabled = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    if (q === 'low') {
      this.composer = null;
      this.bloom = null;
    } else if (!this.composer) {
      const comp = new EffectComposer(this.renderer);
      comp.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 0.82);
      comp.addPass(this.bloom);
      comp.addPass(new OutputPass());
      this.composer = comp;
    }
    this.resize();
  }

  resize = (): void => {
    if (!this.container) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.width = w; this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 60 : 45;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
      const q = useSettings.getState().quality;
      if (this.bloom) this.bloom.resolution.set((w * pr) / (q === 'high' ? 1 : 2), (h * pr) / (q === 'high' ? 1 : 2));
    }
    const scale = (h * pr) / 2;
    this.particles.scaleUniform.value = scale;
    this.smoke.scaleUniform.value = scale;
    if (this.glow) this.glow.uniforms.uScale.value = scale;
  };

  get size(): { w: number; h: number } { return { w: this.width, h: this.height }; }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void { this.running = false; cancelAnimationFrame(this.raf); }

  onFrame(fn: (dt: number) => void): () => void { this.frameHooks.add(fn); return () => this.frameHooks.delete(fn); }

  // ---------------- Зоны ----------------

  async enterZone(zoneId: ZoneId, spawn: string, opts: { fade?: boolean; silent?: boolean; x?: number; z?: number; facing?: number } = {}): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    const fade = opts.fade !== false;
    if (fade) { setUI({ fade: true }); await wait(380); }
    try {
      this.clearZone();
      const def = ZONES[zoneId];
      const weather = currentWeather(zoneId);
      const built = buildZone(def, { snow: weather === 'snow' && def.outdoor, seed: 1 });
      this.zone = built;
      this.scene.add(built.group);
      const glowItems = built.lights.filter((l) => (l.glow ?? 0) > 0).map((l) => ({ x: l.x, y: l.y, z: l.z, color: l.color, size: l.glow!, flicker: l.flicker }));
      if (glowItems.length) {
        this.glow = new GlowField(glowItems);
        this.glow.uniforms.uScale.value = this.particles.scaleUniform.value;
        this.scene.add(this.glow.points);
      }
      this.interact.build(built);
      let px: number, pz: number, facing = opts.facing ?? 0;
      if (opts.x !== undefined && opts.z !== undefined && !blockedCell(built.grid, Math.floor(opts.x / TS), Math.floor(opts.z / TS), this.now)) {
        px = opts.x; pz = opts.z;
      } else {
        const sp = this.findSpawn(spawn);
        px = sp.x; pz = sp.z; facing = sp.facing;
      }
      this.player.place(px, pz, facing);
      this.exitArmed = false;
      this.reached.clear();
      this.npcs.syncZone(true);
      this.spawnZoneEnemies();
      this.spawnDrops();
      this.weather.set(def.outdoor ? (weather === 'rain' ? 'rain' : weather === 'snow' ? 'snow' : 'none') : 'none');
      this.zoneMood = def.music as Mood;
      this.updateMusic(true);
      audio.setAmbient(this.ambientFor(def.ambient));
      mutate((g) => {
        g.pos = { zone: zoneId, x: px, z: pz, facing };
        if (!g.visited.includes(zoneId)) g.visited.push(zoneId);
      });
      this.snapCamera();
      this.revealAround(true);
      if (!opts.silent) banner(def.name, def.subtitle);
      bus.emit('zoneEntered', { zone: zoneId });
      autosave(true);
    } catch (err) {
      console.error('Ошибка загрузки зоны', err);
      toast('warn', 'Ошибка загрузки области', String(err));
    } finally {
      this.loading = false;
      if (fade) { await wait(60); setUI({ fade: false }); }
    }
  }

  private ambientFor(base: string[]): string[] {
    const out = [...base];
    const def = this.zone?.def;
    if (def?.outdoor) {
      const w = currentWeather();
      if (w === 'rain' && !out.includes('rain')) out.push('rain');
      if (isNight()) { if (!out.includes('crickets') && w !== 'snow') out.push('crickets'); if (!out.includes('owl')) out.push('owl'); }
      else if (!out.includes('birds') && w !== 'rain' && w !== 'snow') out.push('birds');
    }
    return out;
  }

  refreshAmbient(): void { if (this.zone) audio.setAmbient(this.ambientFor(this.zone.def.ambient)); }

  findSpawn(id: string): { x: number; z: number; facing: number } {
    const z = this.zone!;
    const m = z.markers.find((mk) => mk.key === id && (mk.def.kind === 'spawn' || mk.def.kind === 'anchor'))
      ?? z.markers.find((mk) => mk.key === id)
      ?? z.markers.find((mk) => mk.def.kind === 'spawn');
    if (m) {
      // если маркер — непроходимая клетка (выход), ставим рядом
      if (blockedCell(z.grid, m.col, m.row, this.now) || m.def.kind === 'exit') {
        for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          if (!blockedCell(z.grid, m.col + dc, m.row + dr, this.now)) {
            const [x, zz] = cellCenter(m.col + dc, m.row + dr);
            return { x, z: zz, facing: Math.atan2(dc, dr) };
          }
        }
      }
      return { x: m.x, z: m.z, facing: m.facing };
    }
    for (let r = 0; r < z.grid.h; r++) for (let c = 0; c < z.grid.w; c++) {
      if (!blockedCell(z.grid, c, r, this.now)) { const [x, zz] = cellCenter(c, r); return { x, z: zz, facing: 0 }; }
    }
    return { x: TS, z: TS, facing: 0 };
  }

  marker(key: string): MarkerInstance | undefined { return this.zone?.markers.find((m) => m.key === key); }

  private clearZone(): void {
    this.combat.clear();
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    this.npcs.clear();
    this.interact.clear();
    this.particles.clear();
    this.smoke.clear();
    this.floaters.clearAll();
    if (this.glow) { this.glow.dispose(); this.glow = null; }
    if (this.zone) { this.zone.dispose(); this.zone = null; }
    this.dynLights = [];
    setUI({ boss: null, prompt: null });
    for (const p of this.pool) { p.src = null; p.level = 0; p.light.intensity = 0; }
  }

  private spawned = new Set<string>();

  refreshSpawns(): void {
    if (!this.zone || this.loading || this.title || !hasGame()) return;
    this.spawnZoneEnemies(true);
  }

  spawnZoneEnemies(onlyNew = false): void {
    const z = this.zone!;
    const g = G();
    if (!onlyNew) this.spawned.clear();
    for (const m of z.markers) {
      if (m.def.kind !== 'enemy' || !m.def.enemy) continue;
      if (this.spawned.has(m.key)) continue;
      if (!checkAll(m.def.if)) continue;
      this.spawned.add(m.key);
      const killedKey = `killed_${z.def.id}_${m.key}`;
      if (m.def.respawn === 'never' && g.defeated.includes(killedKey)) continue;
      if (m.def.respawn === 'day' && g.flags[killedKey] === g.time.day) continue;
      const n = m.def.count ?? 1;
      for (let i = 0; i < n; i++) {
        const ox = n > 1 ? (Math.random() - 0.5) * 3 : 0;
        const oz = n > 1 ? (Math.random() - 0.5) * 3 : 0;
        const e = this.spawnEnemy(m.def.enemy, m.x + ox, m.z + oz, { markerKey: n > 1 ? `${m.key}#${i}` : m.key, respawn: m.def.respawn });
        if (e && n > 1) e.groupKey = m.key;
      }
    }
  }

  spawnEnemy(type: string, x: number, z: number, opts: { markerKey?: string; respawn?: string; aggro?: boolean; uniqueId?: string } = {}): EnemyEntity | null {
    try {
      const e = new EnemyEntity(this, type, x, z, opts);
      this.enemies.push(e);
      this.scene.add(e.rig.root);
      if (opts.aggro) e.aggro = true;
      return e;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  private spawnDrops(): void {
    const drops = G().drops[this.zone!.def.id] ?? [];
    for (const d of drops) this.combat.spawnItemPickup(d.id, d.qty, d.x, d.z, d.uid);
  }

  teleport(zone: ZoneId, spawn: string): void {
    void this.enterZone(zone, spawn);
  }

  // ---------------- Кадр ----------------

  private frame(): void {
    const rawDt = this.clock.getDelta();
    const dt = Math.min(0.05, rawDt);
    this.fpsAcc += rawDt; this.fpsN++;
    if (this.fpsAcc > 1) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    cutaway.uTime.value += dt;
    if (this.title) { this.titleFrame(dt); return; }
    const playing = hasGame() && !!this.zone && !this.loading && ui().screen === 'game';
    const paused = !playing || isModalOpen();
    if (!paused) {
      this.now += dt;
      tickTime(dt);
      this.player.update(dt);
      this.npcs.update(dt);
      for (const e of this.enemies) e.update(dt);
      this.enemies = this.enemies.filter((e) => { if (e.removed) { e.dispose(); return false; } return true; });
      this.combat.update(dt);
      this.interact.update(dt);
      this.checkExits();
      this.checkReach();
      this.updatePrompt();
      this.exploreT -= dt;
      if (this.exploreT <= 0) { this.exploreT = 0.4; this.revealAround(false); }
      this.syncT -= dt;
      if (this.syncT <= 0) { this.syncT = 0.12; this.syncVitals(dt); }
      for (const h of this.frameHooks) h(dt);
      this.updateMusic(false);
      mutate((g) => { g.playTime += dt; });
    } else if (playing) {
      this.npcs.animateIdle(dt);
    }
    this.particles.update(paused && playing ? 0 : dt);
    this.smoke.update(paused && playing ? 0 : dt);
    this.updateLighting(dt);
    this.updateCamera(dt);
    this.weather.update(dt, this.camera.position.x, this.player?.z ?? 0, cutaway.uTime.value);
    if (this.zone?.waterMat?.normalMap) {
      this.zone.waterMat.normalMap.offset.set(cutaway.uTime.value * 0.02, cutaway.uTime.value * 0.013);
    }
    if (this.glow) {
      this.glow.uniforms.uTime.value = cutaway.uTime.value;
    }
    this.skyUniforms.uTime.value = cutaway.uTime.value;
    this.floaters.update(dt, this.camera, this.width, this.height);
    this.npcs.updateLabels();
    this.render();
    input.endFrame();
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  private titleFrame(dt: number): void {
    this.titleT += dt;
    const z = this.zone;
    if (!z) { this.render(); return; }
    const cx = z.width / 2, cz = z.depth * 0.62;
    const a = Math.sin(this.titleT * 0.05) * 0.35;
    this.camera.position.set(cx + Math.sin(a) * 26, 4.5, cz + Math.cos(a) * 26);
    this.camera.lookAt(cx, 9, cz - 24);
    this.updateLighting(dt, true);
    this.particles.update(dt);
    this.weather.update(dt, this.camera.position.x, cz, this.titleT);
    if (this.glow) this.glow.uniforms.uTime.value = this.titleT;
    this.skyUniforms.uTime.value = this.titleT;
    cutaway.uCut.value = 0;
    if (Math.random() < 0.3) this.particles.emit({ x: cx + (Math.random() - 0.5) * 40, y: 1 + Math.random() * 6, z: cz - Math.random() * 20, count: 1, speed: 0.2, life: 4, color: 0xffe0a0, size: 0.25, up: 0.2, drag: 0.2 });
    this.render();
  }

  async showTitleScene(): Promise<void> {
    this.title = true;
    this.clearZone();
    const def = ZONES.gates;
    const built = buildZone(def, { snow: false, seed: 1 });
    this.zone = built;
    this.scene.add(built.group);
    const glowItems = built.lights.filter((l) => (l.glow ?? 0) > 0).map((l) => ({ x: l.x, y: l.y, z: l.z, color: l.color, size: l.glow!, flicker: l.flicker }));
    if (glowItems.length) { this.glow = new GlowField(glowItems); this.glow.uniforms.uScale.value = this.particles.scaleUniform.value; this.scene.add(this.glow.points); }
    this.weather.set('none');
    this.player.rig.root.visible = false;
  }

  leaveTitle(): void {
    this.title = false;
    cutaway.uCut.value = 1;
    this.player.rig.root.visible = true;
  }

  // ---------------- Свет и время суток ----------------

  private updateLighting(dt: number, titleMode = false): void {
    const z = this.zone;
    if (!z) return;
    const def = z.def;
    const h = titleMode ? 21.5 : hasGame() ? hour() : 21;
    const d = daylight(h);
    const weather = titleMode ? 'clear' : hasGame() ? currentWeather() : 'clear';
    const dawn = h < 12 ? Math.max(0, 1 - Math.abs(h - 6.5) / 2.5) : Math.max(0, 1 - Math.abs(h - 19) / 2.5);
    const nightC = new THREE.Color(0x0e1530);
    const dayC = new THREE.Color(0x8fa6c4);
    const dawnC = new THREE.Color(0xc0806a);
    const overcast = weather === 'rain' || weather === 'snow' || weather === 'fog' || weather === 'cloudy' ? 1 : 0;
    if (def.outdoor) {
      const fogC = nightC.clone().lerp(dayC, d).lerp(dawnC, dawn * 0.5);
      if (overcast) fogC.lerp(new THREE.Color(weather === 'snow' ? 0xb8c4d4 : 0x6a7280), 0.35 * d);
      this.scene.fog = this.scene.fog instanceof THREE.Fog ? this.scene.fog : new THREE.Fog(fogC, 10, 60);
      const fog = this.scene.fog as THREE.Fog;
      fog.color.copy(fogC);
      const extra = this.cameraOffset().length() - 18;
      const fogFar = (weather === 'fog' ? 32 : weather === 'snow' ? 50 : weather === 'rain' ? 56 : def.fog[1]) + extra;
      fog.near = titleMode ? 25 : def.fog[0] + extra;
      fog.far = titleMode ? 110 : fogFar;
      this.scene.background = fogC;
      this.sky.visible = titleMode;
      this.skyUniforms.uTop.value.copy(nightC.clone().lerp(new THREE.Color(0x4a78b8), d));
      this.skyUniforms.uHorizon.value.copy(fogC);
      this.skyUniforms.uNight.value = 1 - d;
      const sunInt = (0.3 + d * 1.9) * (overcast ? 0.72 : 1);
      this.sun.intensity = sunInt;
      this.sun.color.copy(new THREE.Color(0x8aa0e0).lerp(new THREE.Color(0xfff2dc), d).lerp(new THREE.Color(0xffa060), dawn * 0.6));
      this.hemi.intensity = (0.4 + d * 0.9) * (def.ambientLight ?? 1);
      this.hemi.color.copy(new THREE.Color(0x3a4a7a).lerp(new THREE.Color(0xc8d8f0), d));
      this.hemi.groundColor.copy(new THREE.Color(0x14141c).lerp(new THREE.Color(0x5a5040), d));
      this.sun.castShadow = useSettings.getState().quality !== 'low';
    } else {
      const base = new THREE.Color(def.theme === 'dungeon' || def.theme === 'tunnels' as never ? 0x08080c : def.theme === 'sanctum' ? 0x070a18 : 0x0e0b0a);
      this.scene.fog = this.scene.fog instanceof THREE.Fog ? this.scene.fog : new THREE.Fog(base, 10, 50);
      const fog = this.scene.fog as THREE.Fog;
      fog.color.copy(base);
      const extraIn = this.cameraOffset().length() - 18;
      fog.near = def.fog[0] + extraIn;
      fog.far = def.fog[1] + extraIn;
      this.scene.background = base;
      this.sky.visible = false;
      const amb = def.ambientLight ?? 1;
      const dark = def.dark ? 0.12 : 1;
      const themeAmb = def.theme === 'dungeon' ? 1.1 : def.theme === 'sanctum' ? 1.7 : def.theme === 'ruins' ? 0.8 : 0.95;
      this.hemi.intensity = themeAmb * amb * dark;
      this.hemi.color.set(def.theme === 'sanctum' ? 0x8090d8 : def.theme === 'dungeon' ? 0x8088a8 : 0xc0a080);
      this.hemi.groundColor.set(def.theme === 'sanctum' ? 0x202848 : 0x18120e);
      // свет из окон днём
      this.sun.intensity = (0.35 + d * 0.7) * amb * dark * (def.theme === 'dungeon' || def.theme === 'sanctum' ? 0.35 : 1);
      this.sun.color.set(d > 0.3 ? 0xffe6c0 : 0x8090c0);
      this.sun.castShadow = false;
    }
    const px = this.player?.x ?? z.width / 2;
    const pz = this.player?.z ?? z.depth / 2;
    this.sun.position.set(px - 14, 30, pz + 10 - (h - 12) * 1.2);
    this.sun.target.position.set(px, 0, pz);
    if (this.glow) this.glow.uniforms.uDay.value = def.outdoor ? d : 0;
    this.updatePool(dt, d);
  }

  private updatePool(dt: number, day: number): void {
    const z = this.zone;
    if (!z) return;
    const px = this.player?.x ?? 0, pz = this.player?.z ?? 0;
    const cands: { src: LightSource; score: number }[] = [];
    for (const l of z.lights) {
      if (l.on === false || l.intensity <= 0) continue;
      const dx = l.x - px, dz = l.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 > 900) continue;
      let inten = l.intensity;
      if (l.kind === 'window') inten = z.def.outdoor ? 0 : 0.5 + day * 2.2;
      if (l.kind === 'lamp' && z.def.outdoor) inten *= 1 - day * 0.7;
      if (inten <= 0) continue;
      cands.push({ src: l, score: inten / (1 + d2 / 30) });
    }
    this.dynLights = this.dynLights.filter((l) => l.until > this.now);
    for (const l of this.dynLights) {
      const dx = l.x - px, dz = l.z - pz;
      cands.push({ src: { x: l.x, y: l.y, z: l.z, color: l.color, intensity: l.intensity, distance: l.distance, flicker: 0, kind: 'dyn' }, score: l.intensity * 3 / (1 + (dx * dx + dz * dz) / 30) });
    }
    const pl = this.player?.lightSource();
    if (pl) cands.push({ src: pl, score: 1e6 });
    cands.sort((a, b) => b.score - a.score);
    const chosen = cands.slice(0, POOL).map((c) => c.src);
    const t = cutaway.uTime.value;
    // сохраняем привязку уже занятых источников, чтобы свет не «прыгал»
    const free: PoolLight[] = [];
    const assigned = new Set<LightSource>();
    for (const p of this.pool) {
      const keep = p.src && chosen.find((c) => c === p.src || (c.kind === 'dyn' && p.src!.kind === 'dyn' && Math.abs(c.x - p.src!.x) < 1.5 && Math.abs(c.z - p.src!.z) < 1.5) || (c.kind === 'player' && p.src!.kind === 'player'));
      if (keep) { p.src = keep; assigned.add(keep); } else free.push(p);
    }
    for (const c of chosen) {
      if (assigned.has(c)) continue;
      const p = free.shift();
      if (!p) break;
      if (p.level > 0.05 && p.src) { p.level = Math.max(0, p.level - dt * 8); free.unshift(p); break; }
      p.src = c;
      p.level = 0;
    }
    for (const p of free) { p.level = Math.max(0, p.level - dt * 6); if (p.level === 0) p.src = null; }
    for (const p of this.pool) {
      const s = p.src;
      if (!s) { p.light.intensity = 0; continue; }
      if (chosen.includes(s)) p.level = Math.min(1, p.level + dt * 5);
      let inten = s.intensity;
      if (s.kind === 'window') inten = 0.5 + day * 2.2;
      if (s.kind === 'lamp' && z.def.outdoor) inten *= 1 - day * 0.7;
      const flick = s.flicker ? 1 - s.flicker * (0.5 + 0.5 * Math.sin(t * 11 + s.x * 3) * Math.sin(t * 4.3 + s.z)) : 1;
      p.light.position.set(s.x, s.y, s.z);
      p.light.color.setHex(s.kind === 'window' ? (day > 0.3 ? 0xffe8c8 : 0x9ab0e8) : s.color);
      p.light.distance = s.distance;
      p.light.intensity = inten * flick * p.level * 2.2;
    }
  }

  addDynLight(x: number, y: number, z: number, color: number, intensity: number, distance: number, dur: number): void {
    this.dynLights.push({ x, y, z, color, intensity, distance, until: this.now + dur });
    if (this.dynLights.length > 12) this.dynLights.shift();
  }

  // ---------------- Камера ----------------

  private snapCamera(): void {
    this.camTarget.set(this.player.x, 1, this.player.z);
    this.camPos.copy(this.camTarget).add(this.cameraOffset());
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  private cameraOffset(): THREE.Vector3 {
    const zoom = useSettings.getState().zoom;
    const dlg = ui().dialogue ? 0.72 : 1;
    const portrait = this.width < this.height ? 1.25 : 1;
    return new THREE.Vector3(0, 19.5, 14.5).multiplyScalar(zoom * dlg * portrait);
  }

  private updateCamera(dt: number): void {
    if (!this.player || !this.zone || this.title) return;
    if (input.wheel && !isModalOpen()) {
      const z = Math.max(0.6, Math.min(1.5, useSettings.getState().zoom + input.wheel * 0.07));
      useSettings.setState({ zoom: z });
    }
    const target = new THREE.Vector3(this.player.x, 1, this.player.z);
    if (this.focus) {
      target.x = (target.x + this.focus.x) / 2;
      target.z = (target.z + this.focus.z) / 2;
    } else if (!isModalOpen()) {
      // лёгкое смещение к прицелу
      const ax = this.aim.x - this.player.x, az = this.aim.z - this.player.z;
      const l = Math.hypot(ax, az);
      if (l > 0.1) { target.x += (ax / l) * Math.min(1.6, l * 0.12); target.z += (az / l) * Math.min(1.6, l * 0.12); }
    }
    const k = 1 - Math.exp(-dt * 6);
    this.camTarget.lerp(target, k);
    const desired = this.camTarget.clone().add(this.cameraOffset());
    this.camPos.lerp(desired, k);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0 && useSettings.getState().shake) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.lookAt(this.camTarget);
    cutaway.uFocus.value.set(this.player.x, 0, this.player.z);
    audio.setListener(this.player.x, this.player.z);
    // прицел мышью — точка на плоскости y=1
    if (input.mouse.inside) {
      this.stepRaycaster.setFromCamera(new THREE.Vector2(input.mouse.nx, input.mouse.ny), this.camera);
      const hit = new THREE.Vector3();
      if (this.stepRaycaster.ray.intersectPlane(this.groundPlane, hit)) this.aim.copy(hit);
    }
  }

  addShake(a: number): void { this.shake = Math.min(1.2, this.shake + a); }

  // ---------------- Мир: выходы, точки, подсказки ----------------

  private checkExits(): void {
    const z = this.zone!;
    const [c, r] = [Math.floor(this.player.x / TS), Math.floor(this.player.z / TS)];
    const m = this.interact.exitAt(c, r);
    if (!m) { this.exitArmed = true; return; }
    if (!this.exitArmed) return;
    const target = m.def.to!;
    const targetDef = ZONES[target];
    const blockedByMarker = m.def.locked && !checkAll(m.def.locked);
    const blockedByZone = targetDef?.unlock && !checkAll(targetDef.unlock);
    if (blockedByMarker || blockedByZone) {
      if (performance.now() - this.lastExitMsg > 2500) {
        this.lastExitMsg = performance.now();
        toast('warn', 'Путь закрыт', (blockedByMarker ? m.def.lockedText : targetDef.lockedText) ?? 'Сюда пока нельзя.');
        bus.emit('sfx', { id: 'ui_error' });
      }
      this.player.pushBack();
      return;
    }
    this.exitArmed = false;
    bus.emit('sfx', { id: 'door' });
    void this.enterZone(target, m.def.spawn ?? 'start');
    void z;
  }

  private checkReach(): void {
    const z = this.zone!;
    for (const m of z.markers) {
      if (this.reached.has(m.key)) continue;
      const rad = m.def.radius ?? 2.6;
      if (Math.abs(m.x - this.player.x) > rad || Math.abs(m.z - this.player.z) > rad) continue;
      if (Math.hypot(m.x - this.player.x, m.z - this.player.z) > rad) continue;
      this.reached.add(m.key);
      bus.emit('reached', { zone: z.def.id, marker: m.key });
      if (m.def.id !== m.key) bus.emit('reached', { zone: z.def.id, marker: m.def.id });
    }
  }

  resetReached(): void { this.reached.clear(); }

  private updatePrompt(): void {
    const near = this.nearestUsable();
    const cur = ui().prompt;
    if (!near) { if (cur) setUI({ prompt: null }); return; }
    if (!cur || cur.text !== near.text || cur.sub !== near.sub) setUI({ prompt: { text: near.text, sub: near.sub, key: 'E' } });
  }

  nearestUsable(): { text: string; sub?: string; use: () => void } | null {
    const px = this.player.x, pz = this.player.z;
    let best: { text: string; sub?: string; use: () => void } | null = null;
    let bestD = 2.6;
    const npc = this.npcs.nearest(px, pz, 2.6);
    if (npc) { best = { text: 'Поговорить', sub: npc.def.name, use: () => npc.talk() }; bestD = npc.dist; }
    const it = this.interact.nearest(px, pz, 2.4);
    if (it && it.dist < bestD) {
      const p = it.item.prompt();
      if (p) best = { text: p.text, sub: p.sub, use: () => it.item.use() };
    }
    return best;
  }

  useNearest(): void {
    const n = this.nearestUsable();
    if (n) n.use();
  }

  // ---------------- Исследование и синхронизация ----------------

  revealAround(force: boolean): void {
    const z = this.zone;
    if (!z || !hasGame()) return;
    const id = z.def.id;
    const g = G();
    const n = z.grid.w * z.grid.h;
    let bits = decodeBits(g.explored[id], n);
    const pc = Math.floor(this.player.x / TS), pr = Math.floor(this.player.z / TS);
    const R = z.def.outdoor ? 8 : 6;
    let changed = force;
    for (let r = pr - R; r <= pr + R; r++) for (let c = pc - R; c <= pc + R; c++) {
      if (c < 0 || r < 0 || c >= z.grid.w || r >= z.grid.h) continue;
      if ((c - pc) ** 2 + (r - pr) ** 2 > R * R) continue;
      const i = r * z.grid.w + c;
      if (!(bits[i >> 3] & (1 << (i & 7)))) { bits[i >> 3] |= 1 << (i & 7); changed = true; }
    }
    if (changed) {
      const enc = encodeBits(bits);
      mutate((s) => { s.explored[id] = enc; });
    }
    void bits;
    bits = null as unknown as Uint8Array;
  }

  private syncVitals(_dt: number): void {
    const p = this.player;
    mutate((g) => {
      g.pos.x = p.x; g.pos.z = p.z; g.pos.facing = p.facing;
    });
  }

  private updateMusic(force: boolean): void {
    const z = this.zone;
    if (!z) return;
    const inCombat = this.enemies.some((e) => e.aggro && !e.dead && !e.def.tags?.includes('training') && e.def.ai !== 'dummy');
    const boss = this.enemies.some((e) => e.aggro && !e.dead && e.def.boss);
    if (inCombat) this.combatMusicT = 4;
    else this.combatMusicT -= 0.016;
    let mood: Mood = this.zoneMood;
    if (boss) mood = 'boss';
    else if (this.combatMusicT > 0) mood = 'combat';
    else if (z.def.outdoor && isNight() && (mood === 'castle' || mood === 'village' || mood === 'forest')) mood = 'night';
    if (force || audio.getMood() !== mood) audio.setMusic(mood);
  }

  screenToWorldDir(): { x: number; z: number } {
    const dx = this.aim.x - this.player.x, dz = this.aim.z - this.player.z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l };
  }

  derived() { return derived(); }
}

function wait(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

export function decodeBits(s: string | undefined, n: number): Uint8Array {
  const out = new Uint8Array(Math.ceil(n / 8));
  if (!s) return out;
  try {
    const bin = atob(s);
    for (let i = 0; i < Math.min(bin.length, out.length); i++) out[i] = bin.charCodeAt(i);
  } catch { /* испорченные данные — начнём заново */ }
  return out;
}

export function encodeBits(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

export const engine = new Engine();
