import { memo, useEffect, useRef } from 'react'
import type { Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import { languageName } from './languages'
import { baseLang, colorOrder, groupByLanguage } from './segments'

interface Props {
  // Kept as two arrays so a re-render that changes neither skips this component.
  committed: readonly Word[]
  pending: readonly Word[]
  hints: readonly string[]
  live: boolean
}

// Which color a row gets: first language, second, or anything after that.
function slotFor(lang: string, order: readonly string[]): string {
  if (!lang) return 'unknown'
  const i = order.indexOf(baseLang(lang))
  return i === 0 ? '1' : i === 1 ? '2' : 'other'
}

export const Transcript = memo(function Transcript({ committed, pending, hints, live }: Props) {
  const words = [...committed, ...pending]
  const end = useRef<HTMLDivElement>(null)
  const rows = groupByLanguage(words)
  const order = colorOrder(hints, words)

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [words.length])

  if (rows.length === 0) {
    return <EmptyTranscript live={live} text="Your transcript shows up here, one row per language." />
  }

  return (
    <div className="transcript" aria-live="polite">
      {rows.map((row, i) => (
        <div className="row" data-slot={slotFor(row.lang, order)} key={i}>
          <p className="row__words">
            {row.words.map((w, j) => (
              <span key={j} className={w.pending ? 'word word--pending' : 'word'}>
                {w.text}{' '}
              </span>
            ))}
          </p>
          <div className="row__tag">
            <span className="chip">{row.lang ? languageName(row.lang) : 'Detecting'}</span>
            {row.lang && <span className="row__code">{row.lang}</span>}
          </div>
        </div>
      ))}
      <div ref={end} />
    </div>
  )
})
