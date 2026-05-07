import { createServer } from 'node:http';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const rootDirectory = process.cwd();
const realRootDirectory = realpathSync(rootDirectory);
const defaultBrowsers = ['chromium', 'firefox'];
const browserTypes = { chromium, firefox, webkit };
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8']
]);

function isPathWithinRoot(path) {
  const relativePath = relative(realRootDirectory, path);

  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${sep}`) &&
      relativePath !== '..' &&
      !isAbsolute(relativePath))
  );
}

function resolveContainedPath(path) {
  const realPath = realpathSync(path);

  if (!isPathWithinRoot(realPath)) {
    return undefined;
  }

  return realPath;
}

function parseArgs(argv) {
  const options = {
    browsers: process.env.BROWSER_BUDGET_LAB_BROWSERS
      ? process.env.BROWSER_BUDGET_LAB_BROWSERS.split(',')
      : defaultBrowsers,
    jsonOutput: undefined,
    markdownOutput: undefined
  };

  for (const arg of argv) {
    if (arg.startsWith('--browsers=')) {
      options.browsers = arg.slice('--browsers='.length).split(',');
      continue;
    }

    if (arg.startsWith('--json-output=')) {
      options.jsonOutput = arg.slice('--json-output='.length);
      continue;
    }

    if (arg.startsWith('--markdown-output=')) {
      options.markdownOutput = arg.slice('--markdown-output='.length);
    }
  }

  options.browsers = options.browsers
    .map((browserName) => browserName.trim())
    .filter(Boolean);

  if (options.browsers.length === 0) {
    throw new Error('At least one browser must be selected.');
  }

  for (const browserName of options.browsers) {
    if (!browserTypes[browserName]) {
      throw new Error(
        `Unsupported browser "${browserName}". Use chromium, firefox, or webkit.`
      );
    }
  }

  return options;
}

function createLabHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>image-drop-input browser budget lab</title>
  <script type="importmap">
    {
      "imports": {
        "react": "/react-shim.js"
      }
    }
  </script>
</head>
<body>
<script type="module">
import { prepareImageToBudget, isImageBudgetError } from '/dist/headless.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nextNoise(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed & 255;
  };
}

function paintFixture(context, kind, width, height) {
  if (kind === 'gradient') {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0f766e');
    gradient.addColorStop(0.45, '#f59e0b');
    gradient.addColorStop(1, '#2563eb');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = 'rgba(255,255,255,0.72)';
    context.font = 'bold 96px sans-serif';
    context.fillText('budget', Math.round(width * 0.08), Math.round(height * 0.55));
    return;
  }

  if (kind === 'noise') {
    const image = context.createImageData(width, height);
    const random = nextNoise(42);

    for (let index = 0; index < image.data.length; index += 4) {
      image.data[index] = random();
      image.data[index + 1] = random();
      image.data[index + 2] = random();
      image.data[index + 3] = 255;
    }

    context.putImageData(image, 0, 0);
    return;
  }

  if (kind === 'transparent') {
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(16, 185, 129, 0.58)';
    context.fillRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
    context.clearRect(width * 0.35, height * 0.35, width * 0.3, height * 0.3);
    return;
  }

  context.fillStyle = '#475569';
  context.fillRect(0, 0, width, height);
}

async function createFixture({ kind, width, height, type, name }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  assert(context, '2D canvas is unavailable.');
  paintFixture(context, kind, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
        return;
      }

      reject(new Error('Fixture canvas encoding failed.'));
    }, type);
  });

  return {
    file: new File([blob], name, { type: blob.type || type }),
    width,
    height
  };
}

function summarizeSuccess(label, fixture, policy, result) {
  assert(result.size <= policy.outputMaxBytes, label + ': result exceeds outputMaxBytes');
  assert(result.file.size === result.size, label + ': file size metadata mismatch');
  assert(result.file.type === policy.outputType, label + ': file type mismatch');
  assert(result.mimeType === policy.outputType, label + ': MIME metadata mismatch');
  assert(result.width <= fixture.width, label + ': result upscaled width');
  assert(result.height <= fixture.height, label + ': result upscaled height');

  if (typeof policy.maxWidth === 'number') {
    assert(result.width <= policy.maxWidth, label + ': result exceeds maxWidth');
  }

  if (typeof policy.maxHeight === 'number') {
    assert(result.height <= policy.maxHeight, label + ': result exceeds maxHeight');
  }

  if (typeof policy.minWidth === 'number') {
    assert(result.width >= policy.minWidth, label + ': result is below minWidth');
  }

  if (typeof policy.minHeight === 'number') {
    assert(result.height >= policy.minHeight, label + ': result is below minHeight');
  }

  return {
    label,
    status: 'passed',
    strategy: result.strategy,
    size: result.size,
    width: result.width,
    height: result.height,
    mimeType: result.mimeType,
    attempts: result.attempts.length
  };
}

async function runSuccessCase(label, fixtureOptions, policy) {
  const fixture = await createFixture(fixtureOptions);
  const result = await prepareImageToBudget(fixture.file, policy);

  return summarizeSuccess(label, fixture, policy, result);
}

async function runBudgetUnreachableCase() {
  const label = 'budget-unreachable reports attempts';
  const fixture = await createFixture({
    kind: 'noise',
    width: 400,
    height: 300,
    type: 'image/png',
    name: 'unreachable-noise.png'
  });

  try {
    await prepareImageToBudget(fixture.file, {
      outputMaxBytes: 1,
      outputType: 'image/webp',
      minWidth: 300,
      minHeight: 225,
      maxEncodeAttempts: 3,
      initialQuality: 0.8,
      minQuality: 0.7
    });
  } catch (error) {
    assert(isImageBudgetError(error), label + ': expected ImageBudgetError');
    assert(error.code === 'budget_unreachable', label + ': expected budget_unreachable');
    assert(
      Array.isArray(error.details.attempts) && error.details.attempts.length > 0,
      label + ': expected attempts in error details'
    );

    return {
      label,
      status: 'passed',
      strategy: 'expected-error',
      size: 0,
      width: 0,
      height: 0,
      mimeType: 'image/webp',
      attempts: error.details.attempts.length
    };
  }

  throw new Error(label + ': expected budget_unreachable error.');
}

window.runBrowserBudgetLab = async () => {
  const cases = [
    await runSuccessCase(
      'gradient to webp budget',
      {
        kind: 'gradient',
        width: 1200,
        height: 800,
        type: 'image/png',
        name: 'gradient.png'
      },
      {
        outputMaxBytes: 90_000,
        outputType: 'image/webp',
        maxWidth: 700,
        maxHeight: 500,
        minWidth: 200,
        minHeight: 120
      }
    ),
    await runSuccessCase(
      'noise to jpeg budget',
      {
        kind: 'noise',
        width: 900,
        height: 600,
        type: 'image/png',
        name: 'noise.png'
      },
      {
        outputMaxBytes: 180_000,
        outputType: 'image/jpeg',
        maxWidth: 600,
        maxHeight: 400,
        initialQuality: 0.82,
        minQuality: 0.45,
        maxEncodeAttempts: 10
      }
    ),
    await runSuccessCase(
      'transparent png resize',
      {
        kind: 'transparent',
        width: 512,
        height: 512,
        type: 'image/png',
        name: 'transparent.png'
      },
      {
        outputMaxBytes: 30_000,
        outputType: 'image/png',
        maxWidth: 256,
        maxHeight: 256
      }
    ),
    await runSuccessCase(
      'tiny image is not upscaled',
      {
        kind: 'solid',
        width: 48,
        height: 32,
        type: 'image/png',
        name: 'tiny.png'
      },
      {
        outputMaxBytes: 20_000,
        outputType: 'image/webp',
        maxWidth: 256,
        maxHeight: 256
      }
    ),
    await runBudgetUnreachableCase()
  ];

  return {
    userAgent: navigator.userAgent,
    cases
  };
};
</script>
</body>
</html>`;
}

function createStaticServer() {
  const html = createLabHtml();
  const reactShim = [
    'const unsupported = () => {',
    '  throw new Error("React hooks are not available in the browser budget lab.");',
    '};',
    'export const useCallback = unsupported;',
    'export const useEffect = unsupported;',
    'export const useMemo = unsupported;',
    'export const useRef = unsupported;',
    'export const useState = unsupported;'
  ].join('\n');

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    if (url.pathname === '/' || url.pathname === '/lab.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }

    if (url.pathname === '/react-shim.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(reactShim);
      return;
    }

    try {
      const requestedPath = resolve(rootDirectory, `.${url.pathname}`);
      const containedPath = resolveContainedPath(requestedPath);

      if (!containedPath) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      const content = readFileSync(containedPath);
      const contentType = contentTypes.get(extname(containedPath)) ?? 'application/octet-stream';
      response.writeHead(200, { 'content-type': contentType });
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });

  return new Promise((resolveServer, rejectServer) => {
    server.once('error', rejectServer);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        rejectServer(new Error('Unable to resolve browser lab server port.'));
        return;
      }

      resolveServer({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((resolveClose) => server.close(resolveClose))
      });
    });
  });
}

async function runBrowser(browserName, origin) {
  const browserType = browserTypes[browserName];
  let browser;

  try {
    browser = await browserType.launch();
  } catch (error) {
    throw new Error(
      `Unable to launch ${browserName}. Run "npx playwright install ${browserName}".`,
      { cause: error }
    );
  }

  try {
    const page = await browser.newPage();
    const diagnostics = [];

    page.on('console', (message) => {
      diagnostics.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => {
      diagnostics.push(`pageerror: ${error.stack || error.message}`);
    });
    page.on('requestfailed', (request) => {
      diagnostics.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`);
    });
    page.on('response', (response) => {
      if (!response.ok()) {
        diagnostics.push(`response: ${response.status()} ${response.url()}`);
      }
    });

    await page.goto(`${origin}/lab.html`, { waitUntil: 'networkidle' });

    try {
      await page.waitForFunction(() => typeof window.runBrowserBudgetLab === 'function');
    } catch (error) {
      const detail = diagnostics.length > 0
        ? diagnostics.join('\n')
        : 'No browser console diagnostics were emitted.';

      throw new Error(
        `${browserName} did not initialize the browser budget lab.\n${detail}`,
        { cause: error }
      );
    }

    const result = await page.evaluate(() => window.runBrowserBudgetLab());

    return {
      browser: browserName,
      ...result
    };
  } finally {
    await browser.close();
  }
}

function formatMarkdown(report) {
  const lines = [
    '# Browser budget lab report',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '| Engine | Case | Status | MIME | Size | Dimensions | Strategy | Attempts |',
    '| --- | --- | --- | --- | ---: | --- | --- | ---: |'
  ];

  for (const engine of report.engines) {
    for (const testCase of engine.cases) {
      lines.push(
        `| ${engine.browser} | ${testCase.label} | ${testCase.status} | ` +
          `${testCase.mimeType} | ${testCase.size} | ` +
          `${testCase.width}x${testCase.height} | ${testCase.strategy} | ` +
          `${testCase.attempts} |`
      );
    }
  }

  lines.push('');
  lines.push('The lab asserts budget, MIME, dimension, and stable error behavior.');
  lines.push('It does not assert byte-identical output across browser engines.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function writeOutput(path, content) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

const options = parseArgs(process.argv.slice(2));
const distEntrypoint = resolve(rootDirectory, 'dist/headless.js');

try {
  readFileSync(distEntrypoint);
} catch {
  throw new Error(
    `Missing ${pathToFileURL(distEntrypoint).href}. Run "npm run build:lib" before the browser budget lab.`
  );
}

const server = await createStaticServer();

try {
  const engines = [];

  for (const browserName of options.browsers) {
    engines.push(await runBrowser(browserName, server.origin));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    engines
  };
  const markdown = formatMarkdown(report);

  process.stdout.write(markdown);

  if (options.jsonOutput) {
    writeOutput(options.jsonOutput, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (options.markdownOutput) {
    writeOutput(options.markdownOutput, markdown);
  }
} finally {
  await server.close();
}
