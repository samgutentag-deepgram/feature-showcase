// Every outbound Deepgram link, tagged so a signup or docs visit is credited to the exact demo it
// came from, to the demo family as a whole, and to the advocate who built it.
//
// The scheme, the same for every one-feature demo:
//   utm_source    the demo's id: its Fly app name, e.g. dg-devrel-keyterm. Taken from meta.json's
//                 url at build time (__DEMO_ID__), so it always matches where the page is hosted.
//   utm_medium    demo
//   utm_campaign  devrel-demos, one campaign for the whole family so they roll up together
//   utm_content   <advocate>_<placement>_<button>, e.g. sam_gutentag_header_signup: who built
//                 the demo, where on the page the link sits, and which button it is
// In analytics: filter campaign = devrel-demos for all demos, split by source for one demo, and
// by content for the exact button. content starting with sam_gutentag_ rolls up one advocate's
// demos (and posts, which use the same prefix).
// Marketing ops owns the approved values. If they hand over a set, swap them in here.
export const ADVOCATE = 'sam_gutentag'
export const MEDIUM = 'demo'
export const CAMPAIGN = 'devrel-demos'

/** Where on the page a link sits. */
export type Placement = 'header' | 'cta' | 'footer'

/** Which button it is. With the placement, names every link on the page uniquely. */
export type Button = 'signup' | 'docs' | 'playground' | 'sales' | 'changelog'

// Only Deepgram's own sites read these tags. Shorteners and third parties get the plain URL.
const TAGGED_HOSTS = new Set([
  'deepgram.com',
  'developers.deepgram.com',
  'console.deepgram.com',
  'playground.deepgram.com',
])

export function dgLink(href: string, placement: Placement, button: Button, demo: string = __DEMO_ID__): string {
  const url = new URL(href)
  if (!TAGGED_HOSTS.has(url.hostname)) return href
  url.searchParams.set('utm_source', demo)
  url.searchParams.set('utm_medium', MEDIUM)
  url.searchParams.set('utm_campaign', CAMPAIGN)
  url.searchParams.set('utm_content', `${ADVOCATE}_${placement}_${button}`)
  return url.toString()
}

// Links every demo shares. Docs and changelog come from the feature.
export const LINKS = {
  signup: 'https://console.deepgram.com/signup',
  playground: 'https://playground.deepgram.com/',
  sales: 'https://deepgram.com/contact-us',
  discord: 'https://dpgr.am/discord',
} as const
