import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase.ts";
import type { ResponseRow } from "../lib/answers.ts";
import { ALL_QUESTIONS, SURVEY_TITLE } from "../questions.ts";
import { memoryStore, supabaseStore, type DevStore, type Review, type Role } from "./data.ts";
import { applyFilter, DEFAULT_FILTER, describeFilter, filterMeta, type Filter } from "./filters.ts";
import { Analytics } from "./Analytics.tsx";
import { Candidates } from "./Candidates.tsx";
import { Share } from "./Share.tsx";
import { Chip, LinkButton, T } from "./ui.tsx";

/**
 * Developer mode, reached at #/dev. Sign in by magic link; the database’s
 * Row Level Security decides whether the account is a member and what it may
 * do. In local development without Supabase the workbench opens on sample
 * data; a production build without Supabase says so and stops.
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
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // The sign-in link lands on the site root with tokens in the URL; once
      // they are consumed, go to developer mode proper.
      if (event === "SIGNED_IN" && !location.hash.startsWith("#/dev")) location.hash = "#/dev";
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabase) return import.meta.env.DEV ? <SampleWorkbench /> : <NotConfigured />;
  if (!ready) return null;
  if (!session) return <SignIn />;
  const email = session.user.email ?? "";
  return <Gate store={supabaseStore(email)} me={email} onSignOut={() => supabase!.auth.signOut()} />;
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[42rem] px-6 pb-24 pt-16">{children}</div>;
}

function NotConfigured() {
  return (
    <Frame>
      <h1 className="text-[22px] font-semibold text-ink">Developer mode is not configured</h1>
      <p className="mt-2 max-w-[34rem] text-[15px] leading-relaxed text-mute">
        This deployment was built without <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, so there is no database to sign in to
        and survey submissions are not being stored either. Set both as repository variables and redeploy; the README has the steps.
      </p>
      <p className="mt-6 text-[13px] text-mute">
        <a href="#/" className="underline">
          Back to the survey
        </a>
      </p>
    </Frame>
  );
}

/** An error the auth server put in the URL after a failed link (expired, already used). */
function linkError(): string {
  const m = /error_description=([^&]*)/.exec(location.hash) ?? /error_description=([^&]*)/.exec(location.search);
  return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(() => (linkError() ? "error" : "idle"));
  const [error, setError] = useState(() => {
    const e = linkError();
    return e ? `The sign-in link did not work: ${e}. Request a new one and open only the newest email.` : "";
  });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      // No hash here: the auth server appends its own #access_token fragment,
      // and two fragments in one URL would not be parsed.
      options: { emailRedirectTo: `${location.origin}${location.pathname}` },
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
      <p className="mt-2 text-[15px] text-mute">Sign in to read and analyse responses. Only accounts the owner has granted access can read anything.</p>
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
  const [data, setData] = useState<{ rows: ResponseRow[]; reviews: Review[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await store.role();
        if (cancelled) return;
        setRole(r);
        if (!r) return;
        const [rows, reviews] = await Promise.all([store.responses(), store.reviews()]);
        if (!cancelled) setData({ rows, reviews });
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
        <p className="mt-2 text-[13px] text-mute">If a table is missing, run the latest migration in supabase/migrations (see README).</p>
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
        <p className="mt-2 text-[15px] text-mute">{me} is signed in but has not been granted access. Ask the owner to add this email under Share.</p>
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
  if (!data) {
    return (
      <Frame>
        <p className="text-[15px] text-mute">Loading responses…</p>
      </Frame>
    );
  }
  return <Workbench store={store} me={me} role={role} rows={data.rows} initialReviews={data.reviews} onSignOut={onSignOut} />;
}

type Tab = "analytics" | "candidates";
const TABS: { key: Tab; label: string }[] = [
  { key: "analytics", label: "Survey analytics" },
  { key: "candidates", label: "Plant candidates" },
];

const A1 = ALL_QUESTIONS.find((q) => q.id === "a1")!;
const A2 = ALL_QUESTIONS.find((q) => q.id === "a2")!;

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
  const [filter, setFilter] = useState<Filter>(DEFAULT_FILTER);
  const [reviews, setReviews] = useState(initialReviews);
  const [share, setShare] = useState(false);
  const canEdit = role === "owner" || role === "editor";

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const filtered = useMemo(() => applyFilter(rows, filter), [rows, filter]);
  const scope = describeFilter(filter, filtered.length, rows.length);
  const meta = filterMeta(filter, filtered.length, rows.length);

  function pick(t: Tab) {
    setTab(t);
    location.hash = `#/dev/${t}`;
  }
  function toggle(key: "roles" | "experience", value: string) {
    setFilter((f) => {
      const next = new Set(f[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...f, [key]: next };
    });
  }

  async function saveReview(r: Review) {
    await store.saveReview(r);
    setReviews(await store.reviews());
  }
  async function clearReview(key: string) {
    await store.clearReview(key);
    setReviews(await store.reviews());
  }

  const [editing, setEditing] = useState(false);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[46rem] flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3">
          <nav aria-label="Mode" className="flex rounded-md border border-line p-0.5 text-[13px]">
            <a href="#/" className="rounded px-2.5 py-1 text-mute hover:text-ink">
              Survey
            </a>
            <span aria-current="page" className="rounded bg-fill px-2.5 py-1 text-on-fill">
              Developer
            </span>
          </nav>
          <span className="hidden text-[13px] text-mute md:inline">{SURVEY_TITLE}</span>
          <span className="flex-1" />
          {role === "owner" && (
            <button type="button" onClick={() => setShare(true)} className="rounded-md border border-line px-3 py-1 text-[13px] text-ink hover:bg-chip">
              Share
            </button>
          )}
          <span className="max-w-[16rem] truncate text-[13px] text-mute" title={me}>
            {me} · {role}
          </span>
          <button type="button" onClick={onSignOut} className="text-[13px] text-mute underline underline-offset-2 hover:text-ink">
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

      <section aria-label="Selection" className="border-b border-line bg-chip/60">
        <div className="mx-auto max-w-[46rem] px-6 py-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-[14px] text-ink">Showing {scope}.</p>
            <LinkButton onClick={() => setEditing(!editing)} aria-expanded={editing}>
              {editing ? "Done" : "Change selection"}
            </LinkButton>
            <span className={T.meta}>Every number and export on these tabs uses this selection.</span>
          </div>
          {editing && (
            <div className="mt-3 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`${T.meta} w-20`}>Who</span>
                {A1.kind === "checkbox" &&
                  A1.options.map((o) => (
                    <Chip key={o.key} on={filter.roles.has(o.key)} onClick={() => toggle("roles", o.key)}>
                      {o.label}
                    </Chip>
                  ))}
                <span className={T.meta}>A respondent may hold several roles, so role groups can overlap.</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`${T.meta} w-20`}>Experience</span>
                {A2.kind === "checkbox" &&
                  A2.options.map((o) => (
                    <Chip key={o.key} on={filter.experience.has(o.key)} onClick={() => toggle("experience", o.key)}>
                      {o.label}
                    </Chip>
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-[46rem] px-6 pb-24 pt-8">
        {tab === "analytics" && <Analytics rows={filtered} total={rows.length} meta={meta} />}
        {tab === "candidates" && (
          <Candidates rows={filtered} reviews={reviews} canEdit={canEdit} onSave={saveReview} onClear={clearReview} meta={meta} />
        )}
      </main>

      {share && <Share store={store} me={me} onClose={() => setShare(false)} />}
    </div>
  );
}

/** Local development without Supabase: sample data, visitor as owner, nothing persisted. */
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
      <p className="bg-mark px-6 py-1.5 text-center text-[12px] text-ink">Local sample data: Supabase is not configured, nothing here is saved.</p>
      <Workbench
        store={state.store}
        me="kayyan1998@gmail.com"
        role="owner"
        rows={state.rows}
        initialReviews={[]}
        onSignOut={() => (location.hash = "#/")}
      />
    </>
  );
}
