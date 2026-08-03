import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Хостинг в подпапке (например, GitHub Pages) — собирать с BASE_PATH=/имя-репозитория/
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  // Версия из package.json — уезжает в письмо обратной связи, чтобы было понятно,
  // на какой сборке случилась ошибка.
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Трекинг стрельбы из лука',
        short_name: 'Лук',
        description: 'Локальный трекер тренировок по стрельбе из лука. Работает офлайн.',
        lang: 'ru',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#12100e',
        theme_color: '#12100e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // jpg обязателен: иллюстрации справочника должны открываться офлайн.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
