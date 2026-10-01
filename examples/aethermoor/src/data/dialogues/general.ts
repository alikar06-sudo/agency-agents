// Повседневные разговоры: уроки, лавки, слухи, предложения заданий.
import type { DialogueChoice, DialogueDef, SubjectId } from '../types';

const bye = (text = 'До встречи.'): DialogueChoice => ({ text });

function lessonChoices(s: SubjectId): DialogueChoice[] {
  return [
    { text: 'Начать урок.', tag: '[Урок]', if: [{ not: { exam: s } }, { not: { examReady: s } }], req: [{ lessonReady: s }], effects: [{ lesson: s }] },
    { text: 'Я готов{g:|а} сдавать экзамен.', tag: '[Экзамен]', if: [{ examReady: s }], effects: [{ lesson: s }] },
  ];
}

export const general: DialogueDef[] = [
  // ---------------- Преподаватели ----------------
  {
    id: 'lowe_main', npc: 'lowe', start: 's',
    nodes: {
      s: { speaker: 'lowe', text: 'А?.. Ах, это вы, {name}. Я не спал. Я… размышлял о природе Эфира. С закрытыми глазами. Так глубже.',
        choices: [...lessonChoices('theory'),
          { text: 'Что такое Эфир, магистр?', next: 'aether' },
          { text: 'Вы ведь помните старые времена. Что вы знаете о пятом Основателе?', if: [{ act: 2 }], next: 'fifth' },
          bye()] },
      aether: { speaker: 'lowe', text: 'Эфир — не сила, а связь. Нить между всем живым. Маг не создаёт, а просит. Хороший маг — вежливо просит. Плохой — требует. А очень плохой… берёт, не спрашивая.', effects: [{ lore: 'aether' }], next: 's' },
      fifth: { speaker: 'lowe', text: 'Пятый? Хм… хм-м… В году… в году… Хррр… — А? Пятый чего? Пятый урок отменён. До свидания.', effects: [{ setFlag: 'lowe_dodged' }] },
    },
  },
  {
    id: 'pellinor_main', npc: 'pellinor', start: 's',
    nodes: {
      s: { speaker: 'pellinor', text: 'А-а, {name}! Проходи, проходи! Сегодня котлы бурлят особенно жизнерадостно. Не трогай вон тот, фиолетовый. Он кусается.',
        choices: [...lessonChoices('potions'),
          { text: 'Можно поработать за котлом самостоятельно?', effects: [{ openCraft: 'alchemy' }] },
          { text: 'Какой ваш любимый рецепт?', next: 'fav' },
          { text: 'Вы часто бываете в деревне по вечерам?', if: [{ act: 3 }], next: 'village' },
          bye()] },
      fav: { speaker: 'pellinor', text: 'Пирог с ревенём! Ах, ты про зелья… Сонный отвар. Капля — и спишь как младенец. Две — как очень послушный младенец. Шучу, шучу!', effects: [{ setFlag: 'pellinor_sleep_hint' }], next: 's' },
      village: { speaker: 'pellinor', text: 'В «Дремлющем филине» лучшие пироги в долине! А что? Учителю нельзя пирог? Хо-хо! Беги, беги, у меня… инвентаризация.', next: 's' },
    },
  },
  {
    id: 'gravane_main', npc: 'gravane', start: 's',
    nodes: {
      s: { speaker: 'gravane', text: '{name}. Вы стоите так, будто ждёте, что я превращу вас в чайник. Не дождётесь. Это шестой курс.',
        choices: [...lessonChoices('transfig'),
          { text: 'Что нужно, чтобы стать лучшим в трансформации?', next: 'best' },
          { text: 'Вы патрулируете галерею по ночам?', next: 'patrol' },
          bye()] },
      best: { speaker: 'gravane', text: 'Внимание. Терпение. И привычка дочитывать задание до конца, прежде чем размахивать палочкой. Последнее встречается реже всего.', next: 's' },
      patrol: { speaker: 'gravane', text: 'Патрулирую. И если увижу вас там после десяти, превращу ваши выходные в отработки. Это я умею даже без палочки.', next: 's' },
    },
  },
  {
    id: 'gravane_caught', npc: 'gravane', start: 's',
    nodes: {
      s: { speaker: 'gravane', text: 'Ночная прогулка, {name}? Я видела ваш отчёт от стражи. Минус пятнадцать очков. И в следующий раз — отработка у лесничего.',
        choices: [
          { text: 'Я искал{g:|а} ответы на сбои.', effects: [{ clearFlag: 'caught_curfew_pending' }, { rel: 'gravane', delta: 2 }], next: 'excuse' },
          { text: 'Простите, профессор. Больше не повторится.', effects: [{ clearFlag: 'caught_curfew_pending' }, { rel: 'gravane', delta: 4 }] },
        ] },
      excuse: { speaker: 'gravane', text: 'Ответы, которые ищут ночью, обычно находят ищущих первыми. Будьте осторожны. Это не совет. Это приказ.' },
    },
  },
  {
    id: 'corvin_main', npc: 'corvin', start: 's',
    nodes: {
      s: { speaker: 'corvin', text: 'Вам что-то нужно, {name}? Говорите быстрее. Тени не ждут.',
        choices: [...lessonChoices('defense'), ...lessonChoices('runes').map((c) => ({ ...c, text: c.text.replace('урок', 'урок рун').replace('экзамен', 'экзамен по рунам') })),
          { text: 'Что вы делаете по ночам в подземельях?', if: [{ act: 2 }], next: 'night' },
          { text: 'Мне нужно в запретную секцию. Подпишете пропуск?', if: [{ objActive: ['mq_restricted', 'access'] }, { noItem: 'restricted_pass' }], next: 'pass' },
          { text: 'Почему вы никому не доверяете?', if: [{ rel: 'corvin', gte: 15 }], next: 'trust' },
          bye('Не смею задерживать.')] },
      pass: { speaker: 'corvin', text: 'Запретная секция. Первокурсни{g:ку|це}. Назовите хоть одну причину, по которой я должен это сделать.',
        choices: [
          { text: '[Отношения 10] Вы сами говорили: тени не ждут. Я ищу то же, что и вы.', tag: '[Отношения 10]', req: [{ rel: 'corvin', gte: 10 }], next: 'sign' },
          { text: '[Интеллект 7] Печатные руны в замке трескаются. Вы это видите не хуже меня.', tag: '[Интеллект 7]', req: [{ stat: 'int', gte: 7 }], next: 'sign' },
          { text: 'Ладно, забудьте.', next: 's' },
        ] },
      sign: { speaker: 'corvin', text: '…Хм. Вот. Подпись. Одна книга, одна ночь. И если Квилл спросит — вы украли перо у меня со стола.',
        effects: [{ give: 'restricted_pass' }, { setFlag: 'corvin_signed' }, { rel: 'corvin', delta: 5 }] },
      night: { speaker: 'corvin', text: 'Наблюдаю за тем, за чем другие не наблюдают. Если вам тоже не спится — ложитесь раньше. Помогает.', effects: [{ rel: 'corvin', delta: -1 }], next: 's' },
      trust: { speaker: 'corvin', text: 'Однажды я доверился лучшему другу. Он был блестящим учеником. Самым блестящим за полвека. Теперь его имя здесь не произносят. Этого достаточно?', effects: [{ setFlag: 'corvin_past_hint' }, { rel: 'corvin', delta: 3 }], next: 's' },
    },
  },
  {
    id: 'dorn_main', npc: 'dorn', start: 's',
    nodes: {
      s: { speaker: 'dorn', text: 'А, {name}! Ну что, ноги размяты? На поле не стоят — на поле двигаются!',
        choices: [...lessonChoices('practical'),
          { text: 'Дайте совет для боя.', next: 'tips' },
          { text: 'Расскажите о резонансах заклинаний.', if: [{ flag: 'knows_combos' }], next: 'combos' },
          { text: 'Как дела с турниром?', if: [{ quest: 'sq_dueling', is: 'active' }], next: 'duel' },
          { text: 'Хочу пройти гонку над озером.', if: [{ quest: 'sq_flight', is: 'active' }], next: 'flight' },
          bye()] },
      tips: { speaker: 'dorn', text: 'Красный круг на земле — туда сейчас прилетит. Уходи Пробелом. Щит (ПКМ) поднимай в последний миг — тогда он отражает снаряды обратно. И не стой на месте, когда творишь: стоячая мишень — мёртвая мишень.', next: 's' },
      combos: { speaker: 'dorn', text: 'Заморозь врага Инеем, потом жги Пламенем — пар разорвёт всё вокруг. Скуй Оковами и бей Молнией. Подожги и раздуй Порывом. Магия — не одна нота, а аккорд.', next: 's' },
      duel: { speaker: 'dorn', text: 'Соперники ждут. Выбирай: с кем сразишься?',
        choices: [
          { text: 'Агата Блэквуд.', if: [{ objActive: ['sq_dueling', 'agatha'] }], effects: [{ minigame: { type: 'duel', id: 'duel_agatha', opponent: 'agatha', difficulty: 2, title: 'Дуэль: Агата Блэквуд' } }] },
          { text: 'Нико Фэй.', if: [{ objActive: ['sq_dueling', 'nico'] }], effects: [{ minigame: { type: 'duel', id: 'duel_nico', opponent: 'nico', difficulty: 3, title: 'Дуэль: Нико Фэй' } }] },
          { text: 'Кассиан Морвель. Финал.', if: [{ objActive: ['sq_dueling', 'cassian'] }, { objDone: ['sq_dueling', 'agatha'] }, { objDone: ['sq_dueling', 'nico'] }], effects: [{ minigame: { type: 'duel', id: 'duel_cassian', opponent: 'cassian', difficulty: 4, title: 'Финал: Кассиан Морвель' } }] },
          { text: 'Позже.', next: 's' },
        ] },
      flight: { speaker: 'dorn', text: 'Старт у пристани Зеркального озера, рядом с лодкой Ольма. Диск там. Держись ниже над водой — ветер злой.', next: 's' },
    },
  },
  {
    id: 'dorn_dueling_offer', npc: 'dorn', start: 's',
    nodes: {
      s: { speaker: 'dorn', text: '{name}! Слыхал, ты не пасуешь перед тенями. Я собираю дуэльный турнир первокурсников. Три боя — и приз от меня лично. Записать?',
        choices: [
          { text: 'Записывайте!', effects: [{ startQuest: 'sq_dueling' }, { rel: 'dorn', delta: 5 }], next: 'ok' },
          { text: 'Пока не готов{g:|а}.', next: 'no' },
        ] },
      ok: { speaker: 'dorn', text: 'Отлично! Дуэли — в Дуэльном зале и здесь, на поле, когда скажешь. Удачи. И не вздумай проиграть Морвелю — он потом месяц будет об этом рассказывать.' },
      no: { speaker: 'dorn', text: 'Ничего. Предложение в силе.', effects: [{ startQuest: 'sq_dueling' }] },
    },
  },
  {
    id: 'dorn_flight_offer', npc: 'dorn', start: 's',
    nodes: {
      s: { speaker: 'dorn', text: 'Ещё кое-что! На Зеркальном озере проходит гонка на парящих дисках. Кольца над водой, ветер в лицо. Хочешь попробовать?',
        choices: [
          { text: 'Конечно!', effects: [{ startQuest: 'sq_flight' }], next: 'ok' },
          { text: 'Я лучше на земле.', effects: [{ startQuest: 'sq_flight' }] },
        ] },
      ok: { speaker: 'dorn', text: 'Старт у пристани, где рыбачит старый Ольм. Тропа к озеру — от ворот на запад. Её откроют, когда… ну, когда разрешат. Пока — тренируйся.' },
    },
  },
  {
    id: 'foxglove_main', npc: 'foxglove', start: 's',
    nodes: {
      s: { speaker: 'foxglove', text: '{name}! Осторожно, не наступи на Пушистика. Это мох. Но очень ранимый мох.',
        choices: [...lessonChoices('creatures'),
          { text: 'Как справляться с лесными созданиями?', next: 'tips' },
          bye()] },
      tips: { speaker: 'foxglove', text: 'Огоньки боятся холода — Иней их гасит. Гончие тени боятся огня. А пауки-ткачи — всего. Но лучше всего — «Шёпот». Испуганное существо не нападает, если с ним поговорить.', next: 's' },
    },
  },
  {
    id: 'foxglove_spirits', npc: 'foxglove', start: 's',
    nodes: {
      s: { speaker: 'foxglove', text: 'Ты слышал{g:|а} о духах Зеркального озера? Старый Ольм говорит, они стали злые. Я не верю, что они злые. Им просто очень грустно. Попробуешь спеть им «Шёпотом»?',
        choices: [
          { text: 'Попробую.', effects: [{ startQuest: 'sq_lake_spirits' }, { rel: 'foxglove', delta: 5 }] },
          { text: 'А если не поможет?', next: 'fail' },
        ] },
      fail: { speaker: 'foxglove', text: 'Тогда… сделай то, что должен. Но сначала — песня. Обещаешь?', effects: [{ startQuest: 'sq_lake_spirits' }] },
    },
  },
  {
    id: 'quill_main', npc: 'quill', start: 's',
    nodes: {
      s: { speaker: 'quill', text: 'Шёпотом, {name}. Здесь даже пыль ложится по алфавиту.',
        choices: [
          { text: 'Можно в запретную секцию?', next: 'restricted' },
          { text: 'Что интересного почитать?', next: 'read' },
          { text: 'Вот ваши потерянные тома.', if: [{ objActive: ['sq_lost_tomes', 'return'] }], effects: [{ take: 'lost_tome', count: 3 }, { completeObjective: ['sq_lost_tomes', 'return'] }], next: 'thanks' },
          bye()] },
      restricted: { speaker: 'quill', text: 'Нет. Если, конечно, у вас нет подписи преподавателя. Или если вы не доказали мне, что умеете обращаться с книгами.',
        choices: [
          { text: 'Я вернул{g:|а} ваши тома. Это ведь доказательство?', if: [{ rel: 'quill', gte: 30 }], next: 'pass' },
          { text: 'Понятно.', next: 's' },
        ] },
      pass: { speaker: 'quill', text: '…Хм. Вы аккуратны. И не загибаете страницы. Держите пропуск. Одна ночь. Одна книга. И если хоть одна страница пострадает…',
        effects: [{ give: 'restricted_pass' }, { setFlag: 'quill_gave_pass' }] },
      read: { speaker: 'quill', text: '«Травник Сильвии». «Сто рун для начинающих». «Почему не стоит злить архивариуса». Последняя — короткая и очень полезная.', next: 's' },
      thanks: { speaker: 'quill', text: 'Все три. Без пятен. Без загнутых углов. Вы… приятное исключение из правил, {name}.' },
    },
  },
  {
    id: 'quill_tomes_offer', npc: 'quill', start: 's',
    nodes: {
      s: { speaker: 'quill', text: 'Вы. Да, вы. Три книги пропали из моего каталога. ТРИ. «Звёздные циклы», «Травник Сильвии» и «Руны для чайников». Наверняка валяются где-нибудь в замке. Найдёте — запомню.',
        choices: [
          { text: 'Я поищу.', effects: [{ startQuest: 'sq_lost_tomes' }, { rel: 'quill', delta: 3 }] },
          { text: '«Руны для чайников»? Серьёзно?', next: 'joke' },
        ] },
      joke: { speaker: 'quill', text: 'Классика. Автор — сам Орин. У него было чувство юмора. Ищите.', effects: [{ startQuest: 'sq_lost_tomes' }] },
    },
  },
  {
    id: 'quill_breakin', npc: 'quill', start: 's',
    nodes: {
      s: { speaker: 'quill', text: 'Кто-то был в запретной секции ночью. Следы пальцев на пыли. Маленькие, неуверенные пальцы первокурсника. Ваши, {name}?',
        choices: [
          { text: 'Да. Простите. Это было очень важно.', effects: [{ rel: 'quill', delta: -8 }, { setFlag: 'quill_knows_breakin' }], next: 'honest' },
          { text: 'Не понимаю, о чём вы.', effects: [{ rel: 'quill', delta: -20 }, { setFlag: 'quill_knows_breakin' }, { rep: 'academy', delta: -5 }], next: 'lie' },
          { text: '(Шёпот) Книгу не тронули. Я берег{g:|ла} её.', tag: '[Шёпот]', req: [{ whisper: 'quill' }], effects: [{ rel: 'quill', delta: -2 }, { setFlag: 'quill_knows_breakin' }], next: 'whisper' },
        ] },
      honest: { speaker: 'quill', text: 'Честность — единственное, что спасает вас от отработки. Это и то, что книга цела. Но доверие, {name}, возвращается медленнее книг.' },
      lie: { speaker: 'quill', text: 'Ну-ну. Ложь в библиотеке пахнет хуже плесени. Я это запомню.' },
      whisper: { speaker: 'quill', text: '…Да. Она цела. Странно — я почти не сержусь. Но больше так не делайте.' },
    },
  },
  {
    id: 'mabel_main', npc: 'mabel', start: 's',
    nodes: {
      s: { speaker: 'mabel', text: 'Опять ты, {name}! Где болит? Ничего не болит? Тогда зачем пришёл{g:|а}? Шучу. Садись, отдышись.',
        choices: [
          { text: 'Подлечите меня, пожалуйста.', effects: [{ heal: true }], next: 'healed' },
          { text: 'Научите меня исцелению.', if: [{ noSpell: 'mend' }, { level: 3 }], next: 'teach' },
          { text: 'Можно поработать за вашим котлом?', effects: [{ openCraft: 'alchemy' }] },
          bye()] },
      healed: { speaker: 'mabel', text: 'Вот так. Как новенький{g:|ая}. А теперь — марш отсюда, у меня тут трое с лестницы упали.' },
      teach: { speaker: 'mabel', text: 'Ладно, ладно. Смотри: ладонь вот так, голос — тише. «Сильва мэр». Не лечи то, чего не понимаешь. И себя — в первую очередь.', effects: [{ learnSpell: 'mend' }, { rel: 'mabel', delta: 5 }] },
    },
  },
  {
    id: 'brassby_main', npc: 'brassby', start: 's',
    nodes: {
      s: { speaker: 'brassby', text: 'ТИК. Покупатель опознан: {name}, первый курс, {circle}. Каптёрка Академии к вашим услугам. Всё по уставу. Всё по описи.',
        choices: [
          { text: 'Покажи товары.', effects: [{ openShop: 'quartermaster' }] },
          { text: 'Сколько тебе лет, Бронзобокий?', next: 'age' },
          bye('Конец связи.')] },
      age: { speaker: 'brassby', text: 'Девятьсот восемьдесят семь лет, четыре месяца, два дня. Завод — каждое полнолуние. Последний сбой — вчера в 23:14. Странно. Сбоев не было триста лет.', effects: [{ setFlag: 'brassby_glitch_hint' }], next: 's' },
    },
  },
  {
    id: 'ulrich_main', npc: 'ulrich', start: 's',
    nodes: {
      s: { speaker: 'ulrich', text: '{name}. Всё спокойно? Вот и славно.',
        choices: [
          { text: 'Что нового у ворот?', next: 'news' },
          { text: 'Вы видели по ночам что-нибудь странное?', if: [{ act: 2 }], next: 'strange' },
          bye()] },
      news: { speaker: 'ulrich', text: 'Карета с продуктами опоздала, кот поймал мышь, а Бран опять притащил из леса что-то шипящее. Обычный день.', next: 's' },
      strange: { speaker: 'ulrich', text: 'Видел. Фигуры в капюшонах у дороги к озеру. Пропадают, если смотреть прямо. Я доложил Архимагистру. Он сказал «спасибо». Не люблю, когда он говорит «спасибо» таким тоном.', effects: [{ setFlag: 'ulrich_hooded_hint' }], next: 's' },
    },
  },
  {
    id: 'bran_main', npc: 'bran', start: 's',
    nodes: {
      s: { speaker: 'bran', text: 'Ого, {name}! Заходи, не стесняйся. Чайник всегда горячий, а печенье… ну, почти всегда съедобное.',
        choices: [
          { text: 'Расскажи о Шепчущем лесе.', next: 'forest' },
          { text: 'Вот огоньки и разогнаны.', if: [{ objActive: ['sq_bran_garden', 'return'] }], effects: [{ completeObjective: ['sq_bran_garden', 'return'] }], next: 'thanks' },
          { text: 'Этот осколок шепчет. Помоги мне его уничтожить.', if: [{ objActive: ['hq_black_rune', 'choice'] }], next: 'rune' },
          bye()] },
      forest: { speaker: 'bran', text: 'Лес живой, понимаешь? Не как люди — по-своему. Днём там огоньки да травы. А ночью гончие выходят. И в глубине есть место… круглая поляна с камнями. Туда даже я не хожу.', effects: [{ setFlag: 'bran_glade_hint' }], next: 's' },
      thanks: { speaker: 'bran', text: 'Вот спасибо! Тыквы снова тыквы, а не фонари. Держи, ветки от старого дуба — Горан из них жезлы делает.' },
      rune: { speaker: 'bran', text: 'Ох… Мерзкая штука. Давай сюда. Положим в корни старого дуба — лес её переварит. Только подумай: может, она тебе нужна? Нет? Ну и правильно.',
        choices: [
          { text: 'Уничтожь её.', effects: [{ take: 'black_rune' }, { setFlag: 'rune_decided' }, { setFlag: 'rune_destroyed' }, { rep: 'forest', delta: 15 }, { corruption: -10 }] },
          { text: 'Нет… Я оставлю её себе.', effects: [{ setFlag: 'rune_decided' }, { corruption: 10 }, { rel: 'bran', delta: -5 }] },
        ] },
    },
  },
  {
    id: 'bran_garden_offer', npc: 'bran', start: 's',
    nodes: {
      s: { speaker: 'bran', text: 'Слушай, {name}, выручишь? Огоньки повадились к моей хижине. Светят в окна, тыквы пугают, мне спать не дают. Разгонишь штук пять?',
        choices: [
          { text: 'Конечно, Бран.', effects: [{ startQuest: 'sq_bran_garden' }, { rel: 'bran', delta: 5 }] },
          { text: 'Может, позже.', effects: [{ startQuest: 'sq_bran_garden' }] },
        ] },
    },
  },

  // ---------------- Ученики ----------------
  {
    id: 'mira_main', npc: 'mira', start: 's',
    nodes: {
      s: { speaker: 'mira', text: '{name}! Ты не поверишь, что я сегодня вычитала. Хотя… ты, наверное, поверишь. Ты всегда веришь.',
        choices: [
          { text: 'Что вычитала?', next: 'read' },
          { text: 'Как тебе в Круге Звезды?', next: 'circle' },
          { text: 'Мира, ты в порядке? Выглядишь уставшей.', if: [{ act: 2 }], next: 'tired', once: 'mira_tired_asked' },
          bye('Увидимся!')] },
      read: { speaker: 'mira', text: 'Что в старой школе на холме был пожар — в тот же год, когда «пятый ушёл под камень». Совпадение? В хрониках нет совпадений. Только недосказанности.', effects: [{ lore: 'first_academy' }], next: 's' },
      circle: { speaker: 'mira', text: 'Прекрасно! Ну… почти. Все думают, что я зазнайка. А я просто люблю, когда всё сходится. Ты ведь не думаешь, что я зазнайка?',
        choices: [
          { text: 'Ты лучшая из всех, кого я здесь встретил{g:|а}.', effects: [{ rel: 'mira', delta: 6 }], next: 's' },
          { text: 'Немножко зазнайка. Но в хорошем смысле.', effects: [{ rel: 'mira', delta: 3 }], next: 's' },
        ] },
      tired: { speaker: 'mira', text: 'Мне снится один и тот же сон: темнота, и кто-то зовёт меня по имени снизу. Голос добрый. Это и пугает.', effects: [{ rel: 'mira', delta: 4 }, { setFlag: 'mira_dream' }], next: 's' },
    },
  },
  {
    id: 'toby_main', npc: 'toby', start: 's',
    nodes: {
      s: { speaker: 'toby', text: 'О, {name}! Хочешь шоколадную сову? У меня осталась одна. Ну, половина. Ну, крыло.',
        choices: [
          { text: 'Спасибо, Тоби.', effects: [{ rel: 'toby', delta: 2 }], next: 'card' , once: 'toby_card_given' },
          { text: 'Как твои дела?', next: 'how' },
          { text: 'Вот твоя сова-талисман!', if: [{ objActive: ['sq_toby_charm', 'return'] }], effects: [{ take: 'toby_charm' }, { completeObjective: ['sq_toby_charm', 'return'] }], next: 'charm' },
          bye()] },
      card: { speaker: 'toby', text: 'Внутри была карточка! Опять Торвальд. У меня их уже восемь. Хочешь? Держи!', effects: [{ give: 'founder_card' }], next: 's' },
      how: { speaker: 'toby', text: 'Нормально. Только сплю плохо. Снится, что я иду вниз по лестнице, а она всё не кончается. Мама говорит, это от сыра на ночь.', effects: [{ setFlag: 'toby_dream' }], next: 's' },
      charm: { speaker: 'toby', text: 'МОЯ СОВА! Где ты её нашёл{g:|ла}?! Ты лучш{g:ий|ая}! Я… я никогда этого не забуду. Честно.' },
    },
  },
  {
    id: 'toby_charm_offer', npc: 'toby', start: 's',
    nodes: {
      s: { speaker: 'toby', text: '{name}… ты не видел{g:|а} деревянную сову на шнурке? Папа вырезал. Я её у фонтана уронил, точно помню. А там — ничего. Как сквозь землю.',
        choices: [
          { text: 'Я поищу, Тоби.', effects: [{ startQuest: 'sq_toby_charm' }, { rel: 'toby', delta: 5 }] },
          { text: 'Может, её кто-то подобрал?', next: 'who' },
        ] },
      who: { speaker: 'toby', text: 'Кто-нибудь вроде Нико… Нет, Нико бы вернул. Наверное. Ты поищешь? Пожалуйста?', effects: [{ startQuest: 'sq_toby_charm' }] },
    },
  },
  {
    id: 'toby_letter_offer', npc: 'toby', start: 's',
    nodes: {
      s: { speaker: 'toby', text: 'Слушай, ты ведь ходишь в Ольховый Брод? Отнеси письмо тётушке Марте в «Дремлющий филин»? Она волнуется. Она всегда волнуется. Это у нас семейное.',
        choices: [
          { text: 'Давай письмо.', effects: [{ startQuest: 'sq_letter' }, { give: 'letter_home' }] },
          bye('Не сейчас, Тоби.')] },
    },
  },
  {
    id: 'cassian_main', npc: 'cassian', start: 's',
    nodes: {
      s: { speaker: 'cassian', text: 'Опять ты. Что на этот раз?',
        choices: [
          { text: 'Просто хотел{g:|а} поговорить.', next: 'talk' },
          { text: 'Ты правда думаешь, что фамилия делает тебя лучше?', next: 'name', effects: [{ rel: 'cassian', delta: -2 }] },
          { text: 'Ты в последнее время какой-то мрачный.', if: [{ act: 2 }, { rel: 'cassian', gte: 10 }], next: 'dark' },
          bye()] },
      talk: { speaker: 'cassian', text: 'Поговорить. Со мной. Ну, говори, раз пришёл{g:|ла}. Только быстро — Морвели не тратят время на… ладно. Неважно.', effects: [{ rel: 'cassian', delta: 2 }], next: 's' },
      name: { speaker: 'cassian', text: 'Фамилия делает меня тем, от кого ждут. Каждый день. Каждую оценку. Хочешь поменяться? Не советую.', next: 's' },
      dark: { speaker: 'cassian', text: 'Отец пишет каждую неделю. О «великих переменах». О том, что мне пора «выбрать сторону». Я не знаю, о каких сторонах речь. И боюсь узнать.', effects: [{ setFlag: 'cassian_father_hint' }, { rel: 'cassian', delta: 3 }], next: 's' },
    },
  },
  {
    id: 'cassian_shadow_offer', npc: 'cassian', start: 's',
    nodes: {
      s: { speaker: 'cassian', text: '…Ты ведь ходишь по подземельям? Я потерял там одну вещь. Медальон. Ничего ценного. Совершенно. Просто… фамильный.',
        choices: [
          { text: 'Я найду его.', effects: [{ startQuest: 'rq_cassian' }, { rel: 'cassian', delta: 5 }], next: 'ok' },
          { text: 'Ничего ценного — и ты просишь меня?', next: 'tease', effects: [{ rel: 'cassian', delta: -2 }] },
        ] },
      ok: { speaker: 'cassian', text: 'Где-то у старых камер. Я… проверял, правда ли там плачут по ночам. Не смейся.' },
      tease: { speaker: 'cassian', text: 'Ладно! Он ценный. Довольн{g:ен|на}? Найдёшь — буду должен.', effects: [{ startQuest: 'rq_cassian' }] },
    },
  },
  {
    id: 'cassian_locket', npc: 'cassian', start: 's',
    nodes: {
      s: { speaker: 'cassian', text: 'Это… мой медальон. Ты открывал{g:|а} его?',
        choices: [
          { text: 'Да. Кто эта девочка?', next: 'sister' },
          { text: 'Нет. Это твоё.', effects: [{ rel: 'cassian', delta: 5 }], next: 'sister2' },
        ] },
      sister: { speaker: 'cassian', text: 'Лия. Моя сестра. Она больна — давно. Отец говорит, что есть «средство». Что Орден… что некие люди могут вылечить её, если мы… поможем им. Я не знаю, что они хотят. Я боюсь, что знаю.', next: 'end' },
      sister2: { speaker: 'cassian', text: '…Спасибо. Там портрет Лии. Сестры. Она больна. Отец говорит о каком-то «средстве» у каких-то людей. Мне страшно, {name}. Только никому.', next: 'end' },
      end: { speaker: 'cassian', text: 'Я твой должник. Морвели платят долги. Запомни это.',
        effects: [{ take: 'cassian_locket' }, { completeObjective: ['rq_cassian', 'return'] }, { setFlag: 'cassian_opened_up' }, { journal: 'Кассиан рассказал о сестре Лие и об «Ордене», который обещает её вылечить. Он напуган — и, кажется, впервые кому-то доверился.' }] },
    },
  },
  {
    id: 'elodie_main', npc: 'elodie', start: 's',
    nodes: {
      s: { speaker: 'elodie', text: 'Привет, {name}! Хочешь свежую сплетню? Бесплатно. Ну, почти: потом расскажешь мне свою.',
        choices: [
          { text: 'Выкладывай.', next: 'gossip' },
          { text: 'Где растут хорошие травы?', next: 'herbs' },
          bye()] },
      gossip: { speaker: 'elodie', text: 'Говорят, мастер Пеллинор каждый вечер ходит в кладовую с пустыми руками, а выходит — с ещё более пустыми. И бормочет. Странно, да?', effects: [{ setFlag: 'gossip_pellinor' }], next: 's' },
      herbs: { speaker: 'elodie', text: 'Солнечник — во дворе и на полянах. Мята — у ручья в лесу. Лунный лепесток раскрывается только ночью — днём его и не найдёшь. А угольные грибы любят подземелья.', next: 's' },
    },
  },
  {
    id: 'nico_main', npc: 'nico', start: 's',
    nodes: {
      s: { speaker: 'nico', text: 'Пс-с, {name}. Знаешь, что за статуей в вестибюле есть… а, нет, этого я тебе не говорил.',
        choices: [
          { text: 'Расскажи про тайные ходы.', next: 'secrets' },
          { text: 'Как не попасться ночной страже?', next: 'guards' },
          bye()] },
      secrets: { speaker: 'nico', text: 'В классе трансформации одна стена звучит пусто, если постучать. А «Откровение» вообще творит чудеса — попробуй у статуй во дворе. Только тс-с.', effects: [{ setFlag: 'nico_secret_hint' }], next: 's' },
      guards: { speaker: 'nico', text: 'Ульрих ходит по западной галерее с десяти. Гравейн — по восточной до одиннадцати. Если идёшь ночью — держись подальше и не стой у них на виду. Попадёшься — минус очки и лекция.', next: 's' },
    },
  },
  {
    id: 'agatha_main', npc: 'agatha', start: 's',
    nodes: {
      s: { speaker: 'agatha', text: 'Староста Блэквуд. Чем могу помочь? Если вы о нарушении — я слушаю. Если о жалобе — тоже.',
        choices: [
          { text: 'Как идёт Кубок Кругов?', next: 'cup' },
          bye()] },
      cup: { speaker: 'agatha', text: 'Бастион лидирует. Как и положено. Очки дают за уроки, экзамены, помощь, турниры. Отнимают — за ночные прогулки. Учтите.', next: 's' },
    },
  },
  {
    id: 'ev_argument', npc: 'agatha', start: 's',
    nodes: {
      s: { speaker: 'agatha', text: 'Фэй, это уже третий раз! Ты заколдовал мои учебники — они квакают! Я доложу профессору Гравейн!', next: 'nico' },
      nico: { speaker: 'nico', text: 'Это не я! Ну, я. Но они квакали тише, чем ты кричишь! {name}, скажи ей!',
        choices: [
          { text: 'Нико, расколдуй книги. Агата, не надо доносить — это просто шутка.', effects: [{ rel: 'nico', delta: 3 }, { rel: 'agatha', delta: 3 }, { circlePoints: 5 }, { clearFlag: 'event_argument' }], next: 'peace' },
          { text: 'Агата права. Это не смешно.', effects: [{ rel: 'agatha', delta: 6 }, { rel: 'nico', delta: -5 }, { clearFlag: 'event_argument' }] },
          { text: 'А по-моему, квакающие учебники — гениально.', effects: [{ rel: 'nico', delta: 6 }, { rel: 'agatha', delta: -6 }, { clearFlag: 'event_argument' }] },
          { text: '(Шёпот) Давайте все успокоимся.', tag: '[Шёпот]', if: [{ spell: 'whisper' }], effects: [{ rel: 'nico', delta: 4 }, { rel: 'agatha', delta: 4 }, { circlePoints: 8 }, { clearFlag: 'event_argument' }], next: 'peace' },
        ] },
      peace: { speaker: 'agatha', text: '…Ладно. Если перестанут квакать до ужина — забуду. Спасибо, {name}.' },
    },
  },
  {
    id: 'ren_main', npc: 'ren', start: 's',
    nodes: {
      s: { speaker: 'ren', text: '…Звёзды сегодня говорят, что внизу кто-то не спит.',
        choices: [
          { text: 'Внизу — это где?', next: 'down' },
          bye()] },
      down: { speaker: 'ren', text: 'Под нами. Под замком. Созвездие Камня затянуто дымом третью ночь. Так бывает, когда что-то просыпается. Или когда кто-то жжёт костры. Я не знаю, что хуже.', next: 's' },
    },
  },

  // ---------------- Ольховый Брод ----------------
  {
    id: 'tilda_main', npc: 'tilda', start: 's',
    nodes: {
      s: { speaker: 'tilda', text: 'Заходи, замковый! Мята, мак, жемчуг озера — всё, что душа пожелает и кошелёк выдержит.',
        choices: [
          { text: 'Покажи товары.', effects: [{ openShop: 'alchemist' }] },
          { text: 'Пепельный мак у вас бывает?', if: [{ act: 3 }], next: 'poppy' },
          bye()] },
      poppy: { speaker: 'tilda', text: 'Тс-с! Запрещённое не держу. Но… раз в месяц кто-то скупает у сборщиков весь мак в долине. Платит замковым серебром. Говорит, что для пирогов. Хе.', effects: [{ setFlag: 'tilda_poppy_hint' }], next: 's' },
    },
  },
  {
    id: 'goran_main', npc: 'goran', start: 's',
    nodes: {
      s: { speaker: 'goran', text: 'Хм. Чего надо?',
        choices: [
          { text: 'Покажите товары.', effects: [{ openShop: 'artificer' }] },
          { text: 'Можно поработать у вас на верстаке?', effects: [{ openCraft: 'artifice' }] },
          bye()] },
    },
  },
  {
    id: 'goran_smuggler_offer', npc: 'goran', start: 's',
    nodes: {
      s: { speaker: 'goran', text: 'Ты из замка. Тоннели под ним знаешь? Кто-то увёз оттуда мой ящик. Заказ. Клеймо «М.». Найдёшь — заплачу.',
        choices: [
          { text: 'Поищу в тоннелях.', effects: [{ startQuest: 'sq_smuggler' }] },
          bye('Не сейчас.')] },
    },
  },
  {
    id: 'goran_smuggler', npc: 'goran', start: 's',
    nodes: {
      s: { speaker: 'goran', text: 'Нашёл{g:|а}?',
        choices: [
          { text: 'Вот ваш ящик.', if: [{ item: 'smuggled_crate' }], effects: [{ take: 'smuggled_crate' }, { gold: 60 }, { rep: 'village', delta: 15 }, { rel: 'goran', delta: 20 }, { completeObjective: ['sq_smuggler', 'return'] }], next: 'thanks' },
          { text: 'Клеймо «М.»… Морвели? Что там внутри?', if: [{ item: 'smuggled_crate' }], next: 'inside' },
          { text: 'Ещё ищу.' },
        ] },
      inside: { speaker: 'goran', text: '…Детали для механизма. Заказ был от Морвелей. Сказали — для «большого замка под замком». Я не спрашивал. Теперь думаю — зря.', effects: [{ setFlag: 'goran_morvel_hint' }], next: 's' },
      thanks: { speaker: 'goran', text: 'Честно. Уважаю. Теперь у меня для тебя всегда цена получше.', effects: [{ setFlag: 'goran_discount' }] },
    },
  },
  {
    id: 'martha_main', npc: 'martha', start: 's',
    nodes: {
      s: { speaker: 'martha', text: 'Ой, замковые пожаловали! Садись, садись! Суп, пирог, отвар? Для студентов — за полцены, для голодных — бесплатно!',
        choices: [
          { text: 'Можно пирог?', if: [{ gold: 10 }], effects: [{ gold: -10 }, { give: 'martha_pie' }], next: 'pie' },
          { text: 'Какие новости в деревне?', next: 'news' },
          { text: 'Можно у вас переночевать?', next: 'room' },
          bye()] },
      pie: { speaker: 'martha', text: 'Держи, горяченький! С яблоками и корицей — от него и маги летают.', next: 's' },
      news: { speaker: 'martha', text: 'Мастер Пеллинор у нас каждый вечер. Ест за троих, молчит за четверых. Раньше болтал без умолку — а с осени будто подменили. Всё в окно на холм смотрит.', effects: [{ setFlag: 'martha_pellinor_hint' }], next: 's' },
      room: { speaker: 'martha', text: 'Комнаты наверху. Пять крон — и спи до утра.', choices: [
        { text: 'Снять комнату (5 крон) и выспаться.', if: [{ gold: 5 }], effects: [{ gold: -5 }, { sleep: true }] },
        { text: 'Не сейчас.', next: 's' },
      ] },
    },
  },
  {
    id: 'martha_letter', npc: 'martha', start: 's',
    nodes: {
      s: { speaker: 'martha', text: 'Письмо? От Тоби?! Ох, мальчик мой… «Тётушка, всё хорошо, я почти не падаю с лестниц»… Почти! Спасибо тебе, золотце. Держи пирог — и ещё один для Тоби, ладно?',
        effects: [{ take: 'letter_home' }, { give: 'martha_pie', count: 2 }, { completeObjective: ['sq_letter', 'deliver'] }] },
    },
  },
  {
    id: 'ivar_main', npc: 'ivar', start: 's',
    nodes: {
      s: { speaker: 'ivar', text: 'Замковые. Опять ходите, смотрите. Ну, смотрите. Только руками не трогайте.',
        choices: [
          { text: 'Почему вы не любите Академию?', next: 'why' },
          bye()] },
      why: { speaker: 'ivar', text: 'Не люблю? Я её боюсь. Мой дед рассказывал: когда горела Первая Академия, наш брод полыхал тоже. Магия — как река. Красиво, пока не выйдет из берегов.', next: 's' },
    },
  },
  {
    id: 'ivar_lights', npc: 'ivar', start: 's',
    nodes: {
      s: { speaker: 'ivar', text: 'Огни? Видел. Над старыми руинами, за лесом. Зелёные, как болотные гнилушки. И люди в капюшонах ходят тропой мимо брода — к холму. С посохами.',
        choices: [
          { text: 'Сколько их было?', next: 'count' },
          { text: 'Почему вы не сообщили в Академию?', next: 'report' },
        ] },
      count: { speaker: 'ivar', text: 'Шестеро. Седьмой — высокий, без посоха. Шёл впереди. Говорил так, что собаки замолкали.', next: 'end' },
      report: { speaker: 'ivar', text: 'Сообщил. Письмом. Ответ пришёл — «благодарим за бдительность». Почерк красивый, круглый. Будто пекарь писал.', effects: [{ setFlag: 'ivar_letter_hint' }], next: 'end' },
      end: { speaker: 'ivar', text: 'Если пойдёте к руинам — тропа из леса, на восток от хижины лесничего. И… возвращайтесь. Хоть кто-то из вас пусть возвращается.',
        effects: [{ completeObjective: ['mq_village', 'ivar'] }, { setFlag: 'ruins_path_known' }, { rep: 'village', delta: 5 }] },
    },
  },
  {
    id: 'fin_main', npc: 'fin', start: 's',
    nodes: {
      s: { speaker: 'fin', text: 'Ты настоящ{g:ий|ая} маг? Покажи! Ну пожа-а-алуйста!',
        choices: [
          { text: '(Сотворить искру над ладонью.)', effects: [{ rel: 'fin', delta: 5 }, { rep: 'village', delta: 1 }], next: 'wow' },
          bye('Как-нибудь потом.')] },
      wow: { speaker: 'fin', text: 'ВААААУ! Когда вырасту, буду как ты! Нет, лучше! Нет, как ты!' },
    },
  },
  {
    id: 'fin_kitten', npc: 'fin', start: 's',
    nodes: {
      s: { speaker: 'fin', text: '(всхлипывает) Рыжик убежал… в лес… а мама не пускает… а там гончие… а он маленький…',
        choices: [
          { text: 'Я найду Рыжика. Обещаю.', effects: [{ startQuest: 'sq_kitten' }, { rel: 'fin', delta: 10 }] },
          { text: 'Не плачь. Я поищу, когда буду в лесу.', effects: [{ startQuest: 'sq_kitten' }] },
        ] },
    },
  },
  {
    id: 'fin_kitten_return', npc: 'fin', start: 's',
    nodes: {
      s: { speaker: 'fin', text: 'РЫЖИК!!! Ты нашёл{g:|ла} его! Мама! МАМА! Маг вернул Рыжика!',
        effects: [{ take: 'lost_kitten' }, { completeObjective: ['sq_kitten', 'return'] }] },
    },
  },
  {
    id: 'olm_main', npc: 'olm', start: 's',
    nodes: {
      s: { speaker: 'olm', text: '…Клюёт.',
        choices: [
          { text: 'Что вы знаете об озере?', next: 'lake' },
          { text: 'Что за остров посреди озера?', next: 'island' },
          bye('Не буду мешать.')] },
      lake: { speaker: 'olm', text: 'Глубокое. Холодное. Помнит всё. Девчонка там утонула, давно. Ученица. Говорят, сама пошла — что-то охраняла. Теперь охраняет вечно.', effects: [{ lore: 'lake_queen' }], next: 's' },
      island: { speaker: 'olm', text: 'Камень с рунами. Лодки туда не ходят — переворачиваются. Разве что по льду. Летом льда нет. А у вас, магов, может, и есть.', next: 's' },
    },
  },
  {
    id: 'olm_spirits', npc: 'olm', start: 's',
    nodes: {
      s: { speaker: 'olm', text: 'Тихо стало. Совсем тихо. Ты пел{g:|а} им, да? Сорок лет здесь сижу — первый раз слышу, как они… спят.',
        effects: [{ completeObjective: ['sq_lake_spirits', 'olm'] }, { give: 'lake_tear', count: 2 }] },
    },
  },
  {
    id: 'zane_main', npc: 'zane', start: 's',
    nodes: {
      s: { speaker: 'zane', text: 'Друг мой! Редкости со всех концов света: перья, кольца, карты, эликсиры. Почти не краденые. Почти не проклятые.',
        choices: [
          { text: 'Покажи, что есть.', effects: [{ openShop: 'wanderer' }] },
          { text: 'Откуда ты знаешь дорогу в долину?', next: 'road' },
          bye()] },
      road: { speaker: 'zane', text: 'Дороги знают меня, а не я их. А если серьёзно — по тайной тропе через перевал. Ею ходят только торговцы и… люди в капюшонах. Я с ними не разговариваю. Они платят плохо.', next: 's' },
    },
  },
  {
    id: 'zane_smuggler', npc: 'zane', start: 's',
    nodes: {
      s: { speaker: 'zane', text: 'О-о, что это у тебя? Клеймо «М.»? Дам сто пятьдесят. Наличными. И никаких вопросов.',
        choices: [
          { text: 'Продать ящик Зейну (150 крон).', effects: [{ take: 'smuggled_crate' }, { gold: 150 }, { rep: 'village', delta: -10 }, { rep: 'ash', delta: 5 }, { completeObjective: ['sq_smuggler', 'return'] }] },
          { text: 'Нет, он не мой.' },
        ] },
    },
  },
  {
    id: 'ulrich_smuggler', npc: 'ulrich', start: 's',
    nodes: {
      s: { speaker: 'ulrich', text: 'Что за ящик? Клеймо «М.»… Хм. Это стоит показать Архимагистру.',
        choices: [
          { text: 'Передать ящик страже.', if: [{ item: 'smuggled_crate' }], effects: [{ take: 'smuggled_crate' }, { rep: 'academy', delta: 15 }, { gold: 30 }, { setFlag: 'crate_to_guard' }, { completeObjective: ['sq_smuggler', 'return'] }] },
          { text: 'Я подумаю.' },
        ] },
    },
  },
  {
    id: 'yalla_main', npc: 'yalla', start: 's',
    nodes: {
      s: { speaker: 'yalla', text: 'Опять ты по лесу бродишь…', choices: [
        { text: 'Мама Ялла!', if: [{ origin: 'foundling' }], next: 'home', once: 'yalla_gift' },
        { text: 'Мама Ялла, я снова здесь.', if: [{ origin: 'foundling' }, { flag: 'yalla_gift' }], next: 'secret' },
        { text: 'Кто вы?', if: [{ not: { origin: 'foundling' } }], next: 'who' },
        bye()] },
      home: { speaker: 'yalla', text: 'Дитя моё. Вырос{g:|ла}. Совсем взросл{g:ый|ая} маг. Лес говорит, что ты ему помогаешь. Держи — сушёный лунный лепесток. Помнишь, как ты его в детстве ел вместо конфет?', effects: [{ give: 'moonpetal', count: 2 }, { rep: 'forest', delta: 5 }], next: 'secret' },
      secret: { speaker: 'yalla', text: 'И ещё. Корни под лесом стонут. Будто кто-то тянет их вниз, к камню. Береги себя.' },
      who: { speaker: 'yalla', text: 'Травница. Старая. Лишняя. Лес меня терпит, а я — лес. Если найдёшь мяту у ручья — бери, не жалей. Лес не жадный.' },
    },
  },
  {
    id: 'elias_main', npc: 'elias', start: 's',
    nodes: {
      s: { speaker: 'elias', text: 'Живой. Опять живой. Вы так быстро сменяетесь…',
        choices: [
          { text: 'Расскажите о Первой Академии.', next: 'first' },
          { text: 'Что такое Сердце Эфира?', if: [{ flag: 'archivist_truth' }], next: 'heart' },
          bye()] },
      first: { speaker: 'elias', text: 'Здесь учились первые маги. Здесь пятый Основатель — Малахар — впервые прикоснулся к Сердцу. И здесь всё сгорело, когда он попытался его выпить.', effects: [{ lore: 'first_academy' }], next: 's' },
      heart: { speaker: 'elias', text: 'Сердце — не источник, а узел. Его можно запечатать, можно забрать… а можно разбить. Тогда магия разольётся по миру, как вода из треснувшего кувшина. Долина потеряет чудо. Мир — обретёт.', next: 's' },
    },
  },
];
