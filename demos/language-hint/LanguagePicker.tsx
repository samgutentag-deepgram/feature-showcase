import { languageName } from './languages'

interface Props {
  label: string
  value: string
  options: readonly string[]
  exclude: string
  disabled: boolean
  slot: '1' | '2'
  onChange(code: string): void
}

export function LanguagePicker({ label, value, options, exclude, disabled, slot, onChange }: Props) {
  const sorted = [...options].sort((a, b) => languageName(a).localeCompare(languageName(b)))
  return (
    <label className="picker" data-slot={slot}>
      <span className="picker__label">{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {sorted.map((code) => (
          <option key={code} value={code} disabled={code === exclude}>
            {languageName(code)}
          </option>
        ))}
      </select>
    </label>
  )
}
