#!/usr/bin/env node
// aura — CLI for aurabr.xyz. Zero deps, Node >= 18 (global fetch).
// Commands: match | vote | ranking | pending | config

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const SITE = process.env.AURA_SITE ?? "https://www.aurabr.xyz";
const CONFIG_PATH = process.env.AURA_CONFIG ?? join(homedir(), ".claude", "aura.json");
const PENDING_PATH = join(dirname(CONFIG_PATH), "aura-pending.json");

const DEFAULTS = {
  enabled: true,
  frequency: 0.35,      // chance an idle moment turns into a vote prompt
  cooldownMinutes: 20,  // never prompt twice inside this window
  kind: "startup",      // startup | vc | college
  autoResearch: false,  // always research both before asking
  logos: false,         // let Claude read the logo images and sketch them in ASCII
};

const readJSON = (p, fallback) => {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
};
const writeJSON = (p, v) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
};

export const config = () => ({ ...DEFAULTS, ...readJSON(CONFIG_PATH, {}) });

// ── api ────────────────────────────────────────────────────────────────────

const api = async (path, init) => {
  const res = await fetch(`${SITE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
};

export const fetchMatch = ({ kind, exclude } = {}) => {
  const q = new URLSearchParams();
  if (kind && kind !== "startup") q.set("kind", kind);
  if (exclude?.length) q.set("exclude", exclude.join(","));
  return api(`/api/match${q.size ? `?${q}` : ""}`);
};

// ── render ─────────────────────────────────────────────────────────────────

const STAGES = {
  pre_seed: "Pre-seed", seed: "Seed", series_a: "Series A", series_b: "Series B",
  series_c: "Series C", series_d: "Series D+", ipo: "IPO", acquired: "Acquired",
  bootstrapped: "Bootstrapped", unknown: "—",
};
const b = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const W = 34;
const pad = (s, w = W) => {
  const plain = s.replace(/\x1b\[[0-9;]*m/g, "");
  const cut = plain.length > w ? plain.slice(0, w - 1) + "…" : plain;
  const visible = plain.length > w ? cut : s;
  return visible + " ".repeat(Math.max(0, w - cut.length));
};

const card = (s, label) => {
  const rate = s.matches ? Math.round((s.wins / s.matches) * 100) : 0;
  const host = (s.websiteUrl ?? "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  return [
    `┌─ ${label} ${"─".repeat(W - label.length - 1)}┐`,
    `│ ${pad(b(s.name))} │`,
    `│ ${pad(dim(s.tagline ?? ""))} │`,
    `│ ${pad("")} │`,
    `│ ${pad([STAGES[s.stage] ?? s.stage, `${s.aura} aura`].filter(Boolean).join("  ·  "))} │`,
    `│ ${pad(dim(`${s.wins}/${s.matches} duelos · ${rate}% win`))} │`,
    `│ ${pad(dim(host))} │`,
    `└${"─".repeat(W + 2)}┘`,
  ];
};

export const renderMatch = (m) => {
  const L = card(m.left, "1"), R = card(m.right, "2");
  const head = `  ✦  A U R A   B R E A K  ✦  ${dim(`${m.totalVotes.toLocaleString("pt-BR")} votos até agora`)}`;
  const rows = L.map((l, i) => `  ${l}   ${R[i]}`);
  return ["", head, "", ...rows, ""].join("\n");
};

// ── vote (bot-protected upstream; queue on refusal) ─────────────────────────

export const vote = async (winnerId, loserId) => {
  try {
    const r = await api("/api/vote", {
      method: "POST",
      body: JSON.stringify({ winnerId, loserId }),
    });
    return { ok: true, ...r };
  } catch (e) {
    const pending = readJSON(PENDING_PATH, []);
    pending.push({ winnerId, loserId, at: new Date().toISOString() });
    writeJSON(PENDING_PATH, pending);
    return { ok: false, queued: pending.length, reason: e.message, status: e.status };
  }
};

// ── ranking (no public endpoint — parse the SSR page) ───────────────────────

const RANK_PATH = { startup: "/ranking", vc: "/vcs/ranking", college: "/faculdades/ranking" };

export const ranking = async (kind = "startup", limit = 20) => {
  const res = await fetch(`${SITE}${RANK_PATH[kind] ?? "/ranking"}`);
  const html = await res.text();
  const body = html.slice(html.indexOf("<body"));
  const text = body
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, "|")
    .replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/\|+/g, "|");
  const rows = [...text.matchAll(/\|(\d{1,3})\|([^|]+)\|(?:([^|]+)\|)?([\d.]+)\|([SABC])(?=\|)/g)]
    .map(([, rank, name, meta, aura, tier]) => ({ rank: +rank, name, meta: meta ?? "", aura, tier }));
  const total = text.match(/\|([\d.]+)\| \|votos\|/)?.[1];
  return { rows: rows.slice(0, limit), total };
};

const TIER_COLOR = { S: "\x1b[38;5;213m", A: "\x1b[38;5;177m", B: "\x1b[38;5;39m", C: "\x1b[38;5;245m" };

export const renderRanking = ({ rows, total }, kind) => {
  const head = `  ✦  ranking de aura — ${kind}${total ? dim(`  ·  ${total} votos`) : ""}`;
  const lines = rows.map((r) =>
    `  ${String(r.rank).padStart(3)}  ${TIER_COLOR[r.tier] ?? ""}${r.tier}\x1b[0m  ${b(r.name.padEnd(20))} ${String(r.aura).padStart(6)}  ${dim(r.meta)}`,
  );
  return ["", head, "", ...lines, ""].join("\n");
};

// ── cli ────────────────────────────────────────────────────────────────────

const flag = (argv, name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const main = async () => {
  const [cmd, ...argv] = process.argv.slice(2);
  const cfg = config();

  if (cmd === "match") {
    const m = await fetchMatch({
      kind: flag(argv, "kind", cfg.kind),
      exclude: flag(argv, "exclude", "").split(",").filter(Boolean),
    });
    console.log(renderMatch(m));
    console.log("```json\n" + JSON.stringify({
      left: { id: m.left.id, name: m.left.name, website: m.left.websiteUrl, logo: SITE + m.left.logoUrl },
      right: { id: m.right.id, name: m.right.name, website: m.right.websiteUrl, logo: SITE + m.right.logoUrl },
    }, null, 2) + "\n```");
    return;
  }

  if (cmd === "vote") {
    const r = await vote(argv[0], argv[1]);
    if (r.ok) console.log(`✦ voto computado. ${r.winner?.name ?? "winner"} +aura`);
    else console.log(
      `✦ voto NÃO enviado (${r.status ?? "erro"}: ${r.reason}).\n` +
      `  Enfileirado localmente (${r.queued} pendente(s)) em ${PENDING_PATH}.\n` +
      `  aurabr.xyz protege /api/vote contra clientes não-browser (Vercel BotID).\n` +
      `  Vote no site: ${SITE}`,
    );
    return;
  }

  if (cmd === "ranking") {
    const kind = flag(argv, "kind", cfg.kind);
    console.log(renderRanking(await ranking(kind, +flag(argv, "limit", 20)), kind));
    return;
  }

  if (cmd === "pending") {
    console.log(JSON.stringify(readJSON(PENDING_PATH, []), null, 2));
    return;
  }

  if (cmd === "config") {
    if (!argv.length) return console.log(JSON.stringify(cfg, null, 2));
    const next = readJSON(CONFIG_PATH, {});
    for (const kv of argv) {
      const [k, ...rest] = kv.split("=");
      const raw = rest.join("=");
      if (!(k in DEFAULTS)) throw new Error(`chave desconhecida: ${k} (use: ${Object.keys(DEFAULTS).join(", ")})`);
      next[k] = raw === "true" ? true : raw === "false" ? false : isNaN(+raw) ? raw : +raw;
    }
    writeJSON(CONFIG_PATH, next);
    console.log(JSON.stringify({ ...DEFAULTS, ...next }, null, 2));
    return;
  }

  console.log("uso: aura.mjs match|vote <winnerId> <loserId>|ranking|pending|config [k=v]");
  process.exit(1);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`✦ ${e.message}`); process.exit(1); });
}
