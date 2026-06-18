export type DeviceType = 'android_tv';
export type DeviceStatus = 'active' | 'blocked' | 'reset';
export type CustomerStatus = 'active' | 'suspended' | 'deleted';
export type StreamSessionStatus = 'active' | 'closed' | 'expired' | 'error';

export interface StreamGateChannel {
  id: string;
  number: number;
  name: string;
  logoUrl?: string;
  groupId?: string;
  favorite?: boolean;
  streamProfile?: string;
}
