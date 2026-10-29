import type { Question } from "../questions.ts";
import type { Answer, ChoiceAnswer, GridAnswer, TextAnswer, TextListAnswer } from "../lib/answers.ts";
import { missingHint } from "../lib/answers.ts";
import { ChoiceQuestion } from "./ChoiceQuestion.tsx";
import { GridQuestion } from "./GridQuestion.tsx";
import { TextListQuestion, TextQuestion } from "./TextQuestions.tsx";

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
};

export function QuestionBlock({ question, answer, onChange, showHint, desktop, number, noExperience }: Props) {
  const hint = showHint ? missingHint(question) : "";
  return (
    <section id={`block-${question.id}`} aria-labelledby={`title-${question.id}`} className="scroll-mt-16">
      <h3 id={`title-${question.id}`} className="text-[18px] font-semibold leading-snug text-ink">
        <span className="mr-2 font-medium tabular-nums text-mute">{number}</span>
        {question.text}
      </h3>
      {question.help && (
        <p className="mt-1.5 text-[15px] text-ink">
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
          <TextListQuestion question={question} answer={answer as TextListAnswer | undefined} onChange={onChange} />
        ) : (
          <TextQuestion question={question} answer={answer as TextAnswer | undefined} onChange={onChange} />
        )}
      </div>
      {hint && (
        <p role="alert" className="mt-2 text-[14px] text-hint">
          {hint}
        </p>
      )}
    </section>
  );
}
