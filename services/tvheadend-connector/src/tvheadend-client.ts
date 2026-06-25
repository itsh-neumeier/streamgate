import playlistParser from 'iptv-playlist-parser';

export interface ConnectorChannel {
  id: string;
  uuid: string;
  number: number;
  name: string;
  enabled: boolean;
  profile: string;
}

interface TvheadendChannelEntry {
  uuid?: unknown;
  number?: unknown;
  name?: unknown;
  enabled?: unknown;
}

interface TvheadendChannelGrid {
  entries?: unknown;
}

export interface TvheadendConfig {
  baseUrl: string;
  username: string;
  password: string;
  profile: string;
}

export async function fetchTvheadendChannels(config: TvheadendConfig): Promise<ConnectorChannel[]> {
  const { endpoint, headers } = authenticatedEndpoint(config, '/api/channel/grid');
  endpoint.searchParams.set('start', '0');
  endpoint.searchParams.set('limit', '10000');
  endpoint.searchParams.set('sort', 'number');
  endpoint.searchParams.set('dir', 'ASC');

  const response = await fetch(endpoint, {
    headers,
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`TVHeadend channel grid returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as TvheadendChannelGrid;
  if (!Array.isArray(payload.entries)) {
    throw new Error('TVHeadend channel grid response has no entries array');
  }

  return payload.entries
    .map((value, index) => mapChannel(value as TvheadendChannelEntry, index, config.profile))
    .filter((channel): channel is ConnectorChannel => channel !== null)
    .sort((left, right) => left.number - right.number || left.name.localeCompare(right.name));
}

export async function fetchTvheadendPlaylistChannels(config: TvheadendConfig): Promise<ConnectorChannel[]> {
  const { endpoint, headers } = authenticatedEndpoint(config, '/playlist/channels');
  const response = await fetch(endpoint, {
    headers,
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`TVHeadend channel playlist returned HTTP ${response.status}`);
  }

  return parseTvheadendPlaylist(await response.text(), config.profile);
}

export function tvheadendStreamRequest(config: TvheadendConfig, channelId: string, profile: string) {
  const { endpoint, headers } = authenticatedEndpoint(config, `/stream/channel/${encodeURIComponent(channelId)}`);
  endpoint.searchParams.set('profile', profile);
  return { endpoint, headers };
}

export function parseTvheadendPlaylist(content: string, profile: string): ConnectorChannel[] {
  const playlist = playlistParser.parse(content);
  return playlist.items
    .map<ConnectorChannel | null>((item, index) => {
      const uuid = item.tvg.id?.trim() || channelUuidFromStreamUrl(item.url);
      const name = item.name.trim();
      if (!uuid || !name) {
        return null;
      }

      return {
        id: uuid,
        uuid,
        number: index + 1,
        name,
        enabled: true,
        profile
      } satisfies ConnectorChannel;
    })
    .filter((channel): channel is ConnectorChannel => channel !== null);
}

function mapChannel(entry: TvheadendChannelEntry, index: number, profile: string): ConnectorChannel | null {
  const uuid = typeof entry.uuid === 'string' ? entry.uuid.trim() : '';
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  if (!uuid || !name) {
    return null;
  }

  const parsedNumber = typeof entry.number === 'number' ? entry.number : Number(entry.number);
  const number = Number.isFinite(parsedNumber) && parsedNumber > 0 ? Math.trunc(parsedNumber) : index + 1;

  return {
    id: uuid,
    uuid,
    number,
    name,
    enabled: entry.enabled !== false,
    profile
  };
}

function authenticatedEndpoint(config: TvheadendConfig, path: string) {
  if (!config.baseUrl) {
    throw new Error('TVHEADEND_BASE_URL is missing');
  }

  const baseUrl = new URL(config.baseUrl);
  const username = config.username || decodeURIComponent(baseUrl.username);
  const password = config.password || decodeURIComponent(baseUrl.password);
  baseUrl.username = '';
  baseUrl.password = '';
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}${path}`;
  baseUrl.search = '';
  baseUrl.hash = '';

  const headers: Record<string, string> = { accept: 'application/json, audio/x-mpegurl' };
  if (username || password) {
    headers.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  return { endpoint: baseUrl, headers };
}

function channelUuidFromStreamUrl(streamUrl: string) {
  try {
    const path = new URL(streamUrl).pathname;
    return decodeURIComponent(path.match(/\/(?:channelid|channel)\/([^/]+)$/)?.[1] ?? '');
  } catch {
    return '';
  }
}
