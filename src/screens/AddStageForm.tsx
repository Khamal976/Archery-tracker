import { useEffect, useState } from 'react'
import type { Stage, TargetFace } from '../core/types'
import { addStage } from '../db/repo'
import { Button, Field, Modal } from '../ui/atoms'

/** Смена дистанции или фейса внутри свободной тренировки — это новый этап той же сессии. */
export function AddStageForm({
  open,
  onClose,
  sessionId,
  faces,
  previous,
}: {
  open: boolean
  onClose: () => void
  sessionId: string
  faces: TargetFace[]
  previous: Stage
}) {
  const [distance, setDistance] = useState(String(previous.distanceM))
  const [faceId, setFaceId] = useState(previous.faceId)
  const [arrows, setArrows] = useState(String(previous.arrowsPerEnd))

  useEffect(() => {
    if (!open) return
    setDistance(String(previous.distanceM))
    setFaceId(previous.faceId)
    setArrows(String(previous.arrowsPerEnd))
  }, [open, previous])

  const distanceM = Number(distance.replace(',', '.'))
  const arrowsPerEnd = Number(arrows)
  const ready =
    Number.isFinite(distanceM) && distanceM > 0 && Number.isFinite(arrowsPerEnd) && arrowsPerEnd >= 1

  const submit = async () => {
    if (!ready) return
    await addStage(sessionId, {
      distanceM,
      faceId,
      ends: null,
      arrowsPerEnd: Math.round(arrowsPerEnd),
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Новый этап">
      <div className="grid gap-3">
        <Field label="Дистанция, м">
          <input
            inputMode="decimal"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        </Field>
        <Field label="Фейс">
          <select value={faceId} onChange={(e) => setFaceId(e.target.value)}>
            {faces.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Стрел в серии">
          <input inputMode="numeric" value={arrows} onChange={(e) => setArrows(e.target.value)} />
        </Field>
        <p className="text-xs text-muted">
          Метрики нового этапа считаются по его дистанции; между этапами сравнение только в mrad.
        </p>
        <Button variant="primary" onClick={submit} disabled={!ready}>
          Добавить этап
        </Button>
      </div>
    </Modal>
  )
}
