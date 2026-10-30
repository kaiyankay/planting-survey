import type { Question } from "../questions.ts";
import type { Answer, Answers, ChoiceAnswer, GridAnswer } from "../lib/answers.ts";
import { missingHint } from "../lib/answers.ts";
import { ChoiceQuestion } from "./ChoiceQuestion.tsx";
import { GridQuestion } from "./GridQuestion.tsx";
import { PlantNoteQuestion, TextListQuestion } from "./TextQuestions.tsx";

type Props = {
  question: Question;
  answer: Answer | undefined;
  onChange: (a: Answer) => void;
  showHint: boolean;
  desktop: boolean;
  /** 1-based position in the survey, shown before the question. */
  number: number;
  /** Whether the respondent said they have no planting design experience yet. */
  noExperience: boolean;
  /** For a plant note: the non-empty plants from its source question. */
  plants?: string[];
  /** For a plant note: whether the source list was marked not applicable. */
  sourceNotApplicable?: boolean;
  /** Every answer so far, for hints that depend on another question. */
  answers?: Answers;
};

export function QuestionBlock({ question, answer, onChange, showHint, desktop, number, noExperience, plants = [], sourceNotApplicable = false, answers }: Props) {
  const hint = showHint ? missingHint(question, answer, answers) : "";
  return (
    <section id={`block-${question.id}`} aria-labelledby={`title-${question.id}`} className="scroll-mt-16">
      <h3 id={`title-${question.id}`} className="text-[17px] font-semibold leading-snug text-ink">
        <span className="mr-2 font-medium tabular-nums text-mute">{number}</span>
        {question.text}
      </h3>
      {question.help && (
        <p className="mt-1.5 text-[14px] text-ink">
          <span className="help">{question.help}</span>
        </p>
      )}
      <div className="mt-3">
        {question.kind === "checkbox" || question.kind === "single" ? (
          <ChoiceQuestion question={question} answer={answer as ChoiceAnswer | undefined} onChange={onChange} noExperience={noExperience} />
        ) : question.kind === "grid" ? (
          <GridQuestion
            question={question}
            answer={answer as GridAnswer | undefined}
            onChange={onChange}
            desktop={desktop}
            allowNotApplicable={noExperience}
          />
        ) : question.kind === "textlist" ? (
          <TextListQuestion question={question} answer={answer} onChange={onChange} />
        ) : (
          <PlantNoteQuestion question={question} answer={answer} plants={plants} sourceNotApplicable={sourceNotApplicable} onChange={onChange} />
        )}
      </div>
      {hint && (
        <p role="alert" className="mt-2 text-[13px] text-hint">
          {hint}
        </p>
      )}
    </section>
  );
}
