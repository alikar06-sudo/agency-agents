import { Fragment, useEffect, useState } from 'react';
import { useSettings, setSettings, useUI } from '@/state/store';
import type { Settings } from '@/state/store';
import { KEY_LABELS, REBINDABLE, keyName, boundKey } from '@/core/input';
import type { Action } from '@/core/input';
import { STATIC_BUILD } from '@/core/env';
import { voice } from '@/core/voice';
import { VOICE_PROFILES } from '@/data/voices';

function Slider({ k, label }: { k: keyof Settings; label: string }) {
  const v = useSettings((s) => s[k]) as number;
  return (
    <div className="setting-row">
      <div>{label}</div>
      <input type="range" min={0} max={1} step={0.05} value={v} onChange={(e) => setSettings({ [k]: Number(e.target.value) } as Partial<Settings>)} />
    </div>
  );
}

export function SettingsPanel() {
  const s = useSettings();
  const cloud = useUI((u) => u.cloud);
  return (
    <div className="scroll" style={{ flex: 1, minHeight: 0, paddingRight: 6 }}>
      <div className="divider">Звук</div>
      <Slider k="master" label="Общая громкость" />
      <Slider k="music" label="Музыка" />
      <Slider k="sfx" label="Эффекты" />
      <Slider k="ambient" label="Атмосфера (дождь, ветер, голоса)" />
      <VoiceSettings />
      <div className="divider">Камера</div>
      <div className="setting-row">
        <div>Вид<div className="faint" style={{ fontSize: 13 }}>Клавиша {boundKey('view')} переключает вид прямо в игре.</div></div>
        <div className="seg">
          {(['first', 'third', 'iso'] as const).map((m) => (
            <button key={m} className={s.camera === m ? 'on' : ''} onClick={() => setSettings({ camera: m })}>{{ first: 'От первого лица', third: 'Из-за плеча', iso: 'Сверху' }[m]}</button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <div>Чувствительность мыши</div>
        <input id="set-sens" type="range" min={0.2} max={2.5} step={0.05} value={s.sensitivity} onChange={(e) => setSettings({ sensitivity: Number(e.target.value) })} />
      </div>
      <div className="setting-row">
        <div>Поле зрения от первого лица<div className="faint" style={{ fontSize: 13 }}>{s.fov}°</div></div>
        <input id="set-fov" type="range" min={55} max={100} step={1} value={s.fov} onChange={(e) => setSettings({ fov: Number(e.target.value) })} />
      </div>
      <div className="setting-row">
        <div>Инвертировать мышь по вертикали</div>
        <div className="seg"><button className={s.invertY ? 'on' : ''} onClick={() => setSettings({ invertY: true })}>Вкл</button><button className={!s.invertY ? 'on' : ''} onClick={() => setSettings({ invertY: false })}>Выкл</button></div>
      </div>
      <div className="divider">Графика</div>
      <div className="setting-row">
        <div>Качество<div className="faint" style={{ fontSize: 13 }}>Высокое — тени 2048 и свечение в полном разрешении. Низкое — для слабых устройств.</div></div>
        <div className="seg">
          {(['low', 'medium', 'high'] as const).map((q) => (
            <button key={q} className={s.quality === q ? 'on' : ''} onClick={() => setSettings({ quality: q })}>{{ low: 'Низкое', medium: 'Среднее', high: 'Высокое' }[q]}</button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <div>Масштаб камеры</div>
        <input type="range" min={0.6} max={1.5} step={0.05} value={s.zoom} onChange={(e) => setSettings({ zoom: Number(e.target.value) })} />
      </div>
      <div className="setting-row">
        <div>Числа урона</div>
        <div className="seg"><button className={s.showDamage ? 'on' : ''} onClick={() => setSettings({ showDamage: true })}>Вкл</button><button className={!s.showDamage ? 'on' : ''} onClick={() => setSettings({ showDamage: false })}>Выкл</button></div>
      </div>
      <div className="setting-row">
        <div>Тряска камеры</div>
        <div className="seg"><button className={s.shake ? 'on' : ''} onClick={() => setSettings({ shake: true })}>Вкл</button><button className={!s.shake ? 'on' : ''} onClick={() => setSettings({ shake: false })}>Выкл</button></div>
      </div>
      <div className="divider">Интерфейс</div>
      <div className="setting-row">
        <div>Скорость текста в диалогах</div>
        <div className="seg">
          {[[30, 'Медленно'], [60, 'Обычно'], [120, 'Быстро'], [0, 'Сразу']].map(([v, l]) => (
            <button key={v} className={s.textSpeed === v ? 'on' : ''} onClick={() => setSettings({ textSpeed: v as number })}>{l}</button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <div>Сенсорное управление</div>
        <div className="seg">
          {(['auto', 'on', 'off'] as const).map((v) => (
            <button key={v} className={s.touch === v ? 'on' : ''} onClick={() => setSettings({ touch: v })}>{{ auto: 'Авто', on: 'Вкл', off: 'Выкл' }[v]}</button>
          ))}
        </div>
      </div>
      <div className="divider">Управление</div>
      <KeyBindings />
      <div className="faint" style={{ fontSize: 13, margin: '12px 0 6px' }}>Мышь и прочее</div>
      <div className="kv" style={{ maxWidth: 520 }}>
        {KEY_LABELS.filter((k) => /ЛКМ|ПКМ|Esc|стрелки/.test(k.keys)).map((k) => (<Fragment key={k.action}><div className="k">{k.action}</div><div className="v"><span className="kbd">{k.keys}</span></div></Fragment>))}
      </div>
      <div className="divider">Сохранения</div>
      <div className="dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
        {cloud === 'online'
          ? 'Сервер Академии на связи: каждое сохранение дублируется в облако (server/data) под вашим гостевым профилем.'
          : STATIC_BUILD
            ? 'Веб-версия без сервера: сохранения хранятся в этом браузере. В полной версии (npm start) каждое сохранение дублируется в облако.'
            : 'Сервер не запущен — сохранения хранятся только в этом браузере (localStorage). Запустите `npm start`, чтобы включить облачную копию.'}
      </div>
    </div>
  );
}

// Переназначение клавиш: нажмите «Изменить», затем нужную клавишу (Esc — отмена).
function KeyBindings() {
  const keys = useSettings((st) => st.keys);
  const [wait, setWait] = useState<Action | null>(null);
  useEffect(() => {
    if (!wait) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        const next: Record<string, string> = { ...(keys as Record<string, string>) };
        // клавиша уже занята другим действием — возвращаем тому действию его стандартную
        for (const r of REBINDABLE) if (r.action !== wait && (next[r.action] ?? r.def) === e.code) next[r.action] = r.def === e.code ? '' : r.def;
        next[wait] = e.code;
        for (const k of Object.keys(next)) if (!next[k]) delete next[k];
        setSettings({ keys: next });
      }
      setWait(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [wait, keys]);
  const custom = Object.keys(keys).length > 0;
  return (
    <div>
      <div className="keybinds">
        {REBINDABLE.map((r) => {
          const code = keys[r.action] ?? r.def;
          return (
            <div key={r.action} className={'keybind' + (wait === r.action ? ' wait' : '')}>
              <span className="dim">{r.name}</span>
              <button className="btn small" onClick={() => setWait(wait === r.action ? null : r.action)} title="Изменить клавишу">
                {wait === r.action ? 'Нажмите клавишу…' : keyName(code)}
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
        <button className="btn small" disabled={!custom} onClick={() => setSettings({ keys: {} })}>Вернуть стандартные</button>
        <span className="faint" style={{ fontSize: 13 }}>Стрелки всегда дублируют движение. Сейчас взаимодействие: {boundKey('interact')}</span>
      </div>
    </div>
  );
}

// Озвучка: голоса браузера, громкость, темп и поведение разговора.
function VoiceSettings() {
  const s = useSettings();
  const [, force] = useState(0);
  useEffect(() => voice.onChange(() => force((x) => x + 1)), []);
  const onOff = (k: 'voice' | 'voiceHero' | 'voiceBarks' | 'autoAdvance') => (
    <div className="seg"><button className={s[k] ? 'on' : ''} onClick={() => setSettings({ [k]: true })}>Вкл</button><button className={!s[k] ? 'on' : ''} onClick={() => setSettings({ [k]: false })}>Выкл</button></div>
  );
  const test = () => {
    voice.speak('Добро пожаловать в Этермур. Свечи уже зажжены.', VOICE_PROFILES.veist, 'veist', { volume: s.voiceVolume, rate: s.voiceRate });
    voice.speak('Ты тоже первокурсница? Пойдём, церемония вот-вот начнётся!', VOICE_PROFILES.mira, 'mira', { volume: s.voiceVolume, rate: s.voiceRate, queue: true });
  };
  return (
    <>
      <div className="divider">Озвучка</div>
      {!voice.supported && <div className="dim" style={{ fontSize: 14, marginBottom: 8 }}>Этот браузер не умеет синтезировать речь. Реплики будут показаны текстом.</div>}
      {voice.supported && !voice.available && (
        <div className="dim" style={{ fontSize: 14, marginBottom: 8, lineHeight: 1.5 }}>Русских голосов в системе не найдено, поэтому реплики показаны текстом. Голоса есть в Chrome и Edge, а также в системах Windows, macOS и Android с русским языковым пакетом.</div>
      )}
      {voice.available && <div className="faint" style={{ fontSize: 13, marginBottom: 6 }}>Голосов найдено: {voice.voices.length} ({voice.voices.map((v) => v.name.replace(/Microsoft |Google | Online \(Natural\)| - Russian.*$/g, '')).join(', ')}). Каждый персонаж говорит своим голосом, высотой и темпом.</div>}
      <div className="setting-row"><div>Персонажи говорят вслух</div>{onOff('voice')}</div>
      <div className="setting-row">
        <div>Громкость голосов</div>
        <input id="set-voice-vol" type="range" min={0} max={1} step={0.05} value={s.voiceVolume} onChange={(e) => setSettings({ voiceVolume: Number(e.target.value) })} />
      </div>
      <div className="setting-row">
        <div>Темп речи<div className="faint" style={{ fontSize: 13 }}>×{s.voiceRate.toFixed(2)}</div></div>
        <input id="set-voice-rate" type="range" min={0.7} max={1.5} step={0.05} value={s.voiceRate} onChange={(e) => setSettings({ voiceRate: Number(e.target.value) })} />
      </div>
      <div className="setting-row"><div>Герой произносит выбранные ответы</div>{onOff('voiceHero')}</div>
      <div className="setting-row"><div>Прохожие говорят вслух</div>{onOff('voiceBarks')}</div>
      <div className="setting-row"><div>Разговор продолжается сам после реплики<div className="faint" style={{ fontSize: 13 }}>Читать не нужно — достаточно слушать и выбирать ответы.</div></div>{onOff('autoAdvance')}</div>
      {voice.available && <div className="setting-row"><div>Проверить голоса</div><button className="btn small" onClick={test}>Послушать</button></div>}
    </>
  );
}
