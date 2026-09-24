// Opens a page of the site (home.html by default) in a real, headed Chrome window. Headed on purpose: a
// headless page reports itself hidden, so requestAnimationFrame never fires and
// every animation this page runs would sit frozen at frame zero.
const http = require('node:http');
const { readFile } = require('node:fs/promises');
const { join, extname, resolve, sep } = require('node:path');
const { chromium } = require('playwright-core');

const ROOT = join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer(async (req, res) => {
    // resolve against the repo root and refuse anything that lands outside it
    const file = resolve(ROOT, `.${decodeURIComponent(req.url.split('?')[0])}`);
    if (!file.startsWith(ROOT + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function openPage(t, { url = 'home.html', width = 1440, height = 900 } = {}) {
  const server = await serve();
  let browser = null;
  // registered before the launch, so a Chrome that fails to start still releases the port
  t.after(async () => {
    if (browser) await browser.close();
    server.close();
  });
  browser = await chromium.launch({ channel: 'chrome', headless: false });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const { port } = server.address();
  await page.goto(`http://127.0.0.1:${port}/${url}`);
  return { page, errors };
}

async function scrollToSelector(page, selector, offset = 80) {
  await page.evaluate(
    ([sel, off]) => window.scrollTo(0, document.querySelector(sel).getBoundingClientRect().top + window.scrollY - off),
    [selector, offset],
  );
}

// Rests the pointer inside an element, a little above its middle.
async function hoverOver(page, selector) {
  const box = await (await page.$(selector)).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
}

// Page state that arrives on animation frames and timers lands later on a loaded runner.
// Re-read it until `done` accepts it or `ms` runs out, and return the last read for the assertion.
async function settle(read, done, ms = 12000) {
  const end = Date.now() + ms;
  let value = await read();
  while (!done(value) && Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    value = await read();
  }
  return value;
}

module.exports = { hoverOver, openPage, scrollToSelector, serve, settle };
