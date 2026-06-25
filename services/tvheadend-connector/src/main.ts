import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { pipeH264Transcode } from './ffmpeg-transcoder.js';
import { StreamTicketStore, type StreamQuality } from './stream-tickets.js';
import { fetchTvheadendChannels, fetchTvheadendPlaylistChannels, type ConnectorChannel } from './tvheadend-client.js';

const app = express();
const port = Number(process.env.PORT ?? process.env.TVHEADEND_CONNECTOR_PORT ?? 3100);
const mockMode = (process.env.MOCK_MODE ?? 'true') === 'true';
const streamTickets = new StreamTicketStore(60);

app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

const mockChannels: ConnectorChannel[] = [
  { id: 'ard-hd', number: 1, name: 'ARD HD', uuid: 'mock-ard-hd', profile: 'hls-lan' },
  { id: 'zdf-hd', number: 2, name: 'ZDF HD', uuid: 'mock-zdf-hd', profile: 'hls-lan' },
  { id: 'rtl-hd', number: 3, name: 'RTL HD', uuid: 'mock-rtl-hd', profile: 'hls-lan' }
].map((channel) => ({ ...channel, enabled: true }));

const tvheadendConfig = {
  baseUrl: process.env.TVHEADEND_BASE_URL ?? '',
  username: process.env.TVHEADEND_USERNAME ?? '',
  password: process.env.TVHEADEND_PASSWORD ?? '',
  profile: process.env.TVHEADEND_DEFAULT_PROFILE ?? 'pass'
};

async function channels(): Promise<ConnectorChannel[]> {
  if (mockMode) {
    return mockChannels;
  }

  try {
    return await fetchTvheadendChannels(tvheadendConfig);
  } catch (cause) {
    console.warn('TVHeadend channel grid unavailable, using channel playlist:', cause instanceof Error ? cause.message : cause);
    return fetchTvheadendPlaylistChannels(tvheadendConfig);
  }
}

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'streamgate-tvheadend-connector', mode: mockMode ? 'mock' : 'tvheadend' });
});

app.get('/stream-profiles', (_request, response) => {
  response.json({
    profiles: [
      { id: 'hd', label: 'HD', description: 'Serverseitig als H.264 in Originalaufloesung transcodiert' },
      { id: 'sd-480p', label: 'SD', description: 'Serverseitig als H.264 auf 480p transcodiert' }
    ]
  });
});

app.get('/channels', async (_request, response) => {
  try {
    response.json({ channels: await channels() });
  } catch (cause) {
    console.error('TVHeadend channel loading failed:', cause instanceof Error ? cause.message : cause);
    response.status(502).json({ message: 'TVHeadend-Sender konnten nicht geladen werden.' });
  }
});

app.get('/epg/now-next', async (_request, response) => {
  const channelList = mockMode ? mockChannels : await channels();
  response.json({
    items: channelList.map((channel) => ({
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

app.post('/streams/open', async (request, response) => {
  try {
    const channelId = String(request.body.channelId ?? '');
    const channel = (await channels()).find((item) => item.id === channelId || item.uuid === channelId);
    if (!channel) {
      response.status(404).json({ message: 'Channel not found' });
      return;
    }

    if (mockMode) {
      const quality = normalizeQuality(request.body.quality);
      const issued = streamTickets.issue(channel.id, channel.profile, quality);
      response.json({
        channelId: channel.id,
        quality,
        label: qualityLabel(quality),
        mimeType: 'application/x-mpegURL',
        ticket: issued.ticket,
        expiresIn: issued.expiresIn
      });
      return;
    }

    const profile = String(request.body.profile ?? tvheadendConfig.profile);
    const quality = normalizeQuality(request.body.quality);
    const issued = streamTickets.issue(channel.uuid, profile, quality);
    response.json({
      channelId: channel.uuid,
      quality,
      label: qualityLabel(quality),
      mimeType: 'video/mp2t',
      ticket: issued.ticket,
      expiresIn: issued.expiresIn
    });
  } catch (cause) {
    console.error('TVHeadend stream preparation failed:', cause instanceof Error ? cause.message : cause);
    response.status(502).json({ message: 'TVHeadend-Stream konnte nicht vorbereitet werden.' });
  }
});

app.get('/stream/ticket/:ticket', async (request, response) => {
  const streamTicket = streamTickets.resolve(request.params.ticket);
  if (!streamTicket) {
    response.status(403).json({ message: 'Stream-Link ist ungueltig oder abgelaufen.' });
    return;
  }

  if (mockMode) {
    response.redirect(307, 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
    return;
  }

  const abortController = new AbortController();
  response.on('close', () => abortController.abort());

  try {
    response.status(200);
    response.setHeader('content-type', 'video/mp2t');
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-accel-buffering', 'no');
    await pipeH264Transcode(
      tvheadendConfig,
      {
        channelId: streamTicket.channelId,
        profile: streamTicket.profile,
        quality: streamTicket.quality,
        signal: abortController.signal
      },
      response
    );
  } catch (cause) {
    if (abortController.signal.aborted) {
      return;
    }
    console.error('TVHeadend stream proxy failed:', cause instanceof Error ? cause.message : cause);
    if (!response.headersSent) {
      response.status(502).json({ message: 'TVHeadend-Stream ist nicht verfuegbar.' });
    } else {
      response.destroy();
    }
  }
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

function normalizeQuality(value: unknown): StreamQuality {
  return value === 'sd-480p' ? 'sd-480p' : 'hd';
}

function qualityLabel(quality: StreamQuality) {
  return quality === 'sd-480p' ? 'SD' : 'HD';
}
