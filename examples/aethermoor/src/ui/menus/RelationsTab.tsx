import { useState } from 'react';
import { useGame } from '@/state/store';
import { NPCS } from '@/data/npcs';
import { ZONES } from '@/data/zones';
import { CIRCLES } from '@/data/world';
import { npcLocation, scheduleTable } from '@/systems/schedule';
import { portrait } from '../portraits';

export function relTier(v: number): { name: string; color: string } {
  if (v >= 80) return { name: 'Близкие', color: '#f0b24a' };
  if (v >= 40) return { name: 'Друзья', color: '#7fc77a' };
  if (v >= 10) return { name: 'Дружелюбно', color: '#9fd0a0' };
  if (v > -10) return { name: 'Нейтрально', color: '#b4a990' };
  if (v > -40) return { name: 'Холодно', color: '#e0a07a' };
  return { name: 'Враждебно', color: '#e06a5a' };
}

const MEMORY: Record<string, { flag: string; text: string }[]> = {
  mira: [{ flag: 'mira_told_pages', text: 'Рассказала вам о вырванных страницах.' }, { flag: 'guessed_under_academy', text: 'Восхищена вашей догадкой про «камень».' }, { flag: 'mira_dream', text: 'Поделилась своим тревожным сном.' }],
  cassian: [{ flag: 'cassian_rival', text: 'Считает вас соперником с первого дня.' }, { flag: 'cassian_respect', text: 'Неожиданно вас зауважал.' }, { flag: 'cassian_opened_up', text: 'Рассказал о больной сестре.' }],
  corvin: [{ flag: 'gave_shard', text: 'Вы отдали ему осколок чёрной руны.' }, { flag: 'kept_shard', text: 'Подозревает, что вы что-то утаили.' }, { flag: 'corvin_past_hint', text: 'Упомянул «лучшего друга», которого потерял.' }],
  quill: [{ flag: 'quill_gave_pass', text: 'Доверила вам пропуск в запретную секцию.' }, { flag: 'quill_knows_breakin', text: 'Знает о вашей ночной вылазке.' }],
  toby: [{ flag: 'toby_dream', text: 'Рассказал о бесконечной лестнице во сне.' }, { flag: 'toby_cured', text: 'Обязан вам выздоровлением.' }],
  ulrich: [{ flag: 'ulrich_hooded_hint', text: 'Видел фигуры в капюшонах у дороги.' }],
};

export function RelationsTab() {
  const flags = useGame((s) => s.g!.flags);
  const rel = useGame((s) => s.g!.rel);
  useGame((s) => s.g!.time.min);
  const met = Object.keys(NPCS).filter((id) => flags[`met_${id}`] || rel[id] !== undefined);
  const [sel, setSel] = useState<string | null>(met[0] ?? null);
  const n = sel ? NPCS[sel] : null;
  const loc = sel ? npcLocation(sel) : null;
  return (
    <div className="cols side">
      <div className="col scroll">
        {met.length === 0 && <div className="faint">Вы ещё ни с кем не познакомились.</div>}
        {met.map((id) => {
          const v = rel[id] ?? 0;
          const t = relTier(v);
          return (
            <div key={id} className={'list-item' + (sel === id ? ' on' : '')} onClick={() => setSel(id)}>
              <div className="rel-face"><img src={portrait('npc_' + id, NPCS[id].appearance)} alt="" /></div>
              <div style={{ flex: 1 }}>
                <div className="t">{NPCS[id].name}</div>
                <div className="s" style={{ color: t.color }}>{t.name} · {v > 0 ? '+' : ''}{v}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="col card scroll">
        {n && sel && (
          <>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div className="rel-face" style={{ width: 110, height: 110, borderRadius: 14 }}><img src={portrait('npc_' + sel, n.appearance)} alt="" /></div>
              <div>
                <div className="h3" style={{ fontSize: 30, margin: 0 }}>{n.name}</div>
                <div className="dim">{n.title}</div>
                {n.circle && <div style={{ color: CIRCLES[n.circle].trim }}>{CIRCLES[n.circle].name}</div>}
              </div>
            </div>
            <p className="dim" style={{ fontStyle: 'italic', lineHeight: 1.5 }}>{n.personality}</p>
            <div>Отношение: <b style={{ color: relTier(rel[sel] ?? 0).color }}>{relTier(rel[sel] ?? 0).name}</b> ({rel[sel] ?? 0})</div>
            <div className="rel-bar" style={{ marginTop: 6 }}><div className="f" style={{ left: (rel[sel] ?? 0) >= 0 ? '50%' : `${50 + (rel[sel] ?? 0) / 2}%`, width: `${Math.abs(rel[sel] ?? 0) / 2}%`, background: relTier(rel[sel] ?? 0).color }} /></div>
            <div className="divider">Сейчас</div>
            <div>{loc ? `${ZONES[loc.zone].name} — ${loc.activity === 'sleep' ? 'спит' : loc.activity ?? ''}` : 'Неизвестно'}</div>
            <div className="divider">Распорядок дня</div>
            <div className="kv">
              {scheduleTable(sel).map((e, i) => (
                <div key={i} style={{ display: 'contents' }}>
                  <div className="k">{String(Math.floor(e.from)).padStart(2, '0')}:00</div>
                  <div className="v">{ZONES[e.zone].name}{e.activity && e.activity !== 'sleep' ? ` · ${e.activity}` : e.activity === 'sleep' ? ' · сон' : ''}</div>
                </div>
              ))}
            </div>
            {(MEMORY[sel] ?? []).some((m) => flags[m.flag]) && (
              <>
                <div className="divider">Помнит</div>
                {(MEMORY[sel] ?? []).filter((m) => flags[m.flag]).map((m) => <div key={m.flag} className="dim" style={{ padding: '3px 0' }}>• {m.text}</div>)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
