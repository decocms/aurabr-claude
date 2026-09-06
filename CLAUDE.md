# aura — working notes

A Claude Code plugin that surfaces aurabr.xyz duels during idle moments.
Five files do the work; keep it that way.

```
.claude-plugin/plugin.json       manifest
.claude-plugin/marketplace.json  single-plugin marketplace, source "./"
commands/{vote,ranking,config}.md
hooks/hooks.json                 registers the Stop hook
hooks/idle.mjs                   the interruption: guards → fetch → additionalContext
scripts/aura.mjs                 the only implementation. CLI + importable
scripts/browser-vote.mjs         real-Chrome vote path, over CDP, zero deps
docs/api.md                      the reverse-engineered upstream API
```

## Rules

**`scripts/aura.mjs` is the single source of truth.** The hook imports from it,
the commands shell out to it. Never reimplement a fetch, a render or the config
in a command markdown file — add a subcommand instead.

**Zero dependencies, forever.** Node 18+ stdlib only; the browser path needs
Node 22+ for the global `WebSocket` and degrades to the queue below that. A
plugin that interrupts you for a joke does not get to own a `node_modules`.

**`background_tasks` is the trigger, not `Stop` itself.** `Stop` fires on every
concluded turn, including the ones concluded while subagents and background
shells are still running — those re-invoke the model when they finish. The
non-empty case is the user waiting; the empty case is the user free. Firing on
the empty case is an interruption, and it is the bug this plugin shipped with in
0.2.0. Default stays `alsoWhenDone: false`.

**The hook must be silent when it declines.** Exit 0 with no stdout. Every
guard in `idle.mjs` — `enabled`, `stop_hook_active`, `background_tasks`,
`frequency`, `cooldownMinutes`, a failed fetch — ends in `quit()`. A hook that prints on the
way out is a hook the user uninstalls.

**`stop_hook_active` is not optional.** Without it the injected context makes
Claude respond, which fires `Stop` again, which injects again. Claude Code caps
the loop, but the cap is not the design.

**Never fake a vote, and never fake a browser.** `POST /api/vote` is behind
Vercel BotID. `vote()` tries three paths in order — plain POST, real local
Chrome, local queue — and reports which one carried it. The rules:

- Do not forge `x-is-human`, patch the UA string, or otherwise dress a
  non-browser up as one. The browser path works *because* the browser is real
  and the human owns it; that is the whole justification.
- Headless is a dead end, not a challenge. `--headless=new` reports
  `HeadlessChrome` in its UA and gets 403. Leave it.
- No silent retries, no background daemon, no batching beyond flushing the
  user's own queue on their next vote.
- Never print a success line for a queued vote. `via` says `api`, `browser`, or
  nothing at all.

## The fragile part

`ranking()` parses server-rendered HTML because there is no ranking endpoint.
Row shapes differ per kind:

| kind | row |
|---|---|
| startup | `rank \| name \| "tagline · stage" \| aura \| tier` |
| college | `rank \| name \| category \| aura \| tier` |
| vc | `rank \| name \| aura \| tier` |

One regex with an optional middle cell covers all three. When it breaks it
returns an empty table, which is the right failure — loud, not wrong. Check
`docs/api.md` before touching it.

## Testing

No framework. Run the CLI against production:

```bash
node scripts/aura.mjs match --kind vc
node scripts/aura.mjs ranking --kind college --limit 5
node scripts/browser-vote.mjs <winnerId> <loserId>   # ~10s, real vote
echo '{"stop_hook_active":false}' | \
  AURA_CONFIG=/tmp/aura-test.json CLAUDE_PLUGIN_ROOT=$PWD node hooks/idle.mjs
```

The hook is probabilistic AND gated on in-flight work, so piping it a bare
`{}` will correctly produce nothing. To exercise the real path, drive a live
session and watch when it fires:

```bash
claude -p --settings <settings with the Stop hook> \
  "Launch two Explore subagents in one message. Do NOT wait for their results
   — end your turn immediately after launching."
```

Set `frequency=1`, `cooldownMinutes=0` in a throwaway `AURA_CONFIG` for that
run. Expect it to fire while `background_tasks` is non-empty and go quiet once
it drains. `AURA_SITE` overrides the base URL; `AURA_CONFIG` overrides the config
path so tests never touch the real one.

## Style

Portuguese in anything the user reads at vote time (the site is Brazilian and
the joke does not survive translation). English in code, comments, and docs.
