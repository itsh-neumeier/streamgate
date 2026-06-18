export interface Dashboard {
  activeCustomers: number;
  activeDevices: number;
  activeStreams: number;
  onlineDevices: number;
  offlineDevices: number;
  tvheadendStatus: string;
}

export interface Customer {
  id: string;
  name: string;
  status: string;
  packageId: string;
  maxDevices: number;
  maxConcurrentStreams: number;
  dvrEnabled: boolean;
}

export interface Device {
  id: string;
  customerId: string;
  name: string;
  status: string;
  appVersion?: string;
  lastSeenAt?: string;
  lastChannelId?: string;
  updateChannel: string;
}

export interface Channel {
  id: string;
  number: number;
  name: string;
  logoUrl?: string;
  groupId: string;
  enabled: boolean;
  dvrAllowed: boolean;
  favorite: boolean;
}

export interface ChannelPackage {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  channelIds: string[];
}

export interface StreamSession {
  id: string;
  customerId: string;
  deviceId: string;
  channelId: string;
  status: string;
  openedAt: string;
}
