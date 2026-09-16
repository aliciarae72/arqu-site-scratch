// Opens home.html in a real, headed Chrome window. Headed on purpose: a
// headless page reports itself hidden, so requestAnimationFrame never fires and
// every animation this page runs would sit frozen at frame zero.
const http = require('node:http');
const { readFile } = require('node:fs/promises');
const { join, extname, normalize } = require('node:path');
const { chromium } = require('playwright-core');

const ROOT = join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function openHome(t, { width = 1440, height = 900, query = '' } = {}) {
  const server = await serve();
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  t.after(async () => {
    await browser.close();
    server.close();
  });
  const { port } = server.address();
  await page.goto(`http://127.0.0.1:${port}/home.html${query}`);
  return { page, errors };
}

async function scrollToSelector(page, selector, offset = 80) {
  await page.evaluate(
    ([sel, off]) => window.scrollTo(0, document.querySelector(sel).getBoundingClientRect().top + window.scrollY - off),
    [selector, offset],
  );
}

module.exports = { openHome, scrollToSelector };
