import { Injectable } from '@nestjs/common';

@Injectable()
export class TvheadendConnectorClient {
  private readonly baseUrl = process.env.TVHEADEND_CONNECTOR_URL ?? 'http://localhost:3100';

  async channels() {
    const response = await fetch(`${this.baseUrl}/channels`);
    if (!response.ok) {
      throw new Error(`TVHeadend connector channel request returned ${response.status}`);
    }

    return response.json() as Promise<{
      channels: Array<{
        id: string;
        uuid: string;
        number: number;
        name: string;
        enabled: boolean;
        profile: string;
      }>;
    }>;
  }

  async openStream(channelId: string, profile: string, quality: 'hd' | 'sd-480p' = 'hd') {
    const response = await fetch(`${this.baseUrl}/streams/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channelId, profile, quality })
    });

    if (!response.ok) {
      throw new Error(`TVHeadend connector returned ${response.status}`);
    }

    return response.json() as Promise<{
      channelId: string;
      mimeType: string;
      ticket: string;
      expiresIn: number;
      quality: 'hd' | 'sd-480p';
      label: string;
      mode?: 'streamgate' | 'tvheadend-profile';
      profile?: string;
    }>;
  }
}
