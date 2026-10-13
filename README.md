# Pratik Maynal — Portfolio

A personal portfolio built on the **Kage** landing page from [ThreeUI](https://threeui.com): a full-page,
scroll-driven WebGL scene (a night walk through a mountain temple, rendered live with Three.js) carrying
Pratik's own content. The scene, shaders, motion and responsive layout are the authored ones; only the
words, a handful of blocks and the wordmark have been changed.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks, then writes dist/
npm run preview    # serves dist/ locally
```

`dev` and `build` first run `verify:sources` (hash check) and `generate` (rebuilds the portfolio page from
`content/`), so there is nothing else to remember.

## Change your content

Everything you read on the page lives in **[content/profile.json](content/profile.json)**: name, contact
details, résumé link, social links, the about text, skill groups, experience, education, headings and
footer. Edit it, then run `npm run generate` (or just restart `npm run dev`).

| Section on the page | Keys in `profile.json` |
| --- | --- |
| Hero, navigation | `hero`, `nav`, `meta.wordmark` (the giant 3-D name) |
| About | `about`, `person` |
| Skills (three scene windows) | `skills.groups` — exactly 3 groups |
| Experience & education | `journey.entries` — 1 to 5 entries |
| Contact, footer | `contact`, `footer`, `links` |
| Loader line, vertical ornament, preview caption | `theme` |

The wordmark accepts 1–10 capitals, digits, space, `.`, `&` and `-`. A very different length may want
`meta.wordmarkLayout` (tracking and fill) adjusted.

### Add your photo

The portrait frame in **About** is blank on purpose. Drop an image named `portrait.jpg` (or `.jpeg`,
`.png`, `.webp`, `.avif`) into **[public/profile/](public/profile)** and run `npm run generate`. It is cropped
to a 4:5 frame, so a portrait-orientation photo works best. To use another path, set `person.photo`
(relative to `public/`).

### Change the look

Typography and colour are props on `<KageLandingPage />` in [src/App.tsx](src/App.tsx): `headingFont`,
`bodyFont`, `headingWeight`, `bodyWeight`, `primaryColor`, `headingSize`, `bodySize`,
`headingLetterSpacing`. They are applied as one stylesheet appended to the page at runtime. Only Onest is
bundled; the other faces are fetched from Google Fonts the first time one is chosen.

## How it is put together

```
content/                    profile.json (all copy) and portfolio-additions.css (the few new styles)
public/landing-pages/
  kage.html                 the authored page, byte-exact — never edited
  portfolio.html            generated from kage.html + content/  (do not edit by hand)
  secret-pathways-assets/   Three.js r149, embedded fonts, the 14 WebP scene layers, wordmark font
public/profile/             drop your photo here
scripts/                    generate-portfolio.mjs, verify-sources.mjs, source-manifest.json
src/shaders/                ThreeUI's registered host files, verbatim
src/effects/kage-landing-page/   the local host: KageLandingPage.tsx and frameBridge.ts
reference/threeui/          ThreeUI's LandingPages.tsx, kept verbatim for reference (needs modules this project lacks)
```

The React app is a thin host: it lazy-loads `KageLandingPage`, which loads the HTML document in a
full-size, sandboxed `<iframe>`. The document is never imported into the JavaScript bundle.

**Byte-exact source.** `npm run verify:sources` checks all 22 registered files and assets (size and SHA-256)
against [scripts/source-manifest.json](scripts/source-manifest.json). `generate` refuses to run if
`kage.html` has changed. To change the page, edit `content/`, not `kage.html`.

**What `generate` changes** in the page (under 6% of its lines; run
`git diff --no-index public/landing-pages/kage.html public/landing-pages/portfolio.html` to see it): the
title and description, navigation, hero text, the About / Skills / Experience / Contact / footer content,
the scroll-rail labels, a portrait slot, skill tags, a three-plate experience layout, and the wordmark —
which uses a Poppins SemiBold face carrying the full capital alphabet instead of the authored four-letter
subset (the glyphs are identical to the authored ones; see [scripts/build-wordmark-font.py](scripts/build-wordmark-font.py)).
Each edit is anchored on exact text that must match exactly once, so a template change fails loudly instead
of producing a half-edited page.

**Host additions** in [frameBridge.ts](src/effects/kage-landing-page/frameBridge.ts):

- external, `mailto:` and `tel:` links are opened from the parent page rather than from inside the sandboxed frame;
- the frame is focused on load so the keyboard scrolls the page without a first click;
- if the WebGL context is lost and the scene never resumes, the frame is reloaded (at most twice).

## Hosting

This repository deploys to [https://pratik-m1110.github.io](https://pratik-m1110.github.io) with GitHub Actions.
Pushing to `main` builds the site and publishes `dist/` to GitHub Pages. The workflow is in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

`npm run build` also produces a static `dist/` that works on Netlify, Vercel or any static host. For a site
served from a sub-path, set the base when building, e.g. `BASE_PATH=/portfolio/ npm run build`.

## Notes

- The console shows Chrome's standard warning that an iframe with both `allow-scripts` and
  `allow-same-origin` can escape its sandbox. That is the registered ThreeUI frame's sandbox setting; the
  content is your own, same-origin page.
- The scene is GPU-heavy by design. The page adapts its render resolution to keep the frame rate up, and
  honours `prefers-reduced-motion`.
- The Japanese accents (the vertical 影の道, the small kanji labels) are part of the original design. They are
  plain strings in `profile.json`; replace or empty them if you would rather have English only.
- The ThreeUI skill text mentions eight MP3 tracks, but the registered source ships with audio removed and
  lists none, so there is no audio.

## Credits and licences

The Kage landing page and its scene assets are from [ThreeUI](https://threeui.com); check their terms for your
use. Three.js is MIT-licensed. Onest and Noto Sans JP are SIL OFL fonts (embedded as subsets in the page's
`fonts.css`); the wordmark face is Poppins, SIL OFL — see
[OFL-Poppins.txt](public/landing-pages/secret-pathways-assets/OFL-Poppins.txt).
