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
| `frequency` | `0.7` | Chance a qualifying pause becomes a vote prompt |
| `cooldownMinutes` | `10` | Hard floor between two prompts |
| `alsoWhenDone` | `false` | Also prompt at plain end-of-turn, not just while you wait |
| `kind` | `startup` | `startup`, `vc`, or `college` |
| `autoResearch` | `false` | Always research both before asking |
| `logos` | `false` | Sketch the logos as ASCII above the cards |
| `browserVote` | `false` | Legacy Chrome vote path — dead since Turnstile, leave off |

If the user's phrasing is about frequency rather than a key — "too often",
"leave me alone", "more of these" — translate it yourself: halve or double
`frequency`, or set `enabled=false`. Then show the resulting config.
