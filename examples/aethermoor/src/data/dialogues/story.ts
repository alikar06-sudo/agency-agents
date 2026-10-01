// Акты II–V: сбои, лунатик, запретная секция, печати, предательство, Ночь Пепла, Сердце Эфира.
import type { DialogueDef } from '../types';

export const story: DialogueDef[] = [
  // ======================= АКТ II =======================
  {
    id: 'mira_fragments', npc: 'mira', start: 's',
    nodes: {
      s: { speaker: 'mira', text: 'Ты наш{g:ёл|ла} все три? Покажи! …Смотри: края совпадают. Это не три надписи — это одна, разбитая на части.',
        effects: [{ take: 'rune_fragment', count: 3 }],
        choices: [
          { text: 'Что там написано?', next: 'what' },
          { text: 'Сбои начались после церемонии. Совпадение?', next: 'when', effects: [{ rel: 'mira', delta: 3 }] },
        ] },
      when: { speaker: 'mira', text: 'В тот же вечер треснуло Зеркало Кругов. Нет, не совпадение. Что-то в замке… расшатывается.', next: 'what' },
      what: { speaker: 'mira', text: 'Это руны печатного письма. Их не учат на первом курсе — их вообще не учат. Ключ к ним есть только в «Кодексе Печатей». А «Кодекс» лежит в запретной секции.',
        effects: [{ completeObjective: ['mq_glitches', 'mira'] }, { journal: 'Три фрагмента — части одной печатной надписи. Прочесть её поможет только «Кодекс Печатей» из запретной секции библиотеки.' }],
        choices: [
          { text: 'Как нам туда попасть?', effects: [{ startDialogue: 'mira_restricted', npc: 'mira' }] },
          { text: 'Подумаю об этом позже.' },
        ] },
    },
  },
  {
    id: 'mira_restricted', npc: 'mira', start: 's',
    nodes: {
      s: { speaker: 'mira', text: 'Итак, запретная секция. Я думала об этом всю ночь. Вариантов три — и все мне не нравятся.', next: 'opts' },
      opts: { speaker: 'mira', text: 'Первый: пропуск хранительницы Квилл. Она даёт его только тем, кто доказал, что бережёт книги. Второй: подпись преподавателя. Корвин ведёт древние руны — если он тебе хоть немного доверяет… Третий: ночью, когда Квилл спит, и «Отворение» на замок. Но если поймают…',
        choices: [
          { text: 'Я помогу Квилл — и попрошу пропуск честно.', next: 'quill', effects: [{ setFlag: 'plan_quill' }] },
          { text: 'Поговорю с Корвином.', next: 'corvin', effects: [{ setFlag: 'plan_corvin' }] },
          { text: 'Ночь и «Отворение». Быстро и тихо.', next: 'night', effects: [{ setFlag: 'plan_night' }, { rel: 'mira', delta: -2 }] },
        ] },
      quill: { speaker: 'mira', text: 'Квилл недосчиталась каких-то книг — весь второй курс об этом гудит. Найди их, и она станет мягче. Ну, насколько вообще может.',
        effects: [{ startQuest: 'sq_lost_tomes' }], next: 'end' },
      corvin: { speaker: 'mira', text: 'Корвин?! Он же… Ладно. Он странный, но не глупый. Только не говори ему про фрагменты. Пока.', next: 'end' },
      night: { speaker: 'mira', text: 'Тогда учти: Ульрих и Гравейн обходят замок по ночам. И если Квилл узнает — нам обоим конец. «Отворение» преподают на уроке рун.', next: 'end' },
      end: { speaker: 'mira', text: 'Как достанешь «Кодекс» — неси прямо сюда. Я подготовлю таблицы рун.',
        effects: [{ completeObjective: ['mq_restricted', 'mira'] }] },
    },
  },
  {
    id: 'mira_decode', npc: 'mira', start: 's',
    nodes: {
      s: { speaker: 'mira', text: '«Кодекс»! Настоящий! Тише, тише… Так. Фрагменты — это обрывки печатной формулы. Руны надо соединить в правильный узор, иначе смысл рассыпается.',
        choices: [
          { text: 'Давай расшифруем. (Головоломка рун)', effects: [{ minigame: { type: 'runes', id: 'codex_decode', difficulty: 2, title: 'Расшифровка «Кодекса Печатей»',
            onWin: [{ completeObjective: ['mq_restricted', 'decode'] }, { rel: 'mira', delta: 5 }, { xp: 80 }],
            onLose: [{ toast: 'Узор рассыпался. Попробуйте ещё раз — Мира терпелива.' }] } }] },
          { text: 'Мне нужно подготовиться.' },
        ] },
    },
  },
  {
    id: 'mira_seals', npc: 'mira', start: 's',
    nodes: {
      s: { speaker: 'mira', text: 'Получилось. Слушай: «Три печати держат то, что внизу. Корень в лесу. Вода в озере. Камень там, где учились первые. Четвёртая — мы сами».', next: 's2' },
      s2: { speaker: 'mira', text: 'Сбои — это трещины. Кто-то ломает печати, одну за другой. А под Академией… «то, что внизу». Здесь написано — «Пятый».',
        choices: [
          { text: 'Пятый Основатель?', next: 'fifth' },
          { text: 'Кто может ломать печати?', next: 'who' },
        ] },
      fifth: { speaker: 'mira', text: 'Его вычеркнули из всех хроник. Вот почему в моей «Хронике» вырваны страницы! Он хотел забрать Сердце Эфира себе — и стал… пустотой.', effects: [{ lore: 'hollow' }], next: 'who' },
      who: { speaker: 'mira', text: 'Орден Пепла. Говорят, его давно разогнали. Но кто-то же рисует пеплом знаки в подземельях. И в деревне видят огни у старых руин.', next: 'plan' },
      plan: { speaker: 'mira', text: 'Печати надо восстановить. Все три. Лес, озеро, руины. Я одна не справлюсь, а взрослым… взрослые не поверят двум первокурсникам. Ты со мной?',
        choices: [
          { text: 'Конечно. Мы восстановим их вместе.', effects: [{ rel: 'mira', delta: 8 }], next: 'go' },
          { text: 'Может, всё-таки рассказать Архимагистру?', next: 'veist' },
        ] },
      veist: { speaker: 'mira', text: 'Я пыталась! Он улыбнулся и сказал: «Учитесь, мисс Вэйл, учитесь». Он что-то знает — и молчит. Значит, справимся сами.', next: 'go' },
      go: { speaker: 'mira', text: 'Лес теперь открыт — Бран уже не сможет удержать нас. Начни с той печати, какая ближе. И будь осторож{g:ен|на}, {name}.',
        effects: [{ lore: 'seals' }, { setFlag: 'forest_open' }, { setFlag: 'tunnels_open' }, { completeObjective: ['mq_restricted', 'reveal'] },
          { journal: 'Три печати держат «то, что внизу»: Корень — в лесу, Вода — в озере, Камень — в руинах Первой Академии. Кто-то ломает их. Мы с Мирой должны успеть первыми.' }] },
    },
  },
  {
    id: 'toby_sleepwalk', npc: 'toby', start: 's',
    nodes: {
      s: { speaker: 'toby', text: '…он зовёт… под камнем тепло… пахнет пирогом и пеплом… надо вниз, вниз, вниз…', next: 's2' },
      s2: { speaker: 'narrator', text: 'Глаза Тоби закрыты. Он медленно идёт к лестнице в подземелья, не замечая вас.',
        choices: [
          { text: 'Осторожно взять его за руку.', next: 'hand', effects: [{ rel: 'toby', delta: 4 }] },
          { text: 'Встряхнуть: «Тоби, проснись!»', next: 'shake' },
          { text: '[Сила магии 5] Сплести вокруг него мягкий оберег.', tag: '[Сила магии 5]', req: [{ stat: 'power', gte: 5 }], next: 'ward', effects: [{ rel: 'toby', delta: 6 }] },
        ] },
      hand: { speaker: 'toby', text: '…кто… а… это ты… он сказал, что я особенный… что мои сны… очень… вкусные…', next: 'fall' },
      shake: { speaker: 'toby', text: 'А?! Я… где… почему так холодно…', next: 'fall' },
      ward: { speaker: 'narrator', text: 'Оберег вспыхивает, и на миг вы слышите чужой шёпот — низкий, голодный. Он отдёргивается, как от огня.', effects: [{ setFlag: 'heard_hollow_first' }], next: 'fall' },
      fall: { speaker: 'narrator', text: 'Тоби оседает на пол и засыпает — глубоко, как камень. Его не добудиться. На губах — серый налёт, как пепел.',
        effects: [{ setFlag: 'toby_sick' }, { completeObjective: ['mq_sleepwalker', 'find'] },
          { journal: 'Ночью Тоби бродил по галерее с закрытыми глазами и говорил о «камне» и «пепле». Потом упал и не просыпается. Надо к сестре Мэйбел.' }] },
    },
  },
  {
    id: 'mabel_toby', npc: 'mabel', start: 's',
    nodes: {
      s: { speaker: 'mabel', text: 'Бедный мальчик. Пульс ровный, дыхание ровное — и никакого отклика. Это не болезнь, {name}. Это чары. И… запах. Чувствуешь?',
        choices: [
          { text: 'Пахнет пеплом. И чем-то сладким.', next: 'ash' },
          { text: '[Интеллект 6] Пепельный мак. Его запретили сто лет назад.', tag: '[Интеллект 6]', req: [{ stat: 'int', gte: 6 }], next: 'poppy', effects: [{ setFlag: 'knows_ash_poppy' }, { rel: 'mabel', delta: 5 }] },
        ] },
      ash: { speaker: 'mabel', text: 'Именно. Кто-то поил его отваром. Но кто и зачем — разберёмся потом. Сначала его надо разбудить.', next: 'cure' },
      poppy: { speaker: 'mabel', text: 'Умни{g:к|ца}. Да. Пепельный мак не убивает — он открывает сон. А в открытый сон может войти кто угодно. Сначала разбудим, потом будем искать отравителя.', next: 'cure' },
      cure: { speaker: 'mabel', text: 'Пробуждающее зелье: два лунных лепестка, солнечник и родниковая вода. Лепестки цветут только ночью — в Шепчущем лесу. Лес закрыт, но Бран тебя проведёт, если попросишь как следует.',
        effects: [{ learnRecipe: 'awakening' }, { completeObjective: ['mq_sleepwalker', 'mabel'] }],
        choices: [
          { text: 'Я всё достану.', effects: [{ rel: 'mabel', delta: 3 }] },
          { text: 'А где варить?', next: 'where' },
        ] },
      where: { speaker: 'mabel', text: 'Учебный котёл в лаборатории Пеллинора, в подземельях. Мастер не будет против, он добрая душа.', effects: [{ rel: 'mabel', delta: 2 }] },
    },
  },
  {
    id: 'bran_forest', npc: 'bran', start: 's',
    nodes: {
      s: { speaker: 'bran', text: 'В лес? Первокурсни{g:ку|це}? Ну нет, нет-нет. Там гончие по ночам, огоньки, пауки размером с… с меня в детстве.',
        choices: [
          { text: 'Это ради Тоби. Ему нужны лунные лепестки.', next: 'toby', effects: [{ rel: 'bran', delta: 5 }] },
          { text: '[Корень] Лес помнит своих. Я из Круга Корня.', tag: '[Круг Корня]', if: [{ circle: 'root' }], next: 'root', effects: [{ rel: 'bran', delta: 8 }] },
          { text: '[Найдёныш] Меня растила Ялла. Я знаю лес.', tag: '[Найдёныш]', if: [{ origin: 'foundling' }], next: 'yalla', effects: [{ rel: 'bran', delta: 8 }] },
        ] },
      toby: { speaker: 'bran', text: 'Тоби? Рыжий? Который мне пирог с морковкой испёк… кривой такой… Ох. Ладно. Ладно!', next: 'ok' },
      root: { speaker: 'bran', text: 'Сильвия бы одобрила. Ладно, листочек. Идём.', next: 'ok' },
      yalla: { speaker: 'bran', text: 'Ялла? Старая лиса… Передай ей, что я чинил её забор! Ладно, иди.', next: 'ok' },
      ok: { speaker: 'bran', text: 'Тропа к лесу — от восточной стены двора. Лунные лепестки ищи на полянах, цветут они с восьми вечера. И держись тропы, слышишь? Возьми вот — на всякий случай.',
        effects: [{ setFlag: 'forest_open' }, { give: 'potion_heal', count: 2 }, { completeObjective: ['mq_sleepwalker', 'bran'] },
          { journal: 'Бран открыл мне Шепчущий лес. Лунные лепестки цветут ночью на полянах.' }] },
    },
  },
  {
    id: 'toby_cure', npc: 'toby', start: 's',
    nodes: {
      s: { speaker: 'narrator', text: 'Вы осторожно вливаете пробуждающее зелье в рот спящего Тоби. Минуту ничего не происходит. Потом он чихает.',
        effects: [{ take: 'potion_awaken' }], next: 's2' },
      s2: { speaker: 'toby', text: 'Апчхи! Ой. Я что, опять уснул на зельеварении? …Почему я в лазарете? Почему ты так на меня смотришь?',
        choices: [
          { text: 'Ты три дня не просыпался, Тоби.', next: 'days' },
          { text: 'Кто давал тебе отвар перед сном?', next: 'who' },
        ] },
      days: { speaker: 'toby', text: 'Три дня?! Я пропустил пирог по средам! …Шучу. Мне снилось, что под замком кто-то есть. Огромный и пустой. И он всё время голодный.', next: 'who' },
      who: { speaker: 'toby', text: 'Отвар? Ну… «тонизирующий», от усталости. Его раздавали тем, кто плохо спит. Пах мятой и пирогом. Я не помню лица — только добрый голос.',
        effects: [{ setFlag: 'toby_cured' }, { setFlag: 'toby_clue_tonic' }, { completeObjective: ['mq_sleepwalker', 'cure'] }, { rel: 'toby', delta: 10 },
          { journal: 'Тоби проснулся. Перед сном ему давали «тонизирующий отвар», пахнущий мятой и пирогом. Кто-то в Академии поит учеников пепельным маком.' }],
        choices: [{ text: 'Отдыхай. Я разберусь.' }, { text: 'Больше ничего ни у кого не пей.', effects: [{ rel: 'toby', delta: 2 }] }] },
    },
  },
  {
    id: 'toby_asleep', npc: 'toby', start: 's',
    nodes: {
      s: { speaker: 'narrator', text: 'Тоби спит. Он дышит ровно, но не отзывается ни на голос, ни на прикосновение. Сестра Мэйбел качает головой: «Не буди. Всё равно не выйдет».' },
    },
  },

  // ======================= АКТ III =======================
  {
    id: 'soren_forest', npc: 'soren', start: 's',
    nodes: {
      s: { speaker: 'soren', text: 'Ученик. Маленький, упрямый ученик с горящими глазами. Вейст всё так же набирает тех, кто не умеет вовремя остановиться.',
        choices: [
          { text: 'Кто вы такой?', next: 'who' },
          { text: 'Отойдите от печати.', next: 'away' },
        ] },
      who: { speaker: 'soren', text: 'Сорен Мальграв. Когда-то — лучший ученик этой Академии. Теперь — тот, кто закончит то, чего Основатели испугались.', next: 'offer' },
      away: { speaker: 'soren', text: 'Печать? Она треснула задолго до меня. Я лишь помогаю неизбежному.', next: 'offer' },
      offer: { speaker: 'soren', text: 'Сердце Эфира держат в клетке тысячу лет. Магия, которая могла бы принадлежать каждому, — заперта ради спокойствия стариков. Подумай об этом. А пока — познакомься с моим псом.',
        choices: [
          { text: 'Я восстановлю печать.', effects: [{ rel: 'soren', delta: -5 }] },
          { text: '…Каждому? Или только вам?', effects: [{ setFlag: 'questioned_soren' }] },
        ] },
    },
  },
  {
    id: 'lake_queen_peace', start: 's',
    nodes: {
      s: { speaker: 'narrator', text: 'Над водой поднимается бледная фигура в мокром платье ученицы. Её глаза — два холодных озера.', next: 's2' },
      s2: { speaker: 'lake_queen', text: 'Ты пел{g:|а} моим сёстрам, а не жёг{g:|ла} их. Давно никто не приходил ко мне с песней. Зачем ты здесь, живое дитя?',
        choices: [
          { text: 'Печать Вод треснула. Я пришл{g:ёл|а} её восстановить.', next: 'seal' },
          { text: 'Кем ты была?', next: 'past' },
        ] },
      past: { speaker: 'lake_queen', text: 'Ученицей Сильвии. В ночь пожара я несла печать через озеро, а лёд был тонким. Я поклялась: никто, несущий пепел, не пройдёт. Тысячу лет я держу клятву.', effects: [{ lore: 'lake_queen' }], next: 'seal' },
      seal: { speaker: 'lake_queen', text: 'Покажи мне своё сердце.', next: 'judge' },
      judge: { speaker: 'narrator', text: 'Холод касается груди изнутри. Владычица смотрит сквозь вас.',
        choices: [
          { text: '(Открыться ей.)', if: [{ not: { corruption: 30 } }], next: 'bless' },
          { text: '(Открыться ей.)', if: [{ corruption: 30 }], next: 'ash' },
        ] },
      bless: { speaker: 'lake_queen', text: 'Чисто. Иди, дитя. Печать примет тебя. И передай Сильвии, если встретишь её среди звёзд: я всё ещё жду.',
        effects: [{ setFlag: 'queen_blessing' }, { achievement: 'pacifist_lake' }, { rep: 'forest', delta: 15 }, { xp: 150 },
          { journal: 'Владычица озера благословила меня без боя. Печать Вод ждёт на острове.' }] },
      ash: { speaker: 'lake_queen', text: 'Пепел. В тебе пепел. Ты слышишь его по ночам, правда? …Клятва есть клятва.',
        effects: [{ clearFlag: 'lake_spirits_calmed' }, { journal: 'Владычица учуяла во мне пепел. Теперь придётся драться.' }] },
    },
  },
  {
    id: 'elias_first', npc: 'elias', start: 's',
    nodes: {
      s: { speaker: 'elias', text: 'Живые. В моём архиве. Как… неожиданно. Не трогайте третью полку слева, она держится на честном слове. Моём.',
        choices: [
          { text: 'Вы — архивариус Первой Академии?', next: 'who' },
          { text: 'Вы призрак?', next: 'ghost' },
        ] },
      ghost: { speaker: 'elias', text: 'Технически — да. Практически — архивариус. Смерть не освобождает от обязанностей, юный маг, она лишь сокращает обеденный перерыв.', next: 'who' },
      who: { speaker: 'elias', text: 'Элиас. Я видел пожар. Я знаю, кто его устроил и зачем. Но память — как бумага: сгорает по краям. Мой дневник разлетелся по руинам. Три страницы. Без них я помню лишь обрывки.',
        choices: [
          { text: 'Я найду ваши страницы.', effects: [{ startQuest: 'sq_elias' }, { rel: 'elias', delta: 5 }] },
          { text: 'Расскажите хотя бы обрывки.', next: 'bits' },
        ] },
      bits: { speaker: 'elias', text: 'Пятый. Сердце. Выбор, который Основатели не сделали. …Видите? Обрывки. Найдите страницы.', effects: [{ startQuest: 'sq_elias' }] },
    },
  },
  {
    id: 'elias_pages', npc: 'elias', start: 's',
    nodes: {
      s: { speaker: 'elias', text: 'Мои страницы! Не мните — они старше вашей прапрабабушки. Так… да. Да. Теперь я помню.',
        effects: [{ take: 'elias_page', count: 3 }], next: 'truth' },
      truth: { speaker: 'elias', text: 'Основатели спорили. Трое хотели сторожить Сердце вечно. Орин, Звездочёт, хотел его разбить — отпустить магию в мир, чтобы никто больше не мог ею владеть. Ему не дали. И тогда Пятый попытался забрать Сердце себе.', next: 'truth2' },
      truth2: { speaker: 'elias', text: 'Запомните, юный маг: Сердце можно стеречь. Можно отдать ему себя. А можно — разбить. Тогда долина утратит своё чудо, но мир получит его частичку. Выбор Орина. Однажды кто-то должен будет сделать его снова.',
        effects: [{ completeObjective: ['sq_elias', 'return'] }, { journal: 'Элиас рассказал правду: Сердце Эфира можно не только стеречь, но и разбить — как хотел Орин. Магия долины уйдёт в мир.' }],
        choices: [{ text: 'Спасибо, Элиас.', effects: [{ rel: 'elias', delta: 10 }] }] },
    },
  },
  {
    id: 'elias_corvin', npc: 'elias', start: 's',
    nodes: {
      s: { speaker: 'elias', text: 'Письмо? Мне? От живых мне не пишут уже лет девятьсот… «Сайлас Корвин». А. Мальчик, который задавал правильные вопросы.',
        next: 'read' },
      read: { speaker: 'narrator', text: 'Призрак читает долго. Потом аккуратно складывает письмо.', next: 'ans' },
      ans: { speaker: 'elias', text: 'Передайте ему: «Ты не виноват. Он сделал свой выбор задолго до тебя. Печать Камня держится, но сквозь неё уже видно». Он поймёт.',
        effects: [{ take: 'corvin_letter' }, { setFlag: 'elias_answered' }, { completeObjective: ['rq_corvin', 'deliver'] }],
        choices: [
          { text: 'Кто «он»?', next: 'who' },
          { text: 'Передам.' },
        ] },
      who: { speaker: 'elias', text: 'Сорен Мальграв. Лучший ученик Корвина. Его друг. Его ошибка — так Корвин думает. Он не прав.', effects: [{ setFlag: 'knows_soren_corvin' }] },
    },
  },
  {
    id: 'corvin_debt', npc: 'corvin', start: 's',
    nodes: {
      s: { speaker: 'corvin', text: '{name}. Вы, говорят, бываете в руинах. Не отрицайте — у вас на подоле пыль Первой Академии, её ни с чем не спутать.',
        choices: [
          { text: 'Допустим. И что?', next: 'ask' },
          { text: 'Вы за мной следите?', next: 'watch' },
        ] },
      watch: { speaker: 'corvin', text: 'За всеми. Это моя работа. Неприятная, но необходимая.', next: 'ask' },
      ask: { speaker: 'corvin', text: 'В руинах живёт архивариус Элиас. Мне нужно передать ему письмо. Лично. Сам я… не могу туда вернуться. Не читайте его.',
        choices: [
          { text: 'Хорошо. Передам.', effects: [{ startQuest: 'rq_corvin' }, { give: 'corvin_letter' }, { rel: 'corvin', delta: 5 }] },
          { text: 'Что в письме?', next: 'what' },
          { text: 'Нет. Найдите другого курьера.', effects: [{ rel: 'corvin', delta: -3 }] },
        ] },
      what: { speaker: 'corvin', text: 'Извинение. Которое опоздало на двадцать лет. Этого достаточно?',
        choices: [
          { text: 'Достаточно. Давайте письмо.', effects: [{ startQuest: 'rq_corvin' }, { give: 'corvin_letter' }, { rel: 'corvin', delta: 8 }] },
          { text: 'Нет.', effects: [{ rel: 'corvin', delta: -3 }] },
        ] },
    },
  },
  {
    id: 'corvin_debt_done', npc: 'corvin', start: 's',
    nodes: {
      s: { speaker: 'corvin', text: 'Вы были у Элиаса. Он… ответил?',
        choices: [{ text: '«Ты не виноват. Он сделал свой выбор задолго до тебя».', next: 'ans' }] },
      ans: { speaker: 'corvin', text: '…', next: 'ans2' },
      ans2: { speaker: 'corvin', text: 'Двадцать лет назад мой лучший ученик ушёл в Орден Пепла. Сорен Мальграв. Я учил его рунам печатей. Я думал, что это я сделал его таким. Спасибо, {name}. Я этого не забуду.',
        effects: [{ completeObjective: ['rq_corvin', 'answer'] }, { setFlag: 'corvin_trusts' }, { setFlag: 'knows_soren_corvin' },
          { journal: 'Сорен Мальграв, глава Ордена Пепла, был учеником Корвина. Корвин винил себя двадцать лет.' }] },
    },
  },
  {
    id: 'mira_stars_offer', npc: 'mira', start: 's',
    nodes: {
      s: { speaker: 'mira', text: 'Слушай… а ты когда-нибудь видел{g:|а} звёзды с балкона Башни Звезды? Оттуда видно Венец Орина. Хочешь, сходим вечером? Просто посмотреть. На звёзды. Ничего такого.',
        choices: [
          { text: 'С удовольствием.', effects: [{ startQuest: 'rq_mira' }, { rel: 'mira', delta: 3 }] },
          { text: 'Ты покраснела?', next: 'blush' },
          { text: 'Не сейчас, Мира.', effects: [{ rel: 'mira', delta: -2 }] },
        ] },
      blush: { speaker: 'mira', text: 'Это от… от свечей! Тут жарко. Так ты придёшь или нет?', effects: [{ startQuest: 'rq_mira' }, { rel: 'mira', delta: 2 }] },
    },
  },
  {
    id: 'mira_stars', npc: 'mira', start: 's',
    nodes: {
      s: { speaker: 'mira', text: 'Ты приш{g:ёл|ла}! Смотри — вон там, над шпилем, семь звёзд полукругом. Венец Орина. Говорят, он сам их туда повесил.',
        choices: [
          { text: 'Красиво. Почти как ты.', next: 'flirt' },
          { text: 'Ты правда в это веришь?', next: 'believe' },
          { text: 'Мира, ты в порядке? Ты в последнее время очень тихая.', next: 'worry' },
        ] },
      flirt: { speaker: 'mira', text: '…Это была очень плохая фраза. Ужасная. Скажи ещё раз.', effects: [{ rel: 'mira', delta: 10 }, { setFlag: 'mira_romance' }], next: 'end' },
      believe: { speaker: 'mira', text: 'Нет. Да. Я верю, что Орин хотел, чтобы его помнили не по печатям, а по звёздам. Это… красивее.', effects: [{ rel: 'mira', delta: 6 }], next: 'end' },
      worry: { speaker: 'mira', text: 'Мне снится пустота под замком. Как будто она смотрит на меня. Я не говорила никому… кроме тебя. Спасибо, что спросил{g:|а}.', effects: [{ rel: 'mira', delta: 8 }, { setFlag: 'mira_dreams' }], next: 'end' },
      end: { speaker: 'narrator', text: 'Вы долго сидите на холодном камне балкона. Где-то внизу бьёт колокол, но вам обоим всё равно.',
        effects: [{ completeObjective: ['rq_mira', 'stars'] }, { journal: 'Мы с Мирой смотрели на Венец Орина с балкона. Почему-то это кажется важнее всех печатей.' }] },
    },
  },

  // ======================= АКТ IV =======================
  {
    id: 'mira_suspicion', npc: 'mira', start: 's',
    nodes: {
      s: { speaker: 'mira', text: 'Письмо сектантов. «Порошок готов. Ученики спят крепко. — П.» Порошок — это пепельный мак, тот самый, которым отравили Тоби. Значит, «П.» — кто-то из Академии.',
        choices: [
          { text: 'Пеллинор? Он варит зелья. И Тоби говорил про запах пирога.', if: [{ flag: 'toby_clue_tonic' }], next: 'pell' },
          { text: 'А Корвин? Он бродит по подземельям ночами.', next: 'corv' },
          { text: 'Это может быть кто угодно.', next: 'any' },
        ] },
      pell: { speaker: 'mira', text: 'Пеллинор?! Он же… он всем печёт пироги. Он мне на первой неделе котёл отмыл… Нет. Нам нужны доказательства, а не запахи.', next: 'plan' },
      corv: { speaker: 'mira', text: 'Корвин… Да, он подозрительный. Но «П.»? Хотя… подпись может быть не именем. Нужно проверить.', next: 'plan' },
      any: { speaker: 'mira', text: 'Вот именно. Поэтому нам нужны доказательства.', next: 'plan' },
      plan: { speaker: 'mira', text: 'Предлагаю так: кабинет Корвина в Башнях — он днём на уроках. И кладовая алхимика в подземельях. Ключ, говорят, Пеллинор держит в сундуке у себя в комнате. Или спроси Нико — он вскрывал всё, что только запирается.',
        effects: [{ completeObjective: ['mq_suspicion', 'mira'] }, { journal: '«П.» — кто-то из Академии. Проверить кабинет Корвина в Башнях и кладовую алхимика в подземельях (ключ — у Пеллинора или у Нико).' }] },
    },
  },
  {
    id: 'nico_key', npc: 'nico', start: 's',
    nodes: {
      s: { speaker: 'nico', text: 'Кладовая Пеллинора? Ха! Я туда лазил на втором курсе за драконьим перцем. Ключик-дубликат у меня, конечно, есть. Вопрос — что мне за это будет?',
        choices: [
          { text: '30 крон.', req: [{ gold: 30 }], effects: [{ gold: -30 }], next: 'give' },
          { text: 'Дружба. И я никому не скажу про драконий перец.', req: [{ rel: 'nico', gte: 15 }], tag: '[Отношения 15]', next: 'give', effects: [{ rel: 'nico', delta: 3 }] },
          { text: '[Интеллект 6] Ты понимаешь, что в кладовой может быть то, чем травят учеников?', tag: '[Интеллект 6]', req: [{ stat: 'int', gte: 6 }], next: 'serious' },
          { text: 'Обойдусь.' },
        ] },
      serious: { speaker: 'nico', text: '…Тоби? Это из-за этого Тоби… Держи. Бесплатно. И найди того, кто это сделал.', next: 'give', effects: [{ rel: 'nico', delta: 6 }] },
      give: { speaker: 'nico', text: 'Держи. Поворачивай два раза влево и один вправо — он капризный. И если что — меня тут не было.',
        effects: [{ give: 'storeroom_key' }, { setFlag: 'nico_key_given' }] },
    },
  },
  {
    id: 'veist_accuse', npc: 'veist', start: 's',
    nodes: {
      s: { speaker: 'veist', text: '{name}. У вас лицо человека, который принёс плохие новости. Садитесь. Говорите.',
        choices: [
          { text: 'Мастер Пеллинор — член Ордена Пепла. Вот его знак из кладовой.', if: [{ item: 'ash_sigil' }], next: 'pell' },
          { text: 'Магистр Корвин связан с Орденом. Он бывает в подземельях ночами.', if: [{ notFlag: 'read_corvin_notes' }, { notFlag: 'corvin_trusts' }], next: 'corv' },
          { text: '(Промолчать о Пеллиноре.) Я хочу сам{g:|а} с ним поговорить.', if: [{ item: 'ash_sigil' }], next: 'self' },
        ] },
      pell: { speaker: 'veist', text: 'Феликс… Я знал его тридцать лет. Он пёк пироги на каждый мой день рождения. …Я надеялся ошибиться. Ульрих! Стражу к подземельям. Немедленно.', next: 'pell2' },
      pell2: { speaker: 'narrator', text: 'Стража спускается в подземелья — но комнаты Пеллинора пусты. Котлы ещё тёплые. Решётка в тоннели сорвана с петель.',
        effects: [{ setFlag: 'pellinor_fled' }, { setFlag: 'pellinor_accused' }, { completeObjective: ['mq_suspicion', 'accuse'] },
          { journal: 'Пеллинор бежал в подземные тоннели, прежде чем его схватили. Его нужно остановить.' }] },
      corv: { speaker: 'veist', text: 'Сайлас? …Это серьёзное обвинение, {name}. Хорошо. Я отстраню его до выяснения. Но если вы ошибаетесь, вы сломали жизнь человеку, который двадцать лет защищал этих детей.',
        effects: [{ setFlag: 'corvin_arrested' }, { rel: 'corvin', delta: -40 }, { rel: 'veist', delta: -5 }], next: 'corv2' },
      corv2: { speaker: 'narrator', text: 'Той же ночью из подземелий исчезает Пеллинор. В его комнате — пепел, знак Ордена и недописанное письмо: «Они ищут не того. Уходим».',
        effects: [{ setFlag: 'pellinor_fled' }, { completeObjective: ['mq_suspicion', 'accuse'] },
          { journal: 'Я обвинил{g:|а} Корвина — и ошиб{g:ся|лась}. Пеллинор сбежал в тоннели той же ночью. Корвин отстранён по моей вине.' }] },
      self: { speaker: 'veist', text: 'Вы хотите что-то сказать? …Нет? Хорошо. Иногда человеку нужно дать шанс сказать правду самому. Но будьте осторожны, {name}. Загнанный зверь кусается.',
        effects: [{ setFlag: 'chose_confront' }, { completeObjective: ['mq_suspicion', 'accuse'] }] },
    },
  },
  {
    id: 'pellinor_confront', npc: 'pellinor', start: 's',
    nodes: {
      s: { speaker: 'pellinor', text: 'А, юный алхимик! Пирожок? Свежий… Ты смотришь на меня, как на пустой котёл. Что такое?',
        choices: [
          { text: '(Показать знак Ордена Пепла.)', if: [{ item: 'ash_sigil' }], next: 'sigil' },
        ] },
      sigil: { speaker: 'pellinor', text: '…А. Вот оно что. Значит, нашли. Я всегда был неряхой, всегда всё оставлял на виду.', next: 'why' },
      why: { speaker: 'pellinor', text: 'Сорен обещал вылечить мою дочь. Хворь Пустоты — ни одно зелье её не берёт. А Сердце может всё. Мне нужно было только… усыпить пару учеников. Их сны — открытые двери. Через них Пустота подтачивает печати. Никто не должен был пострадать.',
        choices: [
          { text: 'Тоби три дня не просыпался!', next: 'toby' },
          { text: '[Отношения 20] Феликс, Сорен вам лжёт. Помогите нам — и ваша дочь получит помощь Академии.', tag: '[Отношения 20]', req: [{ rel: 'pellinor', gte: 20 }], next: 'turn' },
          { text: '[Интеллект 7] Хворь Пустоты — от Пустоты. Сердце, отданное Сорену, её только усилит.', tag: '[Интеллект 7]', req: [{ stat: 'int', gte: 7 }], next: 'turn' },
          { text: 'Вы пойдёте со мной к Архимагистру.', next: 'flee' },
        ] },
      toby: { speaker: 'pellinor', text: 'Я… знаю. Знаю. Я каждую ночь сидел у его кровати, пока Мэйбел спала. Я не чудовище, {name}. Я просто отец.',
        choices: [
          { text: '[Отношения 20] Тогда помогите нам остановить Сорена.', tag: '[Отношения 20]', req: [{ rel: 'pellinor', gte: 20 }], next: 'turn' },
          { text: '[Интеллект 7] Сорен не вылечит её. Пустота не лечит — она ест.', tag: '[Интеллект 7]', req: [{ stat: 'int', gte: 7 }], next: 'turn' },
          { text: 'Вам всё равно придётся ответить.', next: 'flee' },
        ] },
      turn: { speaker: 'pellinor', text: '…Ты прав{g:|а}. Святые котлы, ты прав{g:|а}. Я отдам Вейсту всё: имена, тайники, рецепт порошка. И противоядие. Пусть Мэйбел запрёт меня в лазарете. Я заслужил.',
        effects: [{ setFlag: 'pellinor_spared' }, { setFlag: 'ally_pellinor' }, { learnRecipe: 'antidote' }, { give: 'ash_antidote', count: 2 }, { rel: 'pellinor', delta: 10 },
          { completeObjective: ['mq_suspicion', 'confront'] }, { achievement: 'redeemer' },
          { journal: 'Пеллинор признался и сдался сам. Его дочь больна Хворью Пустоты, а Сорен обещал её вылечить. Теперь Пеллинор на нашей стороне.' }] },
      flee: { speaker: 'pellinor', text: 'Прости, юный алхимик. Не сегодня.',
        effects: [{ setFlag: 'pellinor_fled' }, { completeObjective: ['mq_suspicion', 'confront'] }, { script: 'pellinorFlee' },
          { journal: 'Пеллинор бросил дымовое зелье и скрылся в тоннелях.' }] },
    },
  },
  {
    id: 'pellinor_spared', npc: 'pellinor', start: 's',
    nodes: {
      s: { speaker: 'pellinor', text: 'Сестра Мэйбел говорит, что я лучший пациент: тихий и всегда приношу пироги. Ха. Чем могу помочь, {name}?',
        choices: [
          { text: 'Как вы?', next: 'how' },
          { text: 'Что вы знаете о Сорене?', next: 'soren' },
          { text: 'Ничего, отдыхайте.' },
        ] },
      how: { speaker: 'pellinor', text: 'Стыдно. Но живой. Вейст послал гонца к моей дочери — с лекарями Академии. Ты понимаешь, что ты для меня сделал{g:|а}? Вот, возьми. Я всё ещё умею варить.',
        effects: [{ give: 'potion_heal_big' }], next: 's' },
      soren: { speaker: 'pellinor', text: 'Он не злой. Это хуже. Он уверен, что прав. Такие не останавливаются. Сердце для него — не сила, а справедливость. Он ошибается, но красиво.' },
    },
  },
  {
    id: 'cassian_choice', npc: 'cassian', start: 's',
    nodes: {
      s: { speaker: 'cassian', text: 'Ты жив{g:|а}. Хорошо. …Не смотри так. Да, я видел, как они вошли. Да, я знал, что они придут.',
        choices: [
          { text: 'Ты открыл им ворота?', next: 'gate' },
          { text: 'Что происходит, Кассиан?', next: 'gate' },
        ] },
      gate: { speaker: 'cassian', text: 'Моя семья двадцать лет платит Ордену. Детали, деньги, молчание. Сорен сказал: открой калитку — и Морвели станут первыми в новом мире. Я… открыл засов. А потом увидел, как они жгут теплицы, где Элоди выращивала мяту.',
        choices: [
          { text: '[Отношения 25] Ты не твоя семья. Ты можешь выбрать иначе.', tag: '[Отношения 25]', req: [{ rel: 'cassian', gte: 25 }], next: 'redeem' },
          { text: '[Бастион] Щит Торвальда не прячется за спинами. Стань щитом, а не засовом.', tag: '[Круг Бастиона]', if: [{ circle: 'bastion' }], next: 'redeem' },
          { text: 'Ты уже выбрал однажды — я помню, как ты вёл себя у ворот в первый день. Ты можешь лучше.', if: [{ flag: 'cassian_respect' }], next: 'redeem' },
          { text: 'Решим это на дуэли. Победишь — уходи. Проиграешь — останешься и поможешь.', next: 'duel' },
          { text: 'Убирайся. Предателям здесь не место.', next: 'leave' },
        ] },
      duel: { speaker: 'cassian', text: 'Дуэль? Сейчас? …Ты сумасшедш{g:ий|ая}. Мне это нравится. К бою.',
        choices: [{ text: '(Дуэль)', effects: [{ minigame: { type: 'duel', id: 'duel_cassian_fate', opponent: 'cassian', difficulty: 3, title: 'Дуэль: судьба Кассиана',
          onWin: [{ startDialogue: 'cassian_redeemed', npc: 'cassian' }],
          onLose: [{ startDialogue: 'cassian_leaves', npc: 'cassian' }] } }] }] },
      redeem: { speaker: 'cassian', text: '…Ладно. Ладно! Я не буду ждать, пока за меня решат. Я пойду с тобой — куда бы ты ни пош{g:ёл|ла}. И если встречу Сорена, пусть пеняет на себя.',
        effects: [{ setFlag: 'cassian_redeemed' }, { setFlag: 'ally_cassian' }, { achievement: 'redeemer' }, { rel: 'cassian', delta: 15 }, { completeObjective: ['mq_night_of_ash', 'cassian'] },
          { journal: 'Кассиан признался, что его семья служила Ордену. Но он выбрал нашу сторону.' }] },
      leave: { speaker: 'cassian', text: 'Как скажешь. Я думал… неважно. Прощай, {name}.',
        effects: [{ setFlag: 'cassian_left' }, { rel: 'cassian', delta: -20 }, { completeObjective: ['mq_night_of_ash', 'cassian'] },
          { journal: 'Кассиан ушёл в ночь. Боюсь, к Сорену.' }] },
    },
  },
  {
    id: 'cassian_redeemed', npc: 'cassian', start: 's',
    nodes: {
      s: { speaker: 'cassian', text: '…Ты победил{g:|а}. Честно. Хорошо. Уговор есть уговор. Я остаюсь — и я помогу.',
        effects: [{ setFlag: 'cassian_redeemed' }, { setFlag: 'ally_cassian' }, { achievement: 'redeemer' }, { rel: 'cassian', delta: 10 }, { completeObjective: ['mq_night_of_ash', 'cassian'] }] },
    },
  },
  {
    id: 'cassian_leaves', npc: 'cassian', start: 's',
    nodes: {
      s: { speaker: 'cassian', text: 'Я победил. Значит, я свободен. Не ищи меня.',
        effects: [{ setFlag: 'cassian_left' }, { completeObjective: ['mq_night_of_ash', 'cassian'] }, { journal: 'Кассиан выиграл дуэль и ушёл.' }] },
    },
  },
  {
    id: 'hollow_voice', start: 's',
    nodes: {
      s: { speaker: 'narrator', text: 'Вы засыпаете — и падаете. Сквозь кровать, сквозь камень, сквозь тысячу лет. Внизу темно и тепло.', next: 's2' },
      s2: { speaker: 'hollow', text: 'Наконец-то. Я так долго звал. Мальчик с рыжими волосами слышал, но был слишком слаб. Ты — нет.',
        choices: [
          { text: 'Кто ты?', next: 'who' },
          { text: 'Оставь моих друзей в покое.', next: 'friends' },
        ] },
      who: { speaker: 'hollow', text: 'Я был пятым. Я хотел, чтобы магия не кончалась. Чтобы никто не умирал. Они назвали это жадностью — и заперли меня в собственном голоде.', next: 'offer' },
      friends: { speaker: 'hollow', text: 'Друзья? Сорен уже идёт за той, что с книгой. Ты не успеешь. Если только…', next: 'offer' },
      offer: { speaker: 'hollow', text: 'Возьми немного моей силы. Совсем чуть-чуть. Тьму, которая гасит любой свет. С ней ты одолеешь Сорена. Без неё — похоронишь друзей.',
        choices: [
          { text: 'Я возьму силу. Ради них.', next: 'accept' },
          { text: 'Нет. Я справлюсь сам{g:|а}.', next: 'refuse' },
          { text: '[Звезда] Орин видел тебя насквозь. И я вижу.', tag: '[Круг Звезды]', if: [{ circle: 'star' }], next: 'refuse_star' },
        ] },
      accept: { speaker: 'hollow', text: 'Хорошо. Хорошо… Мы ещё поговорим, маленький сосуд.',
        effects: [{ learnSpell: 'eclipse' }, { corruption: 25 }, { setFlag: 'accepted_hollow' }, { setFlag: 'voice_answered' }], next: 'wake' },
      refuse: { speaker: 'hollow', text: 'Гордость. Как у них всех. Тогда смотри, как всё рушится.',
        effects: [{ corruption: -5 }, { setFlag: 'refused_hollow' }, { setFlag: 'voice_answered' }], next: 'wake' },
      refuse_star: { speaker: 'hollow', text: 'Звездочёт… Его глаза. Опять его глаза. Уходи!',
        effects: [{ corruption: -10 }, { setFlag: 'refused_hollow' }, { setFlag: 'voice_answered' }, { stat: 'int', delta: 1 }], next: 'wake' },
      wake: { speaker: 'narrator', text: 'Вы просыпаетесь от колокола. Он бьёт не так — часто, тревожно. В коридоре кричат: «Лазарет! Архимагистр ранен! Они забрали девочку Вэйл!»',
        effects: [{ script: 'nightOfAshAftermath' }] },
    },
  },
  {
    id: 'veist_key', npc: 'veist', start: 's',
    nodes: {
      s: { speaker: 'veist', text: '{name}. Подойдите ближе, у меня нет сил говорить громко. Сорен пришёл сам. Я старый дурак — думал, что ещё могу с ним справиться.',
        choices: [
          { text: 'Где Мира?', next: 'mira' },
          { text: 'Не говорите, берегите силы.', next: 'mira', effects: [{ rel: 'veist', delta: 3 }] },
        ] },
      mira: { speaker: 'veist', text: 'Он забрал её вниз. К Сердцу. Её дар… она видит руны так, как видел Орин. Ему нужен ключ к последней печати — а последняя печать в нас самих. В Основателях. В их наследниках.', next: 'truth' },
      truth: { speaker: 'veist', text: 'Я должен был рассказать вам раньше. Под Академией — Сердце Эфира. А в Сердце — Полый Король. Если Сорен разобьёт последнюю печать, Пустота выйдет наружу. А он думает, что сможет её приручить.', next: 'key' },
      key: { speaker: 'veist', text: 'Вот. Ключ Основателей. Он открывает Печатную дверь в тоннелях. Я хотел отдать его более опытному… но опытные мне не нужны. Нужны верные.',
        effects: [{ give: 'founders_key' }, { script: 'gatherAllies' }],
        choices: [
          { text: 'Я верну Миру. Обещаю.', next: 'go' },
          { text: 'Почему я?', next: 'why' },
        ] },
      why: { speaker: 'veist', text: 'Потому что Зеркало Кругов треснуло, когда в него посмотрели вы. Оно треснуло не от тьмы, {name}. От того, что не смогло вместить выбор. Ваш выбор ещё впереди.', next: 'go' },
      go: { speaker: 'veist', text: 'Идите. И помните: Сердце — не сила. Это клятва.',
        effects: [{ completeObjective: ['mq_night_of_ash', 'veist'] }, { journal: 'Архимагистр ранен, Мира похищена. Вейст отдал мне Ключ Основателей. Печатная дверь в тоннелях ведёт к Сердцу Эфира.' }] },
    },
  },

  // ======================= АКТ V =======================
  {
    id: 'mira_captive', npc: 'mira', start: 's',
    nodes: {
      s: { speaker: 'mira', text: '{name}! Ты приш{g:ёл|ла}! Я знала… Нет, не подходи к цепям — они связаны с печатью! Сначала Сорен. Он у Сердца!' },
    },
  },
  {
    id: 'soren_sanctum', start: 's',
    nodes: {
      s: { speaker: 'soren', text: 'Ты дош{g:ёл|ла}. Вейст отдал ключ ребёнку. Это так на него похоже.',
        choices: [
          { text: 'Отпусти Миру.', next: 'mira' },
          { text: 'Ты не понимаешь, что там, внизу.', next: 'below' },
          { text: 'Корвин просил передать: ты сделал свой выбор сам.', if: [{ flag: 'knows_soren_corvin' }], next: 'corvin' },
        ] },
      mira: { speaker: 'soren', text: 'Её не держат цепи. Её держит печать. Как только последняя печать падёт, цепи рассыплются сами. Видишь? Я не злодей. Я освобождаю всех.', next: 'last' },
      below: { speaker: 'soren', text: 'Пустота? Голод, запертый тысячу лет. Я накормлю её Сердцем — и она станет моей. Сила без конца. Для всех, кто достоин.', next: 'last' },
      corvin: { speaker: 'soren', text: '…Сайлас. Старый упрямец. Он так и не понял: я не ушёл от него. Я пошёл дальше. Хватит слов.', effects: [{ setFlag: 'soren_shaken' }], next: 'last' },
      last: { speaker: 'soren', text: 'Последний шанс, ученик. Встань рядом — и увидишь новый мир. Или встань против — и не увидишь ничего.',
        choices: [
          { text: 'Я против.', effects: [{ setFlag: 'soren_challenge' }] },
          { text: '[Порча 40] …А если я заберу Сердце себе?', tag: '[Порча 40]', if: [{ corruption: 40 }], effects: [{ setFlag: 'soren_challenge' }, { setFlag: 'dark_ambition' }] },
        ] },
    },
  },
  {
    id: 'mira_freed', npc: 'mira', start: 's',
    nodes: {
      s: { speaker: 'mira', text: 'Цепи упали! Ты… ты в порядке? Смотри, Сердце — оно трескается. Полый Король… он выходит!' },
    },
  },
  {
    id: 'heart_choice', start: 's',
    nodes: {
      s: { speaker: 'narrator', text: 'Полый Король рассыпался чёрным снегом. Перед вами — Сердце Эфира: кристалл размером с дверь, тёплый, как живое существо. Трещина бежит по его грани.', next: 's2' },
      s2: { speaker: 'mira', text: '{name}… Печать почти исчезла. Сердце нужно либо запечатать заново, либо… Решать тебе. Я буду рядом при любом выборе.',
        choices: [
          { text: 'Принести клятву Основателей и стать Хранителем Сердца.', next: 'guardian' },
          { text: 'Отдать Сердцу свою магию, чтобы запечатать Пустоту навсегда.', next: 'sacrifice' },
          { text: 'Разбить Сердце, как хотел Орин. Отпустить магию в мир.', if: [{ flag: 'archivist_truth' }], next: 'free' },
          { text: '(Положить руку на трещину и выпить свет.)', if: [{ any: [{ corruption: 40 }, { flag: 'accepted_hollow' }, { flag: 'dark_ambition' }] }], next: 'dark' },
        ] },
      guardian: { speaker: 'narrator', text: 'Вы кладёте ладонь на кристалл и произносите слова, которые никогда не учили, но всегда знали: «Свет — для всех. Сердце — не сила, а клятва». Трещина затягивается.',
        effects: [{ completeObjective: ['mq_sanctum', 'heart'] }, { achievement: 'ending_guardian' }, { ending: 'guardian' }] },
      sacrifice: { speaker: 'narrator', text: 'Вы отдаёте Сердцу всё: каждую искру, каждое заклинание, каждую ночь над книгами. Кристалл вспыхивает белым. Пустота уходит навсегда. А вместе с ней — и ваша магия.',
        effects: [{ completeObjective: ['mq_sanctum', 'heart'] }, { achievement: 'ending_sacrifice' }, { ending: 'sacrifice' }] },
      free: { speaker: 'narrator', text: 'Вы поднимаете жезл. Мира берёт вас за руку — и вы бьёте вместе. Сердце раскалывается, и свет уходит вверх, сквозь камень, сквозь замок, в небо — к Венцу Орина.',
        effects: [{ completeObjective: ['mq_sanctum', 'heart'] }, { achievement: 'ending_free' }, { ending: 'free' }] },
      dark: { speaker: 'narrator', text: 'Вы касаетесь трещины, и свет течёт в вас — тёплый, бесконечный, голодный. Мира кричит ваше имя. Вы больше не слышите. Вы слышите только голод.',
        effects: [{ completeObjective: ['mq_sanctum', 'heart'] }, { achievement: 'ending_dark' }, { ending: 'dark' }] },
    },
  },

  // ======================= ТАЙНОЕ =======================
  {
    id: 'hollow_echo', start: 's',
    nodes: {
      s: { speaker: 'narrator', text: 'Чёрная руна в вашей сумке становится ледяной. Из-за Печатной двери доносится шёпот — не ушами, а прямо в голове.', next: 's2' },
      s2: { speaker: 'hollow', text: 'Ты принёс{g:|ла} мне подарок. Осколок моей тени. Держи его ближе к сердцу, и однажды мы поговорим по-настоящему.',
        choices: [
          { text: 'Кто ты?', next: 'who' },
          { text: '(Сжать руну в кулаке и уйти.)', next: 'leave' },
        ] },
      who: { speaker: 'hollow', text: 'Тот, кого вычеркнули. Скоро ты узнаешь. Скоро все узнают.', effects: [{ lore: 'hollow' }], next: 'leave' },
      leave: { speaker: 'narrator', text: 'Шёпот затихает. Руна снова просто камень. Но пальцы долго не согреваются.',
        effects: [{ setFlag: 'rune_echo_heard' }, { corruption: 5 }, { journal: 'У Печатной двери чёрная руна заговорила голосом из-под камня. Бран говорил, что такие вещи лучше уничтожать.' }] },
    },
  },
];
