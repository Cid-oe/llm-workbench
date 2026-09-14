import tailwindcss from '@tailwindcss/vite'

function envEnabled(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback
  return !['0', 'false', 'off', 'no'].includes(value.toLowerCase())
}

// https://nuxt.com/docs/api/configuration/nuxt-config
const baseURL = process.env.NUXT_APP_BASE_URL || '/'

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
      title: 'LLM Playground OS',
      meta: [
        { name: 'description', content: 'Open-source multi-LLM playground for developers' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg` },
      ],
    },
  },

  pinia: {
    storesDirs: ['stores/**'],
  },

  piniaPluginPersistedstate: {
    storage: 'localStorage',
  },
})
