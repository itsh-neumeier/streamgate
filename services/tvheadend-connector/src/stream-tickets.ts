import { randomBytes } from 'node:crypto';

export type StreamQuality = 'hd' | 'sd-480p';
export type StreamMode = 'streamgate' | 'tvheadend-profile';

export interface StreamTicket {
  channelId: string;
  profile: string;
  quality: StreamQuality;
  mode: StreamMode;
  mimeType: string;
  expiresAt: number;
}

export class StreamTicketStore {
  private readonly tickets = new Map<string, StreamTicket>();

  constructor(private readonly ttlSeconds = 60) {}

  issue(
    channelId: string,
    profile: string,
    quality: StreamQuality = 'hd',
    mode: StreamMode = 'streamgate',
    mimeType = 'video/mp2t',
    now = Math.floor(Date.now() / 1000)
  ) {
    this.prune(now);
    const ticket = randomBytes(32).toString('base64url');
    const value = { channelId, profile, quality, mode, mimeType, expiresAt: now + this.ttlSeconds };
    this.tickets.set(ticket, value);
    return { ticket, expiresIn: this.ttlSeconds, ...value };
  }

  resolve(ticket: string, now = Math.floor(Date.now() / 1000)) {
    const value = this.tickets.get(ticket);
    if (!value || value.expiresAt < now) {
      this.tickets.delete(ticket);
      return null;
    }
    return value;
  }

  private prune(now: number) {
    for (const [ticket, value] of this.tickets) {
      if (value.expiresAt < now) {
        this.tickets.delete(ticket);
      }
    }
  }
}
