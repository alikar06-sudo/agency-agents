// Голоса и телосложение говорящих: пол, возраст, высота и темп речи.
// Используется озвучкой диалогов (core/voice.ts) и моделями персонажей (возраст, пол).

export type VoiceKind = 'human' | 'ghost' | 'mechanical' | 'abyss' | 'spirit' | 'narrator';

export interface VoiceProfile {
  gender: 'm' | 'f';
  age: 'child' | 'young' | 'adult' | 'old';
  pitch: number;   // 0.1..2 (1 — естественная высота голоса)
  rate: number;    // 0.5..1.6 (1 — обычный темп)
  kind?: VoiceKind;
}

export const VOICE_PROFILES: Record<string, VoiceProfile> = {
  // преподаватели и служащие
  veist: { gender: 'm', age: 'old', pitch: 0.78, rate: 0.86 },
  gravane: { gender: 'f', age: 'old', pitch: 0.92, rate: 0.98 },
  corvin: { gender: 'm', age: 'adult', pitch: 0.7, rate: 0.9 },
  pellinor: { gender: 'm', age: 'adult', pitch: 1.0, rate: 1.08 },
  lowe: { gender: 'm', age: 'old', pitch: 0.82, rate: 0.8 },
  dorn: { gender: 'm', age: 'adult', pitch: 0.8, rate: 1.06 },
  foxglove: { gender: 'f', age: 'adult', pitch: 1.05, rate: 1.0 },
  quill: { gender: 'f', age: 'old', pitch: 1.12, rate: 0.95 },
  mabel: { gender: 'f', age: 'adult', pitch: 1.0, rate: 0.98 },
  brassby: { gender: 'm', age: 'adult', pitch: 0.55, rate: 1.12, kind: 'mechanical' },
  ulrich: { gender: 'm', age: 'old', pitch: 0.72, rate: 0.92 },
  bran: { gender: 'm', age: 'adult', pitch: 0.62, rate: 0.95 },
  // ученики
  mira: { gender: 'f', age: 'young', pitch: 1.2, rate: 1.06 },
  toby: { gender: 'm', age: 'young', pitch: 1.12, rate: 1.1 },
  cassian: { gender: 'm', age: 'young', pitch: 0.98, rate: 0.96 },
  elodie: { gender: 'f', age: 'young', pitch: 1.25, rate: 1.12 },
  nico: { gender: 'm', age: 'young', pitch: 1.05, rate: 1.12 },
  agatha: { gender: 'f', age: 'young', pitch: 1.1, rate: 1.04 },
  ren: { gender: 'm', age: 'young', pitch: 0.96, rate: 1.0 },
  // деревня и долина
  tilda: { gender: 'f', age: 'adult', pitch: 1.08, rate: 1.06 },
  goran: { gender: 'm', age: 'adult', pitch: 0.66, rate: 0.94 },
  martha: { gender: 'f', age: 'adult', pitch: 1.02, rate: 1.02 },
  ivar: { gender: 'm', age: 'old', pitch: 0.7, rate: 0.85 },
  fin: { gender: 'm', age: 'child', pitch: 1.55, rate: 1.12 },
  olm: { gender: 'm', age: 'old', pitch: 0.64, rate: 0.82 },
  zane: { gender: 'm', age: 'adult', pitch: 0.92, rate: 1.1 },
  yalla: { gender: 'f', age: 'old', pitch: 0.95, rate: 0.88 },
  // сюжетные
  elias: { gender: 'm', age: 'old', pitch: 0.75, rate: 0.78, kind: 'ghost' },
  soren: { gender: 'm', age: 'adult', pitch: 0.68, rate: 0.88 },
  // бестелесные голоса
  hollow: { gender: 'm', age: 'adult', pitch: 0.1, rate: 0.72, kind: 'abyss' },
  mirror: { gender: 'f', age: 'adult', pitch: 1.35, rate: 0.82, kind: 'spirit' },
  lake_queen: { gender: 'f', age: 'young', pitch: 1.3, rate: 0.8, kind: 'spirit' },
  narrator: { gender: 'm', age: 'adult', pitch: 0.92, rate: 0.95, kind: 'narrator' },
};

// Голос героя зависит от выбранного обращения.
export function playerVoice(gender: 'm' | 'f'): VoiceProfile {
  return gender === 'f' ? { gender: 'f', age: 'young', pitch: 1.08, rate: 1.02 } : { gender: 'm', age: 'young', pitch: 0.95, rate: 1.02 };
}
