import { lazy, Suspense } from 'react'
import { navigate, segments, useRoute } from './app/router'
import { useSettings, useThemeEffect } from './app/useSettings'
import type { ThemeName } from './core/types'
import { IconChart, IconGear, IconTarget, IconTune } from './ui/icons'
import { ThemeToggle } from './ui/ThemeToggle'
import { FacesScreen } from './screens/FacesScreen'
import { FeedbackScreen } from './screens/FeedbackScreen'
import { HomeScreen } from './screens/HomeScreen'
import { NewSessionScreen } from './screens/NewSessionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SetupScreen } from './screens/SetupScreen'
import { SetupsScreen } from './screens/SetupsScreen'
import { ShootScreen } from './screens/ShootScreen'
import { TuningScreen } from './screens/TuningScreen'

// Графики тянут за собой Recharts — на экране ввода он не нужен, грузим по требованию.
const SessionReportScreen = lazy(() =>
  import('./screens/SessionReportScreen').then((m) => ({ default: m.SessionReportScreen })),
)
const StatsScreen = lazy(() =>
  import('./screens/StatsScreen').then((m) => ({ default: m.StatsScreen })),
)
// Справочник древков и луков весит больше самого экрана — грузим вместе с ним.
const SpineScreen = lazy(() =>
  import('./screens/SpineScreen').then((m) => ({ default: m.SpineScreen })),
)

const NAV = [
  { path: '/', label: 'Сессии', Icon: IconTarget },
  { path: '/stats', label: 'Статистика', Icon: IconChart },
  { path: '/setups', label: 'Сетапы', Icon: IconTune },
  { path: '/settings', label: 'Настройки', Icon: IconGear },
]

function Nav({ route, theme }: { route: string; theme: ThemeName }) {
  const active = (p: string) => (p === '/' ? route === '/' : route.startsWith(p))
  return (
    <>
      {/* Телефон: нижняя панель под большим пальцем. */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface lg:hidden">
        {NAV.map((n) => (
          <button
            key={n.path}
            onClick={() => navigate(n.path)}
            className={`tap flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] ${
              active(n.path) ? 'text-accent' : 'text-muted'
            }`}
          >
            <n.Icon />
            {n.label}
          </button>
        ))}
      </nav>

      {/* Десктоп: боковая колонка, контент шире. */}
      <nav className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col gap-1 border-r border-line bg-surface p-3 lg:flex">
        <div className="px-3 py-4 text-sm font-semibold tracking-wide text-muted uppercase">
          Трекинг стрельбы
        </div>
        {NAV.map((n) => (
          <button
            key={n.path}
            onClick={() => navigate(n.path)}
            className={`tap flex items-center gap-3 rounded-xl px-3 text-left text-[15px] ${
              active(n.path) ? 'bg-surface2 text-accent' : 'text-muted'
            }`}
          >
            <n.Icon />
            {n.label}
          </button>
        ))}
        <div className="mt-auto px-1 pb-1">
          <ThemeToggle theme={theme} className="w-full" />
        </div>
      </nav>
    </>
  )
}

export function App() {
  const settings = useSettings()
  useThemeEffect(settings.theme)
  const route = useRoute()
  const seg = segments(route)

  // Экран ввода занимает весь экран: на рубеже интерфейсного мусора быть не должно.
  if (seg[0] === 'shoot' && seg[1]) return <ShootScreen sessionId={seg[1]} />

  let screen = <HomeScreen />
  if (seg[0] === 'new') screen = <NewSessionScreen />
  else if (seg[0] === 'session' && seg[1]) screen = <SessionReportScreen sessionId={seg[1]} />
  else if (seg[0] === 'stats') screen = <StatsScreen />
  else if (seg[0] === 'setups' && seg[1]) screen = <SetupScreen setupId={seg[1]} />
  else if (seg[0] === 'setups') screen = <SetupsScreen />
  else if (seg[0] === 'faces') screen = <FacesScreen />
  else if (seg[0] === 'tuning') screen = <TuningScreen sectionId={seg[1]} />
  else if (seg[0] === 'spine') screen = <SpineScreen />
  else if (seg[0] === 'feedback') screen = <FeedbackScreen />
  else if (seg[0] === 'settings') screen = <SettingsScreen />

  return (
    <div className="min-h-full bg-bg text-ink">
      <Nav route={route} theme={settings.theme} />
      <main className="safe-top pb-24 lg:ml-56 lg:pb-6">
        <div className="mx-auto max-w-6xl px-3 pt-3">
          <Suspense fallback={<div className="p-6 text-muted">Загрузка…</div>}>{screen}</Suspense>
        </div>
      </main>
    </div>
  )
}
