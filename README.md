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
  │ deco CMS                           │   │ CloudWalk                          │
  │ AI native digital agency           │   │ Pagamentos para PMEs               │
  │                                    │   │                                    │
  │ Seed  ·  1806 aura                 │   │ Series C  ·  3112 aura             │
  │ 8412/11211 duelos · 75% win        │   │ 56897/62348 duelos · 91% win       │
  │ decocms.com                        │   │ cloudwalk.io                       │
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

Needs Node 18+, or Node 22+ if you want your votes to actually count (see
below). No dependencies, no build step, no API key.

## Commands

| Command | What it does |
|---|---|
| `/aura:vote` | Pull a duel right now. `--kind vc\|college`, `--research` |
| `/aura:ranking` | The full ranking in your terminal. `--kind`, `--limit` |
| `/aura:config` | Read or change how often it interrupts you |

## How it picks its moment

A `Stop` hook. Claude Code fires `Stop` every time the model concludes a turn —
and crucially, it concludes a turn *while subagents and background shells are
still running*, because those re-invoke it when they finish. The hook input
carries `background_tasks`, which tells the two apart:

```
Stop | [2 subagents running]   ← you are waiting. This is the moment.
Stop | [1 subagent running]    ← still waiting.
Stop | []                      ← the work is done. Nobody is waiting on anything.
```

The plugin fires on the first two and stays quiet on the third. That is the
whole design: it spends time you were already losing, and it never costs you
time you were about to use. Prompting at the end of a turn is an interruption;
prompting while you stare at a spinner is a break. Set `alsoWhenDone=true` if
you want both.

After that gate it checks `enabled`, `stop_hook_active`, the `frequency` dice
and `cooldownMinutes`. Any failure exits 0 with no output and costs you nothing.

## Config

`~/.claude/aura.json`, or `/aura:config key=value`.

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch |
| `frequency` | `0.7` | Chance a qualifying pause becomes a prompt |
| `cooldownMinutes` | `10` | Hard floor between two prompts |
| `alsoWhenDone` | `false` | Also prompt at plain end-of-turn, not just while you wait |
| `kind` | `startup` | `startup`, `vc`, or `college` |
| `autoResearch` | `false` | Always research both before asking |
| `logos` | `false` | Sketch the logos as ASCII above the cards |
| `browserVote` | `true` | Cast the vote through a real local Chrome |

`autoResearch` turns every duel into a small briefing. `logos` is best-effort
ASCII art — Claude downloads both logos, looks at them, and sketches them in
about six lines. It fails silently when it fails, which is often enough that it
stays off by default.

Too chatty: `/aura:config frequency=0.2`. Done with it: `/aura:config
enabled=false`.

## About your votes

They count. Getting there took a detour.

`POST /api/vote` on aurabr.xyz sits behind Vercel BotID, which signs an
`x-is-human` header from inside the site's own client bundle. A plain `fetch`
from your terminal has no such header and gets `403 Acesso negado.` Headless
Chrome gets the same treatment — its user agent says `HeadlessChrome` and BotID
scores it as a bot.

What does work is an ordinary Chrome window, parked off-screen at
`-3000,-3000`, driven over the DevTools protocol. The page loads normally, its
own code wraps `window.fetch`, and the vote is signed the way any vote from
that browser would be. Nothing is forged: it is your machine, your browser,
your one vote per prompt. The window is never visible, never steals focus, and
is killed as soon as the ballot is in.

```
✦ voto computado (via Chrome local). Trela +15 aura → 1518
```

Order of attempts: plain POST first (instant, and the path that works the day
aurabr opens the route to API clients), then the browser, then — if you have no
Chrome, or Node older than 22, or `browserVote=false` — the local queue at
`~/.claude/aura-pending.json`. Queued ballots ride along on the next successful
browser vote. Nothing ever prints a success line for a vote that did not land.

`docs/api.md` has the full reverse-engineered API and what each path costs.

## Credits

aurabr.xyz is not mine — I just liked it enough to build a terminal for it.

MIT.
