import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '@/i18n/config'

/**
 * Per-page head management without pulling in a helmet library: titles, meta,
 * Open Graph, hreflang and JSON-LD, all in the active language (brief §11).
 *
 * Every tag this writes is marked `data-seo` so a later route can clear only
 * what a previous route added.
 */

function upsert(selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    el = create()
    el.dataset.seo = 'true'
    document.head.appendChild(el)
  }
  apply(el)
}

function meta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  upsert(
    `meta[${attr}="${name}"]`,
    () => {
      const el = document.createElement('meta')
      el.setAttribute(attr, name)
      return el
    },
    (el) => el.setAttribute('content', content)
  )
}

export type SeoProps = {
  title: string
  description: string
  /** Path without a language prefix, e.g. "/pricing". */
  path?: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
  /** Share image, root-relative or absolute. Defaults to the hero poster. */
  image?: string
  /** Placeholders, 404s and private screens: keep them out of the index. */
  noindex?: boolean
}

const OG_LOCALE: Record<string, string> = { uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' }

export function Seo({
  title,
  description,
  path = '/',
  jsonLd,
  image = '/hero-poster.webp',
  noindex = false,
}: SeoProps) {
  const { i18n } = useTranslation()

  useEffect(() => {
    document.title = title
    meta('description', description)

    meta('og:title', title, 'property')
    meta('og:description', description, 'property')
    meta('og:type', 'website', 'property')
    meta('og:site_name', 'FrameSpace', 'property')
    meta('twitter:card', 'summary_large_image')

    const origin = window.location.origin
    const imageUrl = /^https?:\/\//.test(image) ? image : origin + image
    meta('og:url', origin + path, 'property')
    meta('og:locale', OG_LOCALE[i18n.language.slice(0, 2)] ?? OG_LOCALE.uz, 'property')
    meta('og:image', imageUrl, 'property')
    meta('twitter:image', imageUrl)

    // Upserted when asked for and removed otherwise, so a noindex page never
    // leaks the tag onto the next route.
    if (noindex) meta('robots', 'noindex, follow')
    else document.head.querySelector('meta[name="robots"]')?.remove()
    upsert(
      'link[rel="canonical"]',
      () => {
        const el = document.createElement('link')
        el.setAttribute('rel', 'canonical')
        return el
      },
      (el) => el.setAttribute('href', origin + path)
    )

    // hreflang, one per language plus x-default.
    document.head.querySelectorAll('link[data-seo-hreflang]').forEach((el) => el.remove())
    for (const language of [...LANGUAGES.map((l) => l.code), 'x-default']) {
      const el = document.createElement('link')
      el.setAttribute('rel', 'alternate')
      el.setAttribute('hreflang', language === 'x-default' ? 'x-default' : language)
      el.setAttribute('href', `${origin}${path}${language === 'x-default' ? '' : `?lang=${language}`}`)
      el.dataset.seoHreflang = 'true'
      document.head.appendChild(el)
    }

    document.head.querySelectorAll('script[data-seo-jsonld]').forEach((el) => el.remove())
    if (jsonLd) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.seoJsonld = 'true'
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
  }, [title, description, path, jsonLd, image, noindex, i18n.language])

  return null
}

/** JSON-LD the landing page declares about the product itself. */
export function softwareJsonLd(description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'FrameSpace',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'UZS',
    },
  }
}

export function faqJsonLd(items: Array<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
}
