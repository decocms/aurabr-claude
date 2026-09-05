---
description: Read or change how often aura interrupts you
argument-hint: "[key=value ...]"
---

# /aura:config

Config lives in `~/.claude/aura.json`. With no arguments this prints the
effective config; with `key=value` pairs it writes them and prints the result.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/aura.mjs" config $ARGUMENTS
```

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch for the idle interruption |
| `frequency` | `0.35` | Chance an idle moment becomes a vote prompt |
| `cooldownMinutes` | `20` | Hard floor between two prompts |
| `kind` | `startup` | `startup`, `vc`, or `college` |
| `autoResearch` | `false` | Always research both before asking |
| `logos` | `false` | Sketch the logos as ASCII above the cards |
| `browserVote` | `true` | Cast the vote through a real local Chrome (Node 22+) |

If the user's phrasing is about frequency rather than a key — "too often",
"leave me alone", "more of these" — translate it yourself: halve or double
`frequency`, or set `enabled=false`. Then show the resulting config.
