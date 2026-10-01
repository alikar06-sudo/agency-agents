// Частицы (магия, огонь, искры, пыль), ореолы источников света и погода.
import * as THREE from 'three';
import { glowTexture } from './textures';

const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform sampler2D uTex;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
  if (gl_FragColor.a < 0.01) discard;
}`;

export interface EmitOpts {
  x: number; y: number; z: number;
  count?: number;
  speed?: number;
  spread?: number;      // радиус разброса стартовой позиции
  dir?: [number, number, number];
  cone?: number;        // 0..1, насколько направлен поток
  life?: number;
  color?: number;
  color2?: number;
  size?: number;
  size2?: number;
  gravity?: number;
  drag?: number;
  up?: number;
  alpha?: number;
}

export class Particles {
  readonly points: THREE.Points;
  private max: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private c1: Float32Array;
  private c2: Float32Array;
  private size: Float32Array;
  private s1: Float32Array;
  private s2: Float32Array;
  private alpha: Float32Array;
  private a0: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private cursor = 0;
  private geo: THREE.BufferGeometry;
  scaleUniform: { value: number };

  constructor(max = 3000, additive = true) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.c1 = new Float32Array(max * 3);
    this.c2 = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.s2 = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.scaleUniform = { value: 400 };
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: glowTexture() }, uScale: this.scaleUniform },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  emit(o: EmitOpts): void {
    const n = o.count ?? 10;
    const c1 = new THREE.Color(o.color ?? 0xffffff);
    const c2 = new THREE.Color(o.color2 ?? o.color ?? 0xffffff);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const sp = o.spread ?? 0.1;
      this.pos[i * 3] = o.x + (Math.random() - 0.5) * sp * 2;
      this.pos[i * 3 + 1] = o.y + (Math.random() - 0.5) * sp * 2;
      this.pos[i * 3 + 2] = o.z + (Math.random() - 0.5) * sp * 2;
      const speed = (o.speed ?? 2) * (0.4 + Math.random() * 0.8);
      let vx = Math.random() - 0.5, vy = Math.random() - 0.5, vz = Math.random() - 0.5;
      const l = Math.hypot(vx, vy, vz) || 1;
      vx /= l; vy /= l; vz /= l;
      if (o.dir) {
        const cone = o.cone ?? 0.7;
        vx = vx * (1 - cone) + o.dir[0] * cone;
        vy = vy * (1 - cone) + o.dir[1] * cone;
        vz = vz * (1 - cone) + o.dir[2] * cone;
      }
      this.vel[i * 3] = vx * speed;
      this.vel[i * 3 + 1] = vy * speed + (o.up ?? 0);
      this.vel[i * 3 + 2] = vz * speed;
      this.c1[i * 3] = c1.r; this.c1[i * 3 + 1] = c1.g; this.c1[i * 3 + 2] = c1.b;
      this.c2[i * 3] = c2.r; this.c2[i * 3 + 1] = c2.g; this.c2[i * 3 + 2] = c2.b;
      this.s1[i] = (o.size ?? 0.5) * (0.7 + Math.random() * 0.6);
      this.s2[i] = o.size2 ?? this.s1[i] * 0.2;
      const life = (o.life ?? 0.8) * (0.6 + Math.random() * 0.8);
      this.life[i] = life;
      this.maxLife[i] = life;
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 1.5;
      this.a0[i] = o.alpha ?? 1;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; } continue; }
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      for (let k = 0; k < 3; k++) this.col[i * 3 + k] = this.c1[i * 3 + k] * (1 - t) + this.c2[i * 3 + k] * t;
      this.size[i] = this.s1[i] * (1 - t) + this.s2[i] * t;
      this.alpha[i] = this.a0[i] * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void { this.life.fill(0); }
}

// Ореолы статичных источников света — одна отрисовка на всю зону, мерцание в шейдере.
const GLOW_VERT = `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
attribute float aFlicker;
varying vec3 vColor;
varying float vA;
uniform float uTime;
uniform float uScale;
uniform float uDay;
void main() {
  float f = 1.0 - aFlicker * (0.5 + 0.5 * sin(uTime * 9.0 + aPhase) * sin(uTime * 3.7 + aPhase * 2.0));
  vColor = aColor;
  vA = f * (1.0 - uDay * 0.6);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * f * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = `
uniform sampler2D uTex;
varying vec3 vColor;
varying float vA;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(vColor, t.a * 0.55 * vA);
}`;

export class GlowField {
  readonly points: THREE.Points;
  readonly uniforms = { uTime: { value: 0 }, uScale: { value: 400 }, uTex: { value: glowTexture() }, uDay: { value: 0 } };
  private geo: THREE.BufferGeometry;
  constructor(items: { x: number; y: number; z: number; color: number; size: number; flicker: number }[]) {
    const n = items.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    const fl = new Float32Array(n);
    const c = new THREE.Color();
    items.forEach((it, i) => {
      pos.set([it.x, it.y, it.z], i * 3);
      c.setHex(it.color);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = it.size;
      phase[i] = Math.random() * 100;
      fl[i] = it.flicker;
    });
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.geo.setAttribute('aFlicker', new THREE.BufferAttribute(fl, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 9;
  }
  setSize(i: number, s: number): void {
    const a = this.geo.attributes.aSize as THREE.BufferAttribute;
    a.setX(i, s);
    a.needsUpdate = true;
  }
  setPos(i: number, x: number, y: number, z: number): void {
    const a = this.geo.attributes.position as THREE.BufferAttribute;
    a.setXYZ(i, x, y, z);
    a.needsUpdate = true;
  }
  dispose(): void { this.geo.dispose(); (this.points.material as THREE.Material).dispose(); this.points.removeFromParent(); }
}

// Погода: дождь и снег вокруг камеры.
export class Weather {
  readonly group = new THREE.Group();
  private rain: THREE.LineSegments;
  private snow: THREE.Points;
  private rainPos: Float32Array;
  private snowPos: Float32Array;
  private R = 900;
  private S = 1400;
  mode: 'none' | 'rain' | 'snow' = 'none';
  private area = 34;

  constructor() {
    this.rainPos = new Float32Array(this.R * 6);
    for (let i = 0; i < this.R; i++) this.resetDrop(i, true);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9ab0c8, transparent: true, opacity: 0.35, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.snowPos = new Float32Array(this.S * 3);
    for (let i = 0; i < this.S; i++) {
      this.snowPos[i * 3] = (Math.random() - 0.5) * this.area * 2;
      this.snowPos[i * 3 + 1] = Math.random() * 18;
      this.snowPos[i * 3 + 2] = (Math.random() - 0.5) * this.area * 2;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.85, depthWrite: false, map: glowTexture() }));
    this.snow.frustumCulled = false;
    this.group.add(this.rain, this.snow);
    this.set('none');
  }

  private resetDrop(i: number, randomY: boolean): void {
    const x = (Math.random() - 0.5) * this.area * 2;
    const z = (Math.random() - 0.5) * this.area * 2;
    const y = randomY ? Math.random() * 20 : 18 + Math.random() * 4;
    this.rainPos.set([x, y, z, x - 0.05, y - 0.7, z + 0.03], i * 6);
  }

  set(mode: 'none' | 'rain' | 'snow'): void {
    this.mode = mode;
    this.rain.visible = mode === 'rain';
    this.snow.visible = mode === 'snow';
  }

  update(dt: number, cx: number, cz: number, t: number): void {
    this.group.position.set(cx, 0, cz);
    if (this.mode === 'rain') {
      for (let i = 0; i < this.R; i++) {
        const k = i * 6;
        const dy = 26 * dt;
        this.rainPos[k + 1] -= dy; this.rainPos[k + 4] -= dy;
        this.rainPos[k] -= dy * 0.07; this.rainPos[k + 3] -= dy * 0.07;
        if (this.rainPos[k + 4] < 0) this.resetDrop(i, false);
      }
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    } else if (this.mode === 'snow') {
      for (let i = 0; i < this.S; i++) {
        const k = i * 3;
        this.snowPos[k + 1] -= (1.2 + (i % 5) * 0.15) * dt;
        this.snowPos[k] += Math.sin(t * 0.8 + i) * 0.4 * dt;
        if (this.snowPos[k + 1] < 0) {
          this.snowPos[k + 1] = 18;
          this.snowPos[k] = (Math.random() - 0.5) * this.area * 2;
          this.snowPos[k + 2] = (Math.random() - 0.5) * this.area * 2;
        }
      }
      (this.snow.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}
