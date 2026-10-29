import type { Answers } from "./answers.ts";
import { QUESTIONS_VERSION } from "../questions.ts";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const storageConfigured = Boolean(url && anonKey);

/**
 * Inserts one response through Supabase's REST API with the anon key.
 * The table's RLS policy allows anonymous inserts only, so this key cannot
 * read anything back.
 *
 * Resolves only when the row is stored. In a production build without
 * storage configured it rejects, so the survey never claims to have saved
 * something it did not. In local development (`npm run dev`) it logs the
 * response instead so the flow can be walked through without a database.
 */
export async function submitResponse(answers: Answers, durationSeconds: number): Promise<void> {
  const body = {
    duration_seconds: durationSeconds,
    questions_version: QUESTIONS_VERSION,
    answers,
  };
  if (!url || !anonKey) {
    if (import.meta.env.DEV) {
      console.warn("[survey] Supabase not configured; response not stored (dev only):", body);
      return;
    }
    throw new Error("Storage is not configured");
  }
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/responses`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase insert failed (${res.status}): ${text}`);
  }
}
