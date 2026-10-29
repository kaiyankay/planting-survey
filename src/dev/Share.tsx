import { useEffect, useState } from "react";
import type { DevStore, Member, Role } from "./data.ts";

type Props = { store: DevStore; me: string; onClose: () => void };

/**
 * Owner-only access control. Granting access adds an email to dev_members;
 * no email is sent. The person signs in at the developer link with that
 * address and the database lets them in. All of it is enforced by Row Level
 * Security, not by this dialog.
 */
export function Share({ store, me, onClose }: Props) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "owner">>("viewer");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}#/dev`;

  async function refresh() {
    try {
      setMembers(await store.members());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn’t copy; the link is " + link);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="fixed inset-0 z-40 flex items-start justify-center bg-ink/20 p-4 pt-24">
      <div className="w-full max-w-[28rem] rounded-md border border-line bg-bg p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 id="share-title" className="text-[18px] font-semibold text-ink">
            Access to developer mode
          </h2>
          <button type="button" onClick={onClose} className="text-[13px] text-mute underline">
            Close
          </button>
        </div>
        <p className="mt-1 text-[13px] text-mute">
          Granting access adds the email to the members list; no message is sent. Send the person the developer link yourself. They sign in there
          with that email and receive a one-time link from the sign-in page.
        </p>
        <p className="mt-2 text-[13px] text-mute">
          Viewers and editors can both read every raw response. Editors can also change plant and requirement decisions. Only you can change this list.
          These are database rules, so they hold even outside this page.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-chip px-2 py-1 text-[12px] text-ink">{link}</code>
          <button type="button" onClick={copy} className="rounded-md border border-line px-3 py-1 text-[13px] text-ink hover:bg-chip">
            {copied ? "Copied" : "Copy developer link"}
          </button>
        </div>

        <form
          className="mt-5 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            act(async () => {
              await store.grant(email, role);
              setEmail("");
            });
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="min-w-0 flex-1 rounded-md border border-line bg-field px-2.5 py-1.5 text-[14px] text-ink focus:border-ink"
          />
          <select value={role} onChange={(e) => setRole(e.target.value as Exclude<Role, "owner">)} className="rounded-md border border-line bg-field px-2 py-1.5 text-[14px]">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button type="submit" disabled={busy} className="rounded-md bg-fill px-3 py-1.5 text-[14px] font-medium text-on-fill disabled:opacity-60">
            Grant access
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-hint">
            {error}
          </p>
        )}

        <ul className="mt-5 divide-y divide-line border-t border-line">
          {members === null && <li className="py-2 text-[13px] text-mute">Loading…</li>}
          {members?.map((m) => (
            <li key={m.email} className="flex flex-wrap items-center gap-2 py-2 text-[14px]">
              <span className="flex-1 truncate text-ink">
                {m.email}
                {m.email === me && <span className="ml-1 text-mute">(you)</span>}
              </span>
              {m.role === "owner" ? (
                <span className="text-[13px] text-mute">Owner</span>
              ) : (
                <>
                  <select
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => act(() => store.setRole(m.email, e.target.value as Exclude<Role, "owner">))}
                    className="rounded-md border border-line bg-field px-2 py-1 text-[13px]"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button type="button" disabled={busy} onClick={() => act(() => store.remove(m.email))} className="text-[13px] text-mute underline">
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
