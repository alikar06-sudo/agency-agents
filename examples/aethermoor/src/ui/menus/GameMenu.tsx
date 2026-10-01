import { useUI, setUI } from '@/state/store';
import type { MenuTab } from '@/state/store';
import { Icon } from '../icons';
import { CharacterTab } from './CharacterTab';
import { InventoryTab } from './InventoryTab';
import { SpellsTab } from './SpellsTab';
import { QuestsTab } from './QuestsTab';
import { MapTab } from './MapTab';
import { RelationsTab } from './RelationsTab';
import { JournalTab } from './JournalTab';
import { SettingsPanel } from '../overlays/SettingsPanel';
import { bus } from '@/core/bus';

const TABS: { id: MenuTab; name: string; icon: string; key: string }[] = [
  { id: 'character', name: 'Персонаж', icon: 'person', key: 'C' },
  { id: 'inventory', name: 'Инвентарь', icon: 'bag', key: 'I' },
  { id: 'spells', name: 'Заклинания', icon: 'spellbook', key: 'K' },
  { id: 'quests', name: 'Задания', icon: 'quest', key: 'J' },
  { id: 'map', name: 'Карта', icon: 'mapicon', key: 'M' },
  { id: 'relations', name: 'Отношения', icon: 'heart', key: 'R' },
  { id: 'journal', name: 'Дневник', icon: 'journal', key: 'L' },
  { id: 'settings', name: 'Настройки', icon: 'gear', key: '' },
];

export function GameMenu() {
  const menu = useUI((s) => s.menu)!;
  const close = () => { setUI({ menu: null }); bus.emit('sfx', { id: 'ui_close' }); };
  return (
    <div className="grimoire" onClick={close}>
      <div className="book panel panel-frame" onClick={(e) => e.stopPropagation()}>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={'tab' + (menu === t.id ? ' on' : '')} onClick={() => { setUI({ menu: t.id }); bus.emit('sfx', { id: 'page' }); }}>
              <Icon name={t.icon} size={18} />{t.name}{t.key && <span className="kbd">{t.key}</span>}
            </button>
          ))}
          <button className="tab-close" onClick={close} title="Закрыть (Esc)">✕</button>
        </div>
        <div className="tab-body">
          {menu === 'character' && <CharacterTab />}
          {menu === 'inventory' && <InventoryTab />}
          {menu === 'spells' && <SpellsTab />}
          {menu === 'quests' && <QuestsTab />}
          {menu === 'map' && <MapTab />}
          {menu === 'relations' && <RelationsTab />}
          {menu === 'journal' && <JournalTab />}
          {menu === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  );
}
