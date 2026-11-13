// A row of up to five settings, least to most, with the middle one as normal. Each button names the
// setting in words and shows its value underneath ("Slower" over "0.85x").
export interface Step<V> {
  name: string
  detail: string
  value: V
}

export function Steps<V>({ label, steps, value, onPick, disabled }: { label: string; steps: Step<V>[]; value: V; onPick(v: V): void; disabled?: boolean }) {
  return (
    <div className="tts-steps" role="radiogroup" aria-label={label}>
      {steps.map((s) => (
        <button
          key={String(s.value)}
          role="radio"
          aria-checked={s.value === value}
          className={s.value === value ? 'tts-step is-on' : 'tts-step'}
          disabled={disabled}
          onClick={() => onPick(s.value)}
        >
          <span className="tts-step__name">{s.name}</span>
          <span className="tts-step__detail">{s.detail}</span>
        </button>
      ))}
    </div>
  )
}
