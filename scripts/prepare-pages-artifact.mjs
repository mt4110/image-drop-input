import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const pagesDir = path.join(rootDir, 'examples/vite/dist');
const docsSourceDir = path.join(rootDir, 'docs');
const docsOutputDir = path.join(pagesDir, 'docs');
const docsAssetsSourceDir = path.join(docsSourceDir, 'assets');
const docsAssetsOutputDir = path.join(docsOutputDir, 'assets');
const docsCssPath = path.join(pagesDir, 'pages-docs.css');

if (!existsSync(pagesDir)) {
  throw new Error('examples/vite/dist does not exist. Run the Vite Pages build first.');
}

rmSync(docsOutputDir, { force: true, recursive: true });
mkdirSync(docsOutputDir, { recursive: true });

if (existsSync(docsAssetsSourceDir)) {
  cpSync(docsAssetsSourceDir, docsAssetsOutputDir, { recursive: true });
}

writeFileSync(docsCssPath, buildDocsCss(), 'utf8');
writeFileSync(path.join(pagesDir, 'LICENSE'), readFileSync(path.join(rootDir, 'LICENSE'), 'utf8'), 'utf8');

const markdownSources = [
  {
    source: path.join(rootDir, 'README.md'),
    output: path.join(pagesDir, 'README.html'),
    markdownOutput: path.join(pagesDir, 'README.md'),
    title: 'image-drop-input README'
  },
  {
    source: path.join(rootDir, 'README.ja.md'),
    output: path.join(pagesDir, 'README.ja.html'),
    markdownOutput: path.join(pagesDir, 'README.ja.md'),
    title: 'image-drop-input README 日本語'
  },
  ...collectMarkdownFiles(docsSourceDir).map((source) => {
    const relativePath = path.relative(docsSourceDir, source);
    const htmlRelativePath = relativePath.replace(/\.md$/u, '.html');

    return {
      source,
      output: path.join(docsOutputDir, htmlRelativePath),
      markdownOutput: path.join(docsOutputDir, relativePath),
      title: createTitleFromMarkdown(source)
    };
  })
];

for (const page of markdownSources) {
  writeMarkdownCopy(page.source, page.markdownOutput);
  writeDocsPage(page);
}

const docsReadme = markdownSources.find((page) => page.source === path.join(docsSourceDir, 'README.md'));

if (docsReadme) {
  writeDocsPage({
    ...docsReadme,
    output: path.join(docsOutputDir, 'index.html')
  });
}

console.log(`Prepared GitHub Pages docs in ${path.relative(rootDir, pagesDir)}.`);

function collectMarkdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectMarkdownFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : [];
  });
}

function writeMarkdownCopy(source, output) {
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, readFileSync(source, 'utf8'), 'utf8');
}

function writeDocsPage({ source, output, title }) {
  const markdown = readFileSync(source, 'utf8');
  const content = rewriteMarkdownLinks(marked.parse(markdown));
  const stylesheetHref = relativeHref(output, docsCssPath);
  const demoHref = relativeHref(output, path.join(pagesDir, 'index.html'));
  const docsHref = relativeHref(output, path.join(docsOutputDir, 'index.html'));
  const readmeHref = relativeHref(output, path.join(pagesDir, 'README.html'));
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${stylesheetHref}" />
  </head>
  <body>
    <main class="docs-shell">
      <nav class="docs-nav" aria-label="Pages navigation">
        <a href="${demoHref}">Demo</a>
        <a href="${docsHref}">Docs</a>
        <a href="${readmeHref}">README</a>
      </nav>
      <article class="docs-page">
        ${content}
      </article>
    </main>
  </body>
</html>
`;

  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, html, 'utf8');
}

function createTitleFromMarkdown(source) {
  const markdown = readFileSync(source, 'utf8');
  const title = markdown.match(/^#\s+(.+)$/mu)?.[1]?.trim();

  return title || path.basename(source, '.md');
}

function rewriteMarkdownLinks(html) {
  return html.replace(/href="([^"]+?)\.md(#[^"]*)?"/gu, (_match, href, hash = '') => {
    return `href="${href}.html${hash}"`;
  });
}

function relativeHref(fromFile, toFile) {
  const relativePath = path.relative(path.dirname(fromFile), toFile).replaceAll(path.sep, '/');

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildDocsCss() {
  return `:root {
  color: #172033;
  background: #eef2f4;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.docs-shell {
  display: grid;
  gap: 20px;
  margin: 0 auto;
  max-width: 920px;
  min-height: 100vh;
  padding: 28px 18px 72px;
}

.docs-nav {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.docs-nav a {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(22, 32, 51, 0.08);
  border-radius: 6px;
  color: rgba(22, 32, 51, 0.76);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  padding: 10px 12px;
  text-decoration: none;
}

.docs-nav a:focus-visible {
  outline: 3px solid rgba(21, 134, 106, 0.22);
  outline-offset: 2px;
}

.docs-page {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(22, 32, 51, 0.08);
  border-radius: 8px;
  padding: clamp(22px, 4vw, 44px);
}

.docs-page > :first-child {
  margin-top: 0;
}

.docs-page > :last-child {
  margin-bottom: 0;
}

h1,
h2,
h3 {
  color: #162033;
  letter-spacing: 0;
  line-height: 1.15;
}

h1 {
  font-size: clamp(2.1rem, 5vw, 3.4rem);
  font-weight: 650;
  margin: 0 0 18px;
}

h2 {
  border-top: 1px solid rgba(22, 32, 51, 0.1);
  font-size: 1.55rem;
  font-weight: 650;
  margin: 34px 0 12px;
  padding-top: 24px;
}

h3 {
  font-size: 1.05rem;
  font-weight: 650;
  margin: 24px 0 10px;
}

p,
li {
  color: rgba(22, 32, 51, 0.72);
  font-size: 15px;
  line-height: 1.75;
}

a {
  color: #0f6f56;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.18em;
}

code {
  background: rgba(22, 32, 51, 0.06);
  border: 1px solid rgba(22, 32, 51, 0.08);
  border-radius: 5px;
  color: rgba(22, 32, 51, 0.86);
  font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
  font-size: 0.92em;
  padding: 0.1em 0.32em;
}

pre {
  background: #172033;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.92);
  overflow-x: auto;
  padding: 16px;
}

pre code {
  background: transparent;
  border: 0;
  color: inherit;
  padding: 0;
}

blockquote {
  border-left: 4px solid rgba(21, 134, 106, 0.32);
  margin: 18px 0;
  padding: 2px 0 2px 16px;
}

table {
  border-collapse: collapse;
  display: block;
  margin: 18px 0;
  overflow-x: auto;
  width: 100%;
}

th,
td {
  border: 1px solid rgba(22, 32, 51, 0.1);
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
}

th {
  background: rgba(22, 32, 51, 0.04);
  color: rgba(22, 32, 51, 0.8);
  font-size: 13px;
}

img {
  border-radius: 8px;
  height: auto;
  max-width: 100%;
}

@media (max-width: 620px) {
  .docs-shell {
    padding-inline: 14px;
  }

  .docs-page {
    padding: 20px;
  }
}
`;
}
