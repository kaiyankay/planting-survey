import { useCallback, useMemo, useRef, useState } from "react";
import { SECTIONS, type Question } from "./questions.ts";
import { answersToStore, hasAnswer, isComplete, isRequired, isShown, readPlantList, readPlantNote, visibleQuestions, type Answer, type Answers } from "./lib/answers.ts";
import { submitResponse } from "./lib/submit.ts";
import { QuestionBlock } from "./components/QuestionBlock.tsx";
import { Closing, Intro, SectionHeader } from "./components/Screens.tsx";

export default function App() {
  const [answers, setAnswers] = useState<Answers>({});
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "done">("idle");
  const firstInteraction = useRef<number | null>(null);
  const submitted = useRef(false);

  // Which questions this respondent sees depends on their experience answer.
  const visible = useMemo(() => visibleQuestions(answers), [answers]);
  // Progress counts only the required questions that are shown, so finishing them is 100% even if optional ones are blank.
  const required = useMemo(() => visible.filter(isRequired), [visible]);
  const answered = useMemo(() => required.filter((q) => hasAnswer(q, answers[q.id], answers)).length, [required, answers]);
  const progress = required.length ? answered / required.length : 0;
  const numberOf = (q: Question) => visible.indexOf(q) + 1;

  const setAnswer = useCallback((q: Question, a: Answer) => {
    firstInteraction.current ??= Date.now();
    setAnswers((prev) => {
      const next = { ...prev, [q.id]: a };
      // Editing the plant list: a note about a plant no longer listed loses its plant, not its text;
      // a note marked not applicable is reset once the list has plants again.
      if (q.kind === "plantlist") {
        const list = readPlantList(a);
        const names = list.notApplicable ? [] : list.entries.map((e) => e.name);
        for (const other of visibleQuestions(next)) {
          if (other.kind !== "plantnote" || other.sourceQuestion !== q.id) continue;
          const note = readPlantNote(next[other.id]);
          if (!list.notApplicable && note.notApplicable) next[other.id] = { plant: "", text: "", basis: "" };
          else if (note.plant && !names.includes(note.plant)) next[other.id] = { plant: "", text: note.text, basis: note.basis };
        }
      }
      return next;
    });
    setMissing((prev) => {
      if (!prev.has(q.id)) return prev;
      const next = new Set(prev);
      next.delete(q.id);
      return next;
    });
  }, []);

  async function submit() {
    if (submitted.current) return;
    const unanswered = visible.filter((q) => isRequired(q) && !isComplete(q, answers[q.id], answers));
    if (unanswered.length > 0) {
      setMissing(new Set(unanswered.map((q) => q.id)));
      document.getElementById(`block-${unanswered[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setStatus("sending");
    const started = firstInteraction.current ?? Date.now();
    const duration = Math.max(0, Math.round((Date.now() - started) / 1000));
    try {
      await submitResponse(answersToStore(answers), duration);
      submitted.current = true;
      setStatus("done");
      window.scrollTo({ top: 0 });
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  if (status === "done") return <Closing />;

  const remaining = visible.filter((q) => isRequired(q) && !isComplete(q, answers[q.id], answers)).length;

  return (
    <div className="min-h-dvh">
      <div className="fixed inset-x-0 top-0 z-30 bg-bg/92 backdrop-blur">
        <div className="h-[3px] bg-line" aria-hidden>
          <div className="h-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mx-auto flex max-w-[42rem] items-center justify-end px-6 py-1.5 text-[13px] text-mute">
          <span className="tabular-nums" aria-live="polite">
            {answered} of {required.length} answered
          </span>
        </div>
      </div>

      <Intro />

      <main className="mx-auto max-w-[42rem] px-6 pb-24">
        {SECTIONS.map((section, i) => {
          const shown = section.questions.filter((q) => isShown(q, answers));
          if (shown.length === 0) return null;
          return (
            <section key={section.id} aria-labelledby={`section-${section.id}`} className={i === 0 ? "pt-6" : "pt-10 md:pt-12"}>
              <SectionHeader section={section} index={i} />
              <div className="mt-6 space-y-9">
                {shown.map((q) => (
                  <QuestionBlock
                    key={q.id}
                    question={q}
                    answer={answers[q.id]}
                    onChange={(a) => setAnswer(q, a)}
                    showHint={missing.has(q.id)}
                    number={numberOf(q)}
                    answers={answers}
                  />
                ))}
              </div>
            </section>
          );
        })}

        <div className="mt-12 border-t border-line pt-6">
          <p className="text-[13px] text-mute">
            {answered} of {required.length} answered.{" "}
            {missing.size > 0
              ? `${missing.size} question${missing.size === 1 ? "" : "s"} above still need${missing.size === 1 ? "s" : ""} an answer.`
              : remaining > 0
                ? `${remaining} still need${remaining === 1 ? "s" : ""} an answer before you can submit.`
                : "Everything needed is answered."}
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
