#!/usr/bin/env node
// Cast a vote through a real local Chrome, driven over CDP.
//
// Why: aurabr.xyz protects POST /api/vote with Vercel BotID, which signs an
// `x-is-human` header from inside its own client bundle. A plain fetch has no
// such header and gets 403. Nothing here forges it — we load the real page in
// the real browser and let its own code sign the request.
//
// Headless is refused upstream (the UA says HeadlessChrome and BotID scores it
// as a bot), so the window is real but parked off-screen and killed right
// after. Requires Node 22+ for the global WebSocket.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITE = process.env.AURA_SITE ?? "https://www.aurabr.xyz";
const PORT = Number(process.env.AURA_CDP_PORT ?? 9333);

const CANDIDATES = [
  process.env.AURA_CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

export const findChrome = () => CANDIDATES.find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Minimal CDP client over the native WebSocket. */
const connect = async (url) => {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) =>
    new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    const ex = r.result?.exceptionDetails;
    if (ex) throw new Error(ex.exception?.description ?? ex.text);
    return r.result?.result?.value;
  };
  return { send, evaluate, close: () => ws.close() };
};

const pageTarget = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.url.includes("aurabr"));
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* browser not up yet */ }
    await sleep(250);
  }
  throw new Error("Chrome came up but never exposed an aurabr page target");
};

/**
 * @param {Array<{winnerId: string, loserId: string}>} ballots
 * @returns {Promise<{sent: number, results: Array<{status: number, body: string}>}>}
 */
export const castVotes = async (ballots) => {
  const chrome = findChrome();
  if (!chrome) throw new Error("no Chrome/Chromium/Brave/Edge found — set AURA_CHROME");

  const profile = mkdtempSync(join(tmpdir(), "aura-chrome-"));
  const proc = spawn(chrome, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--window-position=-3000,-3000",   // real window, off every screen
    "--window-size=1100,800",
    "--disable-backgrounding-occluded-windows",
    SITE,
  ], { stdio: "ignore", detached: false });

  const cleanup = () => {
    try { proc.kill("SIGTERM"); } catch {}
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  };

  try {
    const cdp = await connect((await pageTarget()).webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");

    // Wait for the client bundle to wrap window.fetch — that wrapper is what
    // signs the request. Without it the POST is indistinguishable from curl.
    for (let i = 0; i < 40; i++) {
      if (await cdp.evaluate("!/native code/.test(String(window.fetch))")) break;
      await sleep(250);
    }

    const results = [];
    for (const { winnerId, loserId } of ballots) {
      results.push(await cdp.evaluate(`(async () => {
        const r = await fetch("/api/vote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: ${JSON.stringify(JSON.stringify({ winnerId, loserId }))}
        });
        return { status: r.status, body: await r.text() };
      })()`));
      await sleep(400);
    }

    cdp.close();
    return { sent: results.filter((r) => r.status === 200).length, results };
  } finally {
    cleanup();
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [winnerId, loserId] = process.argv.slice(2);
  if (!winnerId || !loserId) {
    console.error("uso: browser-vote.mjs <winnerId> <loserId>");
    process.exit(1);
  }
  const { results } = await castVotes([{ winnerId, loserId }]);
  console.log(JSON.stringify(results[0], null, 2));
  process.exit(results[0].status === 200 ? 0 : 1);
}
