import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Appearance, CircleId, Gender, OriginId, StatId } from '@/data/types';
import { CIRCLES, ORIGINS, STAT_NAMES, STAT_DESC } from '@/data/world';
import { buildCharacter, animateCharacter } from '@/engine/models';
import type { CharacterRig } from '@/engine/models';
import { newGame } from '@/game/game';
import { setUI } from '@/state/store';
import { bus } from '@/core/bus';

const SKINS = ['#f4dcc8', '#e8c0a0', '#d0a07a', '#a87050', '#7a4a32', '#4a2e20'];
const HAIRS = ['#1a1410', '#3a2a1a', '#6a4a2a', '#a8642a', '#c8501e', '#e0c890', '#e8e4dc', '#5a3a6a'];
const EYES = ['#3a5a7a', '#4a7a4a', '#5a3a1a', '#6a6a7a', '#8a6a2a', '#7a3a6a'];
const STYLES: Appearance['hairStyle'][] = ['short', 'long', 'curly', 'bun', 'tied', 'wild'];
const STYLE_NAMES: Record<string, string> = { short: 'Короткие', long: 'Длинные', curly: 'Кудри', bun: 'Пучок', tied: 'Хвост', wild: 'Взъерошенные' };
const FREE = 4;
const STEP_NAMES = ['Имя', 'Облик', 'Происхождение', 'Круг', 'Характеристики', 'Итог'];

export function Creation() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('f');
  const [look, setLook] = useState<Appearance>({ skin: SKINS[1], hair: HAIRS[2], hairStyle: 'long', eyes: EYES[0], robe: '#1e1a22', trim: '#c9a050', glasses: false });
  const [origin, setOrigin] = useState<OriginId>('common');
  const [circle, setCircle] = useState<CircleId>('star');
  const [alloc, setAlloc] = useState<Record<StatId, number>>({ int: 0, power: 0, defense: 0, speed: 0 });

  const base = useMemo(() => {
    const s: Record<StatId, number> = { int: 3, power: 3, defense: 3, speed: 3 };
    for (const [k, v] of Object.entries(ORIGINS[origin].bonus)) s[k as StatId] += v ?? 0;
    for (const [k, v] of Object.entries(CIRCLES[circle].bonus)) s[k as StatId] += v ?? 0;
    return s;
  }, [origin, circle]);
  const spent = Object.values(alloc).reduce((a, b) => a + b, 0);
  const final = { int: base.int + alloc.int, power: base.power + alloc.power, defense: base.defense + alloc.defense, speed: base.speed + alloc.speed };
  const preview: Appearance = { ...look, trim: CIRCLES[circle].trim, robe: '#1e1a22', height: gender === 'm' ? 0.97 : 0.94, build: gender === 'm' ? 1.04 : 0.94 };

  const canNext = step === 0 ? name.trim().length >= 2 : step === 4 ? spent === FREE : true;
  const go = (d: number) => { bus.emit('sfx', { id: 'page' }); setStep(Math.max(0, Math.min(STEP_NAMES.length - 1, step + d))); };
  const start = () => {
    bus.emit('sfx', { id: 'quest_start' });
    newGame({ name: name.trim(), gender, appearance: preview, origin, circle, stats: final });
  };

  return (
    <div className="creation">
      <div className="preview">
        <Preview look={preview} />
        <div className="pname">{name.trim() || 'Ваше имя'}</div>
        <div className="ptitle">{ORIGINS[origin].name} · {CIRCLES[circle].name}</div>
      </div>
      <div className="form panel panel-frame">
        <div className="steps">{STEP_NAMES.map((s, i) => <div key={s} className={'st' + (i <= step ? ' on' : '')} title={s} />)}</div>
        <div className="faint" style={{ fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Шаг {step + 1} из {STEP_NAMES.length} · {STEP_NAMES[step]}</div>
        <div className="body">
          {step === 0 && (
            <>
              <h2>Как вас зовут?</h2>
              <div className="hint">Это имя впишут в книгу учеников. Его будут произносить друзья — и враги.</div>
              <input className="name-input" autoFocus maxLength={22} value={name} placeholder="Например: Эйлин Грей" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && canNext) go(1); }} />
              <div className="flabel" style={{ marginTop: 16 }}>Обращение</div>
              <div className="seg">
                <button className={gender === 'f' ? 'on' : ''} onClick={() => setGender('f')}>Ученица</button>
                <button className={gender === 'm' ? 'on' : ''} onClick={() => setGender('m')}>Ученик</button>
              </div>
              <div className="faint" style={{ fontSize: 14 }}>Влияет на то, как к вам обращаются в диалогах, и на телосложение модели.</div>
            </>
          )}
          {step === 1 && (
            <>
              <h2>Облик</h2>
              <div className="hint">Мантию и цвета Круга выдаст Академия. Остальное — ваше.</div>
              <div className="flabel">Кожа</div>
              <div className="swatches">{SKINS.map((c) => <div key={c} className={'swatch' + (look.skin === c ? ' on' : '')} style={{ background: c }} onClick={() => setLook({ ...look, skin: c })} />)}</div>
              <div className="flabel">Волосы</div>
              <div className="swatches">{HAIRS.map((c) => <div key={c} className={'swatch' + (look.hair === c ? ' on' : '')} style={{ background: c }} onClick={() => setLook({ ...look, hair: c })} />)}</div>
              <div className="seg">{STYLES.map((s) => <button key={s} className={look.hairStyle === s ? 'on' : ''} onClick={() => setLook({ ...look, hairStyle: s })}>{STYLE_NAMES[s]}</button>)}</div>
              <div className="flabel">Глаза</div>
              <div className="swatches">{EYES.map((c) => <div key={c} className={'swatch' + (look.eyes === c ? ' on' : '')} style={{ background: c }} onClick={() => setLook({ ...look, eyes: c })} />)}</div>
              <div className="flabel">Очки</div>
              <div className="seg"><button className={look.glasses ? 'on' : ''} onClick={() => setLook({ ...look, glasses: true })}>Круглые очки</button><button className={!look.glasses ? 'on' : ''} onClick={() => setLook({ ...look, glasses: false })}>Без очков</button></div>
            </>
          )}
          {step === 2 && (
            <>
              <h2>Происхождение</h2>
              <div className="hint">Откуда вы пришли — и кто будет узнавать вас в долине.</div>
              <div className="opt-grid">
                {(Object.keys(ORIGINS) as OriginId[]).map((o) => (
                  <button key={o} className={'opt' + (origin === o ? ' on' : '')} onClick={() => setOrigin(o)}>
                    <div className="t">{ORIGINS[o].name}</div>
                    <div className="d">{ORIGINS[o].desc}</div>
                    <div className="b">{Object.entries(ORIGINS[o].bonus).map(([k, v]) => `${STAT_NAMES[k as StatId]} +${v}`).join(', ')} · {ORIGINS[o].perk}</div>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2>Магическая специализация</h2>
              <div className="hint">Ваш Круг — это ваш путь в магии, ваша спальня в Башнях и ваши товарищи. Зеркало Кругов лишь подтвердит выбор.</div>
              <div className="opt-grid">
                {(Object.keys(CIRCLES) as CircleId[]).map((c) => (
                  <button key={c} className={'opt' + (circle === c ? ' on' : '')} onClick={() => setCircle(c)} style={{ borderLeft: `4px solid ${CIRCLES[c].color}` }}>
                    <div className="t">{CIRCLES[c].name}</div>
                    <div className="dim" style={{ fontSize: 13, fontStyle: 'italic' }}>{CIRCLES[c].spec} · {CIRCLES[c].motto}</div>
                    <div className="d">{CIRCLES[c].desc}</div>
                    <div className="b">{Object.entries(CIRCLES[c].bonus).map(([k, v]) => `${STAT_NAMES[k as StatId]} +${v}`).join(', ')} · {CIRCLES[c].passive}</div>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <h2>Характеристики</h2>
              <div className="hint">Распределите {FREE} очка. Дальше очки будут приходить с каждым уровнем.</div>
              {(Object.keys(STAT_NAMES) as StatId[]).map((k) => (
                <div key={k} className="stat-row">
                  <div><div className="n">{STAT_NAMES[k]}</div><div className="faint" style={{ fontSize: 13 }}>{STAT_DESC[k]}</div></div>
                  <button className="round" disabled={alloc[k] <= 0} onClick={() => setAlloc({ ...alloc, [k]: alloc[k] - 1 })}>−</button>
                  <div className="v">{final[k]}</div>
                  <button className="round" disabled={spent >= FREE} onClick={() => setAlloc({ ...alloc, [k]: alloc[k] + 1 })}>+</button>
                </div>
              ))}
              <div className="gold" style={{ marginTop: 10 }}>Свободных очков: {FREE - spent}</div>
            </>
          )}
          {step === 5 && (
            <>
              <h2>{name.trim()}</h2>
              <div className="hint">{gender === 'f' ? 'Первокурсница' : 'Первокурсник'} Академии Этермур</div>
              <div className="card" style={{ marginBottom: 10 }}>
                <div className="kv">
                  <div className="k">Происхождение</div><div className="v">{ORIGINS[origin].name}</div>
                  <div className="k">Круг</div><div className="v">{CIRCLES[circle].name}</div>
                  <div className="k">Специализация</div><div className="v">{CIRCLES[circle].spec}</div>
                  {(Object.keys(STAT_NAMES) as StatId[]).map((k) => (<Fragment key={k}><div className="k">{STAT_NAMES[k]}</div><div className="v">{final[k]}</div></Fragment>))}
                </div>
              </div>
              <div className="dim" style={{ lineHeight: 1.55 }}>Впереди — первый вечер в замке, церемония Кругов и уроки. А в хрониках не хватает трёх страниц…</div>
            </>
          )}
        </div>
        <div className="nav">
          <button className="btn" onClick={() => (step === 0 ? setUI({ screen: 'title' }) : go(-1))}>{step === 0 ? 'В меню' : 'Назад'}</button>
          {step < STEP_NAMES.length - 1
            ? <button className="btn primary" disabled={!canNext} onClick={() => go(1)}>Далее</button>
            : <button className="btn primary" onClick={start}>Поступить в Академию</button>}
        </div>
      </div>
    </div>
  );
}

function Preview({ look }: { look: Appearance }) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; rig: CharacterRig | null; rot: number; drag: number | null } | null>(null);
  useEffect(() => {
    const host = ref.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(0, 1.25, 6.4);
    cam.lookAt(0, 0.95, 0);
    const key = new THREE.SpotLight(0xffe0b8, 40, 12, 0.6, 0.6);
    key.position.set(2, 4, 3);
    const rim = new THREE.DirectionalLight(0x8ab0ff, 1.8);
    rim.position.set(-3, 2, -3);
    scene.add(key, rim, new THREE.HemisphereLight(0x6a5a8a, 0x120e18, 0.8));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.3, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2234, roughness: 0.8 }));
    scene.add(floor);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe3c46b, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.3, 64).rotateX(-Math.PI / 2), ringMat);
    ring.position.y = 0.01;
    scene.add(ring);
    state.current = { renderer, scene, cam, rig: null, rot: 0.4, drag: null };
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      cam.aspect = w / Math.max(1, h);
      cam.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = state.current!;
      const t = (performance.now() - t0) / 1000;
      if (s.drag === null) s.rot += 0.004;
      if (s.rig) { s.rig.root.rotation.y = s.rot; animateCharacter(s.rig, t, 0, 0, 0, 0.016); }
      renderer.render(scene, cam);
    };
    loop();
    const down = (e: PointerEvent) => { state.current!.drag = e.clientX; };
    const move = (e: PointerEvent) => { const s = state.current!; if (s.drag !== null) { s.rot += (e.clientX - s.drag) * 0.01; s.drag = e.clientX; } };
    const up = () => { state.current!.drag = null; };
    renderer.domElement.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);
  useEffect(() => {
    const s = state.current;
    if (!s) return;
    if (s.rig) s.scene.remove(s.rig.root);
    const rig = buildCharacter(look);
    rig.setRobe('#1e1a22', look.trim);
    rig.wand.visible = true;
    rig.setWandColor('#a87b4f', 0xfff0c0);
    rig.root.scale.setScalar(1.15);
    s.scene.add(rig.root);
    s.rig = rig;
  }, [look.skin, look.hair, look.hairStyle, look.eyes, look.glasses, look.trim, look.height]);
  return <div ref={ref} style={{ position: 'absolute', inset: 0 }} />;
}
