// Озвучка реплик через Web Speech API (голоса операционной системы и браузера).
// Каждому говорящему подбирается свой русский голос, высота и темп; реплика читается по фразам,
// а слушатели получают события начала, слов (для «караоке» и движения губ) и окончания.
import type { VoiceProfile } from '@/data/voices';

export interface SpeakOptions {
  volume?: number;          // 0..1
  rate?: number;            // множитель темпа из настроек
  queue?: boolean;          // дождаться окончания текущей реплики
  onStart?: () => void;
  onWord?: (charIndex: number) => void;  // индекс символа в исходном тексте
  onEnd?: (finished: boolean) => void;
}

const FEMALE = /milena|irina|katya|katja|svetlana|dariya|daria|alyona|alena|anna|ekaterina|tatyana|elena|olga|maria|polina|google русский|female|жен/i;
const MALE = /yuri|pavel|dmitr|maxim|artem|nikolay|nikolai|aleksandr|alexander|male|муж/i;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Убрать из реплики то, что не произносится: метки проверок, ремарки в скобках, оформление.
export function speakableText(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/^\s*\([^)]*\)\s*$/g, ' ')
    .replace(/[«»"„“”]/g, '')
    .replace(/\s*—\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Job { text: string; profile: VoiceProfile; id: string; opts: SpeakOptions; cancelled: boolean }

class VoiceEngine {
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  private ru: SpeechSynthesisVoice[] = [];
  private queue: Job[] = [];
  private current: Job | null = null;
  private listeners = new Set<() => void>();
  speakerId: string | null = null;
  private wordPulse = 0;
  private startedAt = 0;

  constructor() {
    if (!this.supported) return;
    const load = () => {
      this.ru = speechSynthesis.getVoices().filter((v) => /^ru(-|_|$)/i.test(v.lang));
      this.listeners.forEach((f) => f());
    };
    load();
    speechSynthesis.addEventListener?.('voiceschanged', load);
  }

  get voices(): SpeechSynthesisVoice[] { return this.ru; }
  get available(): boolean { return this.supported && this.ru.length > 0; }
  get speaking(): boolean { return !!this.current; }

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  // Детерминированный выбор голоса: по полу, затем по хэшу имени говорящего.
  pickVoice(profile: VoiceProfile, id: string): SpeechSynthesisVoice | null {
    if (!this.ru.length) return null;
    const isF = (v: SpeechSynthesisVoice) => FEMALE.test(v.name) && !MALE.test(v.name);
    const isM = (v: SpeechSynthesisVoice) => MALE.test(v.name);
    const same = this.ru.filter((v) => (profile.gender === 'f' ? isF(v) : isM(v)));
    // естественные (облачные) голоса Edge/Chrome звучат лучше — предпочитаем их
    const pool = same.length ? same : this.ru;
    const natural = pool.filter((v) => /natural|online|google/i.test(v.name));
    const list = natural.length ? natural : pool;
    return list[hash(id) % list.length];
  }

  // Если у пола нет «своего» голоса, высоту подгоняем: мужчина на женском голосе — ниже, и наоборот.
  private pitchFor(profile: VoiceProfile, voice: SpeechSynthesisVoice | null): number {
    let p = profile.pitch;
    if (voice) {
      const female = FEMALE.test(voice.name) && !MALE.test(voice.name);
      const male = MALE.test(voice.name);
      if (profile.gender === 'm' && female) p *= 0.62;
      if (profile.gender === 'f' && male) p *= 1.45;
    }
    return Math.max(0.05, Math.min(2, p));
  }

  speak(text: string, profile: VoiceProfile, id: string, opts: SpeakOptions = {}): void {
    const clean = speakableText(text);
    if (!this.available || !clean) { opts.onStart?.(); opts.onEnd?.(false); return; }
    const job: Job = { text, profile, id, opts, cancelled: false };
    if (!opts.queue) this.stop();
    this.queue.push(job);
    if (!this.current) this.next();
  }

  stop(): void {
    for (const j of this.queue) { j.cancelled = true; j.opts.onEnd?.(false); }
    this.queue = [];
    if (this.current) { const c = this.current; c.cancelled = true; this.current = null; c.opts.onEnd?.(false); }
    this.speakerId = null;
    if (this.supported) speechSynthesis.cancel();
  }

  // Открытость рта говорящего 0..1 (для движения губ моделей).
  mouth(id: string, t: number): number {
    if (this.speakerId !== id) return 0;
    this.wordPulse = Math.max(0, this.wordPulse - 0.04);
    const base = 0.35 + 0.35 * Math.abs(Math.sin(t * 13.0)) * (0.6 + 0.4 * Math.sin(t * 3.1));
    return Math.min(1, base + this.wordPulse);
  }

  private next(): void {
    const job = this.queue.shift();
    if (!job) { this.current = null; this.speakerId = null; return; }
    this.current = job;
    this.speakerId = job.id;
    const voice = this.pickVoice(job.profile, job.id);
    const rate = Math.max(0.5, Math.min(1.8, job.profile.rate * (job.opts.rate ?? 1)));
    const pitch = this.pitchFor(job.profile, voice);
    // длинные реплики делим на фразы: Chrome обрывает высказывания длиннее ~15 секунд
    const chunks = splitPhrases(job.text);
    let i = 0;
    let started = false;
    const sayNext = () => {
      if (job.cancelled) return;
      if (i >= chunks.length) {
        this.current = null;
        this.speakerId = null;
        job.opts.onEnd?.(true);
        this.next();
        return;
      }
      const ch = chunks[i++];
      const spoken = speakableText(ch.text);
      if (!spoken) { sayNext(); return; }
      const u = new SpeechSynthesisUtterance(spoken);
      u.lang = voice?.lang ?? 'ru-RU';
      if (voice) u.voice = voice;
      u.rate = rate;
      u.pitch = pitch;
      u.volume = Math.max(0, Math.min(1, job.opts.volume ?? 1));
      u.onstart = () => {
        if (!started) { started = true; this.startedAt = performance.now(); job.opts.onStart?.(); }
        job.opts.onWord?.(ch.offset);
      };
      u.onboundary = (e) => {
        this.wordPulse = 0.35;
        // индекс в очищенной фразе приблизительно соответствует исходной (меняются только кавычки и скобки)
        job.opts.onWord?.(ch.offset + Math.min(ch.text.length, e.charIndex + (e.charLength || 4)));
      };
      u.onend = () => { if (!job.cancelled) { job.opts.onWord?.(ch.offset + ch.text.length); sayNext(); } };
      u.onerror = () => { if (!job.cancelled) sayNext(); };
      speechSynthesis.speak(u);
    };
    sayNext();
  }
}

function splitPhrases(text: string): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  const re = /[^.!?…]+[.!?…]*\s*/g;
  let m: RegExpExecArray | null;
  let buf = '', start = 0;
  while ((m = re.exec(text))) {
    if (!buf) start = m.index;
    buf += m[0];
    if (buf.length > 90 || re.lastIndex >= text.length) { out.push({ text: buf, offset: start }); buf = ''; }
  }
  if (buf) out.push({ text: buf, offset: start });
  return out.length ? out : [{ text, offset: 0 }];
}

export const voice = new VoiceEngine();
