// Which demo this page is. Every demo is its own HTML page in one build (dist/demos/<id>/index.html),
// and each page's entry calls setDemo before it renders, so shared code reads the id at run time
// instead of from a build-wide constant.
export interface DemoInfo {
  // The folder under demos/, which is also the URL path: /demos/<folder>/.
  folder: string
  // True when the folder has a prompt.md; the build ships it as /demos/<folder>/prompt.md.
  hasPrompt: boolean
}

export const demo: DemoInfo = { folder: '', hasPrompt: false }

export function setDemo(info: DemoInfo): void {
  Object.assign(demo, info)
}

// utm_source for a demo. It stays dg-devrel-<folder>, the old per-demo Fly app name, so analytics
// keep one source per demo across the move to one site.
export const demoSource = (folder: string = demo.folder): string => `dg-devrel-${folder}`

// The page's own path, with the trailing slash its relative assets need.
export const demoPath = (folder: string = demo.folder): string => `/demos/${folder}/`
