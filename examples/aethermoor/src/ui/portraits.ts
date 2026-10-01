// Портреты для диалогов и журнала: рендерим голову 3D-модели в картинку и кешируем.
import * as THREE from 'three';
import type { Appearance } from '@/data/types';
import { buildCharacter } from '@/engine/models';

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
    const rig = buildCharacter(a);
    rig.wand.visible = false;
    scene.add(rig.root);
    const headY = 1.42 * (a.height ?? 1) + 0.08;
    camera.position.set(0.32, headY + 0.08, 1.45);
    camera.lookAt(0, headY, 0);
    rig.root.rotation.y = 0.18;
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
