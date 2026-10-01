// Задания: сюжетная кампания (5 актов), побочные, тайные, ежедневные, задания отношений.
import type { QuestDef } from './types';

const list: QuestDef[] = [
  // ======================= АКТ I — ПРИБЫТИЕ =======================
  {
    id: 'mq_arrival', title: 'Новое начало', type: 'main', act: 1, zone: 'gates',
    summary: 'Карета высадила вас у ворот Академии Этермур. Покажите письмо, найдите дорогу в Большой зал и узнайте, какой Круг выберет вас — или вы его.',
    objectives: [
      { id: 'letter', kind: 'talk', target: 'ulrich', text: 'Покажите письмо привратнику Ульриху у ворот', where: { zone: 'gates', npc: 'ulrich' }, hint: 'Идите по дороге на север (W или ↑).' },
      { id: 'mira', kind: 'manual', text: 'Поговорите с девушкой с книгой у дороги', where: { zone: 'gates', npc: 'mira' } },
      { id: 'hall', kind: 'reach', target: 'hall_center', text: 'Войдите в Большой зал на церемонию Кругов', where: { zone: 'hall', marker: 'hall_center' } },
      { id: 'ceremony', kind: 'manual', text: 'Подойдите к Архимагистру Вейсту за высоким столом', where: { zone: 'hall', npc: 'veist' } },
      { id: 'bed', kind: 'flag', target: 'slept_first_night', text: 'Найдите спальню своего Круга в Башнях и ложитесь спать', where: { zone: 'towers', marker: 'dorm_entrance' }, hint: 'Лестница в башни — в восточном конце галереи главного этажа.' },
    ],
    rewards: { xp: 120, gold: 10 },
    next: 'mq_first_lessons',
  },
  {
    id: 'mq_first_lessons', title: 'Первый учебный день', type: 'main', act: 1, parallel: true,
    summary: 'Расписание первокурсника: практическая магия на поле, зельеварение в подземельях и магическая теория на главном этаже. Уроки идут с 9:00 до 18:00.',
    objectives: [
      { id: 'practical', kind: 'lesson', target: 'practical', count: 1, text: 'Урок практической магии (капитан Хальвард, тренировочное поле)', where: { zone: 'gates', npc: 'dorn' } },
      { id: 'potions', kind: 'lesson', target: 'potions', count: 1, text: 'Урок зельеварения (мастер Пеллинор, подземелья)', where: { zone: 'dungeons', npc: 'pellinor' } },
      { id: 'theory', kind: 'lesson', target: 'theory', count: 1, text: 'Урок магической теории (магистр Лоу, главный этаж)', where: { zone: 'hall', npc: 'lowe' } },
    ],
    rewards: { xp: 200, circlePoints: 10 },
    onComplete: [{ journal: 'Первый день позади. Я умею творить Искру, держать щит и зажигать Светоч. Мира звала меня вечером в библиотеку — говорит, нашла что-то странное.' }],
    next: 'mq_whispers',
  },
  {
    id: 'mq_whispers', title: 'Шёпот в темноте', type: 'main', act: 1,
    summary: 'Мира нашла в «Хронике Основателей» вырванные страницы. А ночью в галерее замка что-то шевелится в тенях.',
    objectives: [
      { id: 'library', kind: 'manual', text: 'Встретьтесь с Мирой в библиотеке (вечером, после 18:00)', where: { zone: 'library', npc: 'mira' } },
      { id: 'shade', kind: 'kill', target: 'shade_blob', text: 'Ночью возвращайтесь в спальню через галерею главного этажа', where: { zone: 'hall', marker: 'corridor_e' }, hint: 'После 21:00. Тени боятся света — используйте «Светоч».' },
      { id: 'corvin', kind: 'manual', text: 'Объяснитесь с магистром Корвином', where: { zone: 'hall', npc: 'corvin' } },
      { id: 'morning', kind: 'manual', text: 'Утром Архимагистр созывает всех в Большой зал (после 7:00)', where: { zone: 'hall', npc: 'veist' } },
    ],
    rewards: { xp: 300, gold: 30 },
    onComplete: [{ setAct: 2 }],
    next: 'mq_glitches',
  },

  // ======================= АКТ II — ТЕНИ В КОРИДОРАХ =======================
  {
    id: 'mq_glitches', title: 'Сбои', type: 'main', act: 2, parallel: true,
    summary: 'По замку прокатились «сбои» магии. В трёх местах остались обрывки древних надписей. Мира уверена: это части одной печати.',
    objectives: [
      { id: 'transfig', kind: 'interact', target: 'glitch_transfig', text: 'Исследуйте сбой в классе трансформации (главный этаж)', where: { zone: 'hall', marker: 'glitch_transfig' } },
      { id: 'dungeon', kind: 'interact', target: 'glitch_dungeon', text: 'Исследуйте сбой в подземельях', where: { zone: 'dungeons', marker: 'glitch_dungeon' }, hint: 'Проход затянут паутиной — понадобится «Пламя».' },
      { id: 'tower', kind: 'cast', target: 'reveal@glitch_tower', text: 'Найдите невидимую руну на лестнице Башен («Откровение»)', where: { zone: 'towers', marker: 'glitch_tower' }, hint: '«Откровение» преподают на уроке древних рун. Круг Звезды знает его с первого дня.' },
      { id: 'mira', kind: 'manual', text: 'Покажите фрагменты Мире', where: { zone: 'library', npc: 'mira' }, if: [{ item: 'rune_fragment', count: 3 }] },
    ],
    rewards: { xp: 400, gold: 40, circlePoints: 15 },
    next: 'mq_restricted',
  },
  {
    id: 'mq_sleepwalker', title: 'Лунатик', type: 'main', act: 2,
    summary: 'Тоби бродит ночами по замку с закрытыми глазами. Что-то зовёт его вниз — под камень.',
    objectives: [
      { id: 'find', kind: 'manual', text: 'Ночью (после 21:00) найдите Тоби в галерее главного этажа', where: { zone: 'hall', npc: 'toby' } },
      { id: 'mabel', kind: 'manual', text: 'Поговорите с сестрой Мэйбел в лазарете', where: { zone: 'hall', npc: 'mabel' } },
      { id: 'bran', kind: 'manual', text: 'Попросите лесничего Брана провести вас в лес', where: { zone: 'gates', npc: 'bran' } },
      { id: 'petals', kind: 'collect', target: 'moonpetal', count: 2, text: 'Соберите лунные лепестки в Шепчущем лесу (цветут ночью)', where: { zone: 'forest', marker: 'moonpetal' } },
      { id: 'brew', kind: 'collect', target: 'potion_awaken', count: 1, text: 'Сварите пробуждающее зелье (котёл в лаборатории или лазарете)', where: { zone: 'dungeons', marker: 'cauldron' } },
      { id: 'cure', kind: 'manual', text: 'Дайте зелье Тоби', where: { zone: 'hall', npc: 'toby' } },
    ],
    rewards: { xp: 450, gold: 50, rel: { toby: 25, mabel: 10 } },
  },
  {
    id: 'mq_restricted', title: 'Запретная секция', type: 'main', act: 2,
    summary: 'Чтобы понять фрагменты, нужен «Кодекс Печатей». Он хранится там, куда ученикам вход заказан.',
    objectives: [
      { id: 'mira', kind: 'manual', text: 'Обсудите с Мирой, как попасть в запретную секцию', where: { zone: 'library', npc: 'mira' } },
      { id: 'access', kind: 'flag', target: 'restricted_open', text: 'Попадите в запретную секцию: пропуск Квилл, помощь Корвина — или ночная вылазка с «Отворением»', where: { zone: 'library', marker: 'restricted_door' } },
      { id: 'codex', kind: 'collect', target: 'codex_seals', count: 1, text: 'Найдите «Кодекс Печатей»', where: { zone: 'library', marker: 'codex' } },
      { id: 'decode', kind: 'manual', text: 'Расшифруйте фрагменты вместе с Мирой', where: { zone: 'library', npc: 'mira' } },
      { id: 'reveal', kind: 'manual', text: 'Узнайте, что скрывают печати', where: { zone: 'library', npc: 'mira' } },
    ],
    rewards: { xp: 500, gold: 60 },
    onComplete: [{ setAct: 3 }, { startQuest: 'mq_seals' }, { startQuest: 'mq_village' }],
  },

  // ======================= АКТ III — ДРЕВНЯЯ ТАЙНА =======================
  {
    id: 'mq_village', title: 'Огни над холмом', type: 'main', act: 3,
    summary: 'Жители Ольхового Брода видят по ночам огни у старых руин. Староста Ивар знает больше, чем говорит.',
    objectives: [
      { id: 'ivar', kind: 'manual', text: 'Расспросите старосту Ивара в Ольховом Броде', where: { zone: 'village', npc: 'ivar' } },
    ],
    rewards: { xp: 200, rep: { village: 10 } },
  },
  {
    id: 'mq_seals', title: 'Три печати', type: 'main', act: 3, parallel: true,
    summary: 'Основатели оставили три печати: Корня — в лесу, Вод — на озере, Камня — в руинах Первой Академии. Кто-то ломает их одну за другой. Восстановите все три — в любом порядке.',
    objectives: [
      { id: 'root', kind: 'flag', target: 'seal_root', text: 'Восстановите печать Корня в глубине Шепчущего леса', where: { zone: 'forest', marker: 'seal_root' } },
      { id: 'water', kind: 'flag', target: 'seal_water', text: 'Восстановите печать Вод на острове Зеркального озера', where: { zone: 'lake', marker: 'seal_water' }, hint: '«Иней» превращает воду в лёд. Второй урок трансформации.' },
      { id: 'stone', kind: 'flag', target: 'seal_stone', text: 'Восстановите печать Камня в Старых руинах', where: { zone: 'ruins', marker: 'seal_stone' } },
    ],
    rewards: { xp: 900, gold: 150, circlePoints: 40 },
    onComplete: [{ achievement: 'seals' }, { setAct: 4 }, { startQuest: 'mq_suspicion' }, { journal: 'Все три печати восстановлены. Но письмо с подписью «П.» не даёт мне покоя. Кто-то в Академии помогает Ордену.' }],
  },

  // ======================= АКТ IV — РАСКОЛ =======================
  {
    id: 'mq_suspicion', title: 'Подозрения', type: 'main', act: 4,
    summary: '«Порошок готов. Ученики спят крепко. — П.» Кто-то внутри Академии работает на Орден Пепла. Найдите доказательства — и решите, кому верить.',
    objectives: [
      { id: 'mira', kind: 'manual', text: 'Обсудите письмо с Мирой', where: { zone: 'library', npc: 'mira' } },
      { id: 'office', kind: 'interact', target: 'corvin_desk', optional: true, text: '(Необязательно) Обыщите кабинет Корвина в Башнях', where: { zone: 'towers', marker: 'corvin_desk' } },
      { id: 'storeroom', kind: 'collect', target: 'ash_sigil', count: 1, text: 'Проберитесь в кладовую Пеллинора в подземельях', where: { zone: 'dungeons', marker: 'storeroom_door' }, hint: 'Нужен ключ из комнаты Пеллинора — или помощь Нико.' },
      { id: 'accuse', kind: 'manual', text: 'Решите, что делать: идти к Архимагистру — или говорить с Пеллинором самому', where: { zone: 'towers', npc: 'veist' } },
      { id: 'confront', kind: 'manual', text: 'Поговорите с Пеллинором наедине', where: { zone: 'dungeons', npc: 'pellinor' }, if: [{ flag: 'chose_confront' }] },
      { id: 'hunt', kind: 'kill', target: 'pellinor_boss', text: 'Пеллинор бежал в тоннели. Остановите его', where: { zone: 'tunnels', marker: 'pellinor_lair' }, if: [{ flag: 'pellinor_fled' }] },
    ],
    rewards: { xp: 700, gold: 120 },
    next: 'mq_night_of_ash',
  },
  {
    id: 'mq_night_of_ash', title: 'Ночь Пепла', type: 'main', act: 4,
    summary: 'Орден Пепла больше не прячется. Этой ночью они пришли к воротам Академии.',
    objectives: [
      { id: 'defend', kind: 'kill', target: 'cultist', count: 6, text: 'Ночью отразите нападение Ордена во внешнем дворе', where: { zone: 'gates', marker: 'fountain_side' }, hint: 'Нападение начнётся после 21:00.' },
      { id: 'cassian', kind: 'manual', text: 'Найдите Кассиана у фонтана', where: { zone: 'gates', npc: 'cassian' }, if: [{ notFlag: 'cassian_left' }] },
      { id: 'voice', kind: 'flag', target: 'voice_answered', text: 'Ложитесь спать. Голос из-под камня ждёт ответа', where: { zone: 'towers', marker: 'dorm_entrance' } },
      { id: 'veist', kind: 'manual', text: 'Срочно к Архимагистру — в лазарет', where: { zone: 'hall', npc: 'veist' } },
    ],
    rewards: { xp: 800, gold: 100 },
    onComplete: [{ setAct: 5 }],
    next: 'mq_sanctum',
  },

  // ======================= АКТ V — СЕРДЦЕ ЭФИРА =======================
  {
    id: 'mq_sanctum', title: 'Сердце Эфира', type: 'main', act: 5,
    summary: 'Сорен Мальграв похитил Миру и спустился к Сердцу Эфира. Ключ Основателей откроет Печатную дверь в тоннелях. Дальше — только вы.',
    objectives: [
      { id: 'door', kind: 'flag', target: 'sealed_door_open', text: 'Откройте Печатную дверь в подземных тоннелях', where: { zone: 'tunnels', marker: 'sealed_door' } },
      { id: 'descend', kind: 'reach', target: 'heart_chamber', text: 'Спуститесь в Затонувшее Святилище', where: { zone: 'sanctum', marker: 'heart_chamber' } },
      { id: 'soren', kind: 'kill', target: 'soren', text: 'Победите Сорена Мальграва', where: { zone: 'sanctum', marker: 'heart_chamber' } },
      { id: 'hollow', kind: 'kill', target: 'hollow_king', text: 'Одолейте Полого Короля', where: { zone: 'sanctum', marker: 'heart_chamber' } },
      { id: 'heart', kind: 'manual', text: 'Решите судьбу Сердца Эфира', where: { zone: 'sanctum', marker: 'heart' } },
    ],
    rewards: { xp: 1500 },
  },

  // ======================= ПОБОЧНЫЕ =======================
  {
    id: 'sq_lost_tomes', title: 'Потерянные тома', type: 'side', giver: 'quill', zone: 'hall',
    summary: 'Хранительница Квилл недосчиталась трёх книг. Ученики разбросали их по всему замку.',
    objectives: [
      { id: 'find', kind: 'collect', target: 'lost_tome', count: 3, text: 'Найдите три потерянных тома (главный этаж, Башни, внешний двор)' },
      { id: 'return', kind: 'manual', text: 'Верните книги хранительнице Квилл', where: { zone: 'library', npc: 'quill' } },
    ],
    rewards: { xp: 180, gold: 40, rel: { quill: 25 }, rep: { academy: 5 } },
    consequences: 'Доверие Квилл открывает путь в запретную секцию без нарушения правил.',
  },
  {
    id: 'sq_toby_charm', title: 'Деревянная сова', type: 'side', giver: 'toby', zone: 'gates',
    summary: 'Тоби потерял талисман — деревянную сову, подарок отца. Говорит, обронил где-то у фонтана, но там пусто.',
    objectives: [
      { id: 'find', kind: 'collect', target: 'toby_charm', count: 1, text: 'Найдите талисман Тоби (возможно, его не видно глазом — «Откровение»?)', where: { zone: 'gates', marker: 'toby_charm' } },
      { id: 'return', kind: 'manual', text: 'Верните талисман Тоби', where: { zone: 'gates', npc: 'toby' } },
    ],
    rewards: { xp: 120, rel: { toby: 15 } },
  },
  {
    id: 'sq_letter', title: 'Письмо тётушке', type: 'side', giver: 'toby',
    summary: 'Тоби написал тётушке Марте в Ольховый Брод, но сам выбраться не может.',
    objectives: [
      { id: 'deliver', kind: 'manual', text: 'Отнесите письмо Марте в таверну «Дремлющий филин»', where: { zone: 'village', npc: 'martha' } },
    ],
    rewards: { xp: 120, gold: 15, rel: { toby: 10, martha: 15 }, rep: { village: 5 } },
  },
  {
    id: 'sq_bran_garden', title: 'Огоньки в тыквах', type: 'side', giver: 'bran', zone: 'forest',
    summary: 'Блуждающие огоньки повадились на опушку у хижины Брана. Тыквы светятся, Бран не спит.',
    objectives: [
      { id: 'wisps', kind: 'kill', target: 'wisp', count: 5, text: 'Разгоните блуждающих огоньков в Шепчущем лесу', where: { zone: 'forest', marker: 'bran_hut' } },
      { id: 'return', kind: 'manual', text: 'Вернитесь к Брану', where: { zone: 'forest', npc: 'bran' } },
    ],
    rewards: { xp: 220, gold: 30, items: [{ id: 'oak_branch', count: 2 }], rep: { forest: 15 }, rel: { bran: 15 } },
  },
  {
    id: 'sq_dueling', title: 'Дуэльный турнир', type: 'combat', giver: 'dorn', zone: 'hall',
    summary: 'Капитан Хальвард проводит турнир первокурсников. Три дуэли — три соперника. Победитель получит приз и славу Кругу.',
    objectives: [
      { id: 'agatha', kind: 'minigame', target: 'duel_agatha', text: 'Дуэль №1: Агата Блэквуд', where: { zone: 'hall', npc: 'dorn' } },
      { id: 'nico', kind: 'minigame', target: 'duel_nico', text: 'Дуэль №2: Нико Фэй', where: { zone: 'hall', npc: 'dorn' } },
      { id: 'cassian', kind: 'minigame', target: 'duel_cassian', text: 'Финал: Кассиан Морвель', where: { zone: 'hall', npc: 'dorn' } },
    ],
    rewards: { xp: 400, gold: 100, circlePoints: 30 },
    onComplete: [{ achievement: 'duelist' }, { rel: 'cassian', delta: 5 }],
  },
  {
    id: 'sq_flight', title: 'Гонка над озером', type: 'side', giver: 'dorn',
    summary: 'Ежегодная гонка на парящих дисках над Зеркальным озером. Пройдите все кольца быстрее соперников.',
    objectives: [
      { id: 'race', kind: 'minigame', target: 'flight_race', text: 'Пройдите гонку на старте у пристани Зеркального озера', where: { zone: 'lake', marker: 'flight_start' } },
    ],
    rewards: { xp: 300, gold: 80, circlePoints: 20 },
    onComplete: [{ achievement: 'flyer' }],
  },
  {
    id: 'sq_marks', title: 'Знаки Основателей', type: 'exploration',
    summary: 'Основатели оставили по всей долине восемь скрытых знаков. «Откровение» проявит их. Говорят, тот, кто найдёт все, получит наследие Орина.',
    objectives: [
      { id: 'find', kind: 'flag', target: 'all_marks', text: 'Найдите 8 знаков Основателей («Откровение» звенит рядом с тайной)' },
    ],
    rewards: { xp: 600, items: [{ id: 'founders_robe' }] },
    onComplete: [{ learnSpell: 'starfall' }, { journal: 'Все восемь знаков найдены. Мантия Основателей легла мне на плечи, а в голове зазвучало заклинание звёздного дождя.' }],
  },
  {
    id: 'sq_kitten', title: 'Рыжий беглец', type: 'side', giver: 'fin', zone: 'village',
    summary: 'Котёнок Фина убежал в Шепчущий лес. Фин плачет и собирается идти за ним сам.',
    objectives: [
      { id: 'find', kind: 'collect', target: 'lost_kitten', count: 1, text: 'Найдите котёнка в Шепчущем лесу', where: { zone: 'forest', marker: 'kitten' } },
      { id: 'return', kind: 'manual', text: 'Верните котёнка Фину', where: { zone: 'village', npc: 'fin' } },
    ],
    rewards: { xp: 200, gold: 20, rep: { village: 15 }, rel: { fin: 25 } },
  },
  {
    id: 'sq_smuggler', title: 'Клеймо «М.»', type: 'hidden', giver: 'goran',
    summary: 'Горан говорит, что из его кузницы украли ящик заказанных деталей. Следы ведут в подземные тоннели.',
    objectives: [
      { id: 'find', kind: 'collect', target: 'smuggled_crate', count: 1, text: 'Найдите ящик в подземных тоннелях', where: { zone: 'tunnels', marker: 'crate' } },
      { id: 'return', kind: 'manual', text: 'Решите, кому отдать ящик: Горану, страже — или продать Зейну', where: { zone: 'village', npc: 'goran' } },
    ],
    rewards: { xp: 250 },
    consequences: 'Кому достанется ящик — решать вам. У каждого выбора своя цена.',
  },
  {
    id: 'sq_lake_spirits', title: 'Тоска утопленников', type: 'side', giver: 'foxglove',
    summary: 'Духи Зеркального озера неспокойны. Фоксглов верит, что их можно успокоить песней, а не огнём.',
    objectives: [
      { id: 'calm', kind: 'flag', target: 'lake_spirits_calmed', text: 'Успокойте трёх озёрных духов «Шёпотом» (или одолейте их)', where: { zone: 'lake', marker: 'olm_pier' } },
      { id: 'olm', kind: 'manual', text: 'Расскажите старому Ольму', where: { zone: 'lake', npc: 'olm' } },
    ],
    rewards: { xp: 300, rep: { forest: 20 }, rel: { foxglove: 15 } },
  },
  {
    id: 'sq_spider_den', title: 'Логово ткачей', type: 'combat', zone: 'tunnels',
    summary: 'Пауки-ткачи заполонили подземные тоннели. Стража платит за каждое гнездо.',
    objectives: [
      { id: 'kill', kind: 'kill', target: 'spider', count: 6, text: 'Уничтожьте пауков-ткачей в тоннелях', where: { zone: 'tunnels', marker: 'spider_den' } },
    ],
    rewards: { xp: 300, gold: 70, rep: { academy: 5 } },
  },
  {
    id: 'sq_clock', title: 'Загадка рунической башни', type: 'puzzle', zone: 'towers',
    summary: 'В рунической башне есть дверь, которую никто не открывал сто лет. Три кристалла вокруг неё тусклы.',
    objectives: [
      { id: 'solve', kind: 'flag', target: 'puzzle_towers_c1', text: 'Зарядите три кристалла у старой двери', where: { zone: 'towers', marker: 'clock_door' } },
    ],
    rewards: { xp: 250 },
  },
  {
    id: 'sq_elias', title: 'Память архивариуса', type: 'side', giver: 'elias', zone: 'ruins',
    summary: 'Призрак архивариуса Элиаса просит найти три страницы его дневника, разбросанные по руинам.',
    objectives: [
      { id: 'pages', kind: 'collect', target: 'elias_page', count: 3, text: 'Найдите 3 страницы дневника Элиаса в руинах' },
      { id: 'return', kind: 'manual', text: 'Вернитесь к Элиасу', where: { zone: 'ruins', npc: 'elias' } },
    ],
    rewards: { xp: 350 },
    onComplete: [{ setFlag: 'archivist_truth' }, { lore: 'heart' }, { lore: 'hollow' }],
    consequences: 'Правда о Сердце откроет новый вариант финала.',
  },

  // ======================= ОТНОШЕНИЯ =======================
  {
    id: 'rq_mira', title: 'Звёзды над башней', type: 'relationship', giver: 'mira',
    summary: 'Мира позвала вас вечером на балкон Башни Звезды. «Просто посмотреть на звёзды», — сказала она слишком быстро.',
    objectives: [
      { id: 'stars', kind: 'manual', text: 'Вечером (после 20:00) поднимитесь на звёздный балкон Башен', where: { zone: 'towers', npc: 'mira' } },
    ],
    rewards: { xp: 150, rel: { mira: 15 } },
  },
  {
    id: 'rq_cassian', title: 'Тень рода', type: 'relationship', giver: 'cassian',
    summary: 'Кассиан потерял фамильный медальон где-то в подземельях. Он делает вид, что ему всё равно.',
    objectives: [
      { id: 'find', kind: 'collect', target: 'cassian_locket', count: 1, text: 'Найдите медальон Морвелей в подземельях', where: { zone: 'dungeons', marker: 'locket' } },
      { id: 'return', kind: 'manual', text: 'Верните медальон Кассиану', where: { zone: 'hall', npc: 'cassian' } },
    ],
    rewards: { xp: 200, rel: { cassian: 25 } },
    consequences: 'Кассиан запомнит, кто был рядом, когда ему было плохо.',
  },
  {
    id: 'rq_corvin', title: 'Старый долг', type: 'relationship', giver: 'corvin',
    summary: 'Корвин просит передать запечатанное письмо архивариусу Элиасу. Лично. И не читать.',
    objectives: [
      { id: 'deliver', kind: 'manual', text: 'Передайте письмо Элиасу в Старых руинах', where: { zone: 'ruins', npc: 'elias' } },
      { id: 'answer', kind: 'manual', text: 'Вернитесь к Корвину с ответом', where: { zone: 'hall', npc: 'corvin' } },
    ],
    rewards: { xp: 250, rel: { corvin: 20 } },
  },
  {
    id: 'hq_black_rune', title: 'Чёрная руна', type: 'hidden',
    summary: 'Осколок, который вы оставили себе, шепчет по ночам. Он хочет, чтобы его отнесли туда, где тень сильнее всего.',
    objectives: [
      { id: 'echo', kind: 'flag', target: 'rune_echo_heard', text: 'Ночью прислушайтесь к осколку у Печатной двери в тоннелях', where: { zone: 'tunnels', marker: 'sealed_door' } },
      { id: 'choice', kind: 'flag', target: 'rune_decided', text: 'Решите судьбу осколка: уничтожить у Брана — или оставить себе', where: { zone: 'forest', npc: 'bran' } },
    ],
    rewards: { xp: 300 },
  },

  // ======================= ЕЖЕДНЕВНЫЕ (доска поручений) =======================
  { id: 'dq_sunleaf', title: 'Поручение: солнечник для теплиц', type: 'daily', summary: 'Теплицам нужен свежий солнечник.',
    objectives: [{ id: 'c', kind: 'collect', target: 'sunleaf', count: 4, text: 'Соберите 4 солнечника и сдайте на доске' }], rewards: { xp: 70, gold: 25 } },
  { id: 'dq_spring', title: 'Поручение: родниковая вода', type: 'daily', summary: 'Лазарет просит родниковой воды.',
    objectives: [{ id: 'c', kind: 'collect', target: 'spring_water', count: 3, text: 'Наберите 3 фляги у родника и сдайте на доске' }], rewards: { xp: 60, gold: 20 } },
  { id: 'dq_wisps', title: 'Поручение: огоньки на опушке', type: 'daily', summary: 'Огоньки снова пугают первокурсников.', conditions: [{ flag: 'forest_open' }],
    objectives: [{ id: 'k', kind: 'kill', target: 'wisp', count: 4, text: 'Разгоните 4 блуждающих огонька' }], rewards: { xp: 90, gold: 30 } },
  { id: 'dq_shades', title: 'Поручение: тени в подземельях', type: 'daily', summary: 'Ночная стража просит помочь с тенями.', conditions: [{ act: 2 }],
    objectives: [{ id: 'k', kind: 'kill', target: 'shade', count: 3, text: 'Рассейте 3 теневые твари' }], rewards: { xp: 110, gold: 35 } },
  { id: 'dq_iron', title: 'Поручение: железняк для кузни', type: 'daily', summary: 'Горану из Ольхового Брода нужна руда.', conditions: [{ act: 2 }],
    objectives: [{ id: 'c', kind: 'collect', target: 'ironstone', count: 3, text: 'Добудьте 3 железняка и сдайте на доске' }], rewards: { xp: 80, gold: 35 } },
  { id: 'dq_mint', title: 'Поручение: болотная мята', type: 'daily', summary: 'Пеллинору не хватает мяты.', conditions: [{ flag: 'forest_open' }],
    objectives: [{ id: 'c', kind: 'collect', target: 'marsh_mint', count: 3, text: 'Соберите 3 болотной мяты и сдайте на доске' }], rewards: { xp: 70, gold: 25 } },
  { id: 'dq_spiders', title: 'Поручение: паучья напасть', type: 'daily', summary: 'Пауки снова плетут сети в тоннелях.', conditions: [{ act: 2 }, { flag: 'tunnels_open' }],
    objectives: [{ id: 'k', kind: 'kill', target: 'spider', count: 4, text: 'Уничтожьте 4 паука-ткача' }], rewards: { xp: 110, gold: 40 } },
  { id: 'dq_silk', title: 'Поручение: шёлк для мантий', type: 'daily', summary: 'Швейной мастерской нужен паучий шёлк.', conditions: [{ flag: 'tunnels_open' }],
    objectives: [{ id: 'c', kind: 'collect', target: 'spider_silk', count: 3, text: 'Добудьте 3 паучьих шёлка и сдайте на доске' }], rewards: { xp: 80, gold: 35 } },
];

export const QUESTS: Record<string, QuestDef> = Object.fromEntries(list.map((q) => [q.id, q]));

export const QUEST_TYPE_NAMES: Record<string, string> = {
  main: 'Сюжет', side: 'Побочное', hidden: 'Тайное', daily: 'Ежедневное', exploration: 'Исследование',
  puzzle: 'Головоломка', combat: 'Бой', relationship: 'Отношения',
};
