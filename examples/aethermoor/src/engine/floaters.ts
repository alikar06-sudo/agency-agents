// Всплывающие числа урона, подписи NPC, значки заданий и реплики — DOM-слой поверх холста.
import * as THREE from 'three';

interface Floater { el: HTMLDivElement; x: number; y: number; z: number; life: number; max: number; vy: number }
interface Label { el: HTMLDivElement; visible: boolean }

export class FloaterLayer {
  private root: HTMLDivElement;
  private floats: Floater[] = [];
  private labels = new Map<string, Label>();
  private v = new THREE.Vector3();
  enabled = true;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'floater-layer';
    parent.appendChild(this.root);
  }

  text(x: number, y: number, z: number, text: string, cls = 'dmg', life = 1.1): void {
    if (!this.enabled && cls.startsWith('dmg')) return;
    if (this.floats.length > 60) { const f = this.floats.shift(); f?.el.remove(); }
    const el = document.createElement('div');
    el.className = 'floater ' + cls;
    el.textContent = text;
    this.root.appendChild(el);
    this.floats.push({ el, x: x + (Math.random() - 0.5) * 0.5, y, z, life, max: life, vy: 1.4 });
  }

  // Подпись над NPC/объектом: создаётся один раз и переставляется каждый кадр.
  label(id: string, html: string, cls: string): HTMLDivElement {
    let l = this.labels.get(id);
    if (!l) {
      const el = document.createElement('div');
      el.className = 'label ' + cls;
      this.root.appendChild(el);
      l = { el, visible: true };
      this.labels.set(id, l);
    }
    if (l.el.dataset.html !== html) { l.el.innerHTML = html; l.el.dataset.html = html; }
    if (l.el.className !== 'label ' + cls) l.el.className = 'label ' + cls;
    return l.el;
  }

  placeLabel(id: string, x: number, y: number, z: number, cam: THREE.Camera, w: number, h: number, show: boolean): void {
    const l = this.labels.get(id);
    if (!l) return;
    if (!show) { if (l.visible) { l.el.style.display = 'none'; l.visible = false; } return; }
    this.v.set(x, y, z).project(cam);
    if (this.v.z > 1) { l.el.style.display = 'none'; l.visible = false; return; }
    if (!l.visible) { l.el.style.display = ''; l.visible = true; }
    l.el.style.transform = `translate(-50%, -100%) translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px)`;
  }

  removeLabel(id: string): void {
    const l = this.labels.get(id);
    if (l) { l.el.remove(); this.labels.delete(id); }
  }

  clearLabels(): void { for (const id of [...this.labels.keys()]) this.removeLabel(id); }

  update(dt: number, cam: THREE.Camera, w: number, h: number): void {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.96;
      if (f.life <= 0) { f.el.remove(); this.floats.splice(i, 1); continue; }
      this.v.set(f.x, f.y, f.z).project(cam);
      const t = f.life / f.max;
      f.el.style.opacity = String(Math.min(1, t * 2));
      f.el.style.transform = `translate(-50%, -50%) translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px) scale(${0.8 + Math.min(0.4, (1 - t) * 2)})`;
    }
  }

  clearAll(): void {
    for (const f of this.floats) f.el.remove();
    this.floats = [];
    this.clearLabels();
  }
}
