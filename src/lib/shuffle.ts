import type { Option } from "../questions.ts";

/** Fisher–Yates shuffle of the non-fixed options; fixed ones keep their place at the end. */
export function orderOptions(options: Option[], shuffle: boolean | undefined): Option[] {
  if (!shuffle) return options;
  const loose = options.filter((o) => !o.fixed);
  const fixed = options.filter((o) => o.fixed);
  for (let i = loose.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [loose[i], loose[j]] = [loose[j], loose[i]];
  }
  return [...loose, ...fixed];
}
