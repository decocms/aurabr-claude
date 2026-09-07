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

Needs Node 18+. No dependencies, no build step, no API key.

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
| `browserVote` | `false` | Legacy Chrome path — dead since Turnstile, see below |

`autoResearch` turns every duel into a small briefing. `logos` is best-effort
ASCII art — Claude downloads both logos, looks at them, and sketches them in
about six lines. It fails silently when it fails, which is often enough that it
stays off by default.

Too chatty: `/aura:config frequency=0.2`. Done with it: `/aura:config
enabled=false`.

## About your votes

**They do not reach the leaderboard.** Everything else does work — the duels,
the research, all three rankings.

`POST /api/vote` now requires a Cloudflare Turnstile token plus a server-issued
per-match ticket, so only the site itself can cast a vote. The plugin tries one
plain POST, and on refusal appends to `~/.claude/aura-pending.json` and says so
plainly. Nothing retries, nothing pretends a vote landed, and the failure takes
about a tenth of a second.

It was not always this way, and the history is the honest part. The route used
to sit behind Vercel BotID, which turned away `curl` and headless Chrome but
accepted a real off-screen Chrome driven over CDP — a genuine browser signing
its own request. That got reported to the aurabr team privately, along with the
point that BotID was filtering *headless* rather than *automation*. They shipped
the fix: Turnstile, per-match tickets, and a reset ladder.

Which is the right outcome, and it is where this repo stops. A CAPTCHA the
owner added deliberately after being told about the gap is a statement, not an
obstacle. `scripts/browser-vote.mjs` stays in the tree behind `browserVote`,
off by default, for the day aurabr decides terminal votes should count — an API
key with a per-key rate limit is all it would take, and the pending queue is
already wired for it.

Vote at [aurabr.xyz](https://www.aurabr.xyz). The duel the plugin showed you is
still in the ranking.

`docs/api.md` has the full reverse-engineered API and the timeline.

## Credits

aurabr.xyz is not mine — I just liked it enough to build a terminal for it.

MIT.
