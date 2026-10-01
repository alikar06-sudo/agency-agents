import type { ZoneDef, ZoneId } from '../types';
import { gates } from './gates';
import { hall } from './hall';
import { placeholder } from './placeholder';

export const ZONES: Record<ZoneId, ZoneDef> = {
  gates,
  hall,
  library: placeholder('library', 'Библиотека', 'hall'),
  towers: placeholder('towers', 'Башни', 'hall'),
  dungeons: placeholder('dungeons', 'Подземелья', 'hall'),
  tunnels: placeholder('tunnels', 'Тоннели', 'dungeons'),
  forest: placeholder('forest', 'Лес', 'gates'),
  village: placeholder('village', 'Деревня', 'gates'),
  lake: placeholder('lake', 'Озеро', 'gates'),
  ruins: placeholder('ruins', 'Руины', 'forest'),
  sanctum: placeholder('sanctum', 'Святилище', 'tunnels'),
};
