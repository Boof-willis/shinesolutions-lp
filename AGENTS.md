<!-- Written by Ockno. Rewritten on every publish from Ockno; keep your own notes in CLAUDE.md or README.md. -->
# Working in this repository

This repository is the source of truth for the website **Shinesolutions Lp** (served at `shinesolutions-lp.ocknopages.com`).
Ockno renders it: every push to the default branch is synced and goes live for the pages the
manifest marks `published`. Nothing here needs a build step.

## Layout

- `pages/<route>.html` - one complete HTML document per page. `pages/index.html` is `/`,
  `pages/about.html` is `/about`, `pages/blog/post.html` is `/blog/post`.
- `assets/...` - static files. A page references them root-relative: `assets/css/site.css`
  is `/css/site.css` in the page.
- `ockno.config.json` - the manifest: routes, `published` flags, and a read-only mirror of the
  tracking bindings Ockno manages.
- `AGENTS.md` - these notes. Ockno rewrites them on every publish.
- `CLAUDE.md`, `README.md` - written once when missing, then yours.

## Rules the renderer enforces

1. **Keep `<meta name="ockno-page" content="...">` exactly as it is** in every page. It is the
   page's identity across renames and moves; captures, views and experiments join on it.
2. **A form marked `data-ockno-form` must map an identity field** (email, phone or a name).
   A page that breaks this is refused at sync: the last good version keeps serving and the page
   is flagged in Ockno until the next push validates. Your own `<script>`, handlers and embeds
   are fine: the page keeps its behavior, and Ockno's runtime runs alongside it.

## How Ockno features are written

- A lead form is a container with `data-ockno-form` (give it `data-ockno-name="quote"` when a
  page has more than one), inputs with `data-ockno-field="email|phone|first_name|last_name|full_name|company|city|..."`
  (`data-ockno-field="custom:<key>"` for an answer about the person, `data-ockno-field="opportunity:<key>"`
  for an answer about this one purchase such as budget or square footage), a `data-ockno-submit` button, and, optionally beside a phone
  field, a `data-ockno-consent` checkbox (records written text-message opt-in on the contact; the wording is yours). At least one of email / phone / a name is
  required. Ockno's runtime then owns validation and submission.
- Fields this workspace already has - reuse these keys whenever a question means the same thing;
  never invent a second key for it (Ockno merges duplicates, but it should not have to):
  contact: `custom:how_many_stories (How many stories)`
  opportunity: `opportunity:offer (Offer)`, `opportunity:plan (Plan)`
- A form that already has its own submit logic keeps it: mark it `data-ockno-form="observe"`
  and Ockno only records each submission (fields via `data-ockno-field`) alongside whatever the
  form does. Never remove or replace a page's own JavaScript to wire a form. Inputs the page's
  script builds at runtime (chips, option pickers): put `data-ockno-field` on the element that
  will contain them; Ockno reads whatever is checked or filled inside it. When that script
  posts somewhere Ockno's hosting does not serve, change only the send: `await window.ockno.submit(form)`
  resolves `{ok: true}` once Ockno has the lead, so the page can show its own success state.
- A booking calendar: `<div data-ockno-booking="calendar-slug"></div>` (leave it empty).
- A hosted form or survey authored in Ockno: `<div data-ockno-form-embed="form-slug"></div>`.
- Tailwind utility classes work as-is; Ockno compiles them on sync. Custom CSS goes in `assets/`.
- To publish or unpublish a page, flip its `published` flag in `ockno.config.json`.

## What to leave alone

- Ockno owns `ockno.config.json`'s `bindings_readonly` block and `AGENTS.md`; edits there are
  overwritten on the next publish from Ockno. `CLAUDE.md`, `README.md` and
  `.cursor/rules/ockno.mdc` are written once and then yours.
- Ockno only ever writes under `pages/`, `assets/` and its own files. Anything else you add
  (a `.github/` workflow, docs) is yours.
- Never commit secrets or credentials.

## Checks on every push

Ockno posts a check on every commit it syncs. Green: every page validated and went live. Red:
a page was refused (the check names the file and the line); the last good version of that
page keeps serving until the next push validates. A repository that turns into a framework
project (a `package.json` with Astro, Next.js, Vite, ...) gets an "action required" check:
Ockno keeps serving the last good pages and recommends switching the site to external hosting
(Ockno → the site → Repository → Hosting → My own host). Ockno never flips that itself.

The same rules run anywhere with `npx @ockno/site check .` (see the package README), and as a
GitHub Action (`uses: ockno/site@v1`) on pull requests.

## Hosting it yourself (external)

If this site needs its own JavaScript or a build step, switch it to external hosting in Ockno.
Then the contract is: one script tag on every page, once before `</body>`:

    <script src="https://api.ockno.com/api/v1/page-assets/ockno-site.js" data-ockno-site="site_jTCOR-BYayBpMqq7PRAn_QLU" defer></script>

plus the `data-ockno-*` attributes and `ockno-page` meta above, in the BUILT output. Run the
check against that output in CI (`npx @ockno/site check dist`). `@ockno/site/react` ships typed
helpers (`<OcknoForm>`, `<OcknoField>`, `<OcknoConsent>`, `<OcknoSubmit>`, `<OcknoBooking>`,
`<OcknoFormEmbed>`, `<OcknoScript>`) that render exactly this markup.
