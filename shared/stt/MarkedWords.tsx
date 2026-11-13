import type { Word } from '../common/feature'

// A live transcript that wraps every word matching `match` in <mark className={className}>.
// Pending (interim) words render dimmed, as in PlainTranscript. Style the mark in the feature's
// styles.css with var(--dg-*) colors.
export function MarkedWords({ words, match, className }: { words: readonly Word[]; match: RegExp; className: string }) {
  return (
    <>
      {words.map((w, i) => (
        <span key={i} className={w.pending ? 'word word--pending' : 'word'}>
          {match.test(w.text) ? <mark className={className}>{w.text}</mark> : w.text}{' '}
        </span>
      ))}
    </>
  )
}
