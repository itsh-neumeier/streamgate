import assert from 'node:assert/strict';
import test from 'node:test';
import { StreamTicketStore } from './stream-tickets.js';

test('issues opaque stream tickets and expires them', () => {
  const store = new StreamTicketStore(60);
  const issued = store.issue('channel-uuid', 'pass', 1000);

  assert.match(issued.ticket, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(store.resolve(issued.ticket, 1059), { channelId: 'channel-uuid', profile: 'pass', expiresAt: 1060 });
  assert.equal(store.resolve(issued.ticket, 1061), null);
});
