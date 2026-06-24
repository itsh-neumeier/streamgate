import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { fetchTvheadendChannels, parseTvheadendPlaylist } from './tvheadend-client.js';

test('loads and normalizes channels from the TVHeadend channel grid', async (context) => {
  const server = createServer((request, response) => {
    assert.equal(request.headers.authorization, `Basic ${Buffer.from('streamgate:secret').toString('base64')}`);
    const url = new URL(request.url ?? '/', 'http://localhost');
    assert.equal(url.pathname, '/api/channel/grid');
    assert.equal(url.searchParams.get('limit'), '10000');

    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        entries: [
          { uuid: 'uuid-zdf', number: 2, name: 'ZDF HD', enabled: true },
          { uuid: 'uuid-ard', number: 1, name: 'ARD HD', enabled: true }
        ]
      })
    );
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const channels = await fetchTvheadendChannels({
    baseUrl: `http://127.0.0.1:${address.port}`,
    username: 'streamgate',
    password: 'secret',
    profile: 'pass'
  });

  assert.deepEqual(
    channels.map(({ id, number, name }) => ({ id, number, name })),
    [
      { id: 'uuid-ard', number: 1, name: 'ARD HD' },
      { id: 'uuid-zdf', number: 2, name: 'ZDF HD' }
    ]
  );
});

test('parses TVHeadend channel playlists without exposing stream URLs', () => {
  const channels = parseTvheadendPlaylist(
    `#EXTM3U
#EXTINF:-1 tvg-logo="http://tvheadend/imagecache/1" tvg-id="uuid-one",Sender Eins
http://tvheadend:9981/stream/channelid/uuid-one
#EXTINF:-1 tvg-id="uuid-two",Sender Zwei
http://tvheadend:9981/stream/channelid/uuid-two
`,
    'pass'
  );

  assert.deepEqual(channels, [
    { id: 'uuid-one', uuid: 'uuid-one', number: 1, name: 'Sender Eins', enabled: true, profile: 'pass' },
    { id: 'uuid-two', uuid: 'uuid-two', number: 2, name: 'Sender Zwei', enabled: true, profile: 'pass' }
  ]);
  assert.equal(JSON.stringify(channels).includes('tvheadend'), false);
});
