// Server-side copy for the three interface languages. Only text a user reads
// lives here (design briefs in demo mode, warnings); prompts sent to image
// models stay in English.
//
// Uzbek is Latin script and uses ʻ (U+02BB) in oʻ / gʻ and ʼ (U+02BC) for the
// tutuq belgisi, matching the frontend copy.

export const LOCALES = ['uz', 'ru', 'en']
export const DEFAULT_LOCALE = 'uz'

/** Pick a supported locale from an explicit value, then Accept-Language, then 'uz'. */
export function resolveLocale(value, acceptLanguage) {
  const pick = (v) => {
    const base = String(v || '').trim().toLowerCase().split(/[-_]/)[0]
    return LOCALES.includes(base) ? base : null
  }
  const direct = pick(value)
  if (direct) return direct
  if (typeof acceptLanguage === 'string' && acceptLanguage) {
    const ranked = acceptLanguage
      .split(',')
      .map((part, i) => {
        const [tag, ...params] = part.trim().split(';')
        const q = params.map((p) => /^q=([\d.]+)$/.exec(p.trim())).find(Boolean)
        return { tag, q: q ? Number(q[1]) : 1, i }
      })
      .filter((x) => x.tag && x.q > 0)
      .sort((a, b) => b.q - a.q || a.i - b.i)
    for (const { tag } of ranked) {
      const hit = pick(tag)
      if (hit) return hit
    }
  }
  return DEFAULT_LOCALE
}

/** Language instruction for an LLM prompt. */
export const LANGUAGE_NAME = {
  uz: 'Uzbek (Latin script; use the modifier letter ʻ U+02BB in oʻ and gʻ, never an apostrophe or backtick)',
  ru: 'Russian',
  en: 'English',
}

const NUMBER_LOCALE = { uz: 'uz-Latn-UZ', ru: 'ru-RU', en: 'en-US' }
export function formatNumber(n, locale) {
  try {
    return new Intl.NumberFormat(NUMBER_LOCALE[locale] || 'en-US', { maximumFractionDigits: 2 }).format(n)
  } catch {
    return String(n)
  }
}

const CURRENCY_WORD = { uz: { UZS: 'soʻm' }, ru: { UZS: 'сум', RUB: '₽' }, en: {} }
export function money(n, currency, locale) {
  const code = String(currency || 'USD').toUpperCase()
  return `${formatNumber(Math.round(n), locale)} ${CURRENCY_WORD[locale]?.[code] || code}`
}

const STYLE_NAMES = {
  scandinavian: { uz: 'Skandinav', ru: 'Скандинавский', en: 'Scandinavian' },
  japandi: { uz: 'Japandi', ru: 'Джапанди', en: 'Japandi' },
  minimalist: { uz: 'Minimalizm', ru: 'Минимализм', en: 'Minimalist' },
  midcenturymodern: { uz: 'Mid-century modern', ru: 'Модерн середины века', en: 'Mid-century modern' },
  industrial: { uz: 'Industrial', ru: 'Индустриальный', en: 'Industrial' },
  bohemian: { uz: 'Boho', ru: 'Бохо', en: 'Bohemian' },
  modernluxe: { uz: 'Zamonaviy hashamat', ru: 'Современная роскошь', en: 'Modern luxe' },
  coastal: { uz: 'Dengiz boʻyi', ru: 'Прибрежный', en: 'Coastal' },
}
export function styleName(style, locale) {
  const key = String(style || '').toLowerCase().replace(/[^a-z]/g, '')
  return STYLE_NAMES[key]?.[locale] || String(style || '')
}

const ANGLE_LABELS = {
  front: { uz: 'Old devor', ru: 'Передняя стена', en: 'Front wall' },
  right: { uz: 'Oʻng devor', ru: 'Правая стена', en: 'Right wall' },
  back: { uz: 'Orqa devor', ru: 'Задняя стена', en: 'Back wall' },
  left: { uz: 'Chap devor', ru: 'Левая стена', en: 'Left wall' },
  corner: { uz: 'Keng burchak', ru: 'Широкий угол', en: 'Wide corner' },
  window: { uz: 'Deraza / yorugʻlik', ru: 'Окно / свет', en: 'Window / light' },
  floor: { uz: 'Pol', ru: 'Пол', en: 'Floor' },
  ceiling: { uz: 'Shift', ru: 'Потолок', en: 'Ceiling' },
}
export function angleLabel(angleId, locale, fallback) {
  return ANGLE_LABELS[angleId]?.[locale] || fallback || angleId
}

const T = {
  uz: {
    paletteNames: ['Devorlar', 'Pol', 'Oʻrta ton', 'Tayanch rang', 'Urgʻu rangi'],
    paletteUsage: [
      'Barcha devorlar va shift',
      'Pol qoplamasi va yirik yogʻoch buyumlar',
      'Javonlar, eshiklar, ramkalar, stol oyoqlari',
      'Plintuslar, furnitura, chiroq oyoqlari',
      'Qoplama mato, yostiqchalar, oʻsimliklar',
    ],
    materials: ['Mat boʻyoqli devorlar', 'Moy surtilgan eman', 'Jun bukle', 'Zigʻir mato', 'Qoraytirilgan poʻlat'],
    photo: {
      summary: (s) =>
        `«${s}» uslubidagi yechim xonaning tabiiy yorugʻligini saqlaydi va deraza hamda radiator atrofida quriladi. Iliq neytral devorlar, xonani jamlab turuvchi gilam va kunduzgi yorugʻlikka qaragan qulay oʻtirish joyi.`,
      features: ['Bir devorda katta deraza', 'Orqa devor burchagida eshik', 'Deraza ostida radiator', 'Shift markazida mavjud chiroq oʻrni'],
      lightingNotes: 'Kunduzgi yorugʻlik bir tomondan kirib, polga tushadi. Shift markazida bitta chiroq.',
      lighting: 'Qatlamli yoritish: bitta osma chiroq, kitob oʻqish kreslosi ortida torsher, hamma joyda iliq 2700K.',
      budgetWithin: (total, limit) =>
        `Roʻyxat ${limit} chegarangiz ichida — jami ${total}. Har bir buyum odatiy chakana narx oraligʻining oʻrtasi boʻyicha hisoblangan.`,
      budgetNone: 'Byudjet chegarasi belgilanmagan, shuning uchun har bir buyum odatiy chakana narx oraligʻining oʻrtasi boʻyicha hisoblangan.',
    },
    scene: {
      summary: (s, w, d, n) =>
        n
          ? `${w} × ${d} m xonangiz uchun «${s}» uslubidagi yechim — siz joylashtirgan ${n} ta buyum asosida. Sokin devorlar, mustahkam pol va mebelingizni bir-biriga bogʻlaydigan pardoz.`
          : `${w} × ${d} m xonangiz uchun «${s}» uslubidagi yechim. Hali mebel joylashtirilmagan, shuning uchun sokin devorlar, mustahkam pol va yaxshi yorugʻlikdan boshlaymiz.`,
      materials: ['Mat boʻyoqli devorlar', 'Moy surtilgan eman', 'Zigʻir mato', 'Jun', 'Qoraytirilgan poʻlat'],
      lightingLamps: 'Faqat chiroqlar: iliq 2700K yorugʻlik dogʻlari, tepadan koʻzni qamashtiruvchi nur yoʻq.',
      lightingDay: 'Kunduzgi yorugʻlik, kechqurun esa iliq 2700K osma chiroq va torsher.',
      lightingNotes: (p) => `Yoritish: ${p}.`,
      presets: { morning: 'ertalabki salqin yorugʻlik', afternoon: 'kunduzgi iliq yorugʻlik', evening: 'kechki oltin yorugʻlik', lamps: 'faqat chiroqlar' },
      budgetLimit: (total, limit) => `Joylashtirgan buyumlaringiz jami ${total}, byudjet chegarasi esa ${limit}.`,
      budgetOver: (over) => ` Chegaradan ${over} oshib ketdi.`,
      budgetLeft: (left) => ` Yana ${left} zaxira qoladi.`,
      budgetNone: 'Byudjet chegarasi belgilanmagan; jami summa har bir buyumning katalog narxi boʻyicha hisoblangan.',
      description: (mat, w, d, h) => `Pardozi: ${mat}; oʻlchami taxminan ${w}×${d}×${h} m.`,
      placementCentre: 'Xonaning markazida.',
      placement: (dir) => `Xonaning ${dir} qismida.`,
      dirs: { north: 'shimoliy', south: 'janubiy', east: 'sharqiy', west: 'gʻarbiy', 'north-east': 'shimoli-sharqiy', 'north-west': 'shimoli-gʻarbiy', 'south-east': 'janubi-sharqiy', 'south-west': 'janubi-gʻarbiy' },
      feature: (kind, wall, w) => `${wall} devorda ${kind}, eni ${w} m`,
      kinds: { window: 'deraza', door: 'eshik', radiator: 'radiator' },
      walls: { north: 'Shimoliy', east: 'Sharqiy', south: 'Janubiy', west: 'Gʻarbiy', notchS: 'Ichki burchakdagi janubiy', notchE: 'Ichki burchakdagi sharqiy', partition: 'Ichki' },
    },
    errors: {
      busy: 'Sunʼiy intellekt xizmati hozir band. Bir daqiqadan soʻng qayta urinib koʻring.',
      timeout: 'Sunʼiy intellekt xizmati juda uzoq javob berdi. Qayta urinib koʻring.',
      failed: 'Sunʼiy intellekt xizmati dizayn tayyorlay olmadi. Qayta urinib koʻring.',
      noImages: 'Dizayn tayyor, lekin rasmlar kelmadi. Qayta urinib koʻring.',
    },
  },
  ru: {
    paletteNames: ['Стены', 'Пол', 'Средний тон', 'Опорный цвет', 'Акцент'],
    paletteUsage: [
      'Все стены и потолок',
      'Напольное покрытие и крупные деревянные предметы',
      'Стеллажи, двери, рамы, ножки стола',
      'Плинтусы, фурнитура, стойки светильников',
      'Обивка, подушки, растения',
    ],
    materials: ['Матовая краска для стен', 'Дуб под маслом', 'Шерстяное букле', 'Лён', 'Чернёная сталь'],
    photo: {
      summary: (s) =>
        `Интерьер в стиле «${s}» сохраняет естественный свет комнаты и выстроен вокруг окна и радиатора. Тёплые нейтральные стены, ковёр, который собирает пространство, и удобная зона отдыха, обращённая к дневному свету.`,
      features: ['Одно большое окно на одной из стен', 'Дверь в углу задней стены', 'Радиатор под окном', 'Потолочный светильник по центру'],
      lightingNotes: 'Дневной свет падает с одной стороны и ложится на пол. Один потолочный светильник по центру.',
      lighting: 'Многоуровневый свет: подвесной светильник, торшер за креслом для чтения, тёплые 2700K по всей комнате.',
      budgetWithin: (total, limit) =>
        `Список уложен в ${total} при лимите ${limit}: каждый предмет посчитан по середине обычного розничного диапазона цен.`,
      budgetNone: 'Лимит не задан, поэтому каждый предмет посчитан по середине обычного розничного диапазона цен.',
    },
    scene: {
      summary: (s, w, d, n) =>
        n
          ? `Комната ${w} × ${d} м в стиле «${s}»: основой проекта стала расставленная вами мебель (${n} шт.). Спокойные стены, основательный пол и отделка, которая связывает мебель воедино.`
          : `Комната ${w} × ${d} м в стиле «${s}». Мебель ещё не расставлена, поэтому начинаем со спокойных стен, основательного пола и хорошего света.`,
      materials: ['Матовая краска для стен', 'Дуб под маслом', 'Лён', 'Шерсть', 'Чернёная сталь'],
      lightingLamps: 'Только лампы: тёплые пятна света 2700K, без слепящего верхнего света.',
      lightingDay: 'Днём — естественный свет, вечером — тёплый подвесной светильник 2700K и торшер.',
      lightingNotes: (p) => `Освещение: ${p}.`,
      presets: { morning: 'прохладный утренний свет', afternoon: 'тёплый дневной свет', evening: 'золотистый вечерний свет', lamps: 'только лампы' },
      budgetLimit: (total, limit) => `Расставленная мебель обходится в ${total} при лимите ${limit}.`,
      budgetOver: (over) => ` Это на ${over} больше лимита.`,
      budgetLeft: (left) => ` В запасе остаётся ${left}.`,
      budgetNone: 'Лимит не задан; итог посчитан по каталожной цене каждого предмета.',
      description: (mat, w, d, h) => `Отделка: ${mat}; размер около ${w}×${d}×${h} м.`,
      placementCentre: 'В центре комнаты.',
      placement: (dir) => `В ${dir} части комнаты.`,
      dirs: { north: 'северной', south: 'южной', east: 'восточной', west: 'западной', 'north-east': 'северо-восточной', 'north-west': 'северо-западной', 'south-east': 'юго-восточной', 'south-west': 'юго-западной' },
      feature: (kind, wall, w) => `${kind} на ${wall} стене, ширина ${w} м`,
      kinds: { window: 'Окно', door: 'Дверь', radiator: 'Радиатор' },
      walls: { north: 'северной', east: 'восточной', south: 'южной', west: 'западной', notchS: 'южной (у выступа)', notchE: 'восточной (у выступа)', partition: 'внутренней' },
    },
    errors: {
      busy: 'Сервис ИИ сейчас перегружен. Попробуйте через минуту.',
      timeout: 'Сервис ИИ слишком долго отвечал. Попробуйте ещё раз.',
      failed: 'Сервису ИИ не удалось подготовить дизайн. Попробуйте ещё раз.',
      noImages: 'Дизайн готов, но изображения не пришли. Попробуйте ещё раз.',
    },
  },
  en: {
    paletteNames: ['Walls', 'Floor', 'Mid tone', 'Anchor', 'Accent'],
    paletteUsage: [
      'All walls and ceiling',
      'Flooring and larger timber pieces',
      'Shelving, doors, frames, table legs',
      'Trim, hardware, lighting stems',
      'Upholstery, cushions, plants',
    ],
    materials: ['Matte emulsion walls', 'Oiled oak', 'Wool boucle', 'Linen', 'Blackened steel'],
    photo: {
      summary: (s) =>
        `A ${s} treatment that keeps the room's existing light and works around the window and radiator. Warm neutral walls, a grounding rug, and one strong seating gesture facing the daylight.`,
      features: ['Single large window on one wall', 'Door in the corner of the back wall', 'Radiator beneath the window', 'Existing ceiling rose, centred'],
      lightingNotes: 'Daylight enters from one side and falls across the floor. One central ceiling fitting.',
      lighting: 'Layered: one pendant, one floor lamp behind the reading chair, warm 2700K throughout.',
      budgetWithin: (total, limit) =>
        `Kept the list to ${total} against your ${limit} ceiling by pricing every piece at the midpoint of its normal retail range.`,
      budgetNone: 'No ceiling set, so every piece is priced at the midpoint of its normal retail range.',
    },
    scene: {
      summary: (s, w, d, n) =>
        n
          ? `A ${s} take on your ${w} × ${d} m room, built around the ${n} piece${n === 1 ? '' : 's'} you placed. Calm walls, a grounded floor, and finishes that tie your furniture together.`
          : `A ${s} take on your ${w} × ${d} m room. Nothing is placed yet, so this starts from calm walls, a grounded floor and good light.`,
      materials: ['Matte emulsion walls', 'Oiled oak', 'Linen', 'Wool', 'Blackened steel'],
      lightingLamps: 'Lamps only: warm 2700K pools of light, no overhead glare.',
      lightingDay: 'Layered daylight with a warm 2700K pendant and a floor lamp for the evening.',
      lightingNotes: (p) => `Lighting: ${p}.`,
      presets: { morning: 'cool morning daylight', afternoon: 'warm afternoon daylight', evening: 'golden evening light', lamps: 'lamps only' },
      budgetLimit: (total, limit) => `Your placed pieces come to ${total} against a ${limit} ceiling.`,
      budgetOver: (over) => ` That is ${over} over.`,
      budgetLeft: (left) => ` ${left} still to spare.`,
      budgetNone: 'No ceiling set; totals use the catalogue price of each placed piece.',
      description: (mat, w, d, h) => `${mat.replace(/^./, (c) => c.toUpperCase())} finish, about ${w}×${d}×${h} m.`,
      placementCentre: 'In the centre of the room.',
      placement: (dir) => `Towards the ${dir} of the room.`,
      dirs: { north: 'north', south: 'south', east: 'east', west: 'west', 'north-east': 'north-east', 'north-west': 'north-west', 'south-east': 'south-east', 'south-west': 'south-west' },
      feature: (kind, wall, w) => `${kind} on the ${wall} wall, ${w} m wide`,
      kinds: { window: 'Window', door: 'Door', radiator: 'Radiator' },
      walls: { north: 'north', east: 'east', south: 'south', west: 'west', notchS: 'inner south', notchE: 'inner east', partition: 'partition' },
    },
    errors: {
      busy: 'The AI service is busy right now. Try again in a minute.',
      timeout: 'The AI service took too long to answer. Try again.',
      failed: 'The AI service failed to produce a design. Try again.',
      noImages: 'The design was written but no images came back.',
    },
  },
}

export function t(locale) {
  return T[locale] || T[DEFAULT_LOCALE]
}

/** Builder catalogue ids → product names. */
const PIECES = {
  sofa3: { uz: 'Uch oʻrinli divan', ru: 'Трёхместный диван', en: 'Three-seat sofa' },
  sofa: { uz: 'Divan', ru: 'Диван', en: 'Sofa' },
  armchair: { uz: 'Kreslo', ru: 'Кресло', en: 'Armchair' },
  chair: { uz: 'Stul', ru: 'Стул', en: 'Chair' },
  coffeeTable: { uz: 'Jurnal stoli', ru: 'Журнальный столик', en: 'Coffee table' },
  diningTable: { uz: 'Ovqatlanish stoli', ru: 'Обеденный стол', en: 'Dining table' },
  table: { uz: 'Stol', ru: 'Стол', en: 'Table' },
  desk: { uz: 'Yozuv stoli', ru: 'Письменный стол', en: 'Desk' },
  wardrobe: { uz: 'Kiyim shkafi', ru: 'Платяной шкаф', en: 'Wardrobe' },
  shelf: { uz: 'Kitob javoni', ru: 'Стеллаж', en: 'Bookshelf' },
  sideboard: { uz: 'Komod', ru: 'Комод', en: 'Sideboard' },
  bed: { uz: 'Karavot', ru: 'Кровать', en: 'Bed' },
  rug: { uz: 'Gilam', ru: 'Ковёр', en: 'Rug' },
  plant: { uz: 'Xona oʻsimligi', ru: 'Комнатное растение', en: 'House plant' },
  floorLamp: { uz: 'Torsher', ru: 'Торшер', en: 'Floor lamp' },
  lamp: { uz: 'Chiroq', ru: 'Светильник', en: 'Lamp' },
}
export function pieceName(catalogId, locale) {
  const hit = PIECES[catalogId]?.[locale]
  if (hit) return hit
  return String(catalogId)
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())
}

const MATERIALS = {
  oak: { uz: 'eman', ru: 'дуб', en: 'oak' },
  walnut: { uz: 'yongʻoq', ru: 'орех', en: 'walnut' },
  ink: { uz: 'toʻq siyohrang', ru: 'чернильный тон', en: 'ink' },
  linen: { uz: 'zigʻir', ru: 'лён', en: 'linen' },
  sand: { uz: 'qum rang', ru: 'песочный тон', en: 'sand' },
  clay: { uz: 'gil rang', ru: 'глиняный тон', en: 'clay' },
  olive: { uz: 'zaytun rang', ru: 'оливковый тон', en: 'olive' },
  terracotta: { uz: 'terrakota', ru: 'терракота', en: 'terracotta' },
  brass: { uz: 'latun', ru: 'латунь', en: 'brass' },
  indigo: { uz: 'indigo', ru: 'индиго', en: 'indigo' },
}
export function materialName(key, locale) {
  return MATERIALS[key]?.[locale] || String(key || '').toLowerCase()
}

/** Photo-flow demo catalogue copy, keyed like demo.js CATALOGUE. */
export const CATALOGUE_COPY = {
  sofa: {
    name: { uz: 'Uch oʻrinli divan', ru: 'Трёхместный диван', en: 'Three-seat sofa' },
    description: {
      uz: 'Chidamli toʻqima matoli, chuqur oʻtirgichli uch oʻrinli divan.',
      ru: 'Глубокий трёхместный диван в износостойкой рогожке.',
      en: 'Deep-seated three-seater in a durable woven fabric.',
    },
    placement: {
      uz: 'Eng uzun boʻsh devor boʻylab, xona markaziga qaratib.',
      ru: 'Вдоль самой длинной свободной стены, лицом к центру комнаты.',
      en: 'Along the longest clear wall, facing into the room.',
    },
  },
  chair: {
    name: { uz: 'Dam olish kreslosi', ru: 'Кресло для отдыха', en: 'Lounge chair' },
    description: {
      uz: 'Kitob oʻqish uchun yumshoq oʻrindiqli past kreslo.',
      ru: 'Низкое кресло с мягким сиденьем для чтения.',
      en: 'Low lounge chair with a padded seat for reading.',
    },
    placement: {
      uz: 'Deraza yonidagi burchakka biroz qiya qilib.',
      ru: 'Под углом в углу у окна.',
      en: 'Angled into the corner beside the window.',
    },
  },
  coffeeTable: {
    name: { uz: 'Jurnal stoli', ru: 'Журнальный столик', en: 'Coffee table' },
    description: {
      uz: 'Ingichka oyoqli, yaxlit yogʻochdan yasalgan past stol.',
      ru: 'Столешница из массива на тонких ножках.',
      en: 'Solid-wood top on slim legs.',
    },
    placement: {
      uz: 'Gilam markazida, divandan 45 sm uzoqlikda.',
      ru: 'По центру ковра, в 45 см от дивана.',
      en: 'Centred on the rug, 45cm from the sofa.',
    },
  },
  shelf: {
    name: { uz: 'Ochiq javon', ru: 'Открытый стеллаж', en: 'Open shelving unit' },
    description: {
      uz: 'Kitoblar, sopol buyumlar va savatlar uchun ochiq javon.',
      ru: 'Открытые полки для книг, керамики и корзин.',
      en: 'Open shelves for books, ceramics and baskets.',
    },
    placement: {
      uz: 'Orqa devorga, eshikning yoniga.',
      ru: 'У задней стены, рядом с дверью.',
      en: 'Against the back wall, beside the door.',
    },
  },
  rug: {
    name: { uz: 'Jun gilam 200×300', ru: 'Шерстяной ковёр 200×300', en: 'Wool area rug 200×300' },
    description: {
      uz: 'Oʻtirish zonasini jamlab turuvchi tekis toʻqilgan jun gilam.',
      ru: 'Безворсовая шерсть, которая собирает зону отдыха.',
      en: 'Flat-woven wool that anchors the seating area.',
    },
    placement: {
      uz: 'Divanning old oyoqlari va jurnal stoli ostida.',
      ru: 'Под передними ножками дивана и журнальным столиком.',
      en: 'Under the front legs of the sofa and the coffee table.',
    },
  },
  floorLamp: {
    name: { uz: 'Torsher', ru: 'Торшер', en: 'Floor lamp' },
    description: {
      uz: 'Yumshoq, iliq yorugʻlik beruvchi mato abajurli torsher.',
      ru: 'Тканевый абажур даёт мягкое тёплое пятно света.',
      en: 'Fabric shade for a soft, warm pool of light.',
    },
    placement: { uz: 'Dam olish kreslosi ortida.', ru: 'За креслом для отдыха.', en: 'Behind the lounge chair.' },
  },
  pendant: {
    name: { uz: 'Osma shift chirogʻi', ru: 'Подвесной светильник', en: 'Ceiling pendant' },
    description: {
      uz: 'Yorugʻlikni xona boʻylab tekis taratuvchi keng abajur.',
      ru: 'Широкий абажур равномерно рассеивает свет по комнате.',
      en: 'Wide shade that spreads light evenly across the room.',
    },
    placement: {
      uz: 'Markazdagi mavjud chiroq oʻrniga.',
      ru: 'Вместо существующего светильника, по центру.',
      en: 'Replaces the existing fitting, centred.',
    },
  },
  curtains: {
    name: { uz: 'Zigʻir pardalar', ru: 'Льняные шторы', en: 'Linen curtains' },
    description: {
      uz: 'Kunduzgi yorugʻlikni toʻsmasdan yumshatadigan yuvilgan zigʻir.',
      ru: 'Стираный лён, который смягчает дневной свет, но не перекрывает его.',
      en: 'Washed linen that filters daylight without blocking it.',
    },
    placement: {
      uz: 'Polgacha uzun, deraza romidan 15 sm yuqoriga osilgan.',
      ru: 'В пол, подвешены на 15 см выше оконной рамы.',
      en: 'Floor length, hung 15cm above the window frame.',
    },
  },
  prints: {
    name: { uz: 'Ramkali rasmlar toʻplami', ru: 'Набор постеров в рамах', en: 'Framed print set' },
    description: {
      uz: 'Palitraning oʻrta tonidagi ramkalarda uchta rasm.',
      ru: 'Три постера в рамах среднего тона палитры.',
      en: "Three prints in frames in the palette's mid tone.",
    },
    placement: {
      uz: 'Boʻsh devorlarda, koʻz balandligida.',
      ru: 'На свободных стенах, на уровне глаз.',
      en: 'On the clear walls, at eye level.',
    },
  },
  plant: {
    name: { uz: 'Tuvakdagi katta oʻsimlik', ru: 'Крупное растение в горшке', en: 'Large potted plant' },
    description: {
      uz: 'Mat sopol tuvakdagi parvarishi oson koʻkat.',
      ru: 'Неприхотливая зелень в матовом керамическом горшке.',
      en: 'Easy-care greenery in a matte ceramic pot.',
    },
    placement: { uz: 'Derazaning ikki yonida.', ru: 'По обе стороны окна.', en: 'Flanking the window.' },
  },
  paint: {
    name: { uz: 'Devor boʻyogʻi va pardozlash', ru: 'Краска для стен и отделка', en: 'Wall paint + finishes' },
    description: {
      uz: 'Devor rangidagi yuviladigan mat boʻyoq, plintuslar uchun ham.',
      ru: 'Моющаяся матовая краска в цвет стен, в том числе для плинтусов.',
      en: 'Washable matte paint in the wall colour, plus trim.',
    },
    placement: { uz: 'Toʻrtala devor va plintuslar.', ru: 'Все четыре стены и плинтусы.', en: 'All four walls plus trim.' },
  },
}
