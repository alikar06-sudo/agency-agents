// Портреты для диалогов и журнала: рендерим голову 3D-модели в картинку и кешируем.
import * as THREE from 'three';
import type { Appearance } from '@/data/types';
import { buildCharacter } from '@/engine/models';
import { VOICE_PROFILES } from '@/data/voices';
import { G, hasGame } from '@/state/store';

const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;

function setup(): void {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(192, 192, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  const key = new THREE.DirectionalLight(0xffe6c8, 2.4);
  key.position.set(1.5, 2.5, 3);
  const rim = new THREE.DirectionalLight(0x8ab0ff, 1.6);
  rim.position.set(-2, 1.5, -2);
  scene.add(key, rim, new THREE.HemisphereLight(0x8a7aa8, 0x1a1420, 0.9));
}

export function portrait(key: string, a: Appearance): string {
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    if (!renderer) setup();
    // пол и возраст: у NPC — из профиля голоса, у героя — из выбранного обращения
    const look: Appearance = { ...a };
    if (!look.gender && key.startsWith('npc_')) { const v = VOICE_PROFILES[key.slice(4)]; if (v) { look.gender = v.gender; look.age = v.age; } }
    if (!look.gender && key.startsWith('player_') && hasGame()) { look.gender = G().player.gender === 'f' ? 'f' : 'm'; look.age = 'young'; }
    const rig = buildCharacter(look);
    rig.wand.visible = false;
    rig.root.rotation.y = 0.22;
    scene.add(rig.root);
    rig.root.updateMatrixWorld(true);
    const chin = new THREE.Vector3(), crown = new THREE.Vector3();
    rig.head.getWorldPosition(chin);
    rig.hatSlot.getWorldPosition(crown);
    const headH = crown.y - chin.y;
    const cy = chin.y + headH * 0.45;
    camera.position.set(headH * 1.1, cy + headH * 0.12, headH * 5.6);
    camera.lookAt(0, cy - headH * 0.05, 0);
    renderer!.render(scene, camera);
    const url = renderer!.domElement.toDataURL('image/png');
    scene.remove(rig.root);
    cache.set(key, url);
    return url;
  } catch {
    return '';
  }
}

export function clearPortrait(key: string): void { cache.delete(key); }
