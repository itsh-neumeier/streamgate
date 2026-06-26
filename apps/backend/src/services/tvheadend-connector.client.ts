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

  async openStream(
    channelId: string,
    profile: string,
    quality: 'hd' | 'sd-480p' = 'hd',
    tvheadend?: {
      username?: string;
      password?: string;
      defaultProfile?: string;
      hdProfile?: string;
      sdProfile?: string;
      dvrProfile?: string;
    }
  ) {
    const response = await fetch(`${this.baseUrl}/streams/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channelId,
        profile: tvheadend?.defaultProfile ?? profile,
        quality,
        tvheadendUsername: tvheadend?.username,
        tvheadendPassword: tvheadend?.password,
        tvheadendHdProfile: tvheadend?.hdProfile,
        tvheadendSdProfile: tvheadend?.sdProfile
      })
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

  async createTimer(body: {
    customerId: string;
    tvheadendUsername: string;
    tvheadendPassword?: string;
    tvheadendProfile: string;
    dvrProfile: string;
    channelId: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
  }) {
    const response = await fetch(`${this.baseUrl}/dvr/timers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`TVHeadend connector DVR timer request returned ${response.status}`);
    }

    return response.json() as Promise<{ id: string; status: string }>;
  }

  async deleteTimer(id: string) {
    const response = await fetch(`${this.baseUrl}/dvr/timers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`TVHeadend connector DVR timer delete returned ${response.status}`);
    }
    return response.json() as Promise<{ ok: boolean; id: string }>;
  }
}
