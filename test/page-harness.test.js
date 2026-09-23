const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { serve } = require('./page-harness');

function status(port, path) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path }, (res) => {
        res.resume();
        resolve(res.statusCode);
      })
      .on('error', reject);
  });
}

test('the test server serves the page and refuses paths outside the repo', async (t) => {
  const server = await serve();
  t.after(() => server.close());
  const { port } = server.address();
  assert.equal(await status(port, '/home.html'), 200);
  assert.equal(await status(port, '/missing.html'), 404);
  assert.equal(await status(port, '/%2e%2e/%2e%2e/%2e%2e/etc/hosts'), 403);
  assert.equal(await status(port, '/..%2f..%2f..%2fetc%2fhosts'), 403);
});
