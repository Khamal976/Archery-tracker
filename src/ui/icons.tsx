/**
 * Иконки меню — однотонные линейные, рисуются currentColor.
 * Эмодзи не годятся: часть из них цветные, часть нет, и набор выглядит разнородным.
 */
const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconTarget() {
  return (
    <svg {...base} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconChart() {
  return (
    <svg {...base} aria-hidden>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M7.5 15.5l3.5-4.5 3 2.5 4.5-6" />
    </svg>
  )
}

export function IconTune() {
  return (
    <svg {...base} aria-hidden>
      <path d="M5 6h14M5 12h14M5 18h14" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="8" cy="18" r="2" />
    </svg>
  )
}

export function IconGear() {
  return (
    <svg {...base} aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6" />
    </svg>
  )
}
