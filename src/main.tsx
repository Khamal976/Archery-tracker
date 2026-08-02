import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { ensureSeed } from './db/db'
import './index.css'

/**
 * Живучесть данных: без облака потеря IndexedDB — катастрофа, поэтому просим
 * браузер не выселять базу. Chrome на Android обычно выдаёт разрешение молча.
 */
async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    // Не поддерживается — работаем как есть, напоминание о бэкапе никуда не делось.
  }
}

registerSW({ immediate: true })

void ensureSeed().then(requestPersistence)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
