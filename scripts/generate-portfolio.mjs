#!/usr/bin/env node
/*
  Builds public/landing-pages/portfolio.html: the Kage landing page carrying Pratik's content.

  public/landing-pages/kage.html stays byte-exact and is never written to. This script reads it
  (and refuses to run if its SHA-256 has drifted), swaps text and a handful of blocks using exact
  anchors, and writes the result beside it. Every anchor must match exactly once, so a change to the
  template fails loudly instead of producing a half-edited page. Scripts, shaders, styles and asset
  paths come through untouched apart from the small script edits listed under "wordmark" below.

    node scripts/generate-portfolio.mjs           write portfolio.html
    node scripts/generate-portfolio.mjs --check   exit 1 if portfolio.html is out of date
*/
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = {
  canonical: join(root, "public", "landing-pages", "kage.html"),
  output: join(root, "public", "landing-pages", "portfolio.html"),
  profile: join(root, "content", "profile.json"),
  css: join(root, "content", "portfolio-additions.css"),
  profileImages: join(root, "public", "profile"),
};
const CANONICAL_SHA256 = "c8e06b90397ac246baf0ab6f32f5f6b570acc6fe03c7009f711b579fb72d9f49";
const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"];

function fail(message) {
  console.error(`generate-portfolio: ${message}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ editing helpers */

const esc = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");
/** A value that is safe to place inside a <script> as a JS literal. */
const js = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const isExternal = (url) => /^https?:/i.test(url);
const linkAttrs = (url) => (isExternal(url) ? ' target="_blank" rel="noopener noreferrer"' : "");

function count(haystack, needle) {
  let n = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) n++;
  return n;
}

/** Replace one exact string that must occur exactly once. */
function replaceOnce(html, find, replacement, label) {
  const n = count(html, find);
  if (n !== 1) fail(`${label}: expected exactly 1 match for ${JSON.stringify(find.slice(0, 80))}, found ${n}`);
  const at = html.indexOf(find);
  return html.slice(0, at) + replacement + html.slice(at + find.length);
}

/**
 * Locate one element by its exact opening tag (optionally followed by anchor text, to tell apart
 * tags that repeat) and find its matching close tag, counting nested elements of the same name.
 */
function elementBounds(html, openTag, label, after = "") {
  const needle = openTag + after;
  const n = count(html, needle);
  if (n !== 1) fail(`${label}: expected exactly 1 match for ${JSON.stringify(needle.slice(0, 80))}, found ${n}`);
  const start = html.indexOf(needle);
  const tag = /^<([a-z0-9]+)/i.exec(openTag)[1];
  const pattern = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  pattern.lastIndex = start;
  let depth = 0;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) {
      return { start, innerStart: start + openTag.length, innerEnd: match.index, end: match.index + match[0].length };
    }
  }
  return fail(`${label}: <${tag}> is not closed`);
}

const replaceElement = (html, openTag, replacement, label, after) => {
  const b = elementBounds(html, openTag, label, after);
  return html.slice(0, b.start) + replacement + html.slice(b.end);
};
const replaceInner = (html, openTag, inner, label, after) => {
  const b = elementBounds(html, openTag, label, after);
  return html.slice(0, b.innerStart) + inner + html.slice(b.innerEnd);
};

/* ------------------------------------------------------------------ inputs */

const canonicalBytes = readFileSync(paths.canonical);
const canonicalSha = createHash("sha256").update(canonicalBytes).digest("hex");
if (canonicalSha !== CANONICAL_SHA256) {
  fail(`public/landing-pages/kage.html no longer matches the registered source.\n  expected ${CANONICAL_SHA256}\n  found    ${canonicalSha}`);
}
const template = canonicalBytes.toString("utf8");
const profile = JSON.parse(readFileSync(paths.profile, "utf8"));
const additionsCss = readFileSync(paths.css, "utf8").trim();
const { meta, theme, person, nav, hero, about, skills, journey, contact, footer } = profile;

if (hero.chips.length !== 4) fail("hero.chips must have exactly 4 entries (the page's index strip is four columns)");
if (hero.title.length !== 3) fail("hero.title must have exactly 3 lines");
if (skills.groups.length !== 3) fail("skills.groups must have exactly 3 entries (the page has three live scene windows)");
if (journey.entries.length < 1 || journey.entries.length > 5) fail("journey.entries must have 1 to 5 entries");
if (!/^[A-Z0-9 .&-]{1,10}$/.test(meta.wordmark)) fail("meta.wordmark must be 1-10 capitals, digits or . & -");

function findPhoto() {
  if (person.photo) {
    if (!existsSync(join(root, "public", person.photo))) fail(`person.photo points at public/${person.photo}, which does not exist`);
    return person.photo;
  }
  for (const extension of PHOTO_EXTENSIONS) {
    if (existsSync(join(paths.profileImages, `portrait.${extension}`))) return `profile/portrait.${extension}`;
  }
  return null;
}

/* ------------------------------------------------------------------ markup builders */

const ARROW_SVG = '<svg viewBox="0 0 14 14" fill="none"><path d="M3 11 11 3M5 3h6v6" stroke="#dfe7e0" stroke-width="1.3"/></svg>';

function statValue(stat) {
  if (stat.kind === "skills") return pad(skills.groups.reduce((total, group) => total + group.items.length, 0));
  if (stat.kind === "education") return pad(journey.entries.filter((entry) => entry.type === "education").length);
  return stat.value;
}

function portraitMarkup(photo) {
  const image = photo
    ? `<img src="../${esc(photo)}" alt="Portrait of ${esc(person.name)}" loading="lazy" decoding="async">`
    : "";
  const left = photo ? person.name : about.portraitCaption;
  const right = photo ? person.location : about.portraitNote;
  return `<figure class="portrait" data-rv="up">
      <div class="portrait-fr">${image}</div>
      <figcaption class="card-meta"><span>${esc(left)}</span><span>${esc(right)}</span></figcaption>
    </figure>`;
}

function aboutMarkup(photo) {
  return `<div class="gate-grid">
    <h2 class="display h-sec" data-rv="up">${esc(about.title)}</h2>
    ${portraitMarkup(photo)}
    <div class="gate-copy">
      <p class="lead" data-rv="up">${esc(about.lead)}</p>
      <p class="body" data-rv="up">${esc(about.body)}</p>
      <dl class="facts" data-rv="up">
        <div><dt>Email</dt><dd><a href="mailto:${esc(person.email)}" data-cursor>${esc(person.email)}</a></dd></div>
        <div><dt>Place</dt><dd>${esc(person.location)}</dd></div>
      </dl>
      <a class="arrowlink" href="${esc(person.resumeUrl)}"${linkAttrs(person.resumeUrl)} data-rv="fade" data-cursor>
        <span>${esc(about.resumeLabel)}</span>
        <span class="ar">${ARROW_SVG}</span>
      </a>
    </div>
  </div>`;
}

const statsMarkup = () =>
  `<div class="gate-stats" data-rv="up">
${about.stats.map((stat) => `    <div><b>${esc(statValue(stat))}</b><span>${esc(stat.label)}</span></div>`).join("\n")}
  </div>`;

const chipsMarkup = () =>
  `<div class="chapters" id="chips">
${hero.chips
  .map(
    (chip, i) => `      <div class="chip" data-chip="${i}" data-rv="up" data-cursor><span class="num">${pad(i + 1)}</span>
        <span class="tx"><b>${esc(chip.title)}</b><p>${esc(chip.text)}</p></span></div>`,
  )
  .join("\n")}
    </div>`;

const navLinksMarkup = () =>
  "\n" +
  nav.links
    .map((link) => `    <a class="nav-link" href="${esc(link.href)}" data-cursor><span>${esc(link.label)}</span><span class="alt">${esc(link.alt)}</span></a>`)
    .join("\n") +
  "\n  ";

/** The tag is bound to the title's last word so a wrapped title never leaves it alone on a line. */
function plateTitle(entry) {
  const words = entry.title.split(" ");
  const last = words.pop();
  const head = words.length ? `${esc(words.join(" "))} ` : "";
  return `${head}<span class="nw">${esc(last)}<em class="jp">${esc(entry.jp)}</em></span>`;
}

const platesMarkup = () =>
  `<div class="cur" id="cur">
${journey.entries
  .map(
    (entry, i) => `    <div class="les" data-les="${i}" data-cursor>
      <span class="k">${pad(i + 1)}</span>
      <h3>${plateTitle(entry)}</h3>
      <p>${esc(entry.text)}</p>
      <span class="t">${esc(entry.when)}</span><i class="bar"></i>
    </div>`,
  )
  .join("\n")}
  </div>`;

function footerColumns() {
  const item = (href, label) => `      <li><a href="${esc(href)}"${linkAttrs(href)} data-cursor>${esc(label)}</a></li>`;
  const column = (title, items) => `    <div><h4>${esc(title)}</h4><ul>\n${items.join("\n")}\n    </ul></div>`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(person.location)}`;
  return [
    column(footer.quickLinksTitle, footer.quickLinks.map((link) => item(link.href, link.label))),
    column(footer.contactTitle, [
      item(`mailto:${person.email}`, person.email),
      item(`tel:${person.phone.replace(/[^+\d]/g, "")}`, person.phone),
      item(mapUrl, person.location),
    ]),
    column(footer.elsewhereTitle, [...profile.links.map((link) => item(link.url, link.label)), item(person.resumeUrl, about.resumeLabel)]),
  ].join("\n");
}

/* ------------------------------------------------------------------ build */

function build() {
  const photo = findPhoto();
  const year = meta.year ?? new Date().getFullYear();
  let html = template;
  const applied = [];
  const edit = (name, fn) => {
    html = fn(html);
    applied.push(name);
  };

  /* document head */
  edit("title", (h) => replaceOnce(h, "<title>Kage — Where stillness reveals the unseen</title>", `<title>${esc(meta.title)}</title>`, "title"));
  edit("description", (h) =>
    replaceOnce(
      h,
      '<meta name="description" content="A five-chapter night walk through a Kyoto mountain temple. Charred cypress, lantern light and a vermilion moon, rendered live in WebGL.">',
      `<meta name="description" content="${esc(meta.description)}">`,
      "description",
    ),
  );
  edit("additions stylesheet", (h) =>
    replaceOnce(h, "</style>\n</head>\n<body", `</style>\n<style id="portfolio-additions">\n${additionsCss}\n</style>\n</head>\n<body`, "additions stylesheet"),
  );

  /* navigation */
  edit("brand", (h) =>
    replaceOnce(
      h,
      '<span class="brand-tx"><b>KAGE</b><i>HIDDEN REALMS OF KYOTO</i></span>',
      `<span class="brand-tx"><b>${esc(nav.brand)}</b><i>${esc(nav.tagline)}</i></span>`,
      "brand",
    ),
  );
  edit("nav links", (h) => replaceInner(h, '<nav class="nav-links" id="navlinks">', navLinksMarkup(), "nav links"));

  /* hero */
  edit("hero eyebrow", (h) => replaceOnce(h, "Chapter 00 — The Hidden Gate", esc(hero.eyebrow), "hero eyebrow"));
  edit("hero title", (h) =>
    replaceInner(
      h,
      '<h1 class="display h-hero">',
      "\n" + hero.title.map((line) => `      <span class="mask-line"><span>${esc(line)}</span></span>`).join("\n") + "\n    ",
      "hero title",
    ),
  );
  edit("hero subtitle", (h) => replaceInner(h, '<p class="hero-sub body" data-rv="up">', esc(hero.subtitle), "hero subtitle"));
  edit("hero index", (h) => replaceElement(h, '<div class="chapters" id="chips">', chipsMarkup(), "hero index"));
  edit("hero fallback word", (h) =>
    replaceOnce(h, '<div class="word-fb" aria-hidden="true">KAGE</div>', `<div class="word-fb" aria-hidden="true">${esc(meta.wordmark)}</div>`, "hero fallback word"),
  );

  /* chapter I: about */
  edit("about heading", (h) =>
    replaceOnce(
      h,
      '<span class="k"><b>01</b> — The Sanmon</span><span class="rule"></span><span class="k jp">山門</span>',
      `<span class="k"><b>${esc(about.number)}</b> — ${esc(about.label)}</span><span class="rule"></span><span class="k jp">${esc(about.jp)}</span>`,
      "about heading",
    ),
  );
  edit("about body", (h) => replaceElement(h, '<div class="gate-grid">', aboutMarkup(photo), "about body"));
  edit("about stats", (h) => replaceElement(h, '<div class="gate-stats" data-rv="up">', statsMarkup(), "about stats"));

  /* chapter II: skills. The glow, camera and plate image on each card are kept as authored. */
  edit("skills heading", (h) =>
    replaceOnce(
      h,
      '<span class="k"><b>02</b> — Still Gardens</span><span class="rule"></span><span class="k jp">庭園</span>',
      `<span class="k"><b>${esc(skills.number)}</b> — ${esc(skills.label)}</span><span class="rule"></span><span class="k jp">${esc(skills.jp)}</span>`,
      "skills heading",
    ),
  );
  const cardLabels = [
    '<div class="card-lab"><b>Approach</b><span class="jp">参道</span></div>',
    '<div class="card-lab"><b>Lanterns</b><span class="jp">灯籠</span></div>',
    '<div class="card-lab"><b>Moonwater</b><span class="jp">月影</span></div>',
  ];
  const cardMetas = [
    '<div class="card-meta"><span>The long climb</span><span>01 / 03</span></div>',
    '<div class="card-meta"><span>Lantern court</span><span>02 / 03</span></div>',
    '<div class="card-meta"><span>The wet court</span><span>03 / 03</span></div>',
  ];
  skills.groups.forEach((group, i) => {
    edit(`skills card ${i + 1}`, (h) => {
      const tags = group.items.map((item) => `<li>${esc(item)}</li>`).join("");
      h = replaceOnce(
        h,
        cardLabels[i],
        `<div class="card-lab"><b>${esc(group.title)}</b><span class="jp">${esc(group.jp)}</span></div>\n        <ul class="card-tags">${tags}</ul>`,
        `skills card ${i + 1} label`,
      );
      return replaceOnce(
        h,
        cardMetas[i],
        `<div class="card-meta"><span>${group.items.length} ${esc(group.unit)}</span><span>${pad(i + 1)} / ${pad(skills.groups.length)}</span></div>`,
        `skills card ${i + 1} meta`,
      );
    });
  });

  /* chapter III: experience and education */
  edit("journey heading", (h) =>
    replaceOnce(
      h,
      '<span class="k"><b>03</b> — Sacred Craft</span><span class="rule"></span><span class="k jp">手業</span>',
      `<span class="k"><b>${esc(journey.number)}</b> — ${esc(journey.label)}</span><span class="rule"></span><span class="k jp">${esc(journey.jp)}</span>`,
      "journey heading",
    ),
  );
  edit("journey title", (h) =>
    replaceOnce(
      h,
      '<h2 class="display h-sec" data-rv="up">Five chapters. Ninety minutes. One quiet mind.</h2>',
      `<h2 class="display h-sec" data-rv="up">${esc(journey.title)}</h2>`,
      "journey title",
    ),
  );
  edit("journey intro", (h) => replaceInner(h, '<p class="body-lg" data-rv="up">', esc(journey.intro), "journey intro", "Each chapter is a walk"));
  edit("journey plates", (h) => replaceElement(h, '<div class="cur" id="cur">', platesMarkup(), "journey plates"));

  /* chapter IV: contact */
  edit("contact eyebrow", (h) => replaceOnce(h, "Chapter 04 — Afterlight", esc(contact.eyebrow), "contact eyebrow"));
  edit("contact title", (h) =>
    replaceOnce(h, '<h2 class="display" data-rv="up">Afterlight</h2>', `<h2 class="display" data-rv="up">${esc(contact.title)}</h2>`, "contact title"),
  );
  edit("contact text", (h) => replaceInner(h, '<p class="body-lg" data-rv="up">', esc(contact.text), "contact text", "The gate does not close"));
  edit("contact button", (h) => {
    h = replaceOnce(h, '<a class="cta" href="#top" data-rv="fade" data-cursor>', `<a class="cta" href="mailto:${esc(person.email)}" data-rv="fade" data-cursor>`, "contact link");
    return replaceOnce(h, "<span>Begin the walk</span>", `<span>${esc(contact.cta)}</span>`, "contact label");
  });

  /* footer */
  edit("footer statement", (h) => replaceInner(h, "<p>", esc(footer.statement), "footer statement", "A five-chapter night walk"));
  edit("footer columns", (h) => {
    const start = h.indexOf("<div><h4>Chapters</h4><ul>");
    const endMarker = '\n  </div>\n  <div class="foot-base">';
    const end = h.indexOf(endMarker);
    if (start === -1 || end === -1 || end < start || count(h, endMarker) !== 1) fail("footer columns: anchors not found");
    return h.slice(0, start) + footerColumns().replace(/^ {4}/, "") + h.slice(end);
  });
  edit("footer base", (h) =>
    replaceElement(
      h,
      '<div class="foot-base">',
      `<div class="foot-base">
    <span>© ${year} ${esc(person.name)}</span>
    <span>${esc(footer.motto)}</span>
    <span>${esc(footer.credit)}</span>
  </div>`,
      "footer base",
    ),
  );

  /* the scene's own captions: loader line, vertical ornament, and the preview window's label */
  edit("scene captions", (h) => {
    h = replaceOnce(h, "<span>Raising the mountain temple</span>", `<span>${esc(theme.loader)}</span>`, "loader caption");
    h = replaceOnce(h, '<div class="pre-jp jp">影の道</div>', `<div class="pre-jp jp">${esc(theme.ornament)}</div>`, "loader ornament");
    h = replaceOnce(h, '<span class="v jp">影の道</span>', `<span class="v jp">${esc(theme.ornament)}</span>`, "hero ornament");
    h = replaceOnce(
      h,
      '<span class="peek-cap"><b class="jp">山門</b><i>Sanmon — before the bell</i></span>',
      `<span class="peek-cap"><b class="jp">${esc(theme.preview.jp)}</b><i>${esc(theme.preview.caption)}</i></span>`,
      "preview caption",
    );
    return replaceOnce(h, 'aria-label="Preview: Sanmon, before the bell"', `aria-label="Preview: ${esc(theme.preview.caption)}"`, "preview label");
  });

  /* scroll-rail labels */
  edit("rail labels", (h) =>
    replaceOnce(
      h,
      "const names = ['The Hidden Gate', 'The Sanmon', 'Still Gardens', 'Sacred Craft', 'Afterlight', 'Colophon'];",
      `const names = ${js(nav.railLabels)};`,
      "rail labels",
    ),
  );

  /* wordmark: the 3-D word and the face it is cut from */
  edit("wordmark text", (h) => replaceOnce(h, "const word = 'KAGE', gl = [];", `const word = ${js(meta.wordmark)}, gl = [];`, "wordmark text"));
  /* The page was tuned for four letters: a longer word needs tighter tracking to keep its caps tall,
     and a little less than the full frame width so the last letters are not cropped at the edges. */
  edit("wordmark layout", (h) => {
    const layout = meta.wordmarkLayout;
    h = replaceOnce(h, "const SZ = 320, TRACK = .40, PAD = 26;", `const SZ = 320, TRACK = ${layout.tracking}, PAD = 26;`, "wordmark tracking");
    return replaceOnce(h, "const fill = narrow ? .96 : 1.00;", `const fill = narrow ? ${layout.fillNarrow} : ${layout.fillWide};`, "wordmark fill");
  });
  edit("wordmark face", (h) => {
    h = replaceOnce(h, "m.font = '600 ' + SZ + 'px Wordmark, sans-serif';", "m.font = '600 ' + SZ + 'px PortfolioWordmark, sans-serif';", "wordmark measure font");
    h = replaceOnce(h, "x.font = '600 ' + SZ + 'px Wordmark, sans-serif';", "x.font = '600 ' + SZ + 'px PortfolioWordmark, sans-serif';", "wordmark draw font");
    return replaceOnce(
      h,
      "document.fonts.load('600 320px Wordmark')",
      `document.fonts.load('600 320px PortfolioWordmark', ${js(meta.wordmark)})`,
      "wordmark preload",
    );
  });

  /* every theme string that should have been replaced is gone from the visible markup */
  const leftovers = ["Charred cypress, worn stone", "Still Gardens", "Sacred Craft", "Afterlight", "The Hidden Gate", "Kage no Michi", "HIDDEN REALMS", "Begin the walk", "Raked gravel", "Borrowed scenery"];
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const found = leftovers.filter((text) => visible.includes(text));
  if (found.length) fail(`template text survived: ${found.join(", ")}`);

  return { html, applied, photo };
}

/* ------------------------------------------------------------------ run */

const { html, applied, photo } = build();

if (process.argv.includes("--check")) {
  const current = existsSync(paths.output) ? readFileSync(paths.output, "utf8") : null;
  if (current !== html) {
    console.error("generate-portfolio: public/landing-pages/portfolio.html is out of date. Run `npm run generate`.");
    process.exit(1);
  }
  console.log("generate-portfolio: portfolio.html is up to date");
} else {
  writeFileSync(paths.output, html, "utf8");
  const bytes = Buffer.byteLength(html, "utf8");
  console.log(`generate-portfolio: wrote portfolio.html (${bytes} bytes, ${applied.length} edits, ${photo ? `photo ${photo}` : "portrait left blank"})`);
}
