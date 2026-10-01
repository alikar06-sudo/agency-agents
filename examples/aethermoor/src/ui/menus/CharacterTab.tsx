import { useGame } from '@/state/store';
import { derived, xpToNext, allocate } from '@/systems/player';
import { CIRCLES, ORIGINS, STAT_NAMES, STAT_DESC, FACTIONS, SUBJECTS } from '@/data/world';
import type { FactionId, StatId, SubjectId } from '@/data/types';
import { portrait } from '../portraits';
import { GRADES } from '@/systems/lessons';
import { unlockRank } from '@/engine/interact';

export function CharacterTab() {
  const g = useGame((s) => s.g!);
  const p = g.player;
  const d = derived(g);
  const c = CIRCLES[p.circle];
  const img = portrait('player_' + JSON.stringify(p.appearance) + p.circle, { ...p.appearance, trim: c.trim });
  return (
    <div className="cols two scroll" style={{ overflowY: 'auto' }}>
      <div className="col">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div className="portrait" style={{ width: 96, height: 96 }}>{img && <img src={img} alt="" />}<span className="lvl">{p.level}</span></div>
          <div>
            <div className="h3" style={{ fontSize: 30 }}>{p.name}</div>
            <div className="dim">{p.gender === 'f' ? 'Ученица' : 'Ученик'} первого курса · {ORIGINS[p.origin].name}</div>
            <div style={{ color: c.trim }}>{c.name} · {c.spec}</div>
          </div>
        </div>
        <div className="bar xp" style={{ height: 10, marginTop: 14 }}><div className="fill" style={{ transform: `scaleX(${p.xp / xpToNext(p.level)})` }} /></div>
        <div className="faint" style={{ fontSize: 13, marginTop: 4 }}>Опыт {p.xp} / {xpToNext(p.level)} до уровня {p.level + 1}</div>
        <div className="divider">Характеристики {p.statPoints > 0 && <span className="gold">· свободно {p.statPoints}</span>}</div>
        {(Object.keys(STAT_NAMES) as StatId[]).map((k) => (
          <div key={k} className="stat-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
            <div><div className="n">{STAT_NAMES[k]}</div><div className="faint" style={{ fontSize: 13 }}>{STAT_DESC[k]}</div></div>
            <div className="v">{p.stats[k]}{d.stats[k] !== p.stats[k] && <span className="stat-line" style={{ fontSize: 14 }}> ({d.stats[k] > p.stats[k] ? '+' : ''}{d.stats[k] - p.stats[k]})</span>}</div>
            <button className="round" disabled={p.statPoints <= 0} onClick={() => allocate(k)}>+</button>
          </div>
        ))}
        <div className="divider">Боевые параметры</div>
        <div className="kv">
          <div className="k">Здоровье</div><div className="v">{Math.ceil(p.hp)} / {d.maxHp}</div>
          <div className="k">Мана</div><div className="v">{Math.floor(p.mana)} / {d.maxMana}</div>
          <div className="k">Восстановление маны</div><div className="v">{d.manaRegen.toFixed(1)} / с</div>
          <div className="k">Сила заклинаний</div><div className="v">×{d.spellPower.toFixed(2)}</div>
          <div className="k">Снижение урона</div><div className="v">{Math.round((1 - d.dmgTaken) * 100)}%</div>
          <div className="k">Критический шанс</div><div className="v">{Math.round(d.crit * 100)}%</div>
          <div className="k">Скорость</div><div className="v">{d.moveSpeed.toFixed(1)}</div>
          <div className="k">Ранг «Отворения»</div><div className="v">{unlockRank()}</div>
          <div className="k">Кроны</div><div className="v gold">◈ {p.gold}</div>
          {p.corruption > 0 && <><div className="k" style={{ color: '#e08a7a' }}>Порча</div><div className="v" style={{ color: '#e08a7a' }}>{p.corruption}</div></>}
        </div>
        <div className="faint" style={{ fontSize: 13, marginTop: 8 }}>Особенность Круга: {c.passive}. Происхождение: {ORIGINS[p.origin].perk}.</div>
      </div>
      <div className="col">
        <div className="divider">Репутация</div>
        {(Object.keys(FACTIONS) as FactionId[]).filter((f) => f !== 'ash' || g.rep.ash !== 0).map((f) => {
          const v = g.rep[f] ?? 0;
          return (
            <div key={f} style={{ padding: '6px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{f === 'circle' ? c.name : FACTIONS[f].name}</span><span className="dim">{v > 0 ? '+' : ''}{v}</span></div>
              <div className="rel-bar"><div className="f" style={{ left: v >= 0 ? '50%' : `${50 + v / 2}%`, width: `${Math.abs(v) / 2}%`, background: v >= 0 ? FACTIONS[f].color : '#c8423a' }} /></div>
              <div className="faint" style={{ fontSize: 12 }}>{FACTIONS[f].desc}</div>
            </div>
          );
        })}
        <div className="divider">Учёба</div>
        {(Object.keys(SUBJECTS) as SubjectId[]).map((s) => {
          const st = g.subjects[s];
          const sub = SUBJECTS[s];
          return (
            <div key={s} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '5px 0', borderBottom: '1px solid rgba(227,196,107,0.06)' }}>
              <div><div className="title-font" style={{ fontSize: 17 }}>{sub.name}</div><div className="faint" style={{ fontSize: 12 }}>{sub.room}</div></div>
              <div style={{ textAlign: 'right' }}>
                <div>{'●'.repeat(st.lessons)}<span className="faint">{'○'.repeat(sub.lessons.length - st.lessons)}</span></div>
                <div className="faint" style={{ fontSize: 12 }}>{st.exam ? `Экзамен: ${GRADES.find((x) => x.short === st.exam)?.name ?? st.exam}` : st.lessons >= sub.lessons.length ? 'Готов к экзамену' : 'Экзамен после 3 уроков'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
