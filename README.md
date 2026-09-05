# aura

A Claude Code plugin that spends your dead time on
[aurabr.xyz](https://www.aurabr.xyz) — the aura ranking of Brazilian startups.

You are already waiting. A subagent is grinding through a codebase, a build is
running, a turn just ended and you are staring at the prompt. That is when the
plugin taps you on the shoulder with two companies and one question: *quem tem
mais aura?*

```
  ✦  A U R A   B R E A K  ✦  616.384 votos até agora

  ┌─ 1 ────────────────────────────────┐   ┌─ 2 ────────────────────────────────┐
  │ Tela                               │   │ iFood                              │
  │ Automações com IA                  │   │ Delivery de comida                 │
  │                                    │   │                                    │
  │ Seed  ·  1487 aura                 │   │ Series D+  ·  1458 aura            │
  │ 8411/11285 duelos · 75% win        │   │ 8578/12691 duelos · 68% win        │
  │ tela.com                           │   │ ifood.com.br                       │
  └────────────────────────────────────┘   └────────────────────────────────────┘
```

Pick one. Or pick `Pesquisar as duas` and Claude reads both websites and writes
you a paragraph on each first — a thirty-second education on a company you had
never heard of, taken out of a minute you were losing anyway.

## Install

```
/plugin marketplace add decocms/aurabr-claude
/plugin install aura@aurabr
```

Needs Node 18+ (global `fetch`). No dependencies, no build step, no API key.

## Commands

| Command | What it does |
|---|---|
| `/aura:vote` | Pull a duel right now. `--kind vc\|college`, `--research` |
| `/aura:ranking` | The full ranking in your terminal. `--kind`, `--limit` |
| `/aura:config` | Read or change how often it interrupts you |

## How the interruption works

A `Stop` hook — the one Claude Code fires right before it concludes a response.
`hooks/idle.mjs` checks, in order: is the plugin enabled, did it already fire
this turn, did the dice land under `frequency`, has `cooldownMinutes` elapsed.
If any check fails it exits silently and costs you nothing. If all pass it
fetches a duel and injects it as context, and Claude asks before it stops.

That means the interruption lands exactly where an interruption is cheap: at
the end of work, not in the middle of it.

## Config

`~/.claude/aura.json`, or `/aura:config key=value`.

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch |
| `frequency` | `0.35` | Chance an idle moment becomes a prompt |
| `cooldownMinutes` | `20` | Hard floor between two prompts |
| `kind` | `startup` | `startup`, `vc`, or `college` |
| `autoResearch` | `false` | Always research both before asking |
| `logos` | `false` | Sketch the logos as ASCII above the cards |

`autoResearch` turns every duel into a small briefing. `logos` is best-effort
ASCII art — Claude downloads both logos, looks at them, and sketches them in
about six lines. It fails silently when it fails, which is often enough that it
stays off by default.

Too chatty: `/aura:config frequency=0.1`. Done with it: `/aura:config
enabled=false`.

## About your votes

**They do not reach the leaderboard yet.** `POST /api/vote` on aurabr.xyz is
behind Vercel BotID, which signs a header only a real browser can produce. A
request from your terminal gets `403 Acesso negado.`

So the plugin attempts the vote, and when it bounces it appends to
`~/.claude/aura-pending.json` and tells you plainly. Run `node
scripts/aura.mjs pending` to see the queue. Nothing retries in the background,
and nothing claims a vote landed when it did not.

The fix is on aurabr's side and it is small — an API key with a per-key rate
limit that skips BotID for that one route. If that ever ships, this plugin
flushes the queue and the votes count. Until then, treat the queue as a record
of taste. The duels, the research and the rankings all work regardless.

`docs/api.md` has the full reverse-engineered API, including what breaks and
why.

## Credits

aurabr.xyz is not mine — I just liked it enough to build a terminal for it.

MIT.
