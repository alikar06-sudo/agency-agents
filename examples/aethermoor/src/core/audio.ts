// Звуковой движок на Web Audio API.
// Музыка, эмбиент и эффекты синтезируются процедурно. Если в public/audio/manifest.json
// указан файл для идентификатора (например "sfx.spark" или "music.castle"), будет играть он.
import { STATIC_BUILD } from './env';

type Mood = 'title' | 'castle' | 'library' | 'dungeon' | 'forest' | 'village' | 'lake' | 'ruins' | 'sanctum' | 'night' | 'combat' | 'boss' | 'silence';

interface MoodDef {
  root: number; scale: number[]; bpm: number; prog: number[][];
  pad: number; arp: 'pluck' | 'bell' | null; arpDensity: number; melody: 'flute' | 'bell' | null;
  bass: number; drums: 0 | 1 | 2; choir?: number; drone?: number; bright?: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

const MOODS: Record<Exclude<Mood, 'silence'>, MoodDef> = {
  title: { root: 50, scale: MINOR, bpm: 58, prog: [[0, 2, 4], [5, 0, 2], [2, 4, 6], [6, 1, 3]], pad: 0.5, arp: 'bell', arpDensity: 0.28, melody: 'flute', bass: 0.35, drums: 0, choir: 0.25 },
  castle: { root: 50, scale: DORIAN, bpm: 68, prog: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4], [5, 0, 2], [3, 5, 0]], pad: 0.38, arp: 'pluck', arpDensity: 0.5, melody: 'flute', bass: 0.3, drums: 0 },
  library: { root: 53, scale: LYDIAN, bpm: 54, prog: [[0, 2, 4], [1, 3, 5], [4, 6, 1], [0, 2, 4]], pad: 0.3, arp: 'bell', arpDensity: 0.32, melody: null, bass: 0.2, drums: 0 },
  dungeon: { root: 48, scale: PHRYG, bpm: 48, prog: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 1, 3]], pad: 0.32, arp: 'bell', arpDensity: 0.12, melody: null, bass: 0.4, drums: 0, drone: 0.25 },
  forest: { root: 52, scale: MINOR, bpm: 64, prog: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], pad: 0.3, arp: 'pluck', arpDensity: 0.38, melody: 'flute', bass: 0.25, drums: 0 },
  village: { root: 55, scale: MAJOR, bpm: 92, prog: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4], [5, 0, 2], [4, 6, 1]], pad: 0.22, arp: 'pluck', arpDensity: 0.7, melody: 'flute', bass: 0.35, drums: 1, bright: 1 },
  lake: { root: 57, scale: MINOR, bpm: 50, prog: [[0, 2, 4], [5, 0, 2], [6, 1, 3], [3, 5, 0]], pad: 0.42, arp: 'bell', arpDensity: 0.22, melody: null, bass: 0.2, drums: 0, choir: 0.2 },
  ruins: { root: 52, scale: PHRYG, bpm: 46, prog: [[0, 2, 4], [1, 3, 5], [5, 0, 2], [1, 3, 5]], pad: 0.35, arp: 'bell', arpDensity: 0.16, melody: null, bass: 0.35, drums: 0, choir: 0.15, drone: 0.2 },
  sanctum: { root: 48, scale: MINOR, bpm: 44, prog: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [5, 0, 2]], pad: 0.4, arp: 'bell', arpDensity: 0.1, melody: null, bass: 0.45, drums: 0, choir: 0.35, drone: 0.35 },
  night: { root: 50, scale: DORIAN, bpm: 52, prog: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], pad: 0.3, arp: 'bell', arpDensity: 0.18, melody: null, bass: 0.22, drums: 0 },
  combat: { root: 50, scale: MINOR, bpm: 124, prog: [[0, 2, 4], [0, 2, 4], [5, 0, 2], [6, 1, 3]], pad: 0.22, arp: 'pluck', arpDensity: 0.9, melody: null, bass: 0.5, drums: 1 },
  boss: { root: 49, scale: PHRYG, bpm: 136, prog: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 1, 3]], pad: 0.3, arp: 'pluck', arpDensity: 1, melody: null, bass: 0.6, drums: 2, choir: 0.3 },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Layer { stop: () => void }

export interface AudioVolumes { master: number; music: number; sfx: number; ambient: number }

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noiseBuf!: AudioBuffer;
  private brownBuf!: AudioBuffer;
  private assets = new Map<string, AudioBuffer>();
  private manifest: Record<string, string> = {};
  private mood: Mood = 'silence';
  private moodGain: GainNode | null = null;
  private assetMusic: AudioBufferSourceNode | null = null;
  private nextStep = 0;
  private step = 0;
  private melodyIdx = 3;
  private timer: number | null = null;
  private ambient = new Map<string, Layer>();
  private listener = { x: 0, z: 0 };
  private vol: AudioVolumes = { master: 0.8, music: 0.55, sfx: 0.8, ambient: 0.6 };
  private lastPlay = new Map<string, number>();

  init(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(3.2, 2.4);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.5;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.noiseBuf = this.makeNoise(false);
    this.brownBuf = this.makeNoise(true);
    this.applyVolumes();
    void this.loadManifest();
    this.timer = window.setInterval(() => this.schedule(), 90);
  }

  private async loadManifest(): Promise<void> {
    if (STATIC_BUILD) return;
    try {
      const res = await fetch(new URL('audio/manifest.json', document.baseURI));
      if (!res.ok) return;
      this.manifest = await res.json();
      for (const [id, file] of Object.entries(this.manifest)) {
        try {
          const buf = await (await fetch(new URL('audio/' + file, document.baseURI))).arrayBuffer();
          this.assets.set(id, await this.ctx!.decodeAudioData(buf));
        } catch { /* файл отсутствует — останется синтез */ }
      }
    } catch { /* манифеста нет — работаем на синтезе */ }
  }

  setVolumes(v: AudioVolumes): void { this.vol = v; this.applyVolumes(); }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.8, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.ambient * 0.7, t, 0.05);
  }

  setListener(x: number, z: number): void { this.listener.x = x; this.listener.z = z; }

  private makeNoise(brown: boolean): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ---------------- Музыка ----------------

  setMusic(mood: Mood): void {
    if (!this.ctx || mood === this.mood) return;
    const ctx = this.ctx;
    const old = this.moodGain;
    if (old) {
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
      setTimeout(() => old.disconnect(), 4000);
    }
    if (this.assetMusic) {
      const a = this.assetMusic;
      setTimeout(() => { try { a.stop(); } catch { /* ignore */ } }, 3000);
      this.assetMusic = null;
    }
    this.mood = mood;
    if (mood === 'silence') { this.moodGain = null; return; }
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(1, ctx.currentTime + 0.3, 1.2);
    g.connect(this.musicBus);
    const send = ctx.createGain();
    send.gain.value = 0.6;
    g.connect(send).connect(this.reverbSend);
    this.moodGain = g;
    const asset = this.assets.get('music.' + mood);
    if (asset) {
      const src = ctx.createBufferSource();
      src.buffer = asset; src.loop = true; src.connect(g); src.start();
      this.assetMusic = src;
      return;
    }
    this.nextStep = ctx.currentTime + 0.1;
    this.step = 0;
  }

  getMood(): Mood { return this.mood; }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || this.mood === 'silence' || !this.moodGain || this.assetMusic) return;
    const m = MOODS[this.mood as Exclude<Mood, 'silence'>];
    const stepDur = 60 / m.bpm / 2;
    while (this.nextStep < ctx.currentTime + 0.35) {
      this.playStep(m, this.step, this.nextStep, stepDur);
      this.step++;
      this.nextStep += stepDur;
    }
  }

  private degree(m: MoodDef, deg: number, octave = 0): number {
    const n = m.scale.length;
    const o = Math.floor(deg / n);
    const d = ((deg % n) + n) % n;
    return m.root + m.scale[d] + 12 * (o + octave);
  }

  private playStep(m: MoodDef, step: number, t: number, sd: number): void {
    const out = this.moodGain!;
    const barSteps = 8;
    const chordIdx = Math.floor(step / (barSteps * 2)) % m.prog.length;
    const chord = m.prog[chordIdx];
    const inBar = step % barSteps;
    if (step % (barSteps * 2) === 0) {
      if (m.pad > 0) this.pad(chord.map((d) => mtof(this.degree(m, d))), t, sd * barSteps * 2, m.pad * 0.06, out, m.bright);
      if (m.choir) this.choir(chord.map((d) => mtof(this.degree(m, d, 1))), t, sd * barSteps * 2, m.choir * 0.05, out);
      if (m.drone) this.drone(mtof(m.root - 12), t, sd * barSteps * 2, m.drone * 0.1, out);
    }
    if (m.bass > 0 && (inBar === 0 || (m.drums && inBar === 4))) {
      this.bassNote(mtof(this.degree(m, chord[0], -1)), t, sd * (m.drums ? 3 : 7), m.bass * 0.14, out);
    }
    if (m.arp && Math.random() < m.arpDensity) {
      const deg = chord[(step + Math.floor(Math.random() * 2)) % chord.length] + (Math.random() < 0.3 ? 7 : 0);
      const f = mtof(this.degree(m, deg, 1));
      if (m.arp === 'pluck') this.pluck(f, t, 0.06, out); else this.bell(f, t, 0.035, out);
    }
    if (m.melody && inBar % 2 === 0 && Math.random() < 0.42) {
      this.melodyIdx += Math.floor(Math.random() * 5) - 2;
      this.melodyIdx = Math.max(0, Math.min(11, this.melodyIdx));
      const f = mtof(this.degree(m, this.melodyIdx, 1));
      if (m.melody === 'flute') this.flute(f, t, sd * (1 + Math.floor(Math.random() * 3)), 0.035, out);
      else this.bell(f, t, 0.03, out);
    }
    if (m.drums) {
      if (inBar === 0 || inBar === 4 || (m.drums === 2 && inBar === 6)) this.kick(t, 0.5, out);
      if (inBar === 2 || inBar === 6) this.snare(t, m.drums === 2 ? 0.2 : 0.12, out);
      if (m.drums === 2 || inBar % 2 === 1) this.hat(t, 0.04, out);
    }
  }

  private pad(freqs: number[], t: number, dur: number, vol: number, out: AudioNode, bright = 0): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700 + bright * 600; lp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(2, dur * 0.3));
    g.gain.setValueAtTime(vol, t + dur * 0.75);
    g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
    lp.connect(g).connect(out);
    for (const f of freqs) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + dur + 1.6);
      }
    }
  }

  private choir(freqs: number[], t: number, dur: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 2.5);
    g.gain.linearRampToValueAtTime(0, t + dur + 1);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 720; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 6;
    f1.connect(g); f2.connect(g); g.connect(out);
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      const vib = ctx.createOscillator(); vib.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = 3;
      vib.connect(vg).connect(o.frequency);
      o.connect(f1); o.connect(f2);
      o.start(t); o.stop(t + dur + 1.1); vib.start(t); vib.stop(t + dur + 1.1);
    }
  }

  private drone(f: number, t: number, dur: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 2);
    g.gain.linearRampToValueAtTime(0, t + dur + 1);
    g.connect(out);
    for (const m of [1, 1.5, 2.003]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
      o.connect(g); o.start(t); o.stop(t + dur + 1.1);
    }
  }

  private bassNote(f: number, t: number, dur: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }

  private pluck(f: number, t: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 1.4);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(out);
    o.start(t); o.stop(t + 1.5); o2.start(t); o2.stop(t + 1.5);
  }

  private bell(f: number, t: number, vol: number, out: AudioNode, decay = 2.8): void {
    const ctx = this.ctx!;
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 3.5;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.8, t); mg.gain.exponentialRampToValueAtTime(1, t + decay * 0.6);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0004, t + decay);
    car.connect(g).connect(out);
    car.start(t); mod.start(t); car.stop(t + decay + 0.1); mod.stop(t + decay + 0.1);
  }

  private flute(f: number, t: number, dur: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.008, t + dur * 0.6);
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.08);
    g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur + 0.2);
    const breath = ctx.createBufferSource(); breath.buffer = this.noiseBuf;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = f * 2; bf.Q.value = 3;
    const bg = ctx.createGain(); bg.gain.value = 0.18;
    breath.connect(bf).connect(bg).connect(g);
    o.connect(g).connect(out);
    o.start(t); vib.start(t); breath.start(t);
    o.stop(t + dur + 0.3); vib.stop(t + dur + 0.3); breath.stop(t + dur + 0.3);
  }

  private kick(t: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);
  }

  private snare(t: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + 0.2);
  }

  private hat(t: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + 0.06);
  }

  // ---------------- Эмбиент ----------------

  setAmbient(keys: string[]): void {
    if (!this.ctx) return;
    for (const [k, layer] of this.ambient) {
      if (!keys.includes(k)) { layer.stop(); this.ambient.delete(k); }
    }
    for (const k of keys) if (!this.ambient.has(k)) {
      const l = this.makeAmbient(k);
      if (l) this.ambient.set(k, l);
    }
  }

  private noiseLayer(brown: boolean, filters: { type: BiquadFilterType; f: number; q?: number }[], vol: number, lfo?: { rate: number; depth: number }): Layer {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = brown ? this.brownBuf : this.noiseBuf; src.loop = true;
    let node: AudioNode = src;
    let firstFilter: BiquadFilterNode | null = null;
    for (const f of filters) {
      const bq = ctx.createBiquadFilter(); bq.type = f.type; bq.frequency.value = f.f; if (f.q) bq.Q.value = f.q;
      node.connect(bq); node = bq; if (!firstFilter) firstFilter = bq;
    }
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(vol, ctx.currentTime, 1.2);
    node.connect(g).connect(this.ambBus);
    let lfoOsc: OscillatorNode | null = null;
    if (lfo) {
      lfoOsc = ctx.createOscillator(); lfoOsc.frequency.value = lfo.rate;
      const lg = ctx.createGain(); lg.gain.value = vol * lfo.depth;
      lfoOsc.connect(lg).connect(g.gain); lfoOsc.start();
    }
    src.start(0, Math.random() * 1.5);
    return {
      stop: () => {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
        setTimeout(() => { try { src.stop(); lfoOsc?.stop(); } catch { /* ignore */ } g.disconnect(); }, 3500);
      },
    };
  }

  private intervalLayer(fn: () => void, min: number, max: number): Layer {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      fn();
      setTimeout(loop, min + Math.random() * (max - min));
    };
    setTimeout(loop, min * Math.random());
    return { stop: () => { alive = false; } };
  }

  private makeAmbient(k: string): Layer | null {
    const asset = this.assets.get('amb.' + k);
    if (asset && this.ctx) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource(); src.buffer = asset; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.6, ctx.currentTime, 1);
      src.connect(g).connect(this.ambBus); src.start();
      return { stop: () => { g.gain.setTargetAtTime(0, ctx.currentTime, 0.8); setTimeout(() => { try { src.stop(); } catch { /* ignore */ } }, 3000); } };
    }
    switch (k) {
      case 'wind': return this.noiseLayer(true, [{ type: 'bandpass', f: 380, q: 0.7 }], 0.22, { rate: 0.07, depth: 0.6 });
      case 'rain': {
        const a = this.noiseLayer(false, [{ type: 'highpass', f: 900 }, { type: 'lowpass', f: 7000 }], 0.09);
        const b = this.intervalLayer(() => this.drop(0.04, 2400 + Math.random() * 2000), 60, 220);
        return { stop: () => { a.stop(); b.stop(); } };
      }
      case 'fire': {
        const a = this.noiseLayer(true, [{ type: 'lowpass', f: 500 }], 0.12, { rate: 0.6, depth: 0.4 });
        const b = this.intervalLayer(() => this.crackle(), 80, 400);
        return { stop: () => { a.stop(); b.stop(); } };
      }
      case 'water': return this.noiseLayer(true, [{ type: 'bandpass', f: 520, q: 0.9 }], 0.16, { rate: 0.25, depth: 0.7 });
      case 'drip': return this.intervalLayer(() => this.drop(0.05, 900 + Math.random() * 900), 900, 3200);
      case 'birds': return this.intervalLayer(() => this.chirp(), 1800, 5200);
      case 'crickets': return this.intervalLayer(() => this.cricket(), 400, 1400);
      case 'owl': return this.intervalLayer(() => this.owl(), 9000, 20000);
      case 'crowd': return this.noiseLayer(true, [{ type: 'bandpass', f: 600, q: 1.5 }], 0.08, { rate: 0.9, depth: 0.5 });
      case 'hum': {
        const ctx = this.ctx!;
        const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.05, ctx.currentTime, 2);
        const os = [55, 55.7, 82.5].map((f) => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(); return o; });
        g.connect(this.ambBus);
        return { stop: () => { g.gain.setTargetAtTime(0, ctx.currentTime, 0.8); setTimeout(() => os.forEach((o) => o.stop()), 3000); } };
      }
      default: return null;
    }
  }

  private drop(vol: number, f: number): void {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
    o.connect(g).connect(this.ambBus); o.start(t); o.stop(t + 0.15);
    const s = ctx.createGain(); s.gain.value = 0.4; g.connect(s).connect(this.reverbSend);
  }

  private crackle(): void {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.08 * Math.random(), t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03);
    n.connect(f).connect(g).connect(this.ambBus); n.start(t, Math.random()); n.stop(t + 0.04);
  }

  private chirp(): void {
    const ctx = this.ctx!; let t = ctx.currentTime;
    const base = 2600 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.06);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
      o.connect(g).connect(this.ambBus); o.start(t); o.stop(t + 0.1);
      t += 0.09 + Math.random() * 0.05;
    }
  }

  private cricket(): void {
    const ctx = this.ctx!; let t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.frequency.value = 4400;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 0.01); g.gain.linearRampToValueAtTime(0, t + 0.04);
      o.connect(g).connect(this.ambBus); o.start(t); o.stop(t + 0.05); t += 0.06;
    }
  }

  private owl(): void {
    const ctx = this.ctx!; let t = ctx.currentTime;
    for (const d of [0.35, 0.6]) {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(420, t); o.frequency.linearRampToValueAtTime(380, t + d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.08); g.gain.linearRampToValueAtTime(0, t + d);
      o.connect(g).connect(this.ambBus); const s = ctx.createGain(); s.gain.value = 0.7; g.connect(s).connect(this.reverbSend);
      o.start(t); o.stop(t + d + 0.05); t += d + 0.15;
    }
  }

  // ---------------- Эффекты ----------------

  play(id: string, opts: { x?: number; z?: number; volume?: number; pitch?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = performance.now();
    const last = this.lastPlay.get(id) ?? 0;
    if (now - last < 35) return; // защита от «пулемёта» одинаковых звуков
    this.lastPlay.set(id, now);
    let vol = opts.volume ?? 1;
    const out = ctx.createGain();
    if (opts.x !== undefined && opts.z !== undefined) {
      const dx = opts.x - this.listener.x;
      const dz = opts.z - this.listener.z;
      const dist = Math.hypot(dx, dz);
      vol *= Math.max(0, 1 - dist / 28);
      if (vol <= 0.01) return;
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-0.8, Math.min(0.8, dx / 12));
      out.connect(pan).connect(this.sfxBus);
    } else out.connect(this.sfxBus);
    out.gain.value = vol;
    const asset = this.assets.get('sfx.' + id);
    if (asset) {
      const s = ctx.createBufferSource(); s.buffer = asset; s.playbackRate.value = opts.pitch ?? 1;
      s.connect(out); s.start();
      return;
    }
    this.synth(id, out, opts.pitch ?? 1);
  }

  private tone(out: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, attack = 0.005): void {
    const ctx = this.ctx!; const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(out: AudioNode, type: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, delay = 0, q = 1, attack = 0.005): void {
    const ctx = this.ctx!; const t = ctx.currentTime + delay;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + dur + 0.02);
  }

  private wet(out: AudioNode, amount: number): AudioNode {
    const ctx = this.ctx!;
    const s = ctx.createGain(); s.gain.value = amount;
    out.connect(s).connect(this.reverbSend);
    return out;
  }

  private synth(id: string, out: GainNode, p: number): void {
    switch (id) {
      case 'spark': this.tone(out, 'sine', 1400 * p, 600 * p, 0.18, 0.18); this.noise(out, 'bandpass', 5000, 2000, 0.12, 0.08, 0, 2); break;
      case 'ward': this.tone(out, 'sine', 300, 600, 0.35, 0.15, 0, 0.05); this.tone(out, 'triangle', 600, 1200, 0.3, 0.06, 0.02); this.wet(out, 0.5); break;
      case 'light': [880, 1320, 1760].forEach((f, i) => this.tone(out, 'sine', f, f, 0.9, 0.07, i * 0.07, 0.02)); this.wet(out, 0.8); break;
      case 'gust': this.noise(out, 'bandpass', 400, 1800, 0.5, 0.35, 0, 1.2, 0.08); break;
      case 'flame': this.noise(out, 'lowpass', 2500, 300, 0.6, 0.35, 0, 1, 0.03); this.tone(out, 'sawtooth', 160, 60, 0.4, 0.08); break;
      case 'explosion': this.noise(out, 'lowpass', 1800, 80, 0.9, 0.5, 0, 0.8, 0.005); this.tone(out, 'sine', 90, 30, 0.6, 0.4); break;
      case 'frost': this.tone(out, 'sine', 2400, 3400, 0.25, 0.08); this.noise(out, 'highpass', 6000, 9000, 0.35, 0.12); this.wet(out, 0.4); break;
      case 'freeze': [2600, 3100, 3900].forEach((f, i) => this.tone(out, 'triangle', f, f * 0.98, 0.4, 0.05, i * 0.04)); break;
      case 'mend': [523, 659, 784, 1046].forEach((f, i) => this.tone(out, 'sine', f, f, 0.8, 0.07, i * 0.08, 0.04)); this.wet(out, 0.7); break;
      case 'blink': this.tone(out, 'sine', 300, 2400, 0.22, 0.14); this.tone(out, 'sine', 2400, 400, 0.25, 0.08, 0.15); break;
      case 'bind': this.noise(out, 'bandpass', 300, 900, 0.4, 0.25, 0, 3); this.tone(out, 'triangle', 120, 90, 0.4, 0.1); break;
      case 'unlock': this.tone(out, 'square', 1200, 1200, 0.05, 0.05); this.tone(out, 'square', 900, 900, 0.06, 0.05, 0.08); this.tone(out, 'sine', 660, 990, 0.5, 0.1, 0.15); this.wet(out, 0.5); break;
      case 'reveal': [660, 990, 1320, 1980].forEach((f, i) => this.tone(out, 'sine', f, f * 1.01, 1.2, 0.05, i * 0.05, 0.05)); this.wet(out, 1); break;
      case 'storm': this.noise(out, 'highpass', 3000, 800, 0.35, 0.4, 0, 0.7, 0.002); this.tone(out, 'sawtooth', 80, 40, 0.3, 0.15); break;
      case 'whisper': [392, 523, 440, 587].forEach((f, i) => this.tone(out, 'sine', f, f, 0.5, 0.06, i * 0.12, 0.08)); this.wet(out, 0.9); break;
      case 'eclipse': this.tone(out, 'sawtooth', 60, 30, 1.6, 0.25, 0, 0.3); this.noise(out, 'lowpass', 600, 60, 1.6, 0.3, 0, 1, 0.2); this.wet(out, 1); break;
      case 'starfall': [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(out, 'sine', f, f * 0.5, 0.9, 0.06, i * 0.1)); this.noise(out, 'lowpass', 1200, 100, 1.4, 0.25, 0.3); this.wet(out, 0.8); break;
      case 'hit': this.noise(out, 'bandpass', 1800 * p, 500, 0.12, 0.25, 0, 1.5); this.tone(out, 'sine', 220 * p, 110, 0.1, 0.12); break;
      case 'hit_crit': this.noise(out, 'bandpass', 2600, 600, 0.18, 0.35, 0, 1.5); this.tone(out, 'square', 440, 220, 0.12, 0.08); break;
      case 'enemy_die': this.noise(out, 'lowpass', 1500, 100, 0.5, 0.3); this.tone(out, 'sine', 300 * p, 60, 0.5, 0.15); this.wet(out, 0.4); break;
      case 'shade_die': this.tone(out, 'sawtooth', 200, 40, 0.7, 0.12); this.noise(out, 'bandpass', 800, 200, 0.6, 0.2, 0, 2); this.wet(out, 0.8); break;
      case 'player_hurt': this.noise(out, 'lowpass', 1200, 200, 0.2, 0.35); this.tone(out, 'sine', 160, 80, 0.2, 0.25); break;
      case 'dodge': this.noise(out, 'bandpass', 600, 2000, 0.22, 0.25, 0, 1, 0.03); break;
      case 'shield_block': this.tone(out, 'triangle', 700, 500, 0.2, 0.18); this.noise(out, 'highpass', 3000, 2000, 0.1, 0.1); break;
      case 'parry': this.tone(out, 'square', 1500, 1500, 0.08, 0.1); this.tone(out, 'sine', 2200, 2200, 0.5, 0.1, 0.02); this.wet(out, 0.6); break;
      case 'step_stone': this.noise(out, 'bandpass', 900 * p, 400, 0.07, 0.07, 0, 2); break;
      case 'step_grass': this.noise(out, 'highpass', 2500 * p, 1500, 0.08, 0.05, 0, 0.5); break;
      case 'step_wood': this.tone(out, 'sine', 180 * p, 120, 0.06, 0.09); this.noise(out, 'bandpass', 600, 300, 0.05, 0.04, 0, 2); break;
      case 'step_water': this.noise(out, 'bandpass', 1200 * p, 500, 0.12, 0.08, 0, 1); break;
      case 'pickup': this.tone(out, 'sine', 880, 1320, 0.12, 0.1); this.tone(out, 'sine', 1320, 1760, 0.15, 0.08, 0.08); break;
      case 'coins': for (let i = 0; i < 4; i++) this.tone(out, 'square', 2200 + Math.random() * 900, 2000, 0.07, 0.03, i * 0.05); break;
      case 'equip': this.noise(out, 'bandpass', 1200, 800, 0.12, 0.18, 0, 2); this.tone(out, 'triangle', 500, 700, 0.1, 0.06); break;
      case 'drink': for (let i = 0; i < 3; i++) this.tone(out, 'sine', 300 + i * 80, 500 + i * 60, 0.09, 0.08, i * 0.11); break;
      case 'page': this.noise(out, 'highpass', 3000, 5000, 0.18, 0.12, 0, 0.6, 0.04); break;
      case 'door': this.noise(out, 'lowpass', 500, 200, 0.6, 0.25, 0, 3, 0.05); this.tone(out, 'sawtooth', 90, 70, 0.5, 0.05); break;
      case 'chest': this.noise(out, 'lowpass', 900, 300, 0.4, 0.2, 0, 2, 0.03); [784, 988, 1175].forEach((f, i) => this.tone(out, 'sine', f, f, 0.5, 0.06, 0.2 + i * 0.08)); this.wet(out, 0.5); break;
      case 'quest_start': [392, 523, 659].forEach((f, i) => this.tone(out, 'triangle', f, f, 0.5, 0.08, i * 0.1, 0.02)); this.wet(out, 0.6); break;
      case 'objective': [659, 880].forEach((f, i) => this.tone(out, 'sine', f, f, 0.4, 0.08, i * 0.09)); this.wet(out, 0.4); break;
      case 'quest_done': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(out, 'triangle', f, f, 0.6, 0.08, i * 0.09, 0.02)); this.wet(out, 0.7); break;
      case 'levelup': [392, 494, 587, 784, 988, 1175].forEach((f, i) => this.tone(out, 'triangle', f, f, 0.9, 0.08, i * 0.07, 0.02)); this.wet(out, 0.9); break;
      case 'achievement': [784, 988, 1175, 1568].forEach((f, i) => this.tone(out, 'sine', f, f, 1.2, 0.08, i * 0.12, 0.02)); this.wet(out, 1); break;
      case 'ui_click': this.tone(out, 'sine', 900, 700, 0.05, 0.06); break;
      case 'ui_hover': this.tone(out, 'sine', 1400, 1400, 0.025, 0.02); break;
      case 'ui_open': this.noise(out, 'bandpass', 1500, 3000, 0.2, 0.08, 0, 1, 0.04); this.tone(out, 'sine', 500, 750, 0.15, 0.05); break;
      case 'ui_close': this.noise(out, 'bandpass', 3000, 1500, 0.15, 0.07, 0, 1, 0.02); break;
      case 'ui_confirm': this.tone(out, 'sine', 660, 990, 0.15, 0.09); break;
      case 'ui_error': this.tone(out, 'square', 200, 160, 0.18, 0.05); break;
      case 'dialogue_open': this.tone(out, 'sine', 440, 660, 0.18, 0.05); break;
      case 'blip': this.tone(out, 'sine', 600 * p, 600 * p, 0.03, 0.015); break;
      case 'combo': [523, 784, 1046, 1568].forEach((f, i) => this.tone(out, 'sawtooth', f, f, 0.3, 0.04, i * 0.03)); this.noise(out, 'lowpass', 3000, 200, 0.6, 0.3); this.wet(out, 0.8); break;
      case 'burn': this.noise(out, 'lowpass', 1600, 400, 0.3, 0.15, 0, 1, 0.02); break;
      case 'boss_roar': this.tone(out, 'sawtooth', 110, 50, 1.4, 0.3, 0, 0.1); this.noise(out, 'lowpass', 900, 100, 1.4, 0.3, 0, 2, 0.1); this.wet(out, 0.9); break;
      case 'bell': this.bell(392, this.ctx!.currentTime, 0.12, out, 4); this.wet(out, 1); break;
      case 'glitch': for (let i = 0; i < 6; i++) this.tone(out, 'square', 100 + Math.random() * 1500, 50 + Math.random() * 800, 0.06, 0.05, i * 0.05); this.wet(out, 0.6); break;
      case 'secret': [1046, 1318, 1568, 2093, 2637].forEach((f, i) => this.tone(out, 'sine', f, f, 0.9, 0.05, i * 0.06, 0.01)); this.wet(out, 1); break;
      case 'resonance': this.tone(out, 'sine', 1760 * p, 1760 * p, 0.3, 0.04); break;
      case 'brew': for (let i = 0; i < 4; i++) this.tone(out, 'sine', 200 + Math.random() * 300, 600 + Math.random() * 300, 0.08, 0.05, i * 0.08); break;
      case 'stir': this.noise(out, 'bandpass', 500, 900, 0.3, 0.12, 0, 2, 0.05); break;
      case 'rune': this.tone(out, 'triangle', 700 * p, 700 * p, 0.1, 0.07); break;
      case 'rune_ok': [523, 784, 1046].forEach((f, i) => this.tone(out, 'sine', f, f, 0.5, 0.07, i * 0.06)); this.wet(out, 0.7); break;
      case 'splash': this.noise(out, 'lowpass', 2000, 300, 0.4, 0.25); break;
      case 'teleport': this.tone(out, 'sine', 200, 1600, 0.5, 0.1, 0, 0.1); this.noise(out, 'bandpass', 500, 4000, 0.5, 0.1, 0, 2, 0.1); this.wet(out, 0.8); break;
      case 'cure': [784, 1046, 1318].forEach((f, i) => this.tone(out, 'sine', f, f, 0.7, 0.06, i * 0.1)); this.wet(out, 0.6); break;
      case 'death': this.tone(out, 'sawtooth', 220, 55, 2, 0.15, 0, 0.1); this.wet(out, 1); break;
      case 'note0': case 'note1': case 'note2': case 'note3': {
        const f = [392, 494, 587, 698][Number(id.slice(4))];
        this.tone(out, 'sine', f, f, 0.5, 0.15, 0, 0.01); this.tone(out, 'triangle', f * 2, f * 2, 0.4, 0.04); this.wet(out, 0.5); break;
      }
      case 'whoosh': this.noise(out, 'bandpass', 300, 1500, 0.35, 0.2, 0, 1, 0.08); break;
      case 'enemy_cast': this.tone(out, 'sawtooth', 300 * p, 600 * p, 0.25, 0.05); this.noise(out, 'bandpass', 900, 1600, 0.2, 0.06, 0, 2); break;
      case 'enemy_attack': this.noise(out, 'bandpass', 600, 1200, 0.18, 0.18, 0, 1, 0.02); break;
      case 'slam': this.noise(out, 'lowpass', 600, 60, 0.7, 0.45); this.tone(out, 'sine', 70, 30, 0.6, 0.35); break;
      case 'howl': this.tone(out, 'sawtooth', 300, 600, 0.6, 0.06, 0, 0.2); this.tone(out, 'sawtooth', 600, 350, 0.8, 0.06, 0.6); this.wet(out, 0.9); break;
      default: this.tone(out, 'sine', 600, 500, 0.1, 0.05);
    }
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const audio = new AudioEngine();
export type { Mood };
