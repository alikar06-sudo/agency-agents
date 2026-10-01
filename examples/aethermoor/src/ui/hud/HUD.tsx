import { useEffect, useRef, useState } from 'react';
import { useGame, useUI, setUI, G } from '@/state/store';
import { derived, xpToNext } from '@/systems/player';
import { SPELLS } from '@/data/spells';
import { ITEMS } from '@/data/items';
import { CIRCLES } from '@/data/world';
import { ZONES } from '@/data/zones';
import { QUESTS, QUEST_TYPE_NAMES } from '@/data/quests';
import { activeObjectives, objectiveProgressText } from '@/systems/quests';
import { clockString, dateString, partOfDay, currentWeather, weatherName } from '@/systems/time';
import { engine } from '@/engine/Engine';
import { Icon, SpellGlyph, hex } from '../icons';
import { Minimap } from './Minimap';
import { useQuickItem } from '@/systems/inventory';
import { absMinutes } from '@/state/gameState';
import { portrait } from '../portraits';
import type { CircleId } from '@/data/types';

function Vitals() {
  const p = useGame((s) => s.g!.player);
  const buffs = useGame((s) => s.g!.buffs);
  const time = useGame((s) => s.g!.time);
  const d = derived();
  const hpPct = Math.max(0, Math.min(1, p.hp / d.maxHp));
  const mpPct = Math.max(0, Math.min(1, p.mana / d.maxMana));
  const xpPct = p.xp / xpToNext(p.level);
  const now = absMinutes(time);
  const img = portrait('player_' + JSON.stringify(p.appearance) + p.circle, { ...p.appearance, trim: CIRCLES[p.circle].trim });
  return (
    <div className="hud-tl">
      <div className="portrait" onClick={() => setUI({ menu: 'character' })} style={{ cursor: 'pointer' }}>
        {img ? <img src={img} alt="" /> : p.name[0]}
        <span className="lvl">{p.level}</span>
      </div>
      <div className="vitals">
        <div className="nm">{p.name}<small>{CIRCLES[p.circle].short}{p.statPoints > 0 ? ` · +${p.statPoints} очк.` : ''}</small></div>
        <div className="bar hp"><div className="ghost" style={{ transform: `scaleX(${hpPct})` }} /><div className="fill" style={{ transform: `scaleX(${hpPct})` }} /><div className="txt">{Math.ceil(p.hp)} / {d.maxHp}</div></div>
        <div className="bar mana"><div className="fill" style={{ transform: `scaleX(${mpPct})` }} /><div className="txt">{Math.floor(p.mana)} / {d.maxMana}</div></div>
        <div className="bar xp" title={`Опыт: ${p.xp} / ${xpToNext(p.level)}`}><div className="fill" style={{ transform: `scaleX(${xpPct})` }} /></div>
        <div className="buffs">
          {buffs.filter((b) => b.until > now).map((b) => <span key={b.id} className="buff">{b.label} · {Math.ceil((b.until - now) / 60)}ч</span>)}
          {p.corruption >= 20 && <span className="buff bad">Порча {p.corruption}</span>}
        </div>
      </div>
    </div>
  );
}

function Clock() {
  const time = useGame((s) => s.g!.time);
  const zone = useGame((s) => s.g!.pos.zone);
  const cp = useGame((s) => s.g!.circlePoints);
  const me = useGame((s) => s.g!.player.circle);
  const w = currentWeather();
  return (
    <div className="clock">
      <div className="t">{clockString(time.min)}</div>
      <div className="d">{dateString(time.day, true)} · {partOfDay(time.min / 60)}{ZONES[zone].outdoor ? ` · ${weatherName(w)}` : ''}</div>
      <div className="circle-cup" title="Кубок Кругов">
        {(Object.keys(CIRCLES) as CircleId[]).sort((a, b) => cp[b] - cp[a]).map((c) => (
          <div key={c} className={'c' + (c === me ? ' me' : '')} style={{ background: CIRCLES[c].color }}>{cp[c]}</div>
        ))}
      </div>
    </div>
  );
}

function Tracker() {
  const tracked = useGame((s) => s.g!.tracked);
  useGame((s) => (tracked ? s.g!.quests[tracked] : null));
  useGame((s) => s.g!.inventory);
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  if (!tracked || !QUESTS[tracked]) return null;
  const q = QUESTS[tracked];
  const objs = activeObjectives(tracked);
  const zone = G().pos.zone;
  return (
    <div className="tracker" onClick={() => setUI({ menu: 'quests' })} style={{ cursor: 'pointer' }}>
      <div className="qt"><span className="type">{QUEST_TYPE_NAMES[q.type]}</span>{q.title}</div>
      {objs.map((o) => (
        <div key={o.id}>
          <div className={'ob' + (o.optional ? ' opt' : '')}>{o.text}<span className="pr">{objectiveProgressText(tracked, o)}</span></div>
          {o.where && o.where.zone !== zone && <div className="dist">→ {ZONES[o.where.zone].name}</div>}
          {o.hint && <div className="hint">{o.hint}</div>}
        </div>
      ))}
    </div>
  );
}

function SpellBar() {
  const slots = useGame((s) => s.g!.spells.slots);
  const known = useGame((s) => s.g!.spells.known);
  const mana = useGame((s) => s.g!.player.mana);
  const quick = useGame((s) => s.g!.quickItem);
  const inv = useGame((s) => s.g!.inventory);
  const [, tick] = useState(0);
  useEffect(() => { let raf = 0; const loop = () => { tick((x) => (x + 1) % 1000); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, []);
  const potionId = quick && inv.some((i) => i.id === quick) ? quick : inv.find((i) => ITEMS[i.id]?.category === 'potion' && ITEMS[i.id]?.use?.heal)?.id;
  const potionQty = potionId ? inv.filter((i) => i.id === potionId).reduce((a, b) => a + b.qty, 0) : 0;
  const slotView = (id: string | null, key: string, cls = '') => {
    if (!id) return <div key={key} className={'slot empty ' + cls}><span className="key">{key}</span></div>;
    const sp = SPELLS[id];
    const left = engine.combat?.cooldownLeft(id) ?? 0;
    const total = engine.combat?.cooldownTotal(id) ?? 1;
    const p = left > 0 ? (left / total) * 100 : 0;
    return (
      <div key={key} className={'slot ' + cls + (mana < sp.cost ? ' nomana' : '')} title={`${sp.name} — ${sp.desc}`} onClick={() => engine.combat.castSpell(id)}>
        <span className="key">{key}</span>
        <SpellGlyph id={id} color={hex(sp.color)} size={cls ? 24 : 30} />
        {p > 0 && <div className="cd" style={{ ['--p' as string]: `${p}%` }} />}
        {left > 0.6 && <span className="cdt">{Math.ceil(left)}</span>}
        <span className="cost">{sp.cost}</span>
      </div>
    );
  };
  return (
    <div className="hud-bottom">
      {slotView(known.includes('spark') ? 'spark' : null, 'ЛКМ', 'mouse')}
      {slotView(known.includes('ward') ? 'ward' : null, 'ПКМ', 'mouse')}
      <div className="slot-sep" />
      {slots.map((s, i) => slotView(s, String(i + 1)))}
      <div className="slot-sep" />
      <div className={'slot' + (potionId ? '' : ' empty')} title={potionId ? ITEMS[potionId].name : 'Нет зелий'} onClick={() => useQuickItem()}>
        <span className="key">Q</span>
        {potionId && <Icon name={ITEMS[potionId].icon} color={ITEMS[potionId].color} size={28} />}
        {potionId && <span className="qty">{potionQty}</span>}
      </div>
    </div>
  );
}

function MenuButtons() {
  const sp = useGame((s) => s.g!.player.statPoints);
  const btn = (menu: Parameters<typeof setUI>[0]['menu'], icon: string, title: string, badge?: number) => (
    <button title={title} onClick={() => setUI({ menu })}><Icon name={icon} size={20} color="#e3c46b" />{badge ? <span className="badge">{badge}</span> : null}</button>
  );
  return (
    <div className="hud-menu">
      {btn('character', 'person', 'Персонаж (C)', sp || undefined)}
      {btn('inventory', 'bag', 'Инвентарь (I)')}
      {btn('spells', 'spellbook', 'Заклинания (K)')}
      {btn('quests', 'quest', 'Задания (J)')}
      {btn('map', 'mapicon', 'Карта (M)')}
      {btn('journal', 'journal', 'Дневник (L)')}
      <button title="Ожидание (T)" onClick={() => setUI({ waitMenu: true })}><Icon name="hourglass" size={20} color="#e3c46b" /></button>
      <button title="Меню (Esc)" onClick={() => setUI({ pauseMenu: true })}><Icon name="gear" size={20} color="#e3c46b" /></button>
    </div>
  );
}

function Prompt() {
  const prompt = useUI((s) => s.prompt);
  const dlg = useUI((s) => s.dialogue);
  if (!prompt || dlg) return null;
  return (
    <div className="prompt" onClick={() => engine.useNearest()}>
      <span className="kbd">{prompt.key}</span><span>{prompt.text}</span>{prompt.sub && <span className="sub">{prompt.sub}</span>}
    </div>
  );
}

function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={'toast ' + t.kind}><div className="tt">{t.title}</div>{t.text && <div className="tx">{t.text}</div>}</div>
      ))}
    </div>
  );
}

function Banner() {
  const b = useUI((s) => s.banner);
  if (!b) return null;
  return <div className="banner" key={b.id}><div className="b1">{b.title}</div><div className="line" /><div className="b2">{b.subtitle}</div></div>;
}

function BossBar() {
  const b = useUI((s) => s.boss);
  if (!b) return null;
  return (
    <div className="bossbar">
      <div className="bn">{b.name}{b.phase && <span className="ph">{b.phase}</span>}</div>
      <div className="bar"><div className="fill" style={{ transform: `scaleX(${Math.max(0, b.hp / b.max)})` }} /></div>
    </div>
  );
}

function Challenge() {
  const c = useUI((s) => s.challenge);
  if (!c) return null;
  return (
    <div className="challenge">
      <div className="ct">{c.title}</div>
      <div className="cl">{Math.max(0, Math.ceil(c.left))} с</div>
      <div className="cg">{c.goal}</div>
    </div>
  );
}

function HurtVignette() {
  const [v, setV] = useState(0);
  const hp = useGame((s) => s.g!.player.hp);
  const prev = useRef(hp);
  useEffect(() => {
    if (hp < prev.current) { setV(1); const t = setTimeout(() => setV(0), 250); prev.current = hp; return () => clearTimeout(t); }
    prev.current = hp;
  }, [hp]);
  const low = hp / derived().maxHp < 0.25;
  return <div className="hurt-vignette" style={{ opacity: v ? 0.9 : low ? 0.45 : 0 }} />;
}

export function HUD() {
  const zone = useGame((s) => s.g!.pos.zone);
  return (
    <div className="hud">
      <HurtVignette />
      <Vitals />
      <div className="hud-tr">
        <Minimap />
        <div className="zone-name">{ZONES[zone].name}</div>
        <Clock />
        <Tracker />
      </div>
      <BossBar />
      <Challenge />
      <Toasts />
      <Banner />
      <Prompt />
      <SpellBar />
      <MenuButtons />
    </div>
  );
}
