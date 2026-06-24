import { createHmac, timingSafeEqual } from 'node:crypto';

export interface StreamTokenData {
  sessionId: string;
  channelId: string;
  profile: string;
  expiresAt: number;
}

export function createStreamToken(data: StreamTokenData, secret: string) {
  return createHmac('sha256', secret).update(payload(data)).digest('hex');
}

export function validateStreamToken(data: StreamTokenData, token: string, secret: string, now = Math.floor(Date.now() / 1000)) {
  if (!secret || !data.sessionId || !data.channelId || !data.profile || data.expiresAt < now || !/^[a-f0-9]{64}$/i.test(token)) {
    return false;
  }

  const expected = Buffer.from(createStreamToken(data, secret), 'hex');
  const supplied = Buffer.from(token, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function payload(data: StreamTokenData) {
  return [data.sessionId, data.channelId, data.profile, data.expiresAt].join('\n');
}
