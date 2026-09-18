import tailwindcss from '@tailwindcss/vite'

function envEnabled(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback
  return !['0', 'false', 'off', 'no'].includes(value.toLowerCase())
}

// https://nuxt.com/docs/api/configuration/nuxt-config
const baseURL = process.env.NUXT_APP_BASE_URL || '/'

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https: http://127.0.0.1:* http://localhost:*",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = {
  'Content-Security-Policy': contentSecurityPolicy,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: envEnabled(process.env.NUXT_DEVTOOLS, true) },

  // Local-first app: state lives in localStorage/sessionStorage
  ssr: false,

  modules: ['@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    baseURL,
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'LLM Workbench',
      meta: [
        { name: 'description', content: 'Local-first multi-LLM workbench for prompt comparison' },
        { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy },
        { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg` },
      ],
    },
  },

  nitro: {
    routeRules: {
      '/**': { headers: securityHeaders },
    },
  },

  pinia: {
    storesDirs: ['stores/**'],
  },

  piniaPluginPersistedstate: {
    storage: 'localStorage',
  },

  runtimeConfig: {
    public: {
      // Overridden by NUXT_PUBLIC_SENTRY_DSN when set. Empty = no remote tracking.
      sentryDsn: '',
    },
  },
})
