// "Build this yourself": copies the feature's prompt.md, which vite.config.ts ships as /prompt.md.
// The prompt is generated from the feature and checked live (shared/common/prompt.ts), so what a
// visitor pastes into their coding agent matches what this page sends.
import { useState } from 'react'

function copyBySelection(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

export function TakeHome() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  if (!__HAS_PROMPT__) return null

  const copy = async () => {
    try {
      const res = await fetch('/prompt.md')
      if (!res.ok) throw new Error(String(res.status))
      const text = await res.text()
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        // Some browsers and embedded views refuse the async clipboard; a selected textarea still copies.
        if (!copyBySelection(text)) throw new Error('copy refused')
      }
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  return (
    <div className="takehome">
      <p className="takehome__copy">
        Add this to your own app: paste the build prompt into Claude Code, Cursor, or Codex.
      </p>
      <div className="takehome__actions">
        <button type="button" className="btn btn--light" onClick={copy}>
          {state === 'copied' ? 'Copied' : 'Copy the build prompt'}
        </button>
        <a className="takehome__link" href="/prompt.md" target="_blank" rel="noopener">
          View it
        </a>
      </div>
      {state === 'failed' && (
        <p className="takehome__copy takehome__alert" role="alert">
          Your browser blocked the copy. Open "View it" and copy from there.
        </p>
      )}
    </div>
  )
}
