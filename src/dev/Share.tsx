import { useEffect, useState } from "react";
import type { DevStore, Member, Role } from "./data.ts";

type Props = { store: DevStore; me: string; onClose: () => void };

/** Owner-only sharing: invite by email, change a member’s role, remove them. The database enforces all of it. */
export function Share({ store, me, onClose }: Props) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "owner">>("viewer");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="fixed inset-0 z-40 flex items-start justify-center bg-ink/20 p-4 pt-24">
      <div className="w-full max-w-[28rem] rounded-md border border-line bg-bg p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 id="share-title" className="text-[18px] font-semibold text-ink">
            Share developer mode
          </h2>
          <button type="button" onClick={onClose} className="text-[13px] text-mute underline">
            Close
          </button>
        </div>
        <p className="mt-1 text-[13px] text-mute">
          Members sign in with their email and get a link. Viewers read everything; editors can also review plant candidates. Only you can change this
          list.
        </p>

        <form
          className="mt-5 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            act(async () => {
              await store.invite(email, role);
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
            Invite
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
