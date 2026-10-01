// Сценарные обработчики сюжета: всё, что сложнее простых эффектов из диалогов.
import * as THREE from 'three';
import { registerScript, apply } from '@/systems/logic';
import { G, mutate, setUI, toast } from '@/state/store';
import { addItem } from '@/systems/inventory';
import { equipStarter } from '@/game/game';
import { advanceTime, hour } from '@/systems/time';
import { engine } from '@/engine/Engine';
import { bus } from '@/core/bus';
import { CIRCLES } from '@/data/world';
import { ZONES } from '@/data/zones';
import { encodeBits } from '@/engine/Engine';
import { activeObjectives } from '@/systems/quests';
import { countItem } from '@/systems/inventory';
import { addBuff } from '@/systems/player';
import { FOUNDER_MARKS } from '@/data/world';

export function registerStoryScripts(): void {
  registerScript('ceremonyGifts', () => {
    addItem('student_robe', 1, true);
    addItem('apprentice_wand', 1, true);
    equipStarter();
    const c = CIRCLES[G().player.circle];
    toast('item', 'Мантия и жезл ученика', `Нашивка: ${c.name}`);
    apply([{ learnSpell: c.spell }, { rep: 'circle', delta: 5 }]);
    engine.particles.emit({ x: engine.player.x, y: 1.5, z: engine.player.z, count: 80, speed: 4, life: 1.4, color: new THREE.Color(c.trim).getHex(), size: 0.6 });
    bus.emit('sfx', { id: 'achievement' });
  });

  registerScript('timeAtLeast', (arg) => {
    const target = Number(arg);
    const h = hour();
    if (h < target && h >= 6) advanceTime(Math.round((target - h) * 60));
    engine.refreshAmbient();
  });

  registerScript('revealMaps', () => {
    const g = G();
    for (const z of g.visited) {
      const def = ZONES[z];
      const n = def.map.length * Math.max(...def.map.map((r) => r.length));
      const bits = new Uint8Array(Math.ceil(n / 8)).fill(255);
      mutate((s) => { s.explored[z] = encodeBits(bits); });
    }
    toast('info', 'Карта проявилась', 'Все посещённые области раскрыты.');
  });

  registerScript('sealRestored', (arg) => {
    const [zone, key] = String(arg).split(':');
    mutate((g) => { const id = `${zone}:${key}`; if (!g.opened.includes(id)) g.opened.push(id); });
    engine.addShake(0.5);
    engine.particles.emit({ x: engine.player.x, y: 1, z: engine.player.z, count: 140, spread: 2, speed: 6, up: 3, life: 1.6, color: 0xa0e8ff, color2: 0xffffff, size: 0.8 });
    bus.emit('sfx', { id: 'secret' });
    toast('quest', 'Печать восстановлена', 'Древние руны снова поют.');
    setTimeout(() => { if (engine.zone?.def.id === zone) void engine.enterZone(zone as never, 'seal_return', { fade: false, x: engine.player.x, z: engine.player.z, silent: true }); }, 1200);
  });

  // ---------------- Акт II ----------------
  registerScript('restrictedOpened', () => {
    if (countItem('restricted_pass') > 0) {
      apply([{ take: 'restricted_pass' }, { toast: 'Пропуск остался в замке — Квилл заберёт его утром.' }]);
    } else {
      apply([{ setFlag: 'broke_into_restricted' }, { journal: 'Я проник{g:|ла} в запретную секцию без разрешения. Если Квилл узнает…' }]);
    }
  });

  registerScript('glitchShades', () => spawnAround('shade', 3, 4.5));
  registerScript('glitchBooks', () => {
    spawnAround('book_swarm', 4, 3.5);
    toast('warn', 'Книги взбесились!', 'Сбой оживил тома на полках.');
  });

  bus.on('hourChanged', (e) => {
    const g = G();
    // Лунатик: после первых сбоев Тоби начинает бродить по ночам.
    if (e.hour === 21 && g.act >= 2 && !g.quests.mq_sleepwalker && g.quests.mq_glitches && g.quests.mq_glitches.done.length > 0) {
      apply([{ startQuest: 'mq_sleepwalker' }, { journal: 'Элоди шепнула за ужином: Тоби по ночам ходит по галерее с закрытыми глазами. Надо проверить.' }]);
    }
    if ((e.hour >= 21 || e.hour < 5) && engine.zone?.def.id === 'gates') nightRaid();
  });

  // ---------------- Акт III ----------------
  bus.on('reached', (e) => {
    const g = G();
    if (e.zone === 'forest' && e.marker === 'seal_glade' && g.quests.mq_seals?.state === 'active' && !g.flags.seal_root && !g.flags.soren_forest_seen) {
      apply([{ setFlag: 'soren_visible' }]);
      engine.npcs.syncZone(false);
      setTimeout(() => apply([{ startDialogue: 'soren_forest', npc: 'soren' }]), 700);
    }
    if (e.zone === 'sanctum' && e.marker === 'heart_chamber' && g.quests.mq_sanctum?.state === 'active' && !g.flags.soren_challenge) {
      apply([{ startDialogue: 'soren_sanctum', npc: 'soren' }]);
    }
  });

  bus.on('dialogueEnded', (e) => {
    if (e.dialogue === 'soren_forest') {
      engine.particles.emit({ x: engine.player.x + 3, y: 1, z: engine.player.z - 3, count: 120, spread: 1.5, speed: 3, up: 2, life: 1.6, color: 0x3a2a2a, color2: 0xe05a2a, size: 0.9 });
      apply([{ setFlag: 'soren_forest_seen' }, { clearFlag: 'soren_visible' }, { journal: 'У печати Корня меня ждал Сорен Мальграв, глава Ордена Пепла. Он исчез в облаке пепла, оставив своего зверя.' }]);
      toast('warn', 'Сорен растворился в пепле', 'Из чащи выходит вожак теневых гончих!');
      engine.npcs.syncZone(false);
    }
    if (e.dialogue === 'soren_sanctum' && G().flags.soren_challenge) {
      startSanctumBattle();
    }
  });

  // ---------------- Акт IV ----------------
  registerScript('pellinorFlee', () => {
    engine.particles.emit({ x: engine.player.x, y: 1, z: engine.player.z - 2, count: 160, spread: 2.5, speed: 3, up: 1.5, life: 2, color: 0x8a8a8a, color2: 0x4a4a4a, size: 1.2 });
    bus.emit('sfx', { id: 'teleport' });
    engine.npcs.syncZone(false);
  });

  // Сон после Ночи Пепла: голос из-под камня ждёт ответа.
  registerScript('afterSleep', () => {
    const g = G();
    if (g.quests.mq_night_of_ash?.state === 'active' && activeObjectives('mq_night_of_ash').some((o) => o.id === 'voice') && !g.flags.voice_answered) {
      apply([{ startDialogue: 'hollow_voice' }]);
    }
  });

  registerScript('nightOfAshAftermath', () => {
    apply([{ setFlag: 'mira_taken' }, { setFlag: 'veist_wounded' },
      { journal: 'Сорен прорвался в замок. Архимагистр ранен, Миру похитили. Вейст в лазарете — ждёт меня.' }]);
    engine.addShake(0.6);
    bus.emit('sfx', { id: 'bell' });
    engine.npcs.syncZone(false);
  });

  registerScript('gatherAllies', () => {
    const g = G();
    const allies: string[] = [];
    if (!g.flags.corvin_arrested && (g.flags.corvin_trusts || g.flags.read_corvin_notes || (g.rel.corvin ?? 0) >= 10)) {
      apply([{ setFlag: 'ally_corvin' }]); allies.push('Корвин');
    }
    if (g.flags.ally_cassian) allies.push('Кассиан');
    if (g.flags.ally_pellinor) allies.push('Пеллинор');
    apply([{ journal: allies.length
      ? `Со мной пойдут: ${allies.join(', ')}. Вместе у нас есть шанс.`
      : 'Я иду к Сердцу од{g:ин|на}. Никто из тех, кому я мог{g:|ла} бы доверять, не сможет пойти со мной.' }]);
  });

  // ---------------- Акт V ----------------
  bus.on('enemyKilled', (e) => {
    const g = G();
    if (e.type === 'shade_blob') {
      apply([{ setFlag: 'shade_defeated' }, { give: 'black_rune' }]);
      toast('quest', 'Тень рассеялась', 'Из клубов тьмы выпал холодный осколок. В конце галереи стоит фигура в тёмном…');
    }
    if (e.type === 'cultist' && e.zone === 'gates') setTimeout(nightRaid, 2500);
    if (e.type === 'pellinor_boss') {
      apply([{ setFlag: 'pellinor_gone' }, { journal: 'Пеллинор повержен. Перед тем как потерять сознание, он прошептал: «Скажите Вейсту… моя дочь…» Стража унесла его в темницу.' }]);
    }
    if (e.type === 'cassian_boss') {
      apply([{ setFlag: 'cassian_defeated' }]);
      toast('quest', 'Кассиан опускает жезл', '«Ты сильнее. Может, в этом и ответ…» Он отступает в тень.');
    }
    if (e.type === 'soren' && !g.flags.soren_dead) {
      apply([{ setFlag: 'soren_dead' }, { setFlag: 'mira_rescued' }, { journal: 'Сорен пал. Цепи Миры рассыпались. Но Сердце треснуло — и из трещины поднялся Полый Король.' }]);
      engine.addShake(1);
      engine.npcs.syncZone(false);
      setTimeout(() => {
        apply([{ startDialogue: 'mira_freed', npc: 'mira' }]);
        const p = markerPos('heart_chamber');
        engine.particles.emit({ x: p.x, y: 1.5, z: p.z, count: 220, spread: 3, speed: 5, up: 3, life: 2, color: 0x1a1020, color2: 0x8a6aff, size: 1.2 });
        engine.spawnEnemy('hollow_king', p.x, p.z - 2, { aggro: true, uniqueId: 'hollow_king' });
      }, 1600);
    }
  });

  bus.on('zoneEntered', (e) => {
    if (e.zone === 'gates') setTimeout(nightRaid, 1500);
    if (e.zone === 'tunnels' && !G().flags.tunnels_open) apply([{ setFlag: 'tunnels_open' }]);
  });

  // Знаки Основателей: первый знак начинает поиск, последний — завершает.
  bus.on('interacted', () => { setTimeout(syncMarks, 30); });
  void setUI;
}

function syncMarks(): void {
  const n = G().counters.founder_marks ?? 0;
  if (n >= 1 && !G().quests.sq_marks) apply([{ startQuest: 'sq_marks' }]);
  if (n >= FOUNDER_MARKS && !G().flags.all_marks) apply([{ setFlag: 'all_marks' }]);
}

function markerPos(key: string): { x: number; z: number } {
  const m = engine.zone?.markers.find((mk) => mk.key === key || mk.def.id === key);
  return m ? { x: m.x, z: m.z } : { x: engine.player.x, z: engine.player.z };
}

function spawnAround(type: string, n: number, r: number): void {
  const p = engine.player;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    engine.particles.emit({ x, y: 1, z, count: 30, speed: 2, up: 1, life: 0.9, color: 0x6a4a9a, size: 0.7 });
    engine.spawnEnemy(type, x, z, { aggro: true });
  }
}

// Ночь Пепла: волны адептов во внешнем дворе (по три, пока не наберётся шесть побед).
let raidBusy = false;
function nightRaid(): void {
  const g = G();
  if (raidBusy || engine.zone?.def.id !== 'gates' || engine.loading) return;
  const h = hour();
  if (!(h >= 21 || h < 5)) return;
  const obj = activeObjectives('mq_night_of_ash').find((o) => o.id === 'defend');
  if (!obj) return;
  if (engine.enemies.some((e) => e.def.id === 'cultist' && !e.dead)) return;
  raidBusy = true;
  const p = markerPos('gate_post');
  toast('warn', g.flags.raid_started ? 'Новая волна!' : 'Орден Пепла у ворот!', 'Адепты в серых плащах прорываются во двор.');
  if (!g.flags.raid_started) apply([{ setFlag: 'raid_started' }]);
  bus.emit('sfx', { id: 'bell' });
  for (let i = 0; i < 3; i++) {
    const x = p.x + (i - 1) * 2.5, z = p.z - 1;
    engine.particles.emit({ x, y: 1, z, count: 40, speed: 3, up: 2, life: 1.2, color: 0xe05a2a, color2: 0x3a2a2a, size: 0.8 });
    engine.spawnEnemy('cultist', x, z, { aggro: true });
  }
  setTimeout(() => { raidBusy = false; }, 3000);
}

function startSanctumBattle(): void {
  const g = G();
  engine.refreshSpawns();
  const p = markerPos('heart_chamber');
  if (g.flags.cassian_left && !g.flags.cassian_defeated) {
    engine.spawnEnemy('cassian_boss', p.x + 3, p.z - 1, { aggro: true, uniqueId: 'cassian_boss' });
    toast('warn', 'Кассиан на стороне Сорена', '«Прости. Я сделал свой выбор».');
  }
  if (g.flags.ally_corvin) { addBuff('ally_corvin', 'defense', 3, 120, 'Щит Корвина'); toast('quest', 'Корвин рядом', '«Сорен — мой. Но если не успею… держи щит». (+3 Защита)'); }
  if (g.flags.ally_cassian) { addBuff('ally_cassian', 'power', 3, 120, 'Клинок Морвеля'); toast('quest', 'Кассиан рядом', '«Не отставай». (+3 Сила магии)'); }
  if (g.flags.ally_pellinor) { apply([{ give: 'potion_heal_big', count: 2 }]); toast('quest', 'Пеллинор рядом', '«Пей, когда станет туго. Я сварил лучшее, что умею».'); }
  engine.npcs.syncZone(false);
}

