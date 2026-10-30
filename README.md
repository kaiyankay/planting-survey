# How you work with plants

A short, anonymous, mobile-first survey for a UBC Master of Landscape Architecture research project (Planting Intelligence). Sixteen questions ask how people choose plants for Metro Vancouver today, what they cannot find out, how they would ask a plant database, what makes them trust others’ notes, and which plants they would consider. The full specification and the reasoning behind each question is in [docs/survey-spec.md](docs/survey-spec.md).

Vite + React + TypeScript + Tailwind on the front end. Responses go into one Supabase table. The site is static and deploys to GitHub Pages.

The one site has two modes:

- **Survey** at the root: what respondents see.
- **Developer mode** at `#/dev` (also the small “Developer” link at the foot of the survey): sign in by email link. Members see one shared selection (roles from a1, experience from a2) and two tabs: **Survey analytics** (counts with their base n, the b1 matrix as a 10 × 3 table with each row’s must-pass share, an **Open responses** block listing every free-text answer from b4, c3, d1, d2 and f2 verbatim (f2 with what the note was based on) with the respondent’s a1 / a2 groups, filterable by experience and exportable as one CSV, plus the raw CSV and an analysis JSON) and **Plant candidates** (the plants named in f1 with role, reason and mention count, and the note attached in f2; merge spellings, shortlist, add notes; exported as `plant_candidates.json`). Nothing is categorised or counted automatically beyond these. In local development without Supabase it opens on generated sample data; a production build without Supabase shows a configuration error instead.

## Run it locally

Node 20 or newer.

```bash
npm install
npm run dev
```

Open the printed URL. Without Supabase env vars the survey still runs end to end; a submitted response is printed to the browser console instead of being stored.

Other scripts:

```bash
npm test          # export flattening and validation rules
npm run typecheck
npm run build     # static site in dist/
```

## Supabase setup

1. Create a project at supabase.com (the free tier is enough).
2. Open SQL Editor and run [`supabase.sql`](supabase.sql). It creates the `responses` table and a Row Level Security policy that lets the public anon key insert rows and nothing else.
3. In Project Settings → API, copy the project URL and the `anon` key.
4. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The key is the project’s **publishable** key (`sb_publishable_…`, Project Settings → API Keys); a legacy `anon` JWT works too. Restart `npm run dev`.

### Developer mode access

Access is decided in the database, not in the page. `supabase.sql` creates:

- `dev_members` (email, role): who may read. Roles are **owner** (the only account that can grant or remove access), **editor** (reads everything and can change plant and requirement decisions) and **viewer** (reads everything, including raw responses; it cannot change decisions).
- `dev_role()`: a function that returns the signed-in account’s role, used by every policy.
- `plant_reviews` and `requirement_reviews`: reviewers’ decisions. Survey responses are never modified.

Setup, once:

1. Authentication → Providers → Email: keep it enabled (magic link; no password needed).
2. Authentication → URL Configuration: set Site URL to where the site is served (for example `https://<user>.github.io/<repo>/`) and add it to Redirect URLs. For local work add `http://localhost:5174/` too.
3. Run the whole of `supabase.sql` in the SQL editor. It is safe to run again later; it never touches responses.
4. Set the owner, with your own email, in the SQL editor:

   ```sql
   select public.dev_set_owner(you@example.com);
   ```

   This does nothing if an owner already exists, so it cannot replace one. No email is written into the repository.
5. Open `#/dev`, enter that email, click the link in the message.

For a project that already ran an earlier version of `supabase.sql`, run `supabase/migrations/2026-10-29_requirement_reviews.sql` instead; it adds the owner function and the `requirement_reviews` table and changes nothing else.

Granting access: in developer mode the owner sees **Share**. Enter an email, choose Viewer or Editor, **Grant access**. No message is sent: copy the developer link from the same dialog and send it yourself; the person signs in there with that email and the database lets them in. The dialog also changes roles and removes members. No one else can grant access, and nothing in the app can add another owner or remove the owner row; those are database rules, so hiding buttons is not what protects them. No service-role key is involved.

Each response is one row:

| column | meaning |
| --- | --- |
| `id` | uuid |
| `submitted_at` | server time of the insert |
| `duration_seconds` | first answer tap to Submit |
| `questions_version` | the `QUESTIONS_VERSION` in `questions.ts` at the time |
| `answers` | jsonb, keyed by question id, holding option keys (not labels) |

No IP address, email, cookie or device identifier is stored. The anon key is published with the site; it can only insert.

## Deploy to GitHub Pages

1. Push the repository to GitHub. The workflow in `.github/workflows/deploy.yml` builds and publishes on every push to `main`.
2. In the repository settings, Pages → Source: **GitHub Actions**.
3. Settings → Secrets and variables → Actions → **Variables** tab: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. (They are build-time values baked into the bundle, which is fine for the anon key.)
4. Push, or run the workflow by hand from the Actions tab. The site appears at `https://<user>.github.io/<repo>/`.

Assets use relative paths, so the build also works under any other static host or sub-path.

## Export responses

The quickest way is the **Download CSV** button under Survey analytics in developer mode. The same mode also offers an analysis JSON, and the two database exports described above. The same file can be produced from the command line:

```bash
npm run export
```

This downloads every row and writes `responses-YYYY-MM-DD.csv` in the project folder. It needs the **service role** key, which bypasses Row Level Security:

- Project Settings → API → `service_role` key.
- Put it in `.env` as `SUPABASE_SERVICE_ROLE_KEY`. `.env` and `*.csv` are git-ignored. Never put this key in a `VITE_` variable or in the GitHub repository.

CSV layout: one column per question id in survey order (`a1`, `a2`, `a3`, `b1_hardiness` … `b1_invasive`, `b2`, `b3`, `b4`, `c1`, `c2`, `c3`, `f1_1_name`, `f1_1_role`, `f1_1_why` … `f1_5_why`, `f1_not_applicable`, `f2_plant`, `f2`, `f2_basis`, `d1`, `d2`, `e1`, `e2`). Multi-selects are joined with ` | `; an “Other” choice appears as `Other: <text>`. Questions a respondent was not shown (b1, section C and section F for people with no planting experience) are absent from their stored answers and blank in the CSV. A plant list or note answered “not applicable” says so in `f1_not_applicable` / `f2_plant`. Every row carries `questions_version` = 1.

## Editing the questions

All copy lives in [`src/questions.ts`](src/questions.ts): title, intro, sections, questions, options and the closing screen. Components only render what they are given.

- Keep option, row and item `key`s stable once responses exist; they are what is stored. Labels can change freely.
- Question ids (`a1` … `f2`) are storage keys, never shown on the page; the number a respondent sees is the question’s position among the questions shown to them, so skipping b1, C or F renumbers the rest.
- `QUESTIONS_VERSION` is 1 and every stored response carries it. Bump it if the questions change after responses exist.
- Flags on options: `exclusive` (clears the others), `other` (shows a text field), `fixed` (stays at the end when the question is shuffled). On questions: `max` (choose up to N), `shuffle`, `requiresExperience` (hidden for respondents whose a2 is only “None yet”); on sections the same flag hides the whole section.

## Choices made where the spec left room

- **One scrolling page.** Intro, six sections (A, B, C, F, D, E) and one Submit button on a single page; the thin line at the top counts only the required questions shown, so it reaches 100% when everything needed is answered even if b4, d1 or the reason column are blank. Submit checks every shown required question, scrolls to the first unfinished one and shows a hint under it.
- **Skipping.** `hasExperience` is false only when a2 is exactly “None yet”; then b1, section C and section F are not rendered, not validated and not stored. Before a2 is answered everything is shown.
- **f1.** At least one plant name with a role (“Not sure” counts); names that differ only in case or spacing count once. The reason column is optional. The not-applicable option keeps anything typed so it can be unticked.
- **f2.** A note needs a plant that is still on the f1 list, text, and a basis (used in my own project / observed / read / a combination), stored as `{ plant, text, basis }`; when f1 is not applicable, f2 offers only its own not-applicable option, and switching f1 back to plants resets it.
- **Hidden questions are omitted** from stored answers rather than written as null.
- **Developer mode** keeps the sharing and review mechanism from before; the former Database insights tab and its requirement catalogue were removed in favour of listing open answers verbatim.
- **Saved only when saved.** The closing screen appears only after the database confirms the insert; otherwise the error stays on screen with the Submit button. In `npm run dev` without Supabase env vars the response is logged instead.
