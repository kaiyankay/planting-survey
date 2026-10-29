import { useMemo, useState } from "react";
import type { ResponseRow } from "../lib/answers.ts";
import { QUESTIONS_VERSION } from "../questions.ts";
import { buildCandidates, candidatesExport, unassignedNotes, wouldCycle, type Candidate } from "../lib/candidates.ts";
import { download, type Review, type ReviewStatus } from "./data.ts";
import { About, Button, Chip, Field, inputClass, LinkButton, List, Panel, Part, Row, Section, T, Tag, TextList, Toolbar, useFlash } from "./ui.tsx";

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
  const shortlisted = candidates.filter((c) => c.status === "shortlisted").length;

  async function run(task: () => Promise<void>) {
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <Toolbar
        summary={
          <>
            Plants named in question 14, with the note each respondent attached in question 15. Merge spellings, shortlist about ten for the
            prototype, and say why. {candidates.length} candidates, {shortlisted} shortlisted, {unassigned.length} unassigned notes
            {canEdit ? "." : "; you can read but not change reviews."}
          </>
        }
      >
        <Button
          primary
          onClick={() =>
            download(
              `plant_candidates-${stamp}.json`,
              JSON.stringify(candidatesExport(candidates, unassigned, { questions_version: QUESTIONS_VERSION, responses: rows.length, filter: meta }), null, 2),
              "application/json",
            )
          }
        >
          Download plant_candidates.json
        </Button>
      </Toolbar>
      <About
        items={[
          "Mentions count respondents. Names are grouped only by case and spacing; a common and a scientific name become one candidate only when a reviewer merges them.",
          "A note appears under a plant only when the respondent chose that plant for it. Notes from earlier versions are listed separately as unassigned.",
          "Shortlisted means chosen for the prototype, not botanically verified. Respondents’ reasons and conditions are their statements, not plant attributes.",
        ]}
      />
      {error && (
        <p role="alert" className="mt-4 text-[13px] text-hint">
          {error}
        </p>
      )}

      <Section title="Candidates" sub="Most mentioned first">
        {candidates.length === 0 ? (
          <p className={T.meta}>No plants named in this selection.</p>
        ) : (
          <List>
            {candidates.map((c) => (
              <Row
                key={c.key}
                title={c.name}
                detail={c.reviewed_name && c.raw_names[0] && c.raw_names[0] !== c.reviewed_name ? `as written: ${c.raw_names[0]}` : undefined}
                meta={`${c.mentions} ${c.mentions === 1 ? "mention" : "mentions"}${c.notes_count ? ` · ${c.notes_count} ${c.notes_count === 1 ? "note" : "notes"}` : ""}`}
                tag={<StatusTag status={c.status} />}
                open={open === c.key}
                onToggle={() => setOpen(open === c.key ? null : c.key)}
              >
                <Part label="From respondents">
                  <p className={T.body}>
                    Spellings: {c.raw_names.join(", ") || "none"}
                    {c.merged_from.length > 0 && <span className="text-mute"> · merged here by a reviewer: {c.merged_from.join(", ")}</span>}
                  </p>
                  <Sources sources={c.sources} />
                </Part>
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
              </Row>
            ))}
          </List>
        )}
      </Section>

      {unassigned.length > 0 && (
        <Section title="Unassigned notes" sub="Written under an earlier questionnaire version, or naming a plant not on that respondent’s list. Not attached to any candidate.">
          <TextList label={`${unassigned.length} notes`} items={unassigned.map((n) => `${n.text} (listed: ${n.listed.join(", ") || "none"})`)} />
        </Section>
      )}
    </div>
  );
}

/** Attached notes in full; respondents who named the plant without a note folded into one line. */
function Sources({ sources }: { sources: Candidate["sources"] }) {
  const noted = sources.filter((s) => s.note);
  const silent = sources.filter((s) => !s.note);
  const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <div className="mt-2 space-y-1.5">
      {noted.map((s, i) => (
        <div key={`${s.response_id}-${i}`} className="rounded-md bg-chip px-3 py-2">
          <p className={`${T.body} leading-snug`}>{s.note}</p>
          <p className={`${T.meta} mt-1`}>
            Named as “{s.raw_name}”{s.listed_with.length > 0 && <> · listed with {s.listed_with.join(", ")}</>} · {when(s.submitted_at)}
          </p>
        </div>
      ))}
      {silent.length > 0 && (
        <details>
          <summary className={`${T.meta} cursor-pointer select-none hover:text-ink`}>
            {silent.length} {silent.length === 1 ? "respondent" : "respondents"} named it without a note
          </summary>
          <ul className="mt-1.5 space-y-1 pl-4">
            {silent.map((s, i) => (
              <li key={`${s.response_id}-${i}`} className={`${T.meta} list-disc`}>
                “{s.raw_name}”{s.listed_with.length > 0 && <> · listed with {s.listed_with.join(", ")}</>} · {when(s.submitted_at)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function StatusTag({ status }: { status: ReviewStatus }) {
  const label = STATUS.find((s) => s.key === status)?.label ?? status;
  return <Tag tone={status === "shortlisted" ? "strong" : status === "excluded" ? "struck" : "quiet"}>{label}</Tag>;
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
  const [flash, setFlash] = useFlash();
  const base: Review = { name_key: c.key, reviewed_name: c.reviewed_name, status: c.status, merged_into: null, notes: c.notes };
  const save = (r: Review) => {
    onSave(r);
    setFlash("Saved");
  };

  return (
    <Panel label="Reviewer decisions">
      <Field label="Status">
        {STATUS.map((s) => (
          <Chip key={s.key} on={c.status === s.key} onClick={() => save({ ...base, status: s.key })}>
            {s.label}
          </Chip>
        ))}
        {flash && <span className={T.meta}>{flash}</span>}
      </Field>
      <Field label="Reviewed name" htmlFor={`name-${c.key}`}>
        <input id={`name-${c.key}`} value={name} onChange={(e) => setName(e.target.value)} placeholder={c.raw_names[0]} className={`${inputClass} w-64`} />
        <LinkButton onClick={() => save({ ...base, reviewed_name: name.trim() || null })}>Save</LinkButton>
      </Field>
      <Field label="Reviewer notes" htmlFor={`notes-${c.key}`}>
        <input id={`notes-${c.key}`} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} flex-1`} />
        <LinkButton onClick={() => save({ ...base, notes: notes.trim() || null })}>Save</LinkButton>
      </Field>
      <Field label="Merge into" htmlFor={`merge-${c.key}`}>
        <select id={`merge-${c.key}`} value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputClass} w-64`}>
          <option value="">Choose a plant…</option>
          {others.map((o) => (
            <option key={o.key} value={o.key}>
              {o.name} ({o.mentions})
            </option>
          ))}
        </select>
        <LinkButton disabled={!target} onClick={() => onMerge(target)}>
          Merge
        </LinkButton>
        <span className={T.meta}>Its mentions and attached notes move to the chosen plant, which keeps its own status and reviewer notes.</span>
      </Field>
      {c.merged_from.length > 0 && (
        <Field label="Merged here">
          {c.merged_from.map((k) => (
            <span key={k} className="rounded-md bg-chip px-2 py-0.5 text-[13px]">
              {k}{" "}
              <LinkButton onClick={() => onUnmerge(k)} className="ml-1">
                undo
              </LinkButton>
            </span>
          ))}
        </Field>
      )}
    </Panel>
  );
}
