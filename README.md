# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 📰 Republishing

Four sources are licensed for republication here. Each importer emits the byline, credit
link and logo its licence requires, and strips images by default — no licence here covers
third-party photographs.

| Source | Licence | Vietnamese translation |
|---|---|---|
| The Conversation | CC BY-ND 4.0 | needs the author's approval |
| SciDev.Net | CC BY 2.0 | allowed |
| Mongabay | CC BY-ND 4.0 | needs written permission |
| Global Voices | CC BY 3.0 | allowed |

### The Conversation — CC BY-ND

```sh
node scripts/import-the-conversation.mjs --list   # see what's in the feed
node scripts/import-the-conversation.mjs 288792   # import one by ID
```

English only: CC BY-ND forbids derivative works, so a Vietnamese translation needs the
author's written approval first. See
[docs/republishing-the-conversation.md](docs/republishing-the-conversation.md).

### SciDev.Net — CC BY

```sh
node scripts/import-scidev-net.mjs --list
node scripts/import-scidev-net.mjs https://www.scidev.net/global/news/<slug>/
node scripts/import-scidev-net.mjs <url> --lang vi   # translation is allowed here
```

Plain CC BY permits derivatives, so this is the one source that can be translated into
Vietnamese without asking. See
[docs/republishing-scidev-net.md](docs/republishing-scidev-net.md).

### Mongabay — CC BY-ND

```sh
node scripts/import-mongabay.mjs --list
node scripts/import-mongabay.mjs https://news.mongabay.com/2026/08/<slug>/
```

Environment, forests and biodiversity reporting. English only. Mongabay also carries
Associated Press wire copy that its licence does not cover — the importer refuses news
agency bylines, but check yourself too. See
[docs/republishing-mongabay.md](docs/republishing-mongabay.md).

### Global Voices — CC BY

```sh
node scripts/import-global-voices.mjs --list
node scripts/import-global-voices.mjs https://globalvoices.org/2026/08/31/<slug>/
node scripts/import-global-voices.mjs <url> --lang vi --slug <slug-tiếng-việt>
```

International reporting from a volunteer newsroom. Plain CC BY, so translation is allowed.
Global Voices also republishes partner outlets under separate agreements its licence does
not cover — the importer refuses those. See
[docs/republishing-global-voices.md](docs/republishing-global-voices.md).

Read the relevant doc before importing — between them they cover the rules the scripts
can't enforce: no bulk imports, and images are never automatically cleared for reuse.

## 📊 Analytics events

Set `PUBLIC_GTM_ID` (see `.env.example`) to a GTM container — GA4 itself is configured as
a tag inside that container, not as a separate env var here. Four custom events get pushed
to `window.dataLayer`, all from `src/scripts/demo-state.ts` and
`src/components/CookieConsent.astro`:

| Event | Params | Fires |
|---|---|---|
| `demo_first_interact` | `demo_id`, `control` | Once per demo per pageview, on the first slider touch. |
| `demo_share` | `demo_id` | Clicking a demo's "Sao chép liên kết" button. |
| `internal_link_click` | `link_type` (`related` \| `pager`) | Clicking a related-post or prev/next link on a post. |
| `consent_banner_shown` / `consent_choice` | — / `consent_choice` (`accepted` \| `declined`) | The cookie banner rendering, and a visitor answering it. |

The one number worth tracking: `demo_first_interact ÷ page_view` — what fraction of readers
touch a demo at all. See [docs/trust-and-instrumentation.md](docs/trust-and-instrumentation.md).

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
