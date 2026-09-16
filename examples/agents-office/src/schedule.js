/* Расписание: задачи запускаются сами, без нажатия владельца.

   Читается из `расписание.json` рядом с пакетом знаний, чтобы менять его можно
   было без правки кода. Формат простой — время по часам и минутам местного
   пояса, а не cron: владельцу магазина cron читать незачем.

   [
     { "время": "09:00", "дни": "пн-пт", "агент": "restock-planner",
       "название": "Утренняя сводка остатков",
       "задача": "Посмотри остатки и назови позиции, которые кончатся за неделю." }
   ]

   Пропущенное время не догоняем: если сервер лежал до 11:00, утренняя сводка
   за 09:00 уже никому не нужна — она вводила бы в заблуждение свежей датой. */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DAYS = { вс: 0, пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6 };

/** «пн-пт», «сб,вс», «ежедневно» → множество номеров дней недели. */
function parseDays(spec) {
  const s = String(spec || 'ежедневно').trim().toLowerCase();
  if (!s || s === 'ежедневно' || s === 'все') return new Set([0, 1, 2, 3, 4, 5, 6]);
  const out = new Set();
  for (const chunk of s.split(/[,\s]+/).filter(Boolean)) {
    const range = chunk.split('-');
    if (range.length === 2 && DAYS[range[0]] !== undefined && DAYS[range[1]] !== undefined) {
      let d = DAYS[range[0]];
      const end = DAYS[range[1]];
      for (let guard = 0; guard < 8; guard++) {
        out.add(d);
        if (d === end) break;
        d = (d + 1) % 7;
      }
    } else if (DAYS[chunk] !== undefined) {
      out.add(DAYS[chunk]);
    }
  }
  return out.size ? out : new Set([0, 1, 2, 3, 4, 5, 6]);
}

function parseTime(spec) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(spec || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, min };
}

export function loadSchedule(dir) {
  const path = join(dir, 'расписание.json');
  if (!existsSync(path)) return [];
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error('[расписание] не разобрал расписание.json:', err.message);
    return [];
  }
  const list = Array.isArray(raw) ? raw : (raw.задачи || []);
  const out = [];
  for (const [i, item] of list.entries()) {
    const at = parseTime(item.время);
    if (!at) {
      console.error(`[расписание] пункт ${i + 1}: не понял время «${item.время}», пропускаю`);
      continue;
    }
    if (!item.задача) {
      console.error(`[расписание] пункт ${i + 1}: нет текста задачи, пропускаю`);
      continue;
    }
    out.push({
      id: `sched-${i + 1}`,
      at,
      days: parseDays(item.дни),
      agentId: item.агент || null,
      title: item.название || item.задача.slice(0, 60),
      input: item.задача,
      enabled: item.включено !== false,
    });
  }
  return out;
}

/** Ключ запуска — чтобы одно и то же время не сработало дважды за минуту. */
const stamp = (now, job) =>
  `${job.id}@${now.getFullYear()}-${now.getMonth()}-${now.getDate()}T${job.at.h}:${job.at.min}`;

export class Scheduler {
  constructor({ jobs, onFire, log }) {
    this.jobs = jobs;
    this.onFire = onFire;
    this.log = log || (() => {});
    this.fired = new Set();
    this.timer = null;
  }

  start() {
    if (!this.jobs.length) return this;
    this.tick();
    // раз в 30 секунд: минутная точность, а лишней нагрузки при этом нет
    this.timer = setInterval(() => this.tick(), 30000);
    this.timer.unref?.();
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick(now = new Date()) {
    for (const job of this.jobs) {
      if (!job.enabled) continue;
      if (!job.days.has(now.getDay())) continue;
      if (now.getHours() !== job.at.h || now.getMinutes() !== job.at.min) continue;
      const key = stamp(now, job);
      if (this.fired.has(key)) continue;
      this.fired.add(key);
      // множество не должно расти вечно — суток запусков более чем достаточно
      if (this.fired.size > 500) this.fired = new Set([key]);
      try {
        this.onFire(job);
        this.log('schedule.fired', { message: `По расписанию: ${job.title}` });
      } catch (err) {
        this.log('schedule.failed', { message: `Расписание «${job.title}»: ${err.message}` });
      }
    }
  }
}
