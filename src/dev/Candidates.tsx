import { useMemo, useState } from "react";
import type { ResponseRow } from "../lib/answers.ts";
import { QUESTIONS_VERSION } from "../questions.ts";
import { buildCandidates, candidatesExport, unassignedNotes, wouldCycle, type Candidate } from "../lib/candidates.ts";
import { download, type Review, type ReviewStatus } from "./data.ts";
import { TextList } from "./Analytics.tsx";

type Props = {
  rows: ResponseRow[];
  reviews: Review[];
  canEdit: boolean;
  onSave: (review: Review) => Promise<void>;
  onClear: (nameKey: string) => Promise<void>;
  meta: unknown;
};

const STATUS: { key: ReviewStatus; label: string }[] = [
  { key: "candidate", label: "Candidate" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "excluded", label: "Excluded" },
];

/** Plant candidates: what respondents named and wrote, and what reviewers decided, side by side but never mixed. */
export function Candidates({ rows, reviews, canEdit, onSave, onClear, meta }: Props) {
  const candidates = useMemo(() => buildCandidates(rows, reviews), [rows, reviews]);
  const unassigned = useMemo(() => unassignedNotes(rows), [rows]);
  const reviewMap = useMemo(() => new Map(reviews.map((r) => [r.name_key, r])), [reviews]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const stamp = new Date().toISOString().slice(0, 10);

  async function run(task: () => Promise<void>) {
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const shortlisted = candidates.filter((c) => c.status === "shortlisted").length;

  return (
    <div>
      <p className="max-w-[36rem] text-[15px] leading-relaxed text-ink">
        Plants named in question 14, each with the notes respondents attached to it in question 15. Merge spellings of one plant, shortlist about
        ten for the prototype, and say why.
      </p>
      <ul className="mt-3 max-w-[36rem] space-y-1 text-[13px] text-mute">
        <li>Mentions count respondents. Names are grouped only by case and spacing; a common and a scientific name become one candidate only when you merge them.</li>
        <li>A note appears under a plant only when the respondent chose that plant for it. Notes from earlier versions are listed separately as unassigned.</li>
        <li>Shortlisted means chosen for the prototype, not botanically verified. {canEdit ? "Your decisions are saved for every member." : "You can read but not change reviews."}</li>
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            download(
              `plant_candidates-${stamp}.json`,
              JSON.stringify(candidatesExport(candidates, unassigned, { questions_version: QUESTIONS_VERSION, responses: rows.length, filter: meta }), null, 2),
              "application/json",
            )
          }
          className="rounded-md bg-fill px-3.5 py-2 text-[14px] font-medium text-on-fill"
        >
          Download plant_candidates.json
        </button>
        <span className="text-[13px] text-mute">
          {candidates.length} candidates, {shortlisted} shortlisted, {unassigned.length} unassigned notes
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[14px] text-hint">
          {error}
        </p>
      )}

      {candidates.length === 0 ? (
        <p className="mt-8 text-[14px] text-mute">No plants named in this selection.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {candidates.map((c) => {
            const isOpen = open === c.key;
            return (
              <li key={c.key} className="py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <button type="button" onClick={() => setOpen(isOpen ? null : c.key)} className="flex-1 text-left" aria-expanded={isOpen}>
                    <span className="text-[16px] text-ink">{c.name}</span>
                    {c.reviewed_name && c.raw_names[0] && c.raw_names[0] !== c.reviewed_name && <span className="ml-2 text-[13px] text-mute">as written: {c.raw_names[0]}</span>}
                  </button>
                  <span className="text-[13px] tabular-nums text-mute">
                    {c.mentions} {c.mentions === 1 ? "mention" : "mentions"}
                    {c.notes_count > 0 && `, ${c.notes_count} ${c.notes_count === 1 ? "note" : "notes"}`}
                  </span>
                  <StatusChip status={c.status} />
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-5 pl-1">
                    <div>
                      <p className="text-[12px] text-mute">From respondents</p>
                      <p className="mt-1 text-[13px] text-ink">
                        Spellings: {c.raw_names.join(", ") || "none"}
                        {c.merged_from.length > 0 && <span className="text-mute"> · merged here by a reviewer: {c.merged_from.join(", ")}</span>}
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {c.sources.map((s, i) => (
                          <li key={`${s.response_id}-${i}`} className="rounded-md bg-chip px-3 py-2 text-[14px] leading-snug">
                            <p className="text-ink">{s.note ?? <span className="text-mute">No note attached to this plant.</span>}</p>
                            <p className="mt-1 text-[12px] text-mute">
                              Named as “{s.raw_name}”{s.listed_with.length > 0 && <> · listed with {s.listed_with.join(", ")}</>} ·{" "}
                              {new Date(s.submitted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {canEdit && (
                      <Editor
                        candidate={c}
                        others={candidates.filter((o) => o.key !== c.key)}
                        onSave={(r) => run(() => onSave(r))}
                        onMerge={(target) =>
                          run(async () => {
                            if (wouldCycle(c.key, target, reviewMap)) throw new Error("That merge would form a loop; undo the other merge first.");
                            await onSave({ name_key: c.key, reviewed_name: c.reviewed_name, status: c.status, merged_into: target, notes: c.notes });
                            setOpen(target);
                          })
                        }
                        onUnmerge={(key) => run(() => onClear(key))}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {unassigned.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[16px] font-semibold text-ink">Unassigned notes</h2>
          <p className="mt-1 text-[13px] text-mute">
            Written under an earlier questionnaire version, or naming a plant not on that respondent’s list. Read them, but they are not attached to any candidate.
          </p>
          <TextList title={`${unassigned.length} notes`} items={unassigned.map((n) => `${n.text} (listed: ${n.listed.join(", ") || "none"})`)} />
        </section>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: ReviewStatus }) {
  const label = STATUS.find((s) => s.key === status)?.label ?? status;
  const tone = status === "shortlisted" ? "border-ink text-ink" : status === "excluded" ? "border-line text-mute line-through" : "border-line text-mute";
  return <span className={`rounded-md border px-2 py-0.5 text-[12px] ${tone}`}>{label}</span>;
}

function Editor({
  candidate: c,
  others,
  onSave,
  onMerge,
  onUnmerge,
}: {
  candidate: Candidate;
  others: Candidate[];
  onSave: (r: Review) => void;
  onMerge: (targetKey: string) => void;
  onUnmerge: (key: string) => void;
}) {
  const [name, setName] = useState(c.reviewed_name ?? "");
  const [notes, setNotes] = useState(c.notes ?? "");
  const [target, setTarget] = useState("");
  const base: Review = { name_key: c.key, reviewed_name: c.reviewed_name, status: c.status, merged_into: null, notes: c.notes };
  const field = "rounded-md border border-line bg-field px-2.5 py-1.5 text-[14px] text-ink focus:border-ink";

  return (
    <div className="space-y-3 rounded-md border border-line p-3">
      <p className="text-[12px] text-mute">Reviewer decisions</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 text-[12px] text-mute">Status</span>
        {STATUS.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={c.status === s.key}
            onClick={() => onSave({ ...base, status: s.key })}
            className={["rounded-md border px-2.5 py-1 text-[13px] transition-colors", c.status === s.key ? "border-ink bg-chip text-ink" : "border-line text-mute hover:bg-chip"].join(" ")}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="w-28 text-[12px] text-mute" htmlFor={`name-${c.key}`}>
          Reviewed name
        </label>
        <input id={`name-${c.key}`} value={name} onChange={(e) => setName(e.target.value)} placeholder={c.raw_names[0]} className={`${field} w-64`} />
        <button type="button" onClick={() => onSave({ ...base, reviewed_name: name.trim() || null })} className="text-[13px] underline">
          Save
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="w-28 text-[12px] text-mute" htmlFor={`notes-${c.key}`}>
          Reviewer notes
        </label>
        <input id={`notes-${c.key}`} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} w-96 max-w-full`} />
        <button type="button" onClick={() => onSave({ ...base, notes: notes.trim() || null })} className="text-[13px] underline">
          Save
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="w-28 text-[12px] text-mute" htmlFor={`merge-${c.key}`}>
          Merge into
        </label>
        <select id={`merge-${c.key}`} value={target} onChange={(e) => setTarget(e.target.value)} className={`${field} w-64`}>
          <option value="">Choose a plant…</option>
          {others.map((o) => (
            <option key={o.key} value={o.key}>
              {o.name} ({o.mentions})
            </option>
          ))}
        </select>
        <button type="button" disabled={!target} onClick={() => onMerge(target)} className="text-[13px] underline disabled:opacity-40">
          Merge
        </button>
        <span className="text-[12px] text-mute">Its mentions and attached notes move to the chosen plant, which keeps its own status and reviewer notes.</span>
      </div>
      {c.merged_from.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="w-28 text-[12px] text-mute">Merged here</span>
          {c.merged_from.map((k) => (
            <span key={k} className="rounded-md bg-chip px-2 py-0.5">
              {k}{" "}
              <button type="button" onClick={() => onUnmerge(k)} className="ml-1 text-mute underline">
                undo
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
