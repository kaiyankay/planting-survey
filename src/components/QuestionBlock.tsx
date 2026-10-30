import type { Question } from "../questions.ts";
import { missingHint, plantNames, readPlantList, type Answer, type Answers, type ChoiceAnswer, type GridAnswer } from "../lib/answers.ts";
import { ChoiceQuestion } from "./ChoiceQuestion.tsx";
import { Grid3Question } from "./Grid3Question.tsx";
import { LongTextQuestion, PlantListQuestion, PlantNoteQuestion, ShortTextQuestion } from "./TextQuestions.tsx";

type Props = {
  question: Question;
  answer: Answer | undefined;
  onChange: (a: Answer) => void;
  showHint: boolean;
  /** 1-based position among the questions this respondent is shown. */
  number: number;
  /** Every answer so far, for questions and hints that depend on another question. */
  answers: Answers;
};

export function QuestionBlock({ question, answer, onChange, showHint, number, answers }: Props) {
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
          <ChoiceQuestion question={question} answer={answer as ChoiceAnswer | undefined} onChange={onChange} />
        ) : question.kind === "grid3" ? (
          <Grid3Question question={question} answer={answer as GridAnswer | undefined} onChange={onChange} />
        ) : question.kind === "shorttext" ? (
          <ShortTextQuestion question={question} answer={answer} onChange={onChange} />
        ) : question.kind === "longtext" ? (
          <LongTextQuestion question={question} answer={answer} onChange={onChange} />
        ) : question.kind === "plantlist" ? (
          <PlantListQuestion question={question} answer={answer} onChange={onChange} />
        ) : (
          <PlantNoteQuestion
            question={question}
            answer={answer}
            plants={plantNames(answers[question.sourceQuestion])}
            sourceNotApplicable={readPlantList(answers[question.sourceQuestion]).notApplicable}
            onChange={onChange}
          />
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
