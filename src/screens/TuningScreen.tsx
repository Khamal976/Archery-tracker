import { useEffect, useState } from 'react'
import { navigate } from '../app/router'
import { TUNING, type TuningBlock, type TuningSection } from '../core/tuning'
import { Button, Card, Note } from '../ui/atoms'
import { TuningFigure } from '../ui/TuningFigures'

/** База сборки: приложение может жить в подпапке хостинга. */
const ASSETS = import.meta.env.BASE_URL

/** Просмотр иллюстрации на весь экран: на телефоне мелкие детали иначе не разглядеть. */
function Lightbox({ src, caption, onClose }: { src: string; caption: string; onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-3"
    >
      <img src={src} alt={caption} className="max-h-[85vh] max-w-full object-contain" />
      <span className="text-center text-sm text-[#cfc9bf]">{caption}</span>
    </button>
  )
}

function Photos({
  items,
  onOpen,
}: {
  items: { src: string; caption: string }[]
  onOpen: (src: string, caption: string) => void
}) {
  const cols = items.length === 1 ? 'sm:grid-cols-1' : items.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
  return (
    <div className={`grid gap-2 ${cols}`}>
      {items.map((it) => (
        <figure key={it.src} className="overflow-hidden rounded-xl border border-line">
          <button
            onClick={() => onOpen(`${ASSETS}tuning/${it.src}`, it.caption)}
            className="block w-full"
            aria-label={`Открыть: ${it.caption}`}
          >
            <img
              src={`${ASSETS}tuning/${it.src}`}
              alt={it.caption}
              loading="lazy"
              className="block max-h-80 w-full bg-surface2 object-contain"
            />
          </button>
          <figcaption className="px-2 py-1.5 text-xs text-muted">{it.caption}</figcaption>
        </figure>
      ))}
    </div>
  )
}

function Block({
  block,
  onOpen,
}: {
  block: TuningBlock
  onOpen: (src: string, caption: string) => void
}) {
  switch (block.kind) {
    case 'text':
      return <p className="text-[15px] leading-relaxed">{block.text}</p>

    case 'steps':
      return (
        <div>
          {block.title && <h4 className="mb-1 font-semibold">{block.title}</h4>}
          <ol className="grid gap-1.5 text-[15px] leading-relaxed">
            {block.items.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="num shrink-0 text-accent">{i + 1}.</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      )

    case 'list':
      return (
        <div>
          {block.title && <h4 className="mb-1 font-semibold">{block.title}</h4>}
          <ul className="grid gap-1 text-[15px] leading-relaxed">
            {block.items.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 text-accent">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )

    case 'notes':
      return (
        <div className="rounded-lg bg-surface2 p-3">
          <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
            На заметку
          </h4>
          <ul className="grid gap-1 text-sm leading-relaxed text-muted">
            {block.items.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0">—</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )

    case 'compare':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {[block.left, block.right].map((col) => (
            <div key={col.title} className="rounded-lg border border-line p-3">
              <h4 className="mb-1 font-semibold">{col.title}</h4>
              <ul className="grid gap-1 text-sm text-muted">
                {col.items.map((t, i) => (
                  <li key={i}>— {t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )

    case 'table':
      return (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="pb-1 text-left font-normal">{block.head[0]}</th>
              <th className="pb-1 text-left font-normal">{block.head[1]}</th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i} className="border-t border-line align-top">
                <td className="py-1.5 pr-3">{r[0]}</td>
                <td className="py-1.5 text-accent">{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )

    case 'figure':
      return <TuningFigure figure={block.figure} />

    case 'photo':
      return <Photos items={block.items} onOpen={onOpen} />
  }
}

function SectionCard({
  section,
  open,
  onOpen,
}: {
  section: TuningSection
  open: boolean
  onOpen: (src: string, caption: string) => void
}) {
  const [expanded, setExpanded] = useState(open)
  useEffect(() => {
    if (open) setExpanded(true)
  }, [open])

  return (
    <Card
      className={open ? 'border-accent' : ''}
      title={
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <span className="mt-0.5 text-accent">{expanded ? '▾' : '▸'}</span>
          <span className="min-w-0">
            <span className="block font-semibold">{section.title}</span>
            <span className="block text-sm font-normal text-muted">{section.summary}</span>
          </span>
        </button>
      }
    >
      {expanded && (
        <div className="grid gap-4">
          {section.blocks.map((b, i) => (
            <Block key={i} block={b} onOpen={onOpen} />
          ))}
        </div>
      )}
    </Card>
  )
}

export function TuningScreen({ sectionId }: { sectionId?: string }) {
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null)
  const open = (src: string, caption: string) => setLightbox({ src, caption })

  useEffect(() => {
    if (!sectionId) return
    const el = document.getElementById(`tuning-${sectionId}`)
    el?.scrollIntoView({ block: 'start' })
  }, [sectionId])

  return (
    <div className="grid gap-3">
      <Card title="Настройка лука">
        <img
          src={`${ASSETS}tuning/cover.jpg`}
          alt="Рекурсивный лук с тетивой"
          className="mb-3 max-h-40 w-full rounded-xl object-contain"
        />
        <Note>
          Личный конспект по настройке рекурсивного классического лука. Порядок разделов —
          это и есть порядок настройки: сначала центровка плечей, потом база, тиллер, насечки,
          центр-шот и планжер. Фотографии и рисунки — из исходного документа, тап по любой
          открывает её на весь экран.
        </Note>
        <div className="mt-3 flex flex-wrap gap-2">
          {TUNING.map((s) => (
            <Button
              key={s.id}
              variant={s.id === sectionId ? 'primary' : 'ghost'}
              onClick={() => navigate(`/tuning/${s.id}`)}
            >
              {s.title}
            </Button>
          ))}
        </div>
      </Card>

      {TUNING.map((s) => (
        <div key={s.id} id={`tuning-${s.id}`} className="scroll-mt-3">
          <SectionCard section={s} open={s.id === sectionId} onOpen={open} />
        </div>
      ))}

      {lightbox && (
        <Lightbox
          src={lightbox.src}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
