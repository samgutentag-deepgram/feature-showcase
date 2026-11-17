// Filter the tiles on / by product chip and by typed text. The page works without this.
// The chip is in the URL, /?product=voice-agent, so a filtered view can be shared.
const input = document.querySelector<HTMLInputElement>('.search')
const chips = [...document.querySelectorAll<HTMLButtonElement>('.chip')]
const tiles = [...document.querySelectorAll<HTMLElement>('.grid:not(.grid--soon) .tile')]
const soonTiles = [...document.querySelectorAll<HTMLElement>('.tile--soon')]
const soon = document.querySelector<HTMLElement>('.soon')
const soonCount = document.querySelector<HTMLElement>('.soon-count')
const empty = document.querySelector<HTMLElement>('.empty')

let product = ''

const slug = (p: string) => p.toLowerCase().replace(/[^a-z0-9]+/g, '-')

const select = (c: HTMLButtonElement) => {
  product = c.dataset.product ?? ''
  for (const o of chips) o.setAttribute('aria-pressed', String(o === c))
}

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
    select(c)
    const url = new URL(location.href)
    if (product) url.searchParams.set('product', slug(product))
    else url.searchParams.delete('product')
    history.replaceState(null, '', url)
    apply()
  })
}

// An unknown or disabled ?product= leaves the page on All.
const wanted = new URLSearchParams(location.search).get('product')
const start = wanted ? chips.find((c) => c.dataset.product && !c.disabled && slug(c.dataset.product) === wanted) : undefined
if (start) {
  select(start)
  apply()
}
input?.addEventListener('input', apply)
