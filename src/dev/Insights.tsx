import { useMemo, useState } from "react";
import type { ResponseRow } from "../lib/answers.ts";
import { ALL_QUESTIONS } from "../questions.ts";
import { buildInsights, DECISION_LABELS, requirementsExport, type Evidence, type RequirementResult } from "./insights.ts";
import { QuestionStats } from "./Analytics.tsx";
import { download, type Decision, type DecisionStatus } from "./data.ts";
import { About, Button, Chip, Field, inputClass, LinkButton, List, Panel, Part, pct, Row, Section, T, Tag, Toolbar, useFlash } from "./ui.tsx";

type Props = {
  rows: ResponseRow[];
  decisions: Decision[];
  canEdit: boolean;
  onDecide: (d: Decision) => Promise<void>;
  meta: unknown;
};

/** Database insights: survey evidence, the proposed requirements catalogue and the researchers’ decisions, kept apart. */
export function Insights({ rows, decisions, canEdit, onDecide, meta }: Props) {
  const dims = useMemo(() => buildInsights(rows, decisions), [rows, decisions]);
  const stamp = new Date().toISOString().slice(0, 10);
  const all = dims.flatMap((d) => d.requirements);
  const decided = all.filter((r) => r.decision.status !== "proposed").length;

  return (
    <div>
      <Toolbar
        summary={
          <>
            What should the database contain, and how should it be organised? Each dimension shows the survey evidence, the requirements proposed
            beforehand, and the decision recorded for each. {all.length} requirements, {decided} decided
            {canEdit ? "." : "; you can read but not change decisions."}
          </>
        }
      >
        <Button primary onClick={() => download(`database_requirements-${stamp}.json`, JSON.stringify(requirementsExport(rows, decisions, meta), null, 2), "application/json")}>
          Download database_requirements.json
        </Button>
      </Toolbar>
      <About
        items={[
          "Survey evidence: shares are of the respondents who answered the question (n). An option nobody chose is 0, not unimportant.",
          "Suggested requirements were written by the research team before the results; the survey ranks them and never adds or removes items.",
          "Q7 rows show how designers treat a condition. They are evidence of design practice, not filters or weights.",
          "Core fields are basic botanical data a plant database needs; low counts are not grounds to exclude them.",
          "Survey results describe respondents’ practice, not verified facts about plants. Every decision is made by a researcher; nothing is approved automatically.",
        ]}
      />

      {dims.map((d) => (
        <Section key={d.id} title={d.title} sub={d.question}>
          <Part label="Survey evidence">
            <div className="space-y-8">
              {d.results.map((r) => (
                <QuestionStats key={r.id} question={ALL_QUESTIONS.find((q) => q.id === r.id)!} rows={rows} />
              ))}
            </div>
          </Part>

          <Part label="Findings">
            <ul className="space-y-1.5">
              {d.findings.map((f, i) => (
                <li key={i} className={T.body}>
                  {f}
                </li>
              ))}
            </ul>
          </Part>

          <Part label="Requirements: proposed, with evidence and decision">
            {d.requirements.length === 0 ? (
              <p className={T.meta}>No catalogue items are attached to this dimension.</p>
            ) : (
              <List>
                {d.requirements.map((r) => (
                  <RequirementRow key={r.id} r={r} canEdit={canEdit} onDecide={onDecide} />
                ))}
              </List>
            )}
          </Part>
        </Section>
      ))}
    </div>
  );
}

function RequirementRow({ r, canEdit, onDecide }: { r: RequirementResult; canEdit: boolean; onDecide: (d: Decision) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [rationale, setRationale] = useState(r.decision.rationale ?? "");
  const [error, setError] = useState("");
  const [flash, setFlash] = useFlash();
  const strongest = [...r.evidence_results].sort((a, b) => b.share - a.share)[0];

  async function decide(status: DecisionStatus) {
    setError("");
    try {
      await onDecide({ requirement_id: r.id, status, rationale: rationale.trim() || null });
      setFlash("Saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Row
      title={r.label}
      detail={
        <>
          {r.category}
          {r.core && (
            <>
              {" "}
              <Tag tone="mark">core</Tag>
            </>
          )}
        </>
      }
      meta={strongest ? `Q${strongest.question_number} ${strongest.count}/${strongest.n} (${pct(strongest.share)})` : undefined}
      tag={<DecisionTag status={r.decision.status} />}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      <p className={T.meta}>
        ID <code>{r.id}</code>
      </p>
      <Part label="Survey evidence in this selection">
        <ul className="space-y-1">
          {r.evidence_results.length === 0 && <li className={T.meta}>None of the evidence questions were answered in this selection.</li>}
          {r.evidence_results.map((e, i) => (
            <EvidenceLine key={i} e={e} />
          ))}
        </ul>
      </Part>
      <Panel label="Research decision">
        <Field label="Status">
          {(Object.keys(DECISION_LABELS) as DecisionStatus[]).map((s) => (
            <Chip key={s} on={r.decision.status === s} disabled={!canEdit} onClick={() => decide(s)}>
              {DECISION_LABELS[s]}
            </Chip>
          ))}
        </Field>
        <Field label="Rationale" htmlFor={`rationale-${r.id}`}>
          <input
            id={`rationale-${r.id}`}
            value={rationale}
            disabled={!canEdit}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why this decision"
            className={`${inputClass} flex-1`}
          />
          {canEdit && <LinkButton onClick={() => decide(r.decision.status)}>Save</LinkButton>}
          {flash && <span className={T.meta}>{flash}</span>}
        </Field>
        {r.decision.updated_at && (
          <p className={T.meta}>
            Last changed {new Date(r.decision.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            {r.decision.updated_by ? ` by ${r.decision.updated_by}` : ""}
          </p>
        )}
        {error && (
          <p role="alert" className="text-[13px] text-hint">
            {error}
          </p>
        )}
      </Panel>
    </Row>
  );
}

function EvidenceLine({ e }: { e: Evidence }) {
  if (e.distribution) {
    return (
      <li className={T.body}>
        Q{e.question_number} {e.label} (n = {e.n}): <span className="text-mute">{e.distribution.map((d) => `${d.label} ${d.count} (${pct(d.share)})`).join(" · ")}</span>
      </li>
    );
  }
  return (
    <li className={T.body}>
      Q{e.question_number} “{e.label}”: {e.count} of {e.n} ({pct(e.share)})
    </li>
  );
}

function DecisionTag({ status }: { status: DecisionStatus }) {
  const tone = status === "include" ? "strong" : status === "exclude" ? "struck" : status === "defer" ? "quiet" : "open";
  return <Tag tone={tone}>{DECISION_LABELS[status]}</Tag>;
}
