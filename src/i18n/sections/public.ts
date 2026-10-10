import type { Bundle } from './index'

/** Copy for the standalone public pages: contact, gallery, styles, about, page intros and for-business. */
const PUBLIC2: Bundle = {
  uz: {
    pieces: {
      armchair: 'Kreslo',
      coffeeTable: 'Past stol',
      diningTable: 'Ovqat stoli',
      sideboard: 'Komod',
      shelf: 'Javon',
      planter: 'Fikus',
      sofa: 'Divan',
      bed: 'Karavot',
    },
    drag: 'Aylantirish uchun torting',
    modelled: '3D modelda',
    about: {
      titleEm: 'oldin',
      plinthTag: 'FS—01',
      manifestoLabel: 'Manifest',
      valuesLabel: 'Tamoyillar',
      valuesTitle: 'Biz nimaga',
      valuesTitleEm: 'ishonamiz',
      values: [
        { title: 'Koʻrgazma zali emas — sizning xonangiz', body: 'Har bir taklif sizning devorlaringiz, yorugʻingiz va oʻlchamlaringizdan boshlanadi. Katalogdagi chiroyli surat emas.' },
        { title: 'Haqiqiy oʻlcham, haqiqiy narx', body: 'Xonaga qoʻyilgan har bir buyum santimetrigacha va soʻmigacha toʻgʻri — sotib olishdan oldin hamma narsa aniq.' },
        { title: 'Sunʼiy intellekt haqida halol', body: 'AI chizadi, lekin qaror sizniki. Natija tavsiyaviy ekanini doim ochiq aytamiz.' },
        { title: 'Mahalliy, oʻzbek tilida birinchi', body: 'Toshkent doʻkonlari, soʻmdagi narxlar va oʻzbek tili — keyin rus va ingliz tillari.' },
      ],
      metricsTitle: 'Bugun qayerdamiz',
      studioLabel: 'Studiya',
      studioTitle: 'Toshkentdagi kichik jamoa.',
      studioBody: 'Dizaynerlar, muhandislar va koʻp xonalarni jihozlagan odamlar. Tez orada bu yerda oʻzimizni toʻliqroq tanishtiramiz.',
      roles: [
        { title: 'Interyer dizayni', body: 'Uslublar, ranglar va materiallar — har bir taklif ortidagi did.' },
        { title: '3D va muhandislik', body: 'Xonani suratdan qayta qurish, mebelni haqiqiy oʻlchamda modellash.' },
        { title: 'Doʻkonlar bilan hamkorlik', body: 'Katalog, narxlar va mavjudlik — mahalliy mebel doʻkonlari bilan birga.' },
      ],
      joinTitle: 'Biz bilan ishlamoqchimisiz?',
      joinBody: 'Dizayner, 3D rassom yoki mebel doʻkoni boʻlsangiz — yozing.',
      joinCta: 'Bizga yozing',
      ctaTitle: 'Bitta xonadan',
      ctaTitleEm: 'boshlang.',
      ctaPrimary: 'Xonani suratga olish',
      ctaSecondary: 'Katalogni koʻrish',
    },
    styles: {
      index: 'Mundarija',
      palette: 'Palitra',
      materials: 'Materiallar',
      mood: 'Kayfiyat',
      piece: 'Asosiy buyum',
      items: {
        scandinavian: { mood: 'Yorugʻ, yumshoq, ortiqchasiz', materials: ['Och eman', 'Junli bukle', 'Zigʻir'] },
        japandi: { mood: 'Past, osoyishta, qoʻl mehnati', materials: ['Shumtol', 'Washi qogʻozi', 'Sopol'] },
        minimalist: { mood: 'Bitta ishora, koʻp havo', materials: ['Lak', 'Poʻlat', 'Gips'] },
        midcentury: { mood: 'Iliq, grafik, quvnoq', materials: ['Yongʻoq', 'Jez', 'Tvid'] },
        industrial: { mood: 'Xom, samimiy, mustahkam', materials: ['Qoraytirilgan poʻlat', 'Beton', 'Teri'] },
        bohemian: { mood: 'Qatlamli, jonli, yashil', materials: ['Rotang', 'Jut', 'Terrakota'] },
        luxe: { mood: 'Chuqur, salmoqli, sayqallangan', materials: ['Marmar', 'Baxmal', 'Jez'] },
        coastal: { mood: 'Havodor, yorugʻ, dengiz shabadasi', materials: ['Oqartirilgan eman', 'Zigʻir', 'Dengiz shishasi'] },
      },
      ctaTitle: 'Qaysi biri sizniki ekanini bilmayapsizmi?',
      ctaBody: 'Xonani suratga oling — bir nechta uslubni yonma-yon solishtiring.',
      ctaButton: 'Xonani suratga olish',
    },
    contact: {
      studioLabel: 'Studiya',
      studio: 'Toshkent, Oʻzbekiston',
      hoursLabel: 'Ish vaqti',
      hours: 'Du–Ju, 10:00–19:00',
      faqTitle: 'Tezkor javoblar',
      faqBody: 'Narxlar, AI va xavfsizlik haqidagi koʻp savollarga allaqachon javob berganmiz.',
      faqLink: 'Savollarni oʻqish',
      formTitle: 'Xabar yozing',
      rateLimited: 'Juda koʻp xabar yuborildi. Bir soatdan keyin qayta urinib koʻring yoki Telegramʼda yozing.',
      counter: '{{count}} / 4000',
      required: 'majburiy',
    },
    business: {
      plinthTag: 'Doʻkon katalogi',
      points: [
        { title: 'Haqiqiy oʻlchamda', body: 'Mahsulotingiz xaridor xonasiga santimetrigacha toʻgʻri tushadi.' },
        { title: 'Soʻmdagi narx bilan', body: 'Narx va mavjudlik loyihaning oʻzida — xaridor qayerdan olishni biladi.' },
        { title: 'Toʻgʻridan-toʻgʻri murojaatlar', body: 'Qiziqqan xaridorlar sizga oʻzi yozadi, vositachisiz.' },
      ],
      ctaTitle: 'Doʻkoningizni katalogga qoʻshamizmi?',
    },
    gallery: {
      count: '{{count}} ta xona',
      ctaTitle: 'Navbatdagi xona — sizniki.',
      ctaButton: 'Xonani suratga olish',
    },
    auth: {
      quote: 'Eshigingizga kelishidan oldin uni xonangizda koʻring.',
      caption: 'Kreslo · 84 × 86 × 80 sm',
      captionSignup: 'Divan · 220 × 94 × 84 sm',
    },
    placeholder: {
      lead: 'Bu sahifa ustida ishlayapmiz. Hozircha bosh sahifa yoki katalogdan davom eting.',
      catalog: 'Katalogni ochish',
    },
  },

  ru: {
    pieces: {
      armchair: 'Кресло',
      coffeeTable: 'Низкий столик',
      diningTable: 'Обеденный стол',
      sideboard: 'Комод',
      shelf: 'Стеллаж',
      planter: 'Фикус',
      sofa: 'Диван',
      bed: 'Кровать',
    },
    drag: 'Потяните, чтобы повернуть',
    modelled: 'Модель в 3D',
    about: {
      titleEm: 'до',
      plinthTag: 'FS—01',
      manifestoLabel: 'Манифест',
      valuesLabel: 'Принципы',
      valuesTitle: 'Во что мы',
      valuesTitleEm: 'верим',
      values: [
        { title: 'Не шоурум — ваша комната', body: 'Каждое предложение начинается с ваших стен, вашего света и ваших размеров. А не с красивого фото из каталога.' },
        { title: 'Реальные размеры, реальные цены', body: 'Каждый предмет в комнате точен до сантиметра и до сума — всё ясно ещё до покупки.' },
        { title: 'Честно про ИИ', body: 'ИИ рисует, решаете вы. Мы всегда прямо говорим, что результат — это рекомендация.' },
        { title: 'Локально и по-узбекски — в первую очередь', body: 'Магазины Ташкента, цены в сумах и узбекский язык — затем русский и английский.' },
      ],
      metricsTitle: 'Где мы сейчас',
      studioLabel: 'Студия',
      studioTitle: 'Небольшая команда в Ташкенте.',
      studioBody: 'Дизайнеры, инженеры и люди, которые обставили немало комнат. Скоро мы представимся здесь подробнее.',
      roles: [
        { title: 'Дизайн интерьера', body: 'Стили, цвета и материалы — вкус за каждым предложением.' },
        { title: '3D и инженерия', body: 'Восстановление комнаты по фото и мебель в реальном масштабе.' },
        { title: 'Партнёрство с магазинами', body: 'Каталог, цены и наличие — вместе с местными мебельными магазинами.' },
      ],
      joinTitle: 'Хотите работать с нами?',
      joinBody: 'Если вы дизайнер, 3D-художник или мебельный магазин — напишите.',
      joinCta: 'Написать нам',
      ctaTitle: 'Начните с одной',
      ctaTitleEm: 'комнаты.',
      ctaPrimary: 'Сфотографировать комнату',
      ctaSecondary: 'Открыть каталог',
    },
    styles: {
      index: 'Содержание',
      palette: 'Палитра',
      materials: 'Материалы',
      mood: 'Настроение',
      piece: 'Ключевой предмет',
      items: {
        scandinavian: { mood: 'Светло, мягко, без лишнего', materials: ['Светлый дуб', 'Шерстяное букле', 'Лён'] },
        japandi: { mood: 'Низко, спокойно, ручная работа', materials: ['Ясень', 'Бумага васи', 'Керамика'] },
        minimalist: { mood: 'Один жест, много воздуха', materials: ['Лак', 'Сталь', 'Штукатурка'] },
        midcentury: { mood: 'Тепло, графично, оптимистично', materials: ['Орех', 'Латунь', 'Твид'] },
        industrial: { mood: 'Грубо, честно, прочно', materials: ['Чернёная сталь', 'Бетон', 'Кожа'] },
        bohemian: { mood: 'Многослойно, обжито, зелено', materials: ['Ротанг', 'Джут', 'Терракота'] },
        luxe: { mood: 'Глубоко, весомо, с блеском', materials: ['Мрамор', 'Бархат', 'Латунь'] },
        coastal: { mood: 'Воздушно, светло, морской бриз', materials: ['Белёный дуб', 'Лён', 'Морское стекло'] },
      },
      ctaTitle: 'Не знаете, какой из них ваш?',
      ctaBody: 'Сфотографируйте комнату и сравните несколько стилей рядом.',
      ctaButton: 'Сфотографировать комнату',
    },
    contact: {
      studioLabel: 'Студия',
      studio: 'Ташкент, Узбекистан',
      hoursLabel: 'Часы работы',
      hours: 'Пн–Пт, 10:00–19:00',
      faqTitle: 'Быстрые ответы',
      faqBody: 'На многие вопросы о ценах, ИИ и безопасности мы уже ответили.',
      faqLink: 'Читать вопросы',
      formTitle: 'Напишите сообщение',
      rateLimited: 'Слишком много сообщений. Попробуйте через час или напишите в Telegram.',
      counter: '{{count}} / 4000',
      required: 'обязательно',
    },
    business: {
      plinthTag: 'Каталог магазина',
      points: [
        { title: 'В реальном размере', body: 'Ваш товар встаёт в комнату покупателя с точностью до сантиметра.' },
        { title: 'С ценой в сумах', body: 'Цена и наличие прямо в проекте — покупатель знает, где купить.' },
        { title: 'Прямые обращения', body: 'Заинтересованные покупатели пишут вам сами, без посредников.' },
      ],
      ctaTitle: 'Добавим ваш магазин в каталог?',
    },
    gallery: {
      count: 'Комнат: {{count}}',
      ctaTitle: 'Следующая комната — ваша.',
      ctaButton: 'Сфотографировать комнату',
    },
    auth: {
      quote: 'Увидьте её в своей комнате до того, как её привезут.',
      caption: 'Кресло · 84 × 86 × 80 см',
      captionSignup: 'Диван · 220 × 94 × 84 см',
    },
    placeholder: {
      lead: 'Мы работаем над этой страницей. А пока продолжите с главной или из каталога.',
      catalog: 'Открыть каталог',
    },
  },

  en: {
    pieces: {
      armchair: 'Lounge chair',
      coffeeTable: 'Low table',
      diningTable: 'Dining table',
      sideboard: 'Sideboard',
      shelf: 'Shelving',
      planter: 'Fiddle-leaf fig',
      sofa: 'Sofa',
      bed: 'Bed',
    },
    drag: 'Drag to turn',
    modelled: 'Modelled in 3D',
    about: {
      titleEm: 'before',
      plinthTag: 'FS—01',
      manifestoLabel: 'Manifesto',
      valuesLabel: 'Principles',
      valuesTitle: 'What we',
      valuesTitleEm: 'believe',
      values: [
        { title: 'Your room, not a showroom', body: 'Every proposal starts from your walls, your light and your measurements — never from a pretty catalogue photograph.' },
        { title: 'Real sizes, real prices', body: 'Everything placed in the room is right to the centimetre and to the som, so nothing is a surprise after you buy.' },
        { title: 'Honest about AI', body: 'The AI draws; you decide. We always say plainly that a result is a suggestion, not a promise.' },
        { title: 'Local, and Uzbek first', body: 'Tashkent stores, prices in som and the Uzbek language first — then Russian and English.' },
      ],
      metricsTitle: 'Where we are today',
      studioLabel: 'Studio',
      studioTitle: 'A small team in Tashkent.',
      studioBody: 'Designers, engineers and people who have furnished a lot of rooms. We will introduce ourselves properly here soon.',
      roles: [
        { title: 'Interior design', body: 'Styles, colour and material — the taste behind every proposal.' },
        { title: '3D and engineering', body: 'Rebuilding a room from photos and modelling furniture at true scale.' },
        { title: 'Store partnerships', body: 'Catalogue, prices and stock — together with local furniture stores.' },
      ],
      joinTitle: 'Want to work with us?',
      joinBody: 'If you are a designer, a 3D artist or a furniture store — write to us.',
      joinCta: 'Write to us',
      ctaTitle: 'Start with one',
      ctaTitleEm: 'room.',
      ctaPrimary: 'Photograph a room',
      ctaSecondary: 'Browse the catalog',
    },
    styles: {
      index: 'Index',
      palette: 'Palette',
      materials: 'Materials',
      mood: 'Mood',
      piece: 'Signature piece',
      items: {
        scandinavian: { mood: 'Light, soft, uncluttered', materials: ['Pale oak', 'Wool bouclé', 'Linen'] },
        japandi: { mood: 'Low, calm, handmade', materials: ['Ash', 'Washi paper', 'Stoneware'] },
        minimalist: { mood: 'One gesture, a lot of air', materials: ['Lacquer', 'Steel', 'Plaster'] },
        midcentury: { mood: 'Warm, graphic, optimistic', materials: ['Walnut', 'Brass', 'Tweed'] },
        industrial: { mood: 'Raw, honest, sturdy', materials: ['Blackened steel', 'Concrete', 'Leather'] },
        bohemian: { mood: 'Layered, lived-in, green', materials: ['Rattan', 'Jute', 'Terracotta'] },
        luxe: { mood: 'Deep, weighty, polished', materials: ['Marble', 'Velvet', 'Brass'] },
        coastal: { mood: 'Airy, bright, sea breeze', materials: ['Bleached oak', 'Linen', 'Sea glass'] },
      },
      ctaTitle: 'Not sure which one is yours?',
      ctaBody: 'Photograph your room and compare a few styles side by side.',
      ctaButton: 'Photograph a room',
    },
    contact: {
      studioLabel: 'Studio',
      studio: 'Tashkent, Uzbekistan',
      hoursLabel: 'Hours',
      hours: 'Mon–Fri, 10:00–19:00',
      faqTitle: 'Quick answers',
      faqBody: 'Many questions about pricing, AI and privacy are already answered.',
      faqLink: 'Read the FAQ',
      formTitle: 'Write a message',
      rateLimited: 'Too many messages. Try again in an hour, or write to us on Telegram.',
      counter: '{{count}} / 4000',
      required: 'required',
    },
    business: {
      plinthTag: 'Store catalogue',
      points: [
        { title: 'At true size', body: 'Your product lands in the buyer’s room accurate to the centimetre.' },
        { title: 'With the price in som', body: 'Price and stock sit inside the project — the buyer knows where to get it.' },
        { title: 'Direct enquiries', body: 'Interested buyers write to you themselves, with no middleman.' },
      ],
      ctaTitle: 'Shall we add your store to the catalogue?',
    },
    gallery: {
      count: '{{count}} rooms',
      ctaTitle: 'The next room is yours.',
      ctaButton: 'Photograph a room',
    },
    auth: {
      quote: 'See it in your room before it arrives at your door.',
      caption: 'Lounge chair · 84 × 86 × 80 cm',
      captionSignup: 'Sofa · 220 × 94 × 84 cm',
    },
    placeholder: {
      lead: 'We are still working on this page. For now, carry on from the home page or the catalogue.',
      catalog: 'Open the catalogue',
    },
  },
}

const bundle: Bundle = {
  uz: {
    contact: {
      title: 'Savolingiz bormi? Yozing.',
      lead: 'Loyiha, hamkorlik yoki do‘koningizni katalogga qo‘shish haqida — xabaringizni o‘qiymiz va javob beramiz.',
      reply: 'Odatda bir ish kuni ichida',
      submit: 'Xabarni yuborish',
      sentLabel: 'Yuborildi',
      sentTitle: 'Xabaringiz bizga yetib keldi.',
      sentBody: 'Ko‘rsatgan pochtangizga javob yozamiz. Rahmat.',
      again: 'Yana xabar yozish',
      fields: {
        name: 'Ismingiz',
        email: 'Elektron pochta',
        message: 'Xabar',
        messagePlaceholder: 'Nima haqida gaplashamiz?',
      },
      errors: {
        email: 'Pochta manzili to‘g‘ri emas.',
        message: 'Kamida bir necha jumla yozing.',
        server: 'Xabarni yuborib bo‘lmadi. Qayta urinib ko‘ring.',
      },
      channels: {
        title: 'Toʻgʻridan-toʻgʻri bogʻlanish',
        telegram: 'Telegram',
        phone: 'Telefon',
        email: 'Elektron pochta',
      },
      topic: {
        label: 'Mavzu',
        general: 'Umumiy savol',
        business: 'Biznes va hamkorlik',
        pricing: 'Narxlar',
        studio: 'Studio tarifi',
      },
      sent: {
        title: 'Xabaringiz bizga yetib keldi.',
      },
      prefill: {
        product: 'Mahsulot: {{product}}',
        store: 'Doʻkon: {{store}}',
      },
    },
    gallery: {
      title: 'Bir xil xonalar, boshqacha hayot.',
      lead: 'Har bir juftlik — bitta haqiqiy xona: chapda hozirgi holati, o‘ngda taklif. Ajratgichni suring.',
      all: 'Hammasi',
      note: 'Bu sahifadagi tasvirlar chizma uslubida ko‘rsatilgan: loyihada hali haqiqiy suratlar yo‘q. Birinchi real loyihalar tayyor bo‘lishi bilan ular shu joyga tushadi.',
      rooms: {
        living: 'Mehmonxona',
        bedroom: 'Yotoqxona',
        kitchen: 'Oshxona',
        office: 'Ish xonasi',
      },
    },
    stylesPage: {
      title: 'Sakkizta uslub. Bittasi sizniki.',
      lead: 'Har bir uslub — rang, material va yorug‘lik haqidagi qaror. Xonangiz shu qaror bo‘yicha qayta chiziladi.',
      pick: 'Shu uslubda boshlash',
    },
    about: {
      title: 'Xonani sotib olishdan oldin ko‘rish kerak.',
      lead: 'FrameSpace Toshkentda qurilmoqda. Maqsad oddiy: odam divan sotib olishdan oldin uning o‘z xonasida qanday turishini ko‘rsin.',
      body: 'Ta’mir — qimmat va qaytarib bo‘lmaydigan qaror. Odamlar katalogdagi suratga qarab tanlaydi, keyin uyga kelganda o‘lcham ham, rang ham, yorug‘lik ham boshqacha chiqadi. Biz shu bo‘shliqni yopamiz: sizning o‘z xonangiz, sizning byudjetingiz, sotib olishdan oldin.',
      metricsLabel: 'Bugungi holat',
      metrics: {
        angles: 'Har bir xona uchun burchaklar',
        languages: 'Tillar',
        minutes: 'Daqiqada natija',
      },
    },
    pages: {
      howItWorks: {
        eyebrow: 'Qanday ishlaydi',
        title: 'Suratdan tayyor xonagacha — uch qadam.',
        lead: 'Xonani suratga olasiz, uslub va byudjetni tanlaysiz, natijani oʻz xonangizda koʻrasiz.',
      },
      pricing: {
        eyebrow: 'Narxlar',
        title: 'Bepul boshlang. Kerak boʻlganda kengaytiring.',
        lead: 'Birinchi xona bepul. Koʻproq loyiha kerak boʻlsa — Pro yoki Studio.',
      },
      faq: {
        eyebrow: 'Savollar',
        title: 'Koʻp beriladigan savollar',
        lead: 'Javob topilmadimi? Bizga yozing — odatda bir ish kuni ichida javob beramiz.',
      },
    },
    forBusinessPage: {
      eyebrow: 'Biznes uchun',
      title: 'Mebelingiz xaridorning oʻz xonasida.',
      lead: 'Doʻkoningiz mahsulotlari FrameSpace loyihalarida haqiqiy oʻlcham va narx bilan koʻrinadi — xaridor sotib olishdan oldin ishonch hosil qiladi.',
      cta: 'Biz bilan bogʻlaning',
      seoTitle: 'Biznes uchun — FrameSpace',
      seoDescription: 'Mebellaringizni xaridorning oʻz xonasida koʻrsating. FrameSpace katalogiga doʻkoningizni qoʻshing.',
    },
    legal: {
      "eyebrow": "Huquqiy",
      "updated": "Oxirgi yangilanish: 2026-yil 1-oktabr",
      "toc": "Mundarija",
      "contactCta": "Savol qoldimi? Bizga yozing",
      "terms": {
        "title": "Foydalanish shartlari",
        "lead": "FrameSpace’dan foydalanish qoidalari — qisqa va tushunarli tilda.",
        "sections": [
          {
            "h": "Xizmat haqida",
            "p": "FrameSpace xonangiz suratlari asosida interyer loyihasi va 3D koʻrinishini tayyorlaydi. Natijalar tavsiyaviy: mebel sotib olishdan oldin oʻlchamlarni oʻzingiz tekshiring."
          },
          {
            "h": "Hisob",
            "p": "Hisob ochishda toʻgʻri maʼlumot kiriting va parolingizni boshqalarga bermang. Hisobingizdagi harakatlar uchun oʻzingiz javobgarsiz."
          },
          {
            "h": "Kontent va huquqlar",
            "p": "Yuklagan suratlaringiz sizga tegishli boʻlib qoladi. Ularni faqat loyihangizni tayyorlash uchun ishlatamiz. Yaratilgan renderlardan shaxsiy va tijoriy maqsadda foydalanishingiz mumkin."
          },
          {
            "h": "Toʻlovlar",
            "p": "Pullik tariflar oldindan koʻrsatilgan narxda amal qiladi. Obunani istalgan vaqtda bekor qilishingiz mumkin — joriy davr oxirigacha xizmat ishlayveradi."
          },
          {
            "h": "Javobgarlik",
            "p": "Xizmatni uzluksiz ishlatishga harakat qilamiz, lekin uchinchi tomon doʻkonlaridagi narx va mavjudlik uchun javob bermaymiz."
          },
          {
            "h": "Oʻzgarishlar",
            "p": "Shartlar oʻzgarsa, bu sahifani yangilaymiz va muhim oʻzgarishlar haqida pochta orqali xabar beramiz."
          }
        ]
      },
      "privacy": {
        "title": "Maxfiylik siyosati",
        "lead": "Qanday maʼlumot yigʻamiz, nima uchun va uni qanday himoya qilamiz.",
        "updated": "Oxirgi yangilanish: 2026-yil 11-oktabr",
        "sections": [
          {
            "h": "Yigʻiladigan maʼlumotlar",
            "p": "Hisob ochganingizda ismingiz va elektron pochtangiz, parolingizning hash koʻrinishi, kirish sessiyalaringiz (brauzer nomi bilan), bugun nechta dizayn yaratganingiz hisobi va aloqa formasi orqali yuborgan xabarlaringiz. Ilova xatoga uchrasa, bizga texnik xato hisoboti keladi (xato matni va sahifa manzili — surat yoki shaxsiy maʼlumotsiz). Hozircha toʻlov qabul qilmaymiz, shuning uchun karta maʼlumotlari bizda yoʻq."
          },
          {
            "h": "Xona suratlari",
            "p": "Yaratish tugmasini bosganingizda olingan yoki tanlangan suratlar qurilmangizdan serverimizga yuboriladi. Server ularni saqlamaydi: suratlar faqat dizayn tayyorlanayotgan paytda xotirada turadi, keyin oʻchib ketadi. Tayyor dizayn va rasmlar qurilmangizga qaytadi va faqat shu brauzer xotirasida (Arxivda), “oldin/keyin” koʻrinishi uchun suratlaringizning kichik nusxalari bilan birga saqlanadi. Suratga olish tugaguncha yoki tab yopilguncha suratlar sahifa yangilanganda yoʻqolmasligi uchun tabning vaqtinchalik xotirasida ham turadi. Brauzer maʼlumotlarini tozalash yoki Sozlamalar sahifasi ularni oʻchiradi."
          },
          {
            "h": "Suratlarni kim qayta ishlaydi",
            "p": "Xonangizni loyihalash uchun suratlaringiz, izohlaringiz va tanlangan uslub Anthropic (Claude) ga — xonani tahlil qilib, loyihani tuzadi — va Google (Gemini) ga — suratlaringizni yangi dizaynda qayta chizadi — yuboriladi. 3D konstruktor surat emas, faqat xona joylashuvining matnli tavsifini yuboradi. Ikkala kompaniya ham bu maʼlumotni oʻz API shartlari asosida qayta ishlaydi va xavfsizlik nazorati uchun maʼlum muddat saqlashi mumkin. Google shartlari tarifga qarab farq qiladi: Gemini API ning bepul tarifida Google yuborilgan maʼlumotdan oʻz mahsulotlarini yaxshilash uchun (jumladan, inson tomonidan koʻrib chiqish bilan) foydalanishi mumkin, pullik tariflarda esa yoʻq. Iltimos, odamlar, hujjatlar yoki boshqa shaxsiy narsalarni suratga olmang. Demo rejimda hech narsa bu kompaniyalarga yuborilmaydi."
          },
          {
            "h": "Nima uchun",
            "p": "Dizayningizni tayyorlash, hisobingizni yuritish, xizmatni bepul limitlar ichida ushlab turish va savollaringizga javob berish uchun. Maʼlumotlaringiz va suratlaringizni sotmaymiz va reklama uchun ishlatmaymiz."
          },
          {
            "h": "Qancha vaqt saqlanadi",
            "p": "Suratlar: serverimizda umuman saqlanmaydi. Hisob maʼlumotlari: hisobni oʻchirishni soʻraguningizcha. Kirish sessiyalari: 30 kun. Kunlik generatsiya hisobi har kuni yangilanadi. Aloqa xabarlari: oʻchirishni soʻraguningizcha. Xato hisobotlari: faqat oxirgi bir necha yuztasi saqlanadi."
          },
          {
            "h": "Saqlash va himoya",
            "p": "Parollar shifrlangan (hash) holda saqlanadi, sessiya himoyalangan httpOnly cookie orqali ishlaydi. Hisob maʼlumotlari hosting provayderimizning maʼlumotlar bazasida saqlanadi."
          },
          {
            "h": "Cookie fayllar",
            "p": "Faqat tizimga kirish va sozlamalarni (til, valyuta, mavzu) eslab qolish uchun zarur cookie va mahalliy xotiradan foydalanamiz."
          },
          {
            "h": "Sizning huquqlaringiz va oʻchirish",
            "p": "Maʼlumotlaringizni koʻrish, tuzatish yoki oʻchirishni soʻrashingiz mumkin. Hisobingizni va u bilan saqlangan hamma narsani oʻchirish uchun hisobdagi pochta manzilidan aloqa formasi orqali yozing — bajarilganini tasdiqlaymiz. Qurilmangizdagi maʼlumotlarni (Arxiv, sozlamalar) Sozlamalar sahifasida oʻzingiz tozalay olasiz."
          },
          {
            "h": "Aloqa",
            "p": "Maxfiylik boʻyicha savollar uchun aloqa formasi orqali yoki hello@framespace.uz manziliga yozing."
          }
        ]
      }
    },
  },

  ru: {
    contact: {
      title: 'Есть вопрос? Напишите.',
      lead: 'О проекте, партнёрстве или о том, как добавить ваш магазин в каталог — мы читаем и отвечаем.',
      reply: 'Обычно в течение рабочего дня',
      submit: 'Отправить сообщение',
      sentLabel: 'Отправлено',
      sentTitle: 'Сообщение дошло.',
      sentBody: 'Ответим на указанную почту. Спасибо.',
      again: 'Написать ещё',
      fields: {
        name: 'Имя',
        email: 'Электронная почта',
        message: 'Сообщение',
        messagePlaceholder: 'О чём поговорим?',
      },
      errors: {
        email: 'Адрес почты указан неверно.',
        message: 'Напишите хотя бы пару предложений.',
        server: 'Не удалось отправить. Попробуйте ещё раз.',
      },
      channels: {
        title: 'Связаться напрямую',
        telegram: 'Telegram',
        phone: 'Телефон',
        email: 'Электронная почта',
      },
      topic: {
        label: 'Тема',
        general: 'Общий вопрос',
        business: 'Бизнес и партнёрство',
        pricing: 'Цены',
        studio: 'Тариф Studio',
      },
      sent: {
        title: 'Ваше сообщение дошло до нас.',
      },
      prefill: {
        product: 'Товар: {{product}}',
        store: 'Магазин: {{store}}',
      },
    },
    gallery: {
      title: 'Те же комнаты, другая жизнь.',
      lead: 'Каждая пара — одна реальная комната: слева как есть, справа предложение. Потяните разделитель.',
      all: 'Все',
      note: 'Изображения здесь показаны в чертёжном стиле: реальных фотографий в проекте пока нет. Они появятся здесь, как только будут готовы первые настоящие проекты.',
      rooms: {
        living: 'Гостиная',
        bedroom: 'Спальня',
        kitchen: 'Кухня',
        office: 'Кабинет',
      },
    },
    stylesPage: {
      title: 'Восемь стилей. Один ваш.',
      lead: 'Каждый стиль — это решение о цвете, материалах и свете. Ваша комната перерисовывается по этому решению.',
      pick: 'Начать в этом стиле',
    },
    about: {
      title: 'Комнату нужно увидеть до покупки.',
      lead: 'FrameSpace делается в Ташкенте. Цель простая: чтобы человек увидел, как диван встанет именно в его комнате, ещё до покупки.',
      body: 'Ремонт — дорогое и необратимое решение. Люди выбирают по фотографии из каталога, а дома оказывается, что и размер, и цвет, и свет другие. Мы закрываем этот разрыв: ваша комната, ваш бюджет, до покупки.',
      metricsLabel: 'Сейчас',
      metrics: {
        angles: 'Ракурсов на комнату',
        languages: 'Языка',
        minutes: 'Минут до результата',
      },
    },
    pages: {
      howItWorks: {
        eyebrow: 'Как это работает',
        title: 'От фото до готовой комнаты — три шага.',
        lead: 'Вы фотографируете комнату, выбираете стиль и бюджет и видите результат в своей же комнате.',
      },
      pricing: {
        eyebrow: 'Цены',
        title: 'Начните бесплатно. Расширяйте, когда понадобится.',
        lead: 'Первая комната бесплатно. Нужно больше проектов — Pro или Studio.',
      },
      faq: {
        eyebrow: 'Вопросы',
        title: 'Частые вопросы',
        lead: 'Не нашли ответ? Напишите нам — обычно отвечаем в течение рабочего дня.',
      },
    },
    forBusinessPage: {
      eyebrow: 'Для бизнеса',
      title: 'Ваша мебель — в комнате покупателя.',
      lead: 'Товары вашего магазина появляются в проектах FrameSpace с реальными размерами и ценой — покупатель уверен ещё до покупки.',
      cta: 'Связаться с нами',
      seoTitle: 'Для бизнеса — FrameSpace',
      seoDescription: 'Покажите свою мебель в комнате покупателя. Добавьте магазин в каталог FrameSpace.',
    },
    legal: {
      "eyebrow": "Правовая информация",
      "updated": "Последнее обновление: 1 октября 2026 г.",
      "toc": "Содержание",
      "contactCta": "Остались вопросы? Напишите нам",
      "terms": {
        "title": "Условия использования",
        "lead": "Правила работы с FrameSpace — коротко и понятным языком.",
        "sections": [
          {
            "h": "О сервисе",
            "p": "FrameSpace готовит дизайн-проект и 3D-визуализацию по фотографиям вашей комнаты. Результаты носят рекомендательный характер: перед покупкой мебели проверьте размеры сами."
          },
          {
            "h": "Аккаунт",
            "p": "Указывайте верные данные и не передавайте пароль другим. Вы отвечаете за действия, совершённые в вашем аккаунте."
          },
          {
            "h": "Контент и права",
            "p": "Загруженные фотографии остаются вашими. Мы используем их только для подготовки вашего проекта. Готовые рендеры можно использовать в личных и коммерческих целях."
          },
          {
            "h": "Оплата",
            "p": "Платные тарифы действуют по цене, указанной заранее. Подписку можно отменить в любой момент — сервис работает до конца оплаченного периода."
          },
          {
            "h": "Ответственность",
            "p": "Мы стараемся, чтобы сервис работал без перебоев, но не отвечаем за цены и наличие в сторонних магазинах."
          },
          {
            "h": "Изменения",
            "p": "Если условия изменятся, мы обновим эту страницу и сообщим о важных изменениях по почте."
          }
        ]
      },
      "privacy": {
        "title": "Политика конфиденциальности",
        "lead": "Какие данные мы собираем, зачем и как их защищаем.",
        "updated": "Последнее обновление: 11 октября 2026 г.",
        "sections": [
          {
            "h": "Какие данные мы собираем",
            "p": "При регистрации — имя и почту, хеш пароля, ваши сессии входа (с названием браузера), счётчик дизайнов, созданных за сегодня, и сообщения, отправленные через форму обратной связи. Если приложение даёт сбой, нам приходит технический отчёт об ошибке (текст ошибки и адрес страницы — без фото и личных данных). Платежей мы пока не принимаем, поэтому данных карт у нас нет."
          },
          {
            "h": "Фотографии комнаты",
            "p": "Когда вы нажимаете «Создать», снятые или выбранные фото отправляются с устройства на наш сервер. Сервер их не сохраняет: фото находятся в памяти только пока готовится дизайн, затем удаляются. Готовый дизайн и изображения возвращаются на ваше устройство и хранятся только в памяти этого браузера (в Архиве) вместе с уменьшенными копиями ваших фото для режима «до/после». Пока вы снимаете и не закрыли вкладку, фото также лежат во временном хранилище вкладки, чтобы не пропасть при перезагрузке. Очистка данных браузера или страница настроек удаляет их."
          },
          {
            "h": "Кто обрабатывает фото",
            "p": "Чтобы спроектировать комнату, ваши фото, заметки и выбранный стиль отправляются в Anthropic (Claude) — он анализирует комнату и составляет проект — и в Google (Gemini) — он перерисовывает ваши фото в новом дизайне. 3D-конструктор отправляет только текстовое описание планировки, без фото. Обе компании обрабатывают данные по своим условиям API и могут хранить их ограниченное время для контроля безопасности. Условия Google зависят от тарифа: на бесплатном тарифе Gemini API Google может использовать отправленное для улучшения своих продуктов (в том числе с проверкой людьми), на платных — нет. Пожалуйста, не снимайте людей, документы и другие личные вещи. В демо-режиме этим компаниям ничего не отправляется."
          },
          {
            "h": "Зачем",
            "p": "Чтобы подготовить ваш дизайн, вести аккаунт, удерживать сервис в рамках бесплатных лимитов и отвечать на вопросы. Мы не продаём ваши данные и фото и не используем их для рекламы."
          },
          {
            "h": "Сколько хранятся данные",
            "p": "Фото: на нашем сервере не хранятся вовсе. Данные аккаунта: пока вы не попросите удалить аккаунт. Сессии входа: 30 дней. Дневной счётчик генераций перезаписывается каждый день. Сообщения из формы: пока вы не попросите их удалить. Отчёты об ошибках: хранятся только последние несколько сотен."
          },
          {
            "h": "Хранение и защита",
            "p": "Пароли хранятся в виде хеша, сессия защищена httpOnly-cookie. Данные аккаунта хранятся в базе данных нашего хостинг-провайдера."
          },
          {
            "h": "Cookie",
            "p": "Мы используем только необходимые cookie и локальное хранилище — чтобы вы оставались в аккаунте и чтобы запомнить настройки (язык, валюту, тему)."
          },
          {
            "h": "Ваши права и удаление",
            "p": "Вы можете запросить просмотр, исправление или удаление своих данных. Чтобы удалить аккаунт и всё, что с ним связано, напишите через форму обратной связи с почты, указанной в аккаунте, — мы подтвердим удаление. Данные на устройстве (Архив, настройки) можно очистить самостоятельно на странице настроек."
          },
          {
            "h": "Контакты",
            "p": "По вопросам конфиденциальности пишите через форму обратной связи или на hello@framespace.uz."
          }
        ]
      }
    },
  },

  en: {
    contact: {
      title: 'Got a question? Write to us.',
      lead: 'About the product, a partnership, or getting your store into the catalog — we read everything and we answer.',
      reply: 'Usually within one working day',
      submit: 'Send message',
      sentLabel: 'Sent',
      sentTitle: 'Your message reached us.',
      sentBody: 'We will reply to the address you gave. Thank you.',
      again: 'Send another message',
      fields: {
        name: 'Your name',
        email: 'Email',
        message: 'Message',
        messagePlaceholder: 'What should we talk about?',
      },
      errors: {
        email: 'That email address is not valid.',
        message: 'Write at least a couple of sentences.',
        server: 'The message could not be sent. Try again.',
      },
      channels: {
        title: 'Reach us directly',
        telegram: 'Telegram',
        phone: 'Phone',
        email: 'Email',
      },
      topic: {
        label: 'Topic',
        general: 'General question',
        business: 'Business and partnerships',
        pricing: 'Pricing',
        studio: 'Studio plan',
      },
      sent: {
        title: 'Your message reached us.',
      },
      prefill: {
        product: 'Product: {{product}}',
        store: 'Store: {{store}}',
      },
    },
    gallery: {
      title: 'The same rooms, a different life.',
      lead: 'Each pair is one real room: as it is on the left, the suggestion on the right. Drag the divider.',
      all: 'All',
      note: 'The images here are drawn in a blueprint style — this project ships no photography yet. Real project photos drop straight into these frames once the first ones exist.',
      rooms: {
        living: 'Living room',
        bedroom: 'Bedroom',
        kitchen: 'Kitchen',
        office: 'Office',
      },
    },
    stylesPage: {
      title: 'Eight styles. One of them is yours.',
      lead: 'Each style is a decision about colour, material and light. Your room is redrawn according to it.',
      pick: 'Start in this style',
    },
    about: {
      title: 'You should see the room before you buy it.',
      lead: 'FrameSpace is being built in Tashkent. The goal is simple: let someone see how a sofa sits in their own room before they pay for it.',
      body: 'Renovating is expensive and hard to undo. People choose from a catalogue photograph, then get home and find the size, the colour and the light are all different. We close that gap: your room, your budget, before you buy.',
      metricsLabel: 'Where we are',
      metrics: {
        angles: 'Angles per room',
        languages: 'Languages',
        minutes: 'Minutes to a result',
      },
    },
    pages: {
      howItWorks: {
        eyebrow: 'How it works',
        title: 'From a photo to a finished room — three steps.',
        lead: 'You photograph the room, pick a style and a budget, and see the result in your own room.',
      },
      pricing: {
        eyebrow: 'Pricing',
        title: 'Start free. Grow when you need to.',
        lead: 'Your first room is free. Need more projects — Pro or Studio.',
      },
      faq: {
        eyebrow: 'Questions',
        title: 'Frequently asked questions',
        lead: 'Did not find an answer? Write to us — we usually reply within one working day.',
      },
    },
    forBusinessPage: {
      eyebrow: 'For business',
      title: 'Your furniture, in the buyer’s own room.',
      lead: 'Your store’s products appear in FrameSpace projects at their real size and price — buyers are sure before they buy.',
      cta: 'Get in touch',
      seoTitle: 'For business — FrameSpace',
      seoDescription: 'Show your furniture in the buyer’s own room. Add your store to the FrameSpace catalog.',
    },
    legal: {
      "eyebrow": "Legal",
      "updated": "Last updated: 1 October 2026",
      "toc": "Contents",
      "contactCta": "Still have questions? Write to us",
      "terms": {
        "title": "Terms of use",
        "lead": "The rules for using FrameSpace — short and in plain language.",
        "sections": [
          {
            "h": "The service",
            "p": "FrameSpace turns photos of your room into a design proposal and a 3D view. Results are advisory: check the measurements yourself before buying furniture."
          },
          {
            "h": "Your account",
            "p": "Give accurate details when you sign up and keep your password to yourself. You are responsible for activity on your account."
          },
          {
            "h": "Content and rights",
            "p": "Photos you upload stay yours. We use them only to prepare your project. You may use the renders you create for personal and commercial purposes."
          },
          {
            "h": "Payments",
            "p": "Paid plans are charged at the price shown up front. You can cancel any time — the service keeps working until the end of the paid period."
          },
          {
            "h": "Liability",
            "p": "We work hard to keep the service running, but we are not responsible for prices or availability in third-party stores."
          },
          {
            "h": "Changes",
            "p": "If these terms change we will update this page and email you about anything significant."
          }
        ]
      },
      "privacy": {
        "title": "Privacy policy",
        "lead": "What we collect, why, and how we protect it.",
        "updated": "Last updated: 11 October 2026",
        "sections": [
          {
            "h": "What we collect",
            "p": "When you create an account: your name and email, a hash of your password, your sign-in sessions (with the browser name), a count of how many designs you generated today, and any message you send through the contact form. If the app crashes, it sends us a technical error report (the error text and the page address — no photos or personal details). We do not take payments yet, so we hold no card details."
          },
          {
            "h": "Your room photos",
            "p": "When you press Generate, the photos you took or picked are sent from your device to our server. The server never saves them: they are held in memory only while your design is being made, then discarded. The finished design and images come back to your device and are saved only in this browser’s storage (your Archive), together with small copies of your photos for the before/after view. While you are still shooting, the photos are also kept in the tab’s temporary storage so a reload does not lose them, until you finish or close the tab. Clearing your browser data, or the Settings page, removes them."
          },
          {
            "h": "Who processes your photos",
            "p": "To design your room, your photos, your notes and the style you chose are sent to Anthropic (Claude), which reads the room and plans the design, and to Google (Gemini), which redraws your photos in the new design. The 3D builder sends only a text description of your layout, never photos. Both companies process this under their own API terms and may keep it for a limited time for safety and abuse monitoring. Google’s terms differ by plan: on the free tier of the Gemini API, Google may use what is sent to improve its products, including human review; on paid plans it does not. Please don’t photograph people, documents or anything else private. In demo mode nothing is sent to either company."
          },
          {
            "h": "Why",
            "p": "To prepare your design, run your account, keep the service within its free limits and answer your questions. We never sell your data or your photos, and we don’t use them for advertising."
          },
          {
            "h": "How long we keep things",
            "p": "Photos: not kept on our server at all. Account details: until you ask us to delete the account. Sign-in sessions: 30 days. The daily generation counter is overwritten every day. Contact messages: until you ask us to delete them. Error reports: only the most recent few hundred are kept."
          },
          {
            "h": "Storage and security",
            "p": "Passwords are stored hashed and your session lives in a secure httpOnly cookie. Account data is stored in our hosting provider’s database."
          },
          {
            "h": "Cookies",
            "p": "We only use essential cookies and local storage — to keep you signed in and remember your preferences (language, currency, theme)."
          },
          {
            "h": "Your rights and deletion",
            "p": "You can ask to see, correct or delete your data. To delete your account and everything stored with it, send a message through the contact form from the email address on the account, and we will confirm once it is done. Data on your device (Archive, settings) you can clear yourself from the Settings page."
          },
          {
            "h": "Contact",
            "p": "For privacy questions, use the contact form or write to hello@framespace.uz."
          }
        ]
      }
    },
  },
}

/* Second-pass editorial copy (about values, studio, style dossiers, auth
   plinth…). Kept in its own namespace so the first-pass keys stay stable. */
for (const lang of ['uz', 'ru', 'en'] as const) {
  bundle[lang].public2 = PUBLIC2[lang]
}

export default bundle
