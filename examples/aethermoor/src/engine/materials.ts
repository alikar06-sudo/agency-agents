// Общие материалы и шейдерная «прорезь» стен между камерой и героем.
import * as THREE from 'three';

export const cutaway = {
  uFocus: { value: new THREE.Vector3() },
  uCut: { value: 1 },
  uTime: { value: 0 },
};

// Добавляет к стандартному материалу отсечение фрагментов, загораживающих героя.
export function withCutaway<T extends THREE.Material>(mat: T, strength = 1): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFocus = cutaway.uFocus;
    shader.uniforms.uCut = cutaway.uCut;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutWorld;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 cutWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cutWp = instanceMatrix * cutWp;
        #endif
        cutWp = modelMatrix * cutWp;
        vCutWorld = cutWp.xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutWorld;\nuniform vec3 uFocus;\nuniform float uCut;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (uCut > 0.5) {
          vec3 cd = vCutWorld - uFocus;
          if (cd.z > 0.45 && cd.z < 11.0 && vCutWorld.y > uFocus.y + ${(0.35 / strength).toFixed(2)}) {
            float halfW = 2.4 + cd.z * 0.18;
            float ax = abs(cd.x);
            float k = smoothstep(halfW, halfW - 1.1, ax);
            float n = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
            if (n < k * 0.97) discard;
          }
        }`);
  };
  mat.customProgramCacheKey = () => 'cutaway' + strength;
  return mat;
}

const matCache = new Map<string, THREE.Material>();

export function stdMat(key: string, make: () => THREE.Material): THREE.Material {
  let m = matCache.get(key);
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}

export function colorMat(color: number | string, opts: { rough?: number; metal?: number; emissive?: number | string; ei?: number; cut?: boolean; flat?: boolean } = {}): THREE.MeshStandardMaterial {
  const key = `c_${color}_${opts.rough ?? 0.8}_${opts.metal ?? 0}_${opts.emissive ?? 0}_${opts.ei ?? 0}_${opts.cut ? 1 : 0}_${opts.flat ? 1 : 0}`;
  return stdMat(key, () => {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: opts.rough ?? 0.8, metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1, flatShading: opts.flat ?? false,
    });
    return opts.cut ? withCutaway(m) : m;
  }) as THREE.MeshStandardMaterial;
}

export function glowMat(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return stdMat(`glow_${color}_${opacity}`, () => new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  })) as THREE.MeshBasicMaterial;
}

export function disposeMaterialCache(): void {
  // материалы общие для всех зон — не освобождаем между переходами
}
