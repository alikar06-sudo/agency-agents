// Финал: эпилог из нескольких страниц, зависящий от выборов игрока, и итоговая статистика.
import { useMemo, useState } from 'react';
import { G, hasGame, setUI, useUI } from '@/state/store';
import { exitToTitle } from '@/game/game';
import { saveGame } from '@/systems/save';
import { fmt } from '@/systems/logic';
import { ACHIEVEMENTS, FOUNDER_MARKS } from '@/data/world';
import { CIRCLES } from '@/data/world';
import type { GameState } from '@/state/gameState';

interface EndingInfo { title: string; subtitle: string; color: string; pages: string[] }

function epilogue(id: string, g: GameState): EndingInfo {
  const f = g.flags;
  const rel = (n: string) => g.rel[n] ?? 0;
  const pages: string[] = [];
  const miraLine = f.mira_romance || rel('mira') >= 60
    ? 'Мира не отходила от вас ни на шаг. Через год на балконе Башни Звезды она сказала, что Венец Орина светит ярче, когда вы рядом. Это была очень плохая фраза. Вы попросили повторить.'
    : rel('mira') >= 25
      ? 'Мира стала лучшей ученицей рун за сто лет. Каждую свою работу она подписывает двумя именами — своим и вашим: «Без {name} я бы не дочитала».'
      : 'Мира перевелась в Башню Звезды для старших. Вы видитесь редко, но каждый раз она молча протягивает вам новую книгу.';
  const allies: string[] = [];
  if (f.ally_corvin || f.corvin_trusts) allies.push('Корвин снова преподаёт древние руны — и впервые за двадцать лет улыбается на уроках. Изредка.');
  else if (f.corvin_arrested) allies.push('Корвина оправдали лишь через месяц. Он не держит на вас зла — но и руки при встрече больше не подаёт.');
  if (f.pellinor_spared) allies.push('Пеллинор отбыл наказание в лазарете и вернулся к котлам. Его дочь поправилась. Пироги стали ещё вкуснее.');
  else if (f.pellinor_gone) allies.push('Пеллинора судил Совет магов. Говорят, в своей камере он варит зелья для тюремного лекаря и всё ещё спрашивает о дочери.');
  if (f.cassian_redeemed) allies.push('Кассиан отрёкся от наследства Морвелей. Теперь он староста Бастиона — строгий, справедливый и почти не язвительный.');
  else if (f.cassian_left) allies.push(f.cassian_defeated ? 'Кассиан исчез после битвы в Святилище. Через год на ваше имя пришло письмо без подписи: «Ты была права. Был прав. Неважно. Спасибо».' : 'О Кассиане больше никто не слышал.');
  if (f.toby_cured) allies.push('Тоби больше не ходит во сне. Зато печёт кривые пироги для всего Круга Пламени.');
  const village = (g.rep.village ?? 0) >= 30 ? 'В Ольховом Броде ваше имя произносят с теплом — и в «Дремлющем филине» для вас всегда держат место у огня.' : '';

  switch (id) {
    case 'guardian':
      pages.push('Трещина затянулась. Сердце Эфира снова билось ровно — тихо, тепло, под самым основанием замка. Полый Король рассыпался чёрным снегом, и снег растаял.');
      pages.push('Архимагистр Вейст поправился к Зимнему солнцевороту. На пиру он поднял кубок «за нового Хранителя» — и весь Большой зал встал. Даже Агата Блэквуд.');
      pages.push(miraLine);
      if (allies.length) pages.push(allies.join(' '));
      pages.push(`Вы окончили Академию лучш${g.player.gender === 'f' ? 'ей' : 'им'} учени${g.player.gender === 'f' ? 'цей' : 'ком'} Круга ${CIRCLES[g.player.circle].name.replace('Круг ', '')}. А потом остались — потому что Сердцу нужен Хранитель, а Этермуру нужен дом для тех, кто ещё не знает, что умеет колдовать. ${village}`);
      return { title: 'Хранитель Сердца', subtitle: 'Сердце — не сила, а клятва', color: '#f5dc95', pages };
    case 'sacrifice':
      pages.push('Белый свет заполнил Святилище. Когда он угас, Пустоты больше не было — нигде. Ни под замком, ни в снах учеников, ни в чьём-то голоде. Вместе с ней ушла и ваша магия.');
      pages.push('Вы проснулись в лазарете. Сестра Мэйбел плакала и ругалась одновременно. Вы протянули руку к свече — и ничего не случилось. Совсем ничего.');
      pages.push(miraLine);
      if (allies.length) pages.push(allies.join(' '));
      pages.push(`Вейст предложил вам остаться — преподавать историю Основателей. «Кто лучше расскажет о цене света, чем тот, кто её заплатил?» Вы согласились. Ученики любят ваши уроки: на них никогда ничего не взрывается. ${village}`);
      return { title: 'Цена света', subtitle: 'Вы отдали всё — и мир стал целым', color: '#e8e4dc', pages };
    case 'free':
      pages.push('Сердце раскололось — и свет ушёл вверх, сквозь камень, сквозь замок, в ночное небо. В ту ночь Венец Орина горел так ярко, что его видели за тысячу лиг.');
      pages.push('Чудо долины угасло. Свечи больше не парят в Большом зале. Лестницы перестали менять направление. Но в далёких городах дети вдруг начали зажигать огоньки на ладонях — просто так, от радости.');
      pages.push(miraLine);
      if (allies.length) pages.push(allies.join(' '));
      pages.push(`Этермур перестал быть крепостью. Теперь это школа для всех, у кого проснулась искра, — а таких тысячи. Вейст сказал, что Орин наконец может спать спокойно. Вы ведёте новичков от ворот в Большой зал и каждый раз смотрите, как они впервые видят замок. ${village}`);
      return { title: 'Свободный Эфир', subtitle: 'Выбор Орина, сделанный спустя тысячу лет', color: '#9fd0ff', pages };
    default:
      pages.push('Свет тёк в вас, пока не осталось ничего, кроме света — и голода под ним. Мира кричала ваше имя. Вы больше не слышали.');
      pages.push('Той ночью над Этермуром погасли все звёзды Венца Орина. Академию закрыли. Учеников развезли по домам. Под замком что-то дышит — медленно, терпеливо.');
      pages.push(f.mira_rescued ? 'Мира Вэйл не вернулась домой. Говорят, она годами изучает руны Основателей в руинах Первой Академии вместе с призраком архивариуса. Она ищет способ запечатать то, что когда-то было вами.' : 'Мира так и не выбралась из Святилища.');
      pages.push('Полый Король носит новое лицо. Иногда, очень редко, оно вспоминает балкон Башни Звезды — и голод на миг затихает.');
      return { title: 'Полый венец', subtitle: 'Голод не кончается никогда', color: '#c08aff', pages };
  }
}

export function Ending() {
  const id = useUI((s) => s.ending) ?? (hasGame() ? G().ending : null) ?? 'guardian';
  const g = hasGame() ? G() : null;
  const info = useMemo(() => (g ? epilogue(id, g) : null), [id, g]);
  const [page, setPage] = useState(-1);
  const [saving, setSaving] = useState(false);
  if (!g || !info) return null;
  const last = info.pages.length;

  const stats: [string, string | number][] = [
    ['Дней в Этермуре', g.time.day],
    ['Уровень', g.player.level],
    ['Изучено заклинаний', g.spells.known.length],
    ['Побеждено противников', g.counters.kills ?? 0],
    ['Выполнено заданий', Object.values(g.quests).filter((q) => q.state === 'done').length],
    ['Знаков Основателей', `${g.counters.founder_marks ?? 0} / ${FOUNDER_MARKS}`],
    ['Достижений', `${g.achievements.length} / ${Object.keys(ACHIEVEMENTS).length}`],
    ['Порча', g.player.corruption],
  ];

  const keepPlaying = async () => {
    setSaving(true);
    await saveGame('auto', true);
    setUI({ screen: 'game', ending: null });
  };

  return (
    <div className="ending">
      <div className="inner" key={page}>
        {page < 0 && (
          <>
            <div className="faint" style={{ letterSpacing: 4, textTransform: 'uppercase', fontSize: 13 }}>Концовка</div>
            <h1 style={{ color: info.color }}>{info.title}</h1>
            <p className="dim" style={{ fontStyle: 'italic' }}>{info.subtitle}</p>
            <button className="btn primary" onClick={() => setPage(0)} autoFocus>Читать эпилог</button>
          </>
        )}
        {page >= 0 && page < last && (
          <>
            <p>{fmt(info.pages[page])}</p>
            <div className="faint" style={{ margin: '10px 0 18px' }}>{page + 1} / {last}</div>
            <button className="btn primary" onClick={() => setPage(page + 1)} autoFocus>{page + 1 < last ? 'Далее' : 'Итоги'}</button>
          </>
        )}
        {page >= last && (
          <>
            <h1 style={{ color: info.color, fontSize: 'clamp(32px, 5vw, 52px)' }}>{g.player.name}</h1>
            <div className="dim" style={{ marginBottom: 16 }}>{info.title} · {CIRCLES[g.player.circle].name}</div>
            <div className="ending-stats">
              {stats.map(([k, v]) => (<div key={k}><span className="dim">{k}</span><b>{v}</b></div>))}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
              {id !== 'dark' && <button className="btn primary" disabled={saving} onClick={() => void keepPlaying()}>Продолжить исследовать мир</button>}
              <button className="btn" onClick={() => void exitToTitle()}>Главное меню</button>
            </div>
            <div className="faint" style={{ marginTop: 14, fontSize: 14 }}>Другие выборы ведут к другим концовкам. Всего их четыре.</div>
          </>
        )}
      </div>
    </div>
  );
}
