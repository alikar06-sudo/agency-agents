// Игровое время, календарь и погода.
import { G, mutate, hasGame } from '@/state/store';
import { bus } from '@/core/bus';
import { MONTHS, WEEKDAYS, WEEKDAYS_SHORT } from '@/data/world';
import { weekdayOf } from './logic';
import { absMinutes } from '@/state/gameState';
import type { ZoneId } from '@/data/types';

export const TIME_SCALE = 1; // игровых минут за реальную секунду
let acc = 0;

export function tickTime(dt: number): void {
  if (!hasGame()) return;
  acc += dt * TIME_SCALE;
  if (acc >= 1) {
    const whole = Math.floor(acc);
    acc -= whole;
    advanceTime(whole);
  }
}

export function advanceTime(minutes: number): void {
  if (minutes <= 0) return;
  const before = G().time;
  const startAbs = absMinutes(before);
  const endAbs = startAbs + minutes;
  const day = Math.floor(endAbs / 1440) + 1;
  const min = endAbs % 1440;
  mutate((g) => {
    g.time = { day, min };
    g.playTime += 0; // реальное время учитывается движком
    g.buffs = g.buffs.filter((b) => b.until > endAbs);
  });
  const h0 = Math.floor(startAbs / 60);
  const h1 = Math.floor(endAbs / 60);
  for (let h = h0 + 1; h <= h1 && h - h0 <= 48; h++) {
    bus.emit('hourChanged', { day: Math.floor(h / 24) + 1, hour: h % 24 });
  }
  if (day !== before.day) for (let d = before.day + 1; d <= day; d++) bus.emit('dayChanged', { day: d });
}

export function hour(): number { return G().time.min / 60; }
export function weekday(): number { return weekdayOf(G().time.day); }
export function isNight(h = hour()): boolean { return h >= 21 || h < 6; }
export function isCurfew(h = hour()): boolean { return h >= 22 || h < 6; }

export function clockString(min = G().time.min): string {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function dateString(day = G().time.day, short = false): string {
  const wd = weekdayOf(day);
  const monthIdx = Math.floor((day - 1) / 30) % MONTHS.length;
  const dom = ((day - 1) % 30) + 1;
  return `${short ? WEEKDAYS_SHORT[wd] : WEEKDAYS[wd]}, ${dom} ${MONTHS[monthIdx]}`;
}

export function partOfDay(h = hour()): string {
  if (h < 5) return 'Глубокая ночь';
  if (h < 8) return 'Рассвет';
  if (h < 12) return 'Утро';
  if (h < 17) return 'День';
  if (h < 21) return 'Вечер';
  return 'Ночь';
}

// 0 — ночь, 1 — полдень
export function daylight(h = hour()): number {
  if (h < 5 || h > 21) return 0;
  if (h < 8) return (h - 5) / 3;
  if (h > 18) return (21 - h) / 3;
  return 1;
}

export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog' | 'snow';

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function weatherFor(day: number): Weather {
  if (day === 1) return 'rain';
  if (day === 2) return 'clear';
  const r = hash(day);
  if (day >= 5 && r < 0.3) return 'snow';
  if (r < 0.48) return 'rain';
  if (r < 0.62) return 'fog';
  if (r < 0.78) return 'cloudy';
  return 'clear';
}

export function weatherName(w: Weather): string {
  return { clear: 'Ясно', cloudy: 'Облачно', rain: 'Дождь', fog: 'Туман', snow: 'Снег' }[w];
}

export function currentWeather(zone?: ZoneId): Weather {
  void zone;
  return weatherFor(G().time.day);
}

// Перемотка до утра (сон в спальне).
export function minutesUntil(hourTarget: number): number {
  const m = G().time.min;
  const target = hourTarget * 60;
  return m < target ? target - m : 1440 - m + target;
}

export function resetTimeAcc(): void { acc = 0; }
