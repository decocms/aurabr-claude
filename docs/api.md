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

```json
{ "winnerId": "…", "loserId": "…" }
```

**This is the part that does not work from a terminal.** The route sits behind
Vercel BotID, which signs a `x-is-human` header from the browser client. Any
request without it comes back:

```
HTTP/2 403
server-timing: botid;dur=211
{"error":"Acesso negado."}
```

So the plugin does the honest thing: it attempts the POST, and on refusal
appends the vote to `~/.claude/aura-pending.json` and says so. `aura.mjs
pending` prints the queue. Nothing retries it silently, and nothing pretends
the vote landed.

If aurabr ever wants terminal votes to count, the smallest change on their side
is an API key with a per-key rate limit that bypasses BotID for that route.
Until then the queue is a record of intent, not a ballot box.

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
