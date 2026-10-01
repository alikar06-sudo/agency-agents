import type { ZoneDef, ZoneId } from '../types';
import { gates } from './gates';
import { hall } from './hall';
import { library } from './library';
import { towers } from './towers';
import { dungeons } from './dungeons';
import { tunnels } from './tunnels';
import { forest } from './forest';
import { village } from './village';
import { lake } from './lake';
import { ruins } from './ruins';
import { sanctum } from './sanctum';

export const ZONES: Record<ZoneId, ZoneDef> = { gates, hall, library, towers, dungeons, tunnels, forest, village, lake, ruins, sanctum };
