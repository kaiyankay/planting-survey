/**
 * Downloads every response and writes a flat CSV next to the project:
 *   npm run export
 *
 * Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment
 * or from a local .env file. The service role key bypasses RLS, so it must
 * stay on your machine: .env is git-ignored and nothing here runs in the browser.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { toCsv, type ResponseRow } from "../src/lib/answers.ts";

function loadDotEnv(): Record<string, string> {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = { ...loadDotEnv(), ...process.env };
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env or the environment).");
  process.exit(1);
}

const rows: ResponseRow[] = [];
const page = 1000;
for (let from = 0; ; from += page) {
  const res = await fetch(`${url}/rest/v1/responses?select=*&order=submitted_at.asc`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Range: `${from}-${from + page - 1}`,
      "Range-Unit": "items",
    },
  });
  if (!res.ok) {
    console.error(`Supabase returned ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const batch = (await res.json()) as ResponseRow[];
  rows.push(...batch);
  if (batch.length < page) break;
}

const stamp = new Date().toISOString().slice(0, 10);
const outPath = resolve(process.cwd(), `responses-${stamp}.csv`);
writeFileSync(outPath, "﻿" + toCsv(rows), "utf8");
console.log(`${rows.length} response${rows.length === 1 ? "" : "s"} → ${outPath}`);
