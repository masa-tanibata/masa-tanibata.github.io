// Shared HTML shell: <head>, top bar, sticky profile sidebar, footer, language toggle.

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Strip inline markup — for <meta> descriptions and JSON-LD, which take plain text.
export const plain = (s) => String(s).replace(/<[^>]+>/g, '');

// A value still marked TODO is a placeholder: never rendered, always reported by the build.
export const todo = (v) =>
  typeof v === 'string' ? v.startsWith('TODO') : Object.values(v ?? {}).every((x) => String(x).startsWith('TODO'));

/**
 * Bilingual renderer.
 *   t('Python')                     -> Python                 (same in both languages)
 *   t({en:'Home', ja:'ホーム'})      -> <span class=i-en>…<span class=i-ja>…
 *   t(field, 'p', 'class="lead"')   -> same, but as <p> blocks
 * Content strings may contain inline HTML (<em>, <a>…); they are your own file,
 * so they are emitted verbatim rather than escaped.  A side still marked TODO
 * falls back to the other language instead of printing the placeholder.
 */
export function t(v, tag = 'span', attrs = '') {
  const a = attrs ? ' ' + attrs : '';
  // A class in `attrs` has to be merged with the language class, not emitted as a
  // second class attribute — browsers keep only the first one.
  const own = attrs.match(/class="([^"]*)"/);
  const rest = own ? attrs.replace(/\s*class="[^"]*"/, '').trim() : attrs.trim();
  const wrap = (cls, s) =>
    `<${tag} class="${own ? `${cls} ${own[1]}` : cls}"${rest ? ' ' + rest : ''}>${s}</${tag}>`;
  if (v == null) return '';
  if (typeof v === 'string')
    return tag === 'span' && !attrs ? v : `<${tag}${a}>${v}</${tag}>`;
  const en = v.en?.startsWith('TODO') ? v.ja : v.en;
  const ja = v.ja?.startsWith('TODO') ? v.en : v.ja;
  return wrap('i-en', en) + wrap('i-ja', ja);
}

// Pick one language out of a field — for titles, meta tags and structured data.
export const one = (v, lang = 'en') => {
  if (typeof v === 'string') return v;
  const s = v?.[lang] ?? '';
  return s.startsWith('TODO') ? v?.[lang === 'en' ? 'ja' : 'en'] ?? '' : s;
};

// "2025.04 – present" out of {from, to}
export const period = (p) =>
  typeof p === 'string' ? esc(p) : `${esc(p.from)} – ${t(p.to)}`;

export function page({ title, description, path, head = '', sidebar, body, siteUrl }) {
  const canonical = `${siteUrl.replace(/\/$/, '')}/${path === 'index.html' ? '' : path}`;
  const nav = [
    { href: 'index.html', label: { en: 'Home', ja: 'ホーム' } },
    { href: 'cv.html', label: { en: 'CV', ja: 'CV' } },
  ]
    .map((n) => `<a href="${n.href}"${n.href === path ? ' aria-current="page"' : ''}>${t(n.label)}</a>`)
    .join('');

  return `<!doctype html>
<html lang="en" data-lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(plain(description))}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(plain(description))}">
<meta property="og:url" content="${esc(canonical)}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400..700&display=swap">
<link rel="stylesheet" href="style.css">
${head}
</head>
<body>
<div class="layout">
  <aside class="sidebar">
    ${sidebar}
    <div class="side-foot">
      <nav>${nav}</nav>
      <button id="lang-toggle" type="button" class="lang-toggle">
        <span class="i-en">日本語</span><span class="i-ja">English</span>
      </button>
    </div>
  </aside>
  <main>${body}</main>
</div>

<script>
(function () {
  var KEY = 'site-lang';
  var root = document.documentElement;
  function set(l) {
    root.setAttribute('data-lang', l);
    root.setAttribute('lang', l);
    try { localStorage.setItem(KEY, l); } catch (e) {}
  }
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var browserIsJa = (navigator.language || '').toLowerCase().indexOf('ja') === 0;
  set(saved === 'ja' || saved === 'en' ? saved : browserIsJa ? 'ja' : 'en');
  document.getElementById('lang-toggle').addEventListener('click', function () {
    set(root.getAttribute('data-lang') === 'en' ? 'ja' : 'en');
  });

})();
</script>
</body>
</html>
`;
}
