// Сохранения. Репозиторий-интерфейс позволяет заменить хранилище (localStorage → сервер → БД) без правок игры.
import type { GameState } from '@/state/gameState';
import { migrateSave } from '@/state/gameState';
import { G, hasGame, mutate, setUI, toast, ui } from '@/state/store';
import { ZONES } from '@/data/zones';
import { CIRCLES } from '@/data/world';
import { STATIC_BUILD } from '@/core/env';

export interface SaveMeta {
  slot: string;
  name: string;
  level: number;
  zone: string;
  zoneName: string;
  day: number;
  min: number;
  playTime: number;
  updatedAt: number;
  circle: string;
  act: number;
  source: 'local' | 'cloud';
}

export interface SaveRepository {
  readonly kind: 'local' | 'cloud';
  list(): Promise<SaveMeta[]>;
  load(slot: string): Promise<GameState | null>;
  save(slot: string, state: GameState): Promise<void>;
  remove(slot: string): Promise<void>;
}

export const SLOTS = ['auto', '1', '2', '3'] as const;
export const SLOT_NAMES: Record<string, string> = { auto: 'Автосохранение', '1': 'Ячейка I', '2': 'Ячейка II', '3': 'Ячейка III' };

export function metaOf(slot: string, s: GameState, source: 'local' | 'cloud'): SaveMeta {
  return {
    slot, source,
    name: s.player.name, level: s.player.level, zone: s.pos.zone, zoneName: ZONES[s.pos.zone]?.name ?? s.pos.zone,
    day: s.time.day, min: s.time.min, playTime: s.playTime, updatedAt: s.updatedAt,
    circle: CIRCLES[s.player.circle]?.short ?? '', act: s.act,
  };
}

// ---------- localStorage ----------

const LOCAL_PREFIX = 'aethermoor.save.';

export class LocalSaveRepository implements SaveRepository {
  readonly kind = 'local' as const;
  async list(): Promise<SaveMeta[]> {
    const out: SaveMeta[] = [];
    for (const slot of SLOTS) {
      const s = await this.load(slot);
      if (s) out.push(metaOf(slot, s, 'local'));
    }
    return out;
  }
  async load(slot: string): Promise<GameState | null> {
    try {
      const raw = localStorage.getItem(LOCAL_PREFIX + slot);
      return raw ? migrateSave(JSON.parse(raw)) : null;
    } catch { return null; }
  }
  async save(slot: string, state: GameState): Promise<void> {
    localStorage.setItem(LOCAL_PREFIX + slot, JSON.stringify(state));
  }
  async remove(slot: string): Promise<void> {
    localStorage.removeItem(LOCAL_PREFIX + slot);
  }
}

// ---------- сервер (server/server.mjs) ----------

interface Profile { id: string; token: string; displayName: string }
const PROFILE_KEY = 'aethermoor.profile.v1';

function readProfile(): Profile | null {
  try { const raw = localStorage.getItem(PROFILE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeProfile(p: Profile): void {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export class RemoteSaveRepository implements SaveRepository {
  readonly kind = 'cloud' as const;
  constructor(private profile: Profile, private base = '/api') {}
  private headers(): Record<string, string> {
    return { 'content-type': 'application/json', 'x-player-id': this.profile.id, 'x-player-token': this.profile.token };
  }
  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(this.base + path, { ...init, headers: this.headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status === 204 ? (undefined as T) : res.json();
  }
  async list(): Promise<SaveMeta[]> {
    const body = await this.req<{ saves: SaveMeta[] }>('/saves');
    return body.saves.map((m) => ({ ...m, source: 'cloud' as const }));
  }
  async load(slot: string): Promise<GameState | null> {
    try {
      const body = await this.req<{ state: unknown }>(`/saves/${encodeURIComponent(slot)}`);
      return migrateSave(body.state);
    } catch { return null; }
  }
  async save(slot: string, state: GameState): Promise<void> {
    await this.req(`/saves/${encodeURIComponent(slot)}`, { method: 'PUT', body: JSON.stringify({ state, meta: metaOf(slot, state, 'cloud') }) });
  }
  async remove(slot: string): Promise<void> {
    await this.req(`/saves/${encodeURIComponent(slot)}`, { method: 'DELETE' });
  }
}

// ---------- сервис ----------

const local = new LocalSaveRepository();
let remote: RemoteSaveRepository | null = null;
let lastAuto = 0;

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 1500): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}

export async function initSaves(): Promise<void> {
  if (STATIC_BUILD) { remote = null; setUI({ cloud: 'offline' }); return; }
  try {
    const res = await fetchWithTimeout('/api/health');
    if (!res.ok) throw new Error('offline');
    const health = await res.json();
    if (!health?.ok) throw new Error('offline');
    let profile = readProfile();
    if (profile) {
      const check = await fetchWithTimeout('/api/profile', { headers: { 'x-player-id': profile.id, 'x-player-token': profile.token } });
      if (!check.ok) profile = null;
    }
    if (!profile) {
      const created = await fetchWithTimeout('/api/profile', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: 'Гость' }),
      });
      if (!created.ok) throw new Error('profile');
      profile = await created.json() as Profile;
      writeProfile(profile);
    }
    remote = new RemoteSaveRepository(profile);
    setUI({ cloud: 'online' });
  } catch {
    remote = null;
    setUI({ cloud: 'offline' });
  }
}

export async function updateProfileName(name: string): Promise<void> {
  const p = readProfile();
  if (!p || !remote) return;
  p.displayName = name;
  writeProfile(p);
  try {
    await fetch('/api/profile', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-player-id': p.id, 'x-player-token': p.token }, body: JSON.stringify({ displayName: name }) });
  } catch { /* не критично */ }
}

export async function saveGame(slot: string, quiet = false): Promise<boolean> {
  if (!hasGame()) return false;
  mutate((g) => { g.updatedAt = Date.now(); });
  const state = G();
  try {
    await local.save(slot, state);
  } catch {
    toast('warn', 'Не удалось сохранить', 'Хранилище браузера недоступно или переполнено');
    return false;
  }
  if (remote) {
    remote.save(slot, state).catch(() => {
      setUI({ cloud: 'offline' });
      if (!quiet) toast('warn', 'Облако недоступно', 'Сохранено только в браузере');
    });
  }
  if (!quiet) toast('info', 'Игра сохранена', `${SLOT_NAMES[slot] ?? slot}${remote ? ' · копия в облаке' : ''}`);
  return true;
}

// Синхронная запись автосохранения (перед перезагрузкой страницы).
export function saveLocalNow(): void {
  if (!hasGame()) return;
  try {
    mutate((g) => { g.updatedAt = Date.now(); });
    localStorage.setItem(LOCAL_PREFIX + 'auto', JSON.stringify(G()));
  } catch { /* хранилище недоступно */ }
}

export function autosave(force = false): void {
  const now = Date.now();
  if (!force && now - lastAuto < 15000) return;
  if (ui().screen !== 'game') return;
  lastAuto = now;
  void saveGame('auto', true);
}

export async function listSaves(): Promise<SaveMeta[]> {
  const byLocal = await local.list();
  let byRemote: SaveMeta[] = [];
  if (remote) { try { byRemote = await remote.list(); } catch { byRemote = []; } }
  const map = new Map<string, SaveMeta>();
  for (const m of [...byLocal, ...byRemote]) {
    const cur = map.get(m.slot);
    if (!cur || m.updatedAt > cur.updatedAt) map.set(m.slot, m);
  }
  return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadSave(slot: string): Promise<GameState | null> {
  const a = await local.load(slot);
  let b: GameState | null = null;
  if (remote) b = await remote.load(slot);
  if (a && b) return a.updatedAt >= b.updatedAt ? a : b;
  return a ?? b;
}

export async function deleteSave(slot: string): Promise<void> {
  await local.remove(slot);
  if (remote) { try { await remote.remove(slot); } catch { /* ignore */ } }
}

export async function latestSave(): Promise<SaveMeta | null> {
  const all = await listSaves();
  return all[0] ?? null;
}
