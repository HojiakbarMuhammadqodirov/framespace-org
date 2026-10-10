/**
 * Copy for the render cost controls: the daily allowance line where renders
 * start, and what to say when the server answers 401 (sign in first), 429
 * `quota_exceeded` (today's allowance is used up) or 503 `capacity` (the
 * service-wide daily cap is hit).
 *
 * Kept in one file so the three situations read the same in the capture flow
 * and the 3D builder. `capture.errors.*` and `builder.generate.errors.*` keys
 * are deep-merged into those features' own trees.
 *
 * `{{time}}` is the reset moment in the visitor's local time.
 */
import type { Bundle } from './index'

const bundle: Bundle = {
  /* ------------------------------------------------------------------ uz */
  uz: {
    limits: {
      left: 'Bugun {{remaining}} / {{limit}} ta generatsiya qoldi',
      resets: 'Limit soat {{time}} da yangilanadi',
      signinTitle: 'Generatsiya uchun hisobga kiring',
      signinBody:
        'Dizayn pullik sunʼiy intellekt xizmatlarida tayyorlanadi, shuning uchun u hisobga bogʻlangan. Roʻyxatdan oʻtish bepul va bir daqiqa oladi.',
      exhaustedTitle: 'Bugungi generatsiyalar tugadi',
      exhaustedBody: 'Bugungi {{limit}} ta bepul generatsiyadan foydalandingiz. Ular soat {{time}} da qaytadi.',
      capacityTitle: 'Bugun xizmat toʻlib qoldi',
      capacityBody:
        'Bugun shuncha koʻp xona loyihalandiki, kunlik umumiy limitga yetdik. Ertaga qayta urinib koʻring.',
      login: 'Kirish',
    },
    capture: {
      errors: {
        signin: {
          title: 'Avval hisobga kiring',
          body: 'Dizayn pullik sunʼiy intellekt xizmatlarida tayyorlanadi, shuning uchun hisob kerak. Suratlar shu ekranda qoladi.',
        },
        dailyQuota: {
          title: 'Bugungi generatsiyalar tugadi',
          body: 'Bugungi bepul generatsiyalardan foydalandingiz. Ertaga yana urinib koʻring — limit har kuni yangilanadi.',
        },
        capacity: {
          title: 'Bugun xizmat toʻlib qoldi',
          body: 'Kunlik umumiy limitga yetdik. Ertaga qayta urinib koʻring.',
        },
      },
    },
    builder: {
      generate: {
        errors: {
          signin: 'Generatsiya uchun hisobingizga kiring. Roʻyxatdan oʻtish bepul.',
          dailyQuota: 'Bugungi bepul generatsiyalar tugadi. Ertaga qayta urinib koʻring.',
          capacity: 'Bugun xizmat toʻlib qoldi — kunlik limitga yetdik. Ertaga qayta urinib koʻring.',
        },
      },
    },
  },

  /* ------------------------------------------------------------------ ru */
  ru: {
    limits: {
      left: 'Сегодня осталось {{remaining}} из {{limit}} генераций',
      resets: 'Лимит обновится в {{time}}',
      signinTitle: 'Войдите, чтобы создать дизайн',
      signinBody:
        'Дизайн создают платные ИИ-сервисы, поэтому генерации привязаны к аккаунту. Регистрация бесплатная и занимает минуту.',
      exhaustedTitle: 'Генерации на сегодня закончились',
      exhaustedBody: 'Вы использовали все {{limit}} бесплатных генераций на сегодня. Они вернутся в {{time}}.',
      capacityTitle: 'Сегодня сервис перегружен',
      capacityBody: 'Сегодня спроектировали так много комнат, что мы упёрлись в общий дневной лимит. Попробуйте завтра.',
      login: 'Войти',
    },
    capture: {
      errors: {
        signin: {
          title: 'Сначала войдите в аккаунт',
          body: 'Дизайн создают платные ИИ-сервисы, поэтому нужен аккаунт. Снимки останутся на этом экране.',
        },
        dailyQuota: {
          title: 'Генерации на сегодня закончились',
          body: 'Вы использовали бесплатные генерации на сегодня. Попробуйте завтра — лимит обновляется каждый день.',
        },
        capacity: {
          title: 'Сегодня сервис перегружен',
          body: 'Мы достигли общего дневного лимита. Попробуйте завтра.',
        },
      },
    },
    builder: {
      generate: {
        errors: {
          signin: 'Войдите в аккаунт, чтобы создать дизайн. Регистрация бесплатная.',
          dailyQuota: 'Бесплатные генерации на сегодня закончились. Попробуйте завтра.',
          capacity: 'Сегодня сервис перегружен — дневной лимит исчерпан. Попробуйте завтра.',
        },
      },
    },
  },

  /* ------------------------------------------------------------------ en */
  en: {
    limits: {
      left: '{{remaining}} of {{limit}} generations left today',
      resets: 'Resets at {{time}}',
      signinTitle: 'Sign in to generate',
      signinBody:
        'Designs are made by paid AI services, so generations belong to an account. Signing up is free and takes a minute.',
      exhaustedTitle: 'Today’s generations are used up',
      exhaustedBody: 'You have used all {{limit}} free generations for today. They come back at {{time}}.',
      capacityTitle: 'We are at capacity today',
      capacityBody: 'So many rooms were designed today that we hit our overall daily limit. Try again tomorrow.',
      login: 'Log in',
    },
    capture: {
      errors: {
        signin: {
          title: 'Sign in first',
          body: 'Designs are made by paid AI services, so you need an account. Your photos stay on this screen.',
        },
        dailyQuota: {
          title: 'Today’s generations are used up',
          body: 'You have used today’s free generations. Try again tomorrow — the allowance resets every day.',
        },
        capacity: {
          title: 'We are at capacity today',
          body: 'We have hit our overall daily limit. Try again tomorrow.',
        },
      },
    },
    builder: {
      generate: {
        errors: {
          signin: 'Sign in to generate a design. Signing up is free.',
          dailyQuota: 'Today’s free generations are used up. Try again tomorrow.',
          capacity: 'We are at capacity today — the daily limit is reached. Try again tomorrow.',
        },
      },
    },
  },
}

export default bundle
