import { Fragment } from 'react';
import { useSettings, setSettings, useUI } from '@/state/store';
import type { Settings } from '@/state/store';
import { KEY_LABELS } from '@/core/input';

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
      <div className="kv" style={{ maxWidth: 520 }}>
        {KEY_LABELS.map((k) => (<Fragment key={k.action}><div className="k">{k.action}</div><div className="v"><span className="kbd">{k.keys}</span></div></Fragment>))}
      </div>
      <div className="divider">Сохранения</div>
      <div className="dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
        {cloud === 'online'
          ? 'Сервер Академии на связи: каждое сохранение дублируется в облако (server/data) под вашим гостевым профилем.'
          : 'Сервер не запущен — сохранения хранятся только в этом браузере (localStorage). Запустите `npm start`, чтобы включить облачную копию.'}
      </div>
    </div>
  );
}
