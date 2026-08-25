/**
 * Jest global setup — disable real network, block unmocked Cloudflare API calls.
 */
const nock = require('nock');

// Disallow any real HTTP network access from tests
beforeAll(() => {
  nock.disableNetConnect();
  // Allow localhost only (in case future tests need)
  nock.enableNetConnect('127.0.0.1');
});

afterAll(() => {
  nock.enableNetConnect();
  nock.cleanAll();
});

afterEach(() => {
  if (!nock.isDone()) {
    // eslint-disable-next-line no-console
    console.error('Pending mocks not called:', nock.pendingMocks());
  }
  nock.cleanAll();
});
