# masa-tanibata.github.io

Personal website. **All content lives in one file: [`content/profile.json`](content/profile.json).**
Edit that, run the build, push — the home page and the CV page both update.

## Run it locally

```bash
npm run dev
```

Builds, serves <http://localhost:8080>, watches `content/`, `src/` and `public/`, and
reloads every open browser tab whenever a file changes — so you can keep the page next
to the editor and watch `profile.json` edits land. No `npm install`: Node 18+ is all it needs.

- `npm run dev -- --port 3000` or `PORT=3000 npm run dev` to use another port
  (if 8080 is busy it steps up to the next one by itself).
- `npm run build` writes `dist/` once and exits — the same command CI runs.
- A broken `profile.json` prints one line saying what is wrong; the server stays up and
  keeps serving the last good build.

`git push` to `main` runs the same build in GitHub Actions and deploys `dist/` to Pages.

## Layout

```
content/profile.json   every fact on the site (bilingual)
src/build.mjs          renders the pages from the JSON
src/layout.mjs         shared <head>, top bar, sidebar card, language toggle
src/serve.mjs          dev server: watch + rebuild + live reload
public/                style.css, cv.pdf, favicon.svg — copied into dist/ as-is
dist/                  build output (git-ignored; Actions rebuilds it)
```

## What is on the page

`profile.json` drives every block below; delete a key and its section disappears.

| key | renders as |
|---|---|
| `tagline`, `callout` | opening statement, "looking for an internship" banner |
| `interests` | research-interest bullets — one string per bullet, `<strong>lead.</strong> rest |
| `news` | dated list — items may contain `<a>` links |
| `highlights` | research findings in plain language (the part a reader remembers) |
| `projects` | project entries with tags, an optional `funding` note and `links` chips |
| `publications` | authors / title / venue / year, `status` + `award` badges, `links` chips. English shows one list; Japanese splits into 国際会議・論文誌 / 国内会議・研究会 by `type` |
| `education`, `experience`, `talks`, `awards` | vertical timelines |
| `skills` | two-column definition list |
| `name`, `nameSub`, `pronunciation`, `role`, `location`, `links`, `meta.photo` | the sticky sidebar card |

## Editing rules

- **Bilingual fields** are `{ "en": "...", "ja": "..." }`. A plain string is used for
  both languages (e.g. skill names).
- Content strings may contain inline HTML (`<em>`, `<a href>`) — they are emitted verbatim.
- Anything starting with `TODO` is reported by the build as a placeholder to fill in.
### Adding a publication

Copy the last entry of `publications` (it is a template kept `"hidden": true`), fill it in
and set `"hidden": false`. Fields:

```jsonc
{
  "type": "domestic",              // "international" (default) or "domestic"
  "authors": { "en": "Masaru Tanibata, …", "ja": "谷端 大, …" },  // or one plain string
  "title":   { "en": "…", "ja": "…" },   // or one plain string
  "venue":   { "en": "ASJ 2026 Spring Meeting", "ja": "日本音響学会 2026年春季研究発表会" },
  "year":    "2026",
  "status":  { "en": "under review", "ja": "査読中" },   // or null
  "award":   { "en": "Best Student Paper", "ja": "学生優秀賞" },  // or null
  "links":   [{ "label": "Paper", "url": "…" }],
  "hidden":  false
}
```

`type` only changes the Japanese view: `international` goes under 国際会議・論文誌,
`domestic` under 国内会議・研究会. The English view stays a single list in file order,
so keep the array newest-first. Your own name is bolded automatically in both languages
(it is matched against `name.en` / `name.ja`).
### The CV page

`/cv.html` embeds the PDF inline (with Download / Open-in-new-tab buttons) above the
HTML version. Two ways to serve it, switched with `meta.cvSource`:

| `meta.cvSource` | where the PDF comes from | updating it |
|---|---|---|
| `"local"` (default) | `public/cv.pdf` in this repo | replace the file, `git push` |
| `"drive"` | the Google Drive file in `meta.cvDriveId` | replace it in Drive — the site follows, no rebuild |

For Drive: open the file, Share → "Anyone with the link" → Viewer, then copy the ID out of
`https://drive.google.com/file/d/<THIS PART>/view` into `meta.cvDriveId`. Note the file
becomes publicly readable, and Google sees who views it.

Either way, bump `meta.cvUpdated` so the page says when it last changed. The inline viewer
is hidden on phones (mobile browsers will not render a PDF in an iframe) and replaced with
a link — the Download button works everywhere.
- Profile photo: put a square image at `public/img/profile.jpg` and set `meta.photo`.
- Publication chips: `"links": [{ "label": "Paper", "url": "..." }, { "label": "Code", "url": "..." }]`.
- Project chips take a bilingual label: `"links": [{ "label": { "en": "Project page", "ja": "プロジェクト紹介" }, "url": "..." }]`.
- `funding` on a project prints a grey attribution line above the tags.
- Icons come from Font Awesome 6 (`"icon": "fa-brands fa-github"`); fonts from Google Fonts.
  Both are CDN `<link>`s in `src/layout.mjs` — the build itself stays dependency-free.

## First-time setup on GitHub

1. Create a repo named exactly `masa-tanibata.github.io`.
2. `git init && git add -A && git commit -m "Initial site" && git branch -M main`
3. `git remote add origin https://github.com/masa-tanibata/masa-tanibata.github.io.git && git push -u origin main`
4. Repo → Settings → Pages → **Source: GitHub Actions**.

The site is then live at https://masa-tanibata.github.io.
