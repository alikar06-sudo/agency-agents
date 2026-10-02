import { useEffect, useMemo, useState } from 'react';
import { useUI, useSettings, G } from '@/state/store';
import { voice, speakableText } from '@/core/voice';
import { VOICE_PROFILES, playerVoice } from '@/data/voices';
import type { VoiceProfile } from '@/data/voices';
import { currentNode, choicesFor, choose, advance, endDialogue, speakerName } from '@/systems/dialogue';
import { fmt } from '@/systems/logic';
import { NPCS } from '@/data/npcs';
import { CIRCLES } from '@/data/world';
import { portrait } from '../portraits';
import { bus } from '@/core/bus';

// Следующая реплика собеседника ждёт, пока герой договорит выбранный ответ.
let heroSpeaking = false;

export function speakerVoice(sp: string | undefined): VoiceProfile {
  if (sp === 'player') return playerVoice(G().player.gender === 'f' ? 'f' : 'm');
  return (sp && VOICE_PROFILES[sp]) || VOICE_PROFILES.narrator;
}

export function Dialogue() {
  const d = useUI((s) => s.dialogue);
  const speed = useSettings((s) => s.textSpeed);
  const st = useSettings();
  const cur = d ? currentNode() : null;
  const text = cur ? fmt(cur.node.text) : '';
  const sp0 = cur?.node.speaker ?? d?.npc;
  const voiced = st.voice && voice.available;
  const [shown, setShown] = useState(0);
  const done = (!voiced && speed === 0) || shown >= text.length;
  const choices = useMemo(() => (cur ? choicesFor(cur.node) : []), [cur?.id, d?.key]);
  const key = d?.key;

  // Озвучка реплики: текст раскрывается вслед за голосом; без вопросов реплика сама сменяется следующей.
  useEffect(() => {
    if (!d || !cur) return;
    if (!voiced) { setShown(speed === 0 ? text.length : 0); return; }
    setShown(0);
    const myKey = d.key;
    const profile = speakerVoice(sp0);
    const hasChoices = choicesFor(cur.node).length > 0;
    voice.speak(text, profile, sp0 ?? 'narrator', {
      queue: heroSpeaking, volume: st.voiceVolume, rate: st.voiceRate,
      onWord: (i) => setShown((n) => Math.max(n, i)),
      onEnd: (finished) => {
        if (useUI.getState().dialogue?.key !== myKey) return;
        setShown(text.length);
        if (finished && !hasChoices && useSettings.getState().autoAdvance) {
          setTimeout(() => { if (useUI.getState().dialogue?.key === myKey) advance(); }, 650);
        }
      },
    });
    heroSpeaking = false;
  }, [key, text, voiced]);

  // Без голоса — печатная машинка; с голосом — запасной темп, если браузер не сообщает о словах.
  useEffect(() => {
    if (done) return;
    if (!voiced && speed === 0) return;
    const cps = voiced ? 13 * speakerVoice(sp0).rate * st.voiceRate : speed;
    let acc = 0;
    const t = setInterval(() => {
      acc += cps * 0.033;
      const step = Math.floor(acc);
      if (step < 1) return;
      acc -= step;
      setShown((n) => {
        const nn = Math.min(text.length, n + step);
        if (!voiced && nn % 6 === 0) bus.emit('sfx', { id: 'blip', volume: 0.4 });
        return nn;
      });
    }, 33);
    return () => clearInterval(t);
  }, [done, text, speed, voiced, key]);

  // Закрытие диалога обрывает речь
  // (последний ответ героя, закрывший разговор, дослушиваем до конца)
  useEffect(() => () => { if (!heroSpeaking) voice.stop(); heroSpeaking = false; }, []);

  const pick = (index: number, label: string) => {
    if (voiced && st.voiceHero && speakableText(label) && !/^\(.*\)$/.test(label.trim())) {
      voice.speak(label, speakerVoice('player'), 'player', { volume: st.voiceVolume, rate: st.voiceRate });
      heroSpeaking = true;
    } else if (voiced) voice.stop();
    choose(index);
    // если выбор завершил разговор, реплику героя дослушиваем; если открыл новый узел — он встанет в очередь
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!d) return;
      if (e.code === 'Escape') { e.stopPropagation(); endDialogue(); return; }
      if (!done && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) { setShown(text.length); return; }
      if (done && !choices.length && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) { voice.stop(); advance(); return; }
      const n = Number(e.key);
      if (done && n >= 1 && n <= choices.length) {
        const c = choices[n - 1];
        if (c.enabled) pick(c.index, c.text);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [d, done, choices, text]);

  if (!d || !cur) return null;
  const sp = sp0;
  const npc = sp ? NPCS[sp] : undefined;
  const isPlayer = sp === 'player';
  const g = G();
  const face = npc ? portrait('npc_' + npc.id, npc.appearance) : isPlayer ? portrait('player_' + JSON.stringify(g.player.appearance) + g.player.circle, { ...g.player.appearance, trim: CIRCLES[g.player.circle].trim }) : '';
  const name = speakerName(sp);
  const narr = !name;

  return (
    <div className="dialogue">
      <div className="box panel panel-frame">
        <div className="face">{face ? <img src={face} alt="" /> : sp === 'hollow' ? '◉' : sp === 'mirror' ? '✦' : '❧'}</div>
        <div>
          {!narr && <div className="who">{name}{npc && <small>{npc.title}</small>}</div>}
          <div className={'text' + (narr ? ' narr' : '')} onClick={() => setShown(text.length)}>{text.slice(0, shown)}</div>
          {done && choices.length > 0 && (
            <div className="choices">
              {choices.map((c, i) => (
                <button key={c.index} className="choice" disabled={!c.enabled} onClick={() => pick(c.index, c.text)} onMouseEnter={() => bus.emit('sfx', { id: 'ui_hover' })}>
                  <span className="n">{i + 1}.</span>
                  {c.tag && <span className="tag">{c.tag}</span>}
                  <span>{c.text}</span>
                  {!c.enabled && c.reason && <span className="why">{c.reason}</span>}
                </button>
              ))}
            </div>
          )}
          {(!done || !choices.length) && (
            <div className="continue" onClick={() => { if (done) { voice.stop(); advance(); } else setShown(text.length); }}>
              {done ? (cur.node.next ? 'Далее' : 'Завершить') : 'Показать текст'} <span className="kbd">Пробел</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
