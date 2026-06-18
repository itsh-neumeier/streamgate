import { Injectable } from '@nestjs/common';

@Injectable()
export class TvheadendConnectorClient {
  private readonly baseUrl = process.env.TVHEADEND_CONNECTOR_URL ?? 'http://localhost:3100';

  async openStream(channelId: string, profile: string) {
    if ((process.env.MOCK_MODE ?? 'true') === 'true') {
      return {
        sourceUrl: `${this.baseUrl}/stream/mock/${channelId}.m3u8?profile=${profile}`,
        mimeType: 'application/x-mpegURL'
      };
    }

    const response = await fetch(`${this.baseUrl}/streams/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channelId, profile })
    });

    if (!response.ok) {
      throw new Error(`TVHeadend connector returned ${response.status}`);
    }

    return response.json() as Promise<{ sourceUrl: string; mimeType: string }>;
  }
}
