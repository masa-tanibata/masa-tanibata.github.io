#!/usr/bin/env node
// content/profile.json -> dist/{index.html,cv.html} + copied public/ assets.
// No dependencies: Node 18+ only.  Run with `node src/build.mjs`.

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { page, t, one, esc, plain, period, todo } from './layout.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const SOURCE = resolve(ROOT, 'content/profile.json');
let p;
try {
  p = JSON.parse(readFileSync(SOURCE, 'utf8'));
} catch (e) {
  // A trailing comma or a stray quote should read as one clear line, not a stack trace.
  console.error(`\ncontent/profile.json is not valid JSON:\n  ${e.message}\n`);
  process.exit(1);
}
const SITE = p.meta.siteUrl;
const ABS = (u) => `${SITE.replace(/\/$/, '')}/${String(u).replace(/^\//, '')}`;

// Search engines index one <title> and one description per page, not the toggled view, so
// both of those carry both languages: people look for "谷端真瑠" as readily as for
// "Masaru Tanibata", and only text that is actually in the tag can be matched.
const NAME_EN = one(p.name, 'en');
const NAME_JA = one(p.name, 'ja');
const FULL_NAME = NAME_JA && NAME_JA !== NAME_EN ? `${NAME_EN}（${NAME_JA}）` : NAME_EN;
const bilingual = (v) => {
  const en = plain(one(v, 'en'));
  const ja = plain(one(v, 'ja'));
  // The Japanese role string already uses ／ internally, so the two halves are joined
  // with ｜ instead -- otherwise the description reads as one four-part list.
  return ja && ja !== en ? `${en}｜${ja}` : en;
};
const uniqueBy = (xs, key) => [...new Map(xs.map((x) => [key(x), x])).values()];

// Links still marked TODO are dropped rather than shipped broken (the build warns instead).
const live = (links) => links.filter((l) => !/^TODO/.test(l.url));

/* ---------- building blocks ---------- */

// A section exists only while its data does: empty the key in profile.json and both the
// section and its sidebar nav entry disappear.  Keys are shared by the home and CV pages.
const EMPTY = {
  interests: !p.interests?.length,
  news: !p.news?.length,
  contact: !p.contact?.email,
  highlights: !p.highlights?.length,
  research: !p.projects?.length,
  publications: !p.publications?.some((x) => !x.hidden),
  education: !p.education?.length,
  employment: !p.experience?.length,
  experience: !p.experience?.length,
  talks: !p.talks?.length,
  awards: !p.awards?.length,
  skills: !p.skills?.length,
};

const section = (id, icon, title, inner) =>
  EMPTY[id.replace(/^cv-/, '')]
    ? ''
    : `
<section id="${id}">
  <h2>${t(title)}</h2>
  ${inner}
</section>`;

// Dated entries as a plain bulleted list: "2025.04 – present  Title, Organisation — note".
const timeline = (items, render) =>
  `<ul class="entries">` +
  items
    .map((it) => {
      const when = it.period ?? it.date;
      return `<li>${when ? `<span class="date">${period(when)}</span> ` : ''}${render(it)}</li>`;
    })
    .join('') +
  `</ul>`;

const entry = (e) =>
  `${t(e.degree ?? e.role ?? e.title, 'h3')}` +
  (e.org ? t(e.org, 'p', 'class="org"') : '') +
  (e.sub ? t(e.sub, 'p', 'class="sub"') : '') +
  (e.detail ?? e.summary ? t(e.detail ?? e.summary, 'p', 'class="detail"') : '');

const iconLinks = (links, cls) =>
  `<ul class="${cls}">` +
  live(links)
    .map((l) => {
      const ext = /^https?:/.test(l.url);
      return `<li><a href="${esc(l.url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(
        l.label
      )}</a></li>`;
    })
    .join('') +
  `</ul>`;

const chips = (links) =>
  links?.length
    ? `<p class="chips">` +
      links
        .map(
          (l) =>
            `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${t(l.label)}</a>`
        )
        .join('') +
      `</p>`
    : '';

const tagList = (tags) =>
  tags?.length ? `<ul class="tags">${tags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';

// Author list with the site owner's own name picked out.
// Accepts a plain string (same in both languages) or { en, ja }.
// Author lists write the name without the space the sidebar uses ("谷端真瑠" vs "谷端 真瑠"),
// so match loosely on whitespace.
const markSelf = (line, self) => {
  const pattern = self
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s*');
  return esc(line).replace(new RegExp(pattern), (m) => `<strong>${m}</strong>`);
};
const authors = (a) =>
  typeof a === 'string'
    ? markSelf(a, one(p.name))
    : `<span class="i-en">${markSelf(a.en, one(p.name, 'en'))}</span>` +
      `<span class="i-ja">${markSelf(a.ja, one(p.name, 'ja'))}</span>`;

const pubList = (pubs) =>
  `<ul class="pubs">` +
  pubs
    .map(
      (x) => `<li>
      <p class="pub-title">${t(x.title)}</p>
      <p class="pub-authors">${authors(x.authors)}</p>
      <p class="pub-venue">${t(x.venue, 'em')}<span class="i-en">, </span><span class="i-ja">／</span>${esc(x.year)}</p>
      <p class="pub-meta">${
        x.status ? `<span class="badge">${t(x.status)}</span>` : ''
      }${x.award ? `<span class="badge">${t(x.award)}</span>` : ''}${(x.links ?? [])
        .map(
          (l) =>
            `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${t(l.label)}</a>`
        )
        .join('')}</p>
    </li>`
    )
    .join('') +
  `</ul>`;

// Both languages split the list the way a Japanese CV does: international venues first,
// then domestic meetings.  The headings are bilingual, so one grouped list serves both
// views -- "domestic" is spelled out as Japan for readers who would not assume it.
const PUB_GROUPS = [
  { en: 'International conferences & journals', ja: '国際会議・論文誌' },
  { en: 'Domestic conferences & workshops (Japan)', ja: '国内会議・研究会' },
];
const publications = (all) => {
  const shown = all.filter((x) => !x.hidden);
  const lists = [shown.filter((x) => x.type !== 'domestic'), shown.filter((x) => x.type === 'domestic')];
  return PUB_GROUPS.map((label, i) =>
    lists[i].length ? `<h3 class="pub-group">${t(label)}</h3>${pubList(lists[i])}` : ''
  ).join('');
};

/* ---------- sidebar (shared by both pages) ---------- */

const sideNav = (items) =>
  `<nav class="side-nav">` +
  items.map((s) => `<a href="#${s.id}">${t(s.label)}</a>`).join('') +
  `</nav>`;

const sidebar = (navItems) => `
<div class="card">
  <img class="avatar" src="${esc(p.meta.photo)}" alt="${esc(one(p.name))}" width="150" height="150">
  <h1 class="side-name">${t(p.name)}</h1>
  ${todo(p.nameSub) ? '' : `<p class="side-name-sub">${t(p.nameSub)}</p>`}
  ${p.pronunciation ? `<p class="side-pron">${t(p.pronunciation)}</p>` : ''}
  <p class="side-role">${t(p.role)}</p>
  <p class="side-loc">${t(p.location)}</p>
  ${navItems ? sideNav(navItems) : ''}
  ${iconLinks(p.links, 'side-links')}
</div>`;

/* ---------- home ---------- */

const homeSections = [
  { id: 'interests', icon: 'fa-regular fa-lightbulb', label: { en: 'Research Interests', ja: '研究の興味' } },
  { id: 'news', icon: '', label: { en: 'News', ja: 'お知らせ' } },
  { id: 'contact', icon: '', label: { en: 'Contact', ja: '連絡先' } },
  { id: 'highlights', icon: 'fa-regular fa-lightbulb', label: { en: 'Research Highlights', ja: '研究のポイント' } },
  { id: 'research', icon: 'fa-solid fa-flask', label: { en: 'Projects', ja: 'プロジェクト' } },
  { id: 'publications', icon: 'fa-regular fa-file-lines', label: { en: 'Publications', ja: '論文' } },
  { id: 'education', icon: 'fa-solid fa-graduation-cap', label: { en: 'Education', ja: '学歴' } },
  { id: 'experience', icon: 'fa-solid fa-briefcase', label: { en: 'Experience', ja: '職歴' } },
  { id: 'talks', icon: 'fa-solid fa-microphone-lines', label: { en: 'Talks', ja: '講演' } },
  { id: 'awards', icon: 'fa-solid fa-award', label: { en: 'Awards', ja: '受賞' } },
  { id: 'skills', icon: 'fa-solid fa-screwdriver-wrench', label: { en: 'Skills', ja: 'スキル' } },
];
const ico = (id) => homeSections.find((s) => s.id === id).icon;
const lab = (id) => homeSections.find((s) => s.id === id).label;

const home = page({
  title: `${FULL_NAME} — ${one(p.role)}`,
  description: bilingual(one(p.tagline) ? p.tagline : p.role),
  path: 'index.html',
  siteUrl: SITE,
  image: p.meta.photo ? ABS(p.meta.photo) : undefined,
  verify: p.meta.verify,
  sidebar: sidebar(null),
  // Structured data is what lets a search engine treat these pages as one person rather
  // than two documents: the Japanese spelling as an alternate name for the same entity,
  // and the affiliations and links that corroborate which Masaru Tanibata this is.
  head: `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: NAME_EN,
    alternateName: NAME_JA && NAME_JA !== NAME_EN ? NAME_JA : undefined,
    jobTitle: one(p.role),
    url: SITE,
    image: p.meta.photo ? ABS(p.meta.photo) : undefined,
    email: p.contact?.email || p.links.find((l) => l.id === 'email')?.url.replace('mailto:', ''),
    sameAs: live(p.links).filter((l) => /^https?:/.test(l.url)).map((l) => l.url),
    homeLocation: one(p.location) ? { '@type': 'Place', name: plain(one(p.location)) } : undefined,
    affiliation: uniqueBy(
      [
        ...(p.education ?? []).map((e) => ({ '@type': 'CollegeOrUniversity', name: plain(one(e.org)) })),
        ...(p.experience ?? []).map((e) => ({ '@type': 'Organization', name: plain(one(e.org)) })),
      ].filter((x) => x.name),
      (x) => x.name
    ),
    knowsAbout: (p.interests ?? []).flatMap((x) => [plain(one(x, 'en')), plain(one(x, 'ja'))]).filter(Boolean),
    description: bilingual(one(p.tagline) ? p.tagline : p.role),
  })}</script>`,
  body: `
${p.tagline ? `<p class="tagline">${t(p.tagline)}</p>` : ''}
${p.callout ? `<p class="callout"><i class="fa-regular fa-paper-plane" aria-hidden="true"></i>${t(p.callout, 'span')}</p>` : ''}

${section(
  'interests',
  ico('interests'),
  lab('interests'),
  `<ul class="interests">` + (p.interests ?? []).map((x) => `<li>${t(x, 'div')}</li>`).join('') + `</ul>`
)}

${section('publications', ico('publications'), lab('publications'), publications(p.publications ?? []))}

${section('education', ico('education'), lab('education'), timeline(p.education ?? [], entry))}

${section('experience', ico('experience'), lab('experience'), timeline(p.experience ?? [], entry))}

${section(
  'talks',
  ico('talks'),
  lab('talks'),
  timeline(p.talks ?? [], (x) =>
    `${t(x.title, 'h3')}${x.authors ? `<p class="detail">${authors(x.authors)}</p>` : ''}${t(
      x.event,
      'p',
      'class="org"'
    )}`
  )
)}

${section('awards', ico('awards'), lab('awards'), timeline(p.awards ?? [], entry))}

${section(
  'research',
  ico('research'),
  lab('research'),
  `<ul class="cards">` +
    p.projects
      .map(
        (x) => `<li class="proj">
      <div class="period">${period(x.period)}</div>
      ${t(x.title, 'h3')}
      ${t(x.summary, 'p')}
      ${x.funding ? `<p class="funding">${t(x.funding, 'span')}</p>` : ''}
      ${chips(x.links)}
    </li>`
      )
      .join('') +
    `</ul>`
)}

${section(
  'news',
  ico('news'),
  lab('news'),
  `<ul class="news">` +
    (p.news ?? [])
      .map((n) => `<li><span class="news-date">${esc(n.date)}</span>${t(n.text, 'div', 'class="news-body"')}</li>`)
      .join('') +
    `</ul>`
)}

${section(
  'contact',
  ico('contact'),
  lab('contact'),
  `${t(p.contact?.note ?? '', 'p')}<p class="email"><a href="mailto:${esc(
    p.contact?.email ?? ''
  )}">${esc(p.contact?.email ?? '')}</a></p>`
)}
`,
});

/* ---------- cv ---------- */

// The CV can be served two ways.  "local" embeds public/cv.pdf straight from the site,
// which is fastest and needs no sharing settings.  "drive" embeds a Google Drive file so
// the page always shows whatever is currently in Drive, with no rebuild — that needs
// meta.cvDriveId and the file shared as "anyone with the link".
const cvSources = () => {
  const m = p.meta;
  const useDrive = m.cvSource === 'drive' && m.cvDriveId && !/^TODO/.test(m.cvDriveId);
  return useDrive
    ? {
        viewer: `https://drive.google.com/file/d/${m.cvDriveId}/preview`,
        open: `https://drive.google.com/file/d/${m.cvDriveId}/view`,
        download: `https://drive.google.com/uc?export=download&id=${m.cvDriveId}`,
        sameOrigin: false,
      }
    : {
        viewer: `${m.cvPdf}#view=FitH`,
        open: m.cvPdf,
        download: m.cvPdf,
        sameOrigin: true,
      };
};

const cvViewer = () => {
  const src = cvSources();
  const dl = src.sameOrigin ? ' download' : ' target="_blank" rel="noopener"';
  return `
<div class="pdf no-print">
  <div class="pdf-bar">
    <span class="updated">${t({
      en: `Updated ${p.meta.cvUpdated}`,
      ja: `最終更新 ${p.meta.cvUpdated.replace(/^(\d{4})-0?(\d{1,2})$/, '$1年$2月')}`,
    })}</span>
    <span class="pdf-actions">
      <a class="button" href="${esc(src.download)}"${dl}>${t(
        { en: 'Download PDF', ja: 'PDFを保存' }
      )}</a>
      <a class="button ghost" href="${esc(src.open)}" target="_blank" rel="noopener">${t(
        { en: 'Open in new tab', ja: '別タブで開く' }
      )}</a>
    </span>
  </div>
  <iframe class="pdf-frame" src="${esc(src.viewer)}" title="${esc(one(p.name))} CV" loading="lazy"></iframe>
  <p class="pdf-fallback">${t({
    en: `Your browser is not showing the embedded PDF — <a href="${esc(src.open)}" target="_blank" rel="noopener">open it in a new tab</a> instead.`,
    ja: `PDFの埋め込み表示に対応していない環境のようです。<a href="${esc(src.open)}" target="_blank" rel="noopener">別タブで開いてください</a>。`,
  })}</p>
</div>`;
};

const cv = page({
  title: `CV — ${FULL_NAME}`,
  description: `Curriculum vitae of ${NAME_EN}｜${NAME_JA} の経歴・業績。`,
  path: 'cv.html',
  siteUrl: SITE,
  image: p.meta.photo ? ABS(p.meta.photo) : undefined,
  verify: p.meta.verify,
  sidebar: sidebar(null),
  body: `
<div class="cv-top">
  <h2 class="page-title">${t({ en: 'Curriculum Vitae', ja: '経歴' })}</h2>
  ${cvViewer()}
</div>

${section('cv-education', ico('education'), lab('education'), timeline(p.education ?? [], entry))}
${section('cv-employment', ico('experience'), { en: 'Employment', ja: '職歴' }, timeline(p.experience ?? [], entry))}
${section(
  'cv-research',
  ico('research'),
  { en: 'Research Experience', ja: '研究・業務経験' },
  timeline(p.projects ?? [], (x) => entry(x) + (x.funding ? t(x.funding, 'p', 'class="funding"') : '') + chips(x.links))
)}
${section('cv-publications', ico('publications'), lab('publications'), publications(p.publications ?? []))}
${section('cv-talks', ico('talks'), { en: 'Talks', ja: '講演' }, timeline(p.talks ?? [], (x) => `${t(x.title, 'h3')}${x.authors ? `<p class="detail">${authors(x.authors)}</p>` : ''}${t(x.event, 'p', 'class="org"')}`))}
${section('cv-awards', ico('awards'), lab('awards'), timeline(p.awards ?? [], entry))}
${section(
  'cv-skills',
  ico('skills'),
  lab('skills'),
  `<dl class="skills">` +
    (p.skills ?? []).map((s) => `<dt>${t(s.category)}</dt><dd>${s.items.map((x) => t(x)).join(' · ')}</dd>`).join('') +
    `</dl>`
)}
`,
});

/* ---------- emit ---------- */

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
writeFileSync(resolve(DIST, 'index.html'), home);
writeFileSync(resolve(DIST, 'cv.html'), cv);
if (existsSync(resolve(ROOT, 'public'))) cpSync(resolve(ROOT, 'public'), DIST, { recursive: true });
writeFileSync(resolve(DIST, '.nojekyll'), '');
// Without a robots.txt a crawler guesses "allow everything", which is right here anyway --
// the file is worth writing because it is also where the sitemap gets advertised.
writeFileSync(
  resolve(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE.replace(/\/$/, '')}/sitemap.xml\n`
);
writeFileSync(
  resolve(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['', 'cv.html'].map((u) => `  <url><loc>${SITE.replace(/\/$/, '')}/${u}</loc></url>`).join('\n')}
</urlset>
`
);

// Loud reminder for anything still marked TODO in the content file.
const todos = [];
(function walk(node, path) {
  if (typeof node === 'string') {
    if (node.startsWith('TODO')) todos.push(`${path}: ${node}`);
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  }
})(p, '');

console.log('built dist/index.html, dist/cv.html');
if (todos.length) {
  console.log(`\n⚠  ${todos.length} placeholder(s) left in content/profile.json:`);
  for (const x of todos) console.log(`   - ${x}`);
}
