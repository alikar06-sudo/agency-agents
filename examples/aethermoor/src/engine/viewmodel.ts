// Руки и жезл героя в виде от первого лица. Группа прикреплена к камере.
import * as THREE from 'three';

export interface ViewLook { skin: string; robe: string; trim: string; wand: string; glow: number }

// Предплечье строится вдоль локальной оси +Z (от запястья к локтю), кулак и жезл — впереди (−Z).
const sleeveGeo = new THREE.CylinderGeometry(0.05, 0.085, 0.62, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.31);
const cuffGeo = new THREE.TorusGeometry(0.056, 0.012, 8, 24);
const fistGeo = new THREE.SphereGeometry(1, 18, 14);
const fingerGeo = new THREE.CapsuleGeometry(0.0115, 0.034, 4, 10);
const wandGeo = new THREE.CylinderGeometry(0.0065, 0.0115, 0.4, 10).translate(0, 0.2, 0);
const tipGeo = new THREE.SphereGeometry(0.013, 12, 10);
const Z = new THREE.Vector3(0, 0, 1);

export class ViewModel {
  readonly group = new THREE.Group();
  private right = new THREE.Group();
  private left = new THREE.Group();
  private wand = new THREE.Group();
  private tip = new THREE.Mesh(tipGeo, new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
  private tipGlow: THREE.Sprite;
  private ward: THREE.Mesh;
  private skinM = new THREE.MeshStandardMaterial({ color: 0xe0b89a, roughness: 0.65 });
  private robeM = new THREE.MeshStandardMaterial({ color: 0x1e1a22, roughness: 0.9, side: THREE.DoubleSide });
  private trimM = new THREE.MeshStandardMaterial({ color: 0xc9a050, roughness: 0.5, metalness: 0.3 });
  private wandM = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.55 });
  private t = 0;
  private castKick = 0;

  constructor() {
    const g = this.group;
    g.visible = false;
    this.right.add(this.arm(1, true));
    this.left.add(this.arm(-1, false));
    // щит Эгиды перед левой ладонью
    this.ward = new THREE.Mesh(new THREE.CircleGeometry(0.16, 40), new THREE.MeshBasicMaterial({ color: 0x8ac8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.ward.position.set(0.02, 0.12, -0.2);
    this.ward.visible = false;
    this.left.add(this.ward);
    const glowTex = makeGlowTexture();
    this.tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0c0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.tipGlow.scale.setScalar(0.09);
    this.tip.add(this.tipGlow);
    g.add(this.right, this.left);
    g.traverse((o) => { o.frustumCulled = false; (o as THREE.Mesh).castShadow = false; o.renderOrder = 10; });
  }

  // Рука: запястье в начале координат группы, предплечье уходит к локтю за край экрана.
  private arm(side: number, holdsWand: boolean): THREE.Group {
    const wrap = new THREE.Group();
    const a = new THREE.Group();
    const elbowDir = new THREE.Vector3(0.38 * side, -0.42, 0.82).normalize();
    a.quaternion.setFromUnitVectors(Z, elbowDir);
    wrap.add(a);
    const sleeve = new THREE.Mesh(sleeveGeo, this.robeM);
    sleeve.position.z = 0.03;
    a.add(sleeve);
    const cuff = new THREE.Mesh(cuffGeo, this.trimM);
    cuff.position.z = 0.035;
    a.add(cuff);
    const wrist = new THREE.Mesh(fistGeo, this.skinM);
    wrist.scale.set(0.034, 0.03, 0.04);
    wrist.position.z = 0.0;
    a.add(wrist);
    // кулак в мировой ориентации обёртки: смотрит вперёд
    const fist = new THREE.Group();
    fist.position.copy(new THREE.Vector3(0, 0, -0.055).applyQuaternion(a.quaternion).add(new THREE.Vector3(0, 0, -0.01)));
    wrap.add(fist);
    const palm = new THREE.Mesh(fistGeo, this.skinM);
    palm.scale.set(0.042, 0.038, 0.052);
    fist.add(palm);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(fingerGeo, this.skinM);
      // согнутые пальцы обхватывают древко: лежат поперёк ладони спереди
      f.rotation.z = Math.PI / 2;
      f.position.set(-0.004 * side, 0.026 - i * 0.017, -0.038);
      f.scale.setScalar(1 - i * 0.07);
      fist.add(f);
    }
    const thumb = new THREE.Mesh(fingerGeo, this.skinM);
    thumb.rotation.set(0.4, 0, 0.6 * side);
    thumb.position.set(-0.032 * side, 0.03, -0.022);
    fist.add(thumb);
    if (holdsWand) {
      const shaft = new THREE.Mesh(wandGeo, this.wandM);
      this.wand.add(shaft);
      this.tip.position.set(0, 0.405, 0);
      this.wand.add(this.tip);
      // жезл из кулака вперёд, чуть вверх и к центру экрана
      this.wand.position.set(0, -0.045, -0.02);
      this.wand.rotation.set(-1.25, 0.0, 0.22);
      fist.add(this.wand);
    }
    return wrap;
  }

  setLook(l: ViewLook): void {
    this.skinM.color.set(l.skin);
    this.robeM.color.set(l.robe);
    this.trimM.color.set(l.trim);
    this.wandM.color.set(l.wand);
    (this.tip.material as THREE.MeshBasicMaterial).color.setHex(l.glow);
    this.tipGlow.material.color.setHex(l.glow);
  }

  kick(): void { this.castKick = 1; }

  tipWorld(out: THREE.Vector3): THREE.Vector3 { return this.tip.getWorldPosition(out); }

  update(dt: number, moving: number, sprint: boolean, cast: number, shielding: boolean, dodge: number): void {
    this.t += dt;
    const step = this.t * (sprint ? 11 : 8.5);
    const bobX = Math.sin(step) * 0.012 * moving;
    const bobY = Math.abs(Math.cos(step)) * 0.014 * moving + Math.sin(this.t * 1.6) * 0.004;
    this.castKick = Math.max(0, this.castKick - dt * 5);
    const k = Math.max(cast, this.castKick);
    // правая рука: выпад при касте
    this.right.position.set(0.23 + bobX - k * 0.05, -0.24 - bobY + k * 0.07 - dodge * 0.15, -0.46 - k * 0.12);
    this.right.rotation.set(k * 0.35, -k * 0.15, 0);
    // левая рука поднимается со щитом
    const shieldK = shielding ? 1 : 0;
    const lt = this.left.userData.k = ((this.left.userData.k as number | undefined) ?? 0) + (shieldK - ((this.left.userData.k as number | undefined) ?? 0)) * Math.min(1, dt * 12);
    this.left.visible = lt > 0.02;
    this.left.position.set(-0.3 + lt * 0.1 - bobX, -0.44 + lt * 0.2 - bobY, -0.44 - lt * 0.04);
    this.left.rotation.set(lt * 0.5, 0, -lt * 0.2);
    this.ward.visible = lt > 0.5;
    if (this.ward.visible) (this.ward.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(this.t * 8) * 0.08;
    this.tipGlow.scale.setScalar(0.08 + k * 0.12 + Math.sin(this.t * 5) * 0.01);
  }
}

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
