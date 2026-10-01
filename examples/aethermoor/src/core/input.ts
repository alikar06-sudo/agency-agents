// Ввод: клавиатура, мышь и сенсорное управление сводятся к одному набору «действий».

export type Action =
  | 'up' | 'down' | 'left' | 'right' | 'sprint' | 'dodge' | 'interact' | 'attack' | 'shield'
  | 'spell1' | 'spell2' | 'spell3' | 'spell4' | 'spell5' | 'spell6' | 'potion'
  | 'inventory' | 'spells' | 'quests' | 'map' | 'character' | 'relations' | 'journal' | 'menu' | 'wait';

export const KEYMAP: Record<string, Action> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'dodge', KeyE: 'interact', KeyF: 'interact',
  Digit1: 'spell1', Digit2: 'spell2', Digit3: 'spell3', Digit4: 'spell4', Digit5: 'spell5', Digit6: 'spell6',
  KeyQ: 'potion', KeyI: 'inventory', Tab: 'inventory', KeyK: 'spells', KeyJ: 'quests', KeyM: 'map', KeyC: 'character',
  KeyR: 'relations', KeyL: 'journal', Escape: 'menu', KeyT: 'wait',
};

// Переназначаемые действия: основная клавиша по умолчанию и подпись в настройках.
export const REBINDABLE: { action: Action; name: string; def: string }[] = [
  { action: 'up', name: 'Вперёд', def: 'KeyW' },
  { action: 'down', name: 'Назад', def: 'KeyS' },
  { action: 'left', name: 'Влево', def: 'KeyA' },
  { action: 'right', name: 'Вправо', def: 'KeyD' },
  { action: 'sprint', name: 'Бег', def: 'ShiftLeft' },
  { action: 'dodge', name: 'Кувырок', def: 'Space' },
  { action: 'interact', name: 'Взаимодействие', def: 'KeyE' },
  { action: 'potion', name: 'Быстрое зелье', def: 'KeyQ' },
  { action: 'spell1', name: 'Заклинание 1', def: 'Digit1' },
  { action: 'spell2', name: 'Заклинание 2', def: 'Digit2' },
  { action: 'spell3', name: 'Заклинание 3', def: 'Digit3' },
  { action: 'spell4', name: 'Заклинание 4', def: 'Digit4' },
  { action: 'spell5', name: 'Заклинание 5', def: 'Digit5' },
  { action: 'spell6', name: 'Заклинание 6', def: 'Digit6' },
  { action: 'character', name: 'Персонаж', def: 'KeyC' },
  { action: 'inventory', name: 'Инвентарь', def: 'KeyI' },
  { action: 'spells', name: 'Заклинания', def: 'KeyK' },
  { action: 'quests', name: 'Задания', def: 'KeyJ' },
  { action: 'map', name: 'Карта', def: 'KeyM' },
  { action: 'relations', name: 'Отношения', def: 'KeyR' },
  { action: 'journal', name: 'Дневник', def: 'KeyL' },
  { action: 'wait', name: 'Ожидание', def: 'KeyT' },
];

const SPECIAL: Record<string, string> = {
  Space: 'Пробел', ShiftLeft: 'Shift', ShiftRight: 'Shift (пр.)', ControlLeft: 'Ctrl', ControlRight: 'Ctrl (пр.)', AltLeft: 'Alt', AltRight: 'Alt (пр.)',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Tab: 'Tab', Enter: 'Enter', Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'Caps',
};
export function keyName(code: string): string {
  if (SPECIAL[code]) return SPECIAL[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

let effective: Record<string, Action> = { ...KEYMAP };
let customKeys: Partial<Record<Action, string>> = {};

// Применить пользовательские назначения поверх стандартной раскладки.
export function setBindings(custom: Partial<Record<Action, string>> | undefined): void {
  const map: Record<string, Action> = { ...KEYMAP };
  customKeys = { ...(custom ?? {}) };
  for (const r of REBINDABLE) {
    const code = custom?.[r.action];
    if (!code || code === r.def) continue;
    if (map[r.def] === r.action) delete map[r.def];
    map[code] = r.action;
  }
  effective = map;
}

// Текущая основная клавиша действия (для подсказок в интерфейсе).
export function boundKey(action: Action): string {
  const custom = customKeys[action];
  if (custom && effective[custom] === action) return keyName(custom);
  const r = REBINDABLE.find((x) => x.action === action);
  const code = Object.keys(effective).find((c) => effective[c] === action && (!r || c === r.def)) ?? Object.keys(effective).find((c) => effective[c] === action);
  return code ? keyName(code) : '—';
}

export const KEY_LABELS: { action: string; keys: string }[] = [
  { action: 'Движение', keys: 'W A S D / стрелки' },
  { action: 'Бег', keys: 'Shift' },
  { action: 'Уклонение (кувырок)', keys: 'Пробел' },
  { action: 'Взаимодействие / разговор', keys: 'E' },
  { action: 'Искра (основная атака)', keys: 'ЛКМ' },
  { action: 'Щит Эгиды (удерживать)', keys: 'ПКМ' },
  { action: 'Заклинания из книги', keys: '1 – 6' },
  { action: 'Быстрое зелье', keys: 'Q' },
  { action: 'Инвентарь', keys: 'I / Tab' },
  { action: 'Заклинания', keys: 'K' },
  { action: 'Задания', keys: 'J' },
  { action: 'Карта', keys: 'M' },
  { action: 'Персонаж', keys: 'C' },
  { action: 'Отношения', keys: 'R' },
  { action: 'Дневник', keys: 'L' },
  { action: 'Ожидание / время', keys: 'T' },
  { action: 'Меню / пауза', keys: 'Esc' },
];

class Input {
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  mouse = { x: 0, y: 0, nx: 0, ny: 0, left: false, right: false, leftPressed: false, rightPressed: false, inside: false };
  wheel = 0;
  touch = { moveX: 0, moveY: 0, aim: false, aimX: 0, aimY: 0, active: false };
  private listeners: (() => void)[] = [];
  private actionHandlers = new Set<(a: Action) => void>();
  enabled = true;

  attach(canvas: HTMLElement): void {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const a = effective[e.code];
      if (!a) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.down.has(a)) { this.pressed.add(a); for (const h of this.actionHandlers) h(a); }
      this.down.add(a);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const a = effective[e.code];
      if (a) this.down.delete(a);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.nx = (this.mouse.x / r.width) * 2 - 1;
      this.mouse.ny = -(this.mouse.y / r.height) * 2 + 1;
      this.mouse.inside = true;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      onMove(e);
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    };
    const onUp = (e: PointerEvent) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    };
    const onWheel = (e: WheelEvent) => { this.wheel += Math.sign(e.deltaY); };
    const onCtx = (e: Event) => e.preventDefault();
    const onBlur = () => { this.down.clear(); this.mouse.left = false; this.mouse.right = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: true });
    canvas.addEventListener('contextmenu', onCtx);
    window.addEventListener('blur', onBlur);
    this.listeners.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => canvas.removeEventListener('pointermove', onMove),
      () => canvas.removeEventListener('pointerdown', onDown),
      () => window.removeEventListener('pointerup', onUp),
      () => canvas.removeEventListener('wheel', onWheel),
      () => canvas.removeEventListener('contextmenu', onCtx),
      () => window.removeEventListener('blur', onBlur),
    );
  }

  detach(): void { this.listeners.forEach((f) => f()); this.listeners = []; }

  onAction(fn: (a: Action) => void): () => void {
    this.actionHandlers.add(fn);
    return () => this.actionHandlers.delete(fn);
  }

  isDown(a: Action): boolean { return this.down.has(a); }
  wasPressed(a: Action): boolean { return this.pressed.has(a); }

  // Сенсорные кнопки вызывают это напрямую.
  press(a: Action): void { this.pressed.add(a); for (const h of this.actionHandlers) h(a); }
  hold(a: Action, on: boolean): void { if (on) this.down.add(a); else this.down.delete(a); }

  endFrame(): void {
    this.pressed.clear();
    this.mouse.leftPressed = false;
    this.mouse.rightPressed = false;
    this.wheel = 0;
  }

  clear(): void { this.down.clear(); this.pressed.clear(); this.mouse.left = false; this.mouse.right = false; }
}

export const input = new Input();
