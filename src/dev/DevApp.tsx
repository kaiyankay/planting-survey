import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase.ts";
import type { ResponseRow } from "../lib/answers.ts";
import { SURVEY_TITLE } from "../questions.ts";
import { memoryStore, supabaseStore, type DevStore, type Review, type Role } from "./data.ts";
import { Analytics } from "./Analytics.tsx";
import { Insights } from "./Insights.tsx";
import { Candidates } from "./Candidates.tsx";
import { Share } from "./Share.tsx";

/**
 * Developer mode, reached at #/dev. Sign in by magic link; the database’s
 * Row Level Security decides whether the account is a member and what it may
 * do. Without Supabase configured, the workbench opens on sample data with
 * the visitor acting as owner, so the layout can be checked.
 */
export function DevApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabase) return <SampleWorkbench />;
  if (!ready) return null;
  if (!session) return <SignIn />;
  const email = session.user.email ?? "";
  return <Gate store={supabaseStore(email)} me={email} onSignOut={() => supabase!.auth.signOut()} />;
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[42rem] px-6 pb-24 pt-16">{children}</div>;
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}${location.pathname}#/dev` },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  }

  return (
    <Frame>
      <h1 className="text-[26px] font-bold text-ink">Developer mode</h1>
      <p className="mt-2 text-[15px] text-mute">Sign in to read and analyse responses. Only invited members can read anything.</p>
      {state === "sent" ? (
        <p className="mt-8 text-[16px] text-ink">Check your inbox for a sign-in link. It brings you back here.</p>
      ) : (
        <form onSubmit={send} className="mt-8 flex max-w-[24rem] flex-col gap-3">
          <label className="text-[13px] text-mute">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-field px-3 py-2 text-[16px] text-ink focus:border-ink"
            />
          </label>
          <button
            type="submit"
            disabled={state === "sending"}
            className="self-start rounded-md bg-fill px-4 py-2 text-[14px] font-medium text-on-fill disabled:opacity-60"
          >
            {state === "sending" ? "Sending…" : "Send sign-in link"}
          </button>
          {state === "error" && <p className="text-[14px] text-hint">{error}</p>}
        </form>
      )}
      <p className="mt-10 text-[13px] text-mute">
        <a href="#/" className="underline">
          Back to the survey
        </a>
      </p>
    </Frame>
  );
}

/** Loads the role, then the data; shows why when either is refused. */
function Gate({ store, me, onSignOut }: { store: DevStore; me: string; onSignOut: () => void }) {
  const [role, setRole] = useState<Role | null | undefined>(undefined);
  const [rows, setRows] = useState<ResponseRow[] | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await store.role();
        if (cancelled) return;
        setRole(r);
        if (!r) return;
        const [data, rv] = await Promise.all([store.responses(), store.reviews()]);
        if (cancelled) return;
        setRows(data);
        setReviews(rv);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);

  if (error) {
    return (
      <Frame>
        <p className="text-[15px] text-hint">Couldn’t load: {error}</p>
        <button type="button" onClick={onSignOut} className="mt-6 text-[14px] underline">
          Sign out
        </button>
      </Frame>
    );
  }
  if (role === undefined) {
    return (
      <Frame>
        <p className="text-[15px] text-mute">Checking access…</p>
      </Frame>
    );
  }
  if (role === null) {
    return (
      <Frame>
        <h1 className="text-[22px] font-semibold text-ink">No access</h1>
        <p className="mt-2 text-[15px] text-mute">
          {me} is signed in but is not a member. Ask the owner to share developer mode with this email.
        </p>
        <p className="mt-6 text-[14px]">
          <button type="button" onClick={onSignOut} className="underline">
            Sign out
          </button>
          <a href="#/" className="ml-4 underline">
            Back to the survey
          </a>
        </p>
      </Frame>
    );
  }
  if (!rows || !reviews) {
    return (
      <Frame>
        <p className="text-[15px] text-mute">Loading responses…</p>
      </Frame>
    );
  }
  return <Workbench store={store} me={me} role={role} rows={rows} initialReviews={reviews} onSignOut={onSignOut} />;
}

type Tab = "analytics" | "insights" | "candidates";
const TABS: { key: Tab; label: string }[] = [
  { key: "analytics", label: "Survey analytics" },
  { key: "insights", label: "Database insights" },
  { key: "candidates", label: "Plant candidates" },
];

function Workbench({
  store,
  me,
  role,
  rows,
  initialReviews,
  onSignOut,
}: {
  store: DevStore;
  me: string;
  role: Role;
  rows: ResponseRow[];
  initialReviews: Review[];
  onSignOut: () => void;
}) {
  const tabFromHash = () => (TABS.some((t) => t.key === location.hash.split("/")[2]) ? (location.hash.split("/")[2] as Tab) : "analytics");
  const [tab, setTab] = useState<Tab>(tabFromHash);
  // Keep the tab in step with the address bar (back button, pasted links).
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  const [reviews, setReviews] = useState(initialReviews);
  const [share, setShare] = useState(false);
  const canEdit = role === "owner" || role === "editor";

  function pick(t: Tab) {
    setTab(t);
    location.hash = `#/dev/${t}`;
  }

  async function saveReview(r: Review) {
    await store.saveReview(r);
    setReviews(await store.reviews());
  }
  async function clearReview(key: string) {
    await store.clearReview(key);
    setReviews(await store.reviews());
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[46rem] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          <nav aria-label="Mode" className="flex rounded-md border border-line p-0.5 text-[13px]">
            <a href="#/" className="rounded px-2.5 py-1 text-mute hover:text-ink">
              Survey
            </a>
            <span aria-current="page" className="rounded bg-fill px-2.5 py-1 text-on-fill">
              Developer
            </span>
          </nav>
          <span className="hidden text-[13px] text-mute sm:inline">{SURVEY_TITLE}</span>
          <span className="flex-1" />
          {role === "owner" && (
            <button type="button" onClick={() => setShare(true)} className="rounded-md border border-line px-3 py-1 text-[13px] text-ink hover:bg-chip">
              Share
            </button>
          )}
          <span className="text-[13px] text-mute">
            {me} · {role}
          </span>
          <button type="button" onClick={onSignOut} className="text-[13px] text-mute underline hover:text-ink">
            Sign out
          </button>
        </div>
        <div className="mx-auto flex max-w-[46rem] gap-6 px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-current={tab === t.key ? "page" : undefined}
              onClick={() => pick(t.key)}
              className={[
                "-mb-px border-b-2 py-2.5 text-[14px] transition-colors",
                tab === t.key ? "border-ink font-medium text-ink" : "border-transparent text-mute hover:text-ink",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[46rem] px-6 pb-24 pt-8">
        {tab === "analytics" && <Analytics rows={rows} />}
        {tab === "insights" && <Insights rows={rows} />}
        {tab === "candidates" && <Candidates rows={rows} reviews={reviews} canEdit={canEdit} onSave={saveReview} onClear={clearReview} />}
      </main>

      {share && <Share store={store} me={me} onClose={() => setShare(false)} />}
    </div>
  );
}

/** Without Supabase env vars: sample data, visitor as owner, nothing persisted. */
function SampleWorkbench() {
  const [state, setState] = useState<{ store: DevStore; rows: ResponseRow[] } | null>(null);
  useEffect(() => {
    import("./sample.ts").then((m) => {
      const rows = m.sampleRows(24);
      setState({ store: memoryStore(rows), rows });
    });
  }, []);
  if (!state) return null;
  return (
    <>
      <p className="bg-mark px-6 py-1.5 text-center text-[12px] text-ink">Sample data: Supabase is not configured, nothing here is saved.</p>
      <Workbench store={state.store} me="you@example.com" role="owner" rows={state.rows} initialReviews={[]} onSignOut={() => (location.hash = "#/")} />
    </>
  );
}
