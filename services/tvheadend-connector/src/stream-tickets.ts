import { randomBytes } from 'node:crypto';

export interface StreamTicket {
  channelId: string;
  profile: string;
  expiresAt: number;
}

export class StreamTicketStore {
  private readonly tickets = new Map<string, StreamTicket>();

  constructor(private readonly ttlSeconds = 60) {}

  issue(channelId: string, profile: string, now = Math.floor(Date.now() / 1000)) {
    this.prune(now);
    const ticket = randomBytes(32).toString('base64url');
    const value = { channelId, profile, expiresAt: now + this.ttlSeconds };
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
