import { memo, useEffect, useRef } from 'react'
import type { Word } from '../../shared/common/feature'
import { EmptyTranscript } from '../../shared/stt/PlainTranscript'
import { baseLang, languageName, slotFor } from './pairs'

interface Props {
  committed: readonly Word[]
  pending: readonly Word[]
  // The pair picked for this run: sets which language gets which color.
  order: readonly string[]
  // Flux tags languages once per turn, not per word: show the words plain and the turn's languages.
  perTurn: boolean
  turnLanguages: readonly string[]
  live: boolean
}

// One running sentence, every word underlined in its language's color, with the language code
// printed where a switch happens.
export const WordsByLanguage = memo(function WordsByLanguage({ committed, pending, order, perTurn, turnLanguages, live }: Props) {
  const words = [...committed, ...pending]
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [words.length])

  if (words.length === 0) {
    return <EmptyTranscript live={live} text="Your transcript shows up here, each word colored by its language." />
  }

  if (perTurn) {
    return (
      <div className="transcript cs" aria-live="polite">
        <p className="transcript__text">
          {words.map((w, i) => (
            <span key={i} className={w.pending ? 'word word--pending' : 'word'}>
              {w.text}{' '}
            </span>
          ))}
        </p>
        <div className="cs__legend">
          <span className="cs__legend-label">Languages in this turn</span>
          {turnLanguages.length ? (
            turnLanguages.map((l) => (
              <span key={l} className="cs__chip" data-slot={slotFor(l, order)}>
                {languageName(l)} <code>{l}</code>
              </span>
            ))
          ) : (
            <span className="cs__chip" data-slot="unknown">Detecting</span>
          )}
        </div>
        <div ref={end} />
      </div>
    )
  }

  const heard = [...new Set(words.map((w) => w.lang && baseLang(w.lang)).filter(Boolean))]
  return (
    <div className="transcript cs" aria-live="polite">
      <p className="transcript__text cs__words">
        {words.map((w, i) => {
          const switched = w.lang && (i === 0 || baseLang(words[i - 1].lang) !== baseLang(w.lang))
          return (
            <span key={i} className={w.pending ? 'cs__word word word--pending' : 'cs__word word'} data-slot={slotFor(w.lang, order)} title={w.lang || undefined}>
              {switched && <sup className="cs__code">{w.lang}</sup>}
              {w.text}
            </span>
          )
        })}
      </p>
      <div className="cs__legend">
        {heard.map((l) => (
          <span key={l} className="cs__chip" data-slot={slotFor(l, order)}>
            {languageName(l)} <code>{l}</code>
          </span>
        ))}
      </div>
      <div ref={end} />
    </div>
  )
})
