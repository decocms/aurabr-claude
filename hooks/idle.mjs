#!/usr/bin/env node
// Stop hook: Claude is about to go idle → sometimes turn that pause into a
// vote on aurabr.xyz. Silent (exit 0, no output) whenever it decides not to.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.CLAUDE_PLUGIN_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const { config, fetchMatch, renderMatch } = await import(join(ROOT, "scripts", "aura.mjs"));

const cfg = config();
const STATE = join(homedir(), ".claude", "aura-state.json");
const quit = () => process.exit(0);

const stdin = await new Promise((r) => {
  let s = ""; process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => (s += d)).on("end", () => r(s));
  setTimeout(() => r(s), 1000);
});
const input = (() => { try { return JSON.parse(stdin); } catch { return {}; } })();

if (!cfg.enabled) quit();
if (input.stop_hook_active) quit();               // we already injected this turn

// The whole point of the plugin. `Stop` fires every time the model concludes a
// turn — including the turns it concludes *while subagents and background
// shells are still running*, because those re-invoke it when they finish.
// `background_tasks` is what tells the two apart:
//
//   Stop | [2 subagents running]  ← the user is waiting. This is the moment.
//   Stop | [1 subagent running]   ← still waiting.
//   Stop | []                     ← work is done, nobody is waiting on anything.
//
// Firing on the last one is what makes the plugin feel like an interruption
// instead of a break, so by default it does not.
const waitingOn = (input.background_tasks ?? [])
  .filter((t) => t.status === "running" || t.status === "pending");
if (!waitingOn.length && !cfg.alsoWhenDone) quit();

if (Math.random() > cfg.frequency) quit();

const state = (() => { try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return {}; } })();
if (Date.now() - (state.lastPromptAt ?? 0) < cfg.cooldownMinutes * 60_000) quit();

const match = await fetchMatch({ kind: cfg.kind }).catch(() => null);
if (!match) quit();

mkdirSync(dirname(STATE), { recursive: true });
writeFileSync(STATE, JSON.stringify({ ...state, lastPromptAt: Date.now() }, null, 2));

const { left, right } = match;
const ids = { left: left.id, right: right.id };
const site = process.env.AURA_SITE ?? "https://www.aurabr.xyz";

const research = cfg.autoResearch
  ? `\nFIRST: WebFetch ${left.websiteUrl} and ${right.websiteUrl} and write ONE short paragraph about each (what they do, who they serve, why they might have aura). Then ask.\n`
  : "";

const logos = cfg.logos
  ? `\nLOGOS: download both with curl to the scratchpad (\`${site}${left.logoUrl}\`, \`${site}${right.logoUrl}\`), convert non-PNG with \`sips -s format png\`, Read them, and sketch each as ~6 lines of ASCII above its card. Best-effort — skip silently if it fails.\n`
  : "";

const waitLine = waitingOn.length
  ? `The user is waiting on ${waitingOn.length === 1 ? "" : `${waitingOn.length} things: `}${waitingOn.map((t) => `"${t.description ?? t.type}"`).join(", ")}. That wait is dead\ntime for them — spend it.`
  : `A quiet moment just opened up — spend it.`;

const context = `<aura-break>
${waitLine} One quick vote on aurabr.xyz (the aura
ranking of Brazilian startups), then go back to waiting.

1. Print this block VERBATIM inside a fenced code block (it is pre-rendered):
${renderMatch(match)}
${logos}${research}
2. Ask with AskUserQuestion — header "Aura", question "Quem tem mais aura?", options:
   - "${left.name}"  → ${left.tagline ?? ""}
   - "${right.name}" → ${right.tagline ?? ""}
   - "Pesquisar as duas" → WebFetch both sites, one short paragraph each, then ask again
   - "Pular" → drop it

3. On a pick, run:
   node "${ROOT}/scripts/aura.mjs" vote <winnerId> <loserId>
   ids: ${JSON.stringify(ids)}
   Report the script's output as-is — it says whether the vote landed or got queued.

4. Then stop and go back to waiting. Do NOT start new work off the back of this,
   do not poll or check on what the user is waiting for, and do not mention this
   block. One line of reaction is plenty. Tune it: /aura:config
</aura-break>`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "Stop", additionalContext: context },
  suppressOutput: true,
}));
