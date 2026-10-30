# How you work with plants

A short, anonymous, mobile-first survey for a UBC Master of Landscape Architecture research project. It asks how landscape designers look up, choose and remember plants, so that any future AI planting tool is built on how people actually work.

Vite + React + TypeScript + Tailwind on the front end. Responses go into one Supabase table. The site is static and deploys to GitHub Pages.

The one site has two modes:

- **Survey** at the root: what respondents see.
- **Developer mode** at `#/dev` (also the small “Developer” link at the foot of the survey): sign in by email link. Members see one shared selection (questionnaire version, roles, experience) and three tabs: **Survey analytics** (counts with their base n, open answers, raw CSV and analysis JSON), **Database insights** (six research dimensions, each showing survey evidence, the research team’s proposed requirements with their evidence, and a recorded decision per requirement; exported as `database_requirements.json`) and **Plant candidates** (the plants named in question 14 with the notes respondents attached in question 15; merge spellings, shortlist, add notes; exported as `plant_candidates.json`). In local development without Supabase it opens on generated sample data; a production build without Supabase shows a configuration error instead.

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

CSV layout: one column per question id, in display order (`q1`, `q2`, `q11`, `q3`, `q4`, `q5`, `q7`, `q8`, `q9`, `q10`, `q16`, `q6`, `q17`, `q14`, `q15_plant`, `q15`). Multi-selects are joined with ` | `; an "Other" choice appears as `Other: <text>`. Grid rows become `q7_hardiness`, `q7_light`, … with the chosen column label, or `Not applicable`. Q14 becomes `q14_1` … `q14_5`; `q15_plant` holds the plant the note is about, or `Unassigned` for notes written under versions 1–2, which never had one. Questions 14 and 15 were optional before version 4, so older rows may have them blank; from version 5 `q14_not_applicable` reads `Not applicable` and `q15_plant` reads `Not applicable` for respondents who could not name plants, which is different from a blank (unanswered). Answers stored under keys that no longer exist (`q12`, `q13` from version 1) are left out, never mapped onto other columns. The file opens directly in Excel and Numbers.

## Editing the questions

All copy lives in [`src/questions.ts`](src/questions.ts): title, intro, sections, questions, options and the closing screen. Components only render what they are given.

- Keep option, row and item `key`s stable once responses exist; they are what is stored. Labels can change freely.
- Question ids are storage keys, not display numbers: the number shown is the question’s position in `SECTIONS`, so reordering never renames data.
- Bump `QUESTIONS_VERSION` when a change affects how old answers should be read. Version 2 reordered the questions, replaced q3’s options, split q11’s web/AI option, removed q12 and q13 and added q16 and q17. Version 3 made q15 name the plant it is about (stored as `{ plant, text }`); earlier string notes stay readable and are shown as unassigned. Version 4 replaced q2’s `both` with `personal` (older answers keep `both` and are reported as an earlier-version selection, never merged), made q14 (at least three plants) and q15 (a listed plant plus a note) required, removed the three-selection cap on q4 and q16, and reworded q10. Version 5 lets a respondent who cannot name three plants say so on q14 (stored as `{ not_applicable: true, entries }`, keeping anything typed) and answer q15 with `{ not_applicable: true }`; such answers are counted apart and never as plant mentions. Three *different* plants are required otherwise, compared without case or extra spaces.
- Flags on options: `exclusive` (clears the others), `other` (shows a text field), `fixed` (stays at the end when the question is shuffled). On questions: `max` (choose up to N), `shuffle`.

## Choices made where the brief left room

- **Questions are numbered 1 to 15** in display order; the five groups are quiet grey labels, and the first group shows none.
- **No experience yet.** A respondent who answers “None yet” to question 2 sees a not-applicable choice on the two questions that assume a real design (measurements used, and the considerations grid). Leaving “None yet” later removes those choices and anything selected under them.
- **Statistics.** Developer mode defaults to the current questionnaire version; other versions can be selected but answers to options that no longer exist are reported as such, not merged. Shares are of respondents who answered each question (n); Q7 rows exclude not-applicable and missing answers from their denominators; role groups may overlap because question 1 allows several roles. Every tab and export uses the same selection.
- **All fifteen questions are required.** The bar counts only finished questions; Submit scrolls to the first unfinished one and shows a hint under it (for example “Please list at least 3 plants”). Editing the plant list clears a note’s plant if that plant is removed, so it has to be chosen again.
- **Saved only when saved.** The closing screen appears only after the database confirms the insert; otherwise the error stays on screen with the Submit button. In `npm run dev` without Supabase env vars the response is logged instead, which the console says plainly.
- **One scrolling page, not one screen per question.** The intro, five parts and the Submit button sit on a single page so nobody has to tap Next fifteen times. The thin line at the top fills as required questions are answered. Submit checks the thirteen required questions, scrolls to the first one missing and shows a one-line hint under each.
- **Storage is key-based.** The database stores option keys; the export resolves them to the current labels. This keeps data readable after wording edits.
- **Export is a local script, not a password-protected web route.** The site is static, so a `/export` route would have needed a server to hide the service role key. A local script is simpler and exposes nothing publicly.
- **Double submission** is blocked for the page session in memory. A reload allows a new response, by design, since nothing identifies the respondent.
- **Duration** counts from the first answer interaction, not from opening the page.
- **Q11 wording**: the brief’s “Which three sources” is kept as a “choose up to 3” question so people with fewer sources are not forced to invent one.
