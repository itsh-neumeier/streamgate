import cors from 'cors';
import express from 'express';
import morgan from 'morgan';

const app = express();
const port = Number(process.env.PORT ?? process.env.TVHEADEND_CONNECTOR_PORT ?? 3100);
const mockMode = (process.env.MOCK_MODE ?? 'true') === 'true';

app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

const channels = [
  { id: 'ard-hd', number: 1, name: 'ARD HD', uuid: 'mock-ard-hd', profile: 'hls-lan' },
  { id: 'zdf-hd', number: 2, name: 'ZDF HD', uuid: 'mock-zdf-hd', profile: 'hls-lan' },
  { id: 'rtl-hd', number: 3, name: 'RTL HD', uuid: 'mock-rtl-hd', profile: 'hls-lan' }
];

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'streamgate-tvheadend-connector', mode: mockMode ? 'mock' : 'tvheadend' });
});

app.get('/channels', (_request, response) => {
  response.json({ channels });
});

app.get('/epg/now-next', (_request, response) => {
  response.json({
    items: channels.map((channel) => ({
      channelId: channel.id,
      now: {
        title: `${channel.name} Live`,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 1800000).toISOString()
      },
      next: {
        title: `${channel.name} Journal`,
        startsAt: new Date(Date.now() + 1800000).toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString()
      }
    }))
  });
});

app.get('/dvr/recordings', (_request, response) => {
  response.json({ recordings: [] });
});

app.get('/dvr/timers', (_request, response) => {
  response.json({ timers: [] });
});

app.post('/dvr/timers', (request, response) => {
  response.status(201).json({ id: `tvh_timer_${Date.now()}`, status: 'scheduled', ...request.body });
});

app.delete('/dvr/timers/:id', (request, response) => {
  response.json({ ok: true, id: request.params.id });
});

app.post('/users/map', (request, response) => {
  response.json({
    customerId: request.body.customerId,
    tvheadendUsername: `sg_${request.body.customerId}`,
    tvheadendProfile: request.body.profile ?? process.env.TVHEADEND_DEFAULT_PROFILE ?? 'pass'
  });
});

app.post('/streams/open', (request, response) => {
  const channelId = String(request.body.channelId ?? '');
  const channel = channels.find((item) => item.id === channelId);
  if (!channel) {
    response.status(404).json({ message: 'Channel not found' });
    return;
  }

  if (mockMode) {
    response.json({
      sourceUrl: `http://streamgate-tvheadend-connector:${port}/stream/mock/${channel.id}.m3u8`,
      mimeType: 'application/x-mpegURL'
    });
    return;
  }

  const baseUrl = process.env.TVHEADEND_BASE_URL;
  if (!baseUrl) {
    response.status(500).json({ message: 'TVHEADEND_BASE_URL missing' });
    return;
  }

  response.json({
    sourceUrl: `${baseUrl}/stream/channel/${channel.uuid}?profile=${request.body.profile ?? channel.profile}`,
    mimeType: 'application/x-mpegURL'
  });
});

app.get('/stream/mock/:channelId.m3u8', (request, response) => {
  const channelId = request.params.channelId;
  response.type('application/vnd.apple.mpegurl');
  response.send(`#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXT-X-ENDLIST
# ${channelId}
`);
});

app.listen(port, () => {
  console.log(`streamgate-tvheadend-connector listening on ${port}`);
});
