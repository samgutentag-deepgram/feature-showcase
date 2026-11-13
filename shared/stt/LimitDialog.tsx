import { useEffect, useRef } from 'react'
import { MAX_SECONDS, MAX_UPLOAD_BYTES, clock, formatMB } from '../common/config'

interface Props {
  // Why the clip was refused, e.g. "That clip runs 1:33." Null keeps the dialog closed.
  reason: string | null
  onClose(): void
}

// The limits stay out of the way until a clip breaks one.
export function LimitDialog({ reason, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (reason && !d.open) d.showModal()
    if (!reason && d.open) d.close()
  }, [reason])

  return (
    <dialog ref={ref} className="limit" onClose={onClose} aria-labelledby="limit-title">
      <h2 id="limit-title">Keep test clips short</h2>
      <p>
        {reason} This demo takes clips up to {clock(MAX_SECONDS)} and {formatMB(MAX_UPLOAD_BYTES)}. Trim it
        and try again.
      </p>
      <p className="limit__aside">Need longer audio? Clone the app and run it yourself; the limits are one line to change.</p>
      <form method="dialog">
        <button className="btn btn--primary">OK</button>
      </form>
    </dialog>
  )
}
