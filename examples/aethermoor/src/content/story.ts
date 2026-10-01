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

  // Тень в галерее появляется только ночью, когда герой идёт из библиотеки.
  registerScript('afterSleep', () => {
    const g = G();
    void g;
    void activeObjectives;
  });

  bus.on('enemyKilled', (e) => {
    if (e.type === 'shade_blob') {
      apply([{ setFlag: 'shade_defeated' }, { give: 'black_rune' }]);
      toast('quest', 'Тень рассеялась', 'Из клубов тьмы выпал холодный осколок. В конце галереи стоит фигура в тёмном…');
    }
  });

  bus.on('hourChanged', (e) => {
    if (e.hour === 3 && G().flags.shade_defeated && !G().flags.corvin_confronted) void 0;
  });

  void setUI;
}
