import { logger } from '~/lib/logger'

export default defineNuxtPlugin(() => {
  window.addEventListener('error', (event) => {
    logger.error('client_error', {
      source: 'window.error',
      message: event.error instanceof Error ? event.error.message : String(event.message),
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    logger.error('client_unhandled_rejection', {
      source: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
    })
  })
})
