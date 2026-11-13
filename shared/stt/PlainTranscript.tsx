// Building blocks for a feature's Result: the empty state, and a transcript as one block of text.
import { useEffect, useRef } from 'react'
import type { Word } from '../common/feature'

export function EmptyTranscript({ live, text }: { live: boolean; text: string }) {
  return (
    <div className="transcript transcript--empty">
      <div className="empty__art" aria-hidden="true" />
      <p>{live ? 'Listening…' : text}</p>
    </div>
  )
}

interface Props {
  committed: readonly Word[]
  pending: readonly Word[]
  live: boolean
  emptyText: string
}

export function PlainTranscript({ committed, pending, live, emptyText }: Props) {
  const end = useRef<HTMLDivElement>(null)
  const count = committed.length + pending.length

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [count])

  if (count === 0) return <EmptyTranscript live={live} text={emptyText} />

  return (
    <div className="transcript" aria-live="polite">
      <p className="transcript__text">
        {[...committed, ...pending].map((w, i) => (
          <span key={i} className={w.pending ? 'word word--pending' : 'word'}>
            {w.text}{' '}
          </span>
        ))}
      </p>
      <div ref={end} />
    </div>
  )
}
