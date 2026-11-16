// Filter the tiles on / by product chip and by typed text. The page works without this.
const input = document.querySelector<HTMLInputElement>('.search')
const chips = [...document.querySelectorAll<HTMLButtonElement>('.chip')]
const tiles = [...document.querySelectorAll<HTMLElement>('.grid:not(.grid--soon) .tile')]
const soonTiles = [...document.querySelectorAll<HTMLElement>('.tile--soon')]
const soon = document.querySelector<HTMLElement>('.soon')
const soonCount = document.querySelector<HTMLElement>('.soon-count')
const empty = document.querySelector<HTMLElement>('.empty')

let product = ''

const show = (list: HTMLElement[], q: string) => {
  let shown = 0
  for (const t of list) {
    const hit = (!product || t.dataset.product === product) && (!q || (t.dataset.search ?? '').includes(q))
    t.hidden = !hit
    if (hit) shown++
  }
  return shown
}

const apply = () => {
  const q = (input?.value ?? '').trim().toLowerCase()
  const shown = show(tiles, q)
  if (empty) empty.hidden = shown > 0
  const soonShown = show(soonTiles, q)
  if (soon) soon.hidden = soonShown === 0
  if (soonCount) {
    soonCount.textContent = soonShown === 1 ? 'This 1 feature already works' : `These ${soonShown} features already work`
  }
}

for (const c of chips) {
  c.addEventListener('click', () => {
    product = c.dataset.product ?? ''
    for (const o of chips) o.setAttribute('aria-pressed', String(o === c))
    apply()
  })
}
input?.addEventListener('input', apply)
