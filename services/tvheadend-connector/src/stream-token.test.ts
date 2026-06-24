import assert from 'node:assert/strict';
import test from 'node:test';
import { createStreamToken, validateStreamToken } from './stream-token.js';

test('accepts valid stream tokens and rejects expired or changed tokens', () => {
  const data = { sessionId: 'str_123', channelId: 'channel-uuid', profile: 'pass', expiresAt: 2000 };
  const token = createStreamToken(data, 'test-secret');

  assert.equal(validateStreamToken(data, token, 'test-secret', 1900), true);
  assert.equal(validateStreamToken({ ...data, channelId: 'other' }, token, 'test-secret', 1900), false);
  assert.equal(validateStreamToken(data, token, 'test-secret', 2001), false);
});
