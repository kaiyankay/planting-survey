/**
 * The developer mode’s small vocabulary of pieces. Every tab is built from
 * these so sizes, spacing and controls stay the same from page to page.
 *
 * Type scale, four steps only:
 *   title  18px semibold   section of a tab (a research dimension, a group)
 *   item   15px medium     a question, a requirement, a plant
 *   body   14px            prose, option labels, inputs
 *   meta   12px muted      labels, counts, helper lines
 * Numbers inside charts are 13px tabular.
 *
 * Rhythm: sections start with a hairline and 48px of air; items inside a
 * section sit 32px apart; everything inside an item is 12px apart.
 */
import { useState, type ReactNode } from "react";

export const T = {
  title: "text-[18px] font-semibold leading-snug text-ink",
  item: "text-[15px] font-medium leading-snug text-ink",
  body: "text-[14px] leading-relaxed text-ink",
  meta: "text-[12px] leading-snug text-mute",
  num: "text-[13px] tabular-nums text-mute",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
export { pct };

/** Top of every tab: what the page is about on the left, its actions on the right. */
export function Toolbar({ summary, children }: { summary: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <p className={`${T.body} max-w-[34rem] text-mute`}>{summary}</p>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Button({ primary, children, ...rest }: { primary?: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={[
        "inline-flex min-h-9 items-center rounded-md px-3.5 text-[14px] font-medium transition-colors disabled:opacity-50",
        primary ? "bg-fill text-on-fill hover:opacity-90" : "border border-line text-ink hover:bg-chip",
        rest.className ?? "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** A quiet inline action, for things like Save and Undo. */
export function LinkButton({ children, ...rest }: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={`text-[13px] text-mute underline underline-offset-2 hover:text-ink disabled:opacity-50 ${rest.className ?? ""}`}>
      {children}
    </button>
  );
}

/** A toggle in a group: filters, statuses, decisions. */
export function Chip({ on, children, ...rest }: { on: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={on}
      {...rest}
      className={[
        "rounded-md border px-2.5 py-1 text-[13px] leading-snug transition-colors disabled:cursor-default",
        on ? "border-ink bg-chip text-ink" : "border-line text-mute enabled:hover:bg-chip",
        rest.className ?? "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** A read-only state marker, same size as a chip. */
export function Tag({ tone = "quiet", children }: { tone?: "quiet" | "strong" | "struck" | "open" | "mark"; children: ReactNode }) {
  const cls = {
    quiet: "border-line text-mute",
    strong: "border-ink text-ink",
    struck: "border-line text-mute line-through",
    open: "border-dashed border-line text-mute",
    mark: "border-transparent bg-mark text-ink",
  }[tone];
  return <span className={`inline-block rounded-md border px-2 py-0.5 text-[12px] leading-snug ${cls}`}>{children}</span>;
}

/** A section of a tab. */
export function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className={T.title}>{title}</h2>
      {sub && <p className={`${T.meta} mt-1`}>{sub}</p>}
      <div className="mt-6 space-y-8">{children}</div>
    </section>
  );
}

/** A labelled part inside a section. */
export function Part({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className={`${T.meta} font-medium`}>{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Rules that apply to a tab, folded away until wanted. */
export function About({ items }: { items: string[] }) {
  return (
    <details className="mt-3">
      <summary className={`${T.meta} cursor-pointer select-none hover:text-ink`}>How to read these numbers</summary>
      <ul className="mt-2 max-w-[36rem] space-y-1 pl-4">
        {items.map((it, i) => (
          <li key={i} className={`${T.meta} list-disc`}>
            {it}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** A bordered box for controls that change stored data. */
export function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-line p-3">
      <p className={`${T.meta} font-medium`}>{label}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

/** A labelled control line inside a Panel: label on the left, controls on the right. */
export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={htmlFor} className={`${T.meta} w-28 shrink-0`}>
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputClass = "min-w-0 rounded-md border border-line bg-field px-2.5 py-1.5 text-[14px] text-ink focus:border-ink disabled:opacity-60";

/** One row of an expandable list: a title that opens the row, meta on the right, a tag at the end. */
export function Row({
  title,
  detail,
  meta,
  tag,
  open,
  onToggle,
  children,
}: {
  title: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  tag?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
          <span className={`${T.meta} w-3 shrink-0`} aria-hidden>
            {open ? "–" : "+"}
          </span>
          <span className={T.item}>{title}</span>
          {detail && <span className={T.meta}>{detail}</span>}
        </button>
        {meta && <span className={T.num}>{meta}</span>}
        {tag}
      </div>
      {open && <div className="mt-4 space-y-4 pl-5">{children}</div>}
    </li>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-line border-y border-line">{children}</ul>;
}

export function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-md border border-line px-4 py-3">
      <p className={T.meta}>{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums leading-tight text-ink">{value}</p>
      {note && <p className={`${T.meta} mt-0.5`}>{note}</p>}
    </div>
  );
}

export function Bars({ items, max }: { items: { key: string; label: string; count: number; share: number }[]; max: number }) {
  const top = Math.max(max, 1);
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.key} className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3 md:grid-cols-[minmax(0,18rem)_1fr_auto]">
          <span className="truncate text-[14px] text-ink" title={it.label}>
            {it.label}
          </span>
          <span className="h-2 rounded-r-[4px] bg-line" aria-hidden>
            <span className="block h-full rounded-r-[4px] bg-fill" style={{ width: `${(it.count / top) * 100}%` }} />
          </span>
          <span className={`${T.num} w-20 text-right`}>
            {it.count} <span className="text-mute/70">{pct(it.share)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function GridTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string }[];
  rows: { key: string; label: string; n: number; cells: { col: string; count: number; share: number }[] }[];
}) {
  const top = Math.max(...rows.flatMap((r) => r.cells.map((c) => c.count)), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${T.meta} pb-2 text-left font-medium`} />
            <th className={`${T.meta} pb-2 pr-2 text-right font-medium`}>n</th>
            {columns.map((c) => (
              <th key={c.key} className={`${T.meta} pb-2 pr-2 text-left align-bottom font-medium`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <td className="py-1.5 pr-3 text-ink">{r.label}</td>
              <td className={`${T.num} py-1.5 pr-2 text-right`}>{r.n}</td>
              {r.cells.map((cell) => (
                <td key={cell.col} className="py-1.5 pr-2 tabular-nums text-ink">
                  <span
                    className="inline-block min-w-[3.25rem] rounded-[4px] px-1.5 py-0.5"
                    style={{ background: `color-mix(in oklab, var(--accent) ${Math.round((cell.count / top) * 55)}%, transparent)` }}
                  >
                    {cell.count} <span className="text-mute">{pct(cell.share)}</span>
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Short texts from respondents, five at a time. */
export function TextList({ label, items }: { label: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, 5);
  return (
    <div>
      <p className={T.meta}>{label}</p>
      <ul className="mt-2 space-y-1.5">
        {shown.map((t, i) => (
          <li key={i} className="rounded-md bg-chip px-3 py-2 text-[14px] leading-snug text-ink">
            {t}
          </li>
        ))}
      </ul>
      {items.length > 5 && (
        <LinkButton onClick={() => setOpen(!open)} className="mt-2">
          {open ? "Show fewer" : `Show all ${items.length}`}
        </LinkButton>
      )}
    </div>
  );
}

/** A short confirmation that fades after a save. */
export function useFlash(): [string, (msg: string) => void] {
  const [msg, setMsg] = useState("");
  return [
    msg,
    (m: string) => {
      setMsg(m);
      setTimeout(() => setMsg(""), 1600);
    },
  ];
}
