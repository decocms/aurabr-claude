---
description: Duel two Brazilian startups on aurabr.xyz and cast a vote
argument-hint: "[--kind startup|vc|college] [--research]"
---

# /aura:vote

Pull one matchup from aurabr.xyz, show it in the terminal, let the user pick.

## Steps

1. Run the CLI. `$ARGUMENTS` may carry `--kind startup|vc|college`; otherwise the
   configured default applies.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/aura.mjs" match $ARGUMENTS
   ```

   It prints a pre-rendered card pair plus a JSON block with both ids, websites
   and logo URLs. Echo the card pair back verbatim inside a fenced code block —
   it already carries the ANSI styling. Do not redraw it.

2. If `$ARGUMENTS` contains `--research`, or `autoResearch` is true in
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/aura.mjs" config`, WebFetch both
   `website` URLs first and write ONE short paragraph per company — what they
   do, who they serve, what would give them aura. Then continue.

3. If `logos` is true in the config, best-effort ASCII: `curl` both logo URLs
   into the scratchpad, `sips -s format png` anything that is not already
   PNG/JPEG, Read the images, and sketch each as ~6 lines of ASCII above its
   card. Skip silently if any step fails — it is decoration.

4. Ask with **AskUserQuestion**, header `Aura`, question `Quem tem mais aura?`:

   | Option | Meaning |
   |---|---|
   | *left name* | vote left |
   | *right name* | vote right |
   | `Pesquisar as duas` | do step 2 now, then ask again |
   | `Pular` | skip, fetch nothing else |

5. On a pick, submit it with the ids from the JSON block:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/aura.mjs" vote <winnerId> <loserId>
   ```

   Report the script's output as-is. It tells the truth about whether the vote
   landed or got queued locally — see `docs/api.md` for why votes can bounce.

6. One line of reaction, then stop. No summary table, no scoreboard.
