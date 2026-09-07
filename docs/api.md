# The aurabr.xyz API, as observed

Nothing here is documented upstream. It was read off the production client
bundle and confirmed against the live site in September 2026. Treat it as a
description of what exists today, not a contract.

Base: `https://www.aurabr.xyz`

## `GET /api/match`

Returns one duel. Query params (both optional):

| Param | Values |
|---|---|
| `kind` | `startup` (default), `vc`, `college`, `demo` |
| `exclude` | comma-separated ids to keep out of the draw |

```json
{
  "left":  { "id": "…", "slug": "cloudwalk", "name": "CloudWalk",
             "tagline": "Pagamentos para PMEs", "emoji": null,
             "logoUrl": "/startups/cloudwalk.png",
             "websiteUrl": "https://cloudwalk.io",
             "kind": "startup", "stage": "series_c", "sector": "Outras",
             "aura": 3100, "matches": 61986, "wins": 56535, "losses": 5451 },
  "right": { "…": "…" },
  "kind": "startup",
  "usingDemoData": false,
  "totalVotes": 615001
}
```

`stage` is one of `pre_seed`, `seed`, `series_a`…`series_d`, `ipo`, `acquired`,
`bootstrapped`, `unknown` — and `null` for VCs and colleges.

## `GET /api/matches?count=N`

Same payload wrapped in `{ "items": [...] }`. Useful for prefetching a few
duels in one round trip; this plugin doesn't, because the aura numbers go stale
between the fetch and the vote.

## `POST /api/vote`

**Closed to API clients as of September 2026.** The plugin no longer attempts it
beyond one plain POST, and `browserVote` defaults to `false`.

The current client sends a Cloudflare Turnstile token in a header plus a
server-issued per-match `ticket` in the body:

```js
async function lO() {
  const t = await getTurnstileToken();
  return { "Content-Type": "application/json", ...(t ? { "X-Turnstile-Token": t } : {}) };
}
fetch("/api/vote", { method: "POST", headers: await lO(),
                     body: JSON.stringify({ winnerId, loserId, ticket }) });
```

Anything without both is refused with `403 {"error":"Acesso negado."}`.

### History, and why this repo stops here

The route was previously behind Vercel BotID, which rejected `curl` and
headless Chrome but accepted a real off-screen Chrome driven over CDP — the
browser was genuine, so its own bundle signed the request. That was reported to
the aurabr team privately, together with the observation that BotID was
filtering *headless*, not *automation*, and that server-side per-session
validation was the cheap reinforcement.

They shipped it: Turnstile plus per-match tickets, and the aura ladder was
reset (CloudWalk 3100 → 1539, everything recompressed near 1500).

A CAPTCHA the owner deliberately added after being told about the gap is a
statement, not an obstacle. This repo does not solve it, does not farm it, and
does not fingerprint around it. If terminal votes should ever count, that is
aurabr's call to make — an API key with a per-key rate limit would do it, and
`browserVote` plus the pending queue are already wired for that day.

## `POST /api/suggestions`

`{ "name": "…", "website": "…" }` — submit a company for inclusion. Also
BotID-protected. Not wired up here.

## Ranking

There is no ranking endpoint. `/ranking`, `/vcs/ranking` and
`/faculdades/ranking` are server-rendered pages, so `aura.mjs ranking` parses
their HTML. The rows are `rank | name | meta? | aura | tier`, where `meta` is
`"tagline · stage"` for startups, a category for colleges, and absent for VCs.
Tiers are `S`, `A`, `B`, `C`.

This is the fragile part of the plugin. Any markup change upstream breaks it,
and it will fail loudly (empty table) rather than quietly. A real
`GET /api/ranking?kind=` would delete this whole function.

## Errors

Every unmatched path under `/api/` returns `500` with
`{"error":"Erro interno. Tenta de novo em instantes."}` rather than a 404 —
worth knowing when probing, since a 500 there means "no such route", not "the
route is broken".
