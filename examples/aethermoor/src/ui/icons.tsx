// Набор собственных SVG-иконок для предметов, заклинаний и интерфейса.
import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  potion: 'M9 2h6M10 2v5L5.5 15.5A4 4 0 0 0 9 21h6a4 4 0 0 0 3.5-5.5L14 7V2M7.5 13h9',
  potion_round: 'M10 2h4M11 2v4a7 7 0 1 0 2 0V2M6 14h12',
  wand: 'M4 20L16 8M16 8l2-2M18 4l.5 1.5L20 6l-1.5.5L18 8l-.5-1.5L16 6l1.5-.5zM13 11l-2-2',
  robe: 'M8 3l-4 4 2 3v11h12V10l2-3-4-4M8 3c1 2 2.5 3 4 3s3-1 4-3M12 6v15',
  hat: 'M3 19h18M6 19l5-16 7 16M9.5 12h7',
  ring: 'M12 9a6 6 0 1 0 0 12a6 6 0 0 0 0-12M9 4h6l-1.5 3h-3z',
  amulet: 'M6 3c0 4 2.5 7 6 9 3.5-2 6-5 6-9M12 12a4 4 0 1 0 0 8a4 4 0 0 0 0-8M12 14.5v3',
  leaf: 'M5 19C5 10 10 5 19 5c0 9-5 14-14 14zM5 19l8-8',
  flower: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 10V5a3 3 0 0 0-3 3M12 14v7M10 12H5a3 3 0 0 0 3 3M14 12h5a3 3 0 0 0-3-3M12 5a3 3 0 0 1 3 3',
  mushroom: 'M4 12a8 7 0 0 1 16 0zM10 12v7a2 2 0 0 0 4 0v-7M8 8.5h.01M15 7.5h.01',
  crystal: 'M12 2l5 6-5 14-5-14zM7 8h10M12 2v20',
  ore: 'M4 17l3-8 5-3 6 4 2 7-8 3zM9 12l3 2 3-3',
  water: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11zM9 15a3 3 0 0 0 3 3',
  tear: 'M12 3c3 5 5 8 5 11a5 5 0 0 1-10 0c0-3 2-6 5-11zM12 12a2 2 0 1 0 0 4',
  feather: 'M20 4C11 4 6 9 5 19M20 4c0 8-6 13-13 13M9 15l-4 4M12 10l-4 1M15 8l-4 .5',
  fang: 'M8 3c0 7 2 13 4 18 2-5 4-11 4-18zM10 7h4',
  silk: 'M4 12c4-6 12-6 16 0M4 12c4 6 12 6 16 0M12 4v16M6 6l12 12M18 6L6 18',
  essence: 'M12 3c4 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2-6 6-10zM10 14c0-1.5 1-3 2-4',
  star: 'M12 2l2.6 6.2L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.8z',
  branch: 'M4 20L18 6M10 14l-3-5M14 10l5 1M18 6l1-3',
  card: 'M6 3h12v18H6zM9 7h6M12 10l1.5 3H15l-1.2 1 .5 2L12 15l-2.3 1 .5-2L9 13h1.5z',
  coin: 'M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16M12 8v8M9.5 10.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.5-1 1.5-2.5 1.5-2.5.5-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5',
  book: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  scroll: 'M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1zM7 16V4M10 9h5M10 12h5',
  letter: 'M3 6h18v12H3zM3 6l9 7 9-7',
  key: 'M8 14a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM11 11l9 9M17 17l2-2M15 15l2-2',
  shard: 'M10 2l8 6-4 14-7-9zM10 2l4 20',
  seal: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M12 7v10M7 12h10M8.5 8.5l7 7M15.5 8.5l-7 7',
  charm: 'M12 3a3 3 0 0 0-3 3c0 2 3 3 3 3s3-1 3-3a3 3 0 0 0-3-3M12 9v3M8 14a4 4 0 1 0 8 0 4 4 0 0 0-8 0',
  lantern: 'M9 3h6M10 3v2M14 3v2M7 7h10l-1 12H8zM12 10c1.5 1.5 1.5 4 0 5-1.5-1-1.5-3.5 0-5',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  crate: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10',
  pie: 'M3 14h18l-2 5H5zM4 14c0-5 3.5-8 8-8s8 3 8 8M9 10l1 2M14 9l-1 2',
  // интерфейс
  bag: 'M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2',
  spellbook: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M12 7l1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L9 9.3l2-.3z',
  quest: 'M6 3h10l3 3v15H6zM9 9h7M9 13h7M9 17h4',
  mapicon: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.5-6 8-6s7 2 8 6',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  journal: 'M6 3h12v18H6zM9 3v18M12 8h4M12 12h4',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  hourglass: 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',
  close: 'M5 5l14 14M19 5L5 19',
  mouseL: 'M12 3a6 6 0 0 0-6 6v6a6 6 0 0 0 12 0V9a6 6 0 0 0-6-6zM12 3v7M6 10h6',
  mouseR: 'M12 3a6 6 0 0 1 6 6v6a6 6 0 0 1-12 0V9a6 6 0 0 1 6-6zM12 3v7M18 10h-6',
};

// Символы заклинаний
const SPELL: Record<string, string> = {
  spark: 'M12 3l1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6z',
  ward: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  light: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M5 19l2-2',
  gust: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8',
  flame: 'M12 22c4 0 7-3 7-7 0-4-3-6-4-10-1 3-3 4-4 4 0-2-1-4-2-6-1 4-4 7-4 12 0 4 3 7 7 7zM12 22c-2 0-3-1.5-3-3.5S12 14 12 14s3 2.5 3 4.5S14 22 12 22z',
  frost: 'M12 2v20M3.5 7l17 10M3.5 17l17-10M9 4l3 2 3-2M9 20l3-2 3 2',
  mend: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10zM12 9v6M9 12h6',
  blink: 'M4 12h10M10 7l5 5-5 5M18 5v14',
  bind: 'M6 20c0-6 3-8 6-8s6 2 6 8M8 4c1 4 2 6 4 8 2-2 3-4 4-8M12 12v8',
  unlock: 'M8 11V7a4 4 0 0 1 8 0M5 11h14v10H5zM12 15v2',
  reveal: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  storm: 'M13 2L5 14h6l-2 8 10-13h-6z',
  whisper: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM19 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  eclipse: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z',
  starfall: 'M17 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1zM8 9l1.5 4L13 14.5 9.5 16 8 20l-1.5-4L3 14.5 6.5 13z',
};

export function Icon({ name, size = 24, color = 'currentColor', stroke = 1.6, style }: { name: string; size?: number; color?: string; stroke?: number; style?: CSSProperties }) {
  const d = P[name] ?? SPELL[name] ?? P.scroll;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function SpellGlyph({ id, size = 30, color }: { id: string; size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} aria-hidden>
      <path d={SPELL[id] ?? SPELL.spark} />
    </svg>
  );
}

export function hex(n: number): string { return '#' + n.toString(16).padStart(6, '0'); }
