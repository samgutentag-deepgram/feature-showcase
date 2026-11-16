See AGENTS.md.

Claude Code specifics: preview a demo with `FEATURE=<demo> pnpm dev` (or any demo at
`/demos/<demo>/`). Never trigger audio playback in a browser check unless Sam asks. Don't commit `samples/`; it
holds macOS-voice audio for local testing only. Deploys are Sam's: hand him the
`scripts/deploy.sh site` or `redirects` command rather than running `fly deploy`.
