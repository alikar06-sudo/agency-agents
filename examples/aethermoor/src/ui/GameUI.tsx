import { useEffect, useState } from 'react';
import { useUI, setUI, ui, useGame, useSettings } from '@/state/store';
import type { MenuTab } from '@/state/store';
import { input } from '@/core/input';
import { bus } from '@/core/bus';
import { HUD } from './hud/HUD';
import { Dialogue } from './overlays/Dialogue';
import { GameMenu } from './menus/GameMenu';
import { PauseMenu, ReadOverlay, WaitMenu, FastTravel, DeadScreen } from './overlays/Misc';
import { ShopOverlay } from './overlays/Shop';
import { CraftOverlay } from './overlays/Craft';
import { MinigameHost } from './minigames/MinigameHost';
import { TouchControls } from './overlays/Touch';
import { endDialogue } from '@/systems/dialogue';

const MENU_KEYS: Partial<Record<string, MenuTab>> = {
  inventory: 'inventory', spells: 'spells', quests: 'quests', map: 'map', character: 'character', relations: 'relations', journal: 'journal',
};

export function GameUI() {
  const hasG = useGame((s) => !!s.g);
  const menu = useUI((s) => s.menu);
  const pause = useUI((s) => s.pauseMenu);
  const shop = useUI((s) => s.shop);
  const craft = useUI((s) => s.craft);
  const mg = useUI((s) => s.minigame);
  const read = useUI((s) => s.read);
  const wait = useUI((s) => s.waitMenu);
  const travel = useUI((s) => s.fastTravel);
  const dead = useUI((s) => s.dead);
  const touchSetting = useSettings((s) => s.touch);
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setCoarse(mq.matches);
    const off = input.onAction((a) => {
      const s = ui();
      if (s.minigame || s.dead || s.cinematic) return;
      if (a === 'menu') {
        if (s.dialogue) { endDialogue(); return; }
        if (s.read || s.shop || s.craft || s.waitMenu || s.fastTravel) { setUI({ read: null, shop: null, craft: null, waitMenu: false, fastTravel: false }); bus.emit('sfx', { id: 'ui_close' }); return; }
        if (s.menu) { setUI({ menu: null }); bus.emit('sfx', { id: 'ui_close' }); return; }
        setUI({ pauseMenu: !s.pauseMenu });
        bus.emit('sfx', { id: s.pauseMenu ? 'ui_close' : 'ui_open' });
        return;
      }
      if (s.dialogue || s.shop || s.craft || s.pauseMenu) return;
      if (a === 'wait' && !s.menu) { setUI({ waitMenu: !s.waitMenu }); return; }
      const tab = MENU_KEYS[a];
      if (tab) {
        if (s.menu === tab) { setUI({ menu: null }); bus.emit('sfx', { id: 'ui_close' }); }
        else { setUI({ menu: tab, read: null, waitMenu: false }); bus.emit('sfx', { id: 'ui_open' }); }
      }
    });
    return off;
  }, []);

  if (!hasG) return null;
  const showTouch = touchSetting === 'on' || (touchSetting === 'auto' && coarse);
  return (
    <>
      <HUD />
      {showTouch && !menu && !mg && <TouchControls />}
      <Dialogue />
      {menu && <GameMenu />}
      {shop && <ShopOverlay />}
      {craft && <CraftOverlay />}
      {read && <ReadOverlay />}
      {wait && <WaitMenu />}
      {travel && <FastTravel />}
      {pause && <PauseMenu />}
      {mg && <MinigameHost />}
      {dead && <DeadScreen />}
    </>
  );
}
