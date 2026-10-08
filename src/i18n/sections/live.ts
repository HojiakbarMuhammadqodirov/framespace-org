import type { Bundle } from './index'

/**
 * Step 8 — "See by yourself". Every string the live screen can show, in the
 * three shipping languages. Uzbek (Latin) is the default and is written first,
 * not translated last; the turned comma in "oʻ"/"gʻ" is U+02BB throughout.
 */
const bundle: Bundle = {
  uz: {
    live: {
      touch: {
        "useTouch": "Barmoq bilan davom etish",
        "noSensor": "Harakat sensori topilmadi — atrofga qarash uchun suring."
      },
      meta: {
        title: 'Oʻzingiz koʻring — FrameSpace',
        description:
          'Telefoningizni xonaga qarating va yangi dizaynni oʻz joyida koʻring: 360° panorama, AR va jonli qayta bezash.',
      },
      label: '05 — OʻZINGIZ KOʻRING',
      title: 'Xonangizda turib koʻring',
      lead: 'Telefonni qoʻlingizga oling, oldingi devorga qarang va aylaning. Render sizning boshingiz bilan birga aylanadi.',

      mode: {
        label: 'REJIM',
        c: {
          name: 'Panorama',
          tag: 'Gyroskop · oflayn ishlaydi',
          body: 'Renderlaringiz 360° sferaga tikiladi. Telefonni aylantirsangiz, xona ham aylanadi. Internet shart emas.',
        },
        b: {
          name: 'AR',
          tag: 'WebXR · 6DoF',
          body: 'Mebelni haqiqiy polga qoʻying va atrofida yuring. Qurilmangiz qoʻllab-quvvatlasa ochiladi.',
        },
        a: {
          name: 'Jonli bezash',
          tag: 'Video → video · ulanmagan',
          body: 'Kamera oqimi real vaqtda qayta bezaladi. Hozircha ulanmagan.',
        },
      },

      align: {
        label: 'MOʻLJAL',
        heading: 'AZIMUT',
        pitch: 'QIYALIK',
        target: 'NISHON',
        drift: 'OGʻISH',
        mode: 'MANBA',
        source: {
          absolute: 'kompas',
          compass: 'kompas',
          relative: 'nisbiy',
          none: 'yoʻq',
        },
        ghost: 'Asl surat',
        ghostOn: 'Asl suratni koʻrsatish',
        ghostOff: 'Asl suratni yashirish',
        nudge: 'Surish',
        nudgeHint:
          'Ichki kompas 10–15° adashadi, metall va simlar yonida bundan ham koʻp. Xona toʻgʻri turmasa, barmoq bilan suring.',
        nudgeLeft: 'Chapga 1°',
        nudgeRight: 'Oʻngga 1°',
        recalibrate: 'Qayta moslash',
        recalibrateHint: 'Oldingi devorga qarang va bosing.',
        calibrate: 'Shu yerdan boshlash',
        calibrateHint:
          'Suratni olgan joyingizda turing, oldingi devorga qarang va bosing. Shu yoʻnalish xonaning nol nuqtasi boʻladi.',
        notCalibrated: 'Hali moslanmagan',
        locked: 'Moslang — keyin ochiladi',
        unlocked: 'Tayyor',
        turnLeft: 'Chapga buriling',
        turnRight: 'Oʻngga buriling',
        raise: 'Telefonni koʻtaring',
        lower: 'Telefonni pastroq tuting',
        hold: 'Shunday ushlab turing',
        tolerance: '±10° ichida',
      },

      action: {
        start: 'Boshlash',
        stop: 'Toʻxtatish',
        exit: 'Chiqish',
        back: 'Orqaga',
        retry: 'Qayta urinish',
        grant: 'Sensorga ruxsat berish',
        enter: 'ARga kirish',
        leave: 'ARdan chiqish',
        place: 'Bu yerga qoʻyish',
        clear: 'Tozalash',
        connect: 'Ulanish',
      },

      status: {
        preparing: 'Panorama tayyorlanmoqda',
        preparingBody: 'Toʻrtta render bitta 4096 × 2048 sferaga tikilyapti.',
        aligning: 'Moslanmoqda',
        live: 'Jonli',
        sectors: 'SEKTOR',
        approx: 'Renderlar teng burchaklarda emas — panorama taxminiy.',
        wakeOn: 'Ekran oʻchmaydi',
        wakeOff: 'Ekran oʻchishi mumkin',
        portraitLocked: 'Tik holat qulflandi',
        portraitFree: 'Tik holatni qulflab boʻlmadi — telefonni tik tuting',
      },

      error: {
        insecure: {
          title: 'HTTPS kerak',
          body: 'Harakat sensorlari va kamera faqat xavfsiz ulanishda ishlaydi. Sahifani https:// orqali oching.',
        },
        motionDenied: {
          title: 'Harakatga ruxsat berilmadi',
          body: 'Brauzer sozlamalarida ushbu sayt uchun “Harakat va yoʻnalish”ni yoqing, soʻng qayta urinib koʻring.',
        },
        motionMissing: {
          title: 'Bu qurilmada gyroskop yoʻq',
          body: 'Panoramani barmoq bilan surib koʻrishingiz mumkin — moslash oʻchirilgan.',
        },
        noRenders: {
          title: 'Hali render yoʻq',
          body: 'Avval xonani suratga oling va dizaynni yarating. Keyin shu yerga qayting.',
          cta: 'Xonani suratga olish',
        },
        offline: {
          title: 'Internet yoʻq',
          body: 'Panorama qurilmada saqlangan renderlardan quriladi va oflayn ishlaydi. AR va jonli bezash uchun internet kerak.',
        },
        webgl: {
          title: 'WebGL ishlamayapti',
          body: 'Brauzeringiz 3D chizishni qoʻllab-quvvatlamayapti. Renderlarni oddiy rasm sifatida koʻrishingiz mumkin.',
        },
        panorama: {
          title: 'Panoramani qurib boʻlmadi',
          body: 'Renderlardan bittasi yuklanmadi.',
        },
        camera: {
          title: 'Kameraga ruxsat yoʻq',
          body: 'Kamera oqimisiz bu rejim ishlamaydi.',
        },
        generic: {
          title: 'Nimadir notoʻgʻri ketdi',
          body: 'Qayta urinib koʻring.',
        },
      },

      desktop: {
        label: '— TELEFONDA DAVOM ETING',
        title: 'Bu ekran telefon uchun',
        body: 'Xonada turib, telefonni aylantirib koʻrasiz. Kompyuterda gyroskop ham, kamera ham yoʻq — QR kodni skanerlang va shu loyiha telefoningizda ochiladi.',
        cta: 'QR kodni koʻrsatish',
        note: 'Havola oʻsha loyihani ochadi. Hech narsa yuborilmaydi.',
        lookHere: 'Shu yerga qarang',
        betterOnPhone: 'Telefonda yaxshiroq ishlaydi — xonada turib, telefonni aylantirib koʻrasiz.',
      },

      panorama: {
        dragHint: 'Atrofga qarash uchun suring',
      },

      intro: {
        soon: 'Tez orada',
      },

      ar: {
        title: 'AR — xonaning oʻzida',
        body: 'Polni topamiz, keyin mebelni oʻsha joyga qoʻyasiz va atrofida yurasiz.',
        scanning: 'Polni qidiryapmiz — telefonni sekin pastga yuriting',
        ready: 'Nuqtani tanlang va qoʻying',
        placed: 'Qoʻyildi',
        placedCount: '{{count}} ta buyum qoʻyildi',
        anchorLost: 'Langar yoʻqoldi — qayta qoʻying',
        unsupported: {
          title: 'Bu brauzerda WebXR AR yoʻq',
          body: 'Panorama rejimi baribir ishlaydi va u ham xuddi shu renderlardan quriladi.',
        },
        quicklook: {
          title: 'iPhone uchun: AR Quick Look',
          body: 'iOS Safari hozircha WebXR AR’ni qoʻllab-quvvatlamaydi. Uning oʻrniga bitta buyumni USDZ orqali xonangizga qoʻyish mumkin.',
          missing:
            'Katalogda hali USDZ model yoʻq. Model qoʻshilganda bu tugma oʻzi ishlay boshlaydi.',
        },
        placeholder: {
          title: 'Modellar hali yuklanmagan',
          body: 'Hozir oddiy shakllar qoʻyiladi: bu mebelning oʻlchami va joyini tekshirish uchun yetarli. Haqiqiy .glb modellar katalog tayyor boʻlganda oʻsha joyga tushadi.',
        },
        items: {
          sofa: 'Divan',
          table: 'Stol',
          lamp: 'Chiroq',
        },
      },

      restyle: {
        title: 'Jonli qayta bezash',
        body: 'Kamera oqimi kadrma-kadr qayta bezaladi — xona ekranda darhol boshqacha koʻrinadi.',
        gated: {
          title: 'Hali ulanmagan',
          body: 'Interfeys va mijoz tomoni tayyor. Yoqilishi uchun quyidagilar kerak:',
          need1: 'Server tomonda ishlab chiqariladigan qisqa muddatli sessiya tokeni — kalit hech qachon brauzerga tushmaydi.',
          need2: 'Tarifga bogʻlangan limit: kim, qancha va necha marta ishlatishi mumkinligi.',
          need3: 'Bepul tarif uchun bitta sessiyaga 60–120 soniya chegarasi.',
          note: 'Shu uchtasi joyiga tushsa, bu rejim qoʻshimcha koʻrsatmasiz ishlaydi.',
        },
        session: 'SESSIYA',
        remaining: 'QOLDI',
        cap: 'Bepul tarifda {{seconds}} soniya',
        preview: 'Kamera — asl holat',
        badge: 'Qayta bezalmagan',
      },

      legend: {
        anchor: 'Langar',
        room: 'XONA',
        style: 'USLUB',
      },
    },
  },

  ru: {
    live: {
      touch: {
        "useTouch": "Продолжить с касанием",
        "noSensor": "Датчик движения не найден — проведите пальцем, чтобы осмотреться."
      },
      meta: {
        title: 'Посмотрите сами — FrameSpace',
        description:
          'Наведите телефон на комнату и увидьте новый дизайн на месте: панорама 360°, AR и живая перестилизация.',
      },
      label: '05 — ПОСМОТРИТЕ САМИ',
      title: 'Встаньте в своей комнате',
      lead: 'Возьмите телефон, посмотрите на переднюю стену и поворачивайтесь. Рендер повернётся вместе с вами.',

      mode: {
        label: 'РЕЖИМ',
        c: {
          name: 'Панорама',
          tag: 'Гироскоп · работает офлайн',
          body: 'Ваши рендеры сшиваются в сферу 360°. Поворачиваете телефон — поворачивается комната. Интернет не нужен.',
        },
        b: {
          name: 'AR',
          tag: 'WebXR · 6DoF',
          body: 'Поставьте мебель на реальный пол и обойдите её. Открывается, если устройство это умеет.',
        },
        a: {
          name: 'Живая перестилизация',
          tag: 'Видео → видео · не подключено',
          body: 'Поток с камеры перестилизуется в реальном времени. Пока не подключено.',
        },
      },

      align: {
        label: 'НАВЕДЕНИЕ',
        heading: 'АЗИМУТ',
        pitch: 'НАКЛОН',
        target: 'ЦЕЛЬ',
        drift: 'ОТКЛОН.',
        mode: 'ИСТОЧНИК',
        source: {
          absolute: 'компас',
          compass: 'компас',
          relative: 'относит.',
          none: 'нет',
        },
        ghost: 'Исходное фото',
        ghostOn: 'Показать исходное фото',
        ghostOff: 'Скрыть исходное фото',
        nudge: 'Подвинуть',
        nudgeHint:
          'В помещении компас ошибается на 10–15°, а рядом с металлом и проводкой — сильнее. Если комната стоит криво, подвиньте пальцем.',
        nudgeLeft: 'Влево на 1°',
        nudgeRight: 'Вправо на 1°',
        recalibrate: 'Откалибровать',
        recalibrateHint: 'Посмотрите на переднюю стену и нажмите.',
        calibrate: 'Начать отсюда',
        calibrateHint:
          'Встаньте там, где снимали, посмотрите на переднюю стену и нажмите. Это направление станет нулём комнаты.',
        notCalibrated: 'Ещё не откалибровано',
        locked: 'Наведите — тогда откроется',
        unlocked: 'Готово',
        turnLeft: 'Повернитесь влево',
        turnRight: 'Повернитесь вправо',
        raise: 'Поднимите телефон',
        lower: 'Опустите телефон',
        hold: 'Держите так',
        tolerance: 'в пределах ±10°',
      },

      action: {
        start: 'Начать',
        stop: 'Остановить',
        exit: 'Выйти',
        back: 'Назад',
        retry: 'Ещё раз',
        grant: 'Разрешить доступ к датчикам',
        enter: 'Войти в AR',
        leave: 'Выйти из AR',
        place: 'Поставить здесь',
        clear: 'Очистить',
        connect: 'Подключить',
      },

      status: {
        preparing: 'Готовим панораму',
        preparingBody: 'Четыре рендера сшиваются в одну сферу 4096 × 2048.',
        aligning: 'Наведение',
        live: 'В эфире',
        sectors: 'СЕКТОРА',
        approx: 'Рендеры сняты не через равные углы — панорама приблизительная.',
        wakeOn: 'Экран не гаснет',
        wakeOff: 'Экран может погаснуть',
        portraitLocked: 'Портретная ориентация закреплена',
        portraitFree: 'Закрепить ориентацию не вышло — держите телефон вертикально',
      },

      error: {
        insecure: {
          title: 'Нужен HTTPS',
          body: 'Датчики движения и камера работают только по защищённому соединению. Откройте страницу через https://.',
        },
        motionDenied: {
          title: 'Доступ к движению не дан',
          body: 'В настройках браузера включите «Движение и ориентация» для этого сайта и попробуйте снова.',
        },
        motionMissing: {
          title: 'На устройстве нет гироскопа',
          body: 'Панораму можно крутить пальцем — наведение отключено.',
        },
        noRenders: {
          title: 'Рендеров пока нет',
          body: 'Сначала снимите комнату и создайте дизайн. Потом возвращайтесь сюда.',
          cta: 'Снять комнату',
        },
        offline: {
          title: 'Нет интернета',
          body: 'Панорама собирается из рендеров на устройстве и работает офлайн. Для AR и живой перестилизации нужен интернет.',
        },
        webgl: {
          title: 'WebGL недоступен',
          body: 'Браузер не умеет рисовать 3D. Рендеры можно посмотреть обычными картинками.',
        },
        panorama: {
          title: 'Не удалось собрать панораму',
          body: 'Один из рендеров не загрузился.',
        },
        camera: {
          title: 'Нет доступа к камере',
          body: 'Без потока с камеры этот режим не работает.',
        },
        generic: {
          title: 'Что-то пошло не так',
          body: 'Попробуйте ещё раз.',
        },
      },

      desktop: {
        label: '— ПРОДОЛЖИТЬ НА ТЕЛЕФОНЕ',
        title: 'Этот экран — для телефона',
        body: 'Вы стоите в комнате и поворачиваетесь с телефоном в руках. У компьютера нет ни гироскопа, ни камеры — отсканируйте QR-код, и проект откроется на телефоне.',
        cta: 'Показать QR-код',
        note: 'Ссылка открывает тот же проект. Ничего никуда не отправляется.',
        lookHere: 'Смотрите сюда',
        betterOnPhone: 'На телефоне удобнее — вы стоите в комнате и поворачиваетесь вместе с ним.',
      },

      panorama: {
        dragHint: 'Потяните, чтобы осмотреться',
      },

      intro: {
        soon: 'Скоро',
      },

      ar: {
        title: 'AR — прямо в комнате',
        body: 'Находим пол, вы ставите мебель на место и обходите её.',
        scanning: 'Ищем пол — медленно поведите телефоном вниз',
        ready: 'Выберите точку и поставьте',
        placed: 'Поставлено',
        placedCount: 'Поставлено предметов: {{count}}',
        anchorLost: 'Якорь потерян — поставьте заново',
        unsupported: {
          title: 'В этом браузере нет WebXR AR',
          body: 'Режим панорамы работает всё равно и собирается из тех же рендеров.',
        },
        quicklook: {
          title: 'Для iPhone: AR Quick Look',
          body: 'Safari на iOS пока не поддерживает WebXR AR. Вместо этого один предмет можно поставить в комнату через USDZ.',
          missing:
            'В каталоге пока нет USDZ-модели. Как только модель появится, кнопка заработает сама.',
        },
        placeholder: {
          title: 'Модели ещё не загружены',
          body: 'Сейчас ставятся простые формы — этого хватает, чтобы проверить габариты и место. Настоящие .glb встанут сюда же, когда каталог будет готов.',
        },
        items: {
          sofa: 'Диван',
          table: 'Стол',
          lamp: 'Светильник',
        },
      },

      restyle: {
        title: 'Живая перестилизация',
        body: 'Поток с камеры перестилизуется кадр за кадром — комната сразу выглядит иначе.',
        gated: {
          title: 'Пока не подключено',
          body: 'Интерфейс и клиентская часть готовы. Чтобы включить, нужно:',
          need1: 'Короткоживущий сессионный токен, выпускаемый на сервере — ключ никогда не попадает в браузер.',
          need2: 'Лимиты по тарифу: кто, сколько и как часто может это запускать.',
          need3: 'Ограничение 60–120 секунд на сессию для бесплатного тарифа.',
          note: 'Когда эти три вещи на месте, режим включается без доработок.',
        },
        session: 'СЕССИЯ',
        remaining: 'ОСТАЛОСЬ',
        cap: 'На бесплатном тарифе — {{seconds}} с',
        preview: 'Камера — как есть',
        badge: 'Без перестилизации',
      },

      legend: {
        anchor: 'Якорь',
        room: 'КОМНАТА',
        style: 'СТИЛЬ',
      },
    },
  },

  en: {
    live: {
      touch: {
        "useTouch": "Continue with touch",
        "noSensor": "No motion sensor found — drag to look around."
      },
      meta: {
        title: 'See by yourself — FrameSpace',
        description:
          'Hold your phone up to the room and see the new design in place: a 360° panorama, AR, and live restyling.',
      },
      label: '05 — SEE BY YOURSELF',
      title: 'Stand in your own room',
      lead: 'Hold the phone up, face the front wall, and turn. The render turns with your head.',

      mode: {
        label: 'MODE',
        c: {
          name: 'Panorama',
          tag: 'Gyroscope · works offline',
          body: 'Your renders are stitched into a 360° sphere. Turn the phone and the room turns. No connection needed.',
        },
        b: {
          name: 'AR',
          tag: 'WebXR · 6DoF',
          body: 'Place furniture on the real floor and walk around it. Opens if your device supports it.',
        },
        a: {
          name: 'Live restyle',
          tag: 'Video to video · not connected',
          body: 'The camera feed is restyled in real time. Not connected yet.',
        },
      },

      align: {
        label: 'ALIGNMENT',
        heading: 'HEADING',
        pitch: 'PITCH',
        target: 'TARGET',
        drift: 'DRIFT',
        mode: 'SOURCE',
        source: {
          absolute: 'compass',
          compass: 'compass',
          relative: 'relative',
          none: 'none',
        },
        ghost: 'Anchor photo',
        ghostOn: 'Show anchor photo',
        ghostOff: 'Hide anchor photo',
        nudge: 'Nudge',
        nudgeHint:
          'Indoor compasses drift 10–15°, and worse near metal and wiring. If the room sits crooked, drag it straight.',
        nudgeLeft: 'Left 1°',
        nudgeRight: 'Right 1°',
        recalibrate: 'Recalibrate',
        recalibrateHint: 'Face the front wall, then press.',
        calibrate: 'Set this as front',
        calibrateHint:
          'Stand where you took the photos, face the front wall, and press. That direction becomes the room’s zero.',
        notCalibrated: 'Not calibrated yet',
        locked: 'Line it up to unlock',
        unlocked: 'Ready',
        turnLeft: 'Turn left',
        turnRight: 'Turn right',
        raise: 'Raise the phone',
        lower: 'Lower the phone',
        hold: 'Hold it there',
        tolerance: 'within ±10°',
      },

      action: {
        start: 'Start',
        stop: 'Stop',
        exit: 'Exit',
        back: 'Back',
        retry: 'Try again',
        grant: 'Allow motion access',
        enter: 'Enter AR',
        leave: 'Leave AR',
        place: 'Place here',
        clear: 'Clear',
        connect: 'Connect',
      },

      status: {
        preparing: 'Building the panorama',
        preparingBody: 'Four renders are being stitched into one 4096 × 2048 sphere.',
        aligning: 'Aligning',
        live: 'Live',
        sectors: 'SECTORS',
        approx: 'The renders are not evenly spaced — the panorama is approximate.',
        wakeOn: 'Screen stays on',
        wakeOff: 'Screen may sleep',
        portraitLocked: 'Portrait locked',
        portraitFree: 'Could not lock portrait — hold the phone upright',
      },

      error: {
        insecure: {
          title: 'HTTPS required',
          body: 'Motion sensors and the camera only work on a secure connection. Open this page over https://.',
        },
        motionDenied: {
          title: 'Motion access was declined',
          body: 'Enable “Motion & Orientation” for this site in your browser settings, then try again.',
        },
        motionMissing: {
          title: 'This device has no gyroscope',
          body: 'You can still drag the panorama with a finger — alignment is switched off.',
        },
        noRenders: {
          title: 'No renders yet',
          body: 'Photograph the room and generate a design first. Then come back here.',
          cta: 'Photograph the room',
        },
        offline: {
          title: 'You are offline',
          body: 'The panorama is built from renders already on the device and works offline. AR and live restyle need a connection.',
        },
        webgl: {
          title: 'WebGL is unavailable',
          body: 'This browser cannot draw 3D. You can still look at the renders as flat images.',
        },
        panorama: {
          title: 'The panorama could not be built',
          body: 'One of the renders failed to load.',
        },
        camera: {
          title: 'No camera access',
          body: 'This mode cannot run without the camera feed.',
        },
        generic: {
          title: 'Something went wrong',
          body: 'Please try again.',
        },
      },

      desktop: {
        label: '— CONTINUE ON PHONE',
        title: 'This screen is for a phone',
        body: 'You stand in the room and turn with the phone in your hand. A desktop has neither a gyroscope nor a camera — scan the code and this project opens on your phone.',
        cta: 'Show the QR code',
        note: 'The link opens the same project. Nothing is sent anywhere.',
        lookHere: 'Look here',
        betterOnPhone: 'Works better on a phone — you stand in the room and turn with it.',
      },

      panorama: {
        dragHint: 'Drag to look around',
      },

      intro: {
        soon: 'Coming soon',
      },

      ar: {
        title: 'AR — in the room itself',
        body: 'We find the floor, you place the furniture on it and walk around it.',
        scanning: 'Looking for the floor — sweep the phone slowly downwards',
        ready: 'Pick a spot and place it',
        placed: 'Placed',
        placedCount: '{{count}} placed',
        anchorLost: 'Anchor lost — place it again',
        unsupported: {
          title: 'This browser has no WebXR AR',
          body: 'Panorama mode works anyway, and it is built from the very same renders.',
        },
        quicklook: {
          title: 'On iPhone: AR Quick Look',
          body: 'iOS Safari still has no WebXR AR. Instead, a single item can be placed in your room through USDZ.',
          missing:
            'The catalog has no USDZ model yet. The button starts working on its own once a model lands.',
        },
        placeholder: {
          title: 'Models are not loaded yet',
          body: 'Plain shapes are placed for now — enough to check footprint and position. Real .glb models drop into the same slots once the catalog is ready.',
        },
        items: {
          sofa: 'Sofa',
          table: 'Table',
          lamp: 'Lamp',
        },
      },

      restyle: {
        title: 'Live restyle',
        body: 'The camera feed is restyled frame by frame — the room looks different straight away.',
        gated: {
          title: 'Not connected',
          body: 'The interface and the client pipeline are finished. Turning it on needs:',
          need1: 'A short-lived session token minted server-side — the key never reaches the browser.',
          need2: 'Plan limits: who may run it, how much, and how often.',
          need3: 'A 60–120 second cap per session on the free plan.',
          note: 'With those three in place this mode runs with no further work.',
        },
        session: 'SESSION',
        remaining: 'REMAINING',
        cap: '{{seconds}}s on the free plan',
        preview: 'Camera — untouched',
        badge: 'Not restyled',
      },

      legend: {
        anchor: 'Anchor',
        room: 'ROOM',
        style: 'STYLE',
      },
    },
  },
}

export default bundle
