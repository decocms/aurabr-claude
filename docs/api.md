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

Returns the updated pair plus the Elo swing:

```json
{ "winner": { "…": "…", "aura": 1518 }, "loser": { "…": "…" },
  "winnerDelta": 15, "loserDelta": -15 }
```

The route sits behind Vercel BotID. The site's client bundle wraps
`window.fetch` and attaches a signed `x-is-human` header (plus `x-path` and
`x-method`); anything without it is refused:

```
HTTP/2 403
server-timing: botid;dur=211
{"error":"Acesso negado."}
```

Measured, September 2026:

| Client | Result |
|---|---|
| `curl` / `fetch` from Node | `403` |
| Chrome `--headless=new` over CDP | `403` — UA reads `HeadlessChrome/152` |
| Real Chrome window, off-screen, over CDP | `200` |

So `scripts/browser-vote.mjs` launches a genuine Chrome with a throwaway
profile at `--window-position=-3000,-3000`, waits for `window.fetch` to stop
being native code (that wrapper *is* the signature), and calls the endpoint
from inside the page. No header is forged and no fingerprint is faked — the
browser is real, the human owns it, and the round trip costs about ten seconds
of cold start.

`--headless=old` and `chrome-headless-shell` are not worth trying; both
advertise themselves the same way.

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
