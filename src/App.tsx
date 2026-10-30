import { useCallback, useMemo, useRef, useState } from "react";
import { ALL_QUESTIONS, NO_EXPERIENCE, SECTIONS, type Question } from "./questions.ts";
import { GRID_NA, hasAnswer, isComplete, listEntries, readList, readPlantNote, type Answer, type Answers, type ChoiceAnswer, type GridAnswer } from "./lib/answers.ts";
import { submitResponse } from "./lib/submit.ts";
import { DESKTOP_QUERY, useMediaQuery } from "./hooks/useMediaQuery.ts";
import { QuestionBlock } from "./components/QuestionBlock.tsx";
import { Closing, Intro, SectionHeader } from "./components/Screens.tsx";

/** Every question must be answered before submitting. */
const REQUIRED = ALL_QUESTIONS;

export default function App() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [answers, setAnswers] = useState<Answers>({});
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "done">("idle");
  const firstInteraction = useRef<number | null>(null);
  const submitted = useRef(false);

  // Only a finished question counts, so the bar reaches 15 of 15 only when everything is done.
  const answered = useMemo(() => ALL_QUESTIONS.filter((q) => hasAnswer(q, answers[q.id], answers)).length, [answers]);
  const progress = answered / ALL_QUESTIONS.length;
  const noExperience = (answers[NO_EXPERIENCE.question] as ChoiceAnswer | undefined)?.selected.includes(NO_EXPERIENCE.key) ?? false;

  const setAnswer = useCallback((q: Question, a: Answer) => {
    firstInteraction.current ??= Date.now();
    setAnswers((prev) => {
      const next = { ...prev, [q.id]: a };
      // Leaving "no experience" removes the not-applicable choices that only it offered.
      if (q.id === NO_EXPERIENCE.question && !(a as ChoiceAnswer).selected.includes(NO_EXPERIENCE.key)) {
        for (const other of ALL_QUESTIONS) {
          const v = next[other.id];
          if (!v) continue;
          if (other.kind === "checkbox" || other.kind === "single") {
            const hidden = other.options.filter((o) => o.noExperienceOnly).map((o) => o.key);
            const c = v as ChoiceAnswer;
            if (c.selected.some((k) => hidden.includes(k))) next[other.id] = { ...c, selected: c.selected.filter((k) => !hidden.includes(k)) };
          } else if (other.kind === "grid" && (v as GridAnswer)[GRID_NA] === "yes") {
            delete next[other.id];
          }
        }
      }
      // Editing the plant list: a note attached to a plant that is no longer listed loses its plant, not its
      // text; and a note marked not applicable is reset once the list has plants again.
      if (q.kind === "textlist") {
        const list = readList(a);
        for (const other of ALL_QUESTIONS) {
          if (other.kind !== "plantnote" || other.sourceQuestion !== q.id) continue;
          const note = readPlantNote(next[other.id]);
          if (!list.notApplicable && note.notApplicable) next[other.id] = { plant: "", text: "" };
          else if (note.plant && !list.entries.includes(note.plant)) next[other.id] = { plant: "", text: note.text };
        }
      }
      return next;
    });
    setMissing((prev) => {
      if (!prev.has(q.id) || !isComplete(q, a)) return prev;
      const next = new Set(prev);
      next.delete(q.id);
      return next;
    });
  }, []);

  async function submit() {
    if (submitted.current) return;
    const unanswered = REQUIRED.filter((q) => !isComplete(q, answers[q.id], answers));
    if (unanswered.length > 0) {
      setMissing(new Set(unanswered.map((q) => q.id)));
      document.getElementById(`block-${unanswered[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setStatus("sending");
    const started = firstInteraction.current ?? Date.now();
    const duration = Math.max(0, Math.round((Date.now() - started) / 1000));
    try {
      await submitResponse(answers, duration);
      submitted.current = true;
      setStatus("done");
      window.scrollTo({ top: 0 });
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  if (status === "done") return <Closing />;

  const remaining = REQUIRED.filter((q) => !isComplete(q, answers[q.id], answers)).length;

  return (
    <div className="min-h-dvh">
      <div className="fixed inset-x-0 top-0 z-30 bg-bg/92 backdrop-blur">
        <div className="h-[3px] bg-line" aria-hidden>
          <div className="h-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mx-auto flex max-w-[42rem] items-center justify-end px-6 py-1.5 text-[13px] text-mute">
          <span className="tabular-nums" aria-live="polite">
            {answered} of {ALL_QUESTIONS.length} answered
          </span>
        </div>
      </div>

      <Intro />

      <main className="mx-auto max-w-[42rem] px-6 pb-24">
        {SECTIONS.map((section, i) => (
          <section key={section.id} aria-labelledby={`section-${section.id}`} className={i === 0 ? "pt-6" : "pt-10 md:pt-12"}>
            <SectionHeader section={section} index={i} />
            <div className="mt-6 space-y-9">
              {section.questions.map((q) => (
                <QuestionBlock
                  key={q.id}
                  question={q}
                  answer={answers[q.id]}
                  onChange={(a) => setAnswer(q, a)}
                  showHint={missing.has(q.id)}
                  desktop={desktop}
                  number={ALL_QUESTIONS.indexOf(q) + 1}
                  noExperience={noExperience}
                  plants={q.kind === "plantnote" ? listEntries(answers[q.sourceQuestion]) : undefined}
                  sourceNotApplicable={q.kind === "plantnote" ? readList(answers[q.sourceQuestion]).notApplicable : undefined}
                  answers={answers}
                />
              ))}
            </div>
          </section>
        ))}

        <div className="mt-12 border-t border-line pt-6">
          <p className="text-[13px] text-mute">
            {answered} of {ALL_QUESTIONS.length} answered.{" "}
            {missing.size > 0
              ? `${missing.size} question${missing.size === 1 ? "" : "s"} above still need${missing.size === 1 ? "s" : ""} an answer.`
              : remaining > 0
                ? `${remaining} still need${remaining === 1 ? "s" : ""} an answer before you can submit.`
                : "Everything is answered."}
          </p>
          {status === "error" && (
            <p role="alert" className="mt-2 text-[13px] text-hint">
              Your answers couldn’t be sent. Check your connection and try again.
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={status === "sending"}
            className="mt-4 min-h-10 rounded-md bg-fill px-4 text-[14px] font-medium text-on-fill transition-opacity hover:opacity-85 disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Submit"}
          </button>
          <p className="mt-5 text-[13px] text-mute">Nothing is sent until you submit. No name, email or device identifier is recorded.</p>
        </div>
        <p className="mt-16 text-right text-[13px] text-mute">
          <a href="#/dev" className="hover:text-ink">
            Developer
          </a>
        </p>
      </main>
    </div>
  );
}
