import { CLOSING, INTRO, SURVEY_TITLE, type Section } from "../questions.ts";

export function Intro() {
  return (
    <header className="mx-auto max-w-[42rem] px-6 pb-2 pt-20 md:pt-24">
      <h1 className="text-[30px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[34px]">{SURVEY_TITLE}</h1>
      <p className="mt-4 max-w-[36rem] text-[16px] leading-relaxed text-ink">{INTRO.lead}</p>
      <p className="mt-1.5 text-[15px] text-mute">{INTRO.note}</p>
    </header>
  );
}

export function SectionHeader({ section, index }: { section: Section; index: number }) {
  return (
    <div id={`part-${index + 1}`} className={index === 0 ? "scroll-mt-16" : "scroll-mt-16 border-t border-line pt-5"}>
      <h2 id={`section-${section.id}`} className={index === 0 ? "sr-only" : "text-[14px] text-mute"}>
        {section.title}
      </h2>
      {section.help && (
        <p className="mt-2 max-w-[34rem] text-[15px] leading-relaxed text-ink">
          <span className="help">{section.help}</span>
        </p>
      )}
    </div>
  );
}

export function Closing() {
  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-[42rem] flex-col justify-center px-6 py-16">
      <h1 className="text-[30px] font-bold leading-tight text-ink md:text-[34px]">{CLOSING.title}</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-mute">{CLOSING.body}</p>
    </div>
  );
}
